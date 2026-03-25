/**
 * D1 college tennis school → roster URL mapping
 *
 * Maps the school names used by tennisrecruiting.net to their athletic
 * website roster base URLs. Platform detection (Sidearm vs WMT) is included
 * so callers know which parser to use.
 *
 * To add a school:
 *   1. Find the sport URL: e.g. https://gostanford.com/sports/mens-tennis
 *   2. Verify /roster loads and has player data
 *   3. Detect platform (check HTML for 'sidearm-wrapper' or 'wmt.digital')
 *   4. Add entry to SCHOOL_MAP
 *   5. Add any TR name variants to SCHOOL_ALIASES
 */

export type Platform = 'sidearm' | 'wmt';

export type RosterUrlPattern = 'standard' | 'season' | 'season_trailing' | 'year_only' | 'compact';

export interface SchoolEntry {
  canonical_name: string;
  roster_base: string;   // sport URL — scrapeRoster() will append /roster
  platform: Platform;
  conference: string;
  rosterUrlPattern?: RosterUrlPattern; // defaults to 'standard' if omitted
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY SCHOOL MAP  (canonical TR name → entry)
// ─────────────────────────────────────────────────────────────────────────────

export const SCHOOL_MAP: Record<string, SchoolEntry> = {

  // ── Ivy League ─────────────────────────────────────────────────────────────
  'Columbia': {
    canonical_name: 'Columbia',
    roster_base: 'https://gocolumbialions.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },
  'Cornell': {
    canonical_name: 'Cornell',
    roster_base: 'https://cornellbigred.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },
  'Dartmouth': {
    canonical_name: 'Dartmouth',
    roster_base: 'https://dartmouthsports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },
  'Harvard': {
    canonical_name: 'Harvard',
    roster_base: 'https://gocrimson.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },
  'Penn': {
    canonical_name: 'Penn',
    roster_base: 'https://pennathletics.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },
  'Princeton': {
    canonical_name: 'Princeton',
    roster_base: 'https://goprincetontigers.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },
  'Yale': {
    canonical_name: 'Yale',
    roster_base: 'https://yalebulldogs.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },
  'Brown': {
    canonical_name: 'Brown',
    roster_base: 'https://brownbears.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Ivy League',
  },

  // ── ACC ────────────────────────────────────────────────────────────────────
  'Duke': {
    canonical_name: 'Duke',
    roster_base: 'https://goduke.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'North Carolina': {
    canonical_name: 'North Carolina',
    roster_base: 'https://goheels.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Virginia': {
    canonical_name: 'Virginia',
    roster_base: 'https://virginiasports.com/sports/mten',
    platform: 'sidearm',
    conference: 'ACC',
    rosterUrlPattern: 'season',
  },
  'NC State': {
    canonical_name: 'NC State',
    roster_base: 'https://gopack.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Wake Forest': {
    canonical_name: 'Wake Forest',
    roster_base: 'https://godeacs.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Notre Dame': {
    canonical_name: 'Notre Dame',
    roster_base: 'https://fightingirish.com/sports/mten',
    platform: 'sidearm',
    conference: 'ACC',
    rosterUrlPattern: 'compact',
  },
  'Florida State': {
    canonical_name: 'Florida State',
    roster_base: 'https://seminoles.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Clemson': {
    canonical_name: 'Clemson',
    roster_base: 'https://clemsontigers.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
    rosterUrlPattern: 'year_only',
  },
  'Georgia Tech': {
    canonical_name: 'Georgia Tech',
    roster_base: 'https://ramblinwreck.com/sports/m-tennis',
    platform: 'sidearm',
    conference: 'ACC',
    rosterUrlPattern: 'season_trailing',
  },
  'Louisville': {
    canonical_name: 'Louisville',
    roster_base: 'https://gocards.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Miami (FL)': {
    canonical_name: 'Miami (FL)',
    roster_base: 'https://miamihurricanes.com/sports/mten',
    platform: 'sidearm',
    conference: 'ACC',
    rosterUrlPattern: 'season_trailing',
  },
  'Pittsburgh': {
    canonical_name: 'Pittsburgh',
    roster_base: 'https://pittsburghpanthers.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Syracuse': {
    canonical_name: 'Syracuse',
    roster_base: 'https://cuse.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Boston College': {
    canonical_name: 'Boston College',
    roster_base: 'https://bceagles.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
  },
  'Virginia Tech': {
    canonical_name: 'Virginia Tech',
    roster_base: 'https://hokiesports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'ACC',
    rosterUrlPattern: 'season',
  },

  // ── SEC ────────────────────────────────────────────────────────────────────
  'Florida': {
    canonical_name: 'Florida',
    roster_base: 'https://floridagators.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },
  'Georgia': {
    canonical_name: 'Georgia',
    roster_base: 'https://georgiadogs.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },
  'Tennessee': {
    canonical_name: 'Tennessee',
    roster_base: 'https://utsports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },
  'Alabama': {
    canonical_name: 'Alabama',
    roster_base: 'https://rolltide.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },
  'Kentucky': {
    canonical_name: 'Kentucky',
    roster_base: 'https://ukathletics.com/sports/mten',
    platform: 'sidearm',
    conference: 'SEC',
    rosterUrlPattern: 'season_trailing',
  },
  'LSU': {
    canonical_name: 'LSU',
    roster_base: 'https://lsusports.net/sports/mt',
    platform: 'sidearm',
    conference: 'SEC',
    rosterUrlPattern: 'season_trailing',
  },
  'Ole Miss': {
    canonical_name: 'Ole Miss',
    roster_base: 'https://olemisssports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },
  'Mississippi State': {
    canonical_name: 'Mississippi State',
    roster_base: 'https://hailstate.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },
  'Vanderbilt': {
    canonical_name: 'Vanderbilt',
    roster_base: 'https://vucommodores.com/sports/mten',
    platform: 'sidearm',
    conference: 'SEC',
    rosterUrlPattern: 'season_trailing',
  },
  'South Carolina': {
    canonical_name: 'South Carolina',
    roster_base: 'https://gamecocksonline.com/sports/mten',
    platform: 'sidearm',
    conference: 'SEC',
    rosterUrlPattern: 'season_trailing',
  },
  'Arkansas': {
    canonical_name: 'Arkansas',
    roster_base: 'https://arkansasrazorbacks.com/sport/m-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },
  'Auburn': {
    canonical_name: 'Auburn',
    roster_base: 'https://auburntigers.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
    rosterUrlPattern: 'season',
  },
  'Texas A&M': {
    canonical_name: 'Texas A&M',
    roster_base: 'https://12thman.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'SEC',
  },

  // ── Big 12 ─────────────────────────────────────────────────────────────────
  'Texas': {
    canonical_name: 'Texas',
    roster_base: 'https://texassports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big 12',
  },
  'Oklahoma': {
    canonical_name: 'Oklahoma',
    roster_base: 'https://soonersports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big 12',
  },
  'TCU': {
    canonical_name: 'TCU',
    roster_base: 'https://gofrogs.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big 12',
  },
  'Baylor': {
    canonical_name: 'Baylor',
    roster_base: 'https://baylorbears.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big 12',
  },
  'Kansas': {
    canonical_name: 'Kansas',
    roster_base: 'https://kuathletics.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big 12',
  },
  'Iowa State': {
    canonical_name: 'Iowa State',
    roster_base: 'https://cyclones.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big 12',
  },

  // ── Big Ten ────────────────────────────────────────────────────────────────
  'Michigan': {
    canonical_name: 'Michigan',
    roster_base: 'https://mgoblue.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },
  'Illinois': {
    canonical_name: 'Illinois',
    roster_base: 'https://fightingillini.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },
  'Ohio State': {
    canonical_name: 'Ohio State',
    roster_base: 'https://ohiostatebuckeyes.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },
  'Northwestern': {
    canonical_name: 'Northwestern',
    roster_base: 'https://nusports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },
  'Minnesota': {
    canonical_name: 'Minnesota',
    roster_base: 'https://gophersports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },
  'Indiana': {
    canonical_name: 'Indiana',
    roster_base: 'https://iuhoosiers.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },
  'Michigan State': {
    canonical_name: 'Michigan State',
    roster_base: 'https://msuspartans.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },
  'Wisconsin': {
    canonical_name: 'Wisconsin',
    roster_base: 'https://uwbadgers.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big Ten',
  },

  // ── Pac-12 / West ──────────────────────────────────────────────────────────
  'Stanford': {
    canonical_name: 'Stanford',
    roster_base: 'https://gostanford.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'California': {
    canonical_name: 'California',
    roster_base: 'https://calbears.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'UCLA': {
    canonical_name: 'UCLA',
    roster_base: 'https://uclabruins.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'USC': {
    canonical_name: 'USC',
    roster_base: 'https://usctrojans.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'Washington': {
    canonical_name: 'Washington',
    roster_base: 'https://gohuskies.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'Arizona': {
    canonical_name: 'Arizona',
    roster_base: 'https://arizonawildcats.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'Arizona State': {
    canonical_name: 'Arizona State',
    roster_base: 'https://thesundevils.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'Oregon': {
    canonical_name: 'Oregon',
    roster_base: 'https://goducks.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },
  'Utah': {
    canonical_name: 'Utah',
    roster_base: 'https://utahutes.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Pac-12',
  },

  // ── WCC ────────────────────────────────────────────────────────────────────
  'Pepperdine': {
    canonical_name: 'Pepperdine',
    roster_base: 'https://pepperdinewaves.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'WCC',
  },
  'BYU': {
    canonical_name: 'BYU',
    roster_base: 'https://byucougars.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'WCC',
  },
  'San Diego': {
    canonical_name: 'San Diego',
    roster_base: 'https://usdtoreros.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'WCC',
  },
  "Saint Mary's": {
    canonical_name: "Saint Mary's",
    roster_base: 'https://smcgaels.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'WCC',
  },

  // ── AAC ────────────────────────────────────────────────────────────────────
  'Tulsa': {
    canonical_name: 'Tulsa',
    roster_base: 'https://tulsahurricane.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'AAC',
  },
  'Memphis': {
    canonical_name: 'Memphis',
    roster_base: 'https://gotigersgo.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'AAC',
  },
  'UCF': {
    canonical_name: 'UCF',
    roster_base: 'https://ucfknights.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'AAC',
  },

  // ── A-10 / Atlantic 10 ─────────────────────────────────────────────────────
  'Virginia Commonwealth': {
    canonical_name: 'Virginia Commonwealth',
    roster_base: 'https://vcuathletics.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'A-10',
  },
  'Richmond': {
    canonical_name: 'Richmond',
    roster_base: 'https://richmondspiders.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'A-10',
  },

  // ── Big West ───────────────────────────────────────────────────────────────
  'UC Santa Barbara': {
    canonical_name: 'UC Santa Barbara',
    roster_base: 'https://ucsbgauchos.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big West',
  },
  'UC Irvine': {
    canonical_name: 'UC Irvine',
    roster_base: 'https://ucirvinesports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Big West',
  },

  // ── Independents ───────────────────────────────────────────────────────────
  'Army': {
    canonical_name: 'Army',
    roster_base: 'https://goarmywestpoint.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Patriot League',
  },
  'Navy': {
    canonical_name: 'Navy',
    roster_base: 'https://navysports.com/sports/mens-tennis',
    platform: 'sidearm',
    conference: 'Patriot League',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ALIASES  (TR variant → canonical key)
// ─────────────────────────────────────────────────────────────────────────────

export const SCHOOL_ALIASES: Record<string, string> = {
  // Ivy
  'UPenn':             'Penn',
  'U Penn':            'Penn',
  'University of Pennsylvania': 'Penn',

  // ACC
  'UNC':               'North Carolina',
  'U. North Carolina': 'North Carolina',
  'UVA':               'Virginia',
  'U. Virginia':       'Virginia',
  'GT':                'Georgia Tech',
  'NC St.':            'NC State',
  'N.C. State':        'NC State',
  'Miami':             'Miami (FL)',
  'Pitt':              'Pittsburgh',

  // SEC
  'UF':                'Florida',
  'UGA':               'Georgia',
  'UK':                'Kentucky',
  'UT':                'Tennessee',
  'A&M':               'Texas A&M',
  'Miss. State':       'Mississippi State',
  'Mississippi St.':   'Mississippi State',

  // Big 12
  'OU':                'Oklahoma',
  'UT Austin':         'Texas',
  'U. Texas':          'Texas',

  // Big Ten
  'U. Michigan':       'Michigan',
  'U. Illinois':       'Illinois',
  'OSU':               'Ohio State',
  'UMN':               'Minnesota',
  'IU':                'Indiana',

  // Pac-12
  'Cal':               'California',
  'UC Berkeley':       'California',
  'U. Washington':     'Washington',
  'UW':                'Washington',
  'ASU':               'Arizona State',
  'U. Arizona':        'Arizona',

  // WCC
  "St. Mary's":        "Saint Mary's",
  'USD':               'San Diego',

  // AAC
  'U. Central Florida': 'UCF',

  // Other
  'VCU':               'Virginia Commonwealth',
  'UCSB':              'UC Santa Barbara',
  'UCI':               'UC Irvine',
};

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up a school by the name TR uses in junior_profiles.committed_school.
 * Tries 4 levels: exact → alias → case-insensitive → alias case-insensitive.
 */
export function lookupSchool(committedSchool: string): SchoolEntry | null {
  const s = committedSchool.trim();

  // 1. Exact match
  if (SCHOOL_MAP[s]) return SCHOOL_MAP[s];

  // 2. Alias exact match
  const aliasKey = SCHOOL_ALIASES[s];
  if (aliasKey && SCHOOL_MAP[aliasKey]) return SCHOOL_MAP[aliasKey];

  // 3. Case-insensitive map scan
  const lower = s.toLowerCase();
  for (const [key, entry] of Object.entries(SCHOOL_MAP)) {
    if (key.toLowerCase() === lower) return entry;
  }

  // 4. Case-insensitive alias scan
  for (const [aliasFrom, aliasTo] of Object.entries(SCHOOL_ALIASES)) {
    if (aliasFrom.toLowerCase() === lower && SCHOOL_MAP[aliasTo]) {
      return SCHOOL_MAP[aliasTo];
    }
  }

  return null;
}

/** Return all schools grouped by conference. */
export function schoolsByConference(): Record<string, SchoolEntry[]> {
  const result: Record<string, SchoolEntry[]> = {};
  for (const entry of Object.values(SCHOOL_MAP)) {
    (result[entry.conference] ??= []).push(entry);
  }
  return result;
}

/** Return all canonical school names in alphabetical order. */
export function verifiedSchools(): string[] {
  return Object.keys(SCHOOL_MAP).sort();
}
