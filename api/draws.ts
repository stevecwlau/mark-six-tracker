import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { live } = req.query;

  try {
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .order('draw_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({ draws: data || [], live: live === 'true' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch draws' });
  }
}
