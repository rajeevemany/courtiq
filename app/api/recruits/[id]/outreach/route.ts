import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch recruit
    const { data: recruit, error: recruitError } = await supabase
      .from('recruits')
      .select('*')
      .eq('id', id)
      .single()

    if (recruitError || !recruit) {
      return NextResponse.json({ success: false, error: 'Recruit not found' }, { status: 404 })
    }

    // Fetch interactions (most recent first)
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('recruit_id', id)
      .order('date', { ascending: false })

    // Fetch match results if any
    const { data: matchResults } = await supabase
      .from('match_results')
      .select('*')
      .eq('recruit_id', id)
      .order('match_date', { ascending: false })
      .limit(5)

    const stage = recruit.recruit_stage ?? 'Identification'

    // Build stage-specific user prompt
    let userPrompt: string

    if (stage === 'Identification' || stage === null) {
      userPrompt = `Write a first contact email to ${recruit.name}, a ${
        recruit.national_ranking ? `#${recruit.national_ranking}-ranked` : 'highly ranked'
      } junior from ${recruit.location || 'the US'}. Keep it under 150 words. Express genuine interest, mention one specific thing about their game or ranking, and invite them to learn more about Columbia University Men's Tennis.`
    } else if (stage === 'Contacted' || stage === 'Interested') {
      const recentInteractions = interactions?.slice(0, 2)
        .map(i => `${i.type} on ${i.date}: ${i.notes}`)
        .join('; ') || 'no recent interactions on file'

      userPrompt = `Write a follow-up email to ${recruit.name} who we've been in contact with at Columbia. Recent interactions: ${recentInteractions}. Keep it under 200 words. Move the relationship forward — suggest a campus visit or call.`
    } else {
      // Offer stage
      userPrompt = `Write a formal offer communication to ${recruit.name}. Keep it under 250 words. Be direct about our interest, mention Columbia's recent success including an NCAA Sweet 16 appearance and multiple Ivy League titles, and create appropriate urgency.`
    }

    // Build context suffix with match results if available
    let contextSuffix = ''
    if (matchResults && matchResults.length > 0) {
      const resultsSummary = matchResults
        .map(m => `${m.opponent || 'opponent'} (${m.score || 'score N/A'})`)
        .join(', ')
      contextSuffix = `\n\nRecent match results for context: ${resultsSummary}`
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system:
        'You are a college tennis coach\'s assistant. You are writing on behalf of Howard Endelman, Head Coach of Columbia University Men\'s Tennis. Sign all emails as: Howard Endelman, Head Coach, Columbia University Men\'s Tennis. Always refer to the program as "Columbia" specifically, never as "[University]". Write a concise, genuine recruiting email draft. No fluff, no excessive flattery. Sound like a real coach who has done their homework, not a form letter.',
      messages: [
        {
          role: 'user',
          content: `${userPrompt}${contextSuffix}\n\nReturn your response as JSON with this exact shape: { "subject": "...", "body": "..." }`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : null
    if (!raw) throw new Error('Empty response from Claude')

    // Parse JSON — strip any markdown fences if present
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse JSON from response')
    const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string }

    return NextResponse.json({ success: true, subject: parsed.subject, body: parsed.body, stage })
  } catch (error) {
    console.error('[outreach] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate email draft' }, { status: 500 })
  }
}
