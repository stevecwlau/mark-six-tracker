/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MarkSixDraw {
  id: string;
  date: string;
  numbers: number[];
  extraNumber: number;
  jackpot: string;
  nextDrawDate: string;
  nextJackpot: string;
  nextDeadline: string;
  prizes: Array<{ name: string; dividend: string; winners: string }>;
}

export interface UserBet {
  id: string;
  drawDate: string; // YYYY-MM-DD
  numbers: number[]; // all selected numbers
  type: 'single' | 'multiple' | 'banker';
  bankers?: number[]; // bankers (膽)
  legs?: number[]; // legs (腳)
  isPartialUnit?: boolean; // true = $5, false = $10
  importDate: string;
  source: 'manual' | 'csv' | 'excel' | 'ocr';
  ticketImageUrl?: string;
  // Dynamic fields calculated at runtime:
  investment?: number; // total cost
  winnings?: number; // total won
  winningLevelNumbers?: { [key: string]: number }; // level names mapped to count e.g. {"1st": 1}
  isChecked?: boolean;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  language: 'en' | 'zh';
  defaultUnitCost: 10 | 5;
  soundEffects: boolean;
  liveMode: boolean; // if false, use offline simulation data
}
