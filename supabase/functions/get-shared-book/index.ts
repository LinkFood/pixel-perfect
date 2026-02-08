import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { shareToken } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!shareToken) throw new Error("shareToken is required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find project by share token
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, pet_name, pet_type, pet_breed")
      .eq("share_token", shareToken)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Book not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pages
    const { data: pages } = await supabase
      .from("project_pages")
      .select("id, page_number, page_type, text_content")
      .eq("project_id", project.id)
      .order("page_number", { ascending: true });

    // Fetch selected illustrations
    const { data: illustrations } = await supabase
      .from("project_illustrations")
      .select("id, page_id, storage_path")
      .eq("project_id", project.id)
      .eq("is_selected", true);

    // Build illustration URL map
    const illustrationUrls: Record<string, string> = {};
    (illustrations || []).forEach(ill => {
      const { data } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
      illustrationUrls[ill.page_id] = data.publicUrl;
    });

    // Fetch photos for gallery
    const { data: photos } = await supabase
      .from("project_photos")
      .select("storage_path, caption, is_favorite, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true });

    const galleryPhotos = (photos || [])
      .sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return a.sort_order - b.sort_order;
      })
      .map(p => {
        const { data } = supabase.storage.from("pet-photos").getPublicUrl(p.storage_path);
        return { photoUrl: data.publicUrl, caption: p.caption };
      });

    return new Response(JSON.stringify({
      petName: project.pet_name,
      petType: project.pet_type,
      pages: (pages || []).map(p => ({
        id: p.id,
        pageNumber: p.page_number,
        pageType: p.page_type,
        textContent: p.text_content,
        illustrationUrl: illustrationUrls[p.id] || null,
      })),
      galleryPhotos,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-shared-book error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
