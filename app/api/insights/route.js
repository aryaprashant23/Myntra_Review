import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FALLBACK_INSIGHTS = [
  {
    id: 1,
    theme: 'price_wait',
    theme_label: 'Price Waiting & Discount Hesitation',
    mention_count: 14,
    pct_of_total: 38.5,
    sample_quotes: [
      "I kept 4 kurtas in my wishlist waiting for the End of Reason Sale, but the discount was only 10%.",
      "Prices fluctuate way too much every day on wishlisted sneakers."
    ],
    segment_breakdown: { Apparel: 60, Footwear: 40 },
    trend: 'rising'
  },
  {
    id: 2,
    theme: 'fit_uncertainty',
    theme_label: 'Fit & Size Uncertainty',
    mention_count: 10,
    pct_of_total: 27.0,
    sample_quotes: [
      "Wishlisted these heels but not sure if UK 6 fits true to size or runs narrow.",
      "Different brands have completely mismatched chest sizing charts."
    ],
    segment_breakdown: { Footwear: 55, Apparel: 45 },
    trend: 'stable'
  },
  {
    id: 3,
    theme: 'delivery_return',
    theme_label: 'Pincode & Delivery Availability',
    mention_count: 7,
    pct_of_total: 19.2,
    sample_quotes: [
      "Item in wishlist for 2 weeks, when I go to buy it says not deliverable to my pincode.",
      "Return pickup charges made me abandon buying saved jacket."
    ],
    segment_breakdown: { Apparel: 70, Accessories: 30 },
    trend: 'declining'
  },
  {
    id: 4,
    theme: 'quality_concern',
    theme_label: 'Fabric & Quality Hesitation',
    mention_count: 6,
    pct_of_total: 15.3,
    sample_quotes: [
      "Images look very premium but reviews say fabric is thin polyester.",
      "Colour in real photo looks different from catalogue lighting."
    ],
    segment_breakdown: { Apparel: 80, Beauty: 20 },
    trend: 'stable'
  }
];

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        insights: FALLBACK_INSIGHTS,
        totalFeedbackCount: 37,
        isFallback: true,
        lastUpdated: new Date().toISOString()
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch themes from insights table
    const { data: insights, error: insightsErr } = await supabase
      .from('insights')
      .select('*')
      .order('mention_count', { ascending: false });

    if (insightsErr) {
      console.warn('Supabase insights query failed, using fallback:', insightsErr.message);
      return NextResponse.json({
        insights: FALLBACK_INSIGHTS,
        totalFeedbackCount: 37,
        isFallback: true,
        lastUpdated: new Date().toISOString()
      });
    }

    // Fetch summary stats from raw_feedback table
    const { count: totalRaw } = await supabase
      .from('raw_feedback')
      .select('*', { count: 'exact', head: true });

    const finalInsights = (insights && insights.length > 0) ? insights : FALLBACK_INSIGHTS;

    return NextResponse.json({
      insights: finalInsights,
      totalFeedbackCount: totalRaw || (finalInsights === FALLBACK_INSIGHTS ? 37 : finalInsights.reduce((a, c) => a + (c.mention_count || 0), 0)),
      isFallback: !insights || insights.length === 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.error('API Error in /api/insights:', err);
    return NextResponse.json({
      insights: FALLBACK_INSIGHTS,
      totalFeedbackCount: 37,
      isFallback: true,
      error: err.message,
      lastUpdated: new Date().toISOString()
    });
  }
}
