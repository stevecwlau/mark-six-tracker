/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import fs from 'fs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first'); // Force IPv4 first

dotenv.config();

const app = express();
const PORT = 3000;

// Configure body-parser to accept base-64 images for OCR
app.use(express.json({ limit: '10mb' }));

// CORS - allow frontend dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});


// In-memory collection of simulated historical draws to make offline mode highly robust.
let historicalDraws: any[] = [];

// Load scraped results from disk to seed the active historical database
try {
  const scrapedPath = path.join(process.cwd(), 'src', 'data', 'scraped_draws.json');
  if (fs.existsSync(scrapedPath)) {
    historicalDraws = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
    console.log(`[Database Loaded] Successfully loaded ${historicalDraws.length} historical scraped draws.`);
  } else {
    console.log("[Database Warn] No scraped_draws.json found. Running in empty mode.");
  }
} catch (err: any) {
  
}

// ==================== AUTO SCRAPER ====================

async function scrapeAndUpdate() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const res = await fetch("https://en.lottolyzer.com/home/hong-kong/mark-six", {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.google.com/"
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`[Scraper] HTTP ${res.status}`);
      return;
    }

    const html = await res.text();
    const $ = require("cheerio").load(html);

    // Extract draw ID
    const drawId = $("h1, h2, .draw-header").first().text().match(/Draw\s*(\d+\/\d+)/i)?.[1];
    if (!drawId) return;

    // Extract winning numbers
    const numbers: number[] = [];
    $('.ball, [class*="ball"], .winning-number').each((_, el) => {
      const n = parseInt($(el).text().trim(), 10);
      if (n > 0 && n <= 49) numbers.push(n);
    });

    // Extract extra number
    let extra = 0;
    $('.extra, .special, [class*="extra"]').each((_, el) => {
      const n = parseInt($(el).text().trim(), 10);
      if (n > 0 && n <= 49) extra = n;
    });

    // Extract prize breakdown table
    const prizes: any[] = [];
    $('table tr').each((_, row) => {
      const cells = $(row).find('td, th').map((i, c) => $(c).text().trim()).get();
      
      // Look for rows containing prize information
      if (cells.length >= 3) {
        const firstCell = cells[0].toLowerCase();
        if (firstCell.includes('div') || firstCell.includes('1st') || firstCell.includes('2nd') || firstCell.includes('3rd') || firstCell.includes('prize')) {
          prizes.push({
            name: cells[0].replace(/Division|Div/i, '').trim(),
            amount: cells[1] || '',
            winners: cells[2] || ''
          });
        }
      }
    });

    // Only save if we have meaningful data
    if (numbers.length >= 6) {
      const scrapedPath = path.join(process.cwd(), 'src', 'data', 'scraped_draws.json');
      let existing: any[] = [];
      
      if (fs.existsSync(scrapedPath)) {
        existing = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
      }

      // Check if this draw already exists
      if (!existing.some((d: any) => d.id === drawId)) {
        const newDraw = {
          id: drawId,
          date: new Date().toISOString().split('T')[0],
          numbers: numbers.slice(0, 6),
          extra: extra || numbers[6] || 0,
          jackpot: prizes[0]?.amount || 'HK$ 8,000,000',
          nextJackpot: 'HK$ 8,000,000',
          nextDeadline: 'TBD',
          prizes: prizes.length > 0 ? prizes : undefined
        };

        existing.unshift(newDraw);
        fs.writeFileSync(scrapedPath, JSON.stringify(existing, null, 2));
        console.log(`[Scraper] New draw ${drawId} saved with ${prizes.length} prize tiers`);
        historicalDraws = existing;
      }
    }
  } catch (e: any) {
    console.log('[Scraper] Skipped or failed:', e.message);
  }
}

// Run once on startup, then every 30 mins
scrapeAndUpdate();
setInterval(scrapeAndUpdate, SCRAPE_INTERVAL);
console.log("[Scraper] Auto-scraper enabled (every 30 mins)");


// 5-minute throttle lock for PILIO Page 1 update checks to prevent rate limits or spam
function parseChineseEstimatedJackpot(str: string): string {
  if (!str) return 'HK$ 8,000,000';
  
  if (str.startsWith('$') || str.startsWith('HK$')) {
    return str.startsWith('HK$') ? str : `HK$ ${str.slice(1)}`;
  }
  
  let valStr = str.replace(/元/g, '').trim();
  
  try {
    let base = 0;
    
    // Parse 億 (100,000,000)
    let yiMatch = valStr.match(/(\d+)\s*億/);
    if (yiMatch) {
      base += parseInt(yiMatch[1], 10) * 100000000;
      valStr = valStr.replace(/.*億/, '');
    }
    
    // Parse 千萬 (10,000,000)
    let qianWanMatch = valStr.match(/(\d+)\s*千萬/);
    if (qianWanMatch) {
      base += parseInt(qianWanMatch[1], 10) * 10000000;
      valStr = valStr.replace(/.*千萬/, '');
    } else {
      // Parse 千 (1000) 百 (100) 萬 (10000)
      let qianMatch = valStr.match(/(\d+)\s*千/);
      let qian = qianMatch ? parseInt(qianMatch[1], 10) : 0;
      
      let baiMatch = valStr.match(/(\d+)\s*百/);
      let bai = baiMatch ? parseInt(baiMatch[1], 10) : 0;
      
      let digitsMatch = valStr.match(/^(\d+)\s*萬/);
      
      if (valStr.includes('萬')) {
        let totalWanNum = (qian * 1000) + (bai * 100);
        if (digitsMatch) {
          totalWanNum = parseInt(digitsMatch[1], 10);
        }
        base += totalWanNum * 10000;
      }
    }
    
    if (base > 0) {
      return `HK$ ${base.toLocaleString('en-US')}`;
    }
  } catch (e) {
    // fallback
  }
  
  return `HK$ ${str}`;
}

let lastScrapeTime = 0;
const SCRAPE_INTERVAL = 5 * 60 * 1000; 

// Initialize server-side Gemini SDK client
let genAI: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// REST endpoints
// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Fetch Draw Results (Includes both Simulated / Dynamic Live queries, with error handling)
app.get('/api/draws', async (req, res) => {
  try {
    // Trigger automatic background check & sync with PILIO for any new draws since last check
    await checkAndScrapeLatest();

    // Default return simulation draws (which contains the complete scraped database)
    // Make sure it is always sorted descending
    historicalDraws.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ source: 'simulated', draws: historicalDraws });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve draw results' });
  }
});

// Trigger a simulated next draw inside offline-first engines
app.post('/api/draws/generate', (req, res) => {
  const latest = historicalDraws[0] || {
    id: "26/041",
    date: "2026-05-01",
    numbers: [1, 2, 3, 4, 5, 6],
    extraNumber: 7,
    jackpot: "HK$ 8,000,000",
    nextDrawDate: "2026-05-05",
    nextJackpot: "HK$ 8,000,000",
    nextDeadline: "2026-05-05 21:15"
  };
  const nextIdNum = parseInt(latest.id.split('/')[1]) + 1;
  const nextId = `${latest.id.split('/')[0]}/${nextIdNum.toString().padStart(3, '0')}`;
  
  // Calculate a next-deadline & next-draw dates
  const nextDateObj = new Date(latest.date);
  nextDateObj.setDate(nextDateObj.getDate() + 4);
  const nextDateStr = nextDateObj.toISOString().split('T')[0];
  
  const futureDateObj = new Date(nextDateObj);
  futureDateObj.setDate(futureDateObj.getDate() + 4);
  const futureDateStr = futureDateObj.toISOString().split('T')[0];

  // Draw 6 unique random numbers 1..49 and 1 extra number
  const allNumbers = Array.from({ length: 49 }, (_, i) => i + 1);
  const selectedNumbers: number[] = [];
  while (selectedNumbers.length < 7) {
    const idx = Math.floor(Math.random() * allNumbers.length);
    selectedNumbers.push(allNumbers.splice(idx, 1)[0]);
  }
  const winningNumbers = selectedNumbers.slice(0, 6).sort((a,b)=>a-b);
  const extraNumber = selectedNumbers[6];

  const estimatedFirstPrize = Math.floor(Math.random() * 40 + 8) * 1000000;
  const futureFirstPrize = 8000000;

  const newDraw = {
    id: nextId,
    date: nextDateStr,
    numbers: winningNumbers,
    extraNumber,
    jackpot: `HK$ ${estimatedFirstPrize.toLocaleString()}`,
    nextDrawDate: futureDateStr,
    nextJackpot: `HK$ ${futureFirstPrize.toLocaleString()}`,
    nextDeadline: `${futureDateStr} 21:15`,
    prizes: [
      { name: "1st Prize", dividend: `HK$ ${estimatedFirstPrize.toLocaleString()}`, winners: Math.random() > 0.7 ? "1" : "0" },
      { name: "2nd Prize", dividend: "HK$ 310,000", winners: String(Math.floor(Math.random() * 3)) },
      { name: "3rd Prize", dividend: "HK$ 45,000", winners: String(Math.floor(Math.random() * 60 + 20)) },
      { name: "4th Prize", dividend: "HK$ 9,600", winners: String(Math.floor(Math.random() * 100 + 40)) },
      { name: "5th Prize", dividend: "HK$ 640", winners: String(Math.floor(Math.random() * 1500 + 1000)) },
      { name: "6th Prize", dividend: "HK$ 320", winners: String(Math.floor(Math.random() * 4000 + 2000)) },
      { name: "7th Prize", dividend: "HK$ 40", winners: String(Math.floor(Math.random() * 50000 + 30000)) }
    ]
  };

  historicalDraws.unshift(newDraw);
  historicalDraws.sort((a, b) => b.date.localeCompare(a.date));
  res.json({ success: true, draw: newDraw });
});

// System reset - reload the base scraped database file cleanly
app.post('/api/reset', (req, res) => {
  try {
    const scrapedPath = path.join(process.cwd(), 'src', 'data', 'scraped_draws.json');
    if (fs.existsSync(scrapedPath)) {
      historicalDraws = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
    } else {
      historicalDraws = [];
    }
    res.json({ success: true, message: "System simulated database reset completed" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Automated OCR analyzing lottery tickets
app.post('/api/ocr', async (req, res) => {
  try {
    const { image } = req.body; // base64 string of ticket
    if (!image) {
      return res.status(400).json({ error: "No screenshot base64 provided." });
    }

    if (!genAI) {
      return res.status(503).json({ 
        error: "Gemini server API key not found. Ensure GEMINI_API_KEY is successfully declared in Secrets panel." 
      });
    }

    // Process using GenAI
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");
    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: "image/png"
      }
    };

    const textPart = {
      text: `Analyze this image of a Hong Kong JC Mark Six lottery ticket or numbers entry.
      Identify:
      - The draw date or draw period if visible, formatted strictly in YYYY-MM-DD (e.g. if you see May 30 2026, return "2026-05-30"). If not visible, default to "2026-05-30" or the most recent draw.
      - Extract all bet combinations accurately. Set the type:
        - "single": exactly 6 numbers (e.g., numbers: [3, 9, 15, 23, 26, 38]). Only ever choose 'single' if there are exactly 6 numbers.
        - "multiple": 7 to 49 numbers (e.g., numbers: [1, 2, 3, 4, 5, 6, 7]).
        - "banker": bankers (膽, numbers marked as banker) up to 5, and remaining legs (腳) numbers.
      Return a clean, exact JSON structure:
      {
        "drawDate": "YYYY-MM-DD",
        "bets": [
          {
            "type": "single" | "multiple" | "banker",
            "numbers": [numbers as integers, sorted ascending],
            "bankers": [integers as bankers, optional],
            "legs": [integers as legs, optional]
          }
        ]
      }
      If numbers are not related to Mark Six or cannot be extracted, try your best to scan any visible patterns of 6 numbers or groups of numbers on the page and fit them into 'single' bets.`
    };

    // Invoke Gemini 3.5 Flash Model
    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["drawDate", "bets"],
          properties: {
            drawDate: { 
              type: Type.STRING, 
              description: "Target draw date in YYYY-MM-DD format based on screenshot content" 
            },
            bets: {
              type: Type.ARRAY,
              description: "Extracted bets from ticket image",
              items: {
                type: Type.OBJECT,
                required: ["type", "numbers"],
                properties: {
                  type: { 
                    type: Type.STRING, 
                    enum: ["single", "multiple", "banker"] 
                  },
                  numbers: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER }
                  },
                  bankers: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER }
                  },
                  legs: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER }
                  }
                }
              }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);

  } catch (error: any) {
    console.error("Gemini OCR Processing failed:", error);
    res.status(500).json({ error: error.message || "Fail parsing ticket screenshot" });
  }
});

// Start routing & server
async function startServer() {
  // If in development mode, link Vite Dev server middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production built files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mark Six Tracker Server operational on http://0.0.0.0:${PORT}`);
  });
}

startServer();

