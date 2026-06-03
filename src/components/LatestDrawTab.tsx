/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { MarkSixDraw, UserBet, AppSettings } from '../types';
import { translations } from '../translations';
import { evaluateBet } from '../utils/lotterySolver';
import { playSound } from '../utils/soundEffects';
import { Trophy, TrendingUp, Wallet, ArrowRight, Eye, Calendar, DollarSign, ListCollapse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// HKJC Official Ball Mappings
export function getBallBgColor(num: number): string {
  const red = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
  const blue = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 41, 42, 47, 48];
  if (red.includes(num)) return 'ball-red';
  if (blue.includes(num)) return 'ball-blue';
  return 'ball-green';
}

interface LatestDrawTabProps {
  latestDraw: MarkSixDraw | null;
  userBets: UserBet[];
  settings: AppSettings;
}

export default function LatestDrawTab({ latestDraw, userBets, settings }: LatestDrawTabProps) {
  const { language, soundEffects } = settings;
  const t = translations[language];

  const [showTickets, setShowTickets] = useState(false);

  // Filter bets matched on this draw's date
  const drawDate = latestDraw?.date || '';
  const currentDrawBets = userBets.filter(bet => bet.drawDate === drawDate);

  // Calculate results dynamically
  let totalInvestment = 0;
  let totalWinnings = 0;
  const resultsByBetId: { [betId: string]: any } = {};

  if (latestDraw) {
    currentDrawBets.forEach(bet => {
      const evaluation = evaluateBet(bet, latestDraw);
      totalInvestment += evaluation.investment;
      totalWinnings += evaluation.winnings;
      resultsByBetId[bet.id] = evaluation;
    });
  }

  const netProfit = totalWinnings - totalInvestment;

  // Sound effect triggered when winnings are recorded
  useEffect(() => {
    if (latestDraw && currentDrawBets.length > 0 && totalWinnings > 0) {
      playSound('win', soundEffects);
    }
  }, [totalWinnings, currentDrawBets.length]);

  if (!latestDraw) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-950/20 border border-gray-800 rounded-3xl backdrop-blur-md">
        <DollarSign className="w-12 h-12 text-yellow-500 animate-bounce mb-3" />
        <p className="text-gray-400 font-medium">Loading lottery data streams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Celebration Banner if Won */}
      {currentDrawBets.length > 0 && totalWinnings > 0 && (
                  <motion.div className="self-end"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 select-none flex items-center justify-between bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-2 border-yellow-500/50 rounded-2xl shadow-lg shadow-yellow-500/5"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-500 rounded-xl text-black">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-yellow-100 text-sm tracking-tight">{t.latestDraw.congratsTitle}</p>
              <p className="text-orange-400 text-xs font-semibold">
                {t.latestDraw.wonAmount.replace('${amount}', totalWinnings.toLocaleString('en-US', { minimumFractionDigits: 1 }))}
              </p>
            </div>
          </div>
          <span className="text-yellow-400 font-mono text-xs font-bold px-3 py-1 bg-yellow-500/10 rounded-full">
            ★ WINNER ★
          </span>
        </motion.div>
      )}

      {/* Hero Visual results card */}
      <div className={`p-6 shadow-xl relative overflow-hidden rounded-2xl ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border border-gray-200'}`}>
        {/* Absolute glow design */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />

        <div className={`flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-6 gap-4 ${settings.theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-[#10B981]/10 px-2.5 py-1 rounded-full border border-[#10B981]/20">
              {t.latestDraw.title}
            </span>
            <h2 className="text-2xl font-black tracking-tight mt-2 flex items-center gap-1.5">
              <span>{t.latestDraw.drawId}</span>
              <span className="text-[#10B981]">{latestDraw.id}</span>
            </h2>
          </div>
          <div className={`flex items-center space-x-2 text-sm px-3.5 py-2 rounded-2xl border ${settings.theme === 'dark' ? 'text-gray-400 bg-black/40 border-white/5' : 'text-gray-600 bg-gray-50 border-gray-200'}`}>
            <Calendar className="w-4 h-4 text-[#10B981]" />
            <span className="font-medium">{t.latestDraw.drawDate}:</span>
            <span className="font-mono">{latestDraw.date}</span>
          </div>
        </div>

        {/* Balls Deck */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap justify-center items-end gap-3 md:gap-4 select-none">
            {latestDraw.numbers.map((num, idx) => (
              <div key={idx} className="flex flex-col items-center">
                          <motion.div className="self-end"
                  initial={{ scale: 0.1, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 100, delay: idx * 0.08 }}
                  className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center rounded-full text-white text-lg sm:text-xl md:text-2xl font-black shadow-lg shadow-black/30 ${getBallBgColor(num)}`}
                >
                  {num}
                </motion.div>
                <span className="text-[10px] font-mono text-gray-500 mt-1">#{idx+1}</span>
              </div>
            ))}

            {/* Plus separator */}
            <div className="flex items-center justify-center text-gray-400 h-14 md:h-16 text-3xl font-light px-1">
              +
            </div>

            {/* Extra number ball (Special) */}
            <div className="flex flex-col items-center">
                        <motion.div className="self-end"
                initial={{ scale: 0.1, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 100, delay: 0.5 }}
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center rounded-full text-white text-lg sm:text-xl md:text-2xl font-black shadow-lg shadow-black/30 ${getBallBgColor(latestDraw.extra ?? latestDraw.extraNumber)}`}
              >
                {latestDraw.extra ?? latestDraw.extraNumber}
              </motion.div>
              <span className="text-[10px] text-yellow-500 font-bold tracking-tight mt-1 uppercase">
                特別號碼
              </span>
            </div>
          </div>
        </div>

        {/* Next Draw info card deck */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-2xl ${settings.theme === 'dark' ? 'bg-black/40 border border-white/5' : 'bg-gray-50 border border-gray-200'}`}>
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-gray-500 font-semibold">Top Prizes</p>
              <span className="text-xs text-gray-500 font-semibold">Unit Prize (Winning Unit)</span>
            </div>

            {latestDraw.prizes && latestDraw.prizes.length > 0 ? (
              <div className="space-y-2">
                {latestDraw.prizes.slice(0, 3).map((prize, idx) => {
                  const colors = [
                    { text: "text-yellow-400", dot: "bg-yellow-400" },
                    { text: "text-slate-300",  dot: "bg-slate-400" },
                    { text: "text-orange-400", dot: "bg-orange-400" }
                  ];
                  const c = colors[idx] || { text: "text-emerald-400", dot: "bg-emerald-400" };
                  
                  return (
                    <div key={idx} className={`flex items-center justify-between gap-3 ${c.text}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-1 rounded-full ${c.dot}`}></div>
                        <span className="text-sm font-medium tracking-tight">{prize.name}</span>
                      </div>
                      <span className="font-mono text-sm tabular-nums tracking-tighter">
                        {prize.amount} ({prize.winners})
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xl font-black text-emerald-400 font-mono tracking-tight">{latestDraw.jackpot}</p>
            )}
          </div>
          <div className={`border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 ${settings.theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 font-semibold">{t.latestDraw.nextJackpot}</p>
            <p className="text-xl font-black text-yellow-500 font-mono tracking-tight mt-1">{latestDraw.nextJackpot}</p>
          </div>
          <div className={`border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-4 ${settings.theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 font-semibold">{t.latestDraw.cutoffTime}</p>
            <p className="text-sm font-bold text-gray-400 mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono">{latestDraw.nextDeadline}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Betting Performance check */}
      <div className={`p-6 rounded-2xl ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#10B981]" />
          <span>{t.latestDraw.performanceSummary}</span>
        </h3>

        {currentDrawBets.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl border ${settings.theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
            <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">{t.latestDraw.noBetsThisDraw}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Investment numbers layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-2xl border ${settings.theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-xs text-gray-500 font-medium block">{t.latestDraw.totalInvested}</span>
                <span className="text-xl font-black font-mono tracking-tight mt-1 block">
                  HK$ {totalInvestment.toLocaleString()}
                </span>
                <span className="text-[10px] text-gray-550 mt-0.5 block">
                  ({t.latestDraw.activeBetsRecorded} {currentDrawBets.length})
                </span>
              </div>
              <div className={`p-4 rounded-2xl border ${settings.theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-xs text-gray-500 font-medium block">{t.latestDraw.totalWon}</span>
                <span className={`text-xl font-black font-mono tracking-tight mt-1 block ${totalWinnings > 0 ? 'text-[#10B981]' : 'text-gray-500'}`}>
                  HK$ {totalWinnings.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                </span>
              </div>
              <div className={`p-4 rounded-2xl border ${settings.theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-xs text-gray-500 font-medium block">{t.latestDraw.netProfit}</span>
                <span className={`text-xl font-black font-mono tracking-tight mt-1 block ${netProfit > 0 ? 'text-[#10B981]' : netProfit < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                  {netProfit > 0 ? '+' : ''}HK$ {netProfit.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                </span>
              </div>
            </div>

            {/* Toggle show list tickets */}
            <div>
              <button
                id="btn-toggle-tickets"
                onClick={() => setShowTickets(!showTickets)}
                className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/25 px-4 py-2 rounded-xl"
              >
                {showTickets ? <ListCollapse className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showTickets ? "Hide Recorded Placements" : t.latestDraw.ticketPreview}</span>
              </button>

              <AnimatePresence>
                {showTickets && (
                            <motion.div className="self-end"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-4 space-y-3"
                  >
                    {currentDrawBets.map((bet, i) => {
                      const results = resultsByBetId[bet.id];
                      return (
                        <div key={bet.id} className="p-4 bg-gray-950/60 border border-gray-850 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">
                                {bet.type.toUpperCase()} BET
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                {bet.isPartialUnit ? t.vault.table.partialUnit : t.vault.table.fullUnit}
                              </span>
                              {bet.id && (
                                <span className="text-[9px] text-gray-600 font-mono ml-1">ID: {bet.id}</span>
                              )}
                            </div>
                            
                            {/* Selected Ball row */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-300">
                              {bet.type === 'banker' ? (
                                <>
                                  <span className="text-gray-500 font-bold">{t.vault.table.bankerLead}</span>
                                  {bet.bankers?.map(v => (
                                    <span key={v} className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold border ${latestDraw.numbers.includes(v) ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 ring-2 ring-emerald-500/30' : 'bg-gray-800/40 border-gray-700 text-gray-400'}`}>
                                      {v}
                                    </span>
                                  ))}
                                  <span className="text-gray-500 font-bold ml-1">{t.vault.table.legsLead}</span>
                                  {bet.legs?.map(v => (
                                    <span key={v} className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold border ${latestDraw.numbers.includes(v) ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 ring-2 ring-emerald-500/30' : 'bg-gray-850 border-gray-750 text-gray-500'}`}>
                                      {v}
                                    </span>
                                  ))}
                                </>
                              ) : (
                                bet.numbers.map(v => (
                                  <span key={v} className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold border ${latestDraw.numbers.includes(v) ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 ring-2 ring-emerald-500/30' : bet.numbers.length > 20 ? 'inline-block text-gray-400 border-none' : 'bg-gray-850 border-gray-750 text-gray-500'}`}>
                                    {v}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Individual evaluation */}
                          <div className="sm:text-right border-t sm:border-t-0 border-gray-800 pt-2 sm:pt-0">
                            <p className="text-[10px] text-gray-400 font-semibold">{t.latestDraw.checkResults}</p>
                            <div className="flex sm:flex-col items-baseline sm:items-center justify-between gap-2 mt-0.5">
                              <span className="text-xs text-gray-550 block">Cost / 投注: HK$ {results?.investment}</span>
                              <span className={`text-sm font-black font-mono ${results?.winnings > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                Won: HK$ {results?.winnings?.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
