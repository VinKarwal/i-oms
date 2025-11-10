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

// PATCH - Approve or reject a movement
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json();
    const { status: newStatus } = body;

    if (!newStatus || (newStatus !== 'approved' && newStatus !== 'rejected')) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // Get the movement
    const { data: movement, error: fetchError } = await supabaseAdmin
      .from('stock_movements')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (fetchError || !movement) {
      return NextResponse.json({ error: 'Movement not found' }, { status: 404 });
    }

    if (movement.status !== 'pending') {
      return NextResponse.json(
        { error: `Movement is already ${movement.status}` },
        { status: 400 }
      );
    }

    // Update the movement status (trigger will handle stock updates)
    const { data: updatedMovement, error: updateError } = await supabaseAdmin
      .from('stock_movements')
      .update({
        status: newStatus,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating movement:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If this is a transfer, update the paired movement too
    if (movement.transfer_reference) {
      await supabaseAdmin
        .from('stock_movements')
        .update({
          status: newStatus,
          approved_at: new Date().toISOString(),
        })
        .eq('transfer_reference', movement.transfer_reference)
        .neq('id', id);
    }

    return NextResponse.json({
      success: true,
      movement: updatedMovement,
      message: `Movement ${newStatus} successfully`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update movement';
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
