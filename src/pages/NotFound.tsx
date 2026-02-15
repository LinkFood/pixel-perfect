import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-display font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg font-body text-muted-foreground">This page doesn't exist</p>
        <Link to="/">
          <Button variant="hero" className="rounded-xl gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to PhotoRabbit
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
