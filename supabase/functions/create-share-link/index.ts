import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!projectId) throw new Error("projectId is required");

    // Verify auth from request header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user owns this project
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, user_id, share_token")
      .eq("id", projectId)
      .single();

    if (projErr || !project) throw new Error("Project not found");
    if (project.user_id !== user.id) throw new Error("Not authorized");

    // If share_token already exists, return it
    if (project.share_token) {
      return new Response(JSON.stringify({ shareToken: project.share_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a short share token (8 chars, URL-safe)
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    const { error: updateErr } = await supabase
      .from("projects")
      .update({ share_token: token })
      .eq("id", projectId);

    if (updateErr) throw new Error("Failed to save share token");

    return new Response(JSON.stringify({ shareToken: token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-share-link error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
