import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, PawPrint, Dog, Cat, Bird, Fish, Trash2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ProjectStatusBadge from "@/components/project/ProjectStatusBadge";
import { useProjects, useDeleteProject, type Project } from "@/hooks/useProject";
import MinimalNav from "@/components/workspace/MinimalNav";

const petIcons: Record<string, React.ElementType> = { dog: Dog, cat: Cat, bird: Bird, fish: Fish };

const Dashboard = () => {
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const getProjectLink = (project: { id: string; status: string }) => {
    const routes: Record<string, string> = {
      upload: `/project/${project.id}/context`,
      interview: `/project/${project.id}/interview`,
      generating: `/project/${project.id}/generating`,
      review: `/project/${project.id}/review`,
    };
    return routes[project.status] || `/project/${project.id}/context`;
  };

  const getDisplayName = (project: Project) => {
    return project.pet_name === "New Project" ? "Untitled Project" : project.pet_name;
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteProject.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <MinimalNav />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">Your Projects</h1>
            <p className="font-body text-muted-foreground mt-2">Every photo has a story worth telling</p>
          </div>
          <Button asChild variant="hero" className="rounded-xl gap-2">
            <Link to="/project/new"><Plus className="w-4 h-4" /> New Project</Link>
          </Button>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-secondary/50 animate-pulse" />)}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, i) => {
              const Icon = petIcons[project.pet_type] || PawPrint;
              const displayName = getDisplayName(project);
              return (
                <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Link to={getProjectLink(project)}>
                    <Card className="rounded-2xl hover:shadow-lg transition-all duration-300 cursor-pointer group border-border relative" style={{ boxShadow: "var(--card-shadow)" }}>
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex items-center gap-2">
                            <ProjectStatusBadge status={project.status} />
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(project); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <h3 className={`font-display text-xl font-semibold group-hover:text-primary transition-colors ${displayName === "Untitled Project" ? "text-muted-foreground italic" : "text-foreground"}`}>
                            {displayName}
                          </h3>
                          <p className="font-body text-sm text-muted-foreground mt-1">
                            {project.pet_breed ? `${project.pet_breed} · ` : ""}{project.pet_type !== "unknown" ? project.pet_type : ""}
                          </p>
                        </div>
                        <p className="font-body text-xs text-muted-foreground">
                          Created {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <ImagePlus className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">Ready to create something?</h2>
            <p className="font-body text-muted-foreground max-w-md mx-auto mb-8">
              Upload photos of anything you care about. We'll help you make something from them.
            </p>
            <Button asChild variant="hero" size="lg" className="rounded-xl gap-2">
              <Link to="/project/new"><Plus className="w-5 h-5" /> Start Your First Project</Link>
            </Button>
          </motion.div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete {deleteTarget ? getDisplayName(deleteTarget) : ""}?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              This will permanently delete the project, all photos, interview data, and generated pages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// chunk-bust
export default Dashboard;
