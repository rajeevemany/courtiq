import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { recruit_id, type, date, notes, author } = body

    // Insert the interaction
    const { error: interactionError } = await supabase
      .from('interactions')
      .insert({ recruit_id, type, date, notes, author })

    if (interactionError) throw interactionError

    // Update last_contacted on the recruit
    const { error: recruitError } = await supabase
      .from('recruits')
      .update({ last_contacted: date })
      .eq('id', recruit_id)

    if (recruitError) throw recruitError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Failed to log contact' }, { status: 500 })
  }
}