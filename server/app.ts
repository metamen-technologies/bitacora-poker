import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { EliminationService, DomainError, type HistoryFilters } from "./service.js";
import type { LocalDatabase } from "./database.js";
import fs from "node:fs";
import path from "node:path";
import { createSnapshot, latestBackupPath, readLatestBackup, replaceWithSqliteBackup, restoreSnapshot, writeLatestBackup } from "./backup.js";

export function createApiApp(store: LocalDatabase) {
  const app = express();
  const service = new EliminationService(store);
  service.auditAndRepair();

  app.disable("x-powered-by");
  app.use("/api", express.json({ limit: "50mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, local: true });
  });

  app.get("/api/state", (_request, response) => {
    response.json(service.appSummary());
  });

  app.get("/api/eliminations", (request, response) => {
    const reviewStatus = textQuery(request.query.reviewStatus);
    if (reviewStatus && !["REVIEWED", "PENDING", "DRAFT"].includes(reviewStatus)) {
      throw new DomainError("El filtro de revisión no es válido");
    }
    const filters: HistoryFilters = {
      search: textQuery(request.query.search),
      tournament: textQuery(request.query.tournament),
      dateFrom: textQuery(request.query.dateFrom),
      dateTo: textQuery(request.query.dateTo),
      buyInAmount: numberQuery(request.query.buyInAmount, "El filtro de Buy-in no es válido"),
      currency: textQuery(request.query.currency),
      reviewStatus: reviewStatus as HistoryFilters["reviewStatus"],
    };
    response.json({
      entries: service.list(filters),
      tournaments: service.listTournaments(),
      counts: service.counts(),
      activity: service.activity(),
    });
  });

  app.get("/api/activity", (_request, response) => {
    response.json({ days: service.activity(), counts: service.counts() });
  });

  app.get("/api/reviews/history", (_request, response) => {
    response.json({ batches: service.reviewHistory() });
  });

  app.get("/api/eliminations/:id", (request, response) => {
    const entry = service.get(numericId(request.params.id));
    response.json({ entry, canonical: service.canonical(entry) });
  });

  app.post("/api/eliminations", (request, response) => {
    const entry = service.create(request.body);
    response.status(201).json({ entry, pendingBatch: service.getPendingBatch() });
  });

  app.put("/api/eliminations/:id", (request, response) => {
    const entry = service.update(numericId(request.params.id), request.body);
    response.json({ entry, pendingBatch: service.getPendingBatch() });
  });

  app.delete("/api/eliminations/:id", (request, response) => {
    service.delete(numericId(request.params.id));
    response.status(204).end();
  });

  app.get("/api/reviews/pending", (_request, response) => {
    response.json({ batch: service.evaluateReviewState() });
  });

  app.patch("/api/reviews/:batchId/checks/:eliminationId", (request, response) => {
    const batch = service.setReviewCheck(
      numericId(request.params.batchId),
      numericId(request.params.eliminationId),
      Boolean(request.body.checked),
    );
    response.json({ batch });
  });

  app.post("/api/reviews/:batchId/complete", (request, response) => {
    const batch = service.completeReview(numericId(request.params.batchId), request.body);
    response.json({ batch });
  });

  app.get("/api/export/markdown", (request, response) => {
    const ids = textQuery(request.query.ids)?.split(",").filter(Boolean).map(Number);
    const markdown = service.exportMarkdown(ids);
    response.setHeader("Content-Type", "text/markdown; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="river-notes.md"');
    response.send(markdown);
  });

  app.get("/api/backup/json", (_request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="river-notes-backup.json"');
    response.send(JSON.stringify(createSnapshot(store), null, 2));
  });

  app.post("/api/backup/json/restore", (request, response) => {
    const snapshot = restoreSnapshot(store, request.body);
    service.auditAndRepair();
    const pendingBatch = service.evaluateReviewState();
    response.json({
      message: "Copia JSON restaurada correctamente",
      counts: { entries: snapshot.entries.length, reviews: snapshot.reviewBatches.length },
      pendingBatch,
    });
  });

  app.post("/api/progress/save", (_request, response) => {
    const checkpoint = store.db.pragma("wal_checkpoint(FULL)");
    const backup = writeLatestBackup(store);
    response.json({
      savedAt: new Date().toISOString(),
      checkpoint,
      backupPath: backup.relativePath,
      bytes: backup.bytes,
      counts: service.counts(),
    });
  });

  app.get("/api/progress/backup", (_request, response) => {
    const filePath = latestBackupPath(store);
    if (!fs.existsSync(filePath)) writeLatestBackup(store);
    response.download(filePath, "backup-latest.json");
  });

  app.post("/api/progress/restore", (_request, response) => {
    const snapshot = readLatestBackup(store);
    restoreSnapshot(store, snapshot);
    service.auditAndRepair();
    const pendingBatch = service.evaluateReviewState();
    response.json({
      message: "Último respaldo restaurado correctamente",
      counts: { entries: snapshot.entries.length, reviews: snapshot.reviewBatches.length },
      pendingBatch,
    });
  });

  app.get("/api/backup/sqlite", async (_request, response, next) => {
    // No usar un nombre que empiece por punto: Express/send lo considera un archivo oculto.
    const temporaryPath = path.join(path.dirname(store.filePath), `river-notes-download-${Date.now()}.db`);
    try {
      await store.db.backup(temporaryPath);
      response.download(temporaryPath, "river-notes.db", (error) => {
        fs.rmSync(temporaryPath, { force: true });
        if (error && !response.headersSent) next(error);
      });
    } catch (error) {
      fs.rmSync(temporaryPath, { force: true });
      next(error);
    }
  });

  app.post(
    "/api/backup/sqlite/restore",
    express.raw({ type: ["application/x-sqlite3", "application/octet-stream"], limit: "250mb" }),
    (request, response) => {
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) throw new DomainError("Selecciona una copia SQLite válida");
      const uploadedPath = path.join(path.dirname(store.filePath), `.upload-${Date.now()}.db`);
      try {
        fs.writeFileSync(uploadedPath, request.body);
        replaceWithSqliteBackup(store, uploadedPath);
        service.auditAndRepair();
        const pendingBatch = service.evaluateReviewState();
        response.json({ message: "Copia SQLite restaurada correctamente", pendingBatch });
      } finally {
        fs.rmSync(uploadedPath, { force: true });
      }
    },
  );

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "Ruta local no encontrada" });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "Revisa los datos de la entrada",
        issues: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
      });
      return;
    }
    if (error instanceof DomainError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "El cuerpo JSON no es válido" });
      return;
    }
    if (isPayloadTooLarge(error)) {
      response.status(413).json({ error: "La copia es demasiado grande para restaurarla" });
      return;
    }
    console.error(error);
    response.status(500).json({ error: "Ocurrió un error local inesperado" });
  });

  return { app, service };
}

function numericId(value: string | string[] | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new DomainError("Identificador no válido");
  return id;
}

function textQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function numberQuery(value: unknown, message: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new DomainError(message);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new DomainError(message);
  return number;
}

function isPayloadTooLarge(error: unknown): boolean {
  return typeof error === "object" && error !== null && "type" in error && (error as { type?: string }).type === "entity.too.large";
}
