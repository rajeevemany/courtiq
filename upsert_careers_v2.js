/**
 * CourtIQ — College Career Enrichment Script v2
 * Covers: Stanford, Illinois, Yale, California, LSU, Pepperdine, South Carolina, Wisconsin, Kentucky
 * Run: node upsert_careers_v2.js
 */

const https = require('https');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!ANTHROPIC_KEY || !SUPABASE_KEY) {
  console.error('Set ANTHROPIC_API_KEY and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const PLAYERS = [
  // ── STANFORD ─────────────────────────────────────────────────────────────
  { id: 'c34127ef-8506-463d-bc10-e8c446a9d431', name: 'Bradley Klahn', school: 'Stanford', committed_year: 2008, peak_ranking: 1 },
  { id: '8ca90ed6-4609-4128-9295-7986b1dcc11c', name: 'Ryan Thacher', school: 'Stanford', committed_year: 2008, peak_ranking: 1 },
  { id: 'c2e23f5c-02ee-44ec-87e8-b8e86415655f', name: 'Ryan Stineman', school: 'Stanford', committed_year: 2011, peak_ranking: 2 },
  { id: 'ee6f762f-ec17-4cb3-94fd-dd92ebd6af18', name: 'Nils Paige', school: 'Stanford', committed_year: 2012, peak_ranking: 3 },
  { id: 'fa2508eb-bee7-45c4-9bf3-7b9dae458043', name: 'Ron Lederman', school: 'Stanford', committed_year: 2013, peak_ranking: 4 },
  { id: 'ce21d6ff-835b-41ed-bd85-0e1a603c4e83', name: 'Tim Fawcett', school: 'Stanford', committed_year: 2014, peak_ranking: 2 },
  { id: '95108c42-c68e-4319-ab07-ec2a61545878', name: 'Dennis Hsu', school: 'Stanford', committed_year: 2014, peak_ranking: 4 },
  { id: '290d94c0-febb-40fd-a580-adc3dc9d0d2c', name: 'Sameer Kumar', school: 'Stanford', committed_year: 2015, peak_ranking: 2 },
  { id: 'aaf338c0-e545-4913-a2ef-79c3bf48df73', name: 'Michael Genender', school: 'Stanford', committed_year: 2015, peak_ranking: 4 },
  { id: 'a3cacdb6-1381-4e0f-87a5-d072e7924069', name: 'Willie Genesen', school: 'Stanford', committed_year: 2016, peak_ranking: 4 },
  { id: '7c03e03d-1c07-4ac3-b71b-d7b8c4c1f03d', name: 'Tom Sah', school: 'Stanford', committed_year: 2017, peak_ranking: 7 },
  { id: 'd998f248-664c-4209-a7df-84b6e2b2bcff', name: 'Stefan Turchetta', school: 'Stanford', committed_year: 2017, peak_ranking: 12 },
  { id: '244b5784-b6e8-45e3-9c7a-e5dfb4801313', name: 'Arthur Rotsaert', school: 'Stanford', committed_year: 2018, peak_ranking: 2 },
  { id: '69776bb9-d9fe-49ab-92dd-0ceb7889ff93', name: 'Shyam Sridhar', school: 'Stanford', committed_year: 2018, peak_ranking: 6 },
  { id: '308b374c-9fa6-4348-a2b5-d9427fadebc5', name: 'Nicky Rajesh', school: 'Stanford', committed_year: 2019, peak_ranking: 1 },
  { id: 'b2011557-659f-401f-a9c3-4d89eee96aee', name: 'Alex Lee', school: 'Stanford', committed_year: 2019, peak_ranking: 2 },
  { id: '7a334d9c-05bf-416c-aaa9-212efaaf40a2', name: 'Aditya Chaudhary', school: 'Stanford', committed_year: 2020, peak_ranking: 5 },
  { id: '7730ec12-e728-48bc-a82a-3ae6f04061fb', name: 'Saisai Banerjee', school: 'Stanford', committed_year: 2022, peak_ranking: 1 },
  { id: '38f28ff6-11fe-4d32-b8ae-b458be315f1f', name: 'Nishanth Basavareddy', school: 'Stanford', committed_year: 2022, peak_ranking: 2 },

  // ── ILLINOIS ─────────────────────────────────────────────────────────────
  { id: 'bfc9ce96-c9c2-4bb7-b322-cbef5ed74166', name: 'Darian Nevolo', school: 'Illinois', committed_year: 2008, peak_ranking: 1 },
  { id: '3af47779-73fd-4f79-816d-e81974708c30', name: 'Wyatt Chin', school: 'Illinois', committed_year: 2008, peak_ranking: 4 },
  { id: '0b80e8ed-dee8-4f98-b185-bfd1f52f1ae6', name: 'Brendan Bazarnik', school: 'Illinois', committed_year: 2010, peak_ranking: 7 },
  { id: '9e47cdf7-ee4c-418c-897b-c02f742412c9', name: 'Jared Hiltzik', school: 'Illinois', committed_year: 2012, peak_ranking: 1 },
  { id: '6ffffc4b-0113-4419-a317-d2127d10a18a', name: 'Brian Page', school: 'Illinois', committed_year: 2012, peak_ranking: 10 },
  { id: '6502663b-27a2-4b1c-ae6b-cbbe85bc6216', name: 'Aleks Hiltzik', school: 'Illinois', committed_year: 2014, peak_ranking: 1 },
  { id: '5f2d9455-bb29-4479-a564-cba995f6e609', name: 'Zeke Clark', school: 'Illinois', committed_year: 2016, peak_ranking: 2 },
  { id: '26e53d7c-bbc9-4254-96bc-2869ae710782', name: 'Gui Gomes', school: 'Illinois', committed_year: 2016, peak_ranking: 12 },
  { id: '20b72ca9-69cc-4494-95c3-893d4595fd4f', name: 'Alex Brown', school: 'Illinois', committed_year: 2017, peak_ranking: 4 },
  { id: 'd5f996a6-eb9a-4b74-8b9f-1eae3e3c8b35', name: 'Andrei Bancila', school: 'Illinois', committed_year: 2019, peak_ranking: 12 },
  { id: '9195c74d-5bc4-41c0-9f87-0002f9269d23', name: 'Hunter Heck', school: 'Illinois', committed_year: 2020, peak_ranking: 9 },
  { id: 'a0f82d85-7821-4cd7-913f-f72f39377c08', name: 'Guerriero Guzauskas', school: 'Illinois', committed_year: 2021, peak_ranking: 4 },
  { id: '5d679744-2768-42da-9d4e-ce6d11453ad6', name: 'Wrzesien Mroz', school: 'Illinois', committed_year: 2021, peak_ranking: 8 },

  // ── YALE ─────────────────────────────────────────────────────────────────
  { id: 'ca8ca364-89ce-4081-a179-2f74c3324e7f', name: 'Michael Powers', school: 'Yale', committed_year: 2009, peak_ranking: 9 },
  { id: '98f66cbb-5515-4327-8a01-03b251d4b6c5', name: 'Timothy Lu', school: 'Yale', committed_year: 2013, peak_ranking: 15 },
  { id: '91ab021f-31f6-48e8-ba0b-739fa78a8fec', name: 'Zachary Wang', school: 'Yale', committed_year: 2014, peak_ranking: 12 },
  { id: '11109063-a646-4e1d-ac15-3bdea70322aa', name: 'Dennis Wang', school: 'Yale', committed_year: 2015, peak_ranking: 3 },
  { id: 'bc89a58f-ee43-4168-9ebb-0a78a484b588', name: 'Daniel King', school: 'Yale', committed_year: 2016, peak_ranking: 5 },
  { id: 'd67b3a59-bb23-4a6a-b205-d266e806bbae', name: 'Christopher Lin', school: 'Yale', committed_year: 2017, peak_ranking: 20 },
  { id: '041b33e6-5725-4a70-9da1-b72ccfd3549e', name: 'Michael Sun', school: 'Yale', committed_year: 2018, peak_ranking: 18 },
  { id: '585cf8c0-08cf-4629-8bf0-3d866a32d92b', name: 'Liam Neal', school: 'Yale', committed_year: 2021, peak_ranking: 18 },

  // ── CALIFORNIA ───────────────────────────────────────────────────────────
  { id: 'd9404259-a147-4265-97bd-f33f98562888', name: 'Kevin Stewart', school: 'California', committed_year: 2006, peak_ranking: 1 },
  { id: '6585675d-ffdc-41a1-9fcf-7cfd9e8fcccb', name: 'William Griffith', school: 'California', committed_year: 2014, peak_ranking: 2 },
  { id: 'ded2927a-10fa-49f5-8acf-accdb71feed6', name: 'Benjamin Hoffmann', school: 'California', committed_year: 2016, peak_ranking: 7 },
  { id: 'fe420d7e-04ea-43e9-b2c5-8df1a05ca3e0', name: 'Jeremy Brumm', school: 'California', committed_year: 2017, peak_ranking: 4 },
  { id: '0ee3c5d9-7e10-4180-93b5-34429bcdc7d7', name: 'Patrick Barretto', school: 'California', committed_year: 2017, peak_ranking: 7 },
  { id: '0c1f1042-b8fd-4ccf-86cd-0e26b7b61624', name: 'Jacoby Nishimura', school: 'California', committed_year: 2014, peak_ranking: 9 },

  // ── LSU ──────────────────────────────────────────────────────────────────
  { id: 'a3a866d9-0ef9-41ab-8d90-a48307b8a7eb', name: 'Marcus Venus', school: 'LSU', committed_year: 2005, peak_ranking: 1 },
  { id: '6c5f9d2a-16b1-4bd1-b79c-d36b5ef6f3eb', name: 'Jordan Daigle', school: 'LSU', committed_year: 2013, peak_ranking: 4 },
  { id: '13b3b020-597b-47c0-86a6-cd315996bc44', name: 'Stefan Monroe', school: 'LSU', committed_year: 2014, peak_ranking: 12 },
  { id: '25434f34-0e96-4045-9c95-525f3dbfa448', name: 'Nick Samardzic', school: 'LSU', committed_year: 2015, peak_ranking: 3 },
  { id: '85e5ebda-a087-42de-bd63-5eba77926cc7', name: 'Ronald Hohmann', school: 'LSU', committed_year: 2019, peak_ranking: 1 },

  // ── PEPPERDINE ───────────────────────────────────────────────────────────
  { id: 'e5b2df58-db77-4c8b-9cc8-8d3dd66fbd7e', name: 'Alex Llompart', school: 'Pepperdine', committed_year: 2009, peak_ranking: 8 },
  { id: '561c7b4d-7ee8-4f86-a97d-b1c6a9f448ad', name: 'Sam Menichella', school: 'Pepperdine', committed_year: 2013, peak_ranking: 14 },

  // ── SOUTH CAROLINA ───────────────────────────────────────────────────────
  { id: '41f6e3df-4746-4301-aa70-5ca153ceb39c', name: 'Austin Adams', school: 'South Carolina', committed_year: 2011, peak_ranking: 12 },
  { id: '568aff8c-526f-4db3-b539-1c813f79b13e', name: 'Alex Schafer', school: 'South Carolina', committed_year: 2013, peak_ranking: 10 },
  { id: 'c4c7f309-e46b-4cc6-b7b0-2332d38768a2', name: 'Toby Mayronne', school: 'South Carolina', committed_year: 2014, peak_ranking: 3 },
  { id: 'e27155c6-eb7c-4d8d-aa45-9c0a19caa6e4', name: 'Yannick Dennis', school: 'South Carolina', committed_year: 2015, peak_ranking: 10 },

  // ── WISCONSIN ────────────────────────────────────────────────────────────
  { id: 'bd6a70e7-b6d6-4b11-9e4a-30e7310b8c2e', name: 'Quentin Vega', school: 'Wisconsin', committed_year: 2011, peak_ranking: 9 },
  { id: 'e624db75-a469-46d2-a704-50eeeb73e92d', name: 'Chase Colton', school: 'Wisconsin', committed_year: 2016, peak_ranking: 5 },

  // ── KENTUCKY ─────────────────────────────────────────────────────────────
  { id: '240734c3-1f1b-4f9c-8e3e-cb71d0ec9af7', name: 'Alejandro Gonzalez', school: 'Kentucky', committed_year: 2005, peak_ranking: 10 },
  { id: '34173d69-79ad-49e9-8f17-58c9f5815f6d', name: 'Eric Quigley', school: 'Kentucky', committed_year: 2008, peak_ranking: 5 },
  { id: '02f97b2a-1a5e-4422-8e3e-a799893388e9', name: 'Tyler Yates', school: 'Kentucky', committed_year: 2014, peak_ranking: 10 },
];

// ─── HELPERS (same as v1) ────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers, timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': buf.length },
      timeout: 30000
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

async function callClaude(prompt) {
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });
  const res = await httpsPost('api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01'
  }, body);
  return JSON.parse(res.body);
}

async function searchDDG(query) {
  const q = encodeURIComponent(query);
  try {
    const res = await httpsGet('html.duckduckgo.com', `/html/?q=${q}`, {
      'User-Agent': 'Mozilla/5.0 (compatible; research bot)',
      'Accept': 'text/html'
    });
    const urls = [];
    const re = /uddg=([^"&\s]+)/g;
    let m;
    while ((m = re.exec(res.body)) !== null) {
      try { urls.push(decodeURIComponent(m[1])); } catch(e) {}
    }
    return urls.slice(0, 6);
  } catch(e) { return []; }
}

async function fetchPage(url) {
  try {
    const u = new URL(url);
    const res = await httpsGet(u.hostname, u.pathname + (u.search || ''), {
      'User-Agent': 'Mozilla/5.0 (compatible; research bot)',
      'Accept': 'text/html'
    });
    return res.body
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim().slice(0, 12000);
  } catch(e) { return ''; }
}

async function getBioText(player) {
  const queries = [
    `"${player.name}" ${player.school} tennis singles wins losses career stats`,
    `${player.name} ${player.school} men tennis ITA ranking All-American`,
  ];

  const goodDomains = [
    'gostanford.com', 'fightingillini.com', 'yalebulldogs.com', 'calbears.com',
    'lsusports.net', 'pepperdinewaves.com', 'gamecocksonline.com', 'uwbadgers.com',
    'ukathletics.com', 'wikipedia.org', 'collegetennis', 'itftennis'
  ];

  let best = '';
  for (const query of queries) {
    const urls = await searchDDG(query);
    for (const url of urls) {
      const isGood = goodDomains.some(d => url.includes(d));
      if (isGood || url.includes('tennis')) {
        const text = await fetchPage(url);
        const lastName = player.name.split(' ').pop().toLowerCase();
        if (text.length > best.length && text.toLowerCase().includes(lastName)) {
          best = text;
          if (best.length > 3000) break;
        }
      }
    }
    if (best.length > 2000) break;
    await sleep(500);
  }
  return best;
}

async function extractStats(player, bioText) {
  const context = bioText.length > 200 ? bioText.slice(0, 8000) :
    `Player ${player.name} played at ${player.school} starting ${player.committed_year}, peak junior ranking #${player.peak_ranking}.`;

  const res = await callClaude(`Extract college tennis career stats for ${player.name} who played at ${player.school} (enrolled ${player.committed_year}, peak junior rank #${player.peak_ranking}).

Source text:
${context}

Return ONLY valid JSON, no markdown:
{
  "career_singles_wins": number or null,
  "career_singles_losses": number or null,
  "career_doubles_wins": number or null,
  "career_doubles_losses": number or null,
  "peak_ita_ranking": number or null,
  "years_played": number or null,
  "honors": {
    "national": [],
    "regional": [],
    "conference": [],
    "team": []
  },
  "career_summary": "2-3 sentence narrative about their college career"
}

Only college stats, not professional. Use null if not found. Always write career_summary.`);

  const text = res.content?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch(e) {} }
  return null;
}

async function upsert(player, stats) {
  const record = {
    junior_profile_id: player.id,
    school: player.school,
    start_year: player.committed_year,
    years_played: stats.years_played,
    career_singles_wins: stats.career_singles_wins,
    career_singles_losses: stats.career_singles_losses,
    career_doubles_wins: stats.career_doubles_wins,
    career_doubles_losses: stats.career_doubles_losses,
    peak_ita_ranking: stats.peak_ita_ranking,
    honors: stats.honors || { national: [], regional: [], conference: [], team: [] },
    career_summary: stats.career_summary,
    source_url: 'web-enrichment-v2'
  };

  const body = JSON.stringify(record);
  const res = await httpsPost('bljcniglmbdvipkvfaoi.supabase.co',
    '/rest/v1/college_careers', {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    }, body);
  return res.status;
}

async function main() {
  const eligible = PLAYERS.filter(p => p.committed_year <= 2021);
  console.log(`Processing ${eligible.length} players (skipping ${PLAYERS.length - eligible.length} still playing)\n`);

  let ok = 0, failed = 0;

  for (let i = 0; i < eligible.length; i++) {
    const player = eligible[i];
    console.log(`[${i+1}/${eligible.length}] ${player.school} — ${player.name} (#${player.peak_ranking}, ${player.committed_year})`);

    try {
      const bio = await getBioText(player);
      console.log(`  Bio: ${bio.length} chars`);

      const stats = await extractStats(player, bio);
      if (!stats) { console.log('  ✗ Extract failed'); failed++; continue; }

      console.log(`  Singles: ${stats.career_singles_wins ?? '?'}-${stats.career_singles_losses ?? '?'} | ITA peak: ${stats.peak_ita_ranking ?? '?'}`);
      console.log(`  ${stats.career_summary?.slice(0, 90)}...`);

      const status = await upsert(player, stats);
      if (status === 201 || status === 200) {
        console.log(`  ✓ Saved`);
        ok++;
      } else {
        console.log(`  ✗ Supabase ${status}`);
        failed++;
      }
    } catch(e) {
      console.log(`  ✗ Error: ${e.message}`);
      failed++;
    }

    await sleep(2500);
  }

  console.log(`\nDone: ${ok} saved, ${failed} failed`);
}

main().catch(console.error);
