/**
 * Sidearm Sports roster parser
 *
 * Strategy: fetch the roster page (server-rendered HTML), parse the table view
 * which Sidearm always includes alongside the card/list views. The <table>
 * is the most reliable selector — it's always present and doesn't rely on
 * data-test-id attributes that vary across Sidearm versions.
 *
 * Player bio URL format:
 *   /sports/mens-tennis/roster/{slug}/{id}
 *
 * From the table we extract:
 *   full_name, slug, player_id (numeric), year_in_school, height, hometown
 *
 * "Last School" / high school is NOT in the table — only in the card/list view.
 * We grab it from the list view block which is also server-rendered.
 */

import * as cheerio from 'cheerio';

export interface SidearmPlayer {
  full_name: string;
  slug: string;           // e.g. "nicolas-kotzen"
  player_id: string;      // e.g. "22202"
  profile_url: string;    // absolute path, e.g. "/sports/mens-tennis/roster/nicolas-kotzen/22202"
  year_in_school: string; // "Fr." | "So." | "Jr." | "Sr." | "FY" | "Grad" | "RS Fr." etc.
  height: string | null;  // e.g. "6' 5''"
  hometown: string | null;
  last_school: string | null;
}

/**
 * Parse a Sidearm roster page HTML string.
 * Pass the full HTML from fetch(rosterUrl).text()
 */
export function parseSidearmRoster(html: string, baseUrl: string): SidearmPlayer[] {
  const $ = cheerio.load(html);
  const players: SidearmPlayer[] = [];

  // ── Primary source: the hidden <table> Sidearm always renders ──────────────
  // It has columns: Full Name | Ht. | Year | School | Hometown / High School
  // We build a map of slug → partial player first, then enrich from list view.

  const slugMap = new Map<string, SidearmPlayer>();

  $('table tbody tr').each((_, row) => {
    const $row = $(row);
    const $link = $row.find('td:first-child a');
    if (!$link.length) return;

    const href = $link.attr('href') || '';
    // href: /sports/mens-tennis/roster/{slug}/{id}
    const match = href.match(/\/roster\/([^/]+)\/(\d+)$/);
    if (!match) return;

    const slug = match[1];
    const player_id = match[2];

    const full_name = $link.text().trim();
    const height = $row.find('td:nth-child(2)').text().trim() || null;
    const year_in_school = $row.find('td:nth-child(3)').text().trim();
    // td 4 = school/division (CC, SEAS, etc.) — skip
    // td 5 = "Hometown / High School"  e.g. "Short Hills, N.J. / Newark Academy"
    const hometownCell = $row.find('td:nth-child(5)').text().trim();
    const [hometown, last_school] = splitHometownCell(hometownCell);

    const player: SidearmPlayer = {
      full_name,
      slug,
      player_id,
      profile_url: `${baseUrl}/roster/${slug}/${player_id}`,
      year_in_school,
      height: height || null,
      hometown,
      last_school,
    };

    slugMap.set(slug, player);
    players.push(player);
  });

  // ── Enrichment pass: list-view cards (catches missing last_school) ──────────
  // List cards render: "Academic Year X  Height Y  Hometown Z  Last School W"
  // We use this to fill gaps when the table hometown cell has no "/ School" part.

  $('a[href*="/roster/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/roster\/([^/]+)\/(\d+)$/);
    if (!match) return;

    const slug = match[1];
    const player = slugMap.get(slug);
    if (!player) return;

    // Walk up to find the card container, then find "Last School" label
    const $container = $(el).closest('[class*="s-person"], li, .roster-card, article').first();
    if (!$container.length) return;

    if (!player.last_school) {
      // Look for a text node / span that follows "Last School" label
      const text = $container.text();
      const lastSchoolMatch = text.match(/Last School\s+(.+?)(?:Full Bio|$)/s);
      if (lastSchoolMatch) {
        player.last_school = lastSchoolMatch[1].trim().split('\n')[0].trim();
      }
    }
  });

  return players;
}

/**
 * Split "Short Hills, N.J. / Newark Academy" into [hometown, last_school].
 * Handles cases with no school: "Singapore, Singapore" → [hometown, null]
 * Handles multi-school: "Montville, N.J. / Delbarton School/Dwight School"
 *   — only split on the FIRST " / " (space-slash-space)
 */
function splitHometownCell(cell: string): [string | null, string | null] {
  if (!cell) return [null, null];
  const idx = cell.indexOf(' / ');
  if (idx === -1) return [cell.trim(), null];
  return [cell.slice(0, idx).trim(), cell.slice(idx + 3).trim()];
}

/**
 * Detect whether an HTML page is a Sidearm Sports site.
 * Call this on the raw HTML before choosing which parser to use.
 */
export function isSidearmPage(html: string): boolean {
  return (
    html.includes('sidearm-wrapper') ||
    html.includes('sidearm.nextgen') ||
    html.includes('sidearmdev.com') ||
    html.includes('sidearmsports.com')
  );
}
