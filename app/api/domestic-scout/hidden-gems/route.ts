import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('domestic_rankings')
      .select('*')
      .eq('is_hidden_gem', true)
      .order('domestic_rank', { ascending: true })

    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error('[domestic-scout/hidden-gems] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    )
  }
}
