/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, DragEvent } from 'react';
import { UserBet, MarkSixDraw, AppSettings } from '../types';
import { translations } from '../translations';
import { playSound } from '../utils/soundEffects';
import { Upload, FileCode, CheckCircle, RefreshCw, X, HelpCircle, FileCheck, CircleSlash, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface BetImporterTabProps {
  historicalDraws: MarkSixDraw[];
  settings: AppSettings;
  onImportBets: (bets: Omit<UserBet, 'id' | 'importDate'>[]) => void;
}

export default function BetImporterTab({ historicalDraws, settings, onImportBets }: BetImporterTabProps) {
  const { language, soundEffects } = settings;
  const t = translations[language];

  // File states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-import buffer list
  const [proposedBets, setProposedBets] = useState<any[]>([]);

  // Drag and drop events
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFileInput(files[0]);
    }
  };

  // Click file selector
  const handleFileChange = (e: any) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFileInput(files[0]);
    }
  };

  // Central processor routing file types
  const processFileInput = (file: File) => {
    setErrorMessage('');
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      parseCSV(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      parseExcel(file);
    } else if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
      performOCR(file);
    } else {
      playSound('error', soundEffects);
      setErrorMessage(t.importer.invalidType);
    }
  };

  // 1. CSV Parser
  const parseCSV = (file: File) => {
    setIsProcessing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed: any[] = [];
          results.data.forEach((row: any) => {
            const betObj = evaluateRawRow(row, 'csv');
            if (betObj) parsed.push(betObj);
          });
          
          if (parsed.length > 0) {
            setProposedBets(parsed);
            playSound('win', soundEffects);
          } else {
            setErrorMessage("Could not resolve any valid lottery placements from CSV file.");
          }
        } catch (err) {
          setErrorMessage("Failed processing CSV content format.");
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // 2. Excel Parser
  const parseExcel = async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      const parsed: any[] = [];
      rawRows.forEach((row) => {
        const betObj = evaluateRawRow(row, 'excel');
        if (betObj) parsed.push(betObj);
      });

      if (parsed.length > 0) {
        setProposedBets(parsed);
        playSound('win', soundEffects);
      } else {
        setErrorMessage("Could not resolve any valid lottery placements from Excel Sheet.");
      }
    } catch (err) {
      setErrorMessage("Error parsing Excel Workbook.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert raw row from CSV/Excel into a clean bet proposed object
  const evaluateRawRow = (row: any, source: 'csv' | 'excel'): any | null => {
    // Normalise headers: supporting lowercase and space variations
    const getVal = (keys: string[]): string => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(x => x.trim().toLowerCase() === k.toLowerCase());
        if (foundKey) return String(row[foundKey]).trim();
      }
      return '';
    };

    const drawDate = getVal(['drawDate', 'date', '期日期', '日期']);
    const typeStr = getVal(['type', 'betType', '類型', '型式']).toLowerCase();
    const numbersRaw = getVal(['numbers', 'selections', '選號', '號碼']);
    const bankersRaw = getVal(['bankers', 'banker', '膽']);
    const legsRaw = getVal(['legs', 'leg', '腳']);
    const isPartialRaw = getVal(['isPartial', 'isPartialUnit', 'partial', '五元', '部分注']);

    // Date validator
    if (!drawDate || drawDate.length < 8) return null;

    const isPartialUnit = isPartialRaw.toLowerCase() === 'true' || isPartialRaw === '1' || isPartialRaw.includes('5') || isPartialRaw.includes('五');

    // Parse array numbers
    const parseNumStr = (str: string): number[] => {
      if (!str) return [];
      return str.split(/[\s,;|]+/).map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 49).sort((a,b)=>a-b);
    };

    let numbers = parseNumStr(numbersRaw);
    let bankers = parseNumStr(bankersRaw);
    let legs = parseNumStr(legsRaw);

    let type: 'single' | 'multiple' | 'banker' = 'single';
    if (typeStr.includes('multi') || typeStr.includes('複') || typeStr.includes('复')) {
      type = 'multiple';
    } else if (typeStr.includes('bank') || typeStr.includes('膽') || typeStr.includes('瞻') || typeStr.includes('拖')) {
      type = 'banker';
    } else {
      if (numbers.length > 6) {
        type = 'multiple';
      }
    }

    if (type === 'banker') {
      if (bankers.length === 0) {
        // Fallback: If numbers was provided instead of explicit bankers/legs, splits first 2 as bankers
        bankers = numbers.slice(0, 2);
        legs = numbers.slice(2);
      }
      if (bankers.length < 1 || legs.length < 1) return null;
    } else {
      if (numbers.length < 6) return null;
    }

    return {
      drawDate,
      type,
      numbers,
      bankers: type === 'banker' ? bankers : undefined,
      legs: type === 'banker' ? legs : undefined,
      isPartialUnit,
      source
    };
  };

  // 3. Gemini Vision OCR uploader calling backend
  const performOCR = async (file: File) => {
    setIsProcessing(true);
    try {
      const base64 = await toBase64(file);
      
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Server processing failed.");
      }

      const ocrResult = await res.json();
      if (ocrResult && Array.isArray(ocrResult.bets)) {
        // Format bets from OCR output payload
        const mappedBets = ocrResult.bets.map((b: any) => ({
          drawDate: ocrResult.drawDate || "2026-05-30",
          type: b.type || 'single',
          numbers: b.numbers || [],
          bankers: b.bankers || undefined,
          legs: b.legs || undefined,
          isPartialUnit: false, // Default to standard full unit
          source: 'ocr'
        }));
        
        setProposedBets(mappedBets);
        playSound('win', soundEffects);
      } else {
        throw new Error("Gemini OCR did not return any structured bet arrays.");
      }
    } catch (err: any) {
      playSound('error', soundEffects);
      setErrorMessage(err.message || "Unable to OCR scan image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Helper Quick Pick generator
  const triggerQuickPick = () => {
    playSound('click', soundEffects);
    const drawDateDefault = historicalDraws[0]?.date || "2026-05-30";
    const pickerType = Math.random() > 0.4 ? 'single' : 'multiple';

    if (pickerType === 'single') {
      const subset: number[] = [];
      const allNums = Array.from({ length: 49 }, (_, i) => i + 1);
      while (subset.length < 6) {
        const idx = Math.floor(Math.random() * allNums.length);
        subset.push(allNums.splice(idx, 1)[0]);
      }
      const randomBet = {
        drawDate: drawDateDefault,
        type: 'single' as const,
        numbers: subset.sort((a,b)=>a-b),
        isPartialUnit: false,
        source: 'manual' as const
      };
      setProposedBets([randomBet, ...proposedBets]);
    } else {
      // Pick 7/8 numbers multiple
      const size = Math.floor(Math.random() * 2) + 7;
      const subset: number[] = [];
      const allNums = Array.from({ length: 49 }, (_, i) => i + 1);
      while (subset.length < size) {
        const idx = Math.floor(Math.random() * allNums.length);
        subset.push(allNums.splice(idx, 1)[0]);
      }
      const randomBet = {
        drawDate: drawDateDefault,
        type: 'multiple' as const,
        numbers: subset.sort((a,b)=>a-b),
        isPartialUnit: false,
        source: 'manual' as const
      };
      setProposedBets([randomBet, ...proposedBets]);
    }
  };

  // Confirm and commit imports
  const handleImportSubmit = () => {
    if (proposedBets.length === 0) return;
    onImportBets(proposedBets);
    setProposedBets([]);
    playSound('win', soundEffects);
  };

  // Template generators
  const downloadCSVTemplate = () => {
    playSound('click', soundEffects);
    const headers = "drawDate,type,numbers,bankers,legs,isPartialUnit\n";
    const example1 = "2026-05-30,single,\"4 11 23 28 32 45\",,,false\n";
    const example2 = "2026-05-30,multiple,\"1 5 10 15 20 25 30\",,,false\n";
    const example3 = "2026-05-30,banker,,\"3 9\",\"15 20 25 30 35\",true\n";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + example1 + example2 + example3);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "mark6_bets_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Visual upload module card */}
      <div className="animate-fadeIn">
        {/* Upload box */}
        <div className="select-none">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-6 cursor-pointer transition-all ${isDragging ? 'bg-[#10B981]/10 border-[#10B981]' : `${settings.theme === 'dark' ? 'bg-black/20 border-white/5 hover:border-white/10' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv, .xlsx, .xls, image/*"
              className="hidden"
            />
            
            {isProcessing ? (
              <div className="space-y-3">
                <RefreshCw className="w-10 h-10 text-[#10B981] animate-spin mx-auto" />
                <p className="text-xs font-bold">{t.importer.ocrProcessing}</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-sm">
                <div className={`p-4 rounded-xl w-fit mx-auto border ${settings.theme === 'dark' ? 'bg-black/80 border-white/5' : 'bg-white border-gray-200'}`}>
                  <Upload className="w-7 h-7 text-[#10B981]" />
                </div>
                <div>
                  <p className="text-xs font-bold">{t.importer.dragDropZone}</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                    {t.importer.subText}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Displays */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 rounded-2xl flex items-center">
          <CircleSlash className="w-5 h-5 shrink-0 mr-2.5" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="ml-auto text-rose-400 hover:text-white uppercase text-[10px]">Dismiss</button>
        </div>
      )}

      {/*Proposed imported items previews card grids */}
      {proposedBets.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-850 pb-3">
            <h4 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <FileCheck className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
              <span>{t.importer.previewTitle} ({proposedBets.length})</span>
            </h4>
            <button
              onClick={() => {
                playSound('reset', soundEffects);
                setProposedBets([]);
              }}
              className="text-xs text-rose-450 hover:text-white font-bold flex items-center gap-1 uppercase transition-colors"
            >
              <X className="w-4.5 h-4.5" />
              <span>{t.importer.discard}</span>
            </button>
          </div>

          {/* Proposal grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-96 overflow-y-auto pr-2">
            {proposedBets.map((bet, i) => (
              <div key={i} className="p-4 bg-gray-950/70 border border-gray-850 rounded-2xl flex items-center justify-between gap-3 relative">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 select-none">
                    <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded uppercase">
                      {bet.type}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Draw: {bet.drawDate}
                    </span>
                    <span className="text-[10px] text-orange-450 uppercase font-mono font-semibold">
                      Via {bet.source}
                    </span>
                  </div>

                  {/* Balls Display */}
                  <div className="flex flex-wrap gap-1">
                    {bet.type === 'banker' ? (
                      <>
                        <span className="text-[9px] text-yellow-500 font-bold self-center mr-1">膽/B:</span>
                        {bet.bankers?.map((num: number) => (
                          <span key={num} className="w-5.5 h-5.5 rounded-full bg-yellow-500 text-black text-[9px] font-black flex items-center justify-center">
                            {num}
                          </span>
                        ))}
                        <span className="text-[9px] text-gray-500 font-bold self-center mx-1">腳/L:</span>
                        {bet.legs?.map((num: number) => (
                          <span key={num} className="w-5.5 h-5.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                            {num}
                          </span>
                        ))}
                      </>
                    ) : (
                      bet.numbers.map((num: number) => (
                        <span key={num} className="w-5.5 h-5.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {num}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Single preview dismiss */}
                <button
                  onClick={() => {
                    playSound('click', soundEffects);
                    setProposedBets(proposedBets.filter((_, idx) => idx !== i));
                  }}
                  className="p-1 text-gray-650 hover:text-white hover:bg-white/5 rounded transition-colors self-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-850 pt-4 flex justify-end">
            <button
              onClick={handleImportSubmit}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-950 bg-emerald-400 hover:bg-emerald-300 px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-emerald-500/10"
            >
              <CheckCircle className="w-4.5 h-4.5 text-gray-950 stroke-[2.5]" />
              <span>{t.importer.addBtn.replace('${count}', String(proposedBets.length))}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
