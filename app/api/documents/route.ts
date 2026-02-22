import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recruitId = searchParams.get('recruit_id')

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('recruit_id', recruitId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const recruitId = formData.get('recruit_id') as string
    const uploadedBy = formData.get('uploaded_by') as string

    if (!file || !recruitId) {
      return NextResponse.json({ success: false, error: 'Missing file or recruit ID' }, { status: 400 })
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const storagePath = `${recruitId}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('recruit-documents')
      .upload(storagePath, file)

    if (uploadError) throw uploadError

    // Save document record
    const { data, error: dbError } = await supabase
      .from('documents')
      .insert({
        recruit_id: recruitId,
        name: file.name,
        type: file.type,
        size: file.size,
        storage_path: storagePath,
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const storagePath = searchParams.get('path')

    if (!id || !storagePath) {
      return NextResponse.json({ success: false, error: 'Missing ID or path' }, { status: 400 })
    }

    // Delete from storage
    await supabase.storage
      .from('recruit-documents')
      .remove([storagePath])

    // Delete from database
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 })
  }
}