/**
 * Unified college roster scraper
 *
 * Usage:
 *   const players = await scrapeRoster('https://gocolumbialions.com/sports/mens-tennis');
 *   const players = await scrapeRoster('https://gostanford.com/sports/mens-tennis');
 *
 * Automatically detects Sidearm vs WMT platform and routes to the correct parser.
 * Returns a normalized RosterPlayer[] regardless of platform.
 */

import { parseSidearmRoster, isSidearmPage, type SidearmPlayer } from './parsers/sidearm';
import { parseWMTRoster, isWMTPage, type WMTPlayer } from './parsers/wmt';

export type Platform = 'sidearm' | 'wmt' | 'unknown';

export interface RosterPlayer {
  full_name: string;
  first_name: string;
  last_name: string;
  slug: string;
  profile_url: string;
  year_in_school: string;         // normalized: "Fr." | "So." | "Jr." | "Sr." | "Grad" | "RS Fr." | "RS So." etc.
  height: string | null;
  hometown: string | null;
  high_school: string | null;     // last school before college (Sidearm: "Last School", WMT: "High School")
  previous_school: string | null; // prior college for transfers (WMT only; Sidearm shows in last_school)
  major: string | null;           // WMT only
  platform: Platform;
}

export interface ScrapeResult {
  school_url: string;
  platform: Platform;
  players: RosterPlayer[];
  scraped_at: string;
}

/**
 * Detect which platform a roster page is running on.
 */
export function detectPlatform(html: string): Platform {
  if (isSidearmPage(html)) return 'sidearm';
  if (isWMTPage(html)) return 'wmt';
  return 'unknown';
}

/**
 * Normalize year_in_school strings to short abbreviations.
 * Sidearm uses abbreviations already; WMT uses full words.
 */
function normalizeYear(raw: string): string {
  const s = raw.trim();
  const map: Record<string, string> = {
    // WMT full words
    'Freshman':           'Fr.',
    'Sophomore':          'So.',
    'Junior':             'Jr.',
    'Senior':             'Sr.',
    'Graduate Student':   'Grad',
    'Graduate':           'Grad',
    'Redshirt Freshman':  'RS Fr.',
    'Redshirt Sophomore': 'RS So.',
    'Redshirt Junior':    'RS Jr.',
    'Redshirt Senior':    'RS Sr.',
    'Fifth-Year':         '5th Yr.',
    'Fifth Year':         '5th Yr.',
    // Sidearm abbreviations (pass through)
    'Fr.': 'Fr.', 'So.': 'So.', 'Jr.': 'Jr.', 'Sr.': 'Sr.',
    'FY':  'Fr.',  // Columbia uses "FY" for first-year
    'Grad': 'Grad',
    'RS Fr.': 'RS Fr.', 'RS So.': 'RS So.', 'RS Jr.': 'RS Jr.', 'RS Sr.': 'RS Sr.',
    'GS': 'Grad',
  };
  return map[s] ?? s;
}

/**
 * Split "Nicolas Kotzen" → { first: "Nicolas", last: "Kotzen" }
 * Handles suffixes (Jr., Sr., III) and hyphenated names.
 */
function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: '', last_name: parts[0] };
  const suffixes = new Set(['jr.', 'sr.', 'ii', 'iii', 'iv', 'v']);
  // Strip trailing suffix if present
  const last = parts[parts.length - 1];
  if (suffixes.has(last.toLowerCase())) {
    return {
      first_name: parts.slice(0, -2).join(' '),
      last_name:  parts.slice(-2).join(' '), // e.g. "Smith Jr."
    };
  }
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name:  parts[parts.length - 1],
  };
}

function normalizeSidearm(p: SidearmPlayer, platform: Platform): RosterPlayer {
  const { first_name, last_name } = splitName(p.full_name);
  return {
    full_name:        p.full_name,
    first_name,
    last_name,
    slug:             p.slug,
    profile_url:      p.profile_url,
    year_in_school:   normalizeYear(p.year_in_school),
    height:           p.height,
    hometown:         p.hometown,
    high_school:      p.last_school,    // Sidearm calls it "Last School"
    previous_school:  null,             // Sidearm doesn't distinguish HS vs prior college
    major:            null,
    platform,
  };
}

function normalizeWMT(p: WMTPlayer, platform: Platform): RosterPlayer {
  const { first_name, last_name } = splitName(p.full_name);
  return {
    full_name:        p.full_name,
    first_name,
    last_name,
    slug:             p.slug,
    profile_url:      p.profile_url,
    year_in_school:   normalizeYear(p.year_in_school),
    height:           p.height,
    hometown:         p.hometown,
    high_school:      p.high_school,
    previous_school:  p.previous_school,
    major:            p.major,
    platform,
  };
}

/**
 * Parse pre-fetched HTML into a ScrapeResult.
 * Used by both scrapeRoster() (fetch-based) and scrapeRosterWithPlaywright() (browser-based).
 */
export function buildScrapeResult(html: string, sportUrl: string): ScrapeResult {
  const platform = detectPlatform(html);
  let players: RosterPlayer[] = [];

  if (platform === 'sidearm') {
    const raw = parseSidearmRoster(html, sportUrl);
    players = raw.map(p => normalizeSidearm(p, platform));
  } else if (platform === 'wmt') {
    const raw = parseWMTRoster(html, sportUrl);
    players = raw.map(p => normalizeWMT(p, platform));
  } else {
    console.warn(`[buildScrapeResult] Unknown platform at ${sportUrl}`);
  }

  return {
    school_url:  sportUrl,
    platform,
    players,
    scraped_at:  new Date().toISOString(),
  };
}

/**
 * Fetch and parse a college tennis roster page.
 * @param sportUrl  Base sport URL, e.g. "https://gostanford.com/sports/mens-tennis"
 *                  The function appends /roster automatically.
 */
export async function scrapeRoster(sportUrl: string): Promise<ScrapeResult> {
  const rosterUrl = sportUrl.replace(/\/$/, '') + '/roster';

  const res = await fetch(rosterUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CourtIQ-Scraper/1.0)',
      'Accept': 'text/html',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${rosterUrl}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  return buildScrapeResult(html, sportUrl);
}
