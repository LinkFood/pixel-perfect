
# Fix: Dark-on-Light Text Panel — Matching the PDF Style

## The Problem

The PDF download uses a semi-transparent **white frosted bar** at the bottom with **dark near-black text** (`rgb(40,40,40)`). This is readable against any illustration.

The site preview, the in-app book preview dialog, and the shared book viewer all use the opposite: a **dark gradient** (`from-black/60`) with **white text**. On dark illustrations this works, but on the light-coloured watercolour art this app generates (pale skies, cream backgrounds, stadium lights) white text merges into the image — exactly what the screenshots show.

## The Fix — Match the PDF

Replace the dark gradient + white text with a frosted white panel + dark text in every rendering surface. The approach:

- **Replace**: `bg-gradient-to-t from-black/60 via-black/30 to-transparent` + `text-white`
- **With**: `bg-white/80 backdrop-blur-sm` (frosted semi-opaque white) + `text-foreground` (near-black)

This matches the PDF exactly — a soft white bar that sits below the illustration, keeping text crisp and readable against any image.

For the **cover page**, which intentionally uses bold display text, we use the same treatment but slightly taller to give the title room.

## Files to Change

### 1. `src/components/project/BookPageViewer.tsx`

Three locations:

**A — Story/closing pages** (lines 287–295): The standard story text overlay
```
// BEFORE
<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-12 pb-5 px-5">
  <p className="... text-white ...">

// AFTER
<div className="absolute bottom-0 left-0 right-0 bg-white/82 backdrop-blur-sm pt-4 pb-5 px-5">
  <p className="... text-foreground ...">
```

**B — Cover page** (lines 224–234): Cover title at bottom
```
// BEFORE
<div className="... bg-gradient-to-t from-black/60 via-black/30 to-transparent ...">
  <p className="... text-white ...">

// AFTER  
<div className="... bg-white/82 backdrop-blur-sm ...">
  <p className="... text-foreground ...">
```

**C — Empty text placeholder** (lines 297–302): The italic "Text will appear here" hint — change from `text-white/60` to `text-muted-foreground`

### 2. `src/components/project/BookPreview.tsx`

One location — story/cover text (lines 152–158):
```
// BEFORE
<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-10 pb-4 px-4">
  <p className="... text-white ...">

// AFTER
<div className="absolute bottom-0 left-0 right-0 bg-white/82 backdrop-blur-sm pt-4 pb-4 px-4">
  <p className="... text-foreground ...">
```

### 3. `src/pages/SharedBookViewer.tsx`

One location — story/cover text overlay (lines 529–535):
```
// BEFORE
<div className="absolute bottom-0 left-0 right-0 pt-10 pb-4 px-4 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
  <p className="... text-white ...">

// AFTER
<div className="absolute bottom-0 left-0 right-0 pt-4 pb-4 px-4 bg-white/82 backdrop-blur-sm">
  <p className="... text-foreground ...">
```

## Visual Comparison

The change for a standard story page:

```
BEFORE (dark gradient):                AFTER (frosted white bar, like PDF):
┌─────────────────────┐               ┌─────────────────────┐
│   [illustration]    │               │   [illustration]    │
│                     │               │                     │
│▓▓▓▒▒▒░░░░░░░░░░░░░░│               │                     │
│ white text here     │               ├─────────────────────┤
│                     │               │ [frosted white bar] │
└─────────────────────┘               │  dark text here     │
                                      └─────────────────────┘
```

The frosted bar has `backdrop-blur-sm` so it reads as glass — not a flat box. It's elegant and matches the PDF's white overlay rectangle exactly.

## What Does NOT Change

- Dedication pages — already use dark text (`text-foreground/80`) on a cream wash; no change needed
- Cover page top wash (hiding AI text artifacts) — stays as-is
- Gallery title and grid pages — already use dark text; no change needed
- The PDF generator — already correct; this is what we're matching

## Result

Every surface where text appears on illustrations — BookPageViewer (editor), BookPreview (in-app dialog), SharedBookViewer (share link) — will match the PDF: frosted white panel, dark readable text, consistent across the entire product.
