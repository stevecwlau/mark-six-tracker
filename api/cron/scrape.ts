import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://mark6.app/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch mark6.app/live' });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const draws: any[] = [];

    // Parse latest draw
    const latestSection = $('.w3-half .w3-card').first();
    const latestDateText = latestSection.find('p.w3-center').first().text().trim();
    const latestNumbers: number[] = [];
    
    latestSection.find('.ball').each((i, el) => {
      const num = parseInt($(el).text().trim());
      if (!isNaN(num)) latestNumbers.push(num);
    });

    if (latestNumbers.length >= 7 && latestDateText.includes('期')) {
      const dateMatch = latestDateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        const idMatch = latestDateText.match(/第\s*(\d+)\s*期/);
        const id = idMatch ? `26/${idMatch[1]}` : '';

        draws.push({
          id,
          date,
          numbers: latestNumbers.slice(0, 6),
          extraNumber: latestNumbers[6],
          jackpot: "",
          nextDrawDate: "",
          nextJackpot: ""
        });
      }
    }

    // Parse past 10 draws
    $('.w3-ul.w3-center li').each((i, li) => {
      const text = $(li).text().trim();
      if (!text || text.includes('第')) {
        const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const idMatch = text.match(/第\s*(\d+)\s*期/);
        
        if (dateMatch && idMatch) {
          const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          const id = `26/${idMatch[1]}`;
          
          const numbers: number[] = [];
          let extraNumber = 0;
          
          $(li).find('.ball').each((j, ball) => {
            const num = parseInt($(ball).text().trim());
            if (!isNaN(num)) numbers.push(num);
          });
          
          if (numbers.length === 7) {
            extraNumber = numbers.pop()!;
            draws.push({
              id,
              date,
              numbers,
              extraNumber,
              jackpot: "",
              nextDrawDate: "",
              nextJackpot: ""
            });
          }
        }
      }
    });

    // Remove duplicates and sort
    const uniqueDraws = draws.filter((draw, index, self) =>
      index === self.findIndex(d => d.id === draw.id)
    ).sort((a, b) => b.date.localeCompare(a.date));

    const outputPath = path.join(process.cwd(), 'src/data/scraped_draws.json');
    fs.writeFileSync(outputPath, JSON.stringify(uniqueDraws, null, 2));

    console.log(`[Cron] Scraped ${uniqueDraws.length} draws from mark6.app/live`);

    res.status(200).json({ success: true, count: uniqueDraws.length });
  } catch (error: any) {
    console.error('[Cron] Scrape failed:', error);
    res.status(500).json({ error: error.message });
  }
}
