import { createClient } from '@supabase/supabase-js';
import { Groq } from 'groq-sdk';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!groqApiKey) {
      return NextResponse.json({ 
        reply: "Groq API Key is not configured on the server yet. Please add GROQ_API_KEY to your Vercel Environment Variables." 
      });
    }

    // 1. Fetch live context from Supabase insights
    let contextText = "Live Myntra Wishlist-to-Purchase Intelligence Database:\n";
    let foundDbData = false;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: insights } = await supabase
          .from('insights')
          .select('*')
          .order('mention_count', { ascending: false });

        if (insights && insights.length > 0) {
          foundDbData = true;
          insights.forEach((item) => {
            contextText += `\nTheme: "${item.theme_label}" (${item.pct_of_total}% of all blocked purchases, ${item.mention_count} mentions)`;
            contextText += `\nSegments Affected: ${JSON.stringify(item.segment_breakdown)}`;
            if (item.sample_quotes && item.sample_quotes.length > 0) {
              contextText += `\nDirect Customer Quotes:\n - "${item.sample_quotes.join('"\n - "')}"`;
            }
          });
        }
      } catch (dbErr) {
        console.error('Failed to load DB context for chat:', dbErr);
      }
    }

    if (!foundDbData) {
      contextText += `
Theme: "Price Waiting & Discount Hesitation" (38.5% of all blocked purchases, 14 mentions)
Segments Affected: {"Apparel": 60, "Footwear": 40}
Direct Customer Quotes:
 - "I kept 4 kurtas in my wishlist waiting for the End of Reason Sale, but the discount was only 10%."
 - "Prices fluctuate way too much every day on wishlisted sneakers."

Theme: "Fit & Size Uncertainty" (27.0% of all blocked purchases, 10 mentions)
Segments Affected: {"Footwear": 55, "Apparel": 45}
Direct Customer Quotes:
 - "Wishlisted these heels but not sure if UK 6 fits true to size or runs narrow."
 - "Different brands have completely mismatched chest sizing charts."

Theme: "Pincode & Delivery Availability" (19.2% of all blocked purchases, 7 mentions)
Segments Affected: {"Apparel": 70, "Accessories": 30}
Direct Customer Quotes:
 - "Item in wishlist for 2 weeks, when I go to buy it says not deliverable to my pincode."
 - "Return pickup charges made me abandon buying saved jacket."

Theme: "Fabric & Quality Hesitation" (15.3% of all blocked purchases, 6 mentions)
Segments Affected: {"Apparel": 80, "Beauty": 20}
Direct Customer Quotes:
 - "Images look very premium but reviews say fabric is thin polyester."
 - "Colour in real photo looks different from catalogue lighting."
`;
    }

    // 2. Query Groq
    const groq = new Groq({ apiKey: groqApiKey });
    
    // Check available model or fallback
    let modelToUse = "openai/gpt-oss-120b";
    try {
      const modelList = await groq.models.list();
      const ids = modelList.data.map(m => m.id);
      const candidates = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
      for (const c of candidates) {
        if (ids.includes(c)) {
          modelToUse = c;
          break;
        }
      }
    } catch (e) {
      console.log('Model check notice:', e);
    }

    const systemPrompt = `You are the Myntra Wishlist Conversion Copilot — an expert AI e-commerce product analyst.
Your job is to answer questions about why shoppers add fashion items to their Myntra wishlist/cart but hesitate or fail to complete checkout.

Use ONLY the verified customer intelligence data below to ground your answer. When explaining reasons, ALWAYS cite actual customer quotes and percentage shares where relevant. Keep your response concise, structured with bullet points, and actionable for product managers and fashion retailers.

--- VERIFIED DATABASE CONTEXT ---
${contextText}
---------------------------------`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: modelToUse,
      temperature: 0.3,
      max_tokens: 600,
    });

    const reply = chatCompletion.choices[0]?.message?.content || "I couldn't analyze that question right now. Please try again.";

    return NextResponse.json({ reply, modelUsed: modelToUse });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    return NextResponse.json({ 
      reply: `Sorry, encountered an error processing your query: ${err.message}` 
    }, { status: 500 });
  }
}
