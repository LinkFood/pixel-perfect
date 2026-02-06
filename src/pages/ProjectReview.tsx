import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import BookPageViewer from "@/components/project/BookPageViewer";
import PageEditor from "@/components/project/PageEditor";
import { useProject } from "@/hooks/useProject";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navbar from "@/components/landing/Navbar";

type Page = {
  id: string;
  page_number: number;
  page_type: string;
  text_content: string | null;
  illustration_prompt: string | null;
  is_approved: boolean;
};

const ProjectReview = () => {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);

  const { data: pages = [] } = useQuery({
    queryKey: ["pages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pages")
        .select("*")
        .eq("project_id", id!)
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data as Page[];
    },
    enabled: !!id,
  });

  const page = pages[currentPage];
  const approvedCount = pages.filter(p => p.is_approved).length;
  const approvalProgress = pages.length > 0 ? (approvedCount / pages.length) * 100 : 0;

  const updatePage = async (pageId: string, updates: Partial<Page>) => {
    const { error } = await supabase.from("project_pages").update(updates).eq("id", pageId);
    if (error) { toast.error("Failed to save"); return; }
    queryClient.invalidateQueries({ queryKey: ["pages", id] });
  };

  const approveAll = async () => {
    const { error } = await supabase
      .from("project_pages")
      .update({ is_approved: true })
      .eq("project_id", id!);
    if (error) { toast.error("Failed to approve all"); return; }
    queryClient.invalidateQueries({ queryKey: ["pages", id] });
    toast.success("All pages approved! 🎉");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {project?.pet_name}'s Book
              </h1>
              <p className="font-body text-muted-foreground mt-1">Review and edit each page</p>
            </div>
            <Button variant="hero" className="rounded-xl gap-2" onClick={approveAll} disabled={approvedCount === pages.length}>
              <CheckCircle className="w-4 h-4" /> Approve All
            </Button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            <Progress value={approvalProgress} className="h-2 flex-1" />
            <span className="text-sm font-body text-muted-foreground whitespace-nowrap">
              {approvedCount} of {pages.length} approved
            </span>
          </div>

          {page ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Book preview */}
              <BookPageViewer
                pageNumber={page.page_number}
                pageType={page.page_type}
                textContent={page.text_content}
                illustrationPrompt={page.illustration_prompt}
                isApproved={page.is_approved}
              />

              {/* Editor */}
              <div className="space-y-6">
                <PageEditor
                  pageId={page.id}
                  textContent={page.text_content}
                  illustrationPrompt={page.illustration_prompt}
                  isApproved={page.is_approved}
                  onUpdateText={(text) => updatePage(page.id, { text_content: text })}
                  onToggleApprove={(approved) => updatePage(page.id, { is_approved: approved })}
                />

                {/* Navigation */}
                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="outline"
                    className="rounded-xl gap-2"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <span className="font-body text-sm text-muted-foreground">
                    {currentPage + 1} / {pages.length}
                  </span>
                  <Button
                    variant="outline"
                    className="rounded-xl gap-2"
                    disabled={currentPage >= pages.length - 1}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="font-body text-muted-foreground">No pages generated yet. Go back to generate your story first.</p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectReview;
