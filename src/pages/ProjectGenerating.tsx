import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import { toast } from "sonner";

const ProjectGenerating = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(id);
  const updateStatus = useUpdateProjectStatus();
  const [pagesGenerated, setPagesGenerated] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const totalPages = 24;

  // Listen for realtime page inserts
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

  // Trigger generation
  useEffect(() => {
    if (!id || isGenerating || isDone) return;
    setIsGenerating(true);

    supabase.functions.invoke("generate-story", { body: { projectId: id } })
      .then(({ error }) => {
        if (error) { toast.error("Story generation failed"); console.error(error); }
        else { setIsDone(true); updateStatus.mutate({ id: id!, status: "review" }); }
      })
      .finally(() => setIsGenerating(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = (pagesGenerated / totalPages) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <motion.div
            animate={{ rotate: isDone ? 0 : 360 }}
            transition={{ duration: 2, repeat: isDone ? 0 : Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8"
          >
            <Sparkles className="w-10 h-10 text-primary" />
          </motion.div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-3">
            {isDone ? "Your Story is Ready!" : "Creating Your Story"}
          </h1>
          <p className="font-body text-muted-foreground mb-10">
            {isDone
              ? `${project?.pet_name}'s story has been written with love`
              : `Weaving ${project?.pet_name || "your pet"}'s memories into a beautiful story...`}
          </p>

          <div className="space-y-3 mb-10">
            <Progress value={isDone ? 100 : progress} className="h-3" />
            <p className="font-body text-sm text-muted-foreground">
              {isDone ? "All 24 pages complete" : `${pagesGenerated} of ${totalPages} pages`}
            </p>
          </div>

          {isDone && (
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
