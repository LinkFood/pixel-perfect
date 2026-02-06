import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProjectPhoto = {
  id: string;
  project_id: string;
  storage_path: string;
  caption: string | null;
  is_favorite: boolean;
  sort_order: number;
  created_at: string;
};

export const usePhotos = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["photos", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      const { data, error } = await supabase
        .from("project_photos")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ProjectPhoto[];
    },
    enabled: !!projectId,
  });
};

export const useUploadPhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const ext = file.name.split(".").pop();
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { count } = await supabase
        .from("project_photos")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);

      const { data, error } = await supabase
        .from("project_photos")
        .insert({ project_id: projectId, storage_path: path, sort_order: count || 0 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["photos", variables.projectId] });
    },
    onError: (error) => {
      toast.error("Upload failed");
      console.error(error);
    },
  });
};

export const useUpdatePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId, caption, is_favorite }: { id: string; projectId: string; caption?: string; is_favorite?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (caption !== undefined) updates.caption = caption;
      if (is_favorite !== undefined) updates.is_favorite = is_favorite;

      const { error } = await supabase.from("project_photos").update(updates).eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["photos", projectId] });
    },
  });
};

export const useDeletePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId, storagePath }: { id: string; projectId: string; storagePath: string }) => {
      await supabase.storage.from("pet-photos").remove([storagePath]);
      const { error } = await supabase.from("project_photos").delete().eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["photos", projectId] });
      toast.success("Photo removed");
    },
  });
};

export const getPhotoUrl = (storagePath: string) => {
  const { data } = supabase.storage.from("pet-photos").getPublicUrl(storagePath);
  return data.publicUrl;
};
