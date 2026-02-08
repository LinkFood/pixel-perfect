import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Image, PartyPopper, Smile, Lock, Eye, MapPin, Sparkles, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useProject, useUpdateProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { usePhotos, getPhotoUrl } from "@/hooks/usePhotos";
import Navbar from "@/components/landing/Navbar";

const productOptions = [
  {
    id: "storybook",
    title: "Storybook",
    description: "A fully illustrated book from your memories",
    icon: BookOpen,
    available: true,
  },
  {
    id: "birthday_card",
    title: "Birthday Card",
    description: "A personal card from real moments",
    icon: PartyPopper,
    available: false,
  },
  {
    id: "poster",
    title: "Poster / Print",
    description: "A single illustrated scene",
    icon: Image,
    available: false,
  },
  {
    id: "roast_book",
    title: "Roast Book",
    description: "A funny tribute from real photos",
    icon: Smile,
    available: false,
  },
];

const subjectTypes = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "bird", label: "Bird" },
  { value: "pet_other", label: "Pet (other)" },
  { value: "person", label: "Person" },
  { value: "group", label: "Group" },
  { value: "other", label: "Other" },
];

const ProjectContext = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: photos = [] } = usePhotos(id);
  const updateProject = useUpdateProject();
  const updateStatus = useUpdateProjectStatus();

  // Poll for context brief while it's building
  useEffect(() => {
    if (project?.photo_context_brief || projectLoading) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    }, 3000);
    return () => clearInterval(interval);
  }, [project?.photo_context_brief, projectLoading, id, queryClient]);

  const [selectedProduct, setSelectedProduct] = useState("storybook");
  const [subjectName, setSubjectName] = useState("");
  const [subjectType, setSubjectType] = useState("dog");
  const [breed, setBreed] = useState("");
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Pre-populate form from project data when it loads
  useEffect(() => {
    if (!project || initialized) return;
    const hasRealName = project.pet_name && project.pet_name !== "New Project";
    if (hasRealName) setSubjectName(project.pet_name);
    if (project.pet_type && project.pet_type !== "unknown") setSubjectType(project.pet_type);
    if (project.pet_breed) setBreed(project.pet_breed);
    if (project.product_type) setSelectedProduct(project.product_type);
    if (hasRealName) setDetailsSaved(true);
    setInitialized(true);
  }, [project, initialized]);

  // Derive analysis state
  const contextBrief = project?.photo_context_brief;
  const isAnalyzing = !contextBrief && !projectLoading;
  const analyzedPhotos = photos.filter(p => p.ai_analysis || p.caption);

  const canStart = subjectName.trim().length > 0 && detailsSaved;

  const handleSaveDetails = () => {
    if (!id || !subjectName.trim()) return;
    updateProject.mutate({
      id,
      pet_name: subjectName.trim(),
      pet_type: subjectType,
      pet_breed: breed.trim() || null,
      product_type: selectedProduct,
    });
    setDetailsSaved(true);
  };

  const handleStartInterview = () => {
    if (!id) return;
    updateStatus.mutate({ id, status: "interview" });
    navigate(`/project/${id}/interview`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-body transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          {/* Section 1: What We Found */}
          <section className="mb-12">
            <div className="flex items-end justify-between mb-2">
              <h2 className="font-display text-2xl font-bold text-foreground">What We Found</h2>
              <Link
                to={`/project/${id}/upload`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-body transition-colors"
              >
                <Camera className="w-3.5 h-3.5" /> Add More Photos
              </Link>
            </div>
            <p className="font-body text-muted-foreground mb-6">
              Our AI studied your photos. Here's what it sees.
            </p>

            {isAnalyzing ? (
              <Card className="rounded-2xl border-border" style={{ boxShadow: "var(--card-shadow)" }}>
                <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                  <p className="font-display text-lg text-foreground mb-1">Studying your photos...</p>
                  <p className="font-body text-sm text-muted-foreground">
                    Our AI is reading every detail — settings, moods, people, moments
                  </p>
                </CardContent>
              </Card>
            ) : contextBrief ? (
              <div className="space-y-4">
                <Card className="rounded-2xl border-border" style={{ boxShadow: "var(--card-shadow)" }}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Eye className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-semibold text-foreground mb-2">Photo Context</h3>
                        <p className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {contextBrief}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {analyzedPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {analyzedPhotos.slice(0, 6).map((photo) => {
                      const analysis = photo.ai_analysis as Record<string, unknown> | null;
                      const mood = analysis?.mood as string | undefined;
                      const setting = analysis?.setting as string | undefined;
                      return (
                        <div key={photo.id} className="relative rounded-xl overflow-hidden border border-border group">
                          <img
                            src={getPhotoUrl(photo.storage_path)}
                            alt={photo.caption || "Photo"}
                            className="w-full aspect-square object-cover"
                            loading="lazy"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/70 to-transparent p-2">
                            <div className="flex flex-wrap gap-1">
                              {mood && (
                                <span className="inline-flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-body text-foreground">
                                  <Sparkles className="w-2.5 h-2.5" /> {mood}
                                </span>
                              )}
                              {setting && (
                                <span className="inline-flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-body text-foreground">
                                  <MapPin className="w-2.5 h-2.5" /> {setting}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <Card className="rounded-2xl border-border" style={{ boxShadow: "var(--card-shadow)" }}>
                <CardContent className="p-6 text-center">
                  <p className="font-body text-sm text-muted-foreground">
                    {photos.length > 0 ? "Analysis complete. Your photos tell a great story." : "No photos uploaded yet."}
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Section 2: Product Picker */}
          <section className="mb-12">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">What Do You Want to Make?</h2>
            <p className="font-body text-muted-foreground mb-6">
              Choose a product. More options coming soon.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {productOptions.map((product) => {
                const isSelected = selectedProduct === product.id;
                return (
                  <button
                    key={product.id}
                    className={`relative rounded-2xl p-5 border-2 text-left transition-all duration-200 ${
                      product.available
                        ? isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30"
                        : "border-border bg-card/50 opacity-60 cursor-not-allowed"
                    }`}
                    onClick={() => product.available && setSelectedProduct(product.id)}
                    disabled={!product.available}
                  >
                    {!product.available && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-body text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                        <Lock className="w-2.5 h-2.5" /> Coming Soon
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-3">
                      <product.icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <h3 className="font-display text-sm font-semibold text-foreground mb-1">{product.title}</h3>
                    <p className="font-body text-xs text-muted-foreground">{product.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 3: Confirm Details */}
          <section className="mb-8">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">Confirm Details</h2>
            <p className="font-body text-muted-foreground mb-6">
              Tell us who (or what) these photos are about.
            </p>

            <Card className="rounded-2xl border-border" style={{ boxShadow: "var(--card-shadow)" }}>
              <CardContent className="p-6 space-y-5">
                <div>
                  <label className="font-display text-sm font-medium text-foreground block mb-1.5">Subject Name *</label>
                  <Input
                    placeholder="e.g. Link, Mom & Dad, Our Trip..."
                    className="rounded-xl"
                    value={subjectName}
                    onChange={(e) => { setSubjectName(e.target.value); setDetailsSaved(false); }}
                  />
                </div>

                <div>
                  <label className="font-display text-sm font-medium text-foreground block mb-1.5">Subject Type</label>
                  <Select value={subjectType} onValueChange={(v) => { setSubjectType(v); setDetailsSaved(false); }}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {subjectTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-display text-sm font-medium text-foreground block mb-1.5">
                    Breed / Description <span className="text-muted-foreground font-body text-xs">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g. Golden Retriever, College friends..."
                    className="rounded-xl"
                    value={breed}
                    onChange={(e) => { setBreed(e.target.value); setDetailsSaved(false); }}
                  />
                </div>

                <Button
                  variant={detailsSaved ? "outline" : "hero"}
                  className="w-full rounded-xl"
                  onClick={handleSaveDetails}
                  disabled={!subjectName.trim() || updateProject.isPending}
                >
                  {updateProject.isPending ? "Saving..." : detailsSaved ? "Saved" : "Save Details"}
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Start Interview */}
          <Button
            variant="hero"
            size="lg"
            className="w-full rounded-xl gap-2 text-base py-6"
            disabled={!canStart}
            onClick={handleStartInterview}
          >
            Start Interview <ArrowRight className="w-5 h-5" />
          </Button>
          {!canStart && subjectName.trim().length === 0 && (
            <p className="font-body text-xs text-muted-foreground text-center mt-2">
              Fill in the subject name and save to continue
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectContext;
