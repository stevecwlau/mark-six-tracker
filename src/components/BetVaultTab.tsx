/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { UserBet, MarkSixDraw, AppSettings } from '../types';
import { translations } from '../translations';
import { calculateBetCost, evaluateBet } from '../utils/lotterySolver';
import { playSound } from '../utils/soundEffects';
import { Plus, Trash2, Calendar, FileText, Check, AlertCircle, Upload, Sparkles } from 'lucide-react';
import { getBallBgColor } from './LatestDrawTab';
import BetImporterTab from './BetImporterTab';

interface BetVaultTabProps {
  userBets: UserBet[];
  historicalDraws: MarkSixDraw[];
  settings: AppSettings;
  currentUser: User | null;
  onAddBet: (bet: Omit<UserBet, 'id' | 'importDate'>) => void;
  onDeleteBet: (betId: string) => void;
  onClearAllBets: () => void;
  onImportBets: (bets: Omit<UserBet, 'id' | 'importDate'>[]) => void;
}

// Get the next upcoming Mark Six draw (Tue/Thu/Sat)
// Generate next upcoming draw based on the latest scraped draw
function getNextUpcomingDraw(latestDraw: any): { id: string; date: string } {
  if (!latestDraw) {
    return { id: "26/060", date: "2026-06-04" };
  }

  // Get next deadline from scraped data (Cut-off Time)
  const nextDate = latestDraw.nextDeadline 
    ? latestDraw.nextDeadline.split(" ")[0] 
    : latestDraw.date;

  // Generate next draw ID
  const latestId = latestDraw.id; // e.g. "26/059"
  const parts = latestId.split("/");
  const prefix = parts[0]; // "26"
  const num = parseInt(parts[1], 10);
  const nextNum = (num + 1).toString().padStart(3, "0");
  const nextId = `${prefix}/${nextNum}`;

  return {
    id: nextId,
    date: nextDate
  };
}

export default function BetVaultTab({
  userBets,
  historicalDraws,
  settings,
  currentUser,
  onAddBet,
  onDeleteBet,
  onClearAllBets,
  onImportBets,
  onLogin,
  onSignUp
}: BetVaultTabProps) {
  const { language, soundEffects } = settings;
  const t = translations[language];

  const isLoggedIn = !!currentUser;

  // Overlay login state
  const [overlayMode, setOverlayMode] = useState<"choice" | "login" | "signup" | "forgot">("login");
  const [overlayEmail, setOverlayEmail] = useState("");
  const [overlayPassword, setOverlayPassword] = useState("");
  const [overlayUsername, setOverlayUsername] = useState("");
  const [overlayConfirmPassword, setOverlayConfirmPassword] = useState("");

  const [overlayError, setOverlayError] = useState("");
  const getFriendlyError = (error: any, mode: "login" | "signup" | "forgot") => {
    const msg = (error?.message || "").toLowerCase();
    const code = (error?.error_code || error?.code || "").toLowerCase();

    if (mode === "signup") {
      if (
        msg.includes("already registered") ||
        msg.includes("user already registered") ||
        code === "invalid_credentials" ||
        msg.includes("invalid login credentials")
      ) {
        return "This email is already registered. Please log in instead.";
      }
      if (msg.includes("password")) {
        return "Password must be at least 6 characters.";
      }
      if (msg.includes("rate limit")) {
        return "Too many attempts. Please try again later.";
      }
      return "Signup failed. Please check your details.";
    }

    if (msg.includes("invalid login credentials") || code === "invalid_credentials") {
      return "Invalid email or password.";
    }
    return error?.message || "Login failed";
  };



  // AI-Assisted selection: analyze last 10 draws or fallback to empty
  const hottestStats = useMemo(() => {
    const last10 = historicalDraws.slice(0, 10);
    const counts: { [num: number]: number } = {};
    for (let i = 1; i <= 49; i++) {
      counts[i] = 0;
    }
    last10.forEach(draw => {
      if (draw.numbers) {
        draw.numbers.forEach(n => {
          counts[n] = (counts[n] || 0) + 1;
        });
      }
      if (draw.extraNumber) {
        counts[draw.extraNumber] = (counts[draw.extraNumber] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([numStr, count]) => ({ num: Number(numStr), count }))
      .sort((a, b) => b.count - a.count || b.num - a.num);
  }, [historicalDraws]);

  // Manual entry sheet display toggle
  const [showForm, setShowForm] = useState(false);
  // Scan & import tickets display toggle
  const [showImporter, setShowImporter] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Manual placement state
  const [targetDate, setTargetDate] = useState(() => getNextUpcomingDraw(historicalDraws[0]).date);
  const [betType, setBetType] = useState<'single' | 'multiple' | 'banker'>('single');
  const [isPartial, setIsPartial] = useState(false);
  const [multipleBallCount, setMultipleBallCount] = useState<number>(8);

  // Selector state for numbers
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [bankers, setBankers] = useState<number[]>([]);
  const [legs, setLegs] = useState<number[]>([]);

  // Input states & error messages
  const [errorText, setErrorText] = useState('');

  // Clean form selection states
  const handleTypeChange = (type: 'single' | 'multiple' | 'banker') => {
    playSound('click', soundEffects);
    setBetType(type);
    setSelectedNumbers([]);
    setBankers([]);
    setLegs([]);
    setErrorText('');
    if (type === 'single') {
      setIsPartial(false);
    }
  };

  const handleQuickPick = () => {
    playSound('click', soundEffects);
    setErrorText('');
    
    // We want to pick numbers based on real historical draw frequency of the last 10 draws.
    // To do this, we get the top 18 hottest numbers based on actual frequency.
    const hotPool = hottestStats.slice(0, 18).map(x => x.num);
    
    // Shuffle helper (Fisher-Yates style)
    const shuffle = (arr: number[]) => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    
    const shuffledPool = shuffle(hotPool);
    const remainingNumbers = Array.from({ length: 49 }, (_, i) => i + 1).filter(num => !hotPool.includes(num));
    const finalPool = [...shuffledPool, ...shuffle(remainingNumbers)];

    if (betType === 'single') {
      // Pick exactly 6 numbers
      const picked = finalPool.slice(0, 6).sort((a, b) => a - b);
      setSelectedNumbers(picked);
      setBankers([]);
      setLegs([]);
    } else if (betType === 'multiple') {
      // Pick custom multipleBallCount numbers for multi-selection
      const count = Math.max(7, Math.min(49, multipleBallCount));
      const picked = finalPool.slice(0, count).sort((a, b) => a - b);
      setSelectedNumbers(picked);
      setBankers([]);
      setLegs([]);
    } else if (betType === 'banker') {
      // Pick 3 bankers and 5 legs (minimum requirements satisfied, making 8 total numbers)
      const bankerCount = 3;
      const legCount = 5;
      const pickedBankers = finalPool.slice(0, bankerCount).sort((a, b) => a - b);
      const pickedLegs = finalPool.slice(bankerCount, bankerCount + legCount).sort((a, b) => a - b);
      
      setSelectedNumbers([]);
      setBankers(pickedBankers);
      setLegs(pickedLegs);
    }
  };

  const toggleNumberSelection = (num: number) => {
    playSound('click', soundEffects);
    setErrorText('');

    if (betType === 'single' || betType === 'multiple') {
      if (selectedNumbers.includes(num)) {
        setSelectedNumbers(selectedNumbers.filter(n => n !== num));
      } else {
        if (betType === 'single' && selectedNumbers.length >= 6) {
          setErrorText(t.importer.singleLimit);
          return;
        }
        setSelectedNumbers([...selectedNumbers, num].sort((a,b)=>a-b));
      }
    } else {
      // Banker mode
      // Determine if number is currently a banker, leg, or unselected
      if (bankers.includes(num)) {
        setBankers(bankers.filter(n => n !== num));
      } else if (legs.includes(num)) {
        setLegs(legs.filter(n => n !== num));
      } else {
        // Toggle interaction: Default to adding as banker if bankers < 5. Otherwise add to legs.
        if (bankers.length < 5) {
          setBankers([...bankers, num].sort((a,b)=>a-b));
        } else {
          setLegs([...legs, num].sort((a,b)=>a-b));
        }
      }
    }
  };

  // Switch a selected number specifically to leg or banker in banker mode
  const promoteToBanker = (num: number) => {
    playSound('click', soundEffects);
    if (bankers.length >= 5) {
      setErrorText(t.importer.bankerLimit);
      return;
    }
    setLegs(legs.filter(n => n !== num));
    setBankers([...bankers, num].sort((a,b)=>a-b));
  };

  const demoteToLeg = (num: number) => {
    playSound('click', soundEffects);
    setBankers(bankers.filter(n => n !== num));
    setLegs([...legs, num].sort((a,b)=>a-b));
  };

  const handleManualAddSubmit = () => {
    // Perform validators
    if (betType === 'single') {
      if (selectedNumbers.length !== 6) {
        setErrorText(t.importer.singleLimit);
        playSound('error', soundEffects);
        return;
      }
      onAddBet({
        drawDate: targetDate,
        type: 'single',
        numbers: selectedNumbers,
        isPartialUnit: isPartial,
        source: 'manual'
      });
    } else if (betType === 'multiple') {
      if (selectedNumbers.length < 7) {
        setErrorText(t.importer.multipleCount);
        playSound('error', soundEffects);
        return;
      }
      onAddBet({
        drawDate: targetDate,
        type: 'multiple',
        numbers: selectedNumbers,
        isPartialUnit: isPartial,
        source: 'manual'
      });
    } else if (betType === 'banker') {
      if (bankers.length < 1 || bankers.length > 5) {
        setErrorText(t.importer.bankerLimit);
        playSound('error', soundEffects);
        return;
      }
      const requiredLegs = 6 - bankers.length;
      if (legs.length < requiredLegs) {
        setErrorText(t.importer.legsRequired);
        playSound('error', soundEffects);
        return;
      }
      onAddBet({
        drawDate: targetDate,
        type: 'banker',
        numbers: [...bankers, ...legs].sort((a,b)=>a-b),
        bankers,
        legs,
        isPartialUnit: isPartial,
        source: 'manual'
      });
    }

    // Reset Form
    playSound('win', soundEffects);
    setSelectedNumbers([]);
    setBankers([]);
    setLegs([]);
    setShowForm(false);
  };

  // Determine current placement cost calculation during formulation
  const currentCost = calculateBetCost({
    type: betType,
    numbers: selectedNumbers,
    bankers,
    legs,
    isPartialUnit: isPartial
  });

  // Calculate lifetime metrics and statistics
  let lifetimeCost = 0;
  let lifetimeWinnings = 0;

  userBets.forEach(bet => {
    lifetimeCost += calculateBetCost(bet);
    // Find matching draw
    const matchingDraw = historicalDraws.find(d => d.date === bet.drawDate || d.id === bet.drawDate);
    if (matchingDraw) {
      const evaluation = evaluateBet(bet, matchingDraw);
      lifetimeWinnings += evaluation.winnings;
    }
  });

  const lifetimeROI = lifetimeCost > 0 ? ((lifetimeWinnings - lifetimeCost) / lifetimeCost) * 100 : 0;

  return (
    <div className="relative">
      {!isLoggedIn && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className={`relative z-10 w-full max-w-md mx-4 p-8 rounded-3xl border shadow-2xl ${settings.theme === "dark" ? "bg-[#111114] border-[#222226]" : "bg-white border-gray-200"}`}>
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-rose-400" />
              </div>
              <h3 className="text-xl font-black tracking-tight">Login required to use the Bet Vault</h3>
              <p className="text-sm text-gray-400 mt-2">Please sign in or create an account.</p>
            </div>

            {overlayMode === "choice" ? (
              <div className="space-y-3">
                <button onClick={() => { setOverlayMode("login"); setOverlayError(""); }} className="w-full py-3.5 text-sm font-bold bg-[#10B981] hover:bg-[#10B981]/90 text-black rounded-2xl transition-all">LOGIN</button>
                <button onClick={() => { setOverlayMode("signup"); setOverlayError(""); }} className="w-full py-3.5 text-sm font-bold border border-white/20 hover:bg-white/5 rounded-2xl transition-all">SIGN UP</button>
              </div>
            ) : overlayMode === "forgot" ? (
              <div className="space-y-4">
                <div className="text-center text-sm font-bold mb-1">Reset Password</div>
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  value={overlayEmail} 
                  onChange={e => setOverlayEmail(e.target.value)} 
                  className="w-full bg-[#0A0A0B] border border-[#222226] text-sm px-4 py-3 rounded-2xl" 
                />
                {overlayError && <div className="text-rose-400 text-xs font-bold">{overlayError}</div>}
                <button 
                  onClick={async () => {
                    if (!overlayEmail) { setOverlayError("Email is required"); return; }
                    try {
                      const { error } = await (await import("../supabase")).supabase.auth.resetPasswordForEmail(overlayEmail);
                      if (error) throw error;
                      setOverlayError("Password reset email sent! Check your inbox.");
                    } catch (err: any) {
                      setOverlayError(err?.message || "Failed to send reset email");
                    }
                  }} 
                  className="w-full py-3.5 text-sm font-bold bg-[#10B981] hover:bg-[#10B981]/90 text-black rounded-2xl mt-2"
                >
                  SEND RESET LINK
                </button>
                <button onClick={() => { setOverlayMode("login"); setOverlayError(""); }} className="w-full text-xs text-gray-400 hover:text-gray-300">Back to Login</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center text-sm font-bold mb-1">
                  {overlayMode === "signup" ? "Create Account" : "Sign In"}
                </div>

                {overlayMode === "signup" && (
                  <input 
                    type="text" 
                    placeholder="Username" 
                    value={overlayUsername} 
                    onChange={e => setOverlayUsername(e.target.value)} 
                    className="w-full bg-[#0A0A0B] border border-[#222226] text-sm px-4 py-3 rounded-2xl" 
                  />
                )}
                <input type="email" placeholder="Email" value={overlayEmail} onChange={e => setOverlayEmail(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#222226] text-sm px-4 py-3 rounded-2xl" />
                <input type="password" placeholder="Password" value={overlayPassword} onChange={e => setOverlayPassword(e.target.value)} className="w-full bg-[#0A0A0B] border border-[#222226] text-sm px-4 py-3 rounded-2xl" />
                {overlayMode === "signup" && (
                  <input 
                    type="password" 
                    placeholder="Confirm Password" 
                    value={overlayConfirmPassword} 
                    onChange={e => setOverlayConfirmPassword(e.target.value)} 
                    className="w-full bg-[#0A0A0B] border border-[#222226] text-sm px-4 py-3 rounded-2xl" 
                  />
                )}

                {overlayError && <div className="text-rose-400 text-xs font-bold">{overlayError}</div>}
                <button onClick={async () => {
                  if (overlayMode === "signup") {
                    if (!overlayUsername || !overlayEmail || !overlayPassword || !overlayConfirmPassword) {
                      setOverlayError("All fields are required");
                      return;
                    }
                    if (overlayPassword !== overlayConfirmPassword) {
                      setOverlayError("Passwords do not match");
                      return;
                    }
                  } else {
                    if (!overlayEmail || !overlayPassword) {
                      setOverlayError("Email and password required");
                      return;
                    }
                  }
                  try {
                    if (overlayMode === "signup") {
                      await onSignUp(overlayEmail, overlayPassword, overlayUsername);
                    } else {
                      await onLogin(overlayEmail, overlayPassword);
                    }
                    setOverlayMode("login");
                    setOverlayEmail("");
                    setOverlayPassword("");
                    setOverlayUsername("");
                    setOverlayConfirmPassword("");
                    setOverlayError("");
                  } catch (err: any) {
                    const friendlyMessage = getFriendlyError(err, overlayMode);
                    setOverlayError(friendlyMessage);
                  }
                }} className="w-full py-3.5 text-sm font-bold bg-[#10B981] hover:bg-[#10B981]/90 text-black rounded-2xl mt-2">{overlayMode === "signup" ? "Signup" : "LOGIN"}</button>
                {overlayMode === "login" ? (
                  <div className="flex justify-between text-xs pt-1">
                    <button onClick={() => { setOverlayMode("signup"); setOverlayError(""); }} className="text-[#10B981] hover:underline">Not a member? Signup now</button>
                    <button onClick={() => { setOverlayMode("forgot"); setOverlayError(""); }} className="text-[#10B981] hover:underline">Forgot Password?</button>
                  </div>
                ) : (
                  <button onClick={() => { setOverlayMode("login"); setOverlayError(""); }} className="w-full text-xs text-gray-400 hover:text-gray-300 mt-1">Back to Login</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`space-y-6 transition-all ${!isLoggedIn ? "blur-sm pointer-events-none select-none" : ""}`}>

      {/* Lifetime Performance metrics deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${settings.theme === 'dark' ? 'glass-panel text-gray-100' : 'bg-white border-gray-200 text-gray-950 shadow-sm'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
            {language === 'zh' ? '買飛用咗幾多錢' : 'Lifetime Invest'}
          </span>
          <div className="text-2xl font-black font-mono tracking-tight mt-1.5 flex items-baseline gap-1">
            <span className="text-xs text-gray-550 font-bold">HK$</span>
            <span>{lifetimeCost.toLocaleString()}</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${settings.theme === 'dark' ? 'glass-panel text-gray-100' : 'bg-white border-gray-200 text-gray-950 shadow-sm'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
            {language === 'zh' ? '中咗幾多獎金' : 'Total Returns'}
          </span>
          <div className={`text-2xl font-black font-mono tracking-tight mt-1.5 flex items-baseline gap-1 ${lifetimeWinnings > 0 ? 'text-[#10B981]' : ''}`}>
            <span className="text-xs text-gray-550 font-bold">HK$</span>
            <span>{lifetimeWinnings.toLocaleString('en-US', { minimumFractionDigits: 1 })}</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${settings.theme === 'dark' ? 'glass-panel text-gray-100' : 'bg-white border-gray-200 text-gray-950 shadow-sm'}`}>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
            {language === 'zh' ? '賺定蝕 (回報率)' : 'Net ROI'}
          </span>
          <div className={`text-2xl font-black font-mono tracking-tight mt-1.5 flex items-baseline gap-1 ${lifetimeROI > 0 ? 'text-[#10B981]' : lifetimeROI < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
            <span>{lifetimeROI > 0 ? '+' : ''}{lifetimeROI.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%</span>
          </div>
        </div>
      </div>

      {/* Upper action shelf */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-2xl ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#10B981]" />
            <span>{t.vault.title}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">{t.vault.desc}</p>
        </div>
        {!isLoggedIn && (
          <div className="w-full mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Login required to add or save bets. Please sign in above.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-add-manual"
            onClick={() => {
              if (!isLoggedIn) return;
              playSound('click', soundEffects);
              setShowForm(!showForm);
              setShowImporter(false);
            }}
            disabled={!isLoggedIn}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md ${
              !isLoggedIn 
                ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed opacity-60'
                : showForm 
                  ? 'bg-[#10B981] text-black shadow-[#10B981]/15 font-black' 
                  : (settings.theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white border border-white/5' : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-250')
            }`}
          >
            <Plus className={`w-4 h-4 stroke-[3] ${showForm ? 'text-gray-950' : 'text-[#10B981]'}`} />
            <span>{t.vault.addManual}</span>
          </button>

          <button
            id="btn-import-scan"
            onClick={() => {
              playSound('click', soundEffects);
              setShowImporter(!showImporter);
              setShowForm(false);
            }}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md ${
              showImporter 
                ? 'bg-[#10B981] text-black shadow-[#10B981]/15 font-black' 
                : (settings.theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white border border-white/5' : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-250')
            }`}
          >
            <Upload className={`w-4 h-4 stroke-[2.5] ${showImporter ? 'text-gray-950' : 'text-[#10B981]'}`} />
            <span>{language === 'zh' ? '入飛同埋掃描彩票' : 'Import / Scan Tickets'}</span>
          </button>
          
          {userBets.length > 0 && (
            isConfirmingClear ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-500/5 border border-rose-500/20 animated fade-in">
                <span className="text-[11px] font-bold text-rose-400">
                  {language === 'zh' ? '真係要清空晒所有彩票？' : 'Confirm clear?'}
                </span>
                <button
                  type="button"
                  id="btn-clear-vault-confirm-yes"
                  onClick={() => {
                    playSound('reset', soundEffects);
                    onClearAllBets();
                    setIsConfirmingClear(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  {language === 'zh' ? '係，清空' : 'Yes'}
                </button>
                <button
                  type="button"
                  id="btn-clear-vault-confirm-no"
                  onClick={() => {
                    playSound('click', soundEffects);
                    setIsConfirmingClear(false);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer border ${
                    settings.theme === 'dark' 
                      ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10' 
                      : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {language === 'zh' ? '唔好住' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-clear-vault"
                onClick={() => {
                  playSound('click', soundEffects);
                  setIsConfirmingClear(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.vault.clearAll}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Manual placement builder container */}
      {showForm && (
        <div className={`p-6 border rounded-2xl space-y-6 shadow-xl relative ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-md font-bold text-[#10B981] flex items-center gap-2 border-b pb-3 ${settings.theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
            <Calendar className="w-4.5 h-4.5" />
            <span>{t.vault.addManual}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Draw selection date */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-semibold">{t.vault.table.drawDate}</label>
              <select
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-medium text-gray-200 focus:outline-none focus:border-emerald-400"
              >
                <option value={getNextUpcomingDraw().date}>
                  {getNextUpcomingDraw().id} ({getNextUpcomingDraw().date}) — Next Draw
                </option>
                {historicalDraws.map(d => (
                  <option key={d.date} value={d.date}>
                    {d.id} ({d.date})
                  </option>
                ))}
              </select>
            </div>

            {/* Bet Type button group */}
            <div className="lg:col-span-2">
              <label className="text-xs text-gray-400 block mb-1.5 font-semibold">{t.importer.manualBetType}</label>
              <div className="grid grid-cols-3 gap-2">
                {(['single', 'multiple', 'banker'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${betType === type ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400' : 'bg-gray-950 border-gray-850 text-gray-400 hover:border-gray-700'}`}
                  >
                    {t.vault.table[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Partial unit toggler */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5 font-semibold">
                {language === 'zh' ? '每注幾多錢' : 'Play Cost'}
              </label>
              
              {betType === 'single' ? (
                <div className={`flex items-center justify-between px-4 py-2 border rounded-xl text-xs font-bold select-none ${
                  settings.theme === 'dark' 
                    ? 'bg-gray-950/60 border-white/5 text-gray-500' 
                    : 'bg-gray-100 border-gray-200 text-gray-500'
                }`}>
                  <span>{language === 'zh' ? '全注 (預設鎖定)' : 'Full Unit (Locked)'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                    settings.theme === 'dark' ? 'bg-white/5 text-gray-400' : 'bg-gray-200/60 text-gray-600'
                  }`}>
                    $10
                  </span>
                </div>
              ) : (
                <div className={`flex p-1 rounded-xl border select-none ${
                  settings.theme === 'dark' 
                    ? 'border-white/5 bg-gray-950' 
                    : 'border-gray-200 bg-gray-100'
                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click', soundEffects);
                      setIsPartial(false);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      !isPartial 
                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 font-extrabold shadow-sm' 
                        : 'text-gray-400 hover:text-gray-200 bg-transparent border-transparent'
                    }`}
                  >
                    <span>{language === 'zh' ? '全注' : 'Full'}</span>
                    <span className="text-[10px] opacity-85">$10</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click', soundEffects);
                      setIsPartial(true);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                      isPartial 
                        ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400 font-extrabold shadow-sm' 
                        : 'text-gray-400 hover:text-gray-200 bg-transparent border-transparent'
                    }`}
                  >
                    <span>{language === 'zh' ? '半注' : '部份'}</span>
                    <span className="text-[10px] opacity-85">$5</span>
                  </button>
                </div>
              )}
            </div>
          </div>

           <div className="space-y-3 pb-3 border-b border-gray-850">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
               <div className="flex flex-wrap items-center gap-3">
                 <p className="text-xs font-semibold text-gray-400">
                   {language === 'zh' ? '揀心水號碼' : 'Number Selections Matrix'}
                 </p>
                 <div className="flex flex-wrap items-center gap-2">
                   <button
                     type="button"
                     id="btn-quick-pick"
                     onClick={handleQuickPick}
                     className="flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black transition-all cursor-pointer shadow-md shadow-emerald-500/10 hover:scale-[1.03] active:scale-[0.98]"
                     title={language === 'zh' ? '利用大數據分析過去 10 期熱門頻率，為您智能配對號碼' : 'Analyze hot numbers frequency of the last 10 draws and pick smart combinations'}
                   >
                     <Sparkles className="w-3.5 h-3.5 stroke-[2.5] text-black fill-black/10 animate-bounce shrink-0" />
                     <span>{language === 'zh' ? 'AI 幫你揀' : 'AI Smart Pick'}</span>
                   </button>

                   {betType === 'multiple' && (
                     <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                       settings.theme === 'dark' 
                         ? 'bg-gray-950/80 border-white/5 text-gray-300' 
                         : 'bg-gray-100 border-gray-200 text-gray-700 shadow-sm'
                     }`}>
                       <span>{language === 'zh' ? '揀' : 'Pick'}</span>
                       <input
                         type="number"
                         min="7"
                         max="49"
                         value={multipleBallCount}
                         onChange={(e) => {
                           const val = parseInt(e.target.value);
                           if (!isNaN(val)) {
                             setMultipleBallCount(val);
                           } else {
                             setMultipleBallCount(7);
                           }
                         }}
                         onBlur={() => {
                           let val = multipleBallCount;
                           if (isNaN(val) || val < 7) val = 7;
                           else if (val > 49) val = 49;
                           setMultipleBallCount(val);
                         }}
                         className={`w-12 border rounded-lg px-2 py-0.5 text-center text-xs font-black focus:outline-none transition-all ${
                           settings.theme === 'dark'
                             ? 'bg-gray-900 border-gray-805 text-emerald-400 focus:border-emerald-400/50'
                             : 'bg-white border-gray-300 text-emerald-600 focus:border-emerald-500'
                         }`}
                       />
                       <span>{language === 'zh' ? '個字' : 'balls'}</span>
                       <span className="text-[10px] text-gray-500 font-mono">({language === 'zh' ? '最少 7' : 'min 7'})</span>
                     </div>
                   )}
                 </div>
               </div>
               {betType === 'banker' && (
                 <span className="text-[10px] text-yellow-500 font-bold bg-yellow-500/5 px-3 py-1 border border-yellow-500/15 rounded-full">
                   {language === 'zh' ? '撳數字可以分「膽」同「腳」。「膽」最多揀 5 個。' : 'Click number to allocate. Bankers are bounded 1-5.'}
                 </span>
               )}
             </div>

            <div className="flex flex-wrap gap-2 justify-start max-w-full">
              {Array.from({ length: 49 }, (_, i) => i + 1).map(num => {
                const isSelected = selectedNumbers.includes(num);
                const isBanker = bankers.includes(num);
                const isLeg = legs.includes(num);
                
                let btnStyle = 'bg-gray-950 border-gray-850 text-gray-400 hover:border-gray-700';
                if (betType === 'single' || betType === 'multiple') {
                  if (isSelected) btnStyle = 'text-white border-white scale-105 shadow font-black ' + getBallBgColor(num);
                } else {
                  if (isBanker) btnStyle = 'bg-yellow-500 border-yellow-400 text-black scale-105 shadow font-black font-extrabold ring-4 ring-yellow-500/20';
                  else if (isLeg) btnStyle = 'text-white border-white scale-105 shadow font-bold ' + getBallBgColor(num);
                }

                return (
                  <button
                    key={num}
                    onClick={() => toggleNumberSelection(num)}
                    className={`w-9 h-9 md:w-10 md:h-10 text-xs font-bold rounded-full border flex items-center justify-center transition-all cursor-pointer ${btnStyle}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            {/* AI Hot Spot Indicators */}
            {historicalDraws.length > 0 && (
              <div className={`p-3.5 rounded-xl border flex flex-col gap-2 mt-3.5 ${
                settings.theme === 'dark' 
                  ? 'bg-emerald-950/10 border-emerald-500/10' 
                  : 'bg-emerald-50/50 border-emerald-100'
              }`}>
                <div className="flex items-center gap-1.5 animate-pulse">
                  <span className="text-xs">🤖</span>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    settings.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                  }`}>
                    {language === 'zh' ? 'AI 智能數據大師 (過往 10 期最熱號碼)' : 'AI Frequency Analyzer (Top Hot Numbers of past 10 draws)'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {hottestStats.slice(0, 10).map(({ num, count }) => (
                    <div 
                      key={num} 
                      className={`flex items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold transition-all ${
                        settings.theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-gray-150/70 text-gray-700'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${getBallBgColor(num)} inline-block`}></span>
                      <span>#{num}</span>
                      <span className="text-[9px] text-gray-400 font-bold font-mono">({count}x)</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 leading-normal">
                  {language === 'zh'
                    ? '💡 「AI 幫你揀」會直接響過往 10 期最常開出嘅 18 個最熱號碼入面，幫你精準揀出好運組合，中頭獎概率 UP！'
                    : '💡 "Quick Pick" now samples exclusively from the top 18 most frequent/hottest numbers to form strategic combinations.'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Banker allocations controller helper links */}
          {betType === 'banker' && (bankers.length > 0 || legs.length > 0) && (
            <div className="bg-gray-950/55 p-3 rounded-xl border border-gray-850 space-y-2">
              <span className="text-[10px] font-bold text-gray-450 block uppercase">Manual Banker Designation</span>
              <div className="flex flex-wrap gap-3">
                {bankers.map(num => (
                  <div key={num} className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-lg">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-yellow-500 text-black text-[10px] font-bold font-black">{num}</span>
                    <button onClick={() => demoteToLeg(num)} className="text-[10px] font-semibold text-gray-400 hover:text-white uppercase transition-colors">
                      Demote to Leg
                    </button>
                  </div>
                ))}
                {legs.map(num => (
                  <div key={num} className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-2 py-1 rounded-lg">
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-white text-[10px] font-bold ${getBallBgColor(num)}`}>{num}</span>
                    <button onClick={() => promoteToBanker(num)} className="text-[10px] font-semibold text-yellow-500 hover:text-yellow-400 uppercase transition-colors">
                      Set as Banker
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form footer actions & costs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-gray-850 pt-4 gap-4 select-none">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">Total Investment Cost</span>
                <span className="text-lg font-black font-mono text-emerald-400">HK$ {currentCost}</span>
              </div>
            </div>

            {errorText && (
              <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold bg-rose-500/10 px-3.5 py-1.5 rounded-xl border border-rose-500/20">
                <AlertCircle className="w-4 h-4" />
                <span>{errorText}</span>
              </div>
            )}

            <button
              onClick={handleManualAddSubmit}
              className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-900 bg-emerald-400 hover:bg-emerald-300 px-5 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{t.importer.generateBtn}</span>
            </button>
          </div>
        </div>
      )}

      {/* Import & Scan Tickets module container */}
      {showImporter && (
        <div className={`p-6 border rounded-2xl space-y-6 shadow-xl relative ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-md font-bold text-[#10B981] flex items-center gap-2 border-b pb-3 ${settings.theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
            <Upload className="w-4.5 h-4.5 text-[#10B981]" />
            <span>{language === 'zh' ? '一次過入飛同埋截圖對獎' : 'Import & Scan Bets'}</span>
          </h3>
          <BetImporterTab 
            historicalDraws={historicalDraws}
            settings={settings}
            onImportBets={(bets) => {
              onImportBets(bets);
              setShowImporter(false);
            }}
          />
        </div>
      )}

      {/* Bets records log view */}
      {userBets.length === 0 ? (
        <div className={`flex flex-col items-center justify-center p-14 text-center rounded-2xl border ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
          <Trash2 className="w-10 h-10 text-gray-500 mb-3" />
          <h4 className="text-md font-bold">{t.vault.table.noBetsYet}</h4>
          <p className="text-xs text-gray-500 max-w-sm mt-1.5 leading-relaxed">
            {t.vault.table.hintImport}
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase font-bold text-[10px] tracking-wider border-b select-none ${settings.theme === 'dark' ? 'bg-[#111114] text-gray-400 border-white/5' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">{t.vault.table.drawDate}</th>
                  <th className="px-5 py-3">{t.vault.table.type}</th>
                  <th className="px-5 py-3">{t.vault.table.selections}</th>
                  <th className="px-5 py-3">{t.vault.table.unit}</th>
                  <th className="px-5 py-3 text-right">{t.vault.table.cost}</th>
                  <th className="px-5 py-3 text-right">{t.vault.table.options}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${settings.theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                {userBets.map((bet, idx) => {
                  const targetCost = calculateBetCost(bet);
                  return (
                    <tr key={bet.id} className={`transition-all ${settings.theme === 'dark' ? 'hover:bg-white/[0.015]' : 'hover:bg-gray-50/60'}`}>
                      <td className="px-5 py-3.5 text-gray-500 font-mono select-none">{idx + 1}</td>
                      <td className="px-5 py-3.5 font-bold font-mono">
                        {bet.drawDate}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-0.5 font-extrabold rounded uppercase text-[9px] tracking-wide select-none ${settings.theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-650 border border-gray-200/50'}`}>
                          {t.vault.table[bet.type]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {bet.type === 'banker' ? (
                          <div className="flex flex-wrap items-center gap-1 max-w-lg select-none">
                            <span className="text-[10px] text-yellow-500 font-bold mr-1">{t.vault.table.bankerLead}</span>
                            {bet.bankers?.map(v => (
                              <span key={v} className="w-5.5 h-5.5 rounded-full bg-yellow-500 text-black text-[9px] font-black flex items-center justify-center shadow">
                                {v}
                              </span>
                            ))}
                            <span className="text-[10px] text-gray-550 font-bold mx-1">/</span>
                            <span className="text-[10px] text-gray-400 font-bold mr-1">{t.vault.table.legsLead}</span>
                            {bet.legs?.map(v => (
                              <span key={v} className={`w-5.5 h-5.5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shadow ${getBallBgColor(v)}`}>
                                {v}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1 max-w-md select-none">
                            {bet.numbers.map((v, i) => {
                              // If they have massive subset list, truncate
                              if (bet.numbers.length > 18 && i >= 18) {
                                if (i === 18) return <span key={i} className="text-gray-500 text-[10px] ml-1">+{bet.numbers.length - 18}</span>;
                                return null;
                              }
                              return (
                                <span key={v} className={`w-5.5 h-5.5 rounded-full text-[9px] text-white font-bold flex items-center justify-center shadow ${getBallBgColor(v)}`}>
                                  {v}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-semibold ${bet.isPartialUnit ? 'text-orange-400' : 'text-blue-400'}`}>
                          {bet.isPartialUnit ? t.vault.table.partialUnit : t.vault.table.fullUnit}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-200 font-mono">
                        HK$ {targetCost}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => {
                            playSound('reset', soundEffects);
                            onDeleteBet(bet.id);
                          }}
                          className="p-1 px-2 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg text-gray-500 transition-colors cursor-pointer"
                          title="Delete Ticket"
                        >
                          <Trash2 className="w-4 h-4 inline-block" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
