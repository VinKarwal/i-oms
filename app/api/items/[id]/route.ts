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

// GET single item
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: item, error } = await supabaseAdmin
      .from('items')
      .select('*, item_locations(*, locations(name, path))')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching item:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Calculate total stock
    const total_stock = item.item_locations?.reduce(
      (sum: number, il: { quantity: number }) => sum + Number(il.quantity || 0), 
      0
    ) || 0

    return NextResponse.json({ item: { ...item, total_stock } })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

// PATCH update item
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      name, 
      description, 
      category, 
      unit,
      barcode,
      is_active,
      stock_allocations // Array of { id?, location_id, quantity, min_threshold, max_threshold }
    } = body

    // Build update object (SKU is read-only)
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (category !== undefined) updates.category = category
    if (unit !== undefined) updates.unit = unit
    if (barcode !== undefined) updates.barcode = barcode
    if (is_active !== undefined) updates.is_active = is_active

    // Update item
    const { error: itemError } = await supabaseAdmin
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (itemError) {
      console.error('Error updating item:', itemError)
      return NextResponse.json({ error: itemError.message }, { status: 500 })
    }

    // Update stock allocations if provided
    if (stock_allocations) {
      // Get existing allocations
      const { data: existing } = await supabaseAdmin
        .from('item_locations')
        .select('id, location_id')
        .eq('item_id', id)

      const existingMap = new Map(existing?.map(e => [e.location_id, e.id]))
      const updatedLocationIds = new Set<string>()

      // Update or insert allocations
      for (const alloc of stock_allocations) {
        updatedLocationIds.add(alloc.location_id)
        
        const existingId = existingMap.get(alloc.location_id)
        
        if (existingId) {
          // Update existing
          await supabaseAdmin
            .from('item_locations')
            .update({
              quantity: alloc.quantity || 0,
              min_threshold: alloc.min_threshold || null,
              max_threshold: alloc.max_threshold || null,
            })
            .eq('id', existingId)
        } else {
          // Insert new
          await supabaseAdmin
            .from('item_locations')
            .insert({
              item_id: id,
              location_id: alloc.location_id,
              quantity: alloc.quantity || 0,
              min_threshold: alloc.min_threshold || null,
              max_threshold: alloc.max_threshold || null,
            })
        }
      }

      // Delete allocations not in the update
      const locationsToDelete = Array.from(existingMap.entries())
        .filter(([locId]) => !updatedLocationIds.has(locId))
        .map(([, id]) => id)

      if (locationsToDelete.length > 0) {
        await supabaseAdmin
          .from('item_locations')
          .delete()
          .in('id', locationsToDelete)
      }
    }

    // Fetch complete item with locations
    const { data: completeItem } = await supabaseAdmin
      .from('items')
      .select('*, item_locations(*, locations(name, path))')
      .eq('id', id)
      .single()

    return NextResponse.json({ item: completeItem })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE item (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('items')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting item:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
