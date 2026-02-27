import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function csvEscape(val: unknown): string {
  const str = String(val ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const recruitId = req.nextUrl.searchParams.get('recruit_id')

  // Note: the app uses "interactions" table (not "contact_logs")
  let query = supabase
    .from('interactions')
    .select(`
      date,
      type,
      notes,
      author,
      recruits (name, national_ranking, class_year)
    `)

  if (recruitId && recruitId !== 'all') {
    query = query.eq('recruit_id', recruitId)
  }

  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const header = 'recruit_name,recruit_ranking,class_year,contact_date,contact_type,notes,coach_name'

  const rows = (data ?? []).map((row) => {
    const r = row.recruits as unknown as { name: string; national_ranking: number; class_year: number } | null
    return [
      csvEscape(r?.name),
      csvEscape(r?.national_ranking),
      csvEscape(r?.class_year),
      csvEscape(row.date),
      csvEscape(row.type),
      csvEscape(row.notes),
      csvEscape(row.author),
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="arms-export.csv"',
    },
  })
}
