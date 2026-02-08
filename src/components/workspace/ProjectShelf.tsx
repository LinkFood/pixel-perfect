import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { type Project } from "@/hooks/useProject";

interface ProjectShelfProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSelect: (projectId: string) => void;
  onNew: () => void;
}

const ProjectShelf = ({ projects, activeProjectId, onSelect, onNew }: ProjectShelfProps) => {
  if (projects.length === 0) return null;

  return (
    <div className="px-4 md:px-0 pb-3">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          const name = project.pet_name === "New Project" ? "Untitled" : project.pet_name;
          return (
            <motion.button
              key={project.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(project.id)}
              className="shrink-0 rounded-xl px-3 py-2 text-left transition-all"
              style={{
                background: isActive ? "#C4956A" : "#F5EDE4",
                border: `1px solid ${isActive ? "#C4956A" : "#E8D5C0"}`,
                minWidth: 80,
                maxWidth: 140,
              }}
            >
              <p
                className="font-body text-xs font-medium truncate"
                style={{ color: isActive ? "white" : "#2C2417" }}
              >
                {name}
              </p>
              <p
                className="font-body text-[10px] truncate"
                style={{ color: isActive ? "rgba(255,255,255,0.7)" : "#9B8E7F" }}
              >
                {project.status}
              </p>
            </motion.button>
          );
        })}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNew}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#F5EDE4", border: "1px dashed #E8D5C0" }}
        >
          <Plus className="w-4 h-4" style={{ color: "#9B8E7F" }} />
        </motion.button>
      </div>
    </div>
  );
};

export default ProjectShelf;
