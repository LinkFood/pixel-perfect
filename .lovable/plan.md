

# Fix: Interview Photo Strip Still Capped at 12

## What's Already Done

Your git push successfully implemented the full mood picker flow:
- MoodPicker component -- working
- Mood-aware interview prompts in `interview-chat` edge function -- working
- Mood-aware story generation in `generate-story` edge function -- working  
- `mood` column exists in the database (confirmed in types.ts)
- Workspace flow (upload -> mood picker -> interview -> generating -> review) -- working
- Interview model switched to `openai/gpt-5-mini` -- done
- Adaptive interview length with self-assessment -- done

## One Remaining Bug

The interview view's collapsible photo strip in `Workspace.tsx` still caps at 12 photos with a "+N more" badge. This was fixed in the upload grid but missed here.

## Change

### File: `src/components/workspace/Workspace.tsx`

1. **Line 416**: Change `photos.slice(0, 12).map(...)` to `photos.map(...)` -- show all photos in the horizontal strip
2. **Lines 429-436**: Remove the "+N more" overflow badge block entirely

That's it -- one small fix. Everything else from your feature spec is already live and working.

