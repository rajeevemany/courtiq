/**
 * Career stats extractor
 *
 * Fetches a player's bio page (Sidearm or WMT) and parses their career
 * singles + doubles win-loss records by season.
 *
 * Sidearm format (table-based):
 *   CAREER RECORDS section → tabular rows like:
 *   "2022-23: 18-7 Overall, 15-4 Dual (Singles), 12-9 Overall (Doubles)"
 *
 * WMT format (prose-based):
 *   Season blocks separated by class-year headings (Junior, Sophomore, etc.)
 *   "17-8 record in singles play", "ranked No. 56", "ranked as high as No. 49"
 */

import * as cheerio from 'cheerio';
import { isSidearmPage } from './parsers/sidearm';
import { isWMTPage } from './parsers/wmt';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SeasonStats {
  season: string;           // e.g. "2022-23"
  singles_overall: string | null;   // "18-7"
  singles_dual: string | null;      // "15-4"
  doubles_overall: string | null;   // "12-9"
  doubles_dual: string | null;      // null for WMT (not always broken out)
  ita_rank_end: number | null;      // ITA singles ranking at season end
  ita_rank_peak: number | null;     // highest ITA singles ranking that season
}

export interface CareerStats {
  source_url: string;
  platform: 'sidearm' | 'wmt' | 'unknown';
  seasons: SeasonStats[];
  career_singles_overall: string | null;  // cumulative W-L
  career_singles_dual: string | null;
  career_doubles_overall: string | null;
  career_doubles_dual: string | null;
  ita_rank_peak_career: number | null;    // best rank across all seasons
  honors: {
    national: string[];
    regional: string[];
    conference: string[];
    team: string[];
  } | null;
  career_summary: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEARM PARSER
// ─────────────────────────────────────────────────────────────────────────────

const SIDEARM_SEASON_STRONG_RE = /<strong>(\d{4}-\d{2})[:\s]*<\/strong>\s*([^<]+)/gi;

const SIDEARM_TOTALS_RE =
  /Overall:\s*(\d+)-(\d+)\s+Overall,\s+(\d+)-(\d+)\s+Dual\s*\(Singles\),\s+(\d+)-(\d+)\s+Overall\s*\(Doubles\)/i;

const SIDEARM_RANK_RE = /ITA[^:]*?:\s*(?:No\.|#)\s*(\d+)/gi;

/**
 * Parse stats content string like:
 *   "7-3 Overall, 0-0 Dual (Singles), 7-1 Overall (Doubles)"
 * Returns { singles_overall, singles_dual, doubles_overall }
 */
function parseSidearmSeasonContent(content: string): {
  singles_overall: string | null;
  singles_dual: string | null;
  doubles_overall: string | null;
} {
  content = content.replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ').trim();
  // Singles overall: first X-Y before "Overall" (not followed by "(Doubles)")
  const singlesOverallM = content.match(/(\d+-\d+)\s+Overall(?!\s*\(Doubles\))/i);
  // Singles dual: X-Y before "Dual"
  const singlesDualM = content.match(/(\d+-\d+)\s+Dual/i);
  // Doubles overall: X-Y before "Overall (Doubles)"
  const doublesOverallM = content.match(/(\d+-\d+)\s+Overall\s*\(Doubles\)/i);

  return {
    singles_overall: singlesOverallM ? singlesOverallM[1] : null,
    singles_dual:    singlesDualM    ? singlesDualM[1]    : null,
    doubles_overall: doublesOverallM ? doublesOverallM[1] : null,
  };
}

export function parseSidearmBio(html: string, sourceUrl: string): CareerStats {
  const seasons: SeasonStats[] = [];

  // Find the CAREER RECORDS section and extract up to the next </div>
  const careerRecordsIdx = html.search(/CAREER RECORDS/i);
  const searchHtml = careerRecordsIdx !== -1
    ? html.slice(careerRecordsIdx, html.indexOf('</div>', careerRecordsIdx) + 6)
    : html;

  // Parse each <strong>YYYY-YY:</strong> season line
  let m: RegExpExecArray | null;
  SIDEARM_SEASON_STRONG_RE.lastIndex = 0;
  while ((m = SIDEARM_SEASON_STRONG_RE.exec(searchHtml)) !== null) {
    const season = m[1];
    const content = m[2].trim();
    const { singles_overall, singles_dual, doubles_overall } = parseSidearmSeasonContent(content);
    seasons.push({
      season,
      singles_overall,
      singles_dual,
      doubles_overall,
      doubles_dual:  null,
      ita_rank_end:  null,
      ita_rank_peak: null,
    });
  }

  // Fallback: parse an HTML table with columns YEAR | SINGLES | DOUBLES | OVERALL
  if (seasons.length === 0) {
    const $ = cheerio.load(html);
    $('table tbody tr').each((_i, row) => {
      const cells = $(row).find('td').toArray().map(td => $(td).text().trim());
      if (cells.length < 2) return;
      const yearCell = cells[0];
      if (!/\d{4}-\d{2}/.test(yearCell)) return; // skip header/non-season rows
      const season        = yearCell.match(/(\d{4}-\d{2})/)![1];
      const singlesRecord = cells[1] && /^\d+-\d+$/.test(cells[1]) ? cells[1] : null;
      const doublesRecord = cells[2] && /^\d+-\d+$/.test(cells[2]) ? cells[2] : null;
      const overallRecord = cells[3] && /^\d+-\d+$/.test(cells[3]) ? cells[3] : null;
      seasons.push({
        season,
        singles_overall: singlesRecord,
        singles_dual:    overallRecord,   // column 3 (OVERALL) treated as singles_dual
        doubles_overall: doublesRecord,
        doubles_dual:    null,
        ita_rank_end:    null,
        ita_rank_peak:   null,
      });
    });
  }

  // Parse ITA ranks from full HTML (stripped)
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const rankMatches: number[] = [];
  SIDEARM_RANK_RE.lastIndex = 0;
  while ((m = SIDEARM_RANK_RE.exec(text)) !== null) {
    rankMatches.push(parseInt(m[1], 10));
  }
  const peakCareer = rankMatches.length > 0 ? Math.min(...rankMatches) : null;

  // Parse "Overall:" career totals line
  const totals = SIDEARM_TOTALS_RE.exec(text);
  const careerSinglesOverall = totals ? `${totals[1]}-${totals[2]}` : null;
  const careerSinglesDual    = totals ? `${totals[3]}-${totals[4]}` : null;
  const careerDoublesOverall = totals ? `${totals[5]}-${totals[6]}` : null;

  return {
    source_url:             sourceUrl,
    platform:               'sidearm',
    seasons,
    career_singles_overall: careerSinglesOverall,
    career_singles_dual:    careerSinglesDual,
    career_doubles_overall: careerDoublesOverall,
    career_doubles_dual:    null,
    ita_rank_peak_career:   peakCareer,
    honors:                 null,
    career_summary:         null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WMT PARSER
// ─────────────────────────────────────────────────────────────────────────────

const WMT_CLASS_LABELS = [
  'Freshman', 'Sophomore', 'Junior', 'Senior',
  'Graduate Student', 'Redshirt Freshman', 'Redshirt Sophomore',
  'Redshirt Junior', 'Fifth-Year', 'Fifth Year',
];

// Split bio text into sections by class-year heading
function splitWMTSections(text: string): Array<{ label: string; body: string }> {
  const labelPattern = new RegExp(
    `\\b(${WMT_CLASS_LABELS.join('|')})\\b`,
    'gi',
  );

  const sections: Array<{ label: string; body: string }> = [];
  let lastLabel = '';
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = labelPattern.exec(text)) !== null) {
    if (lastLabel) {
      sections.push({ label: lastLabel, body: text.slice(lastIdx, m.index) });
    }
    lastLabel = m[1];
    lastIdx = m.index + m[0].length;
  }
  if (lastLabel) {
    sections.push({ label: lastLabel, body: text.slice(lastIdx) });
  }

  return sections;
}

// Map class label to an approximate season string (best effort — WMT doesn't always include years)
function labelToSeason(label: string, idx: number, total: number): string {
  // Use index from end: if there are 4 sections, idx=0 is oldest
  // We can't know exact year without graduation year — return label as season
  return label;
}

function parseWMTSection(body: string, season: string): SeasonStats {
  const singlesOverallM = body.match(/(\d+)-(\d+)\s+(?:record\s+)?in\s+singles/i);
  const singlesDualM    = body.match(/(\d+)-(\d+)\s+(?:mark|record)\s+in\s+dual(?:\s+play)?\s*(?:singles)?/i);
  const doublesOverallM = body.match(/(\d+)-(\d+)\s+(?:record\s+)?in\s+doubles/i);
  const rankEndM        = body.match(/ranked\s+(?:No\.|#)\s*(\d+)/i);
  const rankPeakM       = body.match(/ranked\s+as\s+high\s+as\s+(?:No\.|#)\s*(\d+)/i);

  return {
    season,
    singles_overall: singlesOverallM ? `${singlesOverallM[1]}-${singlesOverallM[2]}` : null,
    singles_dual:    singlesDualM    ? `${singlesDualM[1]}-${singlesDualM[2]}`    : null,
    doubles_overall: doublesOverallM ? `${doublesOverallM[1]}-${doublesOverallM[2]}` : null,
    doubles_dual:    null,
    ita_rank_end:    rankEndM   ? parseInt(rankEndM[1], 10)   : null,
    ita_rank_peak:   rankPeakM  ? parseInt(rankPeakM[1], 10)  : null,
  };
}

export function parseWMTBio(html: string, sourceUrl: string): CareerStats {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const sections = splitWMTSections(text);

  const seasons: SeasonStats[] = sections.map((s, i) =>
    parseWMTSection(s.body, labelToSeason(s.label, i, sections.length)),
  );

  const allRanks = seasons.flatMap(s =>
    [s.ita_rank_end, s.ita_rank_peak].filter((r): r is number => r !== null),
  );
  const peakCareer = allRanks.length > 0 ? Math.min(...allRanks) : null;

  // Sum career totals from individual seasons (WMT doesn't have a totals section)
  function sumWL(stat: 'singles_overall' | 'singles_dual' | 'doubles_overall'): string | null {
    let w = 0; let l = 0; let found = false;
    for (const s of seasons) {
      const v = s[stat];
      if (v) {
        const [sw, sl] = v.split('-').map(Number);
        w += sw; l += sl; found = true;
      }
    }
    return found ? `${w}-${l}` : null;
  }

  return {
    source_url:             sourceUrl,
    platform:               'wmt',
    seasons,
    career_singles_overall: sumWL('singles_overall'),
    career_singles_dual:    sumWL('singles_dual'),
    career_doubles_overall: sumWL('doubles_overall'),
    career_doubles_dual:    null,
    ita_rank_peak_career:   peakCareer,
    honors:                 null,
    career_summary:         null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a player bio page and extract career statistics.
 * Auto-detects Sidearm vs WMT from the HTML content.
 *
 * @param profileUrl  Absolute URL to the player's bio/profile page
 */
export async function extractCareerStats(profileUrl: string): Promise<CareerStats> {
  const res = await fetch(profileUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CourtIQ-Scraper/1.0)',
      'Accept': 'text/html',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${profileUrl}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  if (isSidearmPage(html)) {
    return parseSidearmBio(html, profileUrl);
  }
  if (isWMTPage(html)) {
    return parseWMTBio(html, profileUrl);
  }

  // Unknown platform — return empty
  return {
    source_url:             profileUrl,
    platform:               'unknown',
    seasons:                [],
    career_singles_overall: null,
    career_singles_dual:    null,
    career_doubles_overall: null,
    career_doubles_dual:    null,
    ita_rank_peak_career:   null,
    honors:                 null,
    career_summary:         null,
  };
}
