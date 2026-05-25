/**
 * CourtIQ — TR Rankings Backfill Script
 * Visits each player's TR profile page, extracts year-by-year rankings,
 * and updates junior_profiles in Supabase.
 * 
 * Run: node backfill_tr_rankings.js
 * Set env vars:
 *   SUPABASE_URL=https://bljcniglmbdvipkvfaoi.supabase.co
 *   SUPABASE_SERVICE_KEY=eyJ...
 */

const https = require('https');

const SUPABASE_URL = 'bljcniglmbdvipkvfaoi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers
      },
      timeout: 15000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function httpsPatch(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body);
    const req = https.request({
      hostname, path, method: 'PATCH',
      headers: { ...headers, 'Content-Length': buf.length },
      timeout: 10000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(buf);
    req.end();
  });
}

async function supabaseGet(path) {
  const res = await httpsGet(SUPABASE_URL, path, {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Accept': 'application/json'
  });
  return JSON.parse(res.body);
}

async function supabasePatch(path, data) {
  const body = JSON.stringify(data);
  return httpsPatch(SUPABASE_URL, path, {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=minimal'
  }, body);
}

// Parse the TR profile page for year-by-year rankings
// The "Highest Rankings" section looks like:
// <table>...<tr><td>Freshman</td><td>45</td></tr>...
function parseTRRankings(html) {
  const rankings = {
    ranking_yr1: null, // freshman
    ranking_yr2: null, // sophomore
    ranking_yr3: null, // junior
    ranking_yr4: null, // senior
  };

  // Find the "Highest Rankings" section
  const rankingSection = html.match(/[Hh]ighest\s+[Rr]ankings[\s\S]{0,3000}/);
  if (!rankingSection) return rankings;

  const section = rankingSection[0];

  // Match year labels and their rankings
  const yearPatterns = [
    { keys: ['freshman', 'fr\\.', '9th', 'year 1'], field: 'ranking_yr1' },
    { keys: ['sophomore', 'so\\.', '10th', 'year 2'], field: 'ranking_yr2' },
    { keys: ['junior', 'jr\\.', '11th', 'year 3'], field: 'ranking_yr3' },
    { keys: ['senior', 'sr\\.', '12th', 'year 4'], field: 'ranking_yr4' },
  ];

  for (const { keys, field } of yearPatterns) {
    for (const key of keys) {
      const re = new RegExp(key + '[^0-9]{0,50}?([0-9]{1,4})', 'i');
      const m = section.match(re);
      if (m) {
        const rank = parseInt(m[1]);
        if (rank > 0 && rank < 2000) {
          rankings[field] = rank;
          break;
        }
      }
    }
  }

  // Alternative: look for table rows with rank numbers
  // Format: <td class="...">Sophomore</td><td class="...">23</td>
  const tableRowRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  let tableMatch;
  while ((tableMatch = tableRowRe.exec(section)) !== null) {
    const row = tableMatch[0];
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (cells.length >= 2) {
      const label = cells[0].replace(/<[^>]+>/g, '').trim().toLowerCase();
      const value = cells[1].replace(/<[^>]+>/g, '').trim();
      const rank = parseInt(value);
      if (!isNaN(rank) && rank > 0 && rank < 2000) {
        if (label.includes('freshman') || label.includes('fr.')) rankings.ranking_yr1 = rank;
        else if (label.includes('sophomore') || label.includes('so.')) rankings.ranking_yr2 = rank;
        else if (label.includes('junior') || label.includes('jr.')) rankings.ranking_yr3 = rank;
        else if (label.includes('senior') || label.includes('sr.')) rankings.ranking_yr4 = rank;
      }
    }
  }

  return rankings;
}

async function fetchTRProfile(trId) {
  try {
    const res = await httpsGet(
      'www.tennisrecruiting.net',
      `/player.asp?id=${trId}`
    );
    if (res.status !== 200) return null;
    return res.body;
  } catch(e) {
    return null;
  }
}

async function getPlayersNeedingUpdate() {
  // Fetch in two batches — missing yr2 and missing yr3/yr4
  // Use simple filters to avoid OR syntax issues with Supabase REST
  const data = await supabaseGet(
    `/rest/v1/junior_profiles?select=id,name,tennisrecruiting_id,ranking_yr1,ranking_yr2,ranking_yr3,ranking_yr4` +
    `&tennisrecruiting_id=not.is.null` +
    `&limit=2500`
  );
  if (!Array.isArray(data)) {
    console.error('Supabase error:', data);
    return [];
  }
  // Filter in JS — players missing any of yr2, yr3, yr4
  return data.filter(p => 
    p.ranking_yr2 === null || 
    p.ranking_yr3 === null || 
    p.ranking_yr4 === null
  );
}

async function updatePlayer(id, rankings) {
  // Only update non-null fields that are currently missing
  const updates = {};
  if (rankings.ranking_yr1 !== null) updates.ranking_yr1 = rankings.ranking_yr1;
  if (rankings.ranking_yr2 !== null) updates.ranking_yr2 = rankings.ranking_yr2;
  if (rankings.ranking_yr3 !== null) updates.ranking_yr3 = rankings.ranking_yr3;
  if (rankings.ranking_yr4 !== null) updates.ranking_yr4 = rankings.ranking_yr4;

  if (Object.keys(updates).length === 0) return false;

  const res = await supabasePatch(
    `/rest/v1/junior_profiles?id=eq.${id}`,
    updates
  );
  return res.status === 204 || res.status === 200;
}

async function main() {
  console.log('Fetching players missing ranking data...');
  const players = await getPlayersNeedingUpdate();
  console.log(`Found ${players.length} players to process\n`);

  let found = 0, updated = 0, failed = 0, noData = 0;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const missing = [
      !player.ranking_yr2 && 'yr2',
      !player.ranking_yr3 && 'yr3',
      !player.ranking_yr4 && 'yr4',
    ].filter(Boolean).join('/');

    process.stdout.write(
      `[${i+1}/${players.length}] ${player.name} (TR:${player.tennisrecruiting_id}) missing:${missing} ... `
    );

    const html = await fetchTRProfile(player.tennisrecruiting_id);
    if (!html) {
      console.log('✗ fetch failed');
      failed++;
      await sleep(2000);
      continue;
    }

    const rankings = parseTRRankings(html);
    const hasData = Object.values(rankings).some(v => v !== null);

    if (!hasData) {
      console.log('– no ranking data found');
      noData++;
    } else {
      found++;
      const yr1 = rankings.ranking_yr1 ?? '–';
      const yr2 = rankings.ranking_yr2 ?? '–';
      const yr3 = rankings.ranking_yr3 ?? '–';
      const yr4 = rankings.ranking_yr4 ?? '–';
      process.stdout.write(`yr1:${yr1} yr2:${yr2} yr3:${yr3} yr4:${yr4} ... `);

      const ok = await updatePlayer(player.id, rankings);
      if (ok) {
        console.log('✓ saved');
        updated++;
      } else {
        console.log('✗ save failed');
        failed++;
      }
    }

    // Polite delay — 1.5s between requests to avoid rate limiting
    await sleep(1500);

    // Progress summary every 50 players
    if ((i + 1) % 50 === 0) {
      console.log(`\n--- Progress: ${i+1}/${players.length} | updated:${updated} found:${found} noData:${noData} failed:${failed} ---\n`);
    }
  }

  console.log(`\n═══════════════════════════════`);
  console.log(`Done.`);
  console.log(`Players processed: ${players.length}`);
  console.log(`Rankings found:    ${found}`);
  console.log(`Updated in DB:     ${updated}`);
  console.log(`No data on TR:     ${noData}`);
  console.log(`Fetch errors:      ${failed}`);
}

main().catch(console.error);
