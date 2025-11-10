import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// GET all stock movements with filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Filters
    const itemId = searchParams.get('item_id');
    const locationId = searchParams.get('location_id');
    const movementType = searchParams.get('movement_type');
    const status = searchParams.get('status');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('stock_movements')
      .select(`
        *,
        items (id, sku, name),
        locations (id, name, path),
        created_by_user:created_by (email),
        approved_by_user:approved_by (email)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (itemId) query = query.eq('item_id', itemId);
    if (locationId) query = query.eq('location_id', locationId);
    if (movementType) query = query.eq('movement_type', movementType);
    if (status) query = query.eq('status', status);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data: movements, error, count } = await query;

    if (error) {
      console.error('Error fetching movements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ movements, count });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch movements';
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST create new stock movement
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      item_id,
      location_id,
      movement_type,
      quantity,
      unit_cost,
      batch_number,
      serial_number,
      reference_number,
      reason,
      notes,
      attachment_url,
      user_id,
      user_role,
      // For transfers
      to_location_id,
    } = body;

    // Validation
    if (!item_id || !location_id || !movement_type || !quantity || !reason || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: item_id, location_id, movement_type, quantity, reason, user_id' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 });
    }

    // Check if item exists and is active
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('id, sku, name')
      .eq('id', item_id)
      .eq('is_active', true)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found or inactive' }, { status: 404 });
    }

    // Check if location exists and is active
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('id, name')
      .eq('id', location_id)
      .eq('is_active', true)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found or inactive' }, { status: 404 });
    }

    // Determine status based on user role and movement type
    let status = 'pending';
    
    // Role-based approval rules
    if (user_role === 'Admin' || user_role === 'Manager') {
      // Admin/Manager: Most movements are auto-approved
      if (movement_type in ['receive', 'production', 'return_from_customer', 'transfer_in', 'transfer_out']) {
        status = 'approved';
      } else if (movement_type === 'sale') {
        status = 'approved';
      } else if (movement_type.includes('adjustment')) {
        // Large adjustments need approval even for managers
        const currentQty = await getCurrentQuantity(item_id, location_id);
        const adjustmentPercent = Math.abs(quantity / currentQty) * 100;
        status = adjustmentPercent > 20 ? 'pending' : 'approved'; // More than 20% change needs approval
      } else {
        status = 'approved';
      }
    }
    // Staff: All movements need approval
    else {
      status = 'pending';
    }

    // Calculate total value
    const total_value = unit_cost ? unit_cost * quantity : null;

    // Handle transfers (create paired movements)
    if (movement_type === 'transfer_out' && to_location_id) {
      // Check destination location
      const { data: toLocation, error: toLocError } = await supabaseAdmin
        .from('locations')
        .select('id, name')
        .eq('id', to_location_id)
        .eq('is_active', true)
        .single();

      if (toLocError || !toLocation) {
        return NextResponse.json({ error: 'Destination location not found or inactive' }, { status: 404 });
      }

      // Generate transfer reference
      const transfer_reference = `TRF-${Date.now()}`;

      // Create transfer_out movement
      const { data: transferOut, error: outError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          item_id,
          location_id,
          movement_type: 'transfer_out',
          quantity,
          unit_cost,
          total_value,
          batch_number,
          serial_number,
          reference_number,
          reason,
          notes,
          attachment_url,
          transfer_reference,
          status,
          created_by: user_id,
          approved_by: status === 'approved' ? user_id : null,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (outError) {
        console.error('Error creating transfer_out:', outError);
        return NextResponse.json({ error: outError.message }, { status: 500 });
      }

      // Create paired transfer_in movement
      const { data: transferIn, error: inError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          item_id,
          location_id: to_location_id,
          movement_type: 'transfer_in',
          quantity,
          unit_cost,
          total_value,
          batch_number,
          serial_number,
          reference_number,
          reason: `Transfer from ${location.name}`,
          notes,
          attachment_url,
          transfer_reference,
          status,
          created_by: user_id,
          approved_by: status === 'approved' ? user_id : null,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (inError) {
        console.error('Error creating transfer_in:', inError);
        // Rollback transfer_out
        await supabaseAdmin
          .from('stock_movements')
          .delete()
          .eq('id', transferOut.id);
        return NextResponse.json({ error: inError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        movements: [transferOut, transferIn],
        transfer_reference,
        message: `Transfer ${status === 'approved' ? 'completed' : 'pending approval'}`,
      });
    }

    // Create single movement (non-transfer)
    const { data: movement, error: movementError } = await supabaseAdmin
      .from('stock_movements')
      .insert({
        item_id,
        location_id,
        movement_type,
        quantity,
        unit_cost,
        total_value,
        batch_number,
        serial_number,
        reference_number,
        reason,
        notes,
        attachment_url,
        status,
        created_by: user_id,
        approved_by: status === 'approved' ? user_id : null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (movementError) {
      console.error('Error creating movement:', movementError);
      return NextResponse.json({ error: movementError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      movement,
      message: `Movement ${status === 'approved' ? 'completed' : 'pending approval'}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create movement';
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Helper function to get current quantity
async function getCurrentQuantity(itemId: string, locationId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('item_locations')
    .select('quantity')
    .eq('item_id', itemId)
    .eq('location_id', locationId)
    .single();
  
  return data?.quantity || 0;
}
