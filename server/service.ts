import type Database from "better-sqlite3";
import { LocalDatabase, inputToParams, rowToElimination, rowToReviewBatch, rowToReviewCheck } from "./database.js";
import {
  assertEliminationInput,
  formatEntryNumber,
  handNotation,
  type Elimination,
  type EliminationInput,
  type ReviewBatch,
} from "./domain.js";

export class DomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface HistoryFilters {
  search?: string;
  tournament?: string;
  dateFrom?: string;
  dateTo?: string;
  buyInAmount?: number;
  currency?: string;
  reviewStatus?: "REVIEWED" | "PENDING" | "DRAFT";
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

export interface RepairReport {
  orphanChecks: number;
  relinkedChecks: number;
  revertedBatches: number;
  normalizedEntries: number;
  repairedBatches: number[];
}

export class EliminationService {
  constructor(
    readonly store: LocalDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private get db(): Database.Database {
    return this.store.db;
  }

  create(inputValue: unknown): Elimination {
    const input = assertEliminationInput(inputValue);
    const transaction = this.db.transaction(() => {
      if (input.status === "COMPLETED" && this.getPendingBatch()) {
        throw new DomainError("Hay una revisión obligatoria pendiente. Puedes guardar esta mano como borrador.", 423);
      }
      const now = this.now().toISOString();
      const params = this.inputParams(input, now);
      const result = this.db.prepare(`
        INSERT INTO eliminations (
          status, eliminated_at, created_at, updated_at, tournament_name, buy_in_amount, buy_in_currency,
          finish_position, hero_stack_bb, hero_position, villain_position, hero_cards, hero_hand_notation,
          villain_cards, villain_hand_notation, street_reached, board_flop, board_turn, board_river,
          analysis_pr_el, analysis_err_01, analysis_ok_01
        ) VALUES (
          @status, @eliminatedAt, @now, @now, @tournamentName, @buyInAmount, @buyInCurrency,
          @finishPosition, @heroStackBb, @heroPosition, @villainPosition, @heroCards, @heroHandNotation,
          @villainCards, @villainHandNotation, @streetReached, @boardFlop, @boardTurn, @boardRiver,
          @analysisPrEl, @analysisErr01, @analysisOk01
        )
      `).run(params);
      if (input.status === "COMPLETED") this.noteFirstCompletion(now);
      this.evaluateReviewState();
      return this.get(Number(result.lastInsertRowid));
    });
    return transaction();
  }

  update(id: number, inputValue: unknown): Elimination {
    const input = assertEliminationInput(inputValue);
    const transaction = this.db.transaction(() => {
      const existing = this.get(id);
      const transitionToCompleted = existing.status === "DRAFT" && input.status === "COMPLETED";
      if (existing.status === "COMPLETED" && input.status === "DRAFT") {
        throw new DomainError("Una entrada completada no puede volver a ser borrador");
      }
      if (transitionToCompleted && this.getPendingBatch()) {
        throw new DomainError("Finalizar entradas está bloqueado hasta completar la revisión pendiente.", 423);
      }
      const now = this.now().toISOString();
      const params = { ...this.inputParams(input, now), id };
      this.db.prepare(`
        UPDATE eliminations SET
          status = @status, eliminated_at = @eliminatedAt, updated_at = @now,
          tournament_name = @tournamentName, buy_in_amount = @buyInAmount, buy_in_currency = @buyInCurrency,
          finish_position = @finishPosition, hero_stack_bb = @heroStackBb, hero_position = @heroPosition,
          villain_position = @villainPosition, hero_cards = @heroCards, hero_hand_notation = @heroHandNotation,
          villain_cards = @villainCards, villain_hand_notation = @villainHandNotation,
          street_reached = @streetReached, board_flop = @boardFlop, board_turn = @boardTurn,
          board_river = @boardRiver, analysis_pr_el = @analysisPrEl, analysis_err_01 = @analysisErr01,
          analysis_ok_01 = @analysisOk01
        WHERE id = @id
      `).run(params);
      if (transitionToCompleted) this.noteFirstCompletion(now);
      this.evaluateReviewState();
      return this.get(id);
    });
    return transaction();
  }

  delete(id: number): void {
    const entry = this.get(id);
    if (entry.reviewBatchId !== null) {
      const batch = this.db.prepare("SELECT status FROM review_batches WHERE id = ?").get(entry.reviewBatchId) as { status: string } | undefined;
      if (batch?.status === "PENDING") {
        throw new DomainError("No se puede eliminar una entrada incluida en una revisión pendiente", 423);
      }
      throw new DomainError("No se puede eliminar una entrada que forma parte de un bloque de revisión cerrado. El historial de aprendizaje es permanente.", 423);
    }
    this.db.prepare("DELETE FROM eliminations WHERE id = ?").run(id);
  }

  get(id: number): Elimination {
    const row = this.db.prepare("SELECT * FROM eliminations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) throw new DomainError("La entrada no existe", 404);
    return rowToElimination(row);
  }

  list(filters: HistoryFilters = {}): Elimination[] {
    const where: string[] = [];
    const params: Record<string, string | number> = {};
    if (filters.search) {
      where.push("(LOWER(tournament_name) LIKE @search OR CAST(id AS TEXT) LIKE @search)");
      params.search = `%${filters.search.toLowerCase()}%`;
    }
    if (filters.tournament) {
      where.push("tournament_name = @tournament");
      params.tournament = filters.tournament;
    }
    if (filters.dateFrom) {
      where.push("eliminated_at >= @dateFrom");
      params.dateFrom = dateBoundary(filters.dateFrom, false);
    }
    if (filters.dateTo) {
      where.push("eliminated_at <= @dateTo");
      params.dateTo = dateBoundary(filters.dateTo, true);
    }
    if (filters.buyInAmount !== undefined) {
      where.push("buy_in_amount = @buyInAmount");
      params.buyInAmount = filters.buyInAmount;
    }
    if (filters.currency) {
      where.push("buy_in_currency = @currency");
      params.currency = filters.currency.toUpperCase();
    }
    if (filters.reviewStatus === "REVIEWED") where.push("status = 'COMPLETED' AND is_reviewed = 1");
    if (filters.reviewStatus === "PENDING") where.push("status = 'COMPLETED' AND is_reviewed = 0");
    if (filters.reviewStatus === "DRAFT") where.push("status = 'DRAFT'");
    const sql = `SELECT * FROM eliminations ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY eliminated_at DESC, id DESC`;
    return (this.db.prepare(sql).all(params) as Array<Record<string, unknown>>).map(rowToElimination);
  }

  listTournaments(): string[] {
    return (this.db.prepare("SELECT DISTINCT tournament_name FROM eliminations ORDER BY tournament_name COLLATE NOCASE").all() as Array<{ tournament_name: string }>).map((row) => row.tournament_name);
  }

  counts(): Counts {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS drafts,
        SUM(CASE WHEN status = 'COMPLETED' AND is_reviewed = 0 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'COMPLETED' AND is_reviewed = 1 THEN 1 ELSE 0 END) AS reviewed
      FROM eliminations
    `).get() as { total: number; drafts: number | null; pending: number | null; reviewed: number | null };
    return {
      total: Number(row.total ?? 0),
      drafts: Number(row.drafts ?? 0),
      pending: Number(row.pending ?? 0),
      reviewed: Number(row.reviewed ?? 0),
    };
  }

  activity(): ActivityDay[] {
    const rows = this.db.prepare(`
      SELECT
        date(eliminated_at, 'localtime') AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS drafts,
        SUM(CASE WHEN status = 'COMPLETED' AND is_reviewed = 0 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'COMPLETED' AND is_reviewed = 1 THEN 1 ELSE 0 END) AS reviewed
      FROM eliminations
      GROUP BY day
      ORDER BY day
    `).all() as Array<{ day: string; total: number; drafts: number | null; pending: number | null; reviewed: number | null }>;
    return rows
      .filter((row) => Boolean(row.day))
      .map((row) => ({
        date: row.day,
        total: Number(row.total ?? 0),
        drafts: Number(row.drafts ?? 0),
        pending: Number(row.pending ?? 0),
        reviewed: Number(row.reviewed ?? 0),
      }));
  }

  reviewHistory(): ReviewBatch[] {
    const rows = this.db.prepare(`
      SELECT * FROM review_batches
      WHERE status = 'COMPLETED'
      ORDER BY completed_at DESC, id DESC
    `).all() as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const batch = rowToReviewBatch(row);
      batch.checks = this.checksForBatch(batch.id);
      return batch;
    });
  }

  getPendingBatch(): ReviewBatch | null {
    const row = this.db.prepare("SELECT * FROM review_batches WHERE status = 'PENDING' ORDER BY created_at, id LIMIT 1").get() as Record<string, unknown> | undefined;
    if (!row) return null;
    const batch = rowToReviewBatch(row);
    batch.checks = this.checksForBatch(batch.id).filter((check) => check.elimination.status === "COMPLETED");
    // Una revisión sin entradas válidas jamás puede bloquear la aplicación.
    if (batch.checks.length === 0) return null;
    if (batch.triggerType === "FIVE_ENTRIES" && batch.checks.length < 5) return null;
    return batch;
  }

  evaluateReviewState(): ReviewBatch | null {
    this.auditAndRepair();
    const existing = this.getPendingBatch();
    if (existing) return existing;
    const candidates = this.db.prepare(`
      SELECT id FROM eliminations
      WHERE status = 'COMPLETED' AND is_reviewed = 0 AND review_batch_id IS NULL
      ORDER BY eliminated_at, id
    `).all() as Array<{ id: number }>;
    if (!candidates.length) return null;

    if (candidates.length >= 5) {
      return this.createReviewBatch("FIVE_ENTRIES", candidates.map((row) => row.id));
    }

    if (this.isSevenDayCycleDue()) {
      return this.createReviewBatch("SEVEN_DAYS", candidates.map((row) => row.id));
    }
    return null;
  }

  isSevenDayCycleDue(): boolean {
    const reference = this.store.getState("last_review_completed_at") ?? this.store.getState("first_completed_at");
    if (!reference) return false;
    return this.now().getTime() - new Date(reference).getTime() >= 7 * 24 * 60 * 60 * 1000;
  }

  setReviewCheck(batchId: number, eliminationId: number, checked: boolean): ReviewBatch {
    const transaction = this.db.transaction(() => {
      const pending = this.getPendingBatch();
      if (!pending || pending.id !== batchId) throw new DomainError("La revisión ya no está pendiente", 409);
      const belongs = this.db.prepare(`
        SELECT 1 FROM entry_review_checks WHERE review_batch_id = ? AND elimination_id = ?
      `).get(batchId, eliminationId);
      if (!belongs) throw new DomainError("La entrada no pertenece a esta revisión", 404);
      this.db.prepare(`
        UPDATE entry_review_checks SET checked_in_review = ?
        WHERE review_batch_id = ? AND elimination_id = ?
      `).run(checked ? 1 : 0, batchId, eliminationId);
      return this.getPendingBatch() as ReviewBatch;
    });
    return transaction();
  }

  completeReview(batchId: number, synthesis: { repeatingPattern?: string; ignoredWarningSignal?: string; nextSessionRule?: string }): ReviewBatch {
    const transaction = this.db.transaction(() => {
      const batch = this.getPendingBatch();
      if (!batch || batch.id !== batchId) throw new DomainError("No existe esa revisión pendiente", 404);
      if (!batch.checks?.length) throw new DomainError("La revisión no contiene entradas válidas; se reparará automáticamente.", 409);
      if (batch.triggerType === "FIVE_ENTRIES" && batch.checks.length < 5) {
        throw new DomainError("La revisión de cinco entradas está incompleta y no puede cerrarse.", 409);
      }
      if (batch.checks.some((check) => !check.checkedInReview)) {
        throw new DomainError("Debes inspeccionar y marcar cada entrada antes de cerrar la revisión");
      }
      const repeatingPattern = synthesis.repeatingPattern?.trim() ?? "";
      const ignoredWarningSignal = synthesis.ignoredWarningSignal?.trim() ?? "";
      const nextSessionRule = synthesis.nextSessionRule?.trim() ?? "";
      if (!repeatingPattern || !ignoredWarningSignal || !nextSessionRule) {
        throw new DomainError("Completa las tres conclusiones obligatorias de la revisión");
      }
      const now = this.now().toISOString();
      this.db.prepare(`
        UPDATE review_batches SET status = 'COMPLETED', completed_at = ?, repeating_pattern = ?,
          ignored_warning_signal = ?, next_session_rule = ? WHERE id = ?
      `).run(now, repeatingPattern, ignoredWarningSignal, nextSessionRule, batchId);
      this.db.prepare(`
        UPDATE eliminations SET is_reviewed = 1, updated_at = ?
        WHERE id IN (SELECT elimination_id FROM entry_review_checks WHERE review_batch_id = ?)
      `).run(now, batchId);
      this.store.setState("last_review_completed_at", now);
      const row = this.db.prepare("SELECT * FROM review_batches WHERE id = ?").get(batchId) as Record<string, unknown>;
      const completed = rowToReviewBatch(row);
      completed.checks = this.checksForBatch(batchId);
      return completed;
    });
    return transaction();
  }

  /**
   * Repara lotes corruptos, marcas huérfanas y entradas desincronizadas.
   * Se ejecuta al arrancar la API y antes de evaluar el estado de revisión.
   */
  auditAndRepair(): RepairReport {
    const report: RepairReport = {
      orphanChecks: 0,
      relinkedChecks: 0,
      revertedBatches: 0,
      normalizedEntries: 0,
      repairedBatches: [],
    };
    const transaction = this.db.transaction(() => {
      report.orphanChecks += this.db.prepare(`
        DELETE FROM entry_review_checks
        WHERE elimination_id NOT IN (SELECT id FROM eliminations)
           OR review_batch_id NOT IN (SELECT id FROM review_batches)
      `).run().changes;

      const completedRows = this.db.prepare(`
        SELECT * FROM review_batches WHERE status = 'COMPLETED' ORDER BY completed_at, id
      `).all() as Array<Record<string, unknown>>;
      for (const row of completedRows) {
        const batch = rowToReviewBatch(row);
        const linked = this.db.prepare(`
          SELECT id FROM eliminations WHERE review_batch_id = ? AND status = 'COMPLETED' ORDER BY eliminated_at, id
        `).all(batch.id) as Array<{ id: number }>;
        for (const entry of linked) {
          report.relinkedChecks += this.db.prepare(`
            INSERT OR IGNORE INTO entry_review_checks (elimination_id, review_batch_id, checked_in_review)
            VALUES (?, ?, 1)
          `).run(entry.id, batch.id).changes;
        }
        report.orphanChecks += this.db.prepare(`
          DELETE FROM entry_review_checks
          WHERE review_batch_id = ? AND elimination_id IN (SELECT id FROM eliminations WHERE status = 'DRAFT')
        `).run(batch.id).changes;
        this.db.prepare(`
          UPDATE entry_review_checks SET checked_in_review = 1
          WHERE review_batch_id = ?
            AND elimination_id IN (SELECT id FROM eliminations WHERE review_batch_id = ? AND status = 'COMPLETED')
        `).run(batch.id, batch.id);
        report.normalizedEntries += this.db.prepare(`
          UPDATE eliminations SET is_reviewed = 1
          WHERE review_batch_id = ? AND status = 'COMPLETED' AND is_reviewed = 0
        `).run(batch.id).changes;
      }

      const pendingRows = this.db.prepare(`
        SELECT * FROM review_batches WHERE status = 'PENDING' ORDER BY created_at, id
      `).all() as Array<Record<string, unknown>>;
      pendingRows.forEach((row, index) => {
        const batch = rowToReviewBatch(row);
        if (index > 0) {
          this.revertBatch(batch.id);
          report.revertedBatches += 1;
          report.repairedBatches.push(batch.id);
          return;
        }

        report.orphanChecks += this.db.prepare(`
          DELETE FROM entry_review_checks
          WHERE review_batch_id = ? AND elimination_id IN (SELECT id FROM eliminations WHERE status = 'DRAFT')
        `).run(batch.id).changes;

        // Una marca de este lote no puede robar una entrada vinculada a otro bloque.
        report.orphanChecks += this.db.prepare(`
          DELETE FROM entry_review_checks
          WHERE review_batch_id = ? AND elimination_id IN (
            SELECT id FROM eliminations WHERE review_batch_id IS NOT NULL AND review_batch_id <> ?
          )
        `).run(batch.id, batch.id).changes;

        this.db.prepare(`
          INSERT OR IGNORE INTO entry_review_checks (elimination_id, review_batch_id, checked_in_review)
          SELECT id, ?, 0 FROM eliminations
          WHERE review_batch_id = ? AND status = 'COMPLETED'
        `).run(batch.id, batch.id);

        const required = batch.triggerType === "FIVE_ENTRIES" ? 5 : 1;
        let checks = this.checksForBatch(batch.id).filter((check) => check.elimination.status === "COMPLETED");
        if (checks.length < required) {
          const candidates = this.db.prepare(`
            SELECT id FROM eliminations
            WHERE status = 'COMPLETED' AND is_reviewed = 0
              AND (review_batch_id IS NULL OR review_batch_id = ?)
            ORDER BY eliminated_at, id
          `).all(batch.id) as Array<{ id: number }>;
          const linkedIds = new Set(checks.map((check) => check.eliminationId));
          const now = this.now().toISOString();
          for (const candidate of candidates) {
            if (checks.length >= required) break;
            if (linkedIds.has(candidate.id)) continue;
            this.db.prepare(`
              INSERT OR IGNORE INTO entry_review_checks (elimination_id, review_batch_id, checked_in_review)
              VALUES (?, ?, 0)
            `).run(candidate.id, batch.id);
            this.db.prepare(`
              UPDATE eliminations SET review_batch_id = ?, is_reviewed = 0, updated_at = ? WHERE id = ?
            `).run(batch.id, now, candidate.id);
            linkedIds.add(candidate.id);
            report.relinkedChecks += 1;
          }
          checks = this.checksForBatch(batch.id).filter((check) => check.elimination.status === "COMPLETED");
        }

        if (checks.length < required) {
          this.revertBatch(batch.id);
          report.revertedBatches += 1;
          report.repairedBatches.push(batch.id);
          return;
        }

        const now = this.now().toISOString();
        for (const check of checks) {
          this.db.prepare(`
            UPDATE eliminations SET review_batch_id = ?, is_reviewed = 0, updated_at = ?
            WHERE id = ? AND (review_batch_id IS NULL OR review_batch_id <> ? OR is_reviewed <> 0)
          `).run(batch.id, now, check.eliminationId, batch.id);
        }
        report.normalizedEntries += this.db.prepare(`
          UPDATE eliminations SET is_reviewed = 0
          WHERE review_batch_id = ? AND status = 'COMPLETED' AND is_reviewed = 1
        `).run(batch.id).changes;
      });

      report.normalizedEntries += this.db.prepare(`
        UPDATE eliminations SET review_batch_id = NULL, is_reviewed = 0
        WHERE review_batch_id IS NOT NULL
          AND review_batch_id NOT IN (SELECT id FROM review_batches)
      `).run().changes;
      report.normalizedEntries += this.db.prepare(`
        UPDATE eliminations SET is_reviewed = 0
        WHERE is_reviewed = 1 AND review_batch_id IS NULL
      `).run().changes;
    });
    transaction();
    return report;
  }

  appSummary() {
    this.auditAndRepair();
    const counts = this.counts();
    const pendingBatch = this.evaluateReviewState();
    return {
      counts,
      pendingBatch,
      recentEntries: this.list().slice(0, 3),
      lastReviewCompletedAt: this.store.getState("last_review_completed_at"),
      activity: this.activity(),
    };
  }

  canonical(entry: Elimination): string {
    const exactHero = entry.heroCards.join(" ");
    const exactVillain = entry.villainCards === "UNKNOWN" ? "Desconocidas" : entry.villainCards.join(" ");
    const board = [
      ...(entry.boardFlop ?? []),
      ...(entry.boardTurn ? [entry.boardTurn] : []),
      ...(entry.boardRiver ? [entry.boardRiver] : []),
    ];
    return `### ENTRADA ${formatEntryNumber(entry.id)}
Fecha y hora: ${formatCanonicalDate(entry.eliminatedAt)}
[TOURNAMENT_LOG] [STATUS: ELIMINATED]

==================================================
GAME_DATA
--------------------------------------------------
Torneo: ${entry.tournamentName}
Buy-in: ${entry.buyInAmount} ${entry.buyInCurrency}
Posición final: ${entry.finishPosition ?? "Pendiente"}
Stack Héroe: ${entry.heroStackBb} BB
Posición Héroe: ${entry.heroPosition}
Posición Villano: ${entry.villainPosition}
Mano Héroe: ${entry.heroHandNotation} (${exactHero})
Mano Villano: ${entry.villainHandNotation} (${exactVillain})
Board (${entry.streetReached}): ${board.length ? board.join(" ") : "Sin board"}
==================================================

[PR-EL]
${entry.analysisPrEl}

--------------------------------------------------

[ERR-01]
${entry.analysisErr01}

--------------------------------------------------

[OK-01]
${entry.analysisOk01}`;
  }

  exportMarkdown(ids?: number[]): string {
    const entries = ids?.length ? ids.map((id) => this.get(id)).sort((a, b) => a.eliminatedAt.localeCompare(b.eliminatedAt)) : [...this.list()].reverse();
    const entryBlocks = entries.map((entry) => this.canonical(entry));
    const batchRows = this.db.prepare("SELECT * FROM review_batches WHERE status = 'COMPLETED' ORDER BY completed_at, id").all() as Array<Record<string, unknown>>;
    const selectedSet = new Set(entries.map((entry) => entry.id));
    const reviewBlocks = batchRows.map(rowToReviewBatch).filter((batch) => {
      if (!ids?.length) return true;
      const linked = this.db.prepare("SELECT elimination_id FROM entry_review_checks WHERE review_batch_id = ?").all(batch.id) as Array<{ elimination_id: number }>;
      return linked.some((item) => selectedSet.has(item.elimination_id));
    }).map((batch) => {
      const checks = this.checksForBatch(batch.id);
      const hands = checks.length
        ? checks.map((check) => `- ENTRADA ${formatEntryNumber(check.elimination.id)} · ${check.elimination.tournamentName} · ${check.elimination.heroHandNotation} vs ${check.elimination.villainHandNotation}`).join("\n")
        : "- Sin manos vinculadas";
      return `## REVISIÓN ${String(batch.id).padStart(2, "0")}
Tipo: ${batch.triggerType === "FIVE_ENTRIES" ? "Cinco entradas" : "Ciclo de siete días"}
Completada: ${batch.completedAt ? formatCanonicalDate(batch.completedAt) : ""}

Patrón que se repite:
${batch.repeatingPattern}

Señal de alerta que ignoraste:
${batch.ignoredWarningSignal}

Regla concreta para tu próxima sesión:
${batch.nextSessionRule}

Manos del bloque:
${hands}`;
    });
    return [...entryBlocks, ...reviewBlocks].join("\n\n---\n\n");
  }

  private checksForBatch(batchId: number) {
    const checks = this.db.prepare(`
      SELECT erc.elimination_id, erc.review_batch_id, erc.checked_in_review, e.*
      FROM entry_review_checks erc
      JOIN eliminations e ON e.id = erc.elimination_id
      WHERE erc.review_batch_id = ?
      ORDER BY e.eliminated_at, e.id
    `).all(batchId) as Array<Record<string, unknown>>;
    return checks.map(rowToReviewCheck);
  }

  private revertBatch(batchId: number): void {
    const now = this.now().toISOString();
    this.db.prepare(`
      UPDATE eliminations SET review_batch_id = NULL, is_reviewed = 0, updated_at = ?
      WHERE review_batch_id = ?
    `).run(now, batchId);
    this.db.prepare("DELETE FROM entry_review_checks WHERE review_batch_id = ?").run(batchId);
    this.db.prepare("DELETE FROM review_batches WHERE id = ?").run(batchId);
  }

  private inputParams(input: EliminationInput, now: string) {
    return inputToParams(input, now, {
      hero: handNotation(input.heroCards),
      villain: input.villainCards === "UNKNOWN" ? "Desconocida" : handNotation(input.villainCards),
    });
  }

  private noteFirstCompletion(now: string): void {
    if (!this.store.getState("first_completed_at")) this.store.setState("first_completed_at", now);
  }

  private createReviewBatch(triggerType: ReviewBatch["triggerType"], ids: number[]): ReviewBatch {
    if (!ids.length) throw new DomainError("No se puede crear una revisión sin entradas");
    const transaction = this.db.transaction(() => {
      const now = this.now().toISOString();
      const result = this.db.prepare(`
        INSERT INTO review_batches (trigger_type, created_at, status) VALUES (?, ?, 'PENDING')
      `).run(triggerType, now);
      const batchId = Number(result.lastInsertRowid);
      const insertCheck = this.db.prepare(`
        INSERT INTO entry_review_checks (elimination_id, review_batch_id, checked_in_review) VALUES (?, ?, 0)
      `);
      const linkEntry = this.db.prepare("UPDATE eliminations SET review_batch_id = ?, updated_at = ? WHERE id = ?");
      for (const id of ids) {
        insertCheck.run(id, batchId);
        linkEntry.run(batchId, now, id);
      }
      const batch = this.getPendingBatch();
      if (!batch) throw new DomainError("No se pudo crear una revisión válida");
      return batch;
    });
    return transaction();
  }
}

function formatCanonicalDate(iso: string): string {
  const date = new Date(iso);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}`;
}

function dateBoundary(value: string, endOfDay: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError("El filtro de fecha no es válido");
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  if (Number.isNaN(date.getTime())) throw new DomainError("El filtro de fecha no es válido");
  return date.toISOString();
}
