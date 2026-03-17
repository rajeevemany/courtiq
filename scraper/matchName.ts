/**
 * Name matching algorithm
 *
 * Links junior_profiles.name (from tennisrecruiting.net) to RosterPlayer.full_name
 * (from Sidearm / WMT roster pages).
 *
 * Problem: TR stores names as "N. Kotzen" (initial + last) or occasionally
 * "Nicolas Kotzen" (full). Rosters always have full names. We need to match
 * them reliably even when:
 *   - Only an initial is available ("J." could be Jordan, Jagger, Jakub)
 *   - Last names are hyphenated ("J. Diaz-Barriga")
 *   - Names have diacritics ("M. García")
 *   - Suffixes are present ("J. Smith Jr.")
 *   - Multi-word first names ("Jung Hee You")
 *   - Same last name appears multiple times on a roster (Kotzen brothers)
 *
 * Confidence levels:
 *   'exact'     — full first + last match after normalization (score 100)
 *   'high'      — initial + last match, only one candidate (score 80)
 *   'ambiguous' — multiple candidates tied at top score (need manual review)
 *   'no_match'  — no roster player with matching last name + initial
 */

import type { RosterPlayer } from './scrapeRoster';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MatchConfidence = 'exact' | 'high' | 'ambiguous' | 'no_match';

export interface MatchResult {
  match: RosterPlayer | null;
  confidence: MatchConfidence;
  score: number;                    // 0–100
  candidates: MatchCandidate[];     // all plausible matches, sorted by score desc
}

export interface MatchCandidate {
  player: RosterPlayer;
  score: number;
  reason: string;                   // human-readable explanation
}

interface ParsedName {
  initial: string | null;           // first letter of first name, lowercased
  last: string;                     // normalized last name
  full_first: string | null;        // full first name if known, else null
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/**
 * Normalize a name string for comparison:
 *   - Strip diacritics (é→e, ü→u, ñ→n)
 *   - Lowercase
 *   - Collapse dots and whitespace to single space
 *   - Trim
 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')                   // decompose: é → e + ̈ combining char
    .replace(/[\u0300-\u036f]/g, '')    // strip combining diacritical marks
    .toLowerCase()
    .replace(/[.\s]+/g, ' ')           // dots + whitespace → single space
    .trim();
}

/**
 * Strip trailing name suffixes (Jr., Sr., III etc.) from a parts array.
 * Mutates the array in place and returns it.
 */
function stripSuffix(parts: string[]): string[] {
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAME PARSERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a tennisrecruiting.net name into { initial, last, full_first }.
 *
 * TR formats encountered in the wild:
 *   "N. Kotzen"           → initial='n', last='kotzen',         full_first=null
 *   "Nicolas Kotzen"      → initial='n', last='kotzen',         full_first='nicolas'
 *   "J. Diaz-Barriga"     → initial='j', last='diaz-barriga',   full_first=null
 *   "Jung Hee You"        → initial='j', last='you',            full_first='jung hee'
 *   "J. Smith Jr."        → initial='j', last='smith',          full_first=null
 *   "J. Van Der Berg"     → initial='j', last='van der berg',   full_first=null
 *
 * For "J. Van Der Berg": after normalization parts=['j','van','der','berg'].
 * First part is length-1 (initial), so everything after is the last name.
 * This is correct because TR writes Van Der Berg as the full surname.
 */
export function parseTRName(raw: string): ParsedName | null {
  const s = normalizeName(raw);
  const parts = stripSuffix(s.split(' '));
  if (parts.length === 0) return null;
  if (parts.length === 1) return { initial: null, last: parts[0], full_first: null };

  const firstPart = parts[0];
  const isInitial = firstPart.length === 1;

  if (isInitial) {
    // "n kotzen" or "j van der berg" — initial + last name (may be multi-word)
    return {
      initial: firstPart,
      last: parts.slice(1).join(' '),
      full_first: null,
    };
  } else {
    // Full name: last word is surname, everything before is first name
    return {
      initial: firstPart[0] ?? null,
      last: parts[parts.length - 1],
      full_first: parts.slice(0, -1).join(' '),
    };
  }
}

/**
 * Parse a roster player's full_name into { initial, last, full_first }.
 * Roster names are always full (never abbreviated).
 *
 * "Nicolas Kotzen"          → initial='n', last='kotzen',       full_first='nicolas'
 * "Jung Hee You"            → initial='j', last='you',          full_first='jung hee'
 * "John Smith Jr."          → initial='j', last='smith',        full_first='john'
 * "Thanaphat Boosarawongse" → initial='t', last='boosarawongse',full_first='thanaphat'
 * "Jan Van Der Berg"        → initial='j', last='van der berg', full_first='jan'
 *                             (only when trLast='van der berg' is passed as hint)
 *
 * @param trLast  Optional: normalized last name from the TR name being matched.
 *                When provided and multi-word, used to correctly split the
 *                roster name into first + last. Without this hint, "Jan Van Der Berg"
 *                would naively parse as first="jan van der", last="berg".
 */
export function parseRosterName(raw: string, trLast?: string): ParsedName | null {
  const s = normalizeName(raw);
  const parts = stripSuffix(s.split(' '));
  if (parts.length === 0) return null;
  if (parts.length === 1) return { initial: null, last: parts[0], full_first: null };

  // Multi-word last name hint: if the TR last name has spaces (e.g. "van der berg"),
  // try to align the roster name's tail against it.
  if (trLast && trLast.includes(' ')) {
    const trLastParts = trLast.split(' ');
    const n = trLastParts.length;
    if (parts.length > n) {
      const candidateLast = parts.slice(-n).join(' ');
      if (candidateLast === trLast) {
        const firstName = parts.slice(0, -n).join(' ');
        return {
          initial: firstName[0] ?? null,
          last: candidateLast,
          full_first: firstName,
        };
      }
    }
  }

  // Default: last word is the surname
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');

  return {
    initial: firstName[0] ?? null,
    last: lastName,
    full_first: firstName,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score how well a TR name matches a roster player name.
 * Returns 0 if they definitely don't match.
 *
 * Score table:
 *   100 — full first name + last name exact match after normalization
 *    90 — full first from TR matches full first on roster (same last)
 *    80 — initial from TR matches first letter of roster first name
 *     0 — last names differ, OR initials conflict
 */
function scoreMatch(trRaw: string, rosterRaw: string): { score: number; reason: string } {
  const tr = parseTRName(trRaw);
  const ro = parseRosterName(rosterRaw, tr?.last);

  if (!tr || !ro) return { score: 0, reason: 'parse_failed' };

  // Last name must match exactly (after normalization)
  if (tr.last !== ro.last) return { score: 0, reason: 'last_name_mismatch' };

  // Last names match — evaluate first name
  if (tr.full_first !== null && ro.full_first !== null) {
    if (tr.full_first === ro.full_first) {
      return { score: 100, reason: 'full_name_exact' };
    }
    // Full first names both known but differ — initial might still agree
    if (tr.initial === ro.initial) {
      return { score: 70, reason: 'full_first_mismatch_but_initial_match' };
    }
    return { score: 0, reason: 'full_first_conflict' };
  }

  // TR has initial only
  if (tr.initial !== null && ro.initial !== null) {
    if (tr.initial === ro.initial) {
      return { score: 80, reason: 'initial_match' };
    }
    return { score: 0, reason: 'initial_conflict' };
  }

  // Last name only available (no first info on one side)
  return { score: 40, reason: 'last_name_only' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the best matching roster player for a tennisrecruiting.net name.
 *
 * @param trName        - Name from junior_profiles.name, e.g. "N. Kotzen"
 * @param rosterPlayers - Full roster from scrapeRoster(), same school
 * @returns MatchResult with match, confidence, score, and all candidates
 *
 * Usage:
 *   const roster = await scrapeRoster('https://gocolumbialions.com/sports/mens-tennis');
 *   const result = matchName('N. Kotzen', roster.players);
 *   if (result.confidence === 'exact' || result.confidence === 'high') {
 *     // result.match is the player
 *   }
 */
export function matchName(trName: string, rosterPlayers: RosterPlayer[]): MatchResult {
  const candidates: MatchCandidate[] = rosterPlayers
    .map(player => {
      const { score, reason } = scoreMatch(trName, player.full_name);
      return { player, score, reason };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return { match: null, confidence: 'no_match', score: 0, candidates: [] };
  }

  const topScore = candidates[0].score;
  const topTied = candidates.filter(c => c.score === topScore);

  if (topScore === 100 && topTied.length === 1) {
    return { match: candidates[0].player, confidence: 'exact', score: topScore, candidates };
  }

  if (topTied.length === 1) {
    return { match: candidates[0].player, confidence: 'high', score: topScore, candidates };
  }

  // Multiple players with identical score — can't auto-resolve
  return { match: null, confidence: 'ambiguous', score: topScore, candidates: topTied };
}

/**
 * Batch match: given a list of TR names and a roster, return all results.
 * Useful for processing an entire year's commitments to one school.
 *
 * @param trNames       - Array of { id, name } from junior_profiles
 * @param rosterPlayers - Full roster from scrapeRoster()
 * @returns Array of { id, trName, ...MatchResult }
 */
export function batchMatchNames(
  trNames: Array<{ id: string; name: string }>,
  rosterPlayers: RosterPlayer[],
): Array<{ id: string; trName: string } & MatchResult> {
  return trNames.map(({ id, name }) => ({
    id,
    trName: name,
    ...matchName(name, rosterPlayers),
  }));
}

/**
 * Summarize match results for logging / admin review.
 */
export function summarizeMatches(
  results: Array<{ trName: string } & MatchResult>,
): {
  total: number;
  exact: number;
  high: number;
  ambiguous: number;
  no_match: number;
  ambiguous_cases: Array<{ trName: string; candidates: string[] }>;
  unmatched_names: string[];
} {
  const summary = {
    total:     results.length,
    exact:     0,
    high:      0,
    ambiguous: 0,
    no_match:  0,
    ambiguous_cases: [] as Array<{ trName: string; candidates: string[] }>,
    unmatched_names: [] as string[],
  };

  for (const r of results) {
    summary[r.confidence]++;
    if (r.confidence === 'ambiguous') {
      summary.ambiguous_cases.push({
        trName: r.trName,
        candidates: r.candidates.map(c => c.player.full_name),
      });
    }
    if (r.confidence === 'no_match') {
      summary.unmatched_names.push(r.trName);
    }
  }

  return summary;
}
