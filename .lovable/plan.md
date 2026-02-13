

# Fix Plan: 4 Bugs from End-to-End Test

## 1. Hero Chat "Black Hole"
**Problem**: When a user types on the landing page (phase "home") while authenticated, `handleSend` adds the message to `chatMessages` but the chat panel only renders messages for `!user` or `phase === "interview" | "generating" | "review"`. Authenticated users on "home" phase see nothing.

**Fix** in `PhotoRabbit.tsx` (around line 532): Expand the condition to also render `chatMessages` when `phase === "home" || phase === "upload" || phase === "mood-picker"` for authenticated users. Also update `handleSend` (line 266) so that when `phase` is "home"/"upload"/"mood-picker", Rabbit responds with a casual line instead of silently dropping the message.

## 2. Incorrect "Back" Logic
**Problem**: `handleBackFromReview` (line 442-446) sets status to `generating`, which triggers the cinematic reveal animation. It should go to `interview` so the user can resume chatting.

**Fix**: Change `status: "generating"` to `status: "interview"` on line 444.

## 3. Layout Clipping (Hero Below Fold)
**Problem**: The Rabbit character (200px on desktop) plus the speech bubble, flipbook showcase, process strip, and CTA stack up to push content below the fold.

**Fix** in `HeroLanding.tsx`:
- Reduce desktop Rabbit size from 200 to 140
- Reduce top padding from `pt-6` to `pt-3` and vertical gaps from `gap-8` to `gap-5`
- Reduce speech bubble min-height from 52px to 40px

## 4. forwardRef Warnings
**Problem**: `AnimatePresence` tries to pass refs to `HeroLanding` and `ChatInput`, which are plain function components.

**Fix**: This is a known constraint from the memory notes -- adding `forwardRef` to these components causes crashes. The warnings are cosmetic and harmless. No code change needed; the warnings can be safely ignored.

---

## Technical Summary of Changes

| File | Change |
|------|--------|
| `src/pages/PhotoRabbit.tsx` line 444 | `"generating"` to `"interview"` |
| `src/pages/PhotoRabbit.tsx` lines 266-276 | Add home/upload/mood-picker chat responses for authenticated users |
| `src/pages/PhotoRabbit.tsx` lines 531-532 | Expand render condition to include home/upload/mood-picker phases |
| `src/components/workspace/HeroLanding.tsx` | Shrink Rabbit to 140px, tighten padding and gaps |

