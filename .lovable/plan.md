
# Three Fixes: Multi-Character Profiles, Required Names, Children's Book Text

## Fix 1 -- Multiple Characters Get Separate Appearance Profiles

### Problem
The `build-appearance-profile` edge function writes a single `pet_appearance_profile` string to the `projects` table. When photos contain two subjects (e.g. two babies), it merges them into one paragraph and only one character appears in illustrations.

### Solution

**Database migration**: Add a `character_profiles` JSONB column to `projects` to store an array of `{ name, profile }` objects alongside the existing `pet_appearance_profile` (which remains for backward compatibility as a combined block).

```sql
ALTER TABLE public.projects ADD COLUMN character_profiles jsonb DEFAULT '[]'::jsonb;
```

**`supabase/functions/build-appearance-profile/index.ts`**:
- Update the AI prompt to detect how many distinct subjects appear across the photos.
- Instruct the model to return a JSON array: `[{ "name": "descriptive_label", "profile": "..." }, ...]` -- one entry per subject.
- Parse the JSON response. Store the array in `character_profiles` and concatenate all profiles into `pet_appearance_profile` (so existing generate-story and generate-illustration code still works without breaking).
- Increase `max_completion_tokens` from 500 to 800 to accommodate multi-character output.
- Log how many characters were detected.

**`supabase/functions/generate-story/index.ts`**:
- In `buildSystemPrompt`, read `character_profiles` from the project row (already fetched with `select("*")`).
- If multiple profiles exist, build the CHARACTER APPEARANCE block listing each character separately with their label, so the story references all characters.

**`supabase/functions/generate-illustration/index.ts`**:
- Read `character_profiles` from the project (add it to the select query which currently only fetches `pet_name, pet_type, pet_breed, pet_appearance_profile`).
- If `character_profiles` has multiple entries, include ALL character descriptions in every illustration prompt so the illustrator draws all subjects on every page.

## Fix 2 -- Character Names Required Before Generation

### Problem
The fallback name "Your Story" is used throughout the book when the user never provides a name. The decision bubble tree goes format -> mood -> length -> context, but never explicitly asks for names.

### Solution

**`src/pages/PhotoRabbit.tsx`** -- Add a `"names"` tier to the decision bubble flow:

- After mood is selected (and before length or context), if the project name is still "New Project" or empty, Rabbit asks: "What should I call them?"
- New `decisionTier` value: `"names"`.
- Instead of bubbles, this tier shows nothing in `decisionBubbles` (clears them) and instead focuses the text input. Rabbit's message is: "One more thing -- what's their name? (If there are two, give me both.)"
- When the user types a name and hits send, the `sendChatMessage` path detects `decisionTier === "names"`, saves the name to the project, and advances to the next tier (length for picture_book, or context for others).
- This is NOT skippable. The input box is the only way forward.
- If `character_profiles` has 2+ entries, the prompt says: "I see two characters. What are their names?"
- After names are provided, update `pet_name` with the primary name and store both names in `character_profiles` (updating the `name` fields).

**`handleDecisionBubbleTap`** in the mood tier: After saving mood, check if name is still default. If so, insert the names tier before proceeding to length/context.

**`sendChatMessage`**: Add a branch: when `decisionTier === "names"`, parse the input for names (split on "and", comma, or treat as single name), save to project, update `character_profiles` name fields, then advance to the next decision tier.

## Fix 3 -- Page Text as Real Children's Book

### Problem
Text is too long (paragraph-length), font is too small (`text-base` / `text-xs`), and it sits in a heavy white bar separated from the illustration. Reads like captions, not a children's book.

### Solution

**`supabase/functions/generate-story/index.ts`** -- Tighten writing rules:
- Change rule 7 from "2-4 sentences per page" to "1-2 sentences per page. Maximum. No exceptions."
- Add rule: "Each sentence should be short enough for a 5-year-old to follow. Think Dr. Seuss: rhythm, repetition, warmth."
- Update the QUALITY EXAMPLE to show a 1-2 sentence version.

**`src/components/project/BookPageViewer.tsx`** -- Restyle the text overlay for story pages:
- Full-size mode: Change `text-base` to `text-lg` (larger, read-aloud friendly).
- Half/spread mode: Change `text-xs` to `text-sm`.
- Replace the heavy `bg-white/85 backdrop-blur-sm` bar with a lighter gradient: `bg-gradient-to-t from-white/90 via-white/70 to-transparent` so text floats closer to the illustration instead of sitting in a separate block.
- Reduce padding: `pt-4 pb-5 px-5` becomes `pt-6 pb-4 px-6` (more top gradient, less bottom padding).
- Remove `max-h-[35%]` constraint in half mode since text will be 1-2 sentences and won't need scrolling.
- Cover page text: keep `text-3xl` full / `text-sm` half (already appropriate for titles).

---

## Files Changed

| File | What Changes |
|------|-------------|
| `projects` table (migration) | Add `character_profiles` JSONB column |
| `build-appearance-profile/index.ts` | Multi-subject detection, JSON array output, store in `character_profiles` |
| `generate-story/index.ts` | Read `character_profiles`, list all characters in system prompt, enforce 1-2 sentence rule |
| `generate-illustration/index.ts` | Read `character_profiles`, include all characters in every prompt |
| `src/pages/PhotoRabbit.tsx` | Add "names" decision tier after mood, require name entry before generation |
| `src/components/project/BookPageViewer.tsx` | Larger font, gradient overlay instead of solid bar |

## What Does NOT Change
- Illustration generation model or quality
- The bubble system structure (format/mood/length/context still exists, names tier is inserted naturally)
- The generation pipeline order (story then illustrations)
- Photo upload, captioning, or interview chat flow
