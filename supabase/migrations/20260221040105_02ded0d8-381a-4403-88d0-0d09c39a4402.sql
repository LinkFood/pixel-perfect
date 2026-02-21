CREATE POLICY "Users can insert own build logs"
ON public.build_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = build_log.project_id
    AND projects.user_id = auth.uid()
  )
);