import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const contactType: 'initial' | 'followup' = body.contactType ?? 'initial'
    const outreachFormat: 'email' | 'text' = body.outreachFormat ?? 'email'

    const { data: recruit, error: recruitError } = await supabase
      .from('recruits')
      .select('*')
      .eq('id', id)
      .single()

    if (recruitError || !recruit) {
      return NextResponse.json({ success: false, error: 'Recruit not found' }, { status: 404 })
    }

    const recruitName = recruit.name
    const peakRanking = recruit.national_ranking
    const location = recruit.location ?? 'the US'
    const recruitStage =
      body.recruitStage ?? recruit.recruit_stage ?? recruit.status ?? 'Identification'

    const key = `${contactType}-${outreachFormat}`

    const prompts: Record<string, string> = {
      'initial-email': `Write a formal recruiting email from Howard Endelman, \
Head Coach of Columbia University Men's Tennis, to ${recruitName} \
(ranked #${peakRanking} nationally, from ${location}).
- Formal tone, 3-4 paragraphs
- Mention Columbia's Ivy League academics and NYC location
- Reference their ranking and what Columbia's program can offer
- End with a clear next step (campus visit, phone call)
- Sign as: Howard Endelman, Head Coach, Columbia University Men's Tennis
Return JSON: { "subject": "...", "body": "..." }`,

      'initial-text': `Write a brief, warm text message from Coach Endelman \
to ${recruitName} making first contact.
- Casual, conversational, 3-5 sentences max
- Mention you've been following their game
- Invite them to learn more about Columbia tennis
- No formal sign-off needed, just "- Coach Endelman"
Return JSON: { "subject": null, "body": "..." }`,

      'followup-email': `Write a formal follow-up recruiting email from Howard Endelman \
to ${recruitName} who is currently at stage: ${recruitStage}.
- Reference previous contact
- Move the conversation forward based on their stage
- 2-3 paragraphs, professional tone
- Clear call to action
- Sign as: Howard Endelman, Head Coach, Columbia University Men's Tennis
Return JSON: { "subject": "...", "body": "..." }`,

      'followup-text': `Write a brief follow-up text from Coach Endelman \
to ${recruitName} (currently: ${recruitStage} stage).
- Very casual, 2-3 sentences
- Check in, move conversation forward
- No formal sign-off
Return JSON: { "subject": null, "body": "..." }`,
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system:
        "You are Howard Endelman, Head Coach of Columbia University Men's Tennis. " +
        "Write authentic, concise recruiting outreach. Never use placeholder text like [Name] or [University]. " +
        "Always refer to the program as 'Columbia'.",
      messages: [{ role: 'user', content: prompts[key] }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : null
    if (!raw) throw new Error('Empty response from Claude')

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not parse JSON from response')
    const parsed = JSON.parse(jsonMatch[0]) as { subject: string | null; body: string }

    return NextResponse.json({
      success: true,
      subject: parsed.subject,
      body: parsed.body,
      format: outreachFormat,
    })
  } catch (error) {
    console.error('[outreach] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate draft' }, { status: 500 })
  }
}
