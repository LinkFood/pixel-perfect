

# Landing Page Redesign: Sell in 5 Seconds

## Overview

Replace the current HeroLanding component entirely. The new page has four sections stacked vertically: a full-width hero with a book spread, a visual 3-step walkthrough, a horizontal showcase of book covers, and a closing CTA. No feature lists, no icons, no pricing, no footer.

---

## Section 1 -- Hero (above the fold)

- Full-width section, vertically centered content
- The Rabbit character stays (small, ~80px, top-left or beside the headline -- it IS the brand)
- **Headline**: "Drop a photo. Get a storybook." in `font-display text-5xl md:text-6xl` bold
- **Subline**: "No writing. No design. Just your photos and a few taps." in `font-body text-lg text-muted-foreground`
- **CTA button**: "Make your first book -- it's free" -- large, coral gradient, pulsing glow (reuse existing pulse animation), triggers file picker on click
- **Background**: A showcase book spread displayed behind or beside the text -- use the existing `showcaseSpreads` data rendered as a faux open-book with the paper texture. Auto-rotates between the three spreads (The Great Sock Heist, Why Brad Can't Cook, Grandma's Garden) every 5 seconds with a cross-fade
- Drag-and-drop still works on the entire page (preserve existing `onDrop` behavior)
- "or drag photos anywhere" micro-text below button

## Section 2 -- Visual Walkthrough (show don't tell)

- Three columns (stacked on mobile), no icons
- Each "step" is a styled mockup card showing what the user would see:
  - **Step 1**: A photo dropping in with Rabbit's speech bubble saying a caption (e.g. "I see a golden retriever with a stolen sock..."). Label: "Drop a photo"
  - **Step 2**: Decision bubbles (format/mood) shown as tappable chips in a card mockup. Label: "Tap a vibe"
  - **Step 3**: A mini book spread (reuse paper texture + gradient). Label: "Get your book"
- Each card uses `glass-warm` background, `shadow-float`, `rounded-2xl`
- Cards animate in on scroll using framer-motion `whileInView`
- One short label under each card. No paragraphs.

## Section 3 -- Book Covers Showcase

- Horizontal scroll row of 4 book "covers"
- Each cover is a card with:
  - A gradient background (different per book -- amber, emerald, violet, rose)
  - The book title in `font-display` bold
  - A one-line excerpt in italic
  - Paper texture overlay
- Data from expanded `showcaseSpreads` array (add a 4th entry, e.g. "First Year of Luna")
- On desktop: all 4 visible side by side. On mobile: horizontal scroll with `scrollbar-hide`
- Slight tilt/rotation on each card (polaroid vibe) using `rotate-[-2deg]`, `rotate-[1deg]` etc.

## Section 4 -- Closing CTA

- Centered text: "Your photos already have a story. Let Rabbit find it."
- Same coral gradient CTA button: "Start now" -- triggers file picker
- Small Rabbit character below (celebrating state, ~60px)
- Dev mode button preserved (nearly invisible, bottom of page)

---

## Technical Details

### Files Changed

| File | Change |
|------|--------|
| `src/components/workspace/HeroLanding.tsx` | Full rewrite -- new 4-section layout |

### What Gets Removed
- Rotating speech bubble system (the rabbit lines ticker)
- Process strip with Camera/MessageCircle/BookOpen icons
- Social proof ticker (the "New book: ..." rotating text)
- The flipbook showcase in its current form (replaced by the hero background spread and the cover gallery)

### What Gets Preserved
- `HeroLandingProps` interface and `onPhotoDrop` callback
- File input + drag-and-drop handlers (identical logic)
- `forwardRef` pattern for the outer div
- Eye-tracking mouse handler
- RabbitCharacter import and usage
- Dev mode button at bottom
- All existing CSS utilities (`glass-warm`, `shadow-float`, `book-page-texture`, `pulse-glow`, `shadow-elevated`)
- `useIsMobile` hook usage

### Animation Approach
- Hero section: fade-in + slide-up on mount (existing pattern)
- Walkthrough cards: `whileInView` with staggered delays
- Book covers: subtle hover scale (`whileHover={{ scale: 1.03 }}`)
- Spread auto-rotation: `AnimatePresence mode="wait"` cross-fade (existing pattern)
- CTA buttons: pulsing `boxShadow` animation (existing pattern)

### No New Dependencies
Everything uses framer-motion (already installed), Tailwind utilities (already defined), and existing component imports.

