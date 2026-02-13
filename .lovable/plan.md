
# Build Activity Log — Smart Transparency (No Noise)

## Core Philosophy
Show what's *important*, hide what's not. The user sees a clean chat flow with Rabbit narrating the key moments, and power users can optionally drill into the technical log. No spam, no clutter.

## How It Works (User Experience)

### Main Chat (Always Visible)
Rabbit speaks naturally about progress, but **only for state changes**, not every API call:

**Story Phase:**
```
Rabbit: Let me read through everything you shared about Link...
(after a moment)
Rabbit: Found 24 interview messages and 6 photos. Writing the story now...
(after story completes)
Rabbit: The story is written! 13 pages in 42 seconds. Now painting the illustrations...
```

**Illustration Phase:**
```
Rabbit: Painting page 1: Link bursts through the back door...
(when complete)
Rabbit: Page 1 done! Moving to page 2...
```

**No spam**: Not every API call triggers a message. Only "meaningful" events:
- ✅ Story started & completed
- ✅ Each page illustration started & completed  
- ✅ Batch completions ("3 more pages done!")
- ❌ Every retry, every rate limit backoff, every token count

### Under the Hood Log (Optional Collapsible)
Below the chat, a **collapsed** "Under the Hood" section with a toggle. When expanded, shows detailed timestamps, model names, file sizes, retry counts — the technical stuff developers/curious users want.

```
[Under the Hood] (collapsed by default)

When expanded, shows:
12:01:03 | story | Reading interview data (24 messages, 6 photos)
12:01:05 | story | Sending to openai/gpt-5.2 (max_tokens: 4000)
12:01:47 | story | Story generated: 2847 tokens, 13 pages in 44s
12:01:48 | illust | Painting page 1 (cover) — prompt: 1256 chars
12:02:10 | illust | Page 1 complete: 2.1MB PNG | model: google/gemini-3-pro-image-preview
```

## Database Schema

```sql
CREATE TABLE build_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id),
  phase text NOT NULL,        -- 'story', 'illustration', 'appearance', 'caption'
  level text NOT NULL DEFAULT 'info', -- 'info', 'milestone', 'error'
  message text NOT NULL,      -- user-facing friendly message
  technical_message text,     -- dev-facing details (timestamps, sizes, etc.)
  metadata jsonb DEFAULT '{}',-- {model, tokens, size_bytes, elapsed_ms, retry_count, etc.}
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: project owner can read
ALTER TABLE build_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own build logs"
  ON build_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = build_log.project_id AND projects.user_id = auth.uid()
  ));

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE build_log;
```

## Edge Function Changes (Minimal & Smart)

Edge functions **only log "milestone" events** — the state changes that matter:

### `generate-story/index.ts`
```typescript
// Only 2 inserts: start and complete
await supabase.from("build_log").insert({
  project_id: projectId,
  phase: "story",
  level: "milestone",
  message: `Found ${interviewCount} messages and ${photoCount} photos. Writing story...`,
  technical_message: `Model: openai/gpt-5.2 | Max tokens: 4000`,
  metadata: {
    model: "openai/gpt-5.2",
    interview_messages: interviewCount,
    photos: photoCount,
  }
});

// ... actual generation ...

await supabase.from("build_log").insert({
  project_id: projectId,
  phase: "story",
  level: "milestone",
  message: `Story complete! ${pageCount} pages written.`,
  technical_message: `Generated in ${elapsedMs}ms | Tokens used: ${tokensUsed}`,
  metadata: {
    pages: pageCount,
    elapsed_ms: elapsedMs,
    tokens_used: tokensUsed,
  }
});
```

### `generate-illustration/index.ts`
```typescript
// Log each page completion, not each retry
await supabase.from("build_log").insert({
  project_id: projectId,
  phase: "illustration",
  level: "milestone",
  message: `Page ${pageNum} complete!`,
  technical_message: `${contentType} | ${sizeBytes} bytes | Generated in ${elapsedMs}ms`,
  metadata: {
    page_number: pageNum,
    size_bytes: sizeBytes,
    model: "google/gemini-3-pro-image-preview",
    elapsed_ms: elapsedMs,
    retry_count: retries,
  }
});
```

### `build-appearance-profile/index.ts`, `describe-photo/index.ts`
```typescript
// Only one log per function call — completion
await supabase.from("build_log").insert({
  project_id: projectId,
  phase: "appearance",
  level: "milestone",
  message: `Appearance profile built: ${summary}`,
  technical_message: `Analyzed ${photoCount} photos | Model: google/gemini-2.5-flash`,
  metadata: {
    photos_analyzed: photoCount,
    model: "google/gemini-2.5-flash",
  }
});
```

## Frontend Components

### New: `src/components/workspace/BuildLog.tsx`
A collapsible panel that:
1. Subscribes to realtime `build_log` events
2. Shows technical_message + timestamp for each milestone
3. Collapsed by default, expandable via "Under the Hood" toggle
4. Auto-scrolls to latest entry
5. Only shows `level: 'milestone'` (no noise)

```tsx
// Pseudo-code
<Collapsible defaultOpen={false}>
  <CollapsibleTrigger>Under the Hood</CollapsibleTrigger>
  <CollapsibleContent>
    {buildLogEntries.map(entry => (
      <div className="text-xs font-mono text-muted-foreground">
        <span>{formatTime(entry.created_at)}</span>
        <span className="text-primary ml-2">{entry.phase}</span>
        <span className="ml-2">{entry.technical_message}</span>
      </div>
    ))}
  </CollapsibleContent>
</Collapsible>
```

### Updated: `src/components/workspace/GenerationView.tsx`
1. Subscribe to realtime `build_log` for the current project
2. Filter `level: 'milestone'` events
3. Extract the `message` field and add it as a Rabbit chat message
4. Render the new `BuildLog` component below the chat
5. Remove the hardcoded message cycling — let the database drive it

This way:
- **Chat stays clean**: Only major state changes appear
- **Transparency**: Power users can toggle "Under the Hood" to see every detail
- **Maintainability**: Add logging later (retries, rate limits) without touching the UI
- **No white noise**: Default experience is smooth and friendly, detail is optional

## Files to Create
- `src/components/workspace/BuildLog.tsx` (new component)

## Files to Edit
- Create migration for `build_log` table
- `src/components/workspace/GenerationView.tsx` (subscribe to realtime, render BuildLog)
- `supabase/functions/generate-story/index.ts` (add milestone logs)
- `supabase/functions/generate-illustration/index.ts` (add milestone logs)
- `supabase/functions/build-appearance-profile/index.ts` (add milestone logs)
- `supabase/functions/describe-photo/index.ts` (add milestone logs)

## What the User Sees

**Main Chat (default)**
```
Rabbit: Let me read everything about Link...
Rabbit: Found 24 interview messages and 6 photos. Writing the story now...
Rabbit: Story written! 13 pages in 42 seconds. Now painting...
Rabbit: Painting page 1...
[illustration thumbnail]
Rabbit: Page 1 done! Moving to page 2...
```

**Toggle "Under the Hood"**
```
12:01:03 | story | Model: openai/gpt-5.2 | Max tokens: 4000
12:01:47 | story | Generated in 44s | Tokens used: 2847
12:01:48 | illust | Page 1 complete: 2.1MB PNG | google/gemini-3-pro-image-preview | 22s
```

No noise, no spam. Just clarity when you want it.

