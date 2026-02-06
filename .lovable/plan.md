

# Full Codebase Audit: What Works, What's Missing, What's Broken

## The Photo Problem (Your Main Ask)

Right now when you upload photos, here's what happens:
- Photos get stored in cloud file storage -- that works
- Each photo has a `caption` field in the database -- ALL of them are null (empty)
- The interview AI receives zero information about your photos
- The story generator checks for photo captions, finds none, and ignores them entirely
- No AI ever "looks at" the photos using vision/image recognition

**What SHOULD happen:** When you upload photos, an AI vision model should automatically look at each photo, describe what it sees (e.g., "A golden retriever sleeping on a blue couch with a stuffed toy"), and save that description as the caption. Then:
- The interview AI gets those descriptions so it can ask you about specific photos ("I see a photo of Link on a couch with a toy -- tell me about that!")
- The story generator uses those visual descriptions to write scenes that match your actual photos

### Fix: Auto-Caption Photos with AI Vision

**New backend function: `describe-photo`**
- Triggered after each photo upload
- Sends the photo's public URL to a vision-capable AI model (Gemini 2.5 Flash -- fast, cheap, great at image description)
- Saves the AI-generated description as the photo's `caption` in the database
- Example output: "A golden retriever puppy lying in autumn leaves, looking up at the camera with bright eyes"

**Update: `interview-chat` edge function**
- Before starting the conversation, fetch all photo captions for the project
- Include them in the system prompt: "Here are descriptions of photos the owner uploaded: [captions]. Reference these naturally in your questions."
- The interviewer can now say things like "I see a photo of Link playing in the snow -- what was that day like?"

**Update: `generate-story` edge function**
- Already pulls captions but they're all null -- once auto-captioning works, this starts working automatically
- The story will reference real scenes from the photos

**Update: Upload flow (frontend)**
- After a photo uploads successfully, automatically call `describe-photo` in the background
- Show a small "AI analyzing..." indicator on each photo while it processes
- Once done, show the AI-generated caption below the photo (user can still edit it)

---

## Full Feature Audit: What Exists vs. What's Needed

### Working
- Landing page with hero, how-it-works, pricing, testimonials, footer
- Project creation (pet name, type, breed)
- Photo upload to cloud storage with grid display
- Photo favoriting, deletion, manual caption editing
- Interview chat with AI (with the recent windowing/wrap-up fixes)
- Story generation (24 pages with text + illustration prompts)
- Page-by-page review with text editing and approval
- Realtime progress bar during story generation
- Dev auto-fill for Link's interview data
- Dashboard showing all projects with status badges

### Missing / Not Yet Built
1. **Photo AI Vision** (described above) -- photos are stored but never analyzed
2. **Illustration Generation** -- the `project_illustrations` table exists in the database, and the story generator creates `illustration_prompt` for each page, but nothing actually generates images from those prompts yet
3. **User Authentication** -- no login/signup, no user accounts, no data separation between users. All database tables have no security policies. Anyone can see/edit everything.
4. **Payment / Checkout** -- the pricing page shows plans but there's no payment integration. No way to actually purchase a book.
5. **Book Export / Download** -- no way to export or download the finished book as a PDF or print-ready file
6. **Order Fulfillment** -- no print-on-demand integration to actually produce physical books

### Minor Gaps
- Photo sort/reorder (drag-and-drop) not implemented
- No way to regenerate individual pages (only full regeneration)
- No "back" navigation between steps (upload -> interview -> generating)
- Project deletion not available from the dashboard

---

## Recommended Priority Order

1. **Photo AI Vision** (this plan) -- makes the entire product dramatically better by giving the AI real visual context
2. **Illustration Generation** -- use the existing prompts to generate actual artwork for each page
3. **Authentication** -- needed before any real users touch this
4. **Payment** -- needed for launch

---

## Technical Details for Photo AI Vision Implementation

### New edge function: `supabase/functions/describe-photo/index.ts`
- Accepts `{ photoId, projectId }` in the request body
- Fetches the photo's public URL from storage
- Calls Gemini 2.5 Flash via the Lovable AI gateway with the image URL
- Prompt: "Describe this photo of a pet in 1-2 detailed sentences. Focus on the pet's appearance, expression, activity, setting, and any notable objects or people."
- Updates the `project_photos` row with the generated caption
- Returns the caption

### Update: `supabase/functions/interview-chat/index.ts`
- Add a new parameter: `photoCaptions` (array of strings)
- Append to the system prompt: "The owner has uploaded photos. Here are AI-generated descriptions of what's in them: [captions]. Reference specific photos naturally in your conversation to show you've seen them."

### Update: `src/hooks/usePhotos.ts`
- After successful upload, call `describe-photo` edge function
- Add a `captioning` state to track which photos are being processed
- Expose an `isCaptioning` flag per photo

### Update: `src/components/project/PhotoCard.tsx`
- Show a shimmer/loading state while AI caption is being generated
- Display the AI-generated caption (still editable by the user)

### Update: `src/pages/ProjectUpload.tsx`
- No major changes needed -- the photo grid already shows captions

### Update: `src/hooks/useInterview.ts`
- Before sending the first message, fetch all photo captions
- Pass them to the `interview-chat` edge function

### Update: `src/pages/ProjectInterview.tsx`
- Fetch photos with captions and pass to the chat hook
