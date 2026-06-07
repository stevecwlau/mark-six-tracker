import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://mark6.app/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const draws: any[] = [];

    const { error } = await supabase.from('draws').upsert(draws, { onConflict: 'id' });

    res.status(200).json({ success: true, count: draws.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
