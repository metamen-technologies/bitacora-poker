import { once } from "node:events";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createApiApp } from "../server/app.js";
import type { LocalDatabase } from "../server/database.js";
import type { Elimination, EliminationInput, ReviewBatch } from "../server/domain.js";
import { EliminationService } from "../server/service.js";
import { createTestStore, validInput } from "./helpers.js";

interface ApiServer {
  url: string;
  close: () => Promise<void>;
}

async function startApi(store: LocalDatabase): Promise<ApiServer> {
  const { app } = createApiApp(store);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  let closed = false;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    },
  };
}

async function jsonRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: T }> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  return { response, body: (await response.json()) as T };
}

function draftInput(overrides: Partial<EliminationInput> = {}): EliminationInput {
  return validInput({
    status: "DRAFT",
    finishPosition: null,
    analysisPrEl: "",
    analysisErr01: "",
    analysisOk01: "",
    ...overrides,
  });
}

function localDate(iso: string): string {
  const date = new Date(iso);
  const part = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

describe("API local", () => {
  it("activa la revisión al finalizar el quinto borrador y conserva el bloqueo tras reiniciar", async () => {
    const fixture = createTestStore();
    let api = await startApi(fixture.store);
    try {
      for (let index = 0; index < 4; index += 1) {
        const result = await jsonRequest<{ entry: Elimination; pendingBatch: ReviewBatch | null }>(
          `${api.url}/api/eliminations`,
          { method: "POST", body: JSON.stringify(validInput({ tournamentName: `Completa ${index + 1}` })) },
        );
        expect(result.response.status).toBe(201);
        expect(result.body.pendingBatch).toBeNull();
      }

      const draft = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(draftInput({ tournamentName: "Quinta entrada" })),
      });
      expect(draft.response.status).toBe(201);
      expect(draft.body.entry.status).toBe("DRAFT");

      const completed = await jsonRequest<{ entry: Elimination; pendingBatch: ReviewBatch }>(
        `${api.url}/api/eliminations/${draft.body.entry.id}`,
        { method: "PUT", body: JSON.stringify(validInput({ tournamentName: "Quinta entrada" })) },
      );
      expect(completed.response.status).toBe(200);
      expect(completed.body.pendingBatch.triggerType).toBe("FIVE_ENTRIES");
      expect(completed.body.pendingBatch.checks).toHaveLength(5);
      expect(completed.body.pendingBatch.checks?.every((check) => !check.checkedInReview)).toBe(true);
      const batchId = completed.body.pendingBatch.id;

      const blockedCompletion = await jsonRequest<{ error: string }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(validInput({ tournamentName: "No debe entrar" })),
      });
      expect(blockedCompletion.response.status).toBe(423);
      expect(blockedCompletion.body.error).toMatch(/revisión obligatoria|bloqueado/i);

      const draftDuringReview = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(draftInput({ tournamentName: "Borrador durante revisión" })),
      });
      expect(draftDuringReview.response.status).toBe(201);
      expect(draftDuringReview.body.entry.id).toBe(6);

      const blockedTransition = await jsonRequest<{ error: string }>(
        `${api.url}/api/eliminations/${draftDuringReview.body.entry.id}`,
        { method: "PUT", body: JSON.stringify(validInput({ tournamentName: "Borrador durante revisión" })) },
      );
      expect(blockedTransition.response.status).toBe(423);

      await api.close();
      fixture.store.close();
      fixture.store.reopen();
      api = await startApi(fixture.store);

      const state = await jsonRequest<{ pendingBatch: ReviewBatch | null }>(`${api.url}/api/state`);
      expect(state.response.status).toBe(200);
      expect(state.body.pendingBatch?.id).toBe(batchId);
      expect(state.body.pendingBatch?.checks).toHaveLength(5);

      const blockedAfterRestart = await jsonRequest<{ error: string }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(validInput({ tournamentName: "Sigue bloqueado" })),
      });
      expect(blockedAfterRestart.response.status).toBe(423);

      const draftAfterRestart = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(draftInput({ tournamentName: "Borrador tras reinicio" })),
      });
      expect(draftAfterRestart.response.status).toBe(201);
      expect(draftAfterRestart.body.entry.id).toBe(7);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });

  it("descarga y restaura copias JSON y SQLite conservando datos y secuencias", async () => {
    const fixture = createTestStore();
    const api = await startApi(fixture.store);
    try {
      const multiline = "Primera línea.\n\nTercera línea con acentos: decisión.";
      const created = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(validInput({ analysisPrEl: multiline })),
      });
      expect(created.response.status).toBe(201);
      expect(created.body.entry.id).toBe(1);

      const jsonResponse = await fetch(`${api.url}/api/backup/json`);
      expect(jsonResponse.status).toBe(200);
      expect(jsonResponse.headers.get("content-type")).toContain("application/json");
      const snapshot = await jsonResponse.json() as {
        schemaVersion: number;
        entries: Array<{ id: number; analysisPrEl: string }>;
        sequences: { eliminations: number; reviewBatches: number };
      };
      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.entries).toHaveLength(1);
      expect(snapshot.entries[0]?.analysisPrEl).toBe(multiline);
      expect(snapshot.sequences.eliminations).toBe(1);

      const sqliteResponse = await fetch(`${api.url}/api/backup/sqlite`);
      expect(sqliteResponse.status).toBe(200);
      expect(sqliteResponse.headers.get("content-disposition")).toContain("river-notes.db");
      const sqliteBytes = Buffer.from(await sqliteResponse.arrayBuffer());
      expect(sqliteBytes.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\u0000");

      const extra = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(draftInput({ tournamentName: "Se elimina al restaurar" })),
      });
      expect(extra.response.status).toBe(201);

      const jsonRestore = await jsonRequest<{ message: string; counts: { entries: number } }>(
        `${api.url}/api/backup/json/restore`,
        { method: "POST", body: JSON.stringify(snapshot) },
      );
      expect(jsonRestore.response.status).toBe(200);
      expect(jsonRestore.body.counts.entries).toBe(1);

      const afterJsonRestore = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations`);
      expect(afterJsonRestore.body.entries).toHaveLength(1);
      expect(afterJsonRestore.body.entries[0]?.id).toBe(1);

      const nextAfterJson = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(draftInput({ tournamentName: "Secuencia tras JSON" })),
      });
      expect(nextAfterJson.body.entry.id).toBe(2);

      const sqliteRestore = await jsonRequest<{ message: string }>(
        `${api.url}/api/backup/sqlite/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-sqlite3" },
          body: sqliteBytes,
        },
      );
      expect(sqliteRestore.response.status).toBe(200);
      expect(sqliteRestore.body.message).toMatch(/SQLite restaurada/i);

      const afterSqliteRestore = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations`);
      expect(afterSqliteRestore.body.entries).toHaveLength(1);
      expect(afterSqliteRestore.body.entries[0]?.id).toBe(1);

      const nextAfterSqlite = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(draftInput({ tournamentName: "Secuencia tras SQLite" })),
      });
      expect(nextAfterSqlite.body.entry.id).toBe(2);

      const leftovers = fs.readdirSync(fixture.directory).filter((name) =>
        name.startsWith("river-notes-download-") || name.startsWith(".upload-") || name.startsWith(".rollback-"),
      );
      expect(leftovers).toEqual([]);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });

  it("exporta el formato canónico con saltos de línea y combina filtros del historial", async () => {
    const fixture = createTestStore();
    const service = new EliminationService(fixture.store);
    const multiline = "Primera línea.\n\nTercera línea con acentos: decisión.";
    const first = service.create(validInput({
      tournamentName: "Daily Deepstack",
      eliminatedAt: "2026-01-01T18:30:00.000Z",
      analysisPrEl: multiline,
    }));
    const second = service.create(validInput({
      tournamentName: "Sunday Major",
      eliminatedAt: "2026-01-03T18:30:00.000Z",
      buyInAmount: 25,
      buyInCurrency: "EUR",
    }));
    const third = service.create(draftInput({
      tournamentName: "Daily Deepstack",
      eliminatedAt: "2026-01-02T18:30:00.000Z",
    }));

    const api = await startApi(fixture.store);
    try {
      const detail = await jsonRequest<{ entry: Elimination; canonical: string }>(
        `${api.url}/api/eliminations/${first.id}`,
      );
      expect(detail.response.status).toBe(200);
      expect(detail.body.canonical).toContain("### ENTRADA 01");
      expect(detail.body.canonical).toContain(multiline);
      expect(detail.body.canonical).toContain("Mano Héroe: 99 (9s 9d)");
      expect(detail.body.canonical).toContain("[STATUS: ELIMINATED]");
      expect(detail.body.canonical).toContain("[PR-EL]");

      const markdown = await fetch(`${api.url}/api/export/markdown?ids=${first.id}`);
      expect(markdown.status).toBe(200);
      expect(markdown.headers.get("content-type")).toContain("text/markdown");
      expect(markdown.headers.get("content-disposition")).toContain(".md");
      const markdownText = await markdown.text();
      expect(markdownText).toContain(multiline);
      expect(markdownText).toContain("### ENTRADA 01");
      expect(markdownText).not.toContain("### ENTRADA 02");

      const localFirstDate = localDate(first.eliminatedAt);
      const combined = await jsonRequest<{ entries: Elimination[] }>(
        `${api.url}/api/eliminations?search=daily&currency=usd&reviewStatus=PENDING&dateFrom=${localFirstDate}&dateTo=${localFirstDate}`,
      );
      expect(combined.body.entries.map((entry) => entry.id)).toEqual([first.id]);

      const byTournament = await jsonRequest<{ entries: Elimination[]; tournaments: string[] }>(
        `${api.url}/api/eliminations?tournament=${encodeURIComponent("Daily Deepstack")}`,
      );
      expect(byTournament.body.entries.map((entry) => entry.id).sort()).toEqual([first.id, third.id].sort());
      expect(byTournament.body.tournaments).toEqual(["Daily Deepstack", "Sunday Major"]);

      const drafts = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations?reviewStatus=DRAFT`);
      expect(drafts.body.entries.map((entry) => entry.id)).toEqual([third.id]);

      const byBuyIn = await jsonRequest<{ entries: Elimination[] }>(
        `${api.url}/api/eliminations?buyInAmount=25&currency=EUR&reviewStatus=PENDING`,
      );
      expect(byBuyIn.body.entries.map((entry) => entry.id)).toEqual([second.id]);

      const chronological = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations`);
      expect(chronological.body.entries.map((entry) => entry.id)).toEqual([second.id, third.id, first.id]);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });

  it("responde en español ante filtros, cuerpos y copias inválidas", async () => {
    const fixture = createTestStore();
    const api = await startApi(fixture.store);
    try {
      const badBuyIn = await jsonRequest<{ error: string }>(`${api.url}/api/eliminations?buyInAmount=abc`);
      expect(badBuyIn.response.status).toBe(400);
      expect(badBuyIn.body.error).toMatch(/Buy-in/i);

      const badStatus = await jsonRequest<{ error: string }>(`${api.url}/api/eliminations?reviewStatus=OTRO`);
      expect(badStatus.response.status).toBe(400);
      expect(badStatus.body.error).toMatch(/revisión/i);

      const badDate = await jsonRequest<{ error: string }>(`${api.url}/api/eliminations?dateFrom=2026-13-01`);
      expect(badDate.response.status).toBe(400);

      const badJson = await fetch(`${api.url}/api/eliminations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{no es json",
      });
      expect(badJson.status).toBe(400);
      expect(await badJson.json()).toEqual({ error: "El cuerpo JSON no es válido" });

      const badSnapshot = await jsonRequest<{ error: string }>(`${api.url}/api/backup/json/restore`, {
        method: "POST",
        body: JSON.stringify({ schemaVersion: 1 }),
      });
      expect(badSnapshot.response.status).toBe(400);
      expect(badSnapshot.body.error).toMatch(/copia JSON/i);

      const badSqlite = await fetch(`${api.url}/api/backup/sqlite/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/x-sqlite3" },
        body: Buffer.from("esto no es una base SQLite"),
      });
      expect(badSqlite.status).toBe(400);
      const badSqliteBody = await badSqlite.json() as { error: string };
      expect(badSqliteBody.error).toMatch(/SQLite/i);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });

  it("exige todas las marcas y las tres conclusiones antes de cerrar la revisión", async () => {
    const fixture = createTestStore();
    const service = new EliminationService(fixture.store);
    for (let index = 0; index < 5; index += 1) {
      service.create(validInput({ tournamentName: `Entrada ${index + 1}` }));
    }
    const pending = service.getPendingBatch();
    expect(pending?.triggerType).toBe("FIVE_ENTRIES");

    const api = await startApi(fixture.store);
    try {
      const pendingResponse = await jsonRequest<{ batch: ReviewBatch }>(`${api.url}/api/reviews/pending`);
      expect(pendingResponse.body.batch.id).toBe(pending!.id);
      expect(pendingResponse.body.batch.checks).toHaveLength(5);

      const firstCheck = pending!.checks![0];
      const marked = await jsonRequest<{ batch: ReviewBatch }>(
        `${api.url}/api/reviews/${pending!.id}/checks/${firstCheck.eliminationId}`,
        { method: "PATCH", body: JSON.stringify({ checked: true }) },
      );
      expect(marked.response.status).toBe(200);
      expect(marked.body.batch.checks?.find((check) => check.eliminationId === firstCheck.eliminationId)?.checkedInReview).toBe(true);

      const incompleteChecks = await jsonRequest<{ error: string }>(
        `${api.url}/api/reviews/${pending!.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            repeatingPattern: "Decido con prisa.",
            ignoredWarningSignal: "Tensión en el cuerpo.",
            nextSessionRule: "Pausar diez segundos.",
          }),
        },
      );
      expect(incompleteChecks.response.status).toBe(400);
      expect(incompleteChecks.body.error).toMatch(/marcar cada entrada/i);

      for (const check of pending!.checks!.slice(1)) {
        const response = await fetch(
          `${api.url}/api/reviews/${pending!.id}/checks/${check.eliminationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checked: true }),
          },
        );
        expect(response.status).toBe(200);
      }

      const incompleteSynthesis = await jsonRequest<{ error: string }>(
        `${api.url}/api/reviews/${pending!.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ repeatingPattern: "Decido con prisa.", ignoredWarningSignal: "   " }),
        },
      );
      expect(incompleteSynthesis.response.status).toBe(400);
      expect(incompleteSynthesis.body.error).toMatch(/tres conclusiones/i);

      const synthesis = {
        repeatingPattern: "Decido con prisa cuando el stack baja.",
        ignoredWarningSignal: "Tensión en el cuerpo antes de comprometer fichas.",
        nextSessionRule: "Pausar diez segundos antes de actuar en cada decisión.",
      };
      const completed = await jsonRequest<{ batch: ReviewBatch }>(
        `${api.url}/api/reviews/${pending!.id}/complete`,
        { method: "POST", body: JSON.stringify(synthesis) },
      );
      expect(completed.response.status).toBe(200);
      expect(completed.body.batch.status).toBe("COMPLETED");
      expect(completed.body.batch.repeatingPattern).toBe(synthesis.repeatingPattern);

      const state = await jsonRequest<{ pendingBatch: ReviewBatch | null; counts: { reviewed: number; pending: number } }>(
        `${api.url}/api/state`,
      );
      expect(state.body.pendingBatch).toBeNull();
      expect(state.body.counts.reviewed).toBe(5);
      expect(state.body.counts.pending).toBe(0);

      const unlocked = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(validInput({ tournamentName: "Sexta entrada" })),
      });
      expect(unlocked.response.status).toBe(201);
      expect(unlocked.body.entry.id).toBe(6);

      const markdown = await fetch(`${api.url}/api/export/markdown`);
      expect(markdown.status).toBe(200);
      const text = await markdown.text();
      expect(text).toContain("## REVISIÓN 01");
      expect(text).toContain("Tipo: Cinco entradas");
      expect(text).toContain(synthesis.repeatingPattern);
      expect(text).toContain(synthesis.ignoredWarningSignal);
      expect(text).toContain(synthesis.nextSessionRule);

      const allEntries = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations`);
      expect(allEntries.body.entries).toHaveLength(6);
      expect(allEntries.body.entries.filter((entry) => entry.isReviewed)).toHaveLength(5);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });
});
