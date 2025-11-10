import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create Supabase Admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// GET all locations
export async function GET() {
  try {
    const { data: locations, error } = await supabaseAdmin
      .from('locations')
      .select('*')
      .order('path', { ascending: true })

    if (error) {
      console.error('Error fetching locations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ locations })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}

// POST create new location
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, type, parent_id, metadata } = body

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

    // Calculate path and level
    let path = `/${name.toLowerCase().replace(/\s+/g, '-')}`
    let level = 0

    if (parent_id) {
      // Get parent location
      const { data: parent, error: parentError } = await supabaseAdmin
        .from('locations')
        .select('path, level')
        .eq('id', parent_id)
        .single()

      if (parentError || !parent) {
        return NextResponse.json(
          { error: 'Parent location not found' },
          { status: 404 }
        )
      }

      path = `${parent.path}/${name.toLowerCase().replace(/\s+/g, '-')}`
      level = parent.level + 1
    }

    // Create location
    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .insert({
        name,
        type,
        parent_id,
        path,
        level,
        metadata: metadata || {},
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating location:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ location }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    )
  }
}
