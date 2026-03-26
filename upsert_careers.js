/**
 * CourtIQ — College Career Data Enrichment Script
 * Run: ANTHROPIC_API_KEY=... SUPABASE_SERVICE_KEY=... node upsert_careers.js
 */

const https = require('https');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = 'bljcniglmbdvipkvfaoi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!ANTHROPIC_KEY || !SUPABASE_KEY) {
  console.error('Set ANTHROPIC_API_KEY and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const PLAYERS = [
  // ── VIRGINIA ─────────────────────────────────────────────────────────────
  { id: '3eaa6427-78f7-4ec3-9c68-ba36a3201ed1', name: 'Thai-Son Kwiatkowski', school: 'Virginia', committed_year: 2013, peak_ranking: 1 },
  { id: '56af3893-2fe8-4e6f-b87d-862a911459e7', name: 'Luca Corinteli', school: 'Virginia', committed_year: 2013, peak_ranking: 3 },
  { id: 'b1176318-6e68-44fb-a556-7f0a8feeec72', name: 'Henrik Wiersholm', school: 'Virginia', committed_year: 2014, peak_ranking: 1 },
  { id: '65734014-17b7-44ac-92af-2baf9d52a3c9', name: 'Chris Altamirano', school: 'Virginia', committed_year: 2014, peak_ranking: 1 },
  { id: '3621e7e1-cadc-4973-a368-cb0edcc9e569', name: 'Mac Lord', school: 'Virginia', committed_year: 2017, peak_ranking: 6 },
  { id: '163d13ea-87c8-4bae-8b7e-a3f679f84ffa', name: 'Ryan Shane', school: 'Virginia', committed_year: 2017, peak_ranking: 2 },
  { id: 'd9ac543a-a0a6-47c8-91ca-41c98e1a5d0a', name: 'Ryan Goetz', school: 'Virginia', committed_year: 2018, peak_ranking: 5 },
  { id: '738e1552-d9fc-4a08-bfaa-02896defc83b', name: 'William Woodall', school: 'Virginia', committed_year: 2018, peak_ranking: 9 },
  { id: '608b3e63-3f5f-4894-9240-c1213c86d905', name: 'Collin Alshon', school: 'Virginia', committed_year: 2019, peak_ranking: 2 },
  { id: '2f1f928e-38c0-4cce-b29c-145b56293929', name: 'Brandon Nakashima', school: 'Virginia', committed_year: 2019, peak_ranking: 1 },
  { id: '82a50fe2-ab23-45aa-b910-2941cbbd1d2e', name: 'Alex Kiefer', school: 'Virginia', committed_year: 2020, peak_ranking: 10 },

  // ── GEORGIA TECH ─────────────────────────────────────────────────────────
  { id: 'fb3f3d2f-c862-40d5-a1c9-456700360181', name: 'Kevin King', school: 'Georgia Tech', committed_year: 2008, peak_ranking: 6 },
  { id: 'c2a5de1e-d480-48af-a92d-c302241c1692', name: 'Robby Smith', school: 'Georgia Tech', committed_year: 2007, peak_ranking: 12 },
  { id: 'fd7b3076-80d8-40ca-b40a-44912cb668e1', name: 'Christopher Eubanks', school: 'Georgia Tech', committed_year: 2014, peak_ranking: 14 },
  { id: '71c647d9-83b2-44fc-8566-96b5a6186be9', name: 'Cory Kay', school: 'Georgia Tech', committed_year: 2012, peak_ranking: 15 },
  { id: 'c50341ec-1667-4b95-9ab1-397fbff70bf7', name: 'Marcus Kay', school: 'Georgia Tech', committed_year: 2014, peak_ranking: 14 },
  { id: '6996770e-5037-4879-b6d7-93fb526067ba', name: 'Christopher Yun', school: 'Georgia Tech', committed_year: 2016, peak_ranking: 9 },
  { id: '223ae3a9-cadc-4471-88ea-f09481b852ad', name: 'Andres Martin', school: 'Georgia Tech', committed_year: 2019, peak_ranking: 5 },
  { id: '5686db52-aea4-495f-9f2e-303fcecb4e5c', name: 'Keshav Chopra', school: 'Georgia Tech', committed_year: 2019, peak_ranking: 10 },

  // ── HARVARD ──────────────────────────────────────────────────────────────
  { id: '64bf192d-996f-4b51-9876-de55ae7570a3', name: 'Daniel Nguyen', school: 'Harvard', committed_year: 2011, peak_ranking: 7 },
  { id: '0f5192f2-34ca-4cb7-bd36-2b7f56b356ae', name: 'Casey MacMaster', school: 'Harvard', committed_year: 2010, peak_ranking: 10 },
  { id: '359bc07b-27e7-4eee-99bf-8c7e75783939', name: 'Graeme Solomon', school: 'Harvard', committed_year: 2014, peak_ranking: 3 },
  { id: '1fd57ac6-9d08-44b5-9586-8dc93a23f951', name: 'Andy Zhou', school: 'Harvard', committed_year: 2015, peak_ranking: 14 },
  { id: '888826dc-4e04-4f2b-bb65-d348359b2fec', name: 'Linus Leschly', school: 'Harvard', committed_year: 2016, peak_ranking: 10 },
  { id: '9d1fad3d-a896-4411-926d-96f632b2c2dc', name: 'Brian Shi', school: 'Harvard', committed_year: 2018, peak_ranking: 5 },
  { id: '3761cf15-bfb4-404d-9044-f6cac562d737', name: 'Arthur Yim', school: 'Harvard', committed_year: 2019, peak_ranking: 3 },
  { id: 'a58579aa-4c93-45d7-b3d8-cec0a83e062a', name: 'Roshan Jachuck', school: 'Harvard', committed_year: 2019, peak_ranking: 9 },
  { id: '78e8dea6-b9fa-4fb8-927b-a95bcfa86643', name: 'David Lins', school: 'Harvard', committed_year: 2020, peak_ranking: 4 },

  // ── NOTRE DAME ───────────────────────────────────────────────────────────
  { id: 'd833c49d-a41f-4e96-8ee0-2334529b10f9', name: 'Billy Helgeson', school: 'Notre Dame', committed_year: 2005, peak_ranking: 8 },
  { id: 'c7824ae9-cd7c-40e9-8105-2dc55b98a6f1', name: 'Casey Watt', school: 'Notre Dame', committed_year: 2008, peak_ranking: 5 },
  { id: '2211e86d-edf8-44be-895b-1fc2e00d192a', name: 'Greg Andrews', school: 'Notre Dame', committed_year: 2010, peak_ranking: 5 },
  { id: 'ae99d301-5047-45a9-a7c0-9f3589f81a39', name: 'Billy Pecor', school: 'Notre Dame', committed_year: 2010, peak_ranking: 6 },
  { id: 'ac7a34a4-a9ad-4129-a5ce-8915a276052a', name: 'William McCoy', school: 'Notre Dame', committed_year: 2011, peak_ranking: 3 },
  { id: '59427550-d56f-4011-80af-e6f30add6d8f', name: 'Dennis Dawson', school: 'Notre Dame', committed_year: 2014, peak_ranking: 7 },
  { id: 'a3bdb7d3-6b78-40ff-b556-8d9a43712ac3', name: 'Matt Gamble', school: 'Notre Dame', committed_year: 2016, peak_ranking: 8 },
  { id: 'a2a14a43-4c6b-4c7f-b042-3dc9eb6f123a', name: 'Joshua Small', school: 'Notre Dame', committed_year: 2016, peak_ranking: 7 },
  { id: 'b41e86e5-86fc-4dbb-a52d-985a4f65b200', name: 'Alex Nefve', school: 'Notre Dame', committed_year: 2018, peak_ranking: 11 },
  { id: '0f1623dd-b850-4cdf-80df-358130618ad6', name: 'Josh Corsillo', school: 'Notre Dame', committed_year: 2021, peak_ranking: 6 },

  // ── PENN ─────────────────────────────────────────────────────────────────
  { id: '5a3793f4-fc97-4de3-ae26-1a9e0f984683', name: 'Jared Pinsky', school: 'Penn', committed_year: 2004, peak_ranking: 13 },
  { id: 'e6c1d65f-90bb-4d6f-b2e8-48ca7ffbee62', name: 'Alex Huryn', school: 'Penn', committed_year: 2017, peak_ranking: 7 },
  { id: '4ae9e4fd-1d85-4d91-86c3-5785e9e7bbee', name: 'Nick Makarome', school: 'Penn', committed_year: 2017, peak_ranking: 13 },
  { id: 'd43d7a9d-239e-40f3-a9b1-2e2941541678', name: 'Kevin Zhu', school: 'Penn', committed_year: 2018, peak_ranking: 7 },
  { id: '4d444a2a-ff9a-4d70-b5e4-ccc6240b7a4e', name: 'Benson Sai', school: 'Penn', committed_year: 2021, peak_ranking: 1 },

  // ── CORNELL ──────────────────────────────────────────────────────────────
  { id: '710bb341-89ac-40d3-875b-d30a40a30d23', name: 'David Riggs', school: 'Cornell', committed_year: 2011, peak_ranking: 18 },
  { id: 'bb13682c-1023-4b1e-86e8-dc5f500b3cdb', name: 'Kyle Arem', school: 'Cornell', committed_year: 2014, peak_ranking: 4 },
  { id: 'ceff41e4-6082-4fe2-b2da-b8d0f5ca4744', name: 'Chris Vrabel', school: 'Cornell', committed_year: 2013, peak_ranking: 18 },
  { id: 'df2219a3-73bd-4f9f-97c9-48e163a848e5', name: 'Peter Rimondini', school: 'Cornell', committed_year: 2016, peak_ranking: 17 },
  { id: 'e1b18dcb-35f6-4c89-9879-710dc5b3581f', name: 'Arjun Sinha', school: 'Cornell', committed_year: 2021, peak_ranking: 13 },

  // ── YALE ─────────────────────────────────────────────────────────────────
  // Yale IDs — need from DB but using what we have from previous queries
  // Will add after getting IDs

  // ── CLEMSON ──────────────────────────────────────────────────────────────
  { id: '160929f1-f0e8-4a84-9c58-b4dccce91b1f', name: 'Hunter Harrington', school: 'Clemson', committed_year: 2011, peak_ranking: 10 },
  { id: 'f89dbe2f-5e75-465e-93eb-169b532e7066', name: 'Alafia Ayeni', school: 'Clemson', committed_year: 2012, peak_ranking: 15 },
  { id: 'c0a86ca1-b5cd-463a-a0a4-d8ad02758e82', name: 'Sam Whitaker', school: 'Clemson', committed_year: 2020, peak_ranking: 4 },

  // ── VANDERBILT ───────────────────────────────────────────────────────────
  { id: '5fe1342f-d121-4d66-8834-a2fc22b022d6', name: 'Rhyne Lipman', school: 'Vanderbilt', committed_year: 2009, peak_ranking: 3 },
  { id: '297eea07-768a-4940-8c36-46a96ac94b5a', name: 'Graydon Austin', school: 'Vanderbilt', committed_year: 2011, peak_ranking: 1 },
  { id: '6b4778df-296a-4cfe-970c-2e2aa0533ebd', name: 'Kevin Yee', school: 'Vanderbilt', committed_year: 2012, peak_ranking: 2 },
  { id: '6c96fe4e-d209-4038-aaf4-d0c9abdfeb0b', name: 'Ryan Smith', school: 'Vanderbilt', committed_year: 2013, peak_ranking: 8 },
  { id: '4aea40fb-6c2f-4d98-9718-672db790273d', name: 'Dimitar Stefan', school: 'Vanderbilt', committed_year: 2015, peak_ranking: 5 },
  { id: 'e8dd8285-a2b1-4dc4-b00d-441a4fb067ab', name: 'Chase Klinger', school: 'Vanderbilt', committed_year: 2015, peak_ranking: 4 },
  { id: 'e8cb8353-2f68-46ac-8fe2-2ac6326b91c6', name: 'Maciej Zieba', school: 'Vanderbilt', committed_year: 2019, peak_ranking: 5 },
  { id: '337c47a8-a874-403b-9cdc-0527f455617d', name: 'Marcus Ross', school: 'Vanderbilt', committed_year: 2021, peak_ranking: 6 },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
  const athleticDomains = [
    'virginiasports.com', 'ramblinwreck.com', 'gocrimson.com',
    'fightingirish.com', 'pennathletics.com', 'cornellbigred.com',
    'clemsontigers.com', 'vucommodores.com', 'gostanford.com',
    'yalebulldogs.com', 'collegetennistoday.com', 'collegetennis.com'
  ];

  const queries = [
    `"${player.name}" ${player.school} tennis singles wins losses career`,
    `${player.name} ${player.school} men tennis ITA ranking career stats`,
  ];

  let best = '';
  for (const query of queries) {
    const urls = await searchDDG(query);
    for (const url of urls) {
      const isAthletic = athleticDomains.some(d => url.includes(d));
      const isWiki = url.includes('wikipedia.org');
      const isStats = url.includes('tennis') || url.includes('sport');
      if (isAthletic || isWiki || isStats) {
        const text = await fetchPage(url);
        if (text.length > best.length && 
            (text.toLowerCase().includes(player.name.split(' ').pop().toLowerCase()) ||
             text.toLowerCase().includes(player.school.toLowerCase()))) {
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

Return ONLY valid JSON, no markdown fences:
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
  "career_summary": "2-3 sentence narrative"
}

Only college stats. If stats not found use null. Always write career_summary.`);

  const text = res.content?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch(e) {}
  }
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
    source_url: 'web-enrichment-script'
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  // Skip players still playing (committed 2023+)
  const eligible = PLAYERS.filter(p => p.committed_year <= 2022);
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
