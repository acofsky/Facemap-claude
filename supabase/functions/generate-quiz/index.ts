import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ANTHROPIC_MODEL = "claude-haiku-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

type QuizType = "photo_name" | "fact_to_person" | "person_to_fact" | "how_met";

interface MemberInput {
  id: string;
  name: string;
  hasPhoto?: boolean;
  how_we_met?: string | null;
  where_when?: string | null;
  date_met?: string | null;
  important_info?: string | null;
  misc_notes?: string | null;
  known_people_notes?: string | null;
  physical_description?: string | null;
}

interface QuizQuestionOut {
  type: QuizType;
  person_id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation?: string;
}

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: { questions?: QuizQuestionOut[] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const reqBody = await req.json();
    // Pre-warm ping — return immediately so the isolate is hot for the real call.
    if (reqBody?.warm === true) {
      return new Response(JSON.stringify({ warmed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const group = reqBody?.group as { name?: string; kind?: string } | undefined;
    const members = (reqBody?.members as MemberInput[] | undefined) || [];
    const requestedCount = typeof reqBody?.count === "number" ? reqBody.count : undefined;

    if (!Array.isArray(members) || members.length < 3) {
      return new Response(JSON.stringify({ error: "need at least 3 members" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const validIds = new Set(members.map((m) => m.id));
    const byId = new Map(members.map((m) => [m.id, m]));
    const photoIds = new Set(members.filter((m) => m.hasPhoto).map((m) => m.id));

    // Target ~8 questions, but never more than the group can support.
    const targetCount = Math.min(
      requestedCount ?? 8,
      Math.max(4, members.length * 2),
      14,
    );

    const memberBlock = members.map((m) => {
      const lines = [
        `[ID: ${m.id}] ${m.name}${m.hasPhoto ? " (has photo)" : ""}`,
        m.how_we_met && `  How we met: ${m.how_we_met}`,
        m.where_when && `  Where/when met: ${m.where_when}`,
        m.important_info && `  Background: ${oneLine(m.important_info)}`,
        m.misc_notes && `  Notes: ${oneLine(m.misc_notes)}`,
        m.known_people_notes && `  Who they know: ${oneLine(m.known_people_notes)}`,
      ].filter(Boolean);
      return lines.join("\n");
    }).join("\n\n");

    const kind = group?.kind === "event" ? "event" : "circle";
    const groupName = (group?.name || "this group").toString().slice(0, 80);

    const systemPrompt = `You build a personalized flash-quiz that helps the user MEMORIZE the people in their ${kind} "${groupName}". The user is trying to learn to recognize and remember everyone in this group.

You get the full member list below, each with an ID and whatever the user has recorded about them. Generate ${targetCount} multiple-choice questions.

ABSOLUTE RULES:
- Use ONLY facts that appear in a member's data below. NEVER invent, guess, or extrapolate a fact about anyone.
- Every question has exactly ONE correct answer and 3 distractor options (4 total), all distinct.
- person_id MUST be one of the member IDs below.
- "answer" MUST be exactly equal to one of the strings in "options".
- Spread questions across as many DIFFERENT members as possible. Don't make the same person the answer more than twice.

QUESTION TYPES (mix them up):
- "photo_name": ONLY for members marked "(has photo)". prompt is "Who's this?". options are 4 member NAMES; answer is this member's name. The client shows their photo.
- "fact_to_person": pick a DISTINCTIVE fact true for exactly ONE member (e.g. "Who went to Columbia?", "Who works at Stripe?", "Who has a golden retriever?"). options are 4 member NAMES; answer is the member the fact belongs to. Do NOT use a fact that could be true of several members.
- "person_to_fact": pick a member and ask about a specific detail (e.g. "Where did you meet Sarah?", "What does Mike do?"). options are 4 short facts; answer is THEIR real fact; the 3 distractors should be REAL facts taken from OTHER members (same category) so they're plausible.
- "how_met": ask how the user knows a member (e.g. "How do you know Alex?"). options are 4 short how-we-met phrases; answer is theirs; distractors are other members' real how-we-met phrases.

STYLE:
- Keep prompts short and natural. Keep each option short (a few words).
- explanation: one short line stating the truth ("You met Sarah at the Stanford mixer").
- If the data is too thin to make a good question of some type, just make fewer — quality over quantity. Prefer photo_name and fact_to_person when in doubt.

MEMBERS:
${memberBlock}`;

    const aiResponse = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: `Generate the ${targetCount}-question quiz.` }],
        tools: [
          {
            name: "return_quiz",
            description: "Return the generated quiz questions.",
            input_schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["photo_name", "fact_to_person", "person_to_fact", "how_met"],
                      },
                      person_id: { type: "string", description: "Member ID this question is about / whose photo to show." },
                      prompt: { type: "string" },
                      options: {
                        type: "array",
                        items: { type: "string" },
                        description: "Exactly 4 distinct options.",
                      },
                      answer: { type: "string", description: "Must equal one of the options." },
                      explanation: { type: "string" },
                    },
                    required: ["type", "person_id", "prompt", "options", "answer"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_quiz" },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("Anthropic error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolUse = ((aiData.content || []) as AnthropicContentBlock[]).find(
      (b) => b.type === "tool_use" && b.name === "return_quiz",
    );
    const raw = toolUse?.input?.questions ?? [];

    // Validate / sanitize every question before trusting it client-side.
    const clean: QuizQuestionOut[] = [];
    for (const q of raw) {
      if (!q || !validIds.has(q.person_id)) continue;
      if (!["photo_name", "fact_to_person", "person_to_fact", "how_met"].includes(q.type)) continue;
      if (q.type === "photo_name" && !photoIds.has(q.person_id)) continue;

      // Dedupe options, trim, drop blanks, ensure the answer is present.
      const opts = Array.from(new Set((q.options || []).map((o) => (o || "").trim()).filter(Boolean)));
      const answer = (q.answer || "").trim();
      if (!answer || !opts.includes(answer)) continue;
      if (opts.length < 3) continue;
      // Cap at 4 options while always keeping the answer.
      let options = opts.slice(0, 4);
      if (!options.includes(answer)) options = [answer, ...opts.filter((o) => o !== answer)].slice(0, 4);

      // For photo_name, force the answer to the member's true name.
      if (q.type === "photo_name") {
        const trueName = byId.get(q.person_id)?.name?.trim();
        if (!trueName || !options.includes(trueName)) continue;
      }

      clean.push({
        type: q.type,
        person_id: q.person_id,
        prompt: (q.prompt || "").trim() || "Who's this?",
        options,
        answer,
        explanation: q.explanation?.trim() || undefined,
      });
    }

    return new Response(JSON.stringify({ questions: clean.slice(0, targetCount) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function oneLine(s: string): string {
  const flat = s.replace(/\s*[•\-*]\s*/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > 280 ? flat.slice(0, 280) + "…" : flat;
}
