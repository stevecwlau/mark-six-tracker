import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Placeholder - returns a fake next draw
  return res.status(200).json({
    message: "Simulated draw generated",
    nextDraw: {
      draw_date: new Date().toISOString().split('T')[0],
      numbers: [1, 2, 3, 4, 5, 6],
      special: 7
    }
  });
}
