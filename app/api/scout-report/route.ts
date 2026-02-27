import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Update this model ID as needed — user specified "claude-sonnet-4-20250514"
const MODEL = 'claude-sonnet-4-5-20251001'

export async function POST(req: Request) {
  try {
    const { recruit_id } = await req.json()

    // Fetch recruit details
    const { data: recruit, error: rErr } = await supabase
      .from('recruits')
      .select('name, national_ranking, class_year, nationality, fit_score, utr_rating, notes')
      .eq('id', recruit_id)
      .single()

    if (rErr || !recruit) {
      return NextResponse.json({ error: 'Recruit not found' }, { status: 404 })
    }

    // Fetch last 20 match results
    const { data: matchResults } = await supabase
      .from('match_results')
      .select('tournament_name, tournament_grade, surface, round, opponent_name, opponent_nationality, score, result, match_date, source')
      .eq('recruit_id', recruit_id)
      .order('match_date', { ascending: false })
      .limit(20)

    const formattedMatches = (matchResults ?? [])
      .map(m => {
        const grade = m.tournament_grade ? ` (${m.tournament_grade})` : ''
        const surf  = m.surface ? ` [${m.surface}]` : ''
        const nat   = m.opponent_nationality ? ` (${m.opponent_nationality})` : ''
        return `${m.result} — ${m.round} vs ${m.opponent_name}${nat} · ${m.score || 'n/a'} · ${m.tournament_name}${grade}${surf}`
      })
      .join('\n')

    const matchSummary = formattedMatches || 'No match results available.'

    const userPrompt = `Player: ${recruit.name}, Ranking: #${recruit.national_ranking ?? 'N/A'}, Class: ${recruit.class_year}, UTR: ${recruit.utr_rating ?? 'N/A'}, Fit Score: ${recruit.fit_score ?? 'N/A'}/100

Recent match results:
${matchSummary}

Write a 3-sentence scouting report highlighting: (1) best quality wins or competitive performances, (2) any patterns in wins/losses (surface, opponent level), (3) overall assessment of college readiness. Then on a new line write 'OUTREACH:' followed by a personalized 2-3 sentence first-contact text message a college coach could send via text or Instagram DM. Make it specific to their recent results, not generic.`

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: 'You are an expert college tennis recruiting analyst. Analyze match results and provide actionable scouting intelligence for a college coach.',
      messages: [{ role: 'user', content: userPrompt }],
    })

    const fullText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    // Split on OUTREACH: to get the two parts
    const outreachIdx = fullText.indexOf('OUTREACH:')
    const scoutingNote     = outreachIdx >= 0 ? fullText.slice(0, outreachIdx).trim() : fullText.trim()
    const outreachMessage  = outreachIdx >= 0 ? fullText.slice(outreachIdx + 'OUTREACH:'.length).trim() : ''

    // Append scouting note to recruit's notes field (no separate scouting_notes column)
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const appendedNote = recruit.notes
      ? `${recruit.notes}\n\n---\nScout Report (${timestamp}):\n${scoutingNote}`
      : `Scout Report (${timestamp}):\n${scoutingNote}`

    await supabase
      .from('recruits')
      .update({ notes: appendedNote })
      .eq('id', recruit_id)

    return NextResponse.json({ success: true, scouting_note: scoutingNote, outreach_message: outreachMessage })
  } catch (err) {
    console.error('Scout report error:', err)
    return NextResponse.json({ success: false, error: 'Failed to generate scout report' }, { status: 500 })
  }
}
