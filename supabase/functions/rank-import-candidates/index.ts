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
// Sources that yield more rows than this should batch on the client. The
// matching CHUNK_SIZE in src/lib/import/rank.ts must stay well under this
// AND under what max_tokens can fit (roughly: each candidate's JSON output
// is ~200 tokens, max_tokens=16k holds ~80 candidates comfortably).
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
        // Claude Haiku 4.5 max output is 64k; we set 16k as a generous
        // ceiling that easily holds 80 candidates' worth of JSON
        // (~200 tokens per row of {id, score, rationale, bullets[]}).
        // The previous 4096 cap was truncating mid-output and burning
        // the ranking pass into neutral fallbacks.
        max_tokens: 16000,
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
  // Tolerate a stray ```json fence and any preamble the model prepends.
  // First try a clean JSON.parse; if that fails, look for the longest
  // {"ranked":[...]} substring we can find and try again. As a last
  // resort, extract whatever complete {id,score,rationale,bullets}
  // objects are visible in the text (handles output truncated mid-way
  // through the array — partial ranking is still better than neutral).
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let rankedRaw: unknown[] | null = null;

  try {
    const parsed = JSON.parse(cleaned);
    const cand = (parsed as { ranked?: unknown[] })?.ranked;
    if (Array.isArray(cand)) rankedRaw = cand;
  } catch (_e) {
    // Fall through to recovery.
  }

  if (!rankedRaw) {
    const recovered = recoverPartialRanked(cleaned);
    if (recovered.length > 0) {
      console.warn(
        `Model output unparseable, recovered ${recovered.length}/${candidates.length} candidates via per-object fallback`,
      );
      rankedRaw = recovered;
    }
  }

  if (!rankedRaw) {
    console.warn("Failed to parse model JSON, falling back to neutral scores");
    return candidates.map((c) => neutral(c));
  }

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

/**
 * Last-resort JSON recovery — scan for individual {…} objects that look
 * like ranked candidates and parse each in isolation. Survives output
 * that got truncated mid-array (missing closing `]}`) and recovers as
 * many candidates as Claude managed to emit before being cut off.
 */
function recoverPartialRanked(text: string): unknown[] {
  const out: unknown[] = [];
  // Match {...} blocks at brace depth 1 (i.e. inside the "ranked" array).
  // Greedy stack-based scan rather than regex so nested braces don't trip
  // us up (a rationale string could contain {).
  let depth = 0;
  let start = -1;
  let inString = false;
  let prev = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\"" && prev !== "\\") inString = false;
      prev = ch;
      continue;
    }
    if (ch === "\"") { inString = true; prev = ch; continue; }
    if (ch === "{") { if (depth === 1) start = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 1 && start !== -1) {
        const fragment = text.slice(start, i + 1);
        try {
          const obj = JSON.parse(fragment);
          if (obj && typeof obj === "object" && typeof (obj as { id?: unknown }).id === "string") {
            out.push(obj);
          }
        } catch (_e) {
          // Skip — partially malformed candidate, neutral fallback for this id.
        }
        start = -1;
      }
    }
    prev = ch;
  }
  return out;
}

function neutral(c: Candidate): RankedCandidate {
  return {
    id: c.id,
    score: 0.5,
    rationale: "",
    bullets: [c.name].filter(Boolean),
  };
}
