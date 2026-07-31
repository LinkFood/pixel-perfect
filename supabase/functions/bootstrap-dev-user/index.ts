import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dev-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Server-side gate. Without a configured secret this endpoint is inert. ---
    const expected = Deno.env.get("DEV_BOOTSTRAP_SECRET");
    if (!expected) {
      return new Response(JSON.stringify({ error: "Dev bootstrap disabled" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const provided = req.headers.get("x-dev-secret") || "";
    // Constant-time-ish comparison
    if (
      provided.length !== expected.length ||
      !provided.split("").every((c, i) => c === expected[i])
    ) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const email = "dev@photorabbit.test";
    // Rotate to a fresh random password on every bootstrap. It is never returned
    // to the client and never lives in the bundle — sign-in uses a one-time OTP.
    const password = crypto.randomUUID() + crypto.randomUUID();

    // Try to create the user; if already exists, that's fine
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error && !error.message.includes("already been registered")) {
      throw error;
    }

    // Mint a single-use magic-link token the client exchanges via verifyOtp.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) throw linkErr;

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Failed to mint dev session token");

    return new Response(JSON.stringify({ ok: true, token_hash: tokenHash }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
