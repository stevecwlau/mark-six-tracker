/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarkSixDraw, UserBet } from '../types';

// Combinations helper (n choose k)
export function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  let result = 1;
  const k = Math.min(r, n - r);
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
}

// Function to generate all combinations of size k from an array
export function getCombinations<T>(array: T[], k: number): T[][] {
  const result: T[][] = [];
  const helper = (start: number, combo: T[]) => {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  };
  helper(0, []);
  return result;
}

// Check an individual 6-number ticket against winning numbers + extra, returning prize tier & amount won
export function checkSingleTicket(
  ticket: number[],
  winningSorted: number[],
  extraNumber: number,
  prizes: MarkSixDraw['prizes']
): { name: string; prizeId: number; amount: number } {
  const matches = ticket.filter(n => winningSorted.includes(n)).length;
  const matchExtra = ticket.includes(extraNumber);

  // Helper parsing dynamic prizes (1st, 2nd, 3rd) from draw
  const parsePrize = (index: number, defaultAmt: number): number => {
    if (!prizes || !prizes[index]) return defaultAmt;
    const cleanStr = prizes[index].dividend.replace(/[^0-9]/g, '');
    const num = parseInt(cleanStr, 10);
    return isNaN(num) || num === 0 ? defaultAmt : num;
  };

  // Official HKJC Prize Match Tiers:
  // 1st Prize: 6 main matches
  if (matches === 6) {
    return { name: "1st Prize", prizeId: 1, amount: parsePrize(0, 8000000) };
  }
  // 2nd Prize: 5 main matches + 1 extra match
  if (matches === 5 && matchExtra) {
    return { name: "2nd Prize", prizeId: 2, amount: parsePrize(1, 400000) };
  }
  // 3rd Prize: 5 main matches
  if (matches === 5) {
    return { name: "3rd Prize", prizeId: 3, amount: parsePrize(2, 45000) };
  }
  // 4th Prize: 4 main matches + 1 extra match
  if (matches === 4 && matchExtra) {
    return { name: "4th Prize", prizeId: 4, amount: 9600 };
  }
  // 5th Prize: 4 main matches
  if (matches === 4) {
    return { name: "5th Prize", prizeId: 5, amount: 640 };
  }
  // 6th Prize: 3 main matches + 1 extra match
  if (matches === 3 && matchExtra) {
    return { name: "6th Prize", prizeId: 6, amount: 320 };
  }
  // 7th Prize: 3 main matches
  if (matches === 3) {
    return { name: "7th Prize", prizeId: 7, amount: 40 };
  }

  return { name: "None", prizeId: 0, amount: 0 };
}

// Full solver that takes a UserBet and evaluates its overall cost & returns
export function evaluateBet(bet: UserBet, draw: MarkSixDraw): {
  investment: number;
  winnings: number;
  breakdown: { [key: string]: number };
} {
  const isPartial = bet.isPartialUnit === true;
  const unitCostMultiplier = isPartial ? 5 : 10;
  const winningSorted = [...draw.numbers].sort((a,b)=>a-b);
  const extraNumber = draw.extraNumber;

  let totalCombinations = 0;
  let totalWinnings = 0;
  const breakdown: { [key: string]: number } = {
    "1st Prize": 0,
    "2nd Prize": 0,
    "3rd Prize": 0,
    "4th Prize": 0,
    "5th Prize": 0,
    "6th Prize": 0,
    "7th Prize": 0,
  };

  const addTicketResult = (ticket: number[]) => {
    const outcome = checkSingleTicket(ticket, winningSorted, extraNumber, draw.prizes);
    if (outcome.prizeId > 0) {
      breakdown[outcome.name] = (breakdown[outcome.name] || 0) + 1;
      // If partial unit ($5), payment is 50% of full dividend
      totalWinnings += outcome.amount * (isPartial ? 0.5 : 1.0);
    }
  };

  if (bet.type === 'single') {
    totalCombinations = 1;
    // Just evaluate the 6 selected numbers directly
    addTicketResult(bet.numbers);
  } 
  else if (bet.type === 'multiple') {
    const selected = bet.numbers;
    if (selected.length >= 6) {
      totalCombinations = nCr(selected.length, 6);
      
      // Generate all 6-number subsets to evaluate
      const tickets = getCombinations(selected, 6);
      for (const t of tickets) {
        addTicketResult(t);
      }
    }
  } 
  else if (bet.type === 'banker') {
    const bankers = bet.bankers || [];
    const legs = bet.legs || [];
    const bCount = bankers.length;
    const requiredLegs = 6 - bCount;

    if (bCount >= 1 && bCount <= 5 && legs.length >= requiredLegs) {
      totalCombinations = nCr(legs.length, requiredLegs);
      
      // Generate combination subsets of legs (size 6 - B)
      const legCombinations = getCombinations(legs, requiredLegs);
      for (const legCombo of legCombinations) {
        const fullTicket = [...bankers, ...legCombo];
        addTicketResult(fullTicket);
      }
    }
  }

  return {
    investment: totalCombinations * unitCostMultiplier,
    winnings: totalWinnings,
    breakdown
  };
}

// Calculate cost only, without knowing results (useful during bet building & previews)
export function calculateBetCost(bet: {
  type: 'single' | 'multiple' | 'banker';
  numbers?: number[];
  bankers?: number[];
  legs?: number[];
  isPartialUnit?: boolean;
}): number {
  const isPartial = bet.isPartialUnit === true;
  const unitCostMultiplier = isPartial ? 5 : 10;
  let totalCombinations = 0;

  if (bet.type === 'single') {
    totalCombinations = 1;
  } else if (bet.type === 'multiple') {
    const count = bet.numbers?.length || 0;
    totalCombinations = nCr(count, 6);
  } else if (bet.type === 'banker') {
    const bCount = bet.bankers?.length || 0;
    const lCount = bet.legs?.length || 0;
    if (bCount >= 1 && bCount <= 5) {
      totalCombinations = nCr(lCount, 6 - bCount);
    }
  }

  return totalCombinations * unitCostMultiplier;
}
