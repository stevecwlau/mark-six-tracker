import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic simulated draw generator (can be improved later)
  const latest = {
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

  const nextDateObj = new Date(latest.date);
  nextDateObj.setDate(nextDateObj.getDate() + 4);
  const nextDateStr = nextDateObj.toISOString().split('T')[0];

  const futureDateObj = new Date(nextDateObj);
  futureDateObj.setDate(futureDateObj.getDate() + 4);
  const futureDateStr = futureDateObj.toISOString().split('T')[0];

  // Generate random numbers
  const numbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 49) + 1).sort((a, b) => a - b);
  const extraNumber = Math.floor(Math.random() * 49) + 1;

  const newDraw = {
    id: nextId,
    date: nextDateStr,
    numbers,
    extraNumber,
    jackpot: "HK$ 8,000,000",
    nextDrawDate: futureDateStr,
    nextJackpot: "HK$ 8,000,000",
    nextDeadline: `${futureDateStr} 21:15`
  };

  res.status(200).json({ success: true, newDraw });
}
