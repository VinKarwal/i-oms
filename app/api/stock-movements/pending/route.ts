import { NextResponse } from 'next/server';
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

// GET all pending movements for approval
export async function GET() {
  try {
    const { data: pendingMovements, error } = await supabaseAdmin
      .from('stock_movements')
      .select(`
        *,
        items (id, sku, name),
        locations (id, name, path),
        created_by_user:created_by (email)
      `)
      .eq('status', 'pending')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending movements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ movements: pendingMovements });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending movements';
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
