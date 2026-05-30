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

const SYSTEM_PROMPT = `You score imported contact stubs against a user's import goal AND draft factual memory bullets the user will save on each person's profile.

The two outputs you produce per candidate serve DIFFERENT purposes — keep them strictly separate:

* \`bullets\`: factual fragments the user will see saved on the person's profile. These are memory aids — like resume bullets or self-written notes. NEVER include your scoring reasoning, analysis, comparison to the user's filter, or phrases like "matches your goal," "signal of X," "indicates Y," "adjacent to Z," "suggests Q." If the candidate has nothing factual worth remembering (just name + phone with no role / firm / context), return an EMPTY bullets array. Do NOT pad. 0 to 3 bullets per candidate.

* \`rationale\`: 6 to 15 words explaining your score. THIS is where reasoning goes — what signal you matched and how strongly. The user sees it, but it's framed as the score's justification, not as profile content.

CRITICAL — keep candidates ISOLATED. Each candidate's bullets and rationale reference ONLY that candidate's own data. If two candidates work at the same firm or know each other, NEVER copy one candidate's name / email / specific details into another candidate's output.

SCORE ABSOLUTELY, not relative to others in this chunk. The same data produces the same score regardless of what other candidates appear alongside it.

CRITICAL — A SINGLE strong signal is enough for the high band. If the candidate's company field directly contains a named firm matching the user's filter (e.g. "JPMorgan" / "Goldman Sachs" / "Cleveland Clinic" / "Cravath" for the respective domains), score 0.85+ — period. Do NOT downgrade because the title is missing, or the email is missing, or you have only name + company. Missing data is not a negative signal; only conflicting or unrelated data is. "JPMorgan" in the company field plus nothing else still earns 0.85+ on a finance filter.

CRITICAL — Don't invent firm names from email domains. If you recognize the domain (e.g. @jpmorgan.com → JP Morgan), use it. If you don't recognize the domain, say so — phrase the rationale as "email domain {domain} — firm unknown" and score by whatever other signal exists, not by your guess at what the domain might stand for. Hallucinating "PIC Partners" out of "pwpartners.com" is exactly the failure mode this rule prevents.

CRITICAL — score MUST align with rationale signal strength. Your rationale is your reasoning trail; the score must match it.
- If your rationale describes a clear, direct match → score 0.85 to 1.0.
- If your rationale uses words like "adjacent", "partial", "ambiguous", or "weak signal" → score 0.40 to 0.65.
- If your rationale says "no signal evident", "no role indicated", "not relevant", "no relevant data", or similar → score MUST be 0.0 to 0.20.
- NEVER score a candidate in the high band (0.85+) if your own rationale says they don't match. NEVER score in the middle band (0.40+) if your rationale describes them as unrelated.

CRITICAL — presence of data is not a positive signal. A populated company field, a non-empty email, or any other field having content does NOT, by itself, justify a score above 0.20. The content must actually MATCH the user's filter. "Has a company" is not a signal. "Works at Goldman Sachs" for a finance filter IS a signal.

CRITICAL — rationale cannot be empty or trivial. Every candidate gets a real 6-15 word rationale explaining WHY the score is what it is. For clear matches, name the matching signal. For non-matches, explain what's missing or wrong (e.g., "No relevant signal — generic stored contact", "Company field unrelated to filter domain"). Empty rationale is forbidden — if you can't articulate why a score is justified, the candidate doesn't belong in the high or middle band.

When the user's filter mentions a specific career, industry, organization, or domain, recognize the relevant signals using your training — company names that fit, role titles that fit, email domains that fit, context that fits. Apply the same recognition principle to ANY domain the user names (medicine, law, art, academia, sports, real estate, gaming, you name it) — your training knows the equivalent firms / titles / signals for each. If the user's filter is open-ended ("interesting people," "anyone I should remember"), score by stub completeness instead.

Score bands — anchor your numbers here:
- 0.85 to 1.0: Clear, unambiguous match. EITHER multiple matching signals OR one strong signal — including the candidate's company field directly naming a firm in the user's filter domain. Do not require multiple signals.
- 0.55 to 0.80: Plausible match. Adjacent domain, single weaker signal, partial signal at a relevant org.
- 0.25 to 0.50: Ambiguous or sparse data. Generic role, no domain signal, name + phone only.
- 0.0 to 0.20: Clear non-match. Context explicitly points away from filter, OR data exists but doesn't match the filter (e.g. company field has an unrelated company), OR rationale identifies no relevant signal.

Bullets — GOOD examples (factual restatements of the candidate's own data):
- "Analyst at JP Morgan"
- "VP of Sales at Stripe"
- "Iron View Capital partner"
- "Dance Theatre of Harlem"
- "LinkedIn connection March 2024"

Bullets — BAD examples (reasoning disguised as facts — NEVER do these):
- "Finance career signal via work contact" ← reasoning belongs in rationale
- "Work email at pwpartners.com suggests partnership firm" ← speculation about meaning
- "Ally Financial, adjacent finance but not A&M/FTI class" ← comparing to filter
- "Just email provided" ← absence is not a memory aid
- "Strong match for your goal" ← never reference the filter in bullets
- "Likely works in PE based on email" ← speculation, not fact
- Mentioning any OTHER candidate's name or details

Rationale — GOOD examples (reasoning lives here):
- "Senior PM at Stripe, clear tech match"
- "Common name with phone but no role data"
- "Ally Financial, adjacent finance but not restructuring focus"
- "No relevant signal — generic stored contact"
- "Dance Theatre of Harlem in company field, direct match"

Return STRICT JSON. No prose, no markdown fences. Match the requested shape exactly.`;

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

    // Diagnostic — every successful request logs a one-liner so the
    // Supabase function logs show actual traffic. Without this the only
    // visible events are boot/shutdown and we can't tell whether the
    // function ran at all when the client reports a failure.
    console.log(`rank request: ${candidates.length} candidates, filter="${filterText.slice(0, 60)}"`);

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
    const neutralCount = ranked.filter((r) => r.score === 0.5 && r.rationale === "").length;
    console.log(`rank complete: ${ranked.length} ranked, ${neutralCount} fell back to neutral`);

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

  // Each candidate gets its own visually-separated block so the model
  // can't accidentally bleed data across rows. Critical for preventing
  // the "candidate A's bullet quotes candidate B's name" failure mode.
  const lines = candidates.map((c, i) => {
    const parts: string[] = [
      `========== Candidate #${i + 1} ==========`,
      `id: ${c.id}`,
      `source: ${c.source}`,
    ];
    if (c.name) parts.push(`name: ${c.name}`);
    if (c.company) parts.push(`company: ${c.company}`);
    if (c.title) parts.push(`title: ${c.title}`);
    if (c.email) parts.push(`email: ${c.email}`);
    if (c.phone) parts.push(`phone: ${c.phone}`);
    if (c.context) parts.push(`context: ${c.context}`);
    return parts.join("\n");
  });

  return `${goal}
Score each candidate below independently. Each candidate's output references only that candidate's own data — never quote another candidate's name, email, or details.

${lines.join("\n\n")}

Return STRICT JSON in this exact shape (no prose, no markdown fences):
{"ranked":[{"id":"<candidate id>","score":0.0,"rationale":"<6-15 words>","bullets":["..."]}, ...]}
Every candidate id above must appear exactly once. Bullets is an array of 0 to 3 factual fragments (empty array allowed when nothing factual is worth saving).`;
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

function neutral(_c: Candidate): RankedCandidate {
  return {
    id: _c.id,
    // 0.0 (not 0.5) so unscored candidates sort to the bottom rather
    // than mid-pack — the previous 0.5 was treating "we have no info"
    // as "definitely middle", which let candidates with NO real AI
    // signal sneak into the top N alongside genuine matches.
    score: 0.0,
    rationale: "Unscored — AI didn't classify this candidate",
    // Empty bullets so the About field on a promoted Person stays
    // empty (well, with just the "Imported from X" provenance line).
    // Was previously [c.name], which made the literal name show up
    // as a bullet on every silently-failed candidate.
    bullets: [],
  };
}
