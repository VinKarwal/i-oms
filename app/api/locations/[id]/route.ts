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

// GET single location
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching location:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json({ location })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    )
  }
}

// PATCH update location
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, type, metadata, is_active } = body

    // Build update object
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (type !== undefined) updates.type = type
    if (metadata !== undefined) updates.metadata = metadata
    if (is_active !== undefined) updates.is_active = is_active

    // If name changed, update path
    if (name !== undefined) {
      const { data: location } = await supabaseAdmin
        .from('locations')
        .select('parent_id, level, path')
        .eq('id', id)
        .single()

      if (location) {
        let newPath = `/${name.toLowerCase().replace(/\s+/g, '-')}`
        
        if (location.parent_id) {
          const { data: parent } = await supabaseAdmin
            .from('locations')
            .select('path')
            .eq('id', location.parent_id)
            .single()

          if (parent) {
            newPath = `${parent.path}/${name.toLowerCase().replace(/\s+/g, '-')}`
          }
        }

        updates.path = newPath
      }
    }

    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating location:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ location })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    )
  }
}

// DELETE location (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if location has child locations
    const { data: children } = await supabaseAdmin
      .from('locations')
      .select('id')
      .eq('parent_id', id)
      .limit(1)

    if (children && children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete location with sub-locations' },
        { status: 400 }
      )
    }

    // Check if location has items
    const { data: items } = await supabaseAdmin
      .from('item_locations')
      .select('id')
      .eq('location_id', id)
      .limit(1)

    if (items && items.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete location with items' },
        { status: 400 }
      )
    }

    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('locations')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting location:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    )
  }
}
