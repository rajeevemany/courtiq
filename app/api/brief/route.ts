import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(request: Request) {
  try {
    const { recruit_id } = await request.json()

    // Fetch recruit data
    const { data: recruit, error: recruitError } = await supabase
      .from('recruits')
      .select('*')
      .eq('id', recruit_id)
      .single()

    if (recruitError || !recruit) throw new Error('Recruit not found')

    // Fetch interactions
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('recruit_id', recruit_id)
      .order('date', { ascending: false })

    // Build interaction summary
    const interactionSummary = interactions && interactions.length > 0
      ? interactions.map(i =>
          `${i.type.toUpperCase()} on ${i.date}: ${i.notes}${i.author ? ` (logged by ${i.author})` : ''}`
        ).join('\n')
      : 'No interactions logged yet.'

    // Build the prompt
    const prompt = `You are an assistant helping a college tennis coach evaluate a recruit. Based on the following information, write a concise, coach-ready brief of 3-4 sentences. Focus on playing identity, program fit, relationship status, and any risks or open questions. Be direct and practical — this is for a busy coach, not a report.

RECRUIT INFORMATION:
Name: ${recruit.name}
Class Year: ${recruit.class_year}
Nationality: ${recruit.nationality}
Location: ${recruit.location}
National Ranking: ${recruit.national_ranking ? `#${recruit.national_ranking}` : 'Unranked'}
Plays: ${recruit.plays}
Priority: ${recruit.priority}
Program Fit Score: ${recruit.fit_score}/100
Status: ${recruit.status}
Competing Schools: ${recruit.competing_schools?.join(', ') || 'None logged'}

SCOUTING NOTES:
${recruit.notes || 'No scouting notes added yet.'}

INTERACTION HISTORY:
${interactionSummary}

Write the brief now. Do not use headers or bullet points. Write in plain prose as if briefing the head coach before a call.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    })

    const brief = completion.choices[0].message.content

    // Save the brief back to the recruit record
    await supabase
      .from('recruits')
      .update({ ai_brief: brief, ai_brief_generated_at: new Date().toISOString() })
      .eq('id', recruit_id)

    return NextResponse.json({ success: true, brief })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate brief' },
      { status: 500 }
    )
  }
}