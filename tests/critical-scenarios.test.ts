import { describe, expect, it } from "vitest";
import { createSnapshot, restoreSnapshot } from "../server/backup.js";
import { handNotation } from "../server/domain.js";
import { EliminationService } from "../server/service.js";
import { LocalDatabase } from "../server/database.js";
import { createTestStore, validInput } from "./helpers.js";

describe("escenarios críticos de integridad", () => {
  it("1. rechaza cartas duplicadas en el backend", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      expect(() => service.create(validInput({
        heroCards: ["Ah", "Kd"],
        villainCards: ["Qs", "Qc"],
        streetReached: "FLOP",
        boardFlop: ["Ah", "2c", "3d"],
      }))).toThrow(/Ah está repetida/);
    } finally { fixture.cleanup(); }
  });

  it("2. genera notación exacta sin sufijo para parejas y ordena rangos distintos", () => {
    expect(handNotation(["9c", "9d"])).toBe("99");
    expect(handNotation(["9h", "Ah"])).toBe("A9s");
    expect(handNotation(["Kd", "As"])).toBe("AKo");
  });

  it("3. conserva entradas completadas y borradores al reabrir SQLite", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      service.create(validInput());
      service.create(validInput({ status: "DRAFT", finishPosition: null, analysisPrEl: "", analysisErr01: "", analysisOk01: "" }));
      fixture.store.close();

      const reopened = new LocalDatabase(`${fixture.directory}/eliminations.db`);
      try {
        const persisted = new EliminationService(reopened).list();
        expect(persisted).toHaveLength(2);
        expect(persisted.map((entry) => entry.status).sort()).toEqual(["COMPLETED", "DRAFT"]);
      } finally { reopened.close(); }
    } finally { fixture.cleanup(); }
  });

  it("4. activa exactamente un bloque al completar la quinta entrada, ignorando borradores", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      for (let index = 0; index < 4; index += 1) service.create(validInput({ tournamentName: `Completa ${index + 1}` }));
      for (let index = 0; index < 3; index += 1) service.create(validInput({ status: "DRAFT", finishPosition: null, tournamentName: `Borrador ${index + 1}`, analysisPrEl: "", analysisErr01: "", analysisOk01: "" }));
      expect(service.getPendingBatch()).toBeNull();

      service.create(validInput({ tournamentName: "Completa 5" }));
      const pending = service.getPendingBatch();
      expect(pending?.triggerType).toBe("FIVE_ENTRIES");
      expect(pending?.checks).toHaveLength(5);
      const batches = fixture.store.db.prepare("SELECT COUNT(*) AS count FROM review_batches WHERE status = 'PENDING'").get() as { count: number };
      expect(batches.count).toBe(1);
    } finally { fixture.cleanup(); }
  });

  it("5. editar una entrada completada es idempotente y no duplica el contador", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      const first = service.create(validInput());
      service.update(first.id, validInput({ tournamentName: "Nombre corregido", analysisErr01: "Texto corregido\ncon otra línea." }));
      expect(service.list()).toHaveLength(1);
      expect(service.get(first.id).tournamentName).toBe("Nombre corregido");
      expect(service.getPendingBatch()).toBeNull();
    } finally { fixture.cleanup(); }
  });

  it("6. mantiene el bloqueo tras reiniciar, permite borradores y desbloquea al revisar", () => {
    const fixture = createTestStore();
    try {
      let service = new EliminationService(fixture.store);
      for (let index = 0; index < 5; index += 1) service.create(validInput({ tournamentName: `Entrada ${index + 1}` }));
      fixture.store.close();
      fixture.store.reopen();
      service = new EliminationService(fixture.store);
      const pending = service.evaluateReviewState();
      expect(pending).not.toBeNull();

      const draft = service.create(validInput({ status: "DRAFT", finishPosition: null, tournamentName: "Borrador durante bloqueo", analysisPrEl: "", analysisErr01: "", analysisOk01: "" }));
      expect(draft.status).toBe("DRAFT");
      expect(() => service.update(draft.id, validInput({ tournamentName: draft.tournamentName }))).toThrow(/bloqueado/i);

      for (const check of pending!.checks!) service.setReviewCheck(pending!.id, check.eliminationId, true);
      service.completeReview(pending!.id, {
        repeatingPattern: "Decido con prisa.",
        ignoredWarningSignal: "Tensión en el cuerpo.",
        nextSessionRule: "Pausar diez segundos antes de comprometer el Stack.",
      });
      expect(service.update(draft.id, validInput({ tournamentName: draft.tournamentName })).status).toBe("COMPLETED");
    } finally { fixture.cleanup(); }
  });

  it("7. no reutiliza ENTRADA 03 y exporta texto completo y secuencias", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      const multiline = "Primera línea.\n\nTercera línea con acentos: decisión.";
      service.create(validInput({ status: "DRAFT", finishPosition: null, analysisPrEl: "", analysisErr01: "", analysisOk01: "" }));
      service.create(validInput({ status: "DRAFT", finishPosition: null, analysisPrEl: "", analysisErr01: "", analysisOk01: "" }));
      const third = service.create(validInput({ status: "DRAFT", finishPosition: null, analysisPrEl: multiline, analysisErr01: "", analysisOk01: "" }));
      expect(third.id).toBe(3);
      service.delete(third.id);
      const fourth = service.create(validInput({ status: "DRAFT", finishPosition: null, analysisPrEl: multiline, analysisErr01: "", analysisOk01: "" }));
      expect(fourth.id).toBe(4);
      expect(service.exportMarkdown([fourth.id])).toContain(multiline);

      const snapshot = createSnapshot(fixture.store);
      expect(snapshot.entries.find((entry) => entry.id === fourth.id)?.analysisPrEl).toBe(multiline);
      expect(snapshot.sequences.eliminations).toBe(4);
      restoreSnapshot(fixture.store, snapshot);
      const afterRestore = service.create(validInput({ status: "DRAFT", finishPosition: null, analysisPrEl: "", analysisErr01: "", analysisOk01: "" }));
      expect(afterRestore.id).toBe(5);
    } finally { fixture.cleanup(); }
  });

  it("activa el ciclo de siete días con al menos una entrada pendiente", () => {
    const fixture = createTestStore();
    try {
      let current = new Date("2026-01-01T12:00:00.000Z");
      const service = new EliminationService(fixture.store, () => current);
      service.create(validInput());
      current = new Date("2026-01-08T12:00:01.000Z");
      const pending = service.evaluateReviewState();
      expect(pending?.triggerType).toBe("SEVEN_DAYS");
      expect(pending?.checks).toHaveLength(1);
    } finally { fixture.cleanup(); }
  });

  it("no activa el ciclo de siete días antes del plazo exacto", () => {
    const fixture = createTestStore();
    try {
      let current = new Date("2026-01-01T12:00:00.000Z");
      const service = new EliminationService(fixture.store, () => current);
      service.create(validInput());
      current = new Date("2026-01-08T11:59:59.999Z");
      expect(service.evaluateReviewState()).toBeNull();
      current = new Date("2026-01-08T12:00:00.000Z");
      expect(service.evaluateReviewState()?.triggerType).toBe("SEVEN_DAYS");
    } finally { fixture.cleanup(); }
  });

  it("incluye todas las entradas completadas pendientes si una copia restaurada trae más de cinco", () => {
    const fixture = createTestStore();
    try {
      const service = new EliminationService(fixture.store);
      for (let index = 0; index < 5; index += 1) service.create(validInput({ tournamentName: `Entrada ${index + 1}` }));
      const snapshot = createSnapshot(fixture.store);
      snapshot.reviewBatches = [];
      snapshot.reviewChecks = [];
      snapshot.entries = snapshot.entries.map((entry) => ({ ...entry, isReviewed: false, reviewBatchId: null }));
      snapshot.entries.push({ ...snapshot.entries[0], id: 6, tournamentName: "Entrada restaurada 6" });
      snapshot.sequences.eliminations = 6;
      restoreSnapshot(fixture.store, snapshot);

      const pending = service.evaluateReviewState();
      expect(pending?.triggerType).toBe("FIVE_ENTRIES");
      expect(pending?.checks).toHaveLength(6);
    } finally { fixture.cleanup(); }
  });
});
