
# No-Scroll Design: Full Viewport Lock Across the Entire App

## Overview

Every screen in the app will be locked to `100vh` with `overflow: hidden`. Content that currently scrolls will instead use carousels, pagination, or push-out behavior. This touches the landing page, the chat panel, the workspace sandbox, the book review panel, the generation view, the shared book viewer, and the photo upload grid.

---

## 1. Landing Page (HeroLanding.tsx)

**Current**: 4 stacked sections with `overflow-y-auto` on the root div, requiring scroll to see walkthrough, book covers, and closing CTA.

**Change**: Single full-viewport screen.
- Root div: `overflow-y-auto` becomes `overflow-hidden h-full`
- Remove sections 2, 3, and 4 as separate vertical blocks
- Restructure into a single viewport layout:
  - **Top**: Rabbit + headline + subline (compact, centered)
  - **Middle**: One content area that auto-rotates between two "slides":
    - Slide A: The 3-step walkthrough as a horizontal strip (3 cards side-by-side)
    - Slide B: Book covers carousel (4 covers with left/right arrow buttons or dot indicators)
  - Uses `AnimatePresence mode="wait"` to cross-fade between slides every 5 seconds, or dot/arrow click to switch manually
  - **Bottom**: CTA button pinned at the bottom of the viewport (not scrolled to -- always visible)
- Dev mode button moves inside the bottom CTA area (tiny, overlaid)
- The "or drag photos anywhere" text stays below CTA

## 2. Chat Panel (PhotoRabbit.tsx, line 1332)

**Current**: `flex-1 overflow-y-auto` on the chat scroll area. Messages accumulate and scroll.

**Change**: Keep `overflow-y-auto` but add `scrollbar-hide` class so there is no visible scrollbar. The chat area is already flex-1 within a `h-screen overflow-hidden` parent, so messages push older ones up naturally. The scroll container stays but becomes invisible scrolling -- the user sees the latest messages without a scrollbar. This is the standard chat pattern (iMessage behavior).

Actually, on reflection: the request says "no scroll" meaning the scroll wheel should not work either. So instead:
- Chat area gets `overflow-hidden` (not `overflow-y-auto`)
- Only show the **last N messages** that fit in the available space. Use a ref to measure the container height and calculate how many messages fit.
- When new messages arrive, older ones animate out the top (slide up and fade) while the new one slides in from the bottom.
- The container never scrolls. It's a fixed-height window showing the latest messages with push-out animation.

## 3. Workspace Sandbox (WorkspaceSandbox.tsx, line 149)

**Current**: `overflow-y-auto` on the root div.

**Change**: `overflow-hidden` on the root. Content within each phase already fits (upload zone, mood picker, generation view) or will be fixed by other changes below.

## 4. Photo Upload Grid (PhotoUploadInline.tsx, line 158)

**Current**: `max-h-[400px] overflow-y-auto` on the photo grid.

**Change**: Remove scroll. Show a fixed grid of photos (e.g., first 12 visible). If more than 12, show a "+N more" badge on the last cell. Users can click it to cycle pages (paginate through batches of 12). The upload zone stays compact above.

## 5. Book Review (BookReview.tsx, line 564)

**Current**: `overflow-y-auto` on the root div. The share bar, header, progress bar, spread viewer, editor panel, and dev report all stack vertically and scroll.

**Change**: `overflow-hidden` on the root. Restructure to a single viewport layout:
- **Top bar**: Compact header with back button, title, and action buttons (share, PDF, approve) -- single row
- **Middle**: The spread viewer (already paginated with Previous/Next -- this is correct)
- **Bottom**: The editor panel for the selected page -- compact, fixed at bottom
- Progress bar becomes a thin strip integrated into the top bar
- Remove `pb-16` and `mb-8` vertical spacers that forced scrolling
- The dev report (collapsible) opens as a modal/overlay instead of inline

## 6. Generation View (GenerationView.tsx, line 812)

**Current**: `overflow-y-auto` on the messages area.

**Change**: Same push-out pattern as the chat panel. Show last N messages that fit. Gallery of completed illustrations uses a horizontal carousel with arrows instead of horizontal scroll (`overflow-x-auto` becomes arrow-based navigation).

## 7. Shared Book Viewer (SharedBookViewer.tsx)

**Current**: Already uses spread-based navigation with Previous/Next arrows. However, check for any overflow containers.

**Change**: Ensure root is `h-screen overflow-hidden`. The viewer already paginates with arrows -- verify no scroll is present on the page level.

## 8. Mobile Sandbox (PhotoRabbit.tsx, line 1722)

**Current**: `max-h-[50vh] overflow-y-auto` on the sandbox section in mobile layout.

**Change**: `max-h-[50vh] overflow-hidden`. Content within must fit without scrolling (photo grid pagination handles this).

## 9. Global CSS (index.css)

Add a global rule to prevent any accidental scroll:
```css
html, body {
  overflow: hidden;
  height: 100%;
}
```

---

## Files Changed

| File | What Changes |
|------|-------------|
| `src/components/workspace/HeroLanding.tsx` | Single viewport layout with rotating content area + pinned CTA |
| `src/pages/PhotoRabbit.tsx` | Chat area overflow-hidden, message windowing (show last N), mobile sandbox overflow-hidden |
| `src/components/workspace/WorkspaceSandbox.tsx` | Root overflow-hidden |
| `src/components/workspace/PhotoUploadInline.tsx` | Paginated grid instead of scrollable grid |
| `src/components/project/BookReview.tsx` | Root overflow-hidden, compact single-viewport layout, dev report as overlay |
| `src/components/workspace/GenerationView.tsx` | Message push-out, illustration carousel with arrows |
| `src/pages/SharedBookViewer.tsx` | Verify/enforce h-screen overflow-hidden |
| `src/index.css` | Global html/body overflow:hidden |

## What Does NOT Change
- The chat bubble system, message content, or Rabbit behavior
- The book generation pipeline
- The spread-based navigation (already correct)
- The illustration quality or story generation
- Drag-and-drop photo upload functionality
- Any edge functions

## Technical Approach for Chat Message Windowing

The chat panel will use a "visible window" pattern:
1. A ref measures the container's available height
2. Messages render bottom-up, measuring each message's height
3. Only messages that fit in the container are rendered
4. When a new message arrives, the oldest visible message animates out (opacity 0, translateY -20px) while the new one animates in (opacity 0 to 1, translateY 10px to 0)
5. This creates the illusion of messages pushing up without any scrolling

For the landing page content area, the two "slides" (walkthrough strip and book cover carousel) will use simple state-based switching with `AnimatePresence`, reusing the existing cross-fade pattern from the spread auto-rotation.
