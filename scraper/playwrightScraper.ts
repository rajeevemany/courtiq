/**
 * Playwright-based scrapers for JavaScript-rendered athletics sites (e.g. Sidearm Sports).
 *
 * Drop-in replacements for scrapeRoster() and extractCareerStats() when fetch-based
 * scraping returns empty results because the page renders via Vue/React.
 */

import { chromium, type Browser } from 'playwright';
import { buildScrapeResult, type ScrapeResult } from './scrapeRoster';
import type { CareerStats } from './extractCareerStats';

export type { Browser };

// ─────────────────────────────────────────────────────────────────────────────
// MANAGED BROWSER  (restarts every N schools to prevent memory exhaustion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a Playwright Browser instance and automatically closes + relaunches it
 * after every `restartEvery` schools to prevent memory exhaustion during long
 * historical scrape runs.
 *
 * Usage:
 *   const mb = new ManagedBrowser();
 *   const browser = await mb.get();          // launch (or reuse) browser
 *   // ... scrape one school ...
 *   await mb.onSchoolDone();                 // increment counter; restart if needed
 *   await mb.close();                        // close when completely finished
 */
export class ManagedBrowser {
  private _browser: Browser | null = null;
  private _schoolsProcessed = 0;
  private readonly _restartEvery: number;

  constructor(restartEvery = 10) {
    this._restartEvery = restartEvery;
  }

  async get(): Promise<Browser> {
    if (!this._browser) {
      this._browser = await chromium.launch({ headless: true });
      console.log('[ManagedBrowser] Browser launched');
    }
    return this._browser;
  }

  /** Call once per school after it finishes. Restarts the browser if threshold reached. */
  async onSchoolDone(): Promise<void> {
    this._schoolsProcessed++;
    if (this._schoolsProcessed % this._restartEvery === 0) {
      console.log(`[ManagedBrowser] Restarting browser after ${this._schoolsProcessed} schools`);
      await this._closeInternal();
      this._browser = await chromium.launch({ headless: true });
      console.log('[ManagedBrowser] Browser relaunched');
    }
  }

  async close(): Promise<void> {
    await this._closeInternal();
  }

  private async _closeInternal(): Promise<void> {
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROSTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrape a college tennis roster using a headless Chromium browser.
 * Waits for the roster table or player links to appear before extracting HTML.
 *
 * @param sportUrl  Base sport URL, e.g. "https://gocolumbialions.com/sports/mens-tennis"
 *                  /roster is appended automatically.
 * @param browser   Optional existing Browser instance to reuse. If omitted, a new
 *                  browser is launched and closed when done.
 */
export async function scrapeRosterWithPlaywright(sportUrl: string, browser?: Browser, rosterSuffix = '/roster'): Promise<ScrapeResult> {
  const rosterUrl = sportUrl.replace(/\/$/, '') + rosterSuffix;
  const ownBrowser = !browser;
  const b = browser ?? await chromium.launch({ headless: true });

  try {
    const page = await b.newPage();
    await page.goto(rosterUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const html = await page.content();
    return buildScrapeResult(html, sportUrl);
  } catch (err) {
    console.error(`[scrapeRosterWithPlaywright] Failed for ${rosterUrl}:`, err);
    return {
      school_url:  sportUrl,
      platform:    'unknown',
      players:     [],
      scraped_at:  new Date().toISOString(),
    };
  } finally {
    if (ownBrowser) await b.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BIO / CAREER STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrape a player bio page using a headless Chromium browser and extract career stats.
 * Waits for stats or bio content to appear before extracting HTML.
 *
 * @param profileUrl  Absolute URL to the player's bio/profile page
 * @param browser     Optional existing Browser instance to reuse. If omitted, a new
 *                    browser is launched and closed when done.
 */
export async function scrapeBioWithPlaywright(profileUrl: string, browser?: Browser): Promise<CareerStats | null> {
  const ownBrowser = !browser;
  const b = browser ?? await chromium.launch({ headless: true });

  try {
    const page = await b.newPage();
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const html = await page.content();

    const plainText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Extract college tennis career information from this athlete bio page. Return ONLY valid JSON, no explanation, no markdown fences.

Bio text:
${plainText}

Return this exact JSON structure:
{
  "seasons": [
    {
      "season": "2024-25",
      "singles_overall": "W-L or null",
      "singles_dual": "W-L or null",
      "doubles_overall": "W-L or null",
      "ita_rank_peak": number or null,
      "notable_wins": ["opponent name and ranking if mentioned"]
    }
  ],
  "career_singles_overall": "W-L or null",
  "career_singles_dual": "W-L or null",
  "career_doubles_overall": "W-L or null",
  "ita_rank_peak_career": number or null,
  "honors": {
    "national": ["e.g. NCAA Champion 2024", "ITA All-American 2023"],
    "regional": ["e.g. ITA Northeast Region Player of the Year"],
    "conference": ["e.g. First Team All-Ivy League Singles 2024"],
    "team": ["e.g. Team MVP", "Most Improved Player"]
  },
  "career_summary": "2-3 sentence narrative summary of career highlights"
}

Rules for extracting stats:
- Season format is always "YYYY-YY"
- Records are always "W-L" strings like "17-8"
- Stats appear in many formats - look for ALL of these patterns:
  * Tables with season rows
  * Prose like "posted a 37-5 record", "went 17-8", "compiled a 12-3 mark", "finished 22-6", "recorded a 15-4 singles record"
  * Bullet points with season summaries
  * Career totals lines like "Career: 112-25"
- For ITA rankings look for "ranked No. X", "ranked as high as No. X", "finished ranked No. X", "climbed to No. X"
- Use year context clues to assign stats to correct seasons: "as a freshman", "sophomore season", "2024-25", "his junior year"
- If no explicit career totals exist, SUM all seasons to compute them
- Only include seasons where the player competed at this college
- Do not include high school or junior stats

Rules for honors:
- national: NCAA titles, ITA All-American, ITA national awards
- regional: ITA regional awards (Northeast, Southeast, etc.)
- conference: All-conference teams, conference player of the year, conference academic awards
- team: team-level awards, captaincy, most improved, etc.

Rules for career_summary:
- Always write this even if no structured stats are available
- Lead with the most impressive achievement (NCAA title, ranking, win total)
- Include peak ITA ranking if known
- Mention All-conference honors and years
- Keep to 2-3 sentences maximum
- Example: "Two-time NCAA singles champion (2024, 2025) and four-time ITA All-American. Ranked as high as No. 1 nationally in singles, the highest season-ending ranking in Columbia history. Three-time First Team All-Ivy in both singles and doubles."`,
        }],
      }),
    });

    const data = await response.json();
const raw = data.content[0].text;
    const content = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    try {
      const extracted = JSON.parse(content);
      console.log('[bio extract]', profileUrl.split('/').slice(-2).join('/'), JSON.stringify(extracted))
      return extracted as CareerStats;
    } catch {
      console.warn('[scrapeBioWithPlaywright] Failed to parse Claude response:', content.slice(0, 200));
      return null;
    }
  } catch (err) {
    console.error(`[scrapeBioWithPlaywright] Failed for ${profileUrl}:`, err);
    return null;
  } finally {
    if (ownBrowser) await b.close();
  }
}
