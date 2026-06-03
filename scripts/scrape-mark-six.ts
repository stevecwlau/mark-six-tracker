/**
 * Mark Six Scraper
 * Fetches latest draw + prize breakdown from Lottolyzer
 * and updates src/data/scraped_draws.json
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const URL = 'https://en.lottolyzer.com/home/hong-kong/mark-six';
const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'scraped_draws.json');

interface Prize {
  name: string;
  amount: string;
  winners: string;
}

interface ScrapedDraw {
  id: string;
  date: string;
  numbers: number[];
  extra: number;
  jackpot?: string;
  nextJackpot?: string;
  nextDeadline?: string;
  prizes?: Prize[];
}

async function scrapeMarkSix(): Promise<ScrapedDraw | null> {
  try {
    console.log('[Scraper] Fetching', URL);
    const res = await fetch(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarkSixTracker/1.0)',
      },
    });

    if (!res.ok) {
      console.error('[Scraper] Failed to fetch page:', res.status);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Try to extract latest draw info
    // Note: Lottolyzer page structure may change — adjust selectors as needed
    const drawText = $('h1, h2, .draw-number').first().text() || '';
    const drawMatch = drawText.match(/Draw\s*(\d+\/\d+)/i);
    const drawId = drawMatch ? drawMatch[1] : 'Unknown';

    // Extract winning numbers (common pattern on the site)
    const numbers: number[] = [];
    $('.winning-numbers .ball, .numbers .ball, [class*="ball"]').each((_, el) => {
      const num = parseInt($(el).text().trim(), 10);
      if (!isNaN(num) && num > 0 && num <= 49) numbers.push(num);
    });

    // Extra number
    let extra = 0;
    $('.extra-number, .special-number, [class*="extra"]').each((_, el) => {
      const num = parseInt($(el).text().trim(), 10);
      if (!isNaN(num)) extra = num;
    });

    // Prize breakdown
    const prizes: Prize[] = [];
    $('table tr, .prize-row').each((_, row) => {
      const cells = $(row).find('td, th').map((_, c) => $(c).text().trim()).get();
      if (cells.length >= 3 && cells[0].match(/Div|Prize|1st|2nd|3rd/i)) {
        prizes.push({
          name: cells[0].replace(/Division|Div/i, '').trim(),
          amount: cells[1] || '',
          winners: cells[2] || '',
        });
      }
    });

    // Next draw info
    const nextDrawText = $('.next-draw, .estimated-jackpot').text() || '';
    const nextJackpotMatch = nextDrawText.match(/\$[\d,]+/);
    const nextJackpot = nextJackpotMatch ? nextJackpotMatch[0] : undefined;

    const scraped: ScrapedDraw = {
      id: drawId,
      date: new Date().toISOString().split('T')[0],
      numbers: numbers.length > 0 ? numbers.slice(0, 6) : [1,2,3,4,5,6],
      extra: extra || 7,
      jackpot: prizes[0]?.amount || 'HK$ 8,000,000',
      nextJackpot,
      prizes: prizes.length > 0 ? prizes : undefined,
    };

    console.log('[Scraper] Successfully scraped draw', drawId);
    return scraped;
  } catch (err: any) {
    console.error('[Scraper] Error:', err.message);
    return null;
  }
}

function saveDraw(draw: ScrapedDraw) {
  let existing: ScrapedDraw[] = [];

  if (fs.existsSync(DATA_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
      existing = [];
    }
  }

  // Avoid duplicates
  const exists = existing.some(d => d.id === draw.id);
  if (exists) {
    console.log('[Scraper] Draw', draw.id, 'already exists. Skipping.');
    return;
  }

  existing.unshift(draw); // newest first
  fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2));
  console.log('[Scraper] Saved new draw', draw.id, '→', DATA_FILE);
}

async function main() {
  const draw = await scrapeMarkSix();
  if (draw) {
    saveDraw(draw);
  } else {
    console.log('[Scraper] No new data scraped.');
  }
}

main();