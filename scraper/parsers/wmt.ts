/**
 * WMT Digital roster parser
 *
 * Strategy: fetch the roster page (server-rendered HTML), parse player cards.
 * WMT does NOT render a <table> fallback like Sidearm does. Player data lives
 * in individual card elements with labeled **bold** fields.
 *
 * Player bio URL format (no numeric ID):
 *   /sports/mens-tennis/roster/player/{slug}
 *
 * From each card we extract:
 *   full_name, slug, year_in_school, height, hometown, high_school,
 *   previous_school (transfers only), major
 *
 * Height + class year are packed into a single text node with unicode primes:
 *   "6′2″Senior"  "5′11″Redshirt Sophomore"  "6′0″Graduate Student"
 *
 * Labeled fields use **bold** markdown-style in the rendered text:
 *   **Hometown** Basking Ridge, N.J.
 *   **High School** Laurel Springs School
 *   **Previous School** California   ← transfers only
 *   **Major** Science, Technology & Society
 */

import * as cheerio from 'cheerio';

export interface WMTPlayer {
  full_name: string;
  slug: string;           // e.g. "samir-banerjee"
  profile_url: string;    // absolute URL
  year_in_school: string; // "Senior" | "Junior" | "Sophomore" | "Freshman" | "Redshirt Sophomore" | "Graduate Student" etc.
  height: string | null;  // e.g. "6′2″"  (unicode primes preserved)
  hometown: string | null;
  high_school: string | null;
  previous_school: string | null; // transfer's prior college, null for non-transfers
  major: string | null;
}

/**
 * Parse a WMT Digital roster page HTML string.
 * Pass the full HTML from fetch(rosterUrl).text()
 */
export function parseWMTRoster(html: string, baseUrl: string): WMTPlayer[] {
  const $ = cheerio.load(html);
  const players: WMTPlayer[] = [];
  const seen = new Set<string>();

  // WMT renders player cards as <a href="/sports/.../roster/player/{slug}">
  // Each anchor wraps the entire card. We find all distinct player links first.
  $('a[href*="/roster/player/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/roster\/player\/([^/?#]+)$/);
    if (!match) return;

    const slug = match[1];
    if (seen.has(slug)) return; // deduplicate — same player appears in card + list + table views
    seen.add(slug);

    const $card = $(el);
    const cardText = $card.text();

    // ── Name ──────────────────────────────────────────────────────────────────
    // WMT puts the name in the first <a> text or a child heading
    const $heading = $card.find('h2, h3, h4, [class*="name"], [class*="title"]').first();
    const full_name = ($heading.length ? $heading.text() : $card.find('a').first().text()).trim();
    if (!full_name) return;

    // ── Height + Year ─────────────────────────────────────────────────────────
    // Packed as "6′2″Senior" using unicode prime (′ U+2032) and double-prime (″ U+2033)
    // Also handle ASCII fallbacks: 6'2"Senior
    const { height, year_in_school } = parseHeightYear(cardText);

    // ── Labeled fields ────────────────────────────────────────────────────────
    const hometown      = extractLabel($, $card, 'Hometown');
    const high_school   = extractLabel($, $card, 'High School');
    const previous_school = extractLabel($, $card, 'Previous School');
    const major         = extractLabel($, $card, 'Major');

    players.push({
      full_name,
      slug,
      profile_url: `${baseUrl}/roster/player/${slug}`,
      year_in_school,
      height,
      hometown,
      high_school,
      previous_school,
      major,
    });
  });

  return players;
}

/**
 * Parse the combined height+year string WMT packs into one element.
 *
 * Examples:
 *   "6′2″Senior"             → { height: "6′2″",  year: "Senior" }
 *   "5′11″Redshirt Sophomore" → { height: "5′11″", year: "Redshirt Sophomore" }
 *   "6′0″Graduate Student"   → { height: "6′0″",  year: "Graduate Student" }
 *   "5′10″Sophomore"         → { height: "5′10″", year: "Sophomore" }
 *
 * Falls back gracefully when height is missing (some WMT schools omit it).
 */
function parseHeightYear(text: string): { height: string | null; year_in_school: string } {
  // Match unicode primes (standard WMT output)
  const unicodeMatch = text.match(/(\d+)[′\u2032](\d+)[″\u2033]([A-Za-z].+?)(?:\n|$|\s{2,})/);
  if (unicodeMatch) {
    return {
      height: `${unicodeMatch[1]}′${unicodeMatch[2]}″`,
      year_in_school: unicodeMatch[3].trim(),
    };
  }

  // ASCII fallback: 6'2"Senior
  const asciiMatch = text.match(/(\d+)'(\d+)"([A-Za-z].+?)(?:\n|$|\s{2,})/);
  if (asciiMatch) {
    return {
      height: `${asciiMatch[1]}'${asciiMatch[2]}"`,
      year_in_school: asciiMatch[3].trim(),
    };
  }

  // Height missing — try to find year class alone
  const yearMatch = text.match(/\b(Freshman|Sophomore|Junior|Senior|Graduate Student|Redshirt Freshman|Redshirt Sophomore|Redshirt Junior|Fifth[- ]Year|Grad)\b/i);
  return {
    height: null,
    year_in_school: yearMatch ? yearMatch[1] : '',
  };
}

/**
 * Extract the value following a bold label inside a card.
 *
 * WMT renders labeled fields as:
 *   <strong>Hometown</strong> Basking Ridge, N.J.
 *   — or —
 *   <b>Hometown</b>\nBasking Ridge, N.J.
 *
 * We find the <strong>/<b> whose text matches the label, then grab the
 * immediately following text node (or sibling element text).
 */
function extractLabel($: cheerio.CheerioAPI, $card: cheerio.Cheerio<cheerio.AnyNode>, label: string): string | null {
  let value: string | null = null;

  $card.find('strong, b').each((_, el) => {
    if ($(el).text().trim() === label) {
      // Try next sibling text node first
      const next = el.nextSibling;
      if (next && next.type === 'text') {
        const v = (next as cheerio.TextNode).data?.trim();
        if (v) { value = v; return false; }
      }
      // Try next element sibling
      const $next = $(el).next();
      if ($next.length) {
        const v = $next.text().trim();
        if (v) { value = v; return false; }
      }
      // Fallback: grab parent text after stripping the label
      const parentText = $(el).parent().text();
      const afterLabel = parentText.slice(parentText.indexOf(label) + label.length).trim();
      if (afterLabel) {
        // Stop at next label (bold word followed by capital)
        value = afterLabel.split(/\n|\*\*|(?=\b(?:Hometown|High School|Previous School|Major|Hometown)\b)/)[0].trim();
        return false;
      }
    }
  });

  return value || null;
}

/**
 * Detect whether an HTML page is a WMT Digital site.
 */
export function isWMTPage(html: string): boolean {
  return (
    html.includes('wmt.digital') ||
    html.includes('Powered byWMT') ||
    html.includes('Powered by WMT')
  );
}
