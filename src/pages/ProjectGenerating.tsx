import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, BookOpen, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import { toast } from "sonner";

type Phase = "story" | "illustrations" | "done";

const ProjectGenerating = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(id);
  const updateStatus = useUpdateProjectStatus();

  const [phase, setPhase] = useState<Phase>("story");
  const [pagesGenerated, setPagesGenerated] = useState(0);
  const [illustrationsGenerated, setIllustrationsGenerated] = useState(0);
  const [totalPages, setTotalPages] = useState(24);
  const startedRef = useRef(false);

  // Listen for realtime page inserts (phase 1)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pages-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_pages", filter: `project_id=eq.${id}` },
        () => setPagesGenerated(prev => prev + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Listen for realtime illustration inserts (phase 2)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`illustrations-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_illustrations", filter: `project_id=eq.${id}` },
        () => setIllustrationsGenerated(prev => prev + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Main generation pipeline
  useEffect(() => {
    if (!id || startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      // Phase 1: Generate story
      setPhase("story");
      const { error: storyErr } = await supabase.functions.invoke("generate-story", { body: { projectId: id } });
      if (storyErr) {
        toast.error("Story generation failed");
        console.error(storyErr);
        return;
      }

      // Get all pages
      const { data: pages } = await supabase
        .from("project_pages")
        .select("id")
        .eq("project_id", id)
        .order("page_number");

      if (!pages || pages.length === 0) {
        toast.error("No pages were generated");
        return;
      }

      setTotalPages(pages.length);

      // Phase 2: Generate illustrations sequentially
      setPhase("illustrations");
      for (const page of pages) {
        try {
          const { error } = await supabase.functions.invoke("generate-illustration", {
            body: { pageId: page.id, projectId: id },
          });
          if (error) console.error(`Illustration error for page ${page.id}:`, error);
        } catch (e) {
          console.error(`Illustration failed for page ${page.id}:`, e);
        }
      }

      // Done
      setPhase("done");
      updateStatus.mutate({ id: id!, status: "review" });
    };

    run();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const getProgress = () => {
    if (phase === "story") return (pagesGenerated / totalPages) * 50;
    if (phase === "illustrations") return 50 + (illustrationsGenerated / totalPages) * 50;
    return 100;
  };

  const getStatusText = () => {
    if (phase === "story") return `Writing story... ${pagesGenerated} of ${totalPages} pages`;
    if (phase === "illustrations") return `Creating illustrations... ${illustrationsGenerated} of ${totalPages}`;
    return "Your book is complete!";
  };

  const PhaseIcon = phase === "illustrations" ? ImageIcon : Sparkles;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <motion.div
            animate={{ rotate: phase === "done" ? 0 : 360 }}
            transition={{ duration: 2, repeat: phase === "done" ? 0 : Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8"
          >
            <PhaseIcon className="w-10 h-10 text-primary" />
          </motion.div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-3">
            {phase === "done" ? "Your Book is Ready!" : "Creating Your Book"}
          </h1>
          <p className="font-body text-muted-foreground mb-10">
            {phase === "done"
              ? `${project?.pet_name}'s story has been written and illustrated`
              : `Crafting ${project?.pet_name || "your pet"}'s story...`}
          </p>

          <div className="space-y-3 mb-10">
            <Progress value={getProgress()} className="h-3" />
            <p className="font-body text-sm text-muted-foreground">{getStatusText()}</p>
          </div>

          {phase === "done" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button variant="hero" size="lg" className="rounded-xl gap-2" onClick={() => navigate(`/project/${id}/review`)}>
                <BookOpen className="w-5 h-5" /> Review Your Book
              </Button>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectGenerating;
