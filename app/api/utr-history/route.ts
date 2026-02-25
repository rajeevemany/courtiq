import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { recruit_id, utr_rating, recorded_date, source } = await request.json()

    const { data, error } = await supabase
      .from('utr_history')
      .insert({ recruit_id, utr_rating, recorded_date, source: source || 'manual' })
      .select()
      .single()

    if (error) throw error

    // Update current UTR on recruit
    await supabase
      .from('recruits')
      .update({ utr_rating })
      .eq('id', recruit_id)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    const { error } = await supabase
      .from('utr_history')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}