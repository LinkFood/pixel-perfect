import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import ProjectNew from "./pages/ProjectNew";
import ProjectUpload from "./pages/ProjectUpload";
import ProjectInterview from "./pages/ProjectInterview";
import ProjectGenerating from "./pages/ProjectGenerating";
import ProjectReview from "./pages/ProjectReview";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
