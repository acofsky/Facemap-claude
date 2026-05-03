import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
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

    const personIds = (persons || []).map((p: any) => p.id);
    const { data: personCircles } = await admin
      .from("person_circles")
      .select("person_id, circle_id")
      .in("person_id", personIds.length ? personIds : ["00000000-0000-0000-0000-000000000000"]);

    const { data: circles } = await admin
      .from("circles")
      .select("id, name, emoji")
      .eq("user_id", user.id);

    const circleMap = new Map((circles || []).map((c: any) => [c.id, c]));

    // Build a text profile for each person and sign their photo paths
    const personProfiles = await Promise.all((persons || []).map(async (p: any) => {
      const pCircles = (personCircles || [])
        .filter((pc: any) => pc.person_id === p.id)
        .map((pc: any) => circleMap.get(pc.circle_id))
        .filter(Boolean)
        .map((c: any) => `${c.emoji} ${c.name}`);

      const fields = [
        `Name: ${p.name}`,
        p.how_we_met && `How we met: ${p.how_we_met}`,
        p.where_when && `Where: ${p.where_when}`,
        p.physical_description && `Physical: ${p.physical_description}`,
        p.important_info && `Important: ${p.important_info}`,
        p.misc_notes && `Notes: ${p.misc_notes}`,
        pCircles.length && `Circles: ${pCircles.join(", ")}`,
      ].filter(Boolean);

      // Sign photo paths so the AI gateway can fetch them
      const signedPhotos: string[] = [];
      for (const photo of (p.photos || []).slice(0, 2)) {
        if (typeof photo !== "string") continue;
        if (photo.startsWith("http://") || photo.startsWith("https://")) {
          signedPhotos.push(photo);
          continue;
        }
        const { data: signed } = await admin.storage
          .from("person-photos")
          .createSignedUrl(photo, 60 * 10);
        if (signed?.signedUrl) signedPhotos.push(signed.signedUrl);
      }

      return { id: p.id, name: p.name, profile: fields.join("\n"), photos: signedPhotos };
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a person-matching assistant for a personal CRM called Facemap.
The user will describe someone they're trying to find. You have a list of people profiles below, some with photos.
Analyze BOTH the text profiles AND any attached photos to find matches.
For photo-based queries (e.g. "blonde hair", "tall guy", "wears glasses"), carefully examine the photos.
Return the IDs of people that match the description, ranked by relevance (best match first).
Only return people that are plausible matches. If nobody matches, return an empty array.

People:
${personProfiles.map((p: any) => `[ID: ${p.id}]\n${p.profile}`).join("\n\n")}`;

    const userContent: any[] = [{ type: "text", text: query }];
    for (const p of personProfiles) {
      if (p.photos && p.photos.length > 0) {
        userContent.push({ type: "text", text: `[Photos for ID: ${p.id}, Name: ${p.name}]` });
        for (const photoUrl of p.photos) {
          userContent.push({ type: "image_url", image_url: { url: photoUrl } });
        }
      }
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_matches",
              description: "Return matching person IDs ranked by relevance",
              parameters: {
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
                      additionalProperties: false,
                    },
                  },
                },
                required: ["matches"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_matches" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let matches: { id: string; reason: string }[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      matches = parsed.matches || [];
    }

    const validIds = new Set(personProfiles.map((p: any) => p.id));
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
