import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type Project } from "@/hooks/useProject";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface ProjectShelfProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSelect: (projectId: string) => void;
  onNew: () => void;
  onRename?: (projectId: string, newName: string) => void;
  onDelete?: (projectId: string) => void;
}

const ProjectShelf = ({ projects, activeProjectId, onSelect, onNew, onRename, onDelete }: ProjectShelfProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  if (projects.length === 0) return null;

  const saveRename = () => {
    if (editingId && editName.trim() && onRename) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const deleteProject = projects.find(p => p.id === deleteId);

  return (
    <>
      <div className="px-4 md:px-0 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          {projects.map(project => {
            const isActive = project.id === activeProjectId;
            const name = project.pet_name === "New Project" ? "Untitled" : project.pet_name;
            const isEditing = editingId === project.id;

            return (
              <motion.div
                key={project.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="shrink-0 rounded-xl px-3 py-2 text-left transition-all relative group"
                style={{
                  background: isActive ? "#C4956A" : "#F5EDE4",
                  border: `1px solid ${isActive ? "#C4956A" : "#E8D5C0"}`,
                  minWidth: 80,
                  maxWidth: 160,
                  cursor: "pointer",
                }}
                onClick={() => !isEditing && onSelect(project.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  // Context menu handled by DropdownMenu
                }}
              >
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={saveRename}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveRename();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-transparent font-body text-xs font-medium outline-none border-b"
                        style={{
                          color: isActive ? "white" : "#2C2417",
                          borderColor: isActive ? "rgba(255,255,255,0.5)" : "#C4956A",
                        }}
                      />
                    ) : (
                      <p
                        className="font-body text-xs font-medium truncate"
                        style={{ color: isActive ? "white" : "#2C2417" }}
                      >
                        {name}
                      </p>
                    )}
                    <p
                      className="font-body text-[10px] truncate"
                      style={{ color: isActive ? "rgba(255,255,255,0.7)" : "#9B8E7F" }}
                    >
                      {project.status}
                    </p>
                  </div>

                  {isActive && (onRename || onDelete) && !isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 p-0.5 rounded hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" style={{ color: "white" }} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" sideOffset={8} className="min-w-[120px]">
                        {onRename && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditName(name);
                              setEditingId(project.id);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Rename
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(project.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </motion.div>
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteProject?.pet_name}" and all its photos, interview, and pages. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId && onDelete) {
                  onDelete(deleteId);
                }
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectShelf;
