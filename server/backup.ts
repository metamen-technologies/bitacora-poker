import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";
import { LocalDatabase, rowToElimination, rowToReviewBatch } from "./database.js";
import { eliminationInputSchema, handNotation, isoDateTimeSchema, type Elimination } from "./domain.js";
import { DomainError } from "./service.js";

const cardSchema = z.string().regex(/^[AKQJT98765432][shdc]$/);
const positionSchema = z.enum(["UTG", "UTG+1", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"]);

const snapshotEntrySchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["DRAFT", "COMPLETED"]),
  eliminatedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  tournamentName: z.string().min(1).max(200),
  buyInAmount: z.number().finite().min(0),
  buyInCurrency: z.string().min(1).max(8),
  finishPosition: z.number().int().positive().nullable(),
  heroStackBb: z.number().finite().positive(),
  heroPosition: positionSchema,
  villainPosition: positionSchema,
  heroCards: z.array(cardSchema).length(2),
  heroHandNotation: z.string().min(1),
  villainCards: z.union([z.literal("UNKNOWN"), z.array(cardSchema).length(2)]),
  villainHandNotation: z.string().min(1),
  streetReached: z.enum(["PREFLOP", "FLOP", "TURN", "RIVER"]),
  boardFlop: z.array(cardSchema).length(3).nullable(),
  boardTurn: cardSchema.nullable(),
  boardRiver: cardSchema.nullable(),
  analysisPrEl: z.string().max(100_000),
  analysisErr01: z.string().max(100_000),
  analysisOk01: z.string().max(100_000),
  isReviewed: z.boolean(),
  reviewBatchId: z.number().int().positive().nullable(),
}).strict();

const snapshotBatchSchema = z.object({
  id: z.number().int().positive(),
  triggerType: z.enum(["FIVE_ENTRIES", "SEVEN_DAYS"]),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
  status: z.enum(["PENDING", "COMPLETED"]),
  repeatingPattern: z.string().max(100_000),
  ignoredWarningSignal: z.string().max(100_000),
  nextSessionRule: z.string().max(100_000),
}).strict();

const snapshotCheckSchema = z.object({
  eliminationId: z.number().int().positive(),
  reviewBatchId: z.number().int().positive(),
  checkedInReview: z.boolean(),
}).strict();

export const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: isoDateTimeSchema,
  entries: z.array(snapshotEntrySchema),
  reviewBatches: z.array(snapshotBatchSchema),
  reviewChecks: z.array(snapshotCheckSchema),
  appState: z.array(z.object({ key: z.string().min(1), value: z.string() }).strict()),
  sequences: z.object({ eliminations: z.number().int().nonnegative(), reviewBatches: z.number().int().nonnegative() }).strict(),
}).strict();

export type BackupSnapshot = z.infer<typeof snapshotSchema>;

export interface LatestBackupInfo {
  filePath: string;
  relativePath: string;
  bytes: number;
  exportedAt: string;
}

export function latestBackupPath(store: LocalDatabase): string {
  return path.join(path.dirname(store.filePath), "backup-latest.json");
}

export function writeLatestBackup(store: LocalDatabase): LatestBackupInfo {
  const snapshot = createSnapshot(store);
  const filePath = latestBackupPath(store);
  const temporaryPath = `${filePath}.tmp`;
  const contents = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(temporaryPath, contents, "utf8");
  fs.copyFileSync(temporaryPath, filePath);
  fs.rmSync(temporaryPath, { force: true });
  return {
    filePath,
    relativePath: path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
    bytes: Buffer.byteLength(contents, "utf8"),
    exportedAt: snapshot.exportedAt,
  };
}

export function readLatestBackup(store: LocalDatabase): BackupSnapshot {
  const filePath = latestBackupPath(store);
  if (!fs.existsSync(filePath)) {
    throw new DomainError("Todavía no existe un respaldo guardado. Usa «Guardar progreso» primero.", 404);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch {
    throw new DomainError("El respaldo local no contiene JSON válido");
  }
  return validateSnapshot(parsed);
}

export function createSnapshot(store: LocalDatabase): BackupSnapshot {
  const entries = (store.db.prepare("SELECT * FROM eliminations ORDER BY id").all() as Array<Record<string, unknown>>).map(rowToElimination);
  const reviewBatches = (store.db.prepare("SELECT * FROM review_batches ORDER BY id").all() as Array<Record<string, unknown>>).map(rowToReviewBatch);
  const reviewChecks = (store.db.prepare("SELECT * FROM entry_review_checks ORDER BY review_batch_id, elimination_id").all() as Array<{ elimination_id: number; review_batch_id: number; checked_in_review: number }>).map((row) => ({
    eliminationId: row.elimination_id,
    reviewBatchId: row.review_batch_id,
    checkedInReview: Boolean(row.checked_in_review),
  }));
  const sequenceRows = store.db.prepare("SELECT name, seq FROM sqlite_sequence WHERE name IN ('eliminations', 'review_batches')").all() as Array<{ name: string; seq: number }>;
  const sequences = Object.fromEntries(sequenceRows.map((row) => [row.name, row.seq]));
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    entries,
    reviewBatches,
    reviewChecks,
    appState: store.allState(),
    sequences: {
      eliminations: sequences.eliminations ?? 0,
      reviewBatches: sequences.review_batches ?? 0,
    },
  };
}

export function validateSnapshot(value: unknown): BackupSnapshot {
  const result = snapshotSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new DomainError(`La copia JSON no cumple el esquema: ${first.path.join(".")} ${first.message}`);
  }
  const snapshot = result.data;
  ensureUnique(snapshot.entries.map((entry) => entry.id), "Hay identificadores de entrada duplicados");
  ensureUnique(snapshot.reviewBatches.map((batch) => batch.id), "Hay identificadores de revisión duplicados");
  ensureUnique(snapshot.reviewChecks.map((check) => `${check.reviewBatchId}:${check.eliminationId}`), "Hay marcas de revisión duplicadas");
  ensureUnique(snapshot.appState.map((item) => item.key), "Hay claves globales duplicadas");

  const entryIds = new Set(snapshot.entries.map((entry) => entry.id));
  const batchIds = new Set(snapshot.reviewBatches.map((batch) => batch.id));
  const entriesById = new Map(snapshot.entries.map((entry) => [entry.id, entry]));
  const batchesById = new Map(snapshot.reviewBatches.map((batch) => [batch.id, batch]));
  if (snapshot.reviewBatches.filter((batch) => batch.status === "PENDING").length > 1) {
    throw new DomainError("La copia contiene más de una revisión pendiente");
  }

  for (const batch of snapshot.reviewBatches) {
    if (batch.status === "PENDING" && batch.completedAt !== null) {
      throw new DomainError(`La revisión ${batch.id} está pendiente pero tiene fecha de cierre`);
    }
    if (batch.status === "COMPLETED") {
      if (batch.completedAt === null) throw new DomainError(`La revisión ${batch.id} no tiene fecha de cierre`);
      if (!batch.repeatingPattern.trim() || !batch.ignoredWarningSignal.trim() || !batch.nextSessionRule.trim()) {
        throw new DomainError(`La revisión ${batch.id} no contiene las tres conclusiones obligatorias`);
      }
    }
  }

  const checkKeys = new Set<string>();
  for (const check of snapshot.reviewChecks) {
    if (!entryIds.has(check.eliminationId) || !batchIds.has(check.reviewBatchId)) throw new DomainError("La copia contiene una marca de revisión huérfana");
    const entry = entriesById.get(check.eliminationId)!;
    if (entry.reviewBatchId !== check.reviewBatchId) throw new DomainError(`ENTRADA ${entry.id} no coincide con su bloque de revisión`);
    checkKeys.add(`${check.reviewBatchId}:${check.eliminationId}`);
  }

  for (const entry of snapshot.entries) {
    const inputResult = eliminationInputSchema.safeParse(stripSnapshotEntry(entry));
    if (!inputResult.success) throw new DomainError(`ENTRADA ${entry.id} no es válida: ${inputResult.error.issues[0].message}`);
    if (entry.heroHandNotation !== handNotation(entry.heroCards as Elimination["heroCards"])) {
      throw new DomainError(`ENTRADA ${entry.id} tiene una notación de héroe inconsistente`);
    }
    const expectedVillain = entry.villainCards === "UNKNOWN" ? "Desconocida" : handNotation(entry.villainCards as Elimination["heroCards"]);
    if (entry.villainHandNotation !== expectedVillain) throw new DomainError(`ENTRADA ${entry.id} tiene una notación de villano inconsistente`);
    if (entry.reviewBatchId === null) {
      if (entry.isReviewed) throw new DomainError(`ENTRADA ${entry.id} está marcada como revisada sin bloque`);
      continue;
    }
    const batch = batchesById.get(entry.reviewBatchId);
    if (!batch) throw new DomainError(`ENTRADA ${entry.id} referencia una revisión inexistente`);
    if (entry.status === "DRAFT") throw new DomainError(`ENTRADA ${entry.id} es un borrador vinculado a una revisión`);
    if (!checkKeys.has(`${batch.id}:${entry.id}`)) throw new DomainError(`ENTRADA ${entry.id} no tiene marca en su bloque de revisión`);
    if (batch.status === "PENDING" && entry.isReviewed) throw new DomainError(`ENTRADA ${entry.id} está revisada dentro de un bloque pendiente`);
    if (batch.status === "COMPLETED" && !entry.isReviewed) throw new DomainError(`ENTRADA ${entry.id} no está marcada como revisada en un bloque cerrado`);
  }

  for (const batch of snapshot.reviewBatches) {
    const linkedEntries = snapshot.entries.filter((entry) => entry.reviewBatchId === batch.id);
    if (batch.status === "PENDING" && linkedEntries.length === 0) {
      throw new DomainError(`La revisión pendiente ${batch.id} no contiene entradas`);
    }
    if (linkedEntries.some((entry) => !checkKeys.has(`${batch.id}:${entry.id}`))) {
      throw new DomainError(`La revisión ${batch.id} no incluye todas las marcas de sus entradas`);
    }
    if (batch.status === "COMPLETED" && snapshot.reviewChecks.some((check) => check.reviewBatchId === batch.id && !check.checkedInReview)) {
      throw new DomainError(`La revisión ${batch.id} tiene entradas sin marcar`);
    }
  }

  for (const state of snapshot.appState) {
    if (state.key === "last_review_completed_at" || state.key === "first_completed_at") {
      if (Number.isNaN(Date.parse(state.value))) throw new DomainError(`El estado global ${state.key} no tiene una fecha válida`);
    }
  }

  const maxEntry = Math.max(0, ...snapshot.entries.map((entry) => entry.id));
  const maxBatch = Math.max(0, ...snapshot.reviewBatches.map((batch) => batch.id));
  if (snapshot.sequences.eliminations < maxEntry || snapshot.sequences.reviewBatches < maxBatch) {
    throw new DomainError("Las secuencias de identificadores de la copia son inconsistentes");
  }
  return snapshot;
}

export function restoreSnapshot(store: LocalDatabase, value: unknown): BackupSnapshot {
  const snapshot = validateSnapshot(value);
  const transaction = store.db.transaction(() => {
    store.db.prepare("DELETE FROM entry_review_checks").run();
    store.db.prepare("DELETE FROM eliminations").run();
    store.db.prepare("DELETE FROM review_batches").run();
    store.db.prepare("DELETE FROM app_state").run();

    const insertBatch = store.db.prepare(`INSERT INTO review_batches
      (id, trigger_type, created_at, completed_at, status, repeating_pattern, ignored_warning_signal, next_session_rule)
      VALUES (@id, @triggerType, @createdAt, @completedAt, @status, @repeatingPattern, @ignoredWarningSignal, @nextSessionRule)`);
    snapshot.reviewBatches.forEach((batch) => insertBatch.run(batch));

    const insertEntry = store.db.prepare(`INSERT INTO eliminations
      (id, status, eliminated_at, created_at, updated_at, tournament_name, buy_in_amount, buy_in_currency,
       finish_position, hero_stack_bb, hero_position, villain_position, hero_cards, hero_hand_notation,
       villain_cards, villain_hand_notation, street_reached, board_flop, board_turn, board_river,
       analysis_pr_el, analysis_err_01, analysis_ok_01, is_reviewed, review_batch_id)
      VALUES (@id, @status, @eliminatedAt, @createdAt, @updatedAt, @tournamentName, @buyInAmount, @buyInCurrency,
       @finishPosition, @heroStackBb, @heroPosition, @villainPosition, @heroCardsJson, @heroHandNotation,
       @villainCardsJson, @villainHandNotation, @streetReached, @boardFlopJson, @boardTurn, @boardRiver,
       @analysisPrEl, @analysisErr01, @analysisOk01, @isReviewed, @reviewBatchId)`);
    snapshot.entries.forEach((entry) => insertEntry.run({
      ...entry,
      heroCardsJson: JSON.stringify(entry.heroCards),
      villainCardsJson: entry.villainCards === "UNKNOWN" ? "UNKNOWN" : JSON.stringify(entry.villainCards),
      boardFlopJson: entry.boardFlop === null ? null : JSON.stringify(entry.boardFlop),
      isReviewed: entry.isReviewed ? 1 : 0,
    }));

    const insertCheck = store.db.prepare("INSERT INTO entry_review_checks (elimination_id, review_batch_id, checked_in_review) VALUES (?, ?, ?)");
    snapshot.reviewChecks.forEach((check) => insertCheck.run(check.eliminationId, check.reviewBatchId, check.checkedInReview ? 1 : 0));
    const insertState = store.db.prepare("INSERT INTO app_state (key, value) VALUES (?, ?)");
    snapshot.appState.forEach((item) => insertState.run(item.key, item.value));
    store.db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('eliminations', 'review_batches')").run();
    store.db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('eliminations', ?)").run(snapshot.sequences.eliminations);
    store.db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('review_batches', ?)").run(snapshot.sequences.reviewBatches);
  });
  transaction();
  return snapshot;
}

export function validateSqliteFile(filePath: string): BackupSnapshot {
  let db: Database.Database | null = null;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
    const integrity = db.pragma("quick_check") as Array<{ quick_check: string }>;
    if (integrity[0]?.quick_check !== "ok") throw new DomainError("El archivo SQLite no supera la comprobación de integridad");
    const required = ["eliminations", "review_batches", "entry_review_checks", "app_state"];
    const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name));
    if (required.some((name) => !tables.has(name))) throw new DomainError("El archivo SQLite no pertenece a River Notes");
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("El archivo SQLite no es una copia válida de River Notes");
  } finally {
    db?.close();
  }
  let temporaryStore: LocalDatabase | null = null;
  try {
    temporaryStore = new LocalDatabase(filePath);
    const snapshot = validateSnapshot(createSnapshot(temporaryStore));
    temporaryStore.db.pragma("wal_checkpoint(TRUNCATE)");
    return snapshot;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("El archivo SQLite no es una copia válida de River Notes");
  } finally {
    temporaryStore?.close();
  }
}

export function replaceWithSqliteBackup(store: LocalDatabase, uploadedPath: string): void {
  validateSqliteFile(uploadedPath);
  const rollbackPath = path.join(path.dirname(store.filePath), `.rollback-${Date.now()}.db`);
  store.db.pragma("wal_checkpoint(TRUNCATE)");
  store.close();
  try {
    fs.copyFileSync(store.filePath, rollbackPath);
    removeSidecars(store.filePath);
    fs.copyFileSync(uploadedPath, store.filePath);
    store.reopen();
    validateSnapshot(createSnapshot(store));
    fs.rmSync(rollbackPath, { force: true });
  } catch (error) {
    store.close();
    if (fs.existsSync(rollbackPath)) fs.copyFileSync(rollbackPath, store.filePath);
    fs.rmSync(rollbackPath, { force: true });
    removeSidecars(store.filePath);
    store.reopen();
    throw error instanceof DomainError ? error : new DomainError("No se pudo restaurar SQLite; se conservó la base anterior");
  }
}

function stripSnapshotEntry(entry: BackupSnapshot["entries"][number]) {
  const { id: _id, createdAt: _created, updatedAt: _updated, heroHandNotation: _heroNotation, villainHandNotation: _villainNotation, isReviewed: _reviewed, reviewBatchId: _batch, ...input } = entry;
  return input;
}

function ensureUnique(values: Array<string | number>, message: string): void {
  if (new Set(values).size !== values.length) throw new DomainError(message);
}

function removeSidecars(filePath: string): void {
  fs.rmSync(`${filePath}-wal`, { force: true });
  fs.rmSync(`${filePath}-shm`, { force: true });
}
