import type { Card } from "./types";

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;
export const SUIT_SYMBOLS = { s: "♠", h: "♥", d: "♦", c: "♣" } as const;

export function handNotation(cards: Card[]): string {
  if (cards.length !== 2) return "—";
  const sorted = [...cards].sort((a, b) => RANKS.indexOf(a[0] as (typeof RANKS)[number]) - RANKS.indexOf(b[0] as (typeof RANKS)[number]));
  if (sorted[0][0] === sorted[1][0]) return `${sorted[0][0]}${sorted[1][0]}`;
  return `${sorted[0][0]}${sorted[1][0]}${sorted[0][1] === sorted[1][1] ? "s" : "o"}`;
}

export function cardLabel(card: Card): string {
  return `${card[0]}${SUIT_SYMBOLS[card[1] as keyof typeof SUIT_SYMBOLS]}`;
}
