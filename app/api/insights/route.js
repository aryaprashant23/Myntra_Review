import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch themes from insights table
    const { data: insights, error: insightsErr } = await supabase
      .from('insights')
      .select('*')
      .order('mention_count', { ascending: false });

    if (insightsErr) {
      throw insightsErr;
    }

    // Fetch summary stats from raw_feedback table
    const { count: totalRaw, error: rawErr } = await supabase
      .from('raw_feedback')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      insights: insights || [],
      totalFeedbackCount: totalRaw || 26,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.error('API Error in /api/insights:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
