import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, PawPrint, Dog, Cat, Bird, Fish } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ProjectStatusBadge from "@/components/project/ProjectStatusBadge";
import { useProjects } from "@/hooks/useProject";
import Navbar from "@/components/landing/Navbar";

const petIcons: Record<string, React.ElementType> = { dog: Dog, cat: Cat, bird: Bird, fish: Fish };

const Dashboard = () => {
  const { data: projects, isLoading } = useProjects();

  const getProjectLink = (project: { id: string; status: string }) => {
    const routes: Record<string, string> = {
      upload: `/project/${project.id}/upload`,
      interview: `/project/${project.id}/interview`,
      generating: `/project/${project.id}/generating`,
      review: `/project/${project.id}/review`,
    };
    return routes[project.status] || `/project/${project.id}/upload`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between mb-10">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">Your Books</h1>
            <p className="font-body text-muted-foreground mt-2">Every pet has a story worth telling</p>
          </div>
          <Button asChild variant="hero" className="rounded-xl gap-2">
            <Link to="/project/new"><Plus className="w-4 h-4" /> New Book</Link>
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
              return (
                <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Link to={getProjectLink(project)}>
                    <Card className="rounded-2xl hover:shadow-lg transition-all duration-300 cursor-pointer group border-border" style={{ boxShadow: "var(--card-shadow)" }}>
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <ProjectStatusBadge status={project.status} />
                        </div>
                        <div>
                          <h3 className="font-display text-xl font-semibold text-foreground group-hover:text-primary transition-colors">{project.pet_name}</h3>
                          <p className="font-body text-sm text-muted-foreground mt-1">
                            {project.pet_breed ? `${project.pet_breed} · ` : ""}{project.pet_type}
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
              <PawPrint className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground mb-3">Ready to tell your pet's story?</h2>
            <p className="font-body text-muted-foreground max-w-md mx-auto mb-8">
              Create a beautiful, personalized storybook that celebrates everything that makes your pet special.
            </p>
            <Button asChild variant="hero" size="lg" className="rounded-xl gap-2">
              <Link to="/project/new"><Plus className="w-5 h-5" /> Create Your First Book</Link>
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
