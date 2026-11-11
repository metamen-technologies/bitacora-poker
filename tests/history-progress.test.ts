import { once } from "node:events";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createApiApp } from "../server/app.js";
import type { LocalDatabase } from "../server/database.js";
import type { Elimination, ReviewBatch } from "../server/domain.js";
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

async function jsonRequest<T>(url: string, init: RequestInit = {}): Promise<{ response: Response; body: T }> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  return { response, body: (await response.json()) as T };
}

function draftInput(overrides: Parameters<typeof validInput>[0] = {}) {
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

describe("historial completo, actividad y guardado de progreso", () => {
  it("1. devuelve todas las entradas por defecto con conteos coherentes y actividad", async () => {
    const fixture = createTestStore();
    const service = new EliminationService(fixture.store);
    const created: Elimination[] = [];
    for (let index = 0; index < 5; index += 1) {
      created.push(service.create(validInput({ tournamentName: `Entrada ${index + 1}` })));
    }
    const pending = service.getPendingBatch()!;
    for (const check of pending.checks!) service.setReviewCheck(pending.id, check.eliminationId, true);
    service.completeReview(pending.id, {
      repeatingPattern: "Patrón del bloque.",
      ignoredWarningSignal: "Señal del bloque.",
      nextSessionRule: "Regla del bloque.",
    });
    service.create(draftInput({ tournamentName: "Borrador visible" }));

    const api = await startApi(fixture.store);
    try {
      const all = await jsonRequest<{
        entries: Elimination[];
        counts: { total: number; drafts: number; pending: number; reviewed: number };
        activity: Array<{ date: string; total: number; pending: number; reviewed: number; drafts: number }>;
      }>(`${api.url}/api/eliminations`);
      expect(all.response.status).toBe(200);
      expect(all.body.entries).toHaveLength(6);
      expect(all.body.counts).toEqual({ total: 6, drafts: 1, pending: 0, reviewed: 5 });
      expect(all.body.entries.some((entry) => entry.status === "DRAFT")).toBe(true);
      expect(all.body.entries.filter((entry) => entry.isReviewed)).toHaveLength(5);

      const day = localDate(created[0].eliminatedAt);
      const activityDay = all.body.activity.find((item) => item.date === day);
      expect(activityDay).toMatchObject({ total: 6, drafts: 1, pending: 0, reviewed: 5 });

      const activity = await jsonRequest<{ days: Array<{ date: string; total: number }> }>(`${api.url}/api/activity`);
      expect(activity.response.status).toBe(200);
      expect(activity.body.days.find((item) => item.date === day)?.total).toBe(6);

      const history = await jsonRequest<{ batches: ReviewBatch[] }>(`${api.url}/api/reviews/history`);
      expect(history.response.status).toBe(200);
      expect(history.body.batches).toHaveLength(1);
      expect(history.body.batches[0]?.checks).toHaveLength(5);
      expect(history.body.batches[0]?.repeatingPattern).toBe("Patrón del bloque.");
      expect(history.body.batches[0]?.checks?.every((check) => check.checkedInReview)).toBe(true);

      const reviewed = await jsonRequest<{ entries: Elimination[]; counts: { total: number } }>(`${api.url}/api/eliminations?reviewStatus=REVIEWED`);
      expect(reviewed.body.entries).toHaveLength(5);
      expect(reviewed.body.counts.total).toBe(6);

      const drafts = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations?reviewStatus=DRAFT`);
      expect(drafts.body.entries).toHaveLength(1);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });

  it("2. guarda el progreso, crea backup-latest.json y permite restaurarlo", async () => {
    const fixture = createTestStore();
    const service = new EliminationService(fixture.store);
    service.create(draftInput({ tournamentName: "Borrador respaldado" }));
    const api = await startApi(fixture.store);
    try {
      const saved = await jsonRequest<{ savedAt: string; backupPath: string; bytes: number; counts: { total: number } }>(
        `${api.url}/api/progress/save`,
        { method: "POST" },
      );
      expect(saved.response.status).toBe(200);
      expect(saved.body.backupPath).toContain("backup-latest.json");
      expect(saved.body.bytes).toBeGreaterThan(0);
      expect(saved.body.counts.total).toBe(1);

      const backupFile = `${fixture.directory}/backup-latest.json`;
      expect(fs.existsSync(backupFile)).toBe(true);
      const snapshot = JSON.parse(fs.readFileSync(backupFile, "utf8")) as { entries: unknown[] };
      expect(snapshot.entries).toHaveLength(1);

      const download = await fetch(`${api.url}/api/progress/backup`);
      expect(download.status).toBe(200);
      expect(download.headers.get("content-disposition")).toContain("backup-latest.json");

      const second = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(draftInput({ tournamentName: "Entrada posterior al respaldo" })),
      });
      expect(second.response.status).toBe(201);

      const beforeRestore = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations`);
      expect(beforeRestore.body.entries).toHaveLength(2);

      const restored = await jsonRequest<{ message: string; counts: { entries: number } }>(
        `${api.url}/api/progress/restore`,
        { method: "POST" },
      );
      expect(restored.response.status).toBe(200);
      expect(restored.body.counts.entries).toBe(1);

      const afterRestore = await jsonRequest<{ entries: Elimination[] }>(`${api.url}/api/eliminations`);
      expect(afterRestore.body.entries).toHaveLength(1);
      expect(afterRestore.body.entries[0]?.tournamentName).toBe("Borrador respaldado");
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });

  it("3. repara un lote vacío al arrancar la API y no bloquea nuevas entradas", async () => {
    const fixture = createTestStore();
    fixture.store.db.prepare(`
      INSERT INTO review_batches (trigger_type, created_at, status)
      VALUES ('FIVE_ENTRIES', ?, 'PENDING')
    `).run(new Date().toISOString());
    const api = await startApi(fixture.store);
    try {
      const state = await jsonRequest<{ pendingBatch: ReviewBatch | null }>(`${api.url}/api/state`);
      expect(state.response.status).toBe(200);
      expect(state.body.pendingBatch).toBeNull();

      const pending = await jsonRequest<{ batch: ReviewBatch | null }>(`${api.url}/api/reviews/pending`);
      expect(pending.body.batch).toBeNull();

      const created = await jsonRequest<{ entry: Elimination }>(`${api.url}/api/eliminations`, {
        method: "POST",
        body: JSON.stringify(validInput({ tournamentName: "Entrada tras reparación" })),
      });
      expect(created.response.status).toBe(201);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });

  it("4. una fila corrupta no impide que la API devuelva el resto del historial", async () => {
    const fixture = createTestStore();
    const service = new EliminationService(fixture.store);
    service.create(validInput({ tournamentName: "Entrada sana" }));
    const draft = service.create(draftInput({ tournamentName: "Entrada corrupta" }));
    fixture.store.db.prepare("UPDATE eliminations SET hero_cards = '{roto' WHERE id = ?").run(draft.id);
    const api = await startApi(fixture.store);
    try {
      const result = await jsonRequest<{ entries: Elimination[]; counts: { total: number } }>(`${api.url}/api/eliminations`);
      expect(result.response.status).toBe(200);
      expect(result.body.entries).toHaveLength(2);
      expect(result.body.counts.total).toBe(2);
      expect(result.body.entries.find((entry) => entry.id === draft.id)?.heroCards).toEqual([]);
    } finally {
      await api.close();
      fixture.cleanup();
    }
  });
});
