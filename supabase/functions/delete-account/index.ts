import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Required for App Store Guideline 5.1.1(v): apps that support account
// creation must offer in-app account deletion. This function deletes the
// caller's auth user *and* manually wipes their owned rows in every
// table — the historical migrations did not declare ON DELETE CASCADE
// from public.* tables to auth.users, so the cascade has to happen here.
// Order matters: child rows / join tables first, then top-level rows,
// then storage, then the auth user.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify the caller from the JWT they sent.
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
    const userId = user.id;

    // 1. Delete storage objects under the user's folder. The bucket is
    //    private and we use a folder-per-user convention (see uploadPhoto
    //    in src/lib/store.ts). Best-effort — if the user never uploaded
    //    a photo there's nothing to remove.
    try {
      const { data: files } = await admin.storage
        .from("person-photos")
        .list(userId);
      if (files && files.length > 0) {
        const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
        await admin.storage.from("person-photos").remove(paths);
      }
    } catch (e) {
      console.error("storage cleanup failed (continuing):", e);
    }

    // 2. Wipe rows. Order matters because of FK relationships:
    //    person_circles / person_events / meetings / connections reference
    //    persons; everything also references the auth user. Use eq("user_id", …)
    //    on every table so we don't depend on FK cascade.
    const tables = [
      "person_circles",
      "person_events",
      "meetings",
      "connections",
      "persons",
      "circles",
      "events",
    ];
    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) {
        // Don't bail — log and keep going so we still delete the auth user.
        console.error(`delete from ${table} failed:`, error);
      }
    }

    // 3. Finally, the auth user itself.
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("auth.admin.deleteUser failed:", authError);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ deleted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-account error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
