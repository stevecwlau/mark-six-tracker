import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://mark6.app/now', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch mark6.app' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    console.log('[Cron] Scraped mark6.app successfully');

    res.status(200).json({ success: true, message: 'Scrape completed' });
  } catch (error: any) {
    console.error('[Cron] Scrape failed:', error);
    res.status(500).json({ error: error.message });
  }
}
