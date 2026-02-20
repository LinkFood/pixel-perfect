/**
 * Quick-reply chip generator for the rabbit interview.
 * Pure function — no side effects, no API calls.
 * Returns 3–4 tappable reply strings for a given rabbit message,
 * or [] if the message isn't a question (wrap-up, affirmation, etc.)
 */

interface QuickReplyPattern {
  keywords: RegExp;
  replies: string[];
}

const PATTERNS: QuickReplyPattern[] = [
  {
    keywords: /\b(funny|ridiculous|hilarious|funniest|chaos|goofy|silly|weird)\b/i,
    replies: [
      "Total chaos agent 😂",
      "Always begging for attention",
      "The look they give me",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(miss|memorial|remember|gone|passed|losing|lost)\b/i,
    replies: [
      "Their silly little habits",
      "The way they'd greet me",
      "Quiet moments together",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(first|meet|found|rescue|adopt|beginning|start)\b/i,
    replies: [
      "Pure accident",
      "Love at first sight",
      "They found me actually",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(adventure|explore|bravest|brave|wild|fearless|escape)\b/i,
    replies: [
      "Into everything, fearless",
      "That one epic escape",
      "Every walk is a mission",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(personality|character|like them|like her|like him|describe|energy|soul|spirit)\b/i,
    replies: [
      "Total drama queen",
      "The most gentle soul",
      "One-of-a-kind energy",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(morning|routine|everyday|day|daily|habit|alarm|wake)\b/i,
    replies: [
      "Alarm clock, basically",
      "Chaos from the jump",
      "Pure chill until food time",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(photo|shot|picture|capture|image|favourite|favorite|best shot)\b/i,
    replies: [
      "Sunset on the back porch",
      "Their favourite nap spot",
      "Mid-zoomies action shot",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(memory|moment|bottl|keep forever|cherish|never forget|remember)\b/i,
    replies: [
      "The first day we met",
      "A quiet morning together",
      "A trip we took",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(special|unique|nobody|different|stand out|one thing|one word)\b/i,
    replies: [
      "The way they look at me",
      "Their weird little rituals",
      "Somehow always knows",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(bond|relationship|connect|mean to you|love about|feel about)\b/i,
    replies: [
      "They just get me",
      "My whole world, honestly",
      "Like they were made for me",
      "✍️ Tell my own story",
    ],
  },
  {
    keywords: /\b(name|call them|call her|call him|named)\b/i,
    replies: [
      "Named after a character",
      "It just suited them",
      "Long story, honestly",
      "✍️ Tell my own story",
    ],
  },
];

/**
 * Non-question signals — if the message contains these, return no chips.
 * These are wrap-up / affirmation messages where no reply chips are needed.
 */
const WRAP_UP_SIGNALS = /\b(I have everything|that'?s all I need|I'?ve got enough|perfect|let'?s make|making it now|watch this|I'?m going to paint|I'?m painting)\b/i;

/**
 * Whether the message ends with a question (contains a "?").
 * We only show chips when the rabbit is actually asking something.
 */
function containsQuestion(content: string): boolean {
  return content.includes("?");
}

/**
 * Returns quick-reply chip options for a given rabbit message.
 * @param content - The rabbit's full message text
 * @param petName - The subject's name (pet, person, etc.) — reserved for future personalisation
 * @param mood - The project mood — reserved for future mood-specific replies
 */
export function getQuickReplies(
  content: string,
  petName: string,
  mood: string | null | undefined
): string[] {
  if (!content) return [];

  // No chips on wrap-up messages
  if (WRAP_UP_SIGNALS.test(content)) return [];

  // Only show chips when the rabbit is asking a question
  if (!containsQuestion(content)) return [];

  // Match against patterns in priority order — first match wins
  for (const pattern of PATTERNS) {
    if (pattern.keywords.test(content)) {
      return pattern.replies;
    }
  }

  // Generic fallback for any question we didn't specifically match
  return [
    "So much to say...",
    "A little bit of everything",
    "Hard to pick just one",
    "✍️ Tell my own story",
  ];
}
