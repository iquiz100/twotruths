// Classification rules for turning two people's answers to one question
// into a shared result. See README for the full decision matrix.

const REAL_YES = new Set(["YR", "OR"]);
const FANTASY_YES = new Set(["YF", "OF"]);
const EXCLUDING = new Set(["No", "Never"]);

/**
 * Returns "real", "fantasy", or null (no shared match / excluded).
 */
export function classify(codeA, codeB) {
  if (!codeA || !codeB) return null;
  if (EXCLUDING.has(codeA) || EXCLUDING.has(codeB)) return null;
  if (REAL_YES.has(codeA) && REAL_YES.has(codeB)) return "real";
  // Any other surviving combination involves at least one fantasy-tier pick.
  return "fantasy";
}

export function isHardLimit(code) {
  return code === "Never";
}
