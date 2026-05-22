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

// Cap the number of photos per person we send to the AI so very large
// People libraries don't blow past Anthropic's request size or burn tokens.
// Two photos give enough visual context to match physical-description queries.
const PHOTOS_PER_PERSON = 2;

interface PersonProfile {
  id: string;
  name: string;
  profile: string;
  photos: string[];
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: { matches?: Array<{ id: string; reason: string }> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const reqBody = await req.json();
    if (reqBody?.warm === true) {
      return new Response(JSON.stringify({ warmed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { query } = reqBody;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate the caller
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

    // SCOPE: only this user's persons
    const { data: persons, error: pErr } = await admin
      .from("persons")
      .select("*")
      .eq("user_id", user.id);
    if (pErr) throw pErr;

    const personIds = (persons || []).map((p: { id: string }) => p.id);
    const { data: personCircles } = await admin
      .from("person_circles")
      .select("person_id, circle_id")
      .in("person_id", personIds.length ? personIds : ["00000000-0000-0000-0000-000000000000"]);

    const { data: circles } = await admin
      .from("circles")
      .select("id, name, emoji")
      .eq("user_id", user.id);

    const circleMap = new Map(
      (circles || []).map((c: { id: string; name: string; emoji: string | null }) => [c.id, c])
    );

    type PersonRow = {
      id: string;
      name: string;
      how_we_met: string | null;
      where_when: string | null;
      physical_description: string | null;
      important_info: string | null;
      misc_notes: string | null;
      photos: string[] | null;
    };

    // Build a text profile for each person and sign their photo paths
    const personProfiles: PersonProfile[] = await Promise.all(
      ((persons || []) as PersonRow[]).map(async (p) => {
        const pCircles = (personCircles || [])
          .filter((pc: { person_id: string; circle_id: string }) => pc.person_id === p.id)
          .map((pc: { circle_id: string }) => circleMap.get(pc.circle_id))
          .filter(Boolean)
          .map((c) => {
            const circle = c as { name: string; emoji: string | null };
            return `${circle.emoji ?? ""} ${circle.name}`.trim();
          });

        const fields = [
          `Name: ${p.name}`,
          p.how_we_met && `How we met: ${p.how_we_met}`,
          p.where_when && `Where: ${p.where_when}`,
          p.physical_description && `Physical: ${p.physical_description}`,
          p.important_info && `Important: ${p.important_info}`,
          p.misc_notes && `Notes: ${p.misc_notes}`,
          pCircles.length && `Circles: ${pCircles.join(", ")}`,
        ].filter(Boolean) as string[];

        // Sign photo paths so the AI can fetch them. Photos may be stored
        // as raw paths OR as full Supabase storage URLs; the bucket is
        // private so we always re-sign with a short TTL.
        const signedPhotos: string[] = [];
        for (const photo of (p.photos || []).slice(0, PHOTOS_PER_PERSON)) {
          if (typeof photo !== "string") continue;

          let path = photo;
          const m = photo.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/person-photos\/([^?]+)/);
          if (m) {
            path = decodeURIComponent(m[1]);
          } else if (photo.startsWith("http://") || photo.startsWith("https://")) {
            // Non-Supabase URL — pass through
            signedPhotos.push(photo);
            continue;
          }

          const { data: signed, error: signErr } = await admin.storage
            .from("person-photos")
            .createSignedUrl(path, 60 * 10);
          if (signErr) console.error("sign error for", path, signErr);
          if (signed?.signedUrl) signedPhotos.push(signed.signedUrl);
        }

        return { id: p.id, name: p.name, profile: fields.join("\n"), photos: signedPhotos };
      })
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const systemPrompt = `You are a person-matching assistant for a personal CRM called Membr.
The user will describe someone they're trying to find. You have a list of people profiles below, some with photos.
Analyze BOTH the text profiles AND any attached photos to find matches.
For photo-based queries (e.g. "blonde hair", "tall guy", "wears glasses"), carefully examine the photos.
Return the IDs of people that match the description, ranked by relevance (best match first).
Only return people that are plausible matches. If nobody matches, return an empty array.

People:
${personProfiles.map((p) => `[ID: ${p.id}]\n${p.profile}`).join("\n\n")}`;

    // Build the user message: the query text, then any photos grouped by
    // person so the model can correlate the right face with the right ID.
    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "url"; url: string } }
    > = [{ type: "text", text: query }];
    for (const p of personProfiles) {
      if (p.photos.length > 0) {
        userContent.push({ type: "text", text: `[Photos for ID: ${p.id}, Name: ${p.name}]` });
        for (const photoUrl of p.photos) {
          userContent.push({ type: "image", source: { type: "url", url: photoUrl } });
        }
      }
    }

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
        messages: [{ role: "user", content: userContent }],
        tools: [
          {
            name: "return_matches",
            description: "Return matching person IDs ranked by relevance",
            input_schema: {
              type: "object",
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Person UUID" },
                      reason: { type: "string", description: "Why this person matches" },
                    },
                    required: ["id", "reason"],
                  },
                },
              },
              required: ["matches"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_matches" },
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
      (b) => b.type === "tool_use" && b.name === "return_matches"
    );
    let matches: { id: string; reason: string }[] = [];
    if (toolUseBlock?.input?.matches) {
      matches = toolUseBlock.input.matches;
    }

    const validIds = new Set(personProfiles.map((p) => p.id));
    matches = matches.filter((m) => validIds.has(m.id));

    return new Response(JSON.stringify({ results: matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recall-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
