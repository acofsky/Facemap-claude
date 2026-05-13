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

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

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

    type Circle = { id: string; name: string; emoji: string };
    const circleMap = new Map((circles || []).map((c: Circle) => [c.id, c]));

    const personProfiles = await Promise.all((persons || []).map(async (p: Record<string, unknown>) => {
      const pCircles = (personCircles || [])
        .filter((pc: { person_id: string }) => pc.person_id === p.id)
        .map((pc: { circle_id: string }) => circleMap.get(pc.circle_id))
        .filter((c): c is Circle => Boolean(c))
        .map((c) => `${c.emoji} ${c.name}`);

      const fields = [
        `Name: ${p.name}`,
        p.how_we_met && `How we met: ${p.how_we_met}`,
        p.where_when && `Where: ${p.where_when}`,
        p.physical_description && `Physical: ${p.physical_description}`,
        p.important_info && `Important: ${p.important_info}`,
        p.misc_notes && `Notes: ${p.misc_notes}`,
        pCircles.length && `Circles: ${pCircles.join(", ")}`,
      ].filter(Boolean);

      // Photos may be stored as raw paths OR as full Supabase storage URLs.
      // The bucket is private, so always re-sign so Anthropic can fetch them.
      const signedPhotos: string[] = [];
      const photos = Array.isArray(p.photos) ? (p.photos as unknown[]) : [];
      for (const photo of photos.slice(0, 2)) {
        if (typeof photo !== "string") continue;

        let path = photo;
        const m = photo.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/person-photos\/([^?]+)/);
        if (m) {
          path = decodeURIComponent(m[1]);
        } else if (photo.startsWith("http://") || photo.startsWith("https://")) {
          signedPhotos.push(photo);
          continue;
        }

        const { data: signed, error: signErr } = await admin.storage
          .from("person-photos")
          .createSignedUrl(path, 60 * 10);
        if (signErr) console.error("sign error for", path, signErr);
        if (signed?.signedUrl) signedPhotos.push(signed.signedUrl);
      }

      return { id: p.id as string, name: p.name as string, profile: fields.join("\n"), photos: signedPhotos };
    }));

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

    type AnthropicBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "url"; url: string } };
    const userContent: AnthropicBlock[] = [{ type: "text", text: query }];
    for (const p of personProfiles) {
      if (p.photos && p.photos.length > 0) {
        userContent.push({ type: "text", text: `[Photos for ID: ${p.id}, Name: ${p.name}]` });
        for (const photoUrl of p.photos) {
          userContent.push({ type: "image", source: { type: "url", url: photoUrl } });
        }
      }
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
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
      throw new Error("Anthropic request failed");
    }

    const aiData = await aiResponse.json();
    const toolUse = (aiData.content ?? []).find(
      (b: { type: string }) => b.type === "tool_use"
    ) as { input?: { matches?: { id: string; reason: string }[] } } | undefined;
    let matches: { id: string; reason: string }[] = toolUse?.input?.matches ?? [];

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
