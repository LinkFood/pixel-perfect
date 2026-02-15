

# Fix Share Links: Add Missing `share_token` Column

## Problem
The three sharing edge functions (`create-share-link`, `get-shared-book`, `share-page`) all query or update `projects.share_token`, but this column does not exist in the database. Every call fails with `column projects.share_token does not exist`.

## Fix
Run a single database migration:

```sql
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
```

This adds an optional, unique text column to `projects`. The existing edge functions already handle the full flow:
- `create-share-link`: generates a 12-char token and saves it
- `get-shared-book`: looks up a project by token and returns book data
- `share-page`: serves an HTML page with OG meta tags for social previews

No code changes are needed -- only the missing column.

## Technical Details

| Change | Details |
|--------|---------|
| Database migration | `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS share_token text UNIQUE` |
| Files affected | None -- all three edge functions already reference this column correctly |
| RLS impact | None -- share token is written via service role key in edge functions |

