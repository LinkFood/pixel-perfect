
# Full Code Review — PhotoRabbit

## Where We Stand

The core pipeline is architecturally sound and impressive. The AI reads photos, builds context, runs an interview, and generates a full illustrated book. Most of it works. Here's the complete honest assessment.

---

## 1. Does the site read the pictures? YES — and here's exactly how.

The photo intelligence pipeline is fully built and working:

```text
User drops photos
  -> uploaded to Supabase storage ("pet-photos" bucket)
  -> describe-photo edge function fires for each photo (background, non-blocking)
     -> sends photo URL to Gemini 2.5 Flash vision model
     -> gets back structured JSON: scene_summary, setting, subject_type,
        activities, people_present, subject_mood, subject_appearance_notes,
        notable_details, potential_story_hooks
     -> stores caption + ai_analysis on project_photos table

User clicks "That's all my photos"
  -> build-appearance-profile edge function fires
     -> sends ALL photos (up to 10) to Gemini 2.5 Flash as multimodal input
     -> AI synthesizes a single detailed visual character description
        e.g. "Harlow is a golden retriever with..."
     -> stores pet_appearance_profile on projects table

Story generation
  -> generate-story uses the appearance profile in EVERY illustration prompt
  -> generate-illustration passes reference photos to Gemini 3 Pro image model
     so illustrations match the actual subject
```

The AI is genuinely reading pictures. The data is real. Your completed "Harlow" project has 13 pages, all illustrated, all with `has_illustration: true`. The pipeline works end-to-end.

---

## 2. How is the book made via chat?

```text
Interview chat (interview-chat edge function)
  -> receives: user messages, pet name, photo captions, photo_context_brief, mood
  -> photo_context_brief = compiled from ai_analysis of all photos
     (scene summaries, activities, moods, story hooks)
  -> the AI rabbit asks questions based on what it SEES in the photos
  -> user answers; responses saved to project_interview table

"Make my book" clicked
  -> generate-story edge function
     -> gets: appearance profile, full interview transcript, photo captions
     -> uses openai/gpt-5.2 to write 12 pages of story
     -> each page gets text_content + illustration_prompt
     -> illustration_prompt includes the FULL appearance profile
  -> generate-illustration fires for each page in batches of 3
     -> sends reference photos + appearance profile + scene prompt to Gemini 3 Pro
     -> generates watercolor illustration matching the real subject
     -> saves to storage, links to page

Result: a 12-page illustrated book grounded in real photos + interview context
```

This is genuinely working. It's not a template — the story IS being built from the photos and the chat.

---

## 3. The Share Link — Root Cause Found

**The share link is broken for a specific, fixable reason.**

Looking at the database: the completed "Harlow" project (`status: review`) has `share_token: nil`. The share token was never saved to the database.

Here is the bug chain:

### Bug A: The share URL is wrong

In `BookReview.tsx` line 390, the share URL being generated is:
```
https://[SUPABASE_URL]/functions/v1/share-page?token=abc123
```

But when a recipient clicks this link, the `share-page` edge function returns an HTML page that tries to redirect to:
```
https://pixel-perfect.lovable.app/book/abc123
```

This is the **preview URL** (`APP_URL = Deno.env.get("SITE_URL") || "https://pixel-perfect.lovable.app"`), not the published URL. If the app isn't published, or that URL changes, the share link goes nowhere useful.

### Bug B: The share URL itself isn't shareable

The share URL points to a Supabase edge function endpoint — not a real web page. When a recipient opens it in a browser, they get the redirect HTML. But:
- Social media crawlers won't follow the meta refresh
- The URL looks ugly (`...functions/v1/share-page?token=...`)
- It should redirect to `/book/:token` in the app

### Bug C: The share_token is not being saved

Database shows: `share_token: nil` on the Harlow project. This means either:
1. `create-share-link` is failing silently (the try/catch swallows errors)
2. The edge function is being called but the DB update isn't working
3. The function wasn't triggered

The `create-share-link` function code looks correct, but errors are silently swallowed in `handleGenerationComplete`.

### The correct share URL should be:
```
https://[APP_DOMAIN]/book/[share_token]
```
Not the edge function URL. The `SharedBookViewer` at `/book/:shareToken` already exists and calls `get-shared-book` to load the data. That is the correct destination.

---

## 4. Other Issues Found in Review

### Issue: "New Project" name in chat (partially fixed)
The `chatNamePending` flow was added. However, in the mood picker button handler (line 877), there's still a fallback:
```typescript
handleMoodSelect(mood, pendingPetName || project?.pet_name || "New Project");
```
If `pendingPetName` is empty AND `project?.pet_name` is "New Project" (the default from `useCreateMinimalProject`), the book gets named "New Project." The name capture flow helps, but the fallback chain should be verified.

### Issue: Preview illustration fires even on page return
`previewTriggeredRef` tracks by `activeProjectId`. If a user returns to an upload-phase project, the preview re-triggers because the ref is checked per project ID and cleared when switching. This is mostly okay, but could cause duplicate rabbit messages.

### Issue: `build-appearance-profile` is missing from `config.toml`
The `config.toml` does NOT have `[functions.build-appearance-profile]` listed with `verify_jwt = false`. This means JWT verification is applied to it. Since it's called from the backend (server-side with service role), this is fine — but if called from client-side `supabase.functions.invoke()`, the user's JWT is passed and it should work. Worth noting.

### Issue: `generate-preview-illustration` is missing from `config.toml`
Same — no JWT config for this function. It's called client-side in `PhotoRabbit.tsx` via `supabase.functions.invoke()`, so the user's auth token is sent. Since the function uses `SUPABASE_SERVICE_ROLE_KEY` internally, JWT verification at the gateway level could block unauthenticated calls. If a guest user (not signed in) tries the preview, it could fail.

---

## Plan of Fixes

### Fix 1 — Share Link (Critical)
The share URL needs to point to `/book/:shareToken` in the app, not to the edge function. This requires knowing the app's public URL.

**Option A (simplest):** Use `window.location.origin` on the client side to build the share URL:
```typescript
const url = `${window.location.origin}/book/${data.shareToken}`;
```
This always gives the correct domain regardless of environment.

**Option B:** Set a `SITE_URL` env variable in the edge function to the published URL.

Option A is better — it's dynamic and works in both preview and production.

**Also fix:** Add error surfacing in `handleGenerationComplete` so if `create-share-link` fails, we know why. Currently `catch { /* best effort */ }` silently swallows the error.

### Fix 2 — Add missing functions to config.toml
Add:
```toml
[functions.build-appearance-profile]
verify_jwt = false

[functions.generate-preview-illustration]
verify_jwt = false
```

### Fix 3 — Share link on existing completed projects
The Harlow project is already done but has no share_token. The share button in BookReview calls `create-share-link` on demand (when the user clicks Share), which WILL generate and save the token then. So this project CAN be shared — the user just needs to click the Share button. The token is generated lazily, which is correct behavior.

---

## Summary Table

| Area | Status | Notes |
|------|--------|-------|
| Photo reading (describe-photo) | Working | Gemini vision, structured JSON, per photo |
| Appearance profile | Working | Multimodal, synthesizes all photos |
| Chat context from photos | Working | photo_context_brief fed into interview-chat |
| Story generation | Working | GPT-5.2, uses full interview + appearance profile |
| Illustration generation | Working | Gemini 3 Pro, reference photos + appearance profile |
| Preview illustration | Working | Fires once when first caption arrives |
| Share link URL | Broken | Points to edge function, not app URL |
| Share token saving | Needs test | Token is saved lazily on Share button click |
| config.toml completeness | Minor gap | 2 functions missing verify_jwt = false |
| Name capture flow | Mostly working | Fallback still says "New Project" if user skips |

---

## What Needs to Be Built Still (Roadmap)

These are features mentioned in the product vision that are NOT yet implemented:

1. **Print ordering** — No Stripe integration, no print provider, no order flow
2. **HEIC/iPhone photo support** — HEIC files are filtered out with "unsupported format" fallback. iPhone users uploading directly may hit this.
3. **Account/auth for regular users** — Currently only dev-mode auto-sign-in. Real users have no way to create an account, log in, or recover their books.
4. **Email delivery** — No way to send the book link via email
5. **Mobile layout polish** — The workspace has a mobile sandbox collapsed state but the experience hasn't been fully tested on phones
6. **PDF print quality** — `generatePdf` uses jsPDF which is client-side. Print-quality output usually requires server-side rendering.
