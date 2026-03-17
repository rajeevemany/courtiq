import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: Request) {
  console.log('[brief] route hit - version 2')
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

    // Fetch most recent documents (up to 5)
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('recruit_id', recruit_id)
      .order('created_at', { ascending: false })
      .limit(5)

    console.log('[brief] documents found:', documents?.length ?? 0, documents?.map(d => d.name))

    // Build interaction summary
    const interactionSummary = interactions && interactions.length > 0
      ? interactions.map(i =>
          `${i.type.toUpperCase()} on ${i.date}: ${i.notes}${i.author ? ` (logged by ${i.author})` : ''}`
        ).join('\n')
      : 'No interactions logged yet.'

    // Build prompt text
    const promptText = `You are a college tennis recruiting assistant. Write a 4-5 sentence AI brief for a busy coach preparing for a call or evaluation.

Use the structured recruit data below AND any uploaded documents (scouting reports, tournament draws, match results, emails) to write a brief that covers:
- Player's current ranking and recent results
- Key strengths and any concerns
- Fit with the program and competing schools
- Recommended next action

Be specific — reference actual results, rankings, or details from the documents if available. Write in plain prose, no headers or bullets.

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
${interactionSummary}`

    // Build content blocks — PDF documents first, then the text prompt
    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }
      | { type: 'text'; text: string }

    const contentBlocks: ContentBlock[] = []

    for (const doc of documents ?? []) {
      if (doc.type !== 'application/pdf') continue

      try {
        const { data: signedData } = await supabase.storage
          .from('recruit-documents')
          .createSignedUrl(doc.storage_path, 60)

        if (!signedData?.signedUrl) continue

        const res = await fetch(signedData.signedUrl)
        if (!res.ok) continue

        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')

        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        })
      } catch {
        // Skip documents that fail to fetch
      }
    }

    contentBlocks.push({ type: 'text', text: promptText })

    console.log('[brief] content block types:', contentBlocks.map((b: any) => b.type))

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: contentBlocks }],
    })

    const brief = message.content[0].type === 'text' ? message.content[0].text : null

    // Save the brief back to the recruit record
    await supabase
      .from('recruits')
      .update({ ai_brief: brief, ai_brief_generated_at: new Date().toISOString() })
      .eq('id', recruit_id)

    return NextResponse.json({ success: true, brief })
  } catch (error) {
    console.error('[brief] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate brief' },
      { status: 500 }
    )
  }
}
