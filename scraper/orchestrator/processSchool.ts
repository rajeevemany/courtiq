/**
 * School processing orchestrator
 *
 * For a given school + list of committed juniors:
 *   1. Look up the school's roster URL
 *   2. Scrape the live roster
 *   3. Match each junior's TR name to a roster player
 *   4. Fetch career stats from each matched player's bio page
 *   5. Upsert results to the college_careers table
 *
 * Designed to be called once per school from the admin UI or a cron job.
 * One school = one API call = well within Vercel's 60s timeout.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { lookupSchool } from '../schoolUrls';
import { scrapeRosterWithPlaywright, scrapeBioWithPlaywright } from '../playwrightScraper';
import { matchName, summarizeMatches } from '../matchName';
import type { CareerStats } from '../extractCareerStats';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface JuniorProfileRow {
  id: string;
  name: string;
  committed_school: string;
  committed_year: number | null;
  division: string | null;
  peak_ranking: number | null;
}

export interface CareerUpsertRow {
  junior_profile_id:          string;
  school:                     string;
  start_year:                 number | null;
  years_played:               number | null;
  career_singles_wins:        number | null;
  career_singles_losses:      number | null;
  career_singles_dual_wins:   number | null;
  career_singles_dual_losses: number | null;
  career_doubles_wins:        number | null;
  career_doubles_losses:      number | null;
  peak_ita_ranking:           number | null;
  last_scraped_at:            string;
  yearly_stats:               Record<string, object> | null;
  source_url:                 string | null;
  platform:                   string;
  honors:                     object | null;
  career_summary:             string | null;
}

export interface PlayerResult {
  junior_id: string;
  tr_name: string;
  confidence: string;
  roster_player: string | null;
  upserted: boolean;
  error: string | null;
}

export interface SchoolResult {
  school: string;
  roster_size: number;
  total_juniors: number;
  upserted: number;
  matched_exact: number;
  matched_high: number;
  ambiguous: number;
  no_match: number;
  errors: number;
  players: PlayerResult[];
  elapsed_ms: number;
}

export interface ProcessOptions {
  delay_ms?: number;    // ms to wait between bio page fetches (default 300)
  dry_run?: boolean;    // if true, skip Supabase upserts
  max_players?: number; // cap processed players (for testing)
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function upsertCollegeCareer(
  supabase: SupabaseClient,
  row: CareerUpsertRow,
): Promise<void> {
  // Strip null career stat fields so a re-scrape with null data doesn't
  // overwrite previously scraped good values (ON CONFLICT DO UPDATE will
  // skip fields not present in the payload).
  const upsertRow = { ...row } as Record<string, unknown>;
  const careerStatFields = [
    'career_singles_wins',
    'career_singles_losses',
    'career_singles_dual_wins',
    'career_singles_dual_losses',
    'career_doubles_wins',
    'career_doubles_losses',
    'peak_ita_ranking',
    'honors',
    'career_summary',
  ] as const;
  for (const field of careerStatFields) {
    if (upsertRow[field] === null) delete upsertRow[field];
  }

  const { error } = await supabase
    .from('college_careers')
    .upsert(upsertRow, { onConflict: 'junior_profile_id,school' });

  if (error) {
    console.error('Supabase upsert error full object:', JSON.stringify(error));
    throw new Error(`Supabase upsert failed: ${error.message} | code: ${error.code} | details: ${error.details} | hint: ${error.hint}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process one school: scrape roster, match juniors, fetch stats, upsert.
 *
 * @param supabase       Supabase client (service role for upserts)
 * @param schoolName     Canonical school name (or TR alias)
 * @param juniors        Committed juniors for this school from junior_profiles
 * @param options        Processing options
 */
export async function processSchool(
  supabase: SupabaseClient,
  schoolName: string,
  juniors: JuniorProfileRow[],
  options: ProcessOptions = {},
): Promise<SchoolResult> {
  const startTime = Date.now();
  const { delay_ms = 300, dry_run = false, max_players } = options;
  const playerResults: PlayerResult[] = [];

  // 1. Look up school URL
  const entry = lookupSchool(schoolName);
  if (!entry) {
    return {
      school:         schoolName,
      roster_size:    0,
      total_juniors:  juniors.length,
      upserted:       0,
      matched_exact:  0,
      matched_high:   0,
      ambiguous:      0,
      no_match:       0,
      errors:         juniors.length,
      players:        juniors.map(j => ({
        junior_id:     j.id,
        tr_name:       j.name,
        confidence:    'no_match',
        roster_player: null,
        upserted:      false,
        error:         `School not in SCHOOL_MAP: "${schoolName}"`,
      })),
      elapsed_ms: Date.now() - startTime,
    };
  }

  const platform = entry.platform;

  // Launch one shared browser for the entire school run
  const browser = await chromium.launch({ headless: true });

  try {
    // 2. Scrape roster
    let rosterResult;
    try {
      rosterResult = await scrapeRosterWithPlaywright(entry.roster_base, browser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        school:         schoolName,
        roster_size:    0,
        total_juniors:  juniors.length,
        upserted:       0,
        matched_exact:  0,
        matched_high:   0,
        ambiguous:      0,
        no_match:       0,
        errors:         juniors.length,
        players:        juniors.map(j => ({
          junior_id:     j.id,
          tr_name:       j.name,
          confidence:    'no_match',
          roster_player: null,
          upserted:      false,
          error:         `Roster scrape failed: ${msg}`,
        })),
        elapsed_ms: Date.now() - startTime,
      };
    }

    const rosterPlayers = rosterResult.players;

    // 3. Match + process each junior
    const limited = max_players ? juniors.slice(0, max_players) : juniors;
    let upserted = 0;
    let matchedExact = 0;
    let matchedHigh = 0;
    let ambiguous = 0;
    let noMatch = 0;
    let errors = 0;

    for (let i = 0; i < limited.length; i++) {
      const junior = limited[i];
      const matchResult = matchName(junior.name, rosterPlayers);

      const playerRes: PlayerResult = {
        junior_id:     junior.id,
        tr_name:       junior.name,
        confidence:    matchResult.confidence,
        roster_player: matchResult.match?.full_name ?? null,
        upserted:      false,
        error:         null,
      };

      if (matchResult.confidence === 'exact') matchedExact++;
      else if (matchResult.confidence === 'high') matchedHigh++;
      else if (matchResult.confidence === 'ambiguous') { ambiguous++; playerResults.push(playerRes); continue; }
      else { noMatch++; playerResults.push(playerRes); continue; }

      // 4. Fetch career stats
      const rosterPlayer = matchResult.match!;
      let stats: CareerStats | null = null;

      try {
        if (i > 0) await sleep(delay_ms);
        stats = await scrapeBioWithPlaywright(rosterPlayer.profile_url, browser);
      } catch (err) {
        playerRes.error = err instanceof Error ? err.message : String(err);
        errors++;
        playerResults.push(playerRes);
        continue;
      }

      // 5. Upsert to college_careers
      if (!dry_run) {
        try {
          const parseWL = (wl: string | null | undefined): [number | null, number | null] => {
            if (!wl) return [null, null];
            const parts = wl.split('-').map(Number);
            return (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
              ? [parts[0], parts[1]]
              : [null, null];
          };

          const [csw, csl]   = parseWL(stats?.career_singles_overall);
          const [csdw, csdl] = parseWL(stats?.career_singles_dual);
          const [cdw, cdl]   = parseWL(stats?.career_doubles_overall);

          await upsertCollegeCareer(supabase, {
            junior_profile_id:          junior.id,
            school:                     schoolName,
            start_year:                 stats?.seasons?.[0]?.season
                                          ? parseInt(stats.seasons[0].season.split('-')[0], 10) || null
                                          : null,
            years_played:               stats?.seasons?.length || null,
            career_singles_wins:        csw,
            career_singles_losses:      csl,
            career_singles_dual_wins:   csdw,
            career_singles_dual_losses: csdl,
            career_doubles_wins:        cdw,
            career_doubles_losses:      cdl,
            peak_ita_ranking:           stats?.ita_rank_peak_career ?? null,
            last_scraped_at:            new Date().toISOString(),
            yearly_stats:               stats?.seasons?.length
              ? stats.seasons.reduce((acc, s) => {
                  const [sow, sol] = parseWL(s.singles_overall);
                  const [sdw, sdl] = parseWL(s.singles_dual);
                  const [dow, dol] = parseWL(s.doubles_overall);
                  acc[s.season] = {
                    singles_overall: sow !== null ? { w: sow, l: sol } : null,
                    singles_dual:    sdw !== null ? { w: sdw, l: sdl } : null,
                    doubles_overall: dow !== null ? { w: dow, l: dol } : null,
                    ita_rank_peak:   s.ita_rank_peak ?? null,
                  };
                  return acc;
                }, {} as Record<string, object>)
              : null,
            source_url:                 rosterPlayer.profile_url,
            platform:                   platform,
            honors:                     stats?.honors ?? null,
            career_summary:             stats?.career_summary ?? null,
          });
          playerRes.upserted = true;
          upserted++;
        } catch (err) {
          playerRes.error = err instanceof Error ? err.message : String(err);
          errors++;
        }
      } else {
        playerRes.upserted = false; // dry run
        upserted++;                  // count as "would upsert"
      }

      playerResults.push(playerRes);
    }

    return {
      school:         schoolName,
      roster_size:    rosterPlayers.length,
      total_juniors:  juniors.length,
      upserted,
      matched_exact:  matchedExact,
      matched_high:   matchedHigh,
      ambiguous,
      no_match:       noMatch,
      errors,
      players:        playerResults,
      elapsed_ms:     Date.now() - startTime,
    };
  } finally {
    await browser.close();
  }
}
