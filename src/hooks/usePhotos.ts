import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback, useRef } from "react";

export type ProjectPhoto = {
  id: string;
  project_id: string;
  storage_path: string;
  caption: string | null;
  ai_analysis: Record<string, unknown> | null;
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
  const [captioningIds, setCaptioningIds] = useState<Set<string>>(new Set());

  // Batch upload tracking
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0, failed: 0 });
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const batchQueueRef = useRef<{ projectId: string; file: File }[]>([]);
  const batchActiveRef = useRef(false);

  const describePhoto = useCallback(async (photoId: string, projectId: string) => {
    setCaptioningIds(prev => new Set(prev).add(photoId));
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/describe-photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ photoId, projectId }),
        });
        if (resp.ok) {
          queryClient.invalidateQueries({ queryKey: ["photos", projectId] });
          break;
        }
        if (resp.status === 429 && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        console.error("describe-photo failed:", resp.status);
        if (attempt === MAX_RETRIES) {
          toast.error("Couldn't caption a photo — story may miss some details");
        }
        break;
      } catch (e) {
        console.error("describe-photo error:", e);
        if (attempt === MAX_RETRIES) {
          toast.error("Couldn't caption a photo — story may miss some details");
        } else {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    setCaptioningIds(prev => {
      const next = new Set(prev);
      next.delete(photoId);
      return next;
    });
  }, [queryClient]);

  // Upload a single file — returns the photo record or null on failure
  const uploadSingleFile = useCallback(async (projectId: string, file: File, sortOrder: number): Promise<ProjectPhoto | null> => {
    try {
      const ext = file.name.split(".").pop();
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("project_photos")
        .insert({ project_id: projectId, storage_path: path, sort_order: sortOrder })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectPhoto;
    } catch (e) {
      console.error(`Upload failed for ${file.name}:`, e);
      return null;
    }
  }, []);

  // Process batch queue with concurrency of 3, retry logic, and pacing
  const processBatchQueue = useCallback(async () => {
    if (batchActiveRef.current) return;
    batchActiveRef.current = true;
    setIsBatchUploading(true);

    try {
      const queue = [...batchQueueRef.current];
      batchQueueRef.current = [];

      const CONCURRENCY = 3;
      let batchCompleted = 0;
      let batchFailed = 0;
      const total = queue.length;
      const failedItems: { projectId: string; file: File; sortOrder: number }[] = [];
      const successfulIds: { id: string; projectId: string }[] = [];

      setUploadProgress(prev => ({ total: prev.total + total, completed: prev.completed, failed: prev.failed }));

      // Get current count for sort_order
      const projectId = queue[0]?.projectId;
      if (!projectId) return;

      const { count: existingCount } = await supabase
        .from("project_photos")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      let sortBase = existingCount || 0;

      // Process in chunks of CONCURRENCY with pacing
      for (let i = 0; i < queue.length; i += CONCURRENCY) {
        const chunk = queue.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map((item, j) => uploadSingleFile(item.projectId, item.file, sortBase + i + j))
        );

        let chunkOk = 0;
        let chunkFail = 0;
        for (let r = 0; r < results.length; r++) {
          const result = results[r];
          if (result.status === "fulfilled" && result.value) {
            batchCompleted++;
            chunkOk++;
            successfulIds.push({ id: result.value.id, projectId });
          } else {
            batchFailed++;
            chunkFail++;
            failedItems.push({ projectId: chunk[r].projectId, file: chunk[r].file, sortOrder: sortBase + i + r });
          }
        }

        setUploadProgress(prev => ({ ...prev, completed: prev.completed + chunkOk, failed: prev.failed + chunkFail }));

        // Refresh photo list every 10 uploads
        if (completed % 10 === 0 || i + CONCURRENCY >= queue.length) {
          queryClient.invalidateQueries({ queryKey: ["photos", projectId] });
        }

        // Small delay between chunks to avoid overwhelming Supabase storage
        if (i + CONCURRENCY < queue.length) {
          await new Promise(r => setTimeout(r, 150));
        }
      }

      // Retry failed uploads once (with slightly more spacing)
      if (failedItems.length > 0) {
        console.log(`Retrying ${failedItems.length} failed uploads...`);
        for (let i = 0; i < failedItems.length; i += CONCURRENCY) {
          const chunk = failedItems.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            chunk.map(item => uploadSingleFile(item.projectId, item.file, item.sortOrder))
          );

          let retryOk = 0;
          for (let r = 0; r < results.length; r++) {
            const result = results[r];
            if (result.status === "fulfilled" && result.value) {
              batchCompleted++;
              batchFailed--;
              retryOk++;
              successfulIds.push({ id: result.value.id, projectId });
            }
          }

          if (retryOk > 0) setUploadProgress(prev => ({ ...prev, completed: prev.completed + retryOk, failed: prev.failed - retryOk }));

          if (i + CONCURRENCY < failedItems.length) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }

      // Final refresh
      queryClient.invalidateQueries({ queryKey: ["photos", projectId] });

      // Fire captioning AFTER all uploads are done (not during — saves bandwidth)
      for (const item of successfulIds) {
        await describePhoto(item.id, item.projectId);
        await new Promise(r => setTimeout(r, 500));
      }

      if (batchFailed > 0) {
        toast.error(`${batchFailed} of ${total} photos failed to upload`);
      } else {
        toast.success(`All ${total} photos uploaded!`);
      }
    } finally {
      batchActiveRef.current = false;
      setIsBatchUploading(false);
    }

    // Pick up any files queued while this batch was running
    if (batchQueueRef.current.length > 0) {
      processBatchQueue();
    } else {
      // All batches done — reset progress for next upload session
      setUploadProgress({ total: 0, completed: 0, failed: 0 });
    }
  }, [queryClient, describePhoto, uploadSingleFile]);

  // Queue files for batch upload
  const uploadBatch = useCallback((projectId: string, files: File[]) => {
    batchQueueRef.current.push(...files.map(file => ({ projectId, file })));
    processBatchQueue();
  }, [processBatchQueue]);

  // Keep the old single mutation for backward compat but it's unused now
  const mutation = useMutation({
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
      return data as ProjectPhoto;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["photos", variables.projectId] });
      describePhoto(data.id, variables.projectId);
    },
    onError: () => {
      toast.error("Upload failed");
    },
  });

  return { ...mutation, captioningIds, uploadBatch, uploadProgress, isBatchUploading };
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
