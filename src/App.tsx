/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AppSettings, MarkSixDraw, UserBet } from './types';
import { translations } from './translations';
import { playSound } from './utils/soundEffects';

import LatestDrawTab from './components/LatestDrawTab';
import BetVaultTab from './components/BetVaultTab';
import DrawHistoryTab from './components/DrawHistoryTab';
import SettingsTab from './components/SettingsTab';

import { Activity, Cloud, LogIn, LogOut, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabase';
import { signUp, signIn, signOut, getCurrentUser } from './auth';
import { saveBetToSupabase, loadBetsFromSupabase, deleteBetFromSupabase } from './bets';
import { User } from '@supabase/supabase-js';

// Default initial state settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'zh', // Defualt to zh (繁體中文) per requested scope branding
  defaultUnitCost: 10,
  soundEffects: true,
  liveMode: true // Always use live data
};

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('m6_settings');
    if (saved) {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; } catch { return DEFAULT_SETTINGS; }
    }
    return DEFAULT_SETTINGS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userBets, setUserBets] = useState<UserBet[]>(() => {
    const saved = localStorage.getItem('m6_local_bets');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [historicalDraws, setHistoricalDraws] = useState<MarkSixDraw[]>([]);
  const [latestDraw, setLatestDraw] = useState<MarkSixDraw | null>(null);
  const [activeTab, setActiveTab ] = useState<'latest' | 'vault' | 'history' | 'settings'>('latest');

  // Sync state message toasts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync settings helper
  const handleUpdateSettings = (updated: Partial<AppSettings>) => {
    const next = { ...settings, ...updated };
    setSettings(next);
    localStorage.setItem('m6_settings', JSON.stringify(next));

    // Handle HTML tag class list for manual color backgrounds matching theme
    const root = document.documentElement;
    if (next.theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
  };

  // Set default background style from initialization
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
  }, []);

  // Fetch Draws from Server API Endpoint
  const fetchHistoricalDraws = async (live: boolean) => {
    try {
      const res = await fetch(`/api/draws?live=${live}`);
      if (res.ok) {
        const payload = await res.json();
        if (payload.draws && Array.isArray(payload.draws)) {
          setHistoricalDraws(payload.draws);
          setLatestDraw(payload.draws[0] || null);
          if (payload.source === 'live') {
            showToast(translations[settings.language].latestDraw.checkResults, 'success');
          }
        }
      }
    } catch (err) {
      console.error("Retrieve historical draws fail:", err);
    }
  };

  // Reload on toggle live/simulated mode
  useEffect(() => {
    fetchHistoricalDraws(settings.liveMode);
  }, [settings.liveMode]);

  // Auth Subscription (Supabase)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        showToast(`Logged in as ${user.email}`, 'success');
        // Load bets from Supabase and merge with local
        try {
          const cloudBets = await loadBetsFromSupabase(user.id);
          const localBets: UserBet[] = JSON.parse(localStorage.getItem('m6_local_bets') || '[]');
          const merged = [...cloudBets];
          const cloudIds = new Set(cloudBets.map(b => b.id));
          for (const localBet of localBets) {
            if (!cloudIds.has(localBet.id)) {
              merged.push(localBet);
            }
          }
          setUserBets(merged);
          localStorage.setItem('m6_local_bets', JSON.stringify(merged));
        } catch (err) {
          console.error("Failed to load bets from Supabase:", err);
        }
      } else {
        const savedLocal = localStorage.getItem('m6_local_bets');
        if (savedLocal) {
          try { setUserBets(JSON.parse(savedLocal)); } catch { setUserBets([]); }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync and retrieve from Cloud
  const syncBetsFromCloud = async (userId: string) => {
    if (!db) return;
    const path = `users/${userId}/bets`;
    try {
      const colRef = collection(db, 'users', userId, 'bets');
      const querySnapshot = await getDocs(colRef);
      const betsList: UserBet[] = [];
      querySnapshot.forEach((doc) => {
        // @ts-ignore
        betsList.push({ id: doc.id, ...doc.data() });
      });
      setUserBets(betsList);
      localStorage.setItem('m6_local_bets', JSON.stringify(betsList));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  // Write single bet to persistent storage (local & cloud)
    // Write single bet (local only for now)
  const handleAddBet = async (betInput) => {
    playSound("win", settings.soundEffects);
    const newBet = {
      ...betInput,
      id: Math.random().toString(36).substring(2, 11),
      importDate: new Date().toISOString()
    };
    const nextBets = [newBet, ...userBets];
    setUserBets(nextBets);
    localStorage.setItem("m6_local_bets", JSON.stringify(nextBets));
    showToast(translations[settings.language].importer.toastImportSuccess.replace("${count}", "1"), "success");
  };

  // Bulk Import (local only)
  const handleImportBets = async (betsInput) => {
    playSound("win", settings.soundEffects);
    const newBets = betsInput.map(b => ({
      ...b,
      id: Math.random().toString(36).substring(2, 11),
      importDate: new Date().toISOString()
    }));
    const nextBets = [...newBets, ...userBets];
    setUserBets(nextBets);
    localStorage.setItem("m6_local_bets", JSON.stringify(nextBets));
    showToast(translations[settings.language].importer.toastImportSuccess.replace("${count}", String(newBets.length)), "success");
  };

  // Delete Bet
  const handleDeleteBet = async (betId: string) => {
    const nextBets = userBets.filter(b => b.id !== betId);
    setUserBets(nextBets);
    localStorage.setItem("m6_local_bets", JSON.stringify(nextBets));

    if (currentUser) {
      try {
        await deleteBetFromSupabase(betId);
      } catch (err) {
        console.error("Failed to delete bet from Supabase:", err);
      }
    }
    showToast(translations[settings.language].vault.toastDeleted, "success");
  };

  // Clear All Bets
  const handleClearAllBets = async () => {
    if (currentUser) {
      for (const bet of userBets) {
        try {
          await deleteBetFromSupabase(bet.id);
        } catch (err) {
          console.error("Failed to delete bet from Supabase:", err);
        }
      }
    }
    setUserBets([]);
    localStorage.removeItem("m6_local_bets");
    showToast(translations[settings.language].vault.toastCleared, "success");
  };

  // Export local backup file
  const handleExportBackup = () => {
    playSound('click', settings.soundEffects);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userBets));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `m6_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    showToast("Exported JSON backup file", 'success');
  };

  // Restore backup
  const handleImportBackup = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const json = JSON.parse(e.target.result);
        if (Array.isArray(json)) {
          // Format backup and push
          await handleImportBets(json);
          showToast("Successfully restored data backup!", 'success');
        } else {
          showToast("Format mismatch of json backup file", 'error');
        }
      } catch (err) {
        showToast("Restore failed: parse error.", 'error');
      }
    };
    reader.readAsText(file);
  };

  // System full factory reset
  
  const handleSimulateNextDraw = async () => {
    const res = await fetch("/api/draws/generate", { method: "POST" });
    if (res.ok) {
      await fetchHistoricalDraws(false);
      showToast("Draw simulated successfully!", "success");
    }
  };

  const handleFullWipeReset = async () => {
    // Clear back-end simulated rolls
    await fetch('/api/reset', { method: 'POST' });
    // Local storage wipe
    localStorage.removeItem('m6_local_bets');
    setUserBets([]);
    // Reload
    await fetchHistoricalDraws(settings.liveMode);
  };

  const currentLanguage = translations[settings.language];

  return (
    <div className={`min-h-screen transition-all duration-300 ${settings.theme === 'dark' ? 'bg-[#0A0A0B] text-[#E2E2E2]' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* Top Header Bar */}
        <header className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 ${settings.theme === 'dark' ? 'border-[#222226]' : 'border-gray-250 pb-6'}`}>
          <div className="flex items-center space-x-4 select-none">
            <div className="w-10 h-10 bg-[#10B981] rounded-lg flex items-center justify-center font-bold text-black text-lg">
              6
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight uppercase tracking-wider">
                <span>{currentLanguage.title}</span>
                <span className="text-[10px] bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded ml-2 font-bold tracking-wider uppercase border border-[#10B981]/25">PRO v1.2</span>
              </h1>
              <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">六合彩追踪器 • BILINGUAL EDITION</p>
            </div>
          </div>

                    {/* User Auth Cloud Connection Status top deck */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold ${settings.theme === "dark" ? "bg-[#111114] border border-[#222226] text-gray-400" : "bg-white border-gray-300 text-gray-600"}`}>
              <Cloud className="w-4 h-4 shrink-0" />
              <span>Local + Cloud</span>
            </div>

            {currentUser ? (
              <div className={`flex items-center space-x-2 p-1 border rounded-xl ${settings.theme === "dark" ? "bg-[#111114]/80 border-[#222226]" : "bg-white border-gray-300"}`}>
                <span className="text-[11px] font-bold px-2.5 text-gray-400">
                  {currentUser.email?.split("@")[0]}
                </span>
                <button
                  onClick={async () => {
                    playSound("reset", settings.soundEffects);
                    await signOut();
                    setCurrentUser(null);
                  }}
                  className="p-1.5 bg-black/20 hover:bg-rose-500/10 text-rose-400 rounded-lg cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#111114] border border-[#222226] text-sm px-3 py-1.5 rounded-xl w-40"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#111114] border border-[#222226] text-sm px-3 py-1.5 rounded-xl w-32"
                />
                <button
                  onClick={async () => {
                    if (!email || !password) return;
                    try {
                      await signIn(email, password);
                      const user = await getCurrentUser();
                      setCurrentUser(user);
                      showToast("Logged in", "success");
                    } catch (err) {
                      showToast("Login failed", "error");
                    }
                  }}
                  className="flex items-center space-x-1.5 text-xs font-bold text-black bg-[#10B981] hover:bg-[#10B981]/80 px-4 py-2 rounded-xl transition-colors cursor-pointer uppercase"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </button>
                <button
                  onClick={async () => {
                    if (!email || !password) return;
                    try {
                      await signUp(email, password);
                      showToast("Check email to confirm", "success");
                    } catch (err) {
                      showToast("Sign up failed", "error");
                    }
                  }}
                  className="flex items-center space-x-1.5 text-xs font-bold text-white bg-[#374151] hover:bg-[#4b5563] px-4 py-2 rounded-xl transition-colors cursor-pointer uppercase"
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Tab Navigation Menu pills */}
        <nav className={`flex flex-wrap p-1 border rounded-2xl max-w-fit select-none ${settings.theme === 'dark' ? 'bg-[#111114] border-[#222226]' : 'bg-gray-200/50 border-gray-300'}`}>
          {(['latest', 'vault', 'history', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => {
                playSound('click', settings.soundEffects);
                setActiveTab(tab);
              }}
              className={`px-4.5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'bg-[#10B981] text-black shadow-md shadow-[#10B981]/10 font-extrabold' 
                  : `${settings.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
              }`}
            >
              {currentLanguage.tabs[tab]}
            </button>
          ))}
        </nav>

        {/* Dynamic Display Panels */}
        <main className="pb-12">
          {activeTab === 'latest' && (
            <LatestDrawTab
              latestDraw={latestDraw}
              userBets={userBets}
              settings={settings}
            />
          )}

          {activeTab === 'vault' && (
            <BetVaultTab
              userBets={userBets}
              historicalDraws={historicalDraws}
              settings={settings}
              currentUser={currentUser}
              onAddBet={handleAddBet}
              onDeleteBet={handleDeleteBet}
              onClearAllBets={handleClearAllBets}
              onImportBets={handleImportBets}
            />
          )}

          {activeTab === 'history' && (
            <DrawHistoryTab
              historicalDraws={historicalDraws}
              userBets={userBets}
              settings={settings}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              userBets={userBets}
              historicalDraws={historicalDraws}
              onUpdateSettings={handleUpdateSettings}
              onSimulateNextDraw={handleSimulateNextDraw}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onFullReset={handleFullWipeReset}
            />
          )}
        </main>


      </div>

      {/* Floating System Sync Toast Alerts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 p-4 rounded-2xl shadow-xl flex items-center space-x-3 z-50 border max-w-sm select-none ${toastMessage.type === 'success' ? 'bg-[#18231c] border-emerald-500/30 text-emerald-400' : toastMessage.type === 'error' ? 'bg-[#2a1b1b] border-rose-500/30 text-rose-450' : 'bg-[#121c24] border-blue-500/35 text-blue-400'}`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />
            )}
            <p className="text-xs font-bold leading-normal">{toastMessage.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}

export default App;
