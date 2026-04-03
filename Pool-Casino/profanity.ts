// ---------------------------------------------------------------------------
// Profanity filter — no heavy dependencies, target <5ms per check
// ---------------------------------------------------------------------------

// ── Tiered word list ────────────────────────────────────────────────────────
// Keep this small and expandable. Severity is checked top-down (high first).
// "Stems" are collapsed-char forms — normalization reduces the input to the
// same form before matching.

export interface WordEntry {
  word: string;          // canonical stem after normalization
  severity: "high" | "medium" | "low";
}

export const bannedWords: WordEntry[] = [
  // HIGH — slurs / hate speech
  { word: "nigger",    severity: "high" },
  { word: "nigga",     severity: "high" },
  { word: "faggot",    severity: "high" },
  { word: "fag",       severity: "high" },
  { word: "chink",     severity: "high" },
  { word: "kike",      severity: "high" },
  { word: "spic",      severity: "high" },
  { word: "cunt",      severity: "high" },
  { word: "retard",    severity: "high" },

  // MEDIUM — strong profanity
  { word: "fuck",      severity: "medium" },
  { word: "shit",      severity: "medium" },
  { word: "bitch",     severity: "medium" },
  { word: "asshole",   severity: "medium" },
  { word: "bastard",   severity: "medium" },
  { word: "dick",      severity: "medium" },
  { word: "cock",      severity: "medium" },
  { word: "pussy",     severity: "medium" },
  { word: "piss",      severity: "medium" },
  { word: "whore",     severity: "medium" },
  { word: "slut",      severity: "medium" },
  { word: "ass",       severity: "medium" },
  { word: "rape",      severity: "medium" },

  // LOW — mild / borderline
  { word: "damn",      severity: "low" },
  { word: "hell",      severity: "low" },
  { word: "crap",      severity: "low" },
  { word: "idiot",     severity: "low" },
  { word: "stupid",    severity: "low" },
  { word: "moron",     severity: "low" },
];

// Pre-build a sorted set (high → medium → low) for fast iteration
const sortedWords = [...bannedWords].sort((a, b) => {
  const order = { high: 0, medium: 1, low: 2 };
  return order[a.severity] - order[b.severity];
});

// ── Normalization ────────────────────────────────────────────────────────────

const LEET_MAP: Record<string, string> = {
  "@": "a",
  "4": "a",
  "3": "e",
  "1": "i",
  "0": "o",
  "5": "s",
  "7": "t",
  "$": "s",
  "!": "i",
  "+": "t",
  "(": "c",
};

/**
 * Normalize text for comparison:
 *  1. Lowercase
 *  2. Expand leet-speak substitutions
 *  3. Strip all non-alphanumeric characters (removes spaces, punctuation, symbols)
 *  4. Collapse repeated consecutive characters ("heyyy" → "hey")
 */
export function normalizeText(input: string): string {
  let s = input.toLowerCase();

  // Leet-speak substitution (character by character)
  s = s.replace(/[@43105!7$(+]/g, (ch) => LEET_MAP[ch] ?? ch);

  // Remove all non-alphanumeric characters (handles spacing tricks & symbols)
  s = s.replace(/[^a-z0-9]/g, "");

  // Collapse runs of the same character: "fuuuck" → "fuk", "shiiit" → "shit"
  s = s.replace(/(.)\1+/g, "$1");

  return s;
}

// ── Detection ─────────────────────────────────────────────────────────────────

export interface ProfanityResult {
  clean: boolean;
  severity: "none" | "low" | "medium" | "high";
  matched: string[];
}

/**
 * Build a simple regex for a stem that tolerates:
 *  - repeated characters between letters (b+a+d+)
 *  - common leet substitutions via character classes
 * We match against the *normalized* string so most bypass attempts are
 * already neutralised; the regex adds a second layer for partial-word matches.
 */
function stemToRegex(stem: string): RegExp {
  // Allow one or more of each character in the stem (catches "fuuuck" remnants)
  const pattern = stem.split("").map((c) => `${escapeRe(c)}+`).join("");
  return new RegExp(pattern);
}

function escapeRe(c: string): string {
  return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check a piece of text for profanity.
 * Runs in <5 ms for typical chat messages.
 */
export function checkProfanity(input: string): ProfanityResult {
  const normalized = normalizeText(input);
  const matched: string[] = [];
  let topSeverity: "none" | "low" | "medium" | "high" = "none";

  const severityRank = { none: 0, low: 1, medium: 2, high: 3 };

  for (const entry of sortedWords) {
    const normalizedStem = normalizeText(entry.word);
    const re = stemToRegex(normalizedStem);

    if (re.test(normalized)) {
      matched.push(entry.word);
      if (severityRank[entry.severity] > severityRank[topSeverity]) {
        topSeverity = entry.severity;
      }
      // Short-circuit: we already found the worst possible severity
      if (topSeverity === "high") break;
    }
  }

  return {
    clean: matched.length === 0,
    severity: topSeverity,
    matched,
  };
}

// ── Censoring ────────────────────────────────────────────────────────────────

/**
 * Replace profane words with "***" while preserving sentence structure.
 * Works on the original (un-normalized) text by finding each word's natural
 * boundaries and replacing the raw token.
 */
export function censorText(input: string): string {
  const result = checkProfanity(input);
  if (result.clean) return input;

  let output = input;
  for (const word of result.matched) {
    // Build a leet-tolerant regex that still operates on the original string
    const laxPattern = word
      .split("")
      .map((c) => {
        const leet: Record<string, string> = {
          a: "[a@4]",
          e: "[e3]",
          i: "[i1!]",
          o: "[o0]",
          s: "[s5$]",
          t: "[t7+]",
          g: "[g9]",
        };
        return (leet[c] ?? escapeRe(c)) + "+";
      })
      .join("[^a-z0-9]*"); // allow symbols / spaces between chars
    const raw = new RegExp(laxPattern, "gi");
    output = output.replace(raw, "***");
  }
  return output;
}
