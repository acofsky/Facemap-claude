import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_MODEL = "claude-haiku-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Hard cap so a runaway client can't blow our context window or our wallet.
// Sources that yield more rows than this should batch on the client.
const MAX_CANDIDATES_PER_CALL = 80;

interface Candidate {
  id: string;
  source: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  context?: string;
}

interface RankedCandidate {
  id: string;
  score: number;
  rationale: string;
  bullets: string[];
}

const SYSTEM_PROMPT = `You score imported contact stubs for relevance to a user's stated import goal, and draft 1-3 short bullets that would help the user remember each person.

Rules:
- Score is 0.0 to 1.0. Use the full range. If the user gave no filter, score by how well-formed and useful the stub is (more known fields = higher).
- Bullets are short fragments (no leading bullet character), e.g. "Senior PM at Stripe", "Met via Calendar — 4 meetings", "LinkedIn connection". Never invent facts. Only restate what's in the candidate's data plus the source.
- Rationale is a 6-12 word phrase explaining the score, e.g. "Senior tech role matches your finance career goal", "Common name with no other data".
- Return STRICT JSON. No prose, no markdown fences. Match the requested shape exactly.`;

interface RequestBody {
  warm?: boolean;
  filter_text?: string;
  candidates?: Candidate[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const reqBody = (await req.json()) as RequestBody;

    if (reqBody?.warm === true) {
      return new Response(JSON.stringify({ warmed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filterText = (reqBody.filter_text || "").trim();
    const candidates = Array.isArray(reqBody.candidates) ? reqBody.candidates : [];

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ ranked: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (candidates.length > MAX_CANDIDATES_PER_CALL) {
      return new Response(
        JSON.stringify({ error: `Too many candidates (${candidates.length}). Batch ≤ ${MAX_CANDIDATES_PER_CALL}.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const userMessage = buildUserMessage(filterText, candidates);

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = ((data.content || []) as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("")
      .trim();

    const ranked = parseRanked(text, candidates);

    return new Response(JSON.stringify({ ranked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rank-import-candidates error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildUserMessage(filterText: string, candidates: Candidate[]): string {
  const goal = filterText
    ? `The user's import goal:\n"""${filterText}"""\n`
    : `The user did not specify a filter — score by stub quality.\n`;

  const lines = candidates.map((c, i) => {
    const parts: string[] = [`#${i + 1} id=${c.id} source=${c.source}`];
    if (c.name) parts.push(`name: ${c.name}`);
    if (c.company) parts.push(`company: ${c.company}`);
    if (c.title) parts.push(`title: ${c.title}`);
    if (c.email) parts.push(`email: ${c.email}`);
    if (c.phone) parts.push(`phone: ${c.phone}`);
    if (c.context) parts.push(`context: ${c.context}`);
    return parts.join("\n  ");
  });

  return `${goal}
Score and bullet-summarize each candidate below.

${lines.join("\n\n")}

Return JSON in this exact shape (no prose, no markdown fences):
{"ranked":[{"id":"<candidate id>","score":0.0,"rationale":"<6-12 words>","bullets":["...","..."]}, ...]}
Every candidate id above must appear exactly once. Bullets array has 1 to 3 entries.`;
}

function parseRanked(text: string, candidates: Candidate[]): RankedCandidate[] {
  // Tolerate a stray ```json fence if the model produced one.
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.warn("Failed to parse model JSON, falling back to neutral scores", e);
    return candidates.map((c) => neutral(c));
  }

  const rankedRaw = (parsed as { ranked?: unknown[] })?.ranked;
  if (!Array.isArray(rankedRaw)) return candidates.map((c) => neutral(c));

  const byId = new Map<string, RankedCandidate>();
  for (const r of rankedRaw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : null;
    if (!id) continue;
    const score = typeof rec.score === "number" ? Math.max(0, Math.min(1, rec.score)) : 0.5;
    const rationale = typeof rec.rationale === "string" ? rec.rationale : "";
    const bullets = Array.isArray(rec.bullets)
      ? rec.bullets.filter((b): b is string => typeof b === "string").slice(0, 3)
      : [];
    byId.set(id, { id, score, rationale, bullets });
  }

  return candidates.map((c) => byId.get(c.id) || neutral(c));
}

function neutral(c: Candidate): RankedCandidate {
  return {
    id: c.id,
    score: 0.5,
    rationale: "",
    bullets: [c.name].filter(Boolean),
  };
}
