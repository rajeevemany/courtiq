import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { recruit_id, scores } = await request.json()

    // Get program profile for weights
    const { data: profile } = await supabase
      .from('program_profiles')
      .select('criteria')
      .single()

    if (!profile) throw new Error('No program profile found')

    const criteria = profile.criteria
    let totalWeight = 0
    let weightedScore = 0
    const breakdown: Record<string, { label: string, score: number, weight: number, weighted: number }> = {}

    // Calculate weighted score
    for (const [key, value] of Object.entries(criteria)) {
      const criterion = value as { label: string, weight: number, description: string }
      const score = scores[key] || 0
      const weighted = (score / 10) * criterion.weight
      totalWeight += criterion.weight
      weightedScore += weighted
      breakdown[key] = {
        label: criterion.label,
        score,
        weight: criterion.weight,
        weighted: Math.round(weighted * 10) / 10
      }
    }

    // Normalize to 0-100
    const fitScore = Math.round((weightedScore / totalWeight) * 100)

    // Save to recruit
    const { error } = await supabase
      .from('recruits')
      .update({
        fit_score: fitScore,
        fit_score_breakdown: breakdown
      })
      .eq('id', recruit_id)

    if (error) throw error

    return NextResponse.json({ success: true, fitScore, breakdown })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}