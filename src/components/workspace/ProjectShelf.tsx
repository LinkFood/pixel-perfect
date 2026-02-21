import React, { useState, useRef, useEffect } from "react";
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

const ProjectShelf = React.forwardRef<HTMLDivElement, ProjectShelfProps>(({ projects, activeProjectId, onSelect, onNew, onRename, onDelete }, ref) => {
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
      <div ref={ref} className="px-4 md:px-0 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1" role="tablist" aria-label="Projects">
          {projects.map((project, index) => {
            const isActive = project.id === activeProjectId;
            const name = project.pet_name === "New Project" ? "Untitled" : project.pet_name;
            const isEditing = editingId === project.id;

            return (
              <motion.button
                key={project.id}
                role="tab"
                aria-selected={isActive}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`shrink-0 rounded-xl px-3 py-2 text-left transition-all relative group border ${isActive ? "bg-primary border-primary" : "bg-card border-border"}`}
                style={{
                  minWidth: 80,
                  maxWidth: 160,
                }}
                onClick={() => !isEditing && onSelect(project.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
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
                        className={`w-full bg-transparent font-body text-xs font-medium outline-none border-b ${isActive ? "text-white border-white/50" : "text-foreground border-primary"}`}
                      />
                    ) : (
                      <p
                        className={`font-body text-xs font-medium truncate ${isActive ? "text-white" : "text-foreground"}`}
                      >
                        {name}
                      </p>
                    )}
                    {(() => {
                      const statusMap: Record<string, { dot: string; label: string }> = {
                        upload: { dot: "bg-amber-400", label: "Photos" },
                        interview: { dot: "bg-blue-400", label: "Chatting" },
                        generating: { dot: "bg-primary animate-pulse", label: "Creating" },
                        review: { dot: "bg-green-500", label: "Done" },
                      };
                      const s = statusMap[project.status] ?? { dot: "bg-muted-foreground", label: project.status };
                      return (
                        <span className={`inline-flex items-center gap-1.5 font-body text-[10px] ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      );
                    })()}
                  </div>

                  {isActive && (onRename || onDelete) && !isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 p-0.5 rounded hover:bg-white/20 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5 text-white" />
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
              </motion.button>
            );
          })}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNew}
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-card border border-dashed border-border"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
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
});

ProjectShelf.displayName = "ProjectShelf";

export default ProjectShelf;
