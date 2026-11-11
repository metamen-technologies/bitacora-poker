import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Card, Elimination, EliminationInput, ReviewBatch, ReviewCheck } from "./domain.js";

type SqliteRow = Record<string, unknown>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS review_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('FIVE_ENTRIES', 'SEVEN_DAYS')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'COMPLETED')),
  repeating_pattern TEXT NOT NULL DEFAULT '',
  ignored_warning_signal TEXT NOT NULL DEFAULT '',
  next_session_rule TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS eliminations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK(status IN ('DRAFT', 'COMPLETED')),
  eliminated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  buy_in_amount REAL NOT NULL,
  buy_in_currency TEXT NOT NULL,
  finish_position INTEGER,
  hero_stack_bb REAL NOT NULL,
  hero_position TEXT NOT NULL CHECK(hero_position IN ('UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
  villain_position TEXT NOT NULL CHECK(villain_position IN ('UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
  hero_cards TEXT NOT NULL,
  hero_hand_notation TEXT NOT NULL,
  villain_cards TEXT NOT NULL,
  villain_hand_notation TEXT NOT NULL,
  street_reached TEXT NOT NULL CHECK(street_reached IN ('PREFLOP', 'FLOP', 'TURN', 'RIVER')),
  board_flop TEXT,
  board_turn TEXT,
  board_river TEXT,
  analysis_pr_el TEXT NOT NULL DEFAULT '',
  analysis_err_01 TEXT NOT NULL DEFAULT '',
  analysis_ok_01 TEXT NOT NULL DEFAULT '',
  is_reviewed INTEGER NOT NULL DEFAULT 0 CHECK(is_reviewed IN (0, 1)),
  review_batch_id INTEGER REFERENCES review_batches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entry_review_checks (
  elimination_id INTEGER NOT NULL REFERENCES eliminations(id) ON DELETE CASCADE,
  review_batch_id INTEGER NOT NULL REFERENCES review_batches(id) ON DELETE CASCADE,
  checked_in_review INTEGER NOT NULL DEFAULT 0 CHECK(checked_in_review IN (0, 1)),
  PRIMARY KEY (elimination_id, review_batch_id)
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eliminations_date ON eliminations(eliminated_at DESC);
CREATE INDEX IF NOT EXISTS idx_eliminations_review ON eliminations(status, is_reviewed, review_batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_review ON review_batches(status) WHERE status = 'PENDING';
`;

export class LocalDatabase {
  readonly filePath: string;
  db: Database.Database;

  constructor(filePath: string) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = this.open(filePath);
  }

  private open(filePath: string): Database.Database {
    const db = new Database(filePath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
    return db;
  }

  close(): void {
    if (this.db.open) this.db.close();
  }

  reopen(): void {
    this.close();
    this.db = this.open(this.filePath);
  }

  getState(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM app_state WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setState(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO app_state (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  allState(): Array<{ key: string; value: string }> {
    return this.db.prepare("SELECT key, value FROM app_state ORDER BY key").all() as Array<{ key: string; value: string }>;
  }
}

const CARD_PATTERN = /^[AKQJT98765432][shdc]$/;

function parseCardArray(value: unknown): Card[] | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((card): card is Card => typeof card === "string" && CARD_PATTERN.test(card));
  } catch {
    return null;
  }
}

function parseSingleCard(value: unknown): Card | null {
  return typeof value === "string" && CARD_PATTERN.test(value) ? value as Card : null;
}

export function rowToElimination(row: SqliteRow): Elimination {
  const heroCards = parseCardArray(row.hero_cards) ?? [];
  const villainCards = row.villain_cards === "UNKNOWN" ? "UNKNOWN" : parseCardArray(row.villain_cards) ?? "UNKNOWN";
  const boardFlop = parseCardArray(row.board_flop);
  return {
    id: Number(row.id),
    status: row.status as Elimination["status"],
    eliminatedAt: String(row.eliminated_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    tournamentName: String(row.tournament_name),
    buyInAmount: Number(row.buy_in_amount),
    buyInCurrency: String(row.buy_in_currency),
    finishPosition: row.finish_position == null ? null : Number(row.finish_position),
    heroStackBb: Number(row.hero_stack_bb),
    heroPosition: row.hero_position as Elimination["heroPosition"],
    villainPosition: row.villain_position as Elimination["villainPosition"],
    heroCards,
    heroHandNotation: String(row.hero_hand_notation),
    villainCards,
    villainHandNotation: String(row.villain_hand_notation),
    streetReached: row.street_reached as Elimination["streetReached"],
    boardFlop: boardFlop && boardFlop.length === 3 ? boardFlop : null,
    boardTurn: parseSingleCard(row.board_turn),
    boardRiver: parseSingleCard(row.board_river),
    analysisPrEl: String(row.analysis_pr_el),
    analysisErr01: String(row.analysis_err_01),
    analysisOk01: String(row.analysis_ok_01),
    isReviewed: Boolean(row.is_reviewed),
    reviewBatchId: row.review_batch_id === null ? null : Number(row.review_batch_id),
  };
}

export function rowToReviewBatch(row: SqliteRow): ReviewBatch {
  return {
    id: Number(row.id),
    triggerType: row.trigger_type as ReviewBatch["triggerType"],
    createdAt: String(row.created_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
    status: row.status as ReviewBatch["status"],
    repeatingPattern: String(row.repeating_pattern),
    ignoredWarningSignal: String(row.ignored_warning_signal),
    nextSessionRule: String(row.next_session_rule),
  };
}

export function rowToReviewCheck(row: SqliteRow): ReviewCheck {
  return {
    eliminationId: Number(row.elimination_id),
    reviewBatchId: Number(row.review_batch_id),
    checkedInReview: Boolean(row.checked_in_review),
    elimination: rowToElimination(row),
  };
}

export function inputToParams(input: EliminationInput, now: string, notation: { hero: string; villain: string }) {
  return {
    status: input.status,
    eliminatedAt: input.eliminatedAt,
    now,
    tournamentName: input.tournamentName,
    buyInAmount: input.buyInAmount,
    buyInCurrency: input.buyInCurrency,
    finishPosition: input.finishPosition,
    heroStackBb: input.heroStackBb,
    heroPosition: input.heroPosition,
    villainPosition: input.villainPosition,
    heroCards: JSON.stringify(input.heroCards),
    heroHandNotation: notation.hero,
    villainCards: input.villainCards === "UNKNOWN" ? "UNKNOWN" : JSON.stringify(input.villainCards),
    villainHandNotation: notation.villain,
    streetReached: input.streetReached,
    boardFlop: input.boardFlop ? JSON.stringify(input.boardFlop) : null,
    boardTurn: input.boardTurn,
    boardRiver: input.boardRiver,
    analysisPrEl: input.analysisPrEl,
    analysisErr01: input.analysisErr01,
    analysisOk01: input.analysisOk01,
  };
}

export { SCHEMA };
