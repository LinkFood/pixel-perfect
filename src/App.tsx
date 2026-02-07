import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-load all pages except landing and 404
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProjectNew = lazy(() => import("./pages/ProjectNew"));
const ProjectUpload = lazy(() => import("./pages/ProjectUpload"));
const ProjectInterview = lazy(() => import("./pages/ProjectInterview"));
const ProjectGenerating = lazy(() => import("./pages/ProjectGenerating"));
const ProjectReview = lazy(() => import("./pages/ProjectReview"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/project/new" element={<ProjectNew />} />
            <Route path="/project/:id/upload" element={<ProjectUpload />} />
            <Route path="/project/:id/interview" element={<ProjectInterview />} />
            <Route path="/project/:id/generating" element={<ProjectGenerating />} />
            <Route path="/project/:id/review" element={<ProjectReview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
