import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

// New Rabbit-centric pages
const Home = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));
const RabbitDemo = lazy(() => import("./pages/RabbitDemo"));

// Workspace handles all project states except review (too complex for inline)
const Workspace = lazy(() => import("./components/workspace/Workspace"));
const ProjectReview = lazy(() => import("./pages/ProjectReview"));

// Legacy routes redirect to new flow (keep for backwards compat)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProjectGenerating = lazy(() => import("./pages/ProjectGenerating"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F0" }}>
    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C4956A" }} />
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
            {/* New Rabbit-centric routes */}
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/project/:id" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
            <Route path="/project/:id/review" element={<ProtectedRoute><ProjectReview /></ProtectedRoute>} />

            {/* Legacy routes (still work for existing bookmarks/links) */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/project/new" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
            <Route path="/project/:id/context" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
            <Route path="/project/:id/upload" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
            <Route path="/project/:id/interview" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
            <Route path="/project/:id/generating" element={<ProtectedRoute><ProjectGenerating /></ProtectedRoute>} />

            {/* Dev */}
            <Route path="/rabbit-demo" element={<RabbitDemo />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
