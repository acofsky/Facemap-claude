import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { personId } = await req.json();
    if (!personId) {
      return new Response(JSON.stringify({ error: "personId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: person, error: pErr } = await supabase
      .from("persons").select("*").eq("id", personId).eq("user_id", user.id).single();
    if (pErr || !person) {
      return new Response(JSON.stringify({ error: "Person not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: meetings = [] } = await supabase
      .from("meetings").select("meeting_date, place, notes")
      .eq("person_id", personId).order("meeting_date", { ascending: false }).limit(10);

    const { data: pcs = [] } = await supabase
      .from("person_circles").select("circle_id").eq("person_id", personId);
    const circleIds = (pcs || []).map((r: any) => r.circle_id);
    let circleNames: string[] = [];
    if (circleIds.length) {
      const { data: cs = [] } = await supabase.from("circles").select("name, emoji").in("id", circleIds);
      circleNames = (cs || []).map((c: any) => `${c.emoji} ${c.name}`);
    }

    const profile = [
      `Name: ${person.name}`,
      person.how_we_met && `How we met: ${person.how_we_met}`,
      person.where_when && `Where/when first met: ${person.where_when}`,
      person.date_met && `Date met: ${person.date_met}`,
      person.physical_description && `Physical: ${person.physical_description}`,
      person.important_info && `Important info: ${person.important_info}`,
      person.known_people_notes && `Who they know: ${person.known_people_notes}`,
      person.misc_notes && `Notes: ${person.misc_notes}`,
      circleNames.length && `Circles: ${circleNames.join(", ")}`,
    ].filter(Boolean).join("\n");

    const meetingsText = (meetings || []).length
      ? (meetings || []).map((m: any) => `- ${m.meeting_date}${m.place ? ` @ ${m.place}` : ""}${m.notes ? `: ${m.notes}` : ""}`).join("\n")
      : "(no past meetings logged)";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You write concise, useful pre-meeting briefs to help someone remember a person before seeing them again. Format the brief in plain text with these short sections (use the exact headings):

QUICK REFRESHER
(2 sentences: who they are, how you know them)

KEY FACTS
(3-5 bullets of the most important things to remember)

LAST TIME
(what you discussed/did at the most recent meeting, if any)

CONVERSATION STARTERS
(2-3 specific things to ask about based on past meetings or known info — be concrete, not generic)

Keep it tight. No filler. If info is missing, omit that section rather than guessing.`,
          },
          {
            role: "user",
            content: `PROFILE:\n${profile}\n\nPAST MEETINGS (most recent first):\n${meetingsText}`,
          },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const brief = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ brief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
