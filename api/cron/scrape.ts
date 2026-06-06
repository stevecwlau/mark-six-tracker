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

    // Parse latest draw
    const latestPeriod = $('h2').first().text().match(/第\s*(\d+)\s*期/)?.[1];
    const latestDate = $('h2').first().next().text().trim();
    const latestNumbers = $('.numbers .number').map((i, el) => parseInt($(el).text())).get();
    const latestExtra = parseInt($('.extra-number').text());

    if (latestPeriod && latestNumbers.length === 6) {
      draws.push({
        id: latestPeriod,
        date: latestDate,
        numbers: latestNumbers,
        extra_number: latestExtra,
      });
    }

    // Parse historical draws from the list
    $('.draw-list tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 3) {
        const period = $(cells[0]).text().trim().replace('第', '').replace('期', '');
        const date = $(cells[1]).text().trim();
        const numbersText = $(cells[2]).text().trim();
        const extraText = $(cells[3]).text().trim();

        const numbers = numbersText.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        const extraNumber = parseInt(extraText);

        if (period && numbers.length === 6) {
          draws.push({
            id: period,
            date,
            numbers,
            extra_number: extraNumber,
          });
        }
      }
    });

    // Upsert into Supabase
    if (draws.length > 0) {
      const { error } = await supabase
        .from('draws')
        .upsert(draws, { onConflict: 'id' });

      if (error) {
        console.error('Supabase upsert error:', error);
      }
    }

    console.log(`[Cron] Saved ${draws.length} draws to Supabase`);

    res.status(200).json({ success: true, count: draws.length });
  } catch (error: any) {
    console.error('[Cron] Scrape failed:', error);
    res.status(500).json({ error: error.message });
  }
}
