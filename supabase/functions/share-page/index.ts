import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const APP_URL = Deno.env.get("SITE_URL") || "https://pixel-perfect.lovable.app";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up project by share token
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, pet_name")
      .eq("share_token", token)
      .single();

    if (projErr || !project) {
      // Redirect to SPA anyway — it will show its own "not found" state
      return new Response(buildHtml({
        title: "A PhotoRabbit Picture Book",
        description: "A one-of-a-kind illustrated storybook",
        imageUrl: "",
        appUrl: APP_URL,
        token,
      }), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Find the cover page
    const { data: coverPage } = await supabase
      .from("project_pages")
      .select("id")
      .eq("project_id", project.id)
      .eq("page_type", "cover")
      .single();

    let coverImageUrl = "";

    if (coverPage) {
      // Get the selected illustration for the cover
      const { data: illustration } = await supabase
        .from("project_illustrations")
        .select("storage_path")
        .eq("page_id", coverPage.id)
        .eq("is_selected", true)
        .single();

      if (illustration?.storage_path) {
        const { data: publicUrlData } = supabase.storage
          .from("pet-photos")
          .getPublicUrl(illustration.storage_path);
        coverImageUrl = publicUrlData.publicUrl;
      }
    }

    const petName = project.pet_name || "Your";
    const title = `${petName}'s Book — A PhotoRabbit Picture Book`;
    const description = "A one-of-a-kind illustrated storybook";

    return new Response(buildHtml({
      title,
      description,
      imageUrl: coverImageUrl,
      appUrl: APP_URL,
      token,
    }), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("share-page error:", e);
    return new Response("Internal error", { status: 500 });
  }
});

function buildHtml(opts: {
  title: string;
  description: string;
  imageUrl: string;
  appUrl: string;
  token: string;
}): string {
  const bookUrl = `${opts.appUrl}/book/${opts.token}`;
  const imageTag = opts.imageUrl
    ? `<meta property="og:image" content="${escapeHtml(opts.imageUrl)}" />\n    <meta name="twitter:image" content="${escapeHtml(opts.imageUrl)}" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(opts.title)}</title>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(opts.title)}" />
    <meta property="og:description" content="${escapeHtml(opts.description)}" />
    <meta property="og:url" content="${escapeHtml(bookUrl)}" />
    ${imageTag}
    <meta name="twitter:card" content="${opts.imageUrl ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${escapeHtml(opts.title)}" />
    <meta name="twitter:description" content="${escapeHtml(opts.description)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(bookUrl)}" />
  </head>
  <body>
    <p>Redirecting to your book...</p>
    <script>window.location.replace(${JSON.stringify(bookUrl)});</script>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#x27;");
}
