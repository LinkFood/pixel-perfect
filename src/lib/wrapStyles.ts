/**
 * Single source of truth for gift-wrap themes.
 * BookReview (the picker) and SharedBookViewer (the reveal) used to keep two
 * independent copies of this palette, which was guaranteed to drift.
 */
export interface WrapTheme {
  id: string;
  label: string;
  /** Swatch shown in the picker */
  swatch: string;
  /** Page styling applied in the shared viewer */
  bg: string;
  text: string;
  border: string;
}

export const WRAP_THEMES: WrapTheme[] = [
  {
    id: "classic",
    label: "Classic",
    swatch: "bg-orange-100 border-orange-300",
    bg: "bg-background",
    text: "text-foreground",
    border: "border-border",
  },
  {
    id: "gold",
    label: "Gold",
    swatch: "bg-amber-200 border-amber-400",
    bg: "bg-gradient-to-b from-amber-50 to-yellow-100",
    text: "text-amber-900",
    border: "border-amber-200",
  },
  {
    id: "midnight",
    label: "Midnight",
    swatch: "bg-indigo-900 border-indigo-600",
    bg: "bg-gradient-to-b from-indigo-950 to-slate-900",
    text: "text-slate-50",
    border: "border-indigo-700",
  },
  {
    id: "garden",
    label: "Garden",
    swatch: "bg-emerald-200 border-emerald-400",
    bg: "bg-gradient-to-b from-emerald-50 to-green-100",
    text: "text-emerald-900",
    border: "border-emerald-200",
  },
];

export const WRAP_THEME_MAP: Record<string, WrapTheme> = Object.fromEntries(
  WRAP_THEMES.map((t) => [t.id, t])
);

export const getWrapTheme = (id?: string | null): WrapTheme =>
  (id && WRAP_THEME_MAP[id]) || WRAP_THEME_MAP.classic;