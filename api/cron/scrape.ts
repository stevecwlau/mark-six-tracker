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
      return res.status(500).json({ error: 'Failed to fetch mark6.app/live' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const draws: any[] = [];

    // === Latest draw ===
    const latestPeriodText = $('p.w3-center').first().text();
    const latestPeriodMatch = latestPeriodText.match(/第\s*(\d+)\s*期/);
    const latestDateMatch = latestPeriodText.match(/(\d{2}\/\d{2}\/\d{4})/);

    if (latestPeriodMatch && latestDateMatch) {
      const period = latestPeriodMatch[1];
      const date = latestDateMatch[1].split('/').reverse().join('-'); // DD/MM/YYYY → YYYY-MM-DD

      const numbers: number[] = [];
      $('p.w3-center .ball').each((i, el) => {
        const num = parseInt($(el).text());
        if (!isNaN(num)) numbers.push(num);
      });

      if (numbers.length === 7) {
        draws.push({
          id: period,
          date,
          numbers: numbers.slice(0, 6),
          extra_number: numbers[6],
        });
      }
    }

    // === Past 10 draws ===
    $('.w3-ul.w3-center li').each((i, li) => {
      const text = $(li).text();
      const periodMatch = text.match(/第(\d+)期/);
      const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);

      if (periodMatch && dateMatch) {
        const period = periodMatch[1];
        const date = dateMatch[1].split('/').reverse().join('-');

        const numbers: number[] = [];
        $(li).find('.ball').each((j, el) => {
          const num = parseInt($(el).text());
          if (!isNaN(num)) numbers.push(num);
        });

        if (numbers.length === 7) {
          draws.push({
            id: period,
            date,
            numbers: numbers.slice(0, 6),
            extra_number: numbers[6],
          });
        }
      }
    });

    // Upsert to Supabase
    if (draws.length > 0) {
      const { error } = await supabase
        .from('draws')
        .upsert(draws, { onConflict: 'id' });

      if (error) {
        console.error('Supabase error:', error);
      }
    }

    console.log(`[Cron] Saved ${draws.length} draws to Supabase`);

    res.status(200).json({ success: true, count: draws.length, draws });
  } catch (error: any) {
    console.error('[Cron] Scrape failed:', error);
    res.status(500).json({ error: error.message });
  }
}
