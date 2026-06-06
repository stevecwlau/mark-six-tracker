import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const scrapedPath = path.join(process.cwd(), 'src/data/scraped_draws.json');
    
    let draws = [];
    if (fs.existsSync(scrapedPath)) {
      draws = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
    }

    draws.sort((a: any, b: any) => b.date.localeCompare(a.date));

    res.status(200).json({ source: 'live', draws });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve draw results' });
  }
}
