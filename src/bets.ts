import { supabase } from './supabase';
import { UserBet } from './types';

export async function saveBetToSupabase(bet: UserBet, userId: string) {
  const { error } = await supabase
    .from('bets')
    .insert({
      id: bet.id,
      user_id: userId,
      draw_date: bet.drawDate,
      numbers: bet.numbers,
      type: bet.type,
      bankers: bet.bankers || null,
      legs: bet.legs || null,
      is_partial_unit: bet.isPartialUnit || false,
      import_date: bet.importDate,
      source: bet.source,
      ticket_image_url: bet.ticketImageUrl || null,
    });

  if (error) throw error;
}

export async function loadBetsFromSupabase(userId: string): Promise<UserBet[]> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    drawDate: row.draw_date,
    numbers: row.numbers,
    type: row.type,
    bankers: row.bankers || undefined,
    legs: row.legs || undefined,
    isPartialUnit: row.is_partial_unit,
    importDate: row.import_date,
    source: row.source,
    ticketImageUrl: row.ticket_image_url || undefined,
  }));
}

export async function deleteBetFromSupabase(betId: string) {
  const { error } = await supabase
    .from('bets')
    .delete()
    .eq('id', betId);

  if (error) throw error;
}
