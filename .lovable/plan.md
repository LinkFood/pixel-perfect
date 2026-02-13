

# Fix Critical Bugs & Clean Up Design System Inconsistencies

## Summary

You've built a **Universal Creative Engine** — a beautiful workspace where users can drop photos of anything (pets, kids, couples, moments) and chat with Rabbit to create a personalized illustrated book. The design system overhaul is solid, but there are **3 critical bugs + 2 design inconsistencies** breaking the flow:

## Bugs Identified

### Bug #1: `/project` Route 404 (Workspace.tsx)
When a user deletes the active project, `handleDeleteProject` navigates to `/project`, which doesn't exist. Should navigate to `/` (home).

**Impact:** Users can't complete a deletion—they land on a 404 page.

### Bug #2: Landing Page Still Shows Removed Sections
The Landing.tsx still contains the testimonials and FAQ accordion that were supposed to be removed in the overhaul. The page should be clean: hero → How It Works → CTA.

**Impact:** Confuses the landing message and adds clutter.

### Bug #3: Hardcoded Hex Colors (Design System Break)
Despite the claim of "zero hardcoded hex colors," 45+ hex values remain across the codebase:
- `MoodPicker.tsx`: mood card colors (`#F59E0B`, `#EC4899`, `#3B82F6`, `#8B5CF6`)
- `RabbitCharacter.tsx`: SVG colors (body `#F5EDE4`, eyes `#2C2417`, nose `#D4956A`, etc. — this is OK, it's the rabbit SVG)
- `chart.tsx`: recharts color handling (acceptable, library-specific)

**Impact:** Mood picker uses hardcoded colors instead of Tailwind design tokens, making future brand updates harder.

## What Needs to Happen

### 1. Fix `/project` Route (Workspace.tsx)
Line 152: change `navigate("/project")` to `navigate("/")`

### 2. Clean Up Landing.tsx
Remove the testimonials section and FAQ accordion. Keep only:
- Hero section with "Drop photos. Get a book." headline
- How It Works section (3 steps)
- CTA button at the bottom

### 3. Replace Hardcoded Colors in MoodPicker.tsx
Instead of inline hex colors for mood cards, use Tailwind design tokens. Map each mood to a semantic color variable (e.g., `bg-amber-100`, `bg-rose-100`, etc.) that aligns with your coral/off-white palette.

## Why This Matters

**Consistency:** Your design system is the source of truth. Every color should come from Tailwind or CSS variables, not buried in component code.

**Future Updates:** If you ever want to rebrand (different palette, different moods), you change one place — not 50+ files.

**Flow:** Deleting a project should work smoothly. Navigating to a non-existent route breaks the user experience.

## Files to Edit

1. **src/components/workspace/Workspace.tsx** (1 line change)
2. **src/pages/Landing.tsx** (remove ~30 lines of testimonials/FAQ)
3. **src/components/workspace/MoodPicker.tsx** (replace hardcoded color hex values with Tailwind utilities)

## Test Plan

After fixes:
- Create a new project, delete it → should land on home `/`, not a 404
- Visit landing page → should see clean hero + How It Works + CTA, no testimonials
- Pick a mood in the Mood Picker → colors should match your brand palette
- Full flow: home → create project → mood picker → upload photos → interview → generation

