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

// GET all items
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    let query = supabaseAdmin
      .from('items')
      .select('*, item_locations(id, location_id, quantity, min_threshold, max_threshold, locations(name, path))')
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: items, error } = await query

    if (error) {
      console.error('Error fetching items:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate total stock for each item
    const itemsWithTotals = items?.map(item => ({
      ...item,
      total_stock: item.item_locations?.reduce((sum: number, il: { quantity: number }) => sum + Number(il.quantity || 0), 0) || 0
    }))

    return NextResponse.json({ items: itemsWithTotals })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

// POST create new item
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      sku, 
      barcode, 
      name, 
      description, 
      category, 
      unit,
      stock_allocations // Array of { location_id, quantity, min_threshold, max_threshold }
    } = body

    // Validate required fields
    if (!sku || !name || !unit) {
      return NextResponse.json(
        { error: 'SKU, name, and unit are required' },
        { status: 400 }
      )
    }

    // Check if SKU already exists
    const { data: existing } = await supabaseAdmin
      .from('items')
      .select('id')
      .eq('sku', sku)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'SKU already exists' },
        { status: 400 }
      )
    }

    // Create item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .insert({
        sku,
        barcode: barcode || null,
        name,
        description: description || null,
        category: category || null,
        unit,
        is_active: true,
      })
      .select()
      .single()

    if (itemError) {
      console.error('Error creating item:', itemError)
      return NextResponse.json({ error: itemError.message }, { status: 500 })
    }

    // Create stock allocations if provided
    if (stock_allocations && stock_allocations.length > 0) {
      const allocations = stock_allocations.map((alloc: {
        location_id: string
        quantity: number
        min_threshold?: number
        max_threshold?: number
      }) => ({
        item_id: item.id,
        location_id: alloc.location_id,
        quantity: alloc.quantity || 0,
        min_threshold: alloc.min_threshold || null,
        max_threshold: alloc.max_threshold || null,
      }))

      const { error: allocError } = await supabaseAdmin
        .from('item_locations')
        .insert(allocations)

      if (allocError) {
        console.error('Error creating stock allocations:', allocError)
        // Rollback: delete the item
        await supabaseAdmin.from('items').delete().eq('id', item.id)
        return NextResponse.json(
          { error: 'Failed to create stock allocations' },
          { status: 500 }
        )
      }
    }

    // Fetch complete item with locations
    const { data: completeItem } = await supabaseAdmin
      .from('items')
      .select('*, item_locations(*, locations(name, path))')
      .eq('id', item.id)
      .single()

    return NextResponse.json({ item: completeItem }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
