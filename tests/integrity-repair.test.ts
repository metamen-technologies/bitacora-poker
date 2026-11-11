import { describe, expect, it } from "vitest";
import { EliminationService } from "../server/service.js";
import { createTestStore, validInput } from "./helpers.js";

describe("autorreparación de integridad", () => {
  it("1. un lote PENDING vacío nunca bloquea y se revierte al sanear", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      fixture.store.db.prepare(`
        INSERT INTO review_batches (trigger_type, created_at, status)
        VALUES ('FIVE_ENTRIES', ?, 'PENDING')
      `).run(new Date().toISOString());

      expect(service.getPendingBatch()).toBeNull();
      const report = service.auditAndRepair();
      expect(report.revertedBatches).toBe(1);
      expect(service.getPendingBatch()).toBeNull();
      expect(service.evaluateReviewState()).toBeNull();

      const entry = service.create(validInput());
      expect(entry.status).toBe("COMPLETED");
      expect(service.counts().total).toBe(1);
    } finally { fixture.cleanup(); }
  });

  it("2. revincula entradas COMPLETED sin marcas hasta completar las cinco", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      for (let index = 0; index < 5; index += 1) service.create(validInput({ tournamentName: `Entrada ${index + 1}` }));
      const pending = service.getPendingBatch();
      expect(pending?.checks).toHaveLength(5);

      const detached = pending!.checks!.slice(0, 2).map((check) => check.eliminationId);
      fixture.store.db.prepare(`
        DELETE FROM entry_review_checks WHERE review_batch_id = ? AND elimination_id IN (?, ?)
      `).run(pending!.id, detached[0], detached[1]);
      fixture.store.db.prepare(`
        UPDATE eliminations SET review_batch_id = NULL WHERE id IN (?, ?)
      `).run(detached[0], detached[1]);

      const report = service.auditAndRepair();
      expect(report.relinkedChecks).toBeGreaterThanOrEqual(2);
      const repaired = service.getPendingBatch();
      expect(repaired?.id).toBe(pending!.id);
      expect(repaired?.checks).toHaveLength(5);
      expect(repaired?.checks?.map((check) => check.eliminationId).sort()).toEqual(
        pending!.checks!.map((check) => check.eliminationId).sort(),
      );
    } finally { fixture.cleanup(); }
  });

  it("3. revierte un lote de cinco entradas que quedó con menos manos reales", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      const entries = [];
      for (let index = 0; index < 5; index += 1) entries.push(service.create(validInput({ tournamentName: `Entrada ${index + 1}` })));
      const pending = service.getPendingBatch();
      expect(pending?.checks).toHaveLength(5);

      fixture.store.db.prepare("DELETE FROM eliminations WHERE id IN (?, ?)").run(entries[0].id, entries[1].id);
      const report = service.auditAndRepair();
      expect(report.revertedBatches).toBe(1);
      expect(service.getPendingBatch()).toBeNull();
      expect(service.evaluateReviewState()).toBeNull();
      expect(service.list()).toHaveLength(3);
      expect(service.list().every((entry) => entry.reviewBatchId === null && !entry.isReviewed)).toBe(true);
    } finally { fixture.cleanup(); }
  });

  it("4. normaliza una entrada marcada como revisada sin bloque asociado", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      const entry = service.create(validInput());
      fixture.store.db.prepare("UPDATE eliminations SET is_reviewed = 1, review_batch_id = NULL WHERE id = ?").run(entry.id);
      service.auditAndRepair();
      const repaired = service.get(entry.id);
      expect(repaired.isReviewed).toBe(false);
      expect(repaired.reviewBatchId).toBeNull();
    } finally { fixture.cleanup(); }
  });

  it("5. una fila con JSON corrupto no rompe el listado ni el contador", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      service.create(validInput({ tournamentName: "Entrada sana" }));
      const draft = service.create(validInput({
        status: "DRAFT",
        finishPosition: null,
        tournamentName: "Entrada con JSON roto",
        analysisPrEl: "",
        analysisErr01: "",
        analysisOk01: "",
      }));
      fixture.store.db.prepare(`
        UPDATE eliminations SET hero_cards = '{roto', villain_cards = '{roto', board_flop = '{roto' WHERE id = ?
      `).run(draft.id);

      expect(() => service.list()).not.toThrow();
      const list = service.list();
      expect(list).toHaveLength(2);
      const broken = list.find((entry) => entry.id === draft.id);
      expect(broken?.heroCards).toEqual([]);
      expect(broken?.villainCards).toBe("UNKNOWN");
      expect(broken?.boardFlop).toBeNull();
      expect(service.counts().total).toBe(2);
    } finally { fixture.cleanup(); }
  });

  it("6. conserva un bloque completado sin marcas y lo muestra con sus conclusiones", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      for (let index = 0; index < 5; index += 1) service.create(validInput({ tournamentName: `Entrada ${index + 1}` }));
      const pending = service.getPendingBatch()!;
      for (const check of pending.checks!) service.setReviewCheck(pending.id, check.eliminationId, true);
      service.completeReview(pending.id, {
        repeatingPattern: "Patrón conservado.",
        ignoredWarningSignal: "Señal conservada.",
        nextSessionRule: "Regla conservada.",
      });

      fixture.store.db.prepare("DELETE FROM entry_review_checks WHERE review_batch_id = ?").run(pending.id);
      const history = service.reviewHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.repeatingPattern).toBe("Patrón conservado.");
      expect(history[0]?.checks).toHaveLength(0);
      service.auditAndRepair();
      const repairedHistory = service.reviewHistory();
      expect(repairedHistory).toHaveLength(1);
      expect(repairedHistory[0]?.checks).toHaveLength(5);
      expect(repairedHistory[0]?.checks?.every((check) => check.checkedInReview)).toBe(true);
    } finally { fixture.cleanup(); }
  });
});
