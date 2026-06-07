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

import { Activity, Cloud, LogIn, LogOut, CheckCircle2, AlertCircle, RefreshCw, User, Moon, Sun, Languages, Volume2, VolumeX, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabase';
import { signUp, signIn, signOut, getCurrentUser } from './auth';
import { saveBetToSupabase, loadBetsFromSupabase, deleteBetFromSupabase } from './bets';

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
  const [activeTab, setActiveTab ] = useState<'latest' | 'vault' | 'history'>('latest');
  const [showAccountModal, setShowAccountModal] = useState(false);

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

  const handleThemeToggle = () => {
    playSound('click', settings.soundEffects);
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    handleUpdateSettings({ theme: nextTheme });
  };

  const handleLanguageToggle = () => {
    playSound('click', settings.soundEffects);
    const nextLang = settings.language === 'en' ? 'zh' : 'en';
    handleUpdateSettings({ language: nextLang });
  };

  const handleSoundToggle = (val: boolean) => {
    handleUpdateSettings({ soundEffects: val });
    playSound('click', val);
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
      const res = await fetch("/scraped_draws.json");
      const data = await res.json();

      if (data && data.length > 0) {
        const mappedDraws = data.map((draw: any) => ({
          ...draw,
          extraNumber: draw.extra ?? draw.extraNumber,
          nextDrawDate: draw.nextDrawDate,
          nextJackpot: draw.nextJackpot,
          nextDeadline: draw.nextDeadline,
        }));

        setHistoricalDraws(mappedDraws);
        setLatestDraw(mappedDraws[0]);
        showToast(translations[settings.language].latestDraw.checkResults, "success");
      } else {
        setHistoricalDraws([]);
        setLatestDraw(null);
      }
    } catch (err) {
      console.error("Failed to load draws:", err);
    }
  };
  try {
    const { data, error } = await supabase
      .from("draws")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    if (data && data.length > 0) {
      // Map Supabase snake_case fields to camelCase expected by frontend
      const mapped = data.map((d: any) => ({
        ...d,
        extraNumber: d.extra_number,
        nextDrawDate: d.next_draw_date,
        nextJackpot: d.next_jackpot,
        nextDeadline: d.next_deadline,
      }));

      setHistoricalDraws(mapped);
      setLatestDraw(mapped[0]);
      showToast(translations[settings.language].latestDraw.checkResults, "success");
    } else {
      setHistoricalDraws([]);
      setLatestDraw(null);
    }
  } catch (err) {
    console.error("Retrieve historical draws fail:", err);
  }
};

  // Reload on toggle live/simulated mode
  useEffect(() => {
    fetchHistoricalDraws(settings.liveMode);
  }, [settings.liveMode]);

  // Auth Subscription (Supabase) - Clean version
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (user) {
        showToast(`Logged in as ${user.email}`, 'success');
        try {
          const cloudBets = await loadBetsFromSupabase(user.id);
          setUserBets(cloudBets);
          localStorage.setItem('m6_local_bets', JSON.stringify(cloudBets));
        } catch (err) {
          console.error("Failed to load bets from Supabase:", err);
          setUserBets([]);
        }
      } else {
        // Logged out → clear bets
        setUserBets([]);
        localStorage.removeItem('m6_local_bets');
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
    if (!currentUser) {
      showToast("Please log in to save bets", "error");
      return;
    }

    playSound("win", settings.soundEffects);

    const newBet = {
      ...betInput,
      id: Math.random().toString(36).substring(2, 11),
      importDate: new Date().toISOString()
    };

    try {
      await saveBetToSupabase(newBet, currentUser.id);
      const nextBets = [newBet, ...userBets];
      setUserBets(nextBets);
      localStorage.setItem("m6_local_bets", JSON.stringify(nextBets));
      showToast(translations[settings.language].importer.toastImportSuccess.replace("${count}", "1"), "success");
    } catch (err: any) {
      console.error("Failed to save bet to Supabase:", err);
      showToast(err?.message || "Failed to save bet", "error");
    }
  };

  // Bulk Import (Supabase)
  const handleImportBets = async (betsInput) => {
    if (!currentUser) {
      showToast("Please log in to import bets", "error");
      return;
    }

    playSound("win", settings.soundEffects);

    const newBets = betsInput.map(b => ({
      ...b,
      id: Math.random().toString(36).substring(2, 11),
      importDate: new Date().toISOString()
    }));

    try {
      for (const bet of newBets) {
        await saveBetToSupabase(bet, currentUser.id);
      }
      const nextBets = [...newBets, ...userBets];
      setUserBets(nextBets);
      localStorage.setItem("m6_local_bets", JSON.stringify(nextBets));
      showToast(translations[settings.language].importer.toastImportSuccess.replace("${count}", String(newBets.length)), "success");
    } catch (err: any) {
      console.error("Failed to import bets to Supabase:", err);
      showToast(err?.message || "Failed to import some bets", "error");
    }
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
        <header className={`flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 border-b pb-4 md:pb-6 ${settings.theme === 'dark' ? 'border-[#222226]' : 'border-gray-250 pb-6'}`}>
          {/* Left: Logo + Title */}
          <div className="flex items-center space-x-4 select-none">
            <img src="/logo.png" alt="Mark Six Hunter Logo" className="w-12 h-12 rounded-xl object-contain" />
            <div>
              <h1 className="text-xl font-bold leading-tight uppercase tracking-wider">
                <span>{currentLanguage.title}</span>
                <span className="text-xs bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded ml-2 font-bold tracking-wider uppercase border border-[#10B981]/25">BETA</span>
              </h1>
              <p className="text-xs text-gray-500 font-semibold tracking-wider">{settings.language === 'en' ? 'Your Mark Six Tracking Companion' : '你的六合彩追蹤拍檔'}</p>
            </div>
          </div>

          {/* Center: Tab Navigation (centered on desktop) */}
          <nav className={`flex flex-wrap p-1 border rounded-2xl max-w-fit select-none mx-auto md:mx-0 order-last md:order-none ${settings.theme === 'dark' ? 'bg-[#111114] border-[#222226]' : 'bg-gray-200/50 border-gray-300'}`}>
            {(['latest', 'history', 'vault'] as const).map((tab) => (
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

          {/* Right: Toggles + User Profile */}
          <div className="flex items-center gap-3">
            {/* Header Quick Toggles */}
            <div className="flex items-center gap-1 mr-1">
              {/* Theme Toggle */}
              <button
                onClick={handleThemeToggle}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${settings.theme === 'dark' ? 'border-white/5 bg-black/40 text-gray-450 hover:text-[#10B981]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:text-[#10B981]'}`}
                title="Toggle theme"
              >
                {settings.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              {/* Language Toggle */}
              <button
                onClick={handleLanguageToggle}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                title="Toggle language"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{settings.language === 'en' ? '中' : 'EN'}</span>
              </button>

              {/* Sound Toggle */}
              <button
                onClick={() => handleSoundToggle(!settings.soundEffects)}
                className="p-2 rounded-xl border border-gray-850 bg-gray-950/40 text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer"
                title="Toggle sound effects"
              >
                {settings.soundEffects ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>

            {/* User Profile Card (clickable) */}
            <div
              onClick={() => currentUser && setShowAccountModal(true)}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl border text-sm transition-all ${currentUser ? 'cursor-pointer hover:border-[#10B981]/40 hover:shadow-sm' : ''} ${settings.theme === 'dark' ? 'bg-[#111114] border-[#222226]' : 'bg-white border-gray-200'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${currentUser ? 'ring-2 ring-[#10B981]/30' : 'grayscale opacity-60'}`}>
                {currentUser ? (
                  <div className="w-full h-full bg-[#10B981] flex items-center justify-center text-black text-xs font-bold">
                    {currentUser.user_metadata?.username?.[0]?.toUpperCase() || currentUser.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                ) : (
                  <User className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="flex flex-col leading-tight">
                <span className={`text-xs font-bold ${currentUser ? 'text-[#E2E2E2]' : 'text-gray-400'}`}>
                  {currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0] || 'Guest'}
                </span>
                {!currentUser && (
                  <span className="text-xs text-gray-500">Not signed in</span>
                )}
              </div>
              {currentUser && (
                <button
                  onClick={async () => {
                    playSound("reset", settings.soundEffects);
                    await signOut();
                    setCurrentUser(null);
                  }}
                  className="ml-1 p-1.5 hover:bg-rose-500/10 text-rose-400 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </header>

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
              onLogin={async (email, password) => {
                await signIn(email, password);
                const user = await getCurrentUser();
                setCurrentUser(user);
                showToast("Logged in", "success");
              }}
              onSignUp={async (email, password, username) => {
                await signUp(email, password, username);
                showToast("Check email to confirm", "success");
              }}
            />
          )}

          {activeTab === 'history' && (
            <DrawHistoryTab
              historicalDraws={historicalDraws}
              userBets={userBets}
              settings={settings}
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

      {/* Account Settings Modal */}
      <AnimatePresence>
        {showAccountModal && currentUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.2 }}
              className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${settings.theme === 'dark' ? 'bg-[#111114] border-[#222226]' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-bold">Account Settings</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Manage your profile and security</p>
                </div>
                <button onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-gray-800/60 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Info */}
              <div className={`flex items-center gap-3 p-3 rounded-2xl mb-6 ${settings.theme === 'dark' ? 'bg-[#1a1a1d]' : 'bg-gray-50'}`}>
                <div className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center text-black font-bold">
                  {currentUser.user_metadata?.username?.[0]?.toUpperCase() || currentUser.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="font-bold">{currentUser.user_metadata?.username || currentUser.email?.split('@')[0]}</div>
                  <div className="text-xs text-gray-500">{currentUser.email}</div>
                </div>
              </div>

              {/* Change Username */}
              <div className="mb-5">
                <label className="text-xs font-bold text-gray-400 block mb-1.5">Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={currentUser.user_metadata?.username || ''}
                    id="account-username"
                    className={`flex-1 rounded-xl px-3 py-2 text-sm border focus:outline-none focus:border-[#10B981] ${settings.theme === 'dark' ? 'bg-[#1a1a1d] border-[#222226]' : 'bg-white border-gray-200'}`}
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById('account-username') as HTMLInputElement;
                      if (input?.value) {
                        await handleUpdateUsername(input.value);
                        setShowAccountModal(false);
                      }
                    }}
                    className="px-4 py-2 bg-[#10B981] text-black text-xs font-bold rounded-xl hover:bg-[#0ea46f]"
                  >
                    Update
                  </button>
                </div>
              </div>

              {/* Change Password */}
              <div className="mb-6">
                <label className="text-xs font-bold text-gray-400 block mb-1.5">Change Password</label>
                <div className="space-y-2">
                  <input type="password" id="account-current-pw" placeholder="Current password" className={`w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:border-[#10B981] ${settings.theme === 'dark' ? 'bg-[#1a1a1d] border-[#222226]' : 'bg-white border-gray-200'}`} />
                  <input type="password" id="account-new-pw" placeholder="New password" className={`w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:border-[#10B981] ${settings.theme === 'dark' ? 'bg-[#1a1a1d] border-[#222226]' : 'bg-white border-gray-200'}`} />
                  <button
                    onClick={async () => {
                      const current = (document.getElementById('account-current-pw') as HTMLInputElement)?.value;
                      const newPw = (document.getElementById('account-new-pw') as HTMLInputElement)?.value;
                      if (current && newPw) {
                        await handleUpdatePassword(current, newPw);
                        setShowAccountModal(false);
                      }
                    }}
                    className="w-full py-2 bg-[#10B981] text-black text-xs font-bold rounded-xl hover:bg-[#0ea46f]"
                  >
                    Update Password
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4 border-t border-[#222226]">
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to sign out?')) {
                      await signOut();
                      setCurrentUser(null);
                      setShowAccountModal(false);
                    }
                  }}
                  className="w-full py-2.5 text-sm font-bold rounded-xl border border-[#222226] hover:bg-[#1a1a1d]"
                >
                  Sign Out
                </button>
                <button
                  onClick={async () => {
                    const pw = prompt('Enter your password to permanently delete your account:');
                    if (pw) {
                      await handleDeleteAccount(pw);
                      setShowAccountModal(false);
                    }
                  }}
                  className="w-full py-2.5 text-sm font-bold text-rose-400 hover:text-rose-300 rounded-xl border border-rose-500/30 hover:bg-rose-500/10"
                >
                  Delete Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </AnimatePresence>
    </div>

  );
}

export default App;
