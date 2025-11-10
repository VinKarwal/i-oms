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

// GET movement history for a specific item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify item exists
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('id, sku, name')
      .eq('id', itemId)
      .eq('is_active', true)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Get movement history
    const { data: movements, error, count } = await supabaseAdmin
      .from('stock_movements')
      .select(`
        *,
        locations (id, name, path),
        created_by_user:created_by (email),
        approved_by_user:approved_by (email)
      `, { count: 'exact' })
      .eq('item_id', itemId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching movement history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      item,
      movements,
      total: count,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch movement history';
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
