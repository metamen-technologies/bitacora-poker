export type Card = `${string}${"s" | "h" | "d" | "c"}`;
export type Position = "UTG" | "UTG+1" | "MP" | "LJ" | "HJ" | "CO" | "BTN" | "SB" | "BB";
export type Street = "PREFLOP" | "FLOP" | "TURN" | "RIVER";
export type EntryStatus = "DRAFT" | "COMPLETED";

export interface EliminationInput {
  status: EntryStatus;
  eliminatedAt: string;
  tournamentName: string;
  buyInAmount: number;
  buyInCurrency: string;
  finishPosition: number | null;
  heroStackBb: number;
  heroPosition: Position;
  villainPosition: Position;
  heroCards: Card[];
  villainCards: Card[] | "UNKNOWN";
  streetReached: Street;
  boardFlop: Card[] | null;
  boardTurn: Card | null;
  boardRiver: Card | null;
  analysisPrEl: string;
  analysisErr01: string;
  analysisOk01: string;
}

export interface Elimination extends EliminationInput {
  id: number;
  createdAt: string;
  updatedAt: string;
  heroHandNotation: string;
  villainHandNotation: string;
  isReviewed: boolean;
  reviewBatchId: number | null;
}

export interface ReviewCheck {
  eliminationId: number;
  reviewBatchId: number;
  checkedInReview: boolean;
  elimination: Elimination;
}

export interface ReviewBatch {
  id: number;
  triggerType: "FIVE_ENTRIES" | "SEVEN_DAYS";
  createdAt: string;
  completedAt: string | null;
  status: "PENDING" | "COMPLETED";
  repeatingPattern: string;
  ignoredWarningSignal: string;
  nextSessionRule: string;
  checks: ReviewCheck[];
}

export interface Counts {
  total: number;
  drafts: number;
  pending: number;
  reviewed: number;
}

export interface ActivityDay {
  date: string;
  total: number;
  drafts: number;
  pending: number;
  reviewed: number;
}

export interface AppSummary {
  counts: Counts;
  pendingBatch: ReviewBatch | null;
  recentEntries: Elimination[];
  lastReviewCompletedAt: string | null;
  activity: ActivityDay[];
}

export interface ProgressSaveResult {
  savedAt: string;
  backupPath: string;
  bytes: number;
  counts: Counts;
}

export interface ActiveSaveResult {
  saved: boolean;
  entryId?: number;
  message?: string;
}
