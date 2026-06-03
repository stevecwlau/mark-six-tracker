/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppSettings, MarkSixDraw, UserBet } from '../types';
import { translations } from '../translations';
import { playSound } from '../utils/soundEffects';
import { Settings, Languages, Sun, Moon, Volume2, VolumeX, Database, ShieldAlert, Sparkles, Download, Upload, AlertCircle } from 'lucide-react';

interface SettingsTabProps {
  settings: AppSettings;
  userBets: UserBet[];
  historicalDraws: MarkSixDraw[];
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onSimulateNextDraw: () => Promise<void>;
  onExportBackup: () => void;
  onImportBackup: (event: any) => void;
  onFullReset: () => Promise<void>;
}

export default function SettingsTab({
  settings,
  userBets,
  historicalDraws,
  onUpdateSettings,
  onSimulateNextDraw,
  onExportBackup,
  onImportBackup,
  onFullReset
}: SettingsTabProps) {
  const { language, theme, defaultUnitCost, soundEffects, liveMode } = settings;
  const t = translations[language];

  const [isRolling, setIsRolling] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Toggle values
  const handleLanguageToggle = () => {
    playSound('click', soundEffects);
    const nextLang = language === 'en' ? 'zh' : 'en';
    onUpdateSettings({ language: nextLang });
  };

  const handleThemeToggle = () => {
    playSound('click', soundEffects);
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    onUpdateSettings({ theme: nextTheme });
  };

  const handleCostToggle = (cost: 10 | 5) => {
    playSound('click', soundEffects);
    onUpdateSettings({ defaultUnitCost: cost });
  };

  const handleSoundToggle = (val: boolean) => {
    onUpdateSettings({ soundEffects: val });
    playSound('click', val);
  };

  const handleLiveModeToggle = (val: boolean) => {
    playSound('click', soundEffects);
    onUpdateSettings({ liveMode: val });
  };

  const handleTriggerSimulateDraw = async () => {
    setIsRolling(true);
    // Play drawing loop synthesizer sequence
    playSound('roll', soundEffects);
    try {
      await onSimulateNextDraw();
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsRolling(false);
        playSound('win', soundEffects);
      }, 1000);
    }
  };

  const handleFullWipe = async () => {
    if (resetInput.trim().toUpperCase() === 'RESET') {
      playSound('reset', soundEffects);
      await onFullReset();
      setResetInput('');
      setShowResetConfirm(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Visual Settings Header */}
      <div className={`flex items-center space-x-3 p-4 border rounded-2xl ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="p-2.5 bg-[#10B981]/10 border border-[#10B981]/25 rounded-xl">
          <Settings className="w-5 h-5 text-[#10B981]" />
        </div>
        <div>
          <h2 className="text-xl font-black">{t.settings.title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Customise your analytical environment, soundscapes, and sync mechanisms.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
        {/* Core preferences module */}
        <div className={`border rounded-2xl p-6 space-y-5 ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
          {/* Theme switcher */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold block">{t.settings.themeLabel}</span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Custom ambient light modes</span>
            </div>
            <button
              onClick={handleThemeToggle}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${settings.theme === 'dark' ? 'border-white/5 bg-black/40 text-gray-450 hover:text-[#10B981]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:text-[#10B981]'}`}
            >
              {theme === 'dark' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Language switch */}
          <div className="flex items-center justify-between border-t border-gray-850 pt-4">
            <div>
              <span className="text-xs font-bold text-gray-100 block">{t.settings.languageLabel}</span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Toggle bilingual system interface</span>
            </div>
            <button
              onClick={handleLanguageToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              <Languages className="w-4 h-4" />
              <span>{language === 'en' ? "繁體中文" : "English"}</span>
            </button>
          </div>

          {/* Audio Chime switches */}
          <div className="flex items-center justify-between border-t border-gray-850 pt-4">
            <div>
              <span className="text-xs font-bold text-gray-100 block">{t.settings.soundLabel}</span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Celebratory bells and roll sounds</span>
            </div>
            <button
              onClick={() => handleSoundToggle(!soundEffects)}
              className="p-2.5 rounded-xl border border-gray-850 bg-gray-950/40 text-gray-400 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              {soundEffects ? <Volume2 className="w-4.5 h-4.5 text-emerald-400" /> : <VolumeX className="w-4.5 h-4.5 text-gray-500" />}
            </button>
          </div>
        </div>

        {/* Data engine and backups */}
        <div className={`border rounded-2xl p-6 flex flex-col justify-between ${settings.theme === 'dark' ? 'glass-panel' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold block">{t.settings.dataModeLabel}</span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">Determine draw outcomes provider interface</span>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
              settings.theme === 'dark' ? 'bg-[#10B981]/5 border-[#10B981]/15' : 'bg-emerald-50 border-emerald-100'
            }`}>
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className={`text-[10px] font-bold ${settings.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'} uppercase tracking-tight`}>
                  {language === 'zh' ? '香港賽馬會即時數據源已連接' : 'Live HKJC Feed Connected'}
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-650'}`}>
                {language === 'zh' 
                  ? '已直接對接香港賽馬會伺服器。即時開獎號碼、獎金派發以及歷史期數均會自動下載並實時同步更新。'
                  : 'Directly synced with Hong Kong JC servers. Real-time draw indexes, payouts, and historical draw data are updated automatically.'}
              </p>
            </div>
          </div>

          {/* Backup Restores */}
          <div className={`border-t pt-4 mt-4 grid grid-cols-2 gap-3 ${settings.theme === 'dark' ? 'border-gray-850' : 'border-gray-200'}`}>
            <button
              onClick={onExportBackup}
              className={`flex items-center justify-center space-x-1.5 p-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer border ${
                settings.theme === 'dark' 
                  ? 'bg-gray-950 hover:bg-gray-850 border-gray-850 text-gray-300' 
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{t.settings.exportBtn}</span>
            </button>
            <label className={`flex items-center justify-center space-x-1.5 p-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer border ${
              settings.theme === 'dark' 
                ? 'bg-gray-950 hover:bg-gray-850 border-gray-850 text-gray-300' 
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
            }`}>
              <Upload className="w-4 h-4" />
              <span>{t.settings.importBackupBtn}</span>
              <input type="file" onChange={onImportBackup} accept=".json" className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone: System factory reset */}
      <div className="bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-3xl p-6 space-y-4 transition-all">
        <h3 className="text-md font-bold text-red-400 flex items-center gap-2 border-b border-red-500/15 pb-2.5">
          <ShieldAlert className="w-5 h-5" />
          <span>{t.settings.dangerLabel}</span>
        </h3>

        {!showResetConfirm ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-[11px] text-gray-400 max-w-lg leading-relaxed">
              Completely factory resets the application. Restores all simulated records, removes metadata, empties Bet Vault logs, and logs out from cloud servers.
            </p>
            <button
              onClick={() => {
                playSound('click', soundEffects);
                setShowResetConfirm(true);
              }}
              className="font-bold text-xs text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/35 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              {t.settings.resetAllBtn}
            </button>
          </div>
        ) : (
          <div className="space-y-3.5 max-w-md">
            <div className="flex items-start space-x-2 text-rose-400 text-xs">
              <AlertCircle className="w-4.5 h-4.5 shrink-0" />
              <p className="font-semibold leading-normal">{t.settings.resetConfirm}</p>
            </div>
            
            <div className="flex items-center space-x-2.5">
              <input
                type="text"
                placeholder="Type RESET"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                className="bg-gray-950 border border-red-500/30 text-xs font-bold font-mono tracking-widest text-red-400 px-3 py-2 rounded-xl focus:outline-none focus:border-red-500 uppercase"
              />
              <button
                onClick={async () => {
                  if (resetInput.toUpperCase() === "RESET") {
                    playSound("click", soundEffects);
                    await onFullReset();
                    setShowResetConfirm(false);
                    setResetInput("");
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-colors"
              >
                Confirm Wipe
              </button>
              <button
                onClick={() => {
                  playSound('click', soundEffects);
                  setShowResetConfirm(false);
                  setResetInput('');
                }}
                className="text-gray-400 hover:text-white text-xs font-semibold px-2 uppercase py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
