
CREATE TABLE build_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  technical_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE build_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own build logs"
  ON build_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = build_log.project_id AND projects.user_id = auth.uid()
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE build_log;
