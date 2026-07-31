// Pet-name capture + title display helpers.
//
// Users answer "what should I call them?" with whole stories
// ("Link. He's a goofy dog who steals my phone"). pet_name should hold just
// the name(s); the full text belongs in the interview transcript.

const MAX_NAME_LENGTH = 40;

// Filler lead-ins users type before the actual name(s), case-insensitive.
const LEAD_INS: RegExp[] = [
  /^(?:hi|hey|ok(?:ay)?|so|well|um|uh|oh)[,!.\s]+/i,
  /^(?:his|her|their|its|the)\s+names?\s+(?:is|are|was|were)\s+/i,
  /^(?:my|our|the)\s+\w+(?:'s)?\s+names?\s+(?:is|are|was|were)\s+/i,
  /^(?:he|she|they|it)\s*(?:'s|'re|\s+is|\s+are|\s+was|\s+were)\s+(?:called|named)\s+/i,
  /^(?:the|my|our|this)\s+\w+\s+(?:is|are|was|were)\s+(?:called|named\s+)?/i,
  /^(?:this is|that's|meet|say hello to|introducing)\s+/i,
  /^call\s+(?:him|her|them|it)\s+/i,
  /^names?\s*(?:is|are|:)?\s+/i,
  /^(?:it's|he's|she's|they're)\s+/i,
];

/**
 * Extract just the name(s) from a free-text answer to the name question.
 * Keeps "Link and Luna" / "Link, Luna" intact; drops trailing story.
 */
export function extractPetName(raw: string): string {
  let text = raw.trim();

  // Strip filler lead-ins (repeat so "hey, his name is Link" fully unwinds)
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const re of LEAD_INS) {
      const next = text.replace(re, "");
      if (next !== text) {
        text = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Take text up to the first sentence-ending punctuation
  const end = text.search(/[.!?;\n]|\s[-—]\s/);
  if (end > 0) text = text.slice(0, end);

  // Drop a trailing pronoun clause: "Luna, and she is a sweet cat" → "Luna"
  const clauseCut = text.search(/,\s*(?:and\s+)?(?:she|he|they|it|who|which|that)\b/i);
  if (clauseCut > 0) text = text.slice(0, clauseCut);

  text = text.trim().replace(/[,\s]+$/, "");

  // Cap at ~40 chars, cutting on a word boundary
  if (text.length > MAX_NAME_LENGTH) {
    text = text.slice(0, MAX_NAME_LENGTH).replace(/\s+\S*$/, "").trim();
  }

  return text || raw.trim().slice(0, MAX_NAME_LENGTH).trim();
}

/**
 * Defensive display form of a stored pet_name. Existing projects may hold a
 * whole sentence — truncate at the first sentence boundary and cap length.
 */
export function displayPetName(petName?: string | null): string {
  if (!petName) return "Your Story";
  let text = petName.trim();
  const end = text.search(/[.!?;\n]/);
  if (end > 0) text = text.slice(0, end);
  text = text.trim().replace(/[,\s]+$/, "");
  if (text.length > MAX_NAME_LENGTH) {
    text = text.slice(0, MAX_NAME_LENGTH).replace(/\s+\S*$/, "").trim();
  }
  return text || "Your Story";
}

/**
 * Book title for headers, share sheets, and OG strings.
 * Prefers the cover page's text (the real title the story model wrote);
 * falls back to a sanitized "<Name>'s Book".
 */
export function bookTitle(coverText?: string | null, petName?: string | null): string {
  const cover = coverText?.trim();
  if (cover) return cover;
  return `${displayPetName(petName)}'s Book`;
}
