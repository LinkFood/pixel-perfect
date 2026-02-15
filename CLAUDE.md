# PhotoRabbit — Agent Playbook

## The Swarm Pattern

When the user says "send the swarm" or "let the agents loose" or similar — launch the full QA attack pattern:

1. **Attack agents** (4 parallel, Explore type, Opus model): Each owns a slice of the app and tries to break it. They read every line of their assigned files, then report issues rated CRITICAL / MODERATE / MINOR with exact file paths and line numbers.
2. **Oracle agent** (1, after attack agents report): Reviews all findings against the actual code. Filters false positives, re-ranks severity, and produces the final fix list.
3. **Fix phase**: Fix confirmed issues in priority order, build-check after each batch.

---

## Agent Definitions

### QA Attack Agent (x4, parallel)

**Type:** Explore | **Model:** Opus | **Run in background:** Yes

Each agent gets a slice of the app:
- **Interview flow**: PhotoRabbit.tsx, interview-chat/index.ts, useInterview.ts, ChatInput.tsx, ChatMessage.tsx, MoodPicker.tsx
- **Generation pipeline**: generate-story/index.ts, generate-illustrations/index.ts, generate-illustration/index.ts, GenerationView.tsx, WorkspaceSandbox.tsx (phase transitions)
- **Book review + PDF + share**: BookPageViewer.tsx, BookReview.tsx, generatePdf.ts, SharedBookViewer.tsx, index.css
- **Presentation layer**: WorkspaceSandbox.tsx (reveal, buttons), MoodPicker.tsx, ProjectShelf.tsx, ChatInput.tsx, PhotoUploadInline.tsx, ChatMessage.tsx

**Prompt template:**
```
You are a QA attack agent. Your job is to deeply understand [SLICE] in PhotoRabbit, then try to find every way it could break or produce a bad experience.

The app is at /Users/jameschellis/pixel-perfect.

PHASE 1: Read every file in your slice thoroughly. Understand the logic completely.

PHASE 2: Try to break it. Look for:
- Race conditions, state management bugs, missing error handling
- Missing imports or undefined references
- Edge cases with empty/null/undefined data
- Mobile responsiveness issues
- Stale state across navigation or project switches
- Double-click / rapid interaction bugs
- Network failure recovery
- Z-index conflicts, animation timing issues

Be specific. Give file paths, line numbers, and exact reproduction scenarios.
Rate each issue as CRITICAL (breaks the flow), MODERATE (bad UX), or MINOR (cosmetic/edge case).
```

---

### Oracle Agent

**Type:** Explore | **Model:** Opus | **When:** After all attack agents report back

**Purpose:** The oracle doesn't write code. It reads what the attack agents found, then reads the actual code to verify each finding. It challenges their logic, filters false positives, and produces a final ranked fix list.

**Prompt template:**
```
You are the Oracle — a verification agent that reviews QA findings from other agents.

You have received the following bug reports from 4 QA attack agents:

[PASTE ALL AGENT REPORTS HERE]

Your job:
1. For each CRITICAL and MODERATE issue, READ THE ACTUAL CODE at the file paths and line numbers cited.
2. Verify whether the bug is REAL or a FALSE POSITIVE. Agents sometimes:
   - Miss imports that exist in other files or are re-exported
   - Misunderstand React's state batching behavior
   - Flag theoretical issues that can't actually happen in the real flow
   - Confuse the intended design with a bug
   - Miss existing guard clauses or error handling elsewhere in the code
3. For each verified bug, confirm or adjust the severity rating.
4. For false positives, explain WHY the agent was wrong.
5. Produce a final VERIFIED FIX LIST ranked by priority:
   - CRITICAL (must fix now — crashes, data loss, money bugs)
   - MODERATE (fix soon — bad UX, degraded experience)
   - MINOR (fix later — cosmetic, edge cases)

Be ruthless about false positives. Only real bugs make the list.
Do NOT suggest fixes — just verify and rank. The fix phase comes after.
```

---

### Idea Machine

**Type:** idea-machine (built-in) | **When:** User is stuck, looking for inspiration, or says "what's next"

Already built into Claude Code. Generates creative ideas grounded in the actual codebase. Good for brainstorming polish items, features, and directions.

---

### Big Brother Code Guardian

**Type:** big-brother-code-guardian (built-in) | **When:** Significant code is being written or architectural decisions are being made

Already built into Claude Code. Reviews code changes against the project's core principles. Pushes back when something feels off.

---

### Core Logic

**Type:** core-logic (built-in) | **When:** Evaluating feature proposals, scoping work, deciding what to build

Already built into Claude Code. Reads the actual code, checks constraints, estimates real scope, ranks by impact vs effort.

---

### Core Logic Builder

**Type:** core-logic-builder (built-in) | **When:** A plan exists and needs faithful implementation without scope creep

Already built into Claude Code. Locks onto the original intent and builds exactly that.

---

## The Full Swarm Workflow

```
1. User: "send the swarm" / "try to break it" / "QA attack"
2. Launch 4 attack agents in parallel (background, Opus)
3. As each reports back, collect findings
4. After all 4 complete, launch Oracle agent with all findings
5. Oracle produces verified fix list
6. Fix criticals immediately, moderates next, minors if time allows
7. Build check after each fix batch
8. Commit and push
```

## Ground Rules (All Agents)

- **App already works well** — improving, not rebuilding
- **NO new APIs or external dependencies** — stick with current stack
- **Zero hardcoded hex colors** — all Tailwind utility classes
- **The chat NEVER leaves** — everything inline in persistent chat context
- **Do NOT unmount GenerationView** — use z-index overlays instead
- **Current stack is final:** Lovable AI Gateway, Supabase, GPT-5.2, Gemini 2.5 Flash, Gemini 3 Pro, jsPDF, React Query, ShadCN, Framer Motion, Tailwind
