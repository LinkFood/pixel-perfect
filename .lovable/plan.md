

# PetPage Studios -- Full Build with Best-in-Class AI

This is Link's book. No compromises on AI quality. Here's the complete build plan using Lovable as the host and the most powerful AI models available.

## AI Model Strategy -- Best Available for Each Task

| Task | Model | Why |
|------|-------|-----|
| **AI Interview** (conversational memory gathering) | `openai/gpt-5.2` | OpenAI's latest with enhanced reasoning. Best at emotionally intelligent conversation, following up naturally, reading between the lines of what someone shares about their pet. This is the heart of the product. |
| **Story Generation** (24-page children's book) | `openai/gpt-5.2` | Creative writing with structured output. Needs to weave real memories into a children's narrative with specific illustration prompts per page. Complex multi-step reasoning + creativity. |
| **Illustration Prompts Enhancement** | `google/gemini-2.5-pro` | Top-tier at visual + text reasoning. Takes the story's illustration prompts and enriches them with specific visual details, composition, lighting, color palette for maximum image generation quality. |
| **Image Generation** (pet illustrations) | Replicate FLUX.1 LoRA | Fine-tuned on YOUR pet's photos so illustrations actually look like Link. This requires an external API (not available through Lovable AI) -- we'll need a Replicate API key. |

All interview and story generation runs through **Lovable AI gateway** (no extra API keys needed). The `LOVABLE_API_KEY` is already configured.

For image generation via Replicate (LoRA fine-tuning + FLUX.1 generation), we'll need a **Replicate API key** -- I'll walk you through that when we get to that phase.

## Build Order -- What Gets Built and When

### Phase 1: Database + Storage Foundation
Set up all tables with permissive RLS (no auth yet, tighten later):
- `projects` -- pet name, type, breed, status pipeline tracking
- `project_photos` -- storage paths, captions, favorites, sort order
- `project_interview` -- conversation history (role + content)
- `project_pages` -- 24 pages with text, illustration prompts, approval status
- `project_illustrations` -- multiple options per page, selection tracking
- `project_ai_models` -- LoRA training status (for later)
- `orders` -- payment and fulfillment tracking (for later)
- Storage bucket: `pet-photos` for uploads

### Phase 2: Dashboard + New Project
- `/dashboard` -- project cards grid with status badges, empty state for first visit
- `/project/new` -- 3-field form (pet name, type, breed), creates project, redirects to upload
- Routes added to App.tsx, Navbar "Start Your Book" links to dashboard

### Phase 3: Photo Upload
- `/project/:id/upload` -- drag-and-drop upload zone with progress bars
- Photo grid with captions ("Add Memory"), favorites (star toggle), delete, reorder
- Client-side image compression before upload
- Threshold messages (under 5, 5-9, 10-19, 20+)
- "Continue to Interview" enabled at 5+ photos
- All uploads auto-save to storage immediately

### Phase 4: AI Interview (Core Differentiator)
- `/project/:id/interview` -- chat-style UI with warm design
- Edge function `interview-chat` powered by `openai/gpt-5.2` via Lovable AI
- System prompt from spec: warm empathetic interviewer drawing out real memories
- Loads full conversation history each call for context continuity
- Progress indicator, "Finish Interview" after 8+ user messages
- Rate limit: 50 messages per project
- All messages auto-saved, can leave and resume

### Phase 5: Story Generation
- Edge function `generate-story` powered by `openai/gpt-5.2` via Lovable AI
- Takes full interview transcript + pet details
- Generates 24 pages with text + detailed illustration prompts
- Structured output via tool calling (page_number, page_type, text_content, illustration_prompt, scene_description)
- Saves each page to `project_pages` table
- `/project/:id/generating` -- progress page with realtime updates via database subscriptions

### Phase 6: Book Review
- `/project/:id/review` -- page-by-page viewer with edit panel
- Editable text (auto-save with debounce), "Approve Page" checkboxes
- Page navigation with smooth transitions
- Progress bar: "X of 24 pages approved"
- Cover and dedication page editing
- "Approve All" when ready

### Phase 7 (Future): Image Generation with Replicate
- LoRA fine-tuning on pet photos (requires Replicate API key)
- FLUX.1 illustration generation per page (2-3 options each)
- Illustration selection in review page
- This phase requires the Replicate connector -- we'll set it up when ready

## What We're NOT Building Yet
- Authentication (hardcoded single user for now)
- Stripe payments
- Email notifications (Resend)
- PDF generation
- Admin panel
- Print order management

These all plug in cleanly later once the core product flow is solid.

## Technical Details

### New Files

**Pages:**
- `src/pages/Dashboard.tsx`
- `src/pages/ProjectNew.tsx`
- `src/pages/ProjectUpload.tsx`
- `src/pages/ProjectInterview.tsx`
- `src/pages/ProjectGenerating.tsx`
- `src/pages/ProjectReview.tsx`

**Components:**
- `src/components/project/PhotoGrid.tsx`
- `src/components/project/PhotoCard.tsx`
- `src/components/project/UploadZone.tsx`
- `src/components/project/ChatMessage.tsx`
- `src/components/project/InterviewChat.tsx`
- `src/components/project/BookPageViewer.tsx`
- `src/components/project/PageEditor.tsx`
- `src/components/project/ProjectStatusBadge.tsx`

**Hooks:**
- `src/hooks/useProject.ts`
- `src/hooks/usePhotos.ts`
- `src/hooks/useInterview.ts`

**Edge Functions:**
- `supabase/functions/interview-chat/index.ts` -- GPT-5.2 via Lovable AI, streaming SSE
- `supabase/functions/generate-story/index.ts` -- GPT-5.2 via Lovable AI, structured output via tool calling

### Design Consistency
All pages use existing warm cream palette, Playfair Display headings, DM Sans body, framer-motion animations, rounded-2xl cards with card-shadow styling.

### Realtime
`project_pages` table enabled for Supabase Realtime to power live generation progress updates.

