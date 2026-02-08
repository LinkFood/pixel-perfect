import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Workspace from "@/components/workspace/Workspace";
import Landing from "./Landing";

const Home = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F0" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C4956A" }} />
      </div>
    );
  }

  if (user) {
    return <Workspace />;
  }

  return <Landing />;
};

export default Home;
