import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">Pricing</h1>
      <p className="font-body text-lg text-muted-foreground mb-8 max-w-md text-center">
        We're still figuring out pricing. For now, everything is free while we're in beta.
      </p>
      <Button variant="outline" onClick={() => navigate("/")}>
        ← Back home
      </Button>
    </div>
  );
};

export default Pricing;
