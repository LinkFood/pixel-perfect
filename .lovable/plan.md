

# Full End-to-End Logging: Everything After Photo Upload

## Goal

Make the "Under the Hood" dev log a complete, chronological record of everything that happens from the moment a user uploads their first photo through to the finished book. This is valuable for debugging now and for analytics/product improvement later.

## What's Already Logged

The backend edge functions already write to `build_log` for:
- Photo captioning (describe-photo)
- Appearance profile (build/complete)
- Story generation (start, per-page, complete)
- Illustration generation (start, complete, fail)

## What's Missing (and Will Be Added)

### 1. Photo Upload Events -- `src/hooks/usePhotos.ts`

**Batch start**: When `processBatchQueue` begins, log how many photos are being uploaded.

**Batch complete**: After all uploads finish, log the result (N succeeded, N failed).

**Individual upload failures**: Already console.error'd but not in build_log.

These will be logged client-side by calling `supabase.from("build_log").insert(...)` directly since the upload logic is in the React hook, not an edge function.

New phase: `upload` with color `text-cyan-400`.

### 2. Interview Chat Turns -- `src/components/workspace/BuildLog.tsx`

Rather than duplicating chat messages into `build_log`, the BuildLog component will also fetch from `project_interview` and merge them into the timeline, displayed as a `chat` phase. This gives end-to-end visibility without writing redundant data.

- Fetch `project_interview` alongside `build_log`
- Map interview rows to the same shape (phase: "chat", message: "user: ..." or "rabbit: ...")
- Subscribe to realtime inserts on `project_interview` for live updates
- New phase color: `text-rose-400`

### 3. Decision Points -- `src/pages/PhotoRabbit.tsx`

Log key user decisions to `build_log` so we can see exactly what choices led to the generated book:

- **Mood selected**: phase: "decision", message: "Mood: funny"
- **Format chosen**: phase: "decision", message: "Format: short_story"
- **Length chosen**: phase: "decision", message: "Length: 5 pages"
- **Generation triggered**: phase: "decision", message: "Generation started"

New phase: `decision` with color `text-orange-400`.

### 4. Credit Events -- `src/pages/PhotoRabbit.tsx`

- **Credit check**: phase: "system", message: "Credit check: balance N, cost N"
- **Credit deducted**: phase: "system", message: "N tokens deducted, balance now M"
- **Insufficient credits**: phase: "system", message: "Insufficient credits (need N, have M)"

New phase: `system` with color `text-gray-400`.

### 5. Phase Transitions -- `src/pages/PhotoRabbit.tsx`

Log when the project moves between phases so the timeline shows the full lifecycle:

- "Phase: upload -> interview"
- "Phase: interview -> generating"
- "Phase: generating -> review"

These go under phase: `system`.

---

## File Changes

### `src/hooks/usePhotos.ts`

- In `processBatchQueue`: Insert build_log entry at batch start and batch complete
- Requires `projectId` which is already available in the function

### `src/components/workspace/BuildLog.tsx`

- Add `chat` and new phases to `phaseColors`
- Fetch `project_interview` in the same `useEffect`
- Merge and sort with build_log entries by `created_at`
- Add second Realtime subscription for `project_interview` inserts
- Render chat entries with role prefix ("user:" / "rabbit:")

### `src/pages/PhotoRabbit.tsx`

- Add a small `logEvent` helper that inserts into `build_log`:
  ```typescript
  const logEvent = useCallback((phase: string, message: string, meta?: Record<string, unknown>) => {
    if (!activeProjectId) return;
    supabase.from("build_log").insert({
      project_id: activeProjectId,
      phase,
      level: "info",
      message,
      metadata: meta || {},
    });
  }, [activeProjectId]);
  ```
- Call `logEvent` at decision points:
  - `handleMoodSelect`: log mood choice
  - `handleBubbleSelect` (format/length decisions): log each choice
  - `handleFinishInterview`: log generation trigger + credit outcome
  - Phase transition effect: log phase changes

### `build_log` RLS

The existing RLS allows SELECT for project owners. INSERT is currently only done by edge functions (service role). Client-side inserts from the React app need an INSERT policy, or we use the service role key. Since we're already using the anon client, we need to add an INSERT RLS policy.

**Database migration**: Add INSERT policy on `build_log` for authenticated users who own the project:

```sql
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
```

---

## Summary

| What | Where | Phase |
|------|-------|-------|
| Photo batch start/complete | usePhotos.ts | upload |
| Interview chat turns | BuildLog.tsx (merged from project_interview) | chat |
| Mood/format/length decisions | PhotoRabbit.tsx | decision |
| Credit check/deduct | PhotoRabbit.tsx | system |
| Phase transitions | PhotoRabbit.tsx | system |
| Photo captioning | describe-photo (already exists) | caption |
| Appearance profile | build-appearance-profile (already exists) | appearance |
| Story generation | generate-story (already exists) | story |
| Illustrations | generate-illustration (already exists) | illustration |

After this, opening "Under the Hood" shows the complete story of how a book was made, from first photo drop to final illustration.
