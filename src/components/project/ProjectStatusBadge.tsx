import { Badge } from "@/components/ui/badge";
import { Upload, MessageCircle, Sparkles, BookOpen, CheckCircle } from "lucide-react";

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  upload: { label: "Uploading Photos", icon: Upload, className: "bg-accent/20 text-accent-foreground border-accent/30" },
  interview: { label: "Interview", icon: MessageCircle, className: "bg-primary/15 text-primary border-primary/30" },
  generating: { label: "Generating Story", icon: Sparkles, className: "bg-accent/25 text-accent-foreground border-accent/40" },
  review: { label: "Review", icon: BookOpen, className: "bg-secondary text-secondary-foreground border-border" },
  complete: { label: "Complete", icon: CheckCircle, className: "bg-primary/20 text-primary border-primary/30" },
};

const ProjectStatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status] || statusConfig.upload;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1.5 font-body text-xs ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
};

export default ProjectStatusBadge;
