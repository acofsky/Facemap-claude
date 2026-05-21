import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ANTHROPIC_MODEL = "claude-haiku-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: ParseToolInput;
}

interface ParseToolInput {
  mode?: "new_person" | "encounter";
  person_match?: {
    id?: string;
    confidence?: "high" | "medium" | "low";
    alternative_ids?: string[];
  };
  person_fields?: {
    name?: string;
    how_we_met?: string;
    where_when?: string;
    date_met?: string;
    physical_description?: string;
    important_info?: string;
    misc_notes?: string;
  };
  encounter_fields?: {
    meeting_date?: string;
    place?: string;
    notes?: string;
  };
  profile_updates?: Array<{
    field: "how_we_met" | "where_when" | "important_info" | "misc_notes";
    current_value: string;
    proposed_value: string;
    reason: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return new Response(JSON.stringify({ error: "transcript is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: persons, error: pErr } = await admin
      .from("persons")
      .select("id, name, nickname, how_we_met, where_when, important_info, misc_notes")
      .eq("user_id", user.id);
    if (pErr) throw pErr;

    type PersonRow = {
      id: string;
      name: string;
      nickname: string | null;
      how_we_met: string | null;
      where_when: string | null;
      important_info: string | null;
      misc_notes: string | null;
    };

    const personRows = (persons || []) as PersonRow[];

    const peopleContext = personRows.length === 0
      ? "(The user has no people in Membr yet.)"
      : personRows.map((p) => {
          const lines = [
            `[ID: ${p.id}]`,
            `Name: ${p.name}${p.nickname ? ` ("${p.nickname}")` : ""}`,
            p.how_we_met && `How we met: ${p.how_we_met}`,
            p.where_when && `Where: ${p.where_when}`,
            p.important_info && `Important info: ${p.important_info}`,
            p.misc_notes && `Notes: ${p.misc_notes}`,
          ].filter(Boolean) as string[];
          return lines.join("\n");
        }).join("\n\n");

    const today = new Date().toISOString().slice(0, 10);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const systemPrompt = `You parse short voice notes for a personal CRM called Membr.

The user just spoke into their phone. The transcript is a casual, spoken account of either (a) a new person they want to remember, or (b) an encounter with someone already in Membr (possibly with new information about that person worth updating their profile).

Your job:
1. Decide whether this transcript is a NEW PERSON (no existing person referenced, or the person sounds new) or an ENCOUNTER with an existing person from the list below.
2. Extract structured fields from the transcript.
3. For encounters, if the transcript mentions something that meaningfully UPDATES the existing profile (new job, moved cities, changed status, contradicts an existing fact), surface it as a profile update suggestion. Only surface updates that are clearly stated in the transcript — never invent or extrapolate.

Rules for matching to an existing person:
- Match on name (case-insensitive, partial OK), nickname, or distinctive context ("Sarah from the Stanford mixer" matches a Sarah whose where_when mentions Stanford).
- If multiple people plausibly match, pick the best one and put others in alternative_ids.
- Confidence: 'high' = clear unambiguous match; 'medium' = best guess; 'low' = uncertain, user should confirm.
- If no plausible match, treat as new_person.

Rules for fields:
- Use today's date (${today}) as the default for meeting_date and date_met when the user says "today", "just now", etc. Use ISO format YYYY-MM-DD.
- where_when is short location/context ("Tribeca Rooftop", "Stanford alumni mixer"). place is the meeting location specifically.
- how_we_met is a one-line phrase about the introduction ("sat next to each other at dinner").
- important_info is durable profile info (their job, where they live, family, key background).
- misc_notes is everything else worth remembering — interests, hobbies, mentioned topics.
- notes (on encounter_fields) is what was discussed at this specific encounter.
- Only fill fields the transcript actually contains. Omit empty fields entirely.

Rules for profile_updates (encounter mode only):
- Only include if the transcript directly states new info that contradicts or extends an existing field.
- current_value is what's currently in the existing profile (verbatim from the list below).
- proposed_value is what the field should become after merging in the new info.
- reason is a short human-readable explanation ("she mentioned switching jobs to Anthropic").
- Allowed fields: how_we_met, where_when, important_info, misc_notes.

EXISTING PEOPLE:
${peopleContext}

TRANSCRIPT:
${transcript}`;

    const aiResponse = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: "Parse the transcript above." }],
        tools: [
          {
            name: "return_parsed_voice_note",
            description: "Return the structured parse of the user's voice note.",
            input_schema: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: ["new_person", "encounter"],
                  description: "Whether this transcript creates a new person or logs an encounter with an existing person.",
                },
                person_match: {
                  type: "object",
                  description: "Only when mode = encounter. The matched person's ID and confidence.",
                  properties: {
                    id: { type: "string", description: "UUID of the matched person." },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                    alternative_ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "Other plausible matches if the primary match is uncertain.",
                    },
                  },
                  required: ["id", "confidence"],
                },
                person_fields: {
                  type: "object",
                  description: "Profile fields extracted for a NEW person. For encounter mode, omit unless the transcript explicitly introduces new profile info (use profile_updates instead).",
                  properties: {
                    name: { type: "string" },
                    how_we_met: { type: "string" },
                    where_when: { type: "string" },
                    date_met: { type: "string", description: "ISO YYYY-MM-DD." },
                    physical_description: { type: "string" },
                    important_info: { type: "string" },
                    misc_notes: { type: "string" },
                  },
                },
                encounter_fields: {
                  type: "object",
                  description: "Encounter fields. Always include for encounter mode. Also include for new_person mode when the transcript frames the moment as a meeting.",
                  properties: {
                    meeting_date: { type: "string", description: "ISO YYYY-MM-DD." },
                    place: { type: "string" },
                    notes: { type: "string" },
                  },
                },
                profile_updates: {
                  type: "array",
                  description: "Only for encounter mode. Profile fields that should change based on new info in the transcript.",
                  items: {
                    type: "object",
                    properties: {
                      field: {
                        type: "string",
                        enum: ["how_we_met", "where_when", "important_info", "misc_notes"],
                      },
                      current_value: { type: "string" },
                      proposed_value: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["field", "current_value", "proposed_value", "reason"],
                  },
                },
              },
              required: ["mode"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_parsed_voice_note" },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("Anthropic error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolUseBlock = ((aiData.content || []) as AnthropicContentBlock[]).find(
      (b) => b.type === "tool_use" && b.name === "return_parsed_voice_note"
    );

    const parsed: ParseToolInput = toolUseBlock?.input ?? { mode: "new_person" };

    // Validate matched person ID belongs to this user's set; demote to new_person if not.
    const validIds = new Set(personRows.map((p) => p.id));
    if (parsed.mode === "encounter") {
      const id = parsed.person_match?.id;
      if (!id || !validIds.has(id)) {
        parsed.mode = "new_person";
        delete parsed.person_match;
        delete parsed.profile_updates;
      } else {
        const filteredAlts = (parsed.person_match?.alternative_ids || []).filter((a) => validIds.has(a));
        parsed.person_match = {
          id,
          confidence: parsed.person_match!.confidence,
          alternative_ids: filteredAlts,
        };
      }
    }

    return new Response(JSON.stringify({ parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-voice-input error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
