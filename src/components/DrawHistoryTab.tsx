/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { MarkSixDraw, UserBet, AppSettings } from '../types';
import { translations } from '../translations';
import { evaluateBet } from '../utils/lotterySolver';
import { playSound } from '../utils/soundEffects';
import { Search, ChevronDown, ChevronUp, Calendar, LayoutGrid, CheckSquare, Award, ArrowUpRight } from 'lucide-react';
import { getBallBgColor } from './LatestDrawTab';

interface DrawHistoryTabProps {
  historicalDraws: MarkSixDraw[];
  userBets: UserBet[];
  settings: AppSettings;
}

export default function DrawHistoryTab({ historicalDraws, userBets, settings }: DrawHistoryTabProps) {
  const { language, soundEffects } = settings;
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBetsOnly, setFilterBetsOnly] = useState(false);
  const [expandedDrawId, setExpandedDrawId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Track calendar click
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('');

  // Ball highlight design helper
  const renderBall = (num: number, isMatched: boolean, isExtraMatched: boolean) => {
    if (isMatched) {
      return (
        <span
          key={num}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow-md relative shrink-0 ${getBallBgColor(num)}`}
          title={`Matched Regular: ${num}`}
        >
          {num}
          <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 text-white text-[7px] w-3 h-3 rounded-full flex items-center justify-center font-bold ring-1 ring-black">✓</span>
        </span>
      );
    }
    if (isExtraMatched) {
      return (
        <span
          key={num}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow-md relative shrink-0 ring-2 ring-amber-400 ring-offset-1 ${settings.theme === 'dark' ? 'ring-offset-gray-950' : 'ring-offset-white'} ${getBallBgColor(num)}`}
          title={`Matched Special: ${num}`}
        >
          {num}
          <span className="absolute -bottom-0.5 -right-0.5 bg-amber-400 text-gray-950 text-[7px] w-3 h-3 rounded-full flex items-center justify-center font-black ring-1 ring-black">+</span>
        </span>
      );
    }
    return (
      <span
        key={num}
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center text-[10px] sm:text-xs font-semibold select-none shrink-0 ${
          settings.theme === 'dark'
            ? 'bg-gray-900/30 border-gray-800 text-gray-600'
            : 'bg-gray-50 border-gray-200 text-gray-400'
        }`}
        title={`Not Matched: ${num}`}
      >
        {num}
      </span>
    );
  };

  const toggleExpand = (drawId: string) => {
    playSound('click', soundEffects);
    if (expandedDrawId === drawId) {
      setExpandedDrawId(null);
    } else {
      setExpandedDrawId(drawId);
    }
  };

  // Perform search & filters
  const filteredDraws = historicalDraws.filter(draw => {
    // 1. Filter by user placed bets
    if (filterBetsOnly) {
      const hasBets = userBets.some(bet => bet.drawDate === draw.date);
      if (!hasBets) return false;
    }

    // 2. Filter by search query (id or date)
    const matchesSearch = draw.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          draw.date.includes(searchQuery);
    if (!matchesSearch) return false;

    // 3. Filter by calendar date
    if (selectedCalendarDate) {
      if (draw.date !== selectedCalendarDate) return false;
    }

    return true;
  });

  // Paginated elements
  const totalPages = Math.ceil(filteredDraws.length / itemsPerPage);
  const paginatedDraws = filteredDraws.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Search filters menu shelf */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-2xl ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
        {/* Text search query */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t.history.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-gray-950/60 border border-gray-800 text-xs font-semibold text-gray-100 placeholder-gray-500 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-400 focus:bg-gray-950 transition-all"
          />
        </div>

        {/* Bets check toggle */}
        <div className="flex items-center">
          <button
            onClick={() => {
              playSound('click', soundEffects);
              setFilterBetsOnly(!filterBetsOnly);
              setCurrentPage(1);
            }}
            className={`w-full flex items-center justify-between border px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterBetsOnly ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-gray-950 border-gray-850 text-gray-400'}`}
          >
            <span className="flex items-center space-x-2">
              <CheckSquare className="w-4.5 h-4.5" />
              <span>{t.history.filterBets}</span>
            </span>
            <span className="text-[10px] bg-white/5 font-mono px-2.5 py-0.5 rounded-full">
              {userBets.filter(b => historicalDraws.some(d => d.date === b.drawDate)).length} Bets Active
            </span>
          </button>
        </div>

        {/* Date Selector input (mini calendar helper) */}
        <div className="flex items-center space-x-2">
          <Calendar className="w-4.5 h-4.5 text-gray-400 shrink-0" />
          <input
            type="date"
            value={selectedCalendarDate}
            onChange={(e) => {
              playSound('click', soundEffects);
              setSelectedCalendarDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-gray-950/60 border border-gray-800 text-xs font-bold text-gray-200 outline-none rounded-xl px-3 py-2 focus:border-emerald-400 outline-none"
          />
          {selectedCalendarDate && (
            <button
              onClick={() => {
                setSelectedCalendarDate('');
                setCurrentPage(1);
              }}
              className="text-xs text-rose-450 hover:text-white font-medium px-2 py-1 uppercase"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* History table log */}
      {paginatedDraws.length === 0 ? (
        <div className={`flex flex-col items-center justify-center p-14 rounded-2xl border ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200'}`}>
          <LayoutGrid className="w-9 h-9 text-gray-500 mb-2" />
          <p className="text-sm font-semibold text-gray-400">No draws meet the searching criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedDraws.map(draw => {
            const hasBetsOnDate = userBets.some(bet => bet.drawDate === draw.date);
            const betsOnDate = userBets.filter(bet => bet.drawDate === draw.date);
            const isExpanded = expandedDrawId === draw.id;

            // Compute performance metric sum for this draw
            let drawCostSum = 0;
            let drawWinningsSum = 0;
            betsOnDate.forEach(b => {
              const evalInfo = evaluateBet(b, draw);
              drawCostSum += evalInfo.investment;
              drawWinningsSum += evalInfo.winnings;
            });

            return (
              <div
                key={draw.id}
                className={`border rounded-2xl overflow-hidden transition-all duration-200 ${settings.theme === 'dark' ? (isExpanded ? 'border-[#10B981]/50 bg-[#161619]' : 'border-white/5 bg-black/20 hover:border-white/10') : (isExpanded ? 'border-emerald-400 bg-emerald-50/10' : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm')}`}
              >
                {/* Visual Header Row */}
                <div
                  onClick={() => toggleExpand(draw.id)}
                  className={`p-4 flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 cursor-pointer select-none ${settings.theme === 'dark' ? 'hover:bg-white/[0.015]' : 'hover:bg-gray-50/50'}`}
                >
                  <div className="md:col-span-4 flex flex-wrap items-center gap-2 sm:gap-3.5">
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded whitespace-nowrap shrink-0">
                      ID: {draw.id}
                    </span>
                    <span className="text-xs text-gray-400 font-mono flex items-center space-x-1 whitespace-nowrap shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>{draw.date}</span>
                    </span>

                    {hasBetsOnDate && (
                      <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-0.5 rounded-full font-bold select-none tracking-tight whitespace-nowrap shrink-0">
                        ⚡ PLACED BETS ({betsOnDate.length})
                      </span>
                    )}
                  </div>

                  {/* Draw numbers group */}
                  <div className="md:col-span-4 flex md:justify-center flex-wrap items-center gap-1.5 shrink-0">
                    {draw.numbers.map((v, idx) => (
                      <span
                        key={idx}
                        className={`w-6 h-6 rounded-full text-[10px] text-white font-bold flex items-center justify-center ${getBallBgColor(v)}`}
                      >
                        {v}
                      </span>
                    ))}
                    <span className="text-gray-650 font-bold ml-0.5 inline-block">+</span>
                    <span
                      className={`w-6 h-6 rounded-full text-[10px] text-white font-black flex items-center justify-center ${getBallBgColor(draw.extraNumber)}`}
                    >
                      {draw.extraNumber}
                    </span>
                  </div>

                  {/* Profit indicator and expand button */}
                  <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-3 border-t md:border-none border-gray-850 pt-2.5 md:pt-0">
                    {hasBetsOnDate && (
                      <span className={`text-[11px] font-sans font-bold whitespace-nowrap ${drawWinningsSum > drawCostSum ? 'text-emerald-400' : drawWinningsSum < drawCostSum ? 'text-rose-450' : 'text-gray-400'}`}>
                        {drawWinningsSum > drawCostSum ? 'Won' : drawWinningsSum < drawCostSum ? 'Lost' : 'Even'}: HK$ {(drawWinningsSum - drawCostSum).toLocaleString()}
                      </span>
                    )}

                    <div className="text-xs text-emerald-400 hover:text-emerald-300 font-bold uppercase flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <span>{isExpanded ? t.history.hideAnalysis : t.history.expandAnalysis}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Sub row Expandable Betting analytics panel */}
                {isExpanded && (
                  <div className="bg-gray-950/40 border-t border-gray-850 p-5 space-y-4">
                    {/* Placed bets calculations detail */}
                    {hasBetsOnDate ? (
                      <div className="space-y-4 relative">
                        <div className="absolute right-0 top-0 uppercase text-[8px] font-black text-gray-500 tracking-wider">
                          Real-Time Performance Analyzer
                        </div>
                        <h4 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-emerald-400" />
                          <span>{language === 'zh' ? `我今期買咗嘅飛 (${betsOnDate.length} 注)` : `My Placed Bets (${betsOnDate.length} tickets)`}</span>
                        </h4>

                        {/* Top Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className={`p-3 border rounded-xl ${settings.theme === 'dark' ? 'bg-gray-950/45 border-gray-850' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <span className="text-[9px] text-gray-500 font-semibold block">{t.history.investmentCount}</span>
                            <span className={`text-sm font-bold ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-800'} block`}>{betsOnDate.length} tickets</span>
                          </div>
                          <div className={`p-3 border rounded-xl ${settings.theme === 'dark' ? 'bg-gray-950/45 border-gray-850' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <span className="text-[9px] text-gray-500 font-semibold block">{t.history.investmentLabel}</span>
                            <span className={`text-sm font-bold font-mono ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-800'} block`}>HK$ {drawCostSum.toLocaleString()}</span>
                          </div>
                          <div className={`p-3 border rounded-xl ${settings.theme === 'dark' ? 'bg-gray-950/45 border-gray-850' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <span className="text-[9px] text-gray-500 font-semibold block">{t.history.returnLabel}</span>
                            <span className={`text-sm font-black font-mono block ${drawWinningsSum > drawCostSum ? 'text-emerald-400' : drawWinningsSum < drawCostSum ? 'text-rose-450' : 'text-gray-400'}`}>
                              HK$ {drawWinningsSum.toLocaleString('en', { minimumFractionDigits: 1 })}
                            </span>
                          </div>
                        </div>

                        {/* Visualized bets list with highlighted matched balls */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                          {betsOnDate.map(bet => {
                            const result = evaluateBet(bet, draw);
                            const allNumbers = bet.type === 'banker' 
                              ? [...(bet.bankers || []), ...(bet.legs || [])] 
                              : (bet.numbers || []);
                            const matchRegCount = allNumbers.filter(n => draw.numbers.includes(n)).length;
                            const matchExtCount = allNumbers.includes(draw.extraNumber) ? 1 : 0;
                            const bankers = bet.bankers || [];
                            const legs = bet.legs || [];
                            
                            const winningLevels = Object.entries(result.breakdown).filter(([_, count]) => count > 0);

                            return (
                              <div 
                                key={bet.id} 
                                className={`p-4 border rounded-xl transition-all ${
                                  settings.theme === 'dark' 
                                    ? 'bg-gray-900/40 border-gray-850 hover:bg-gray-900/60' 
                                    : 'bg-white border-gray-200 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  {/* Left Details Panel */}
                                  <div className="space-y-2 flex-grow">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-550/10 text-emerald-400 border border-emerald-500/15 rounded uppercase">
                                        {bet.type === 'single' ? t.vault.table.single : bet.type === 'multiple' ? t.vault.table.multiple : t.vault.table.banker}
                                      </span>
                                      <span className="text-[10px] text-gray-400 font-semibold font-mono">
                                        {bet.isPartialUnit ? t.vault.table.partialUnit : t.vault.table.fullUnit}
                                      </span>
                                      <span className="text-[10px] text-gray-550">
                                        ID: {bet.id.substring(0, 8)}
                                      </span>
                                    </div>

                                    {/* Visual Balls Segment */}
                                    <div className="py-2">
                                      {bet.type === 'banker' ? (
                                        <div className="space-y-2.5">
                                          <div>
                                            <div className="text-[9px] text-gray-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-450"></span>
                                              <span>{language === 'zh' ? '膽 (Bankers)' : 'Bankers'}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {bankers.map(num => renderBall(
                                                num,
                                                draw.numbers.includes(num),
                                                num === draw.extraNumber
                                              ))}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-[9px] text-gray-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                              <span>{language === 'zh' ? '腳 (Legs)' : 'Legs'}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {legs.map(num => renderBall(
                                                num,
                                                draw.numbers.includes(num),
                                                num === draw.extraNumber
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {[...bet.numbers].sort((a, b) => a - b).map(num => renderBall(
                                            num,
                                            draw.numbers.includes(num),
                                            num === draw.extraNumber
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Performance Segment */}
                                  <div className="flex flex-col items-start sm:items-end justify-between self-stretch sm:text-right shrink-0 min-w-[145px] border-t sm:border-t-0 border-gray-800/60 pt-2.5 sm:pt-0">
                                    <div className="text-xs font-semibold text-gray-450">
                                      {language === 'zh' 
                                        ? `對獎結果: 中 ${matchRegCount} 個正碼 + [${matchExtCount} 個特別碼]`
                                        : `Matches: ${matchRegCount} reg / ${matchExtCount} spec`
                                      }
                                    </div>

                                    <div className="mt-1">
                                      <span className="text-[10px] text-gray-500 block">
                                        {language === 'zh' ? `成本: HK$ ${result.investment}` : `Cost: HK$ ${result.investment}`}
                                      </span>
                                      <span className={`text-xs font-black font-mono block ${result.winnings > 0 ? 'text-yellow-400 bg-yellow-400/5 px-2 py-0.5 rounded border border-yellow-400/20' : 'text-gray-500'}`}>
                                        {language === 'zh' ? `中咗: HK$ ${result.winnings.toLocaleString()}` : `Winnings: HK$ ${result.winnings.toLocaleString()}`}
                                      </span>
                                    </div>

                                    {/* Won Prize Badges list */}
                                    {winningLevels.length > 0 && (
                                      <div className="flex flex-wrap sm:justify-end gap-1 mt-2">
                                        {winningLevels.map(([prizeName, count]) => (
                                          <span 
                                            key={prizeName} 
                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-400/10 text-amber-400 border border-amber-400/20"
                                          >
                                            ★ {count}x {prizeName}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6 border border-dashed border-gray-800 rounded-xl space-y-2">
                        <p className="text-xs text-gray-500 font-semibold select-none">
                          {language === 'zh' 
                            ? '呢一期你無入到飛。' 
                            : 'No active bet records registered under this drawing.'
                          }
                        </p>
                        <p className="text-[10px] text-gray-650 max-w-md mx-auto">
                          {language === 'zh'
                            ? '去「彩票儲存箱」或者「入飛」功能入咗你揀嘅號碼先，個系統就會幫你自動同過往攪珠數據比對，計返你賺定蝕同贏幾多錢喇！'
                            : 'Navigate to "Bet Vault" or "Import Bets" to register your lottery tickets, and then expand this drawing to automatically see matched balls & payouts!'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 pt-3 select-none">
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  playSound('click', soundEffects);
                  setCurrentPage(prev => Math.max(prev - 1, 1));
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-850 bg-gray-900/60 hover:bg-gray-850 text-gray-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="text-xs font-mono text-gray-400 px-3">
                {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  playSound('click', soundEffects);
                  setCurrentPage(prev => Math.min(prev + 1, totalPages));
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-850 bg-gray-900/60 hover:bg-gray-850 text-gray-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
