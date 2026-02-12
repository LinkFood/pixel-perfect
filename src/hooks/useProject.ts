import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export type Project = {
  id: string;
  pet_name: string;
  pet_type: string;
  pet_breed: string | null;
  pet_appearance_profile: string | null;
  photo_context_brief: string | null;
  product_type: string | null;
  mood: string | null;

  user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export const useProjects = () => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });
};

export const useProject = (id: string | undefined) => {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      if (!id) throw new Error("No project ID");
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (values: { pet_name: string; pet_type: string; pet_breed?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("projects")
        .insert({ pet_name: values.pet_name, pet_type: values.pet_type, pet_breed: values.pet_breed || null, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Project for ${data.pet_name} created!`);
      navigate(`/project/${data.id}/upload`);
    },
    onError: (error) => {
      toast.error("Failed to create project");
      console.error(error);
    },
  });
};

export const useCreateMinimalProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("projects")
        .insert({ pet_name: "New Project", pet_type: "unknown", user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      toast.error("Failed to create project");
      console.error(error);
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; pet_name?: string; pet_type?: string; pet_breed?: string | null; product_type?: string; mood?: string }) => {
      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      toast.error("Failed to update project");
      console.error(error);
    },
  });
};

export const useUpdateProjectStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("projects")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      // 1. Delete illustrations (storage + DB)
      const { data: illustrations } = await supabase
        .from("project_illustrations")
        .select("storage_path")
        .eq("project_id", projectId);
      if (illustrations && illustrations.length > 0) {
        await supabase.storage.from("pet-photos").remove(illustrations.map(i => i.storage_path));
        await supabase.from("project_illustrations").delete().eq("project_id", projectId);
      }

      // 2. Delete pages
      await supabase.from("project_pages").delete().eq("project_id", projectId);

      // 3. Delete interview
      await supabase.from("project_interview").delete().eq("project_id", projectId);

      // 4. Delete photos (storage + DB)
      const { data: photos } = await supabase
        .from("project_photos")
        .select("storage_path")
        .eq("project_id", projectId);
      if (photos && photos.length > 0) {
        await supabase.storage.from("pet-photos").remove(photos.map(p => p.storage_path));
        await supabase.from("project_photos").delete().eq("project_id", projectId);
      }

      // 5. Delete project
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete project");
      console.error(error);
    },
  });
};
