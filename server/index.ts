import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import open from "open";
import { createApiApp } from "./app.js";
import { LocalDatabase } from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const databasePath = process.env.DATABASE_PATH ?? path.join(root, "data", "eliminations.db");
const store = new LocalDatabase(databasePath);
const { app, service } = createApiApp(store);

service.auditAndRepair();
service.evaluateReviewState();

if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(root, "dist"))) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*splat}", (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true, hmr: { host: "127.0.0.1" } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const host = "127.0.0.1";
const port = 3000;
const server = app.listen(port, host, async () => {
  const url = `http://${host}:${port}`;
  console.log(`River Notes está disponible exclusivamente en ${url}`);
  if (process.env.OPEN_BROWSER !== "0" && process.env.NODE_ENV !== "test") {
    await open(url);
  }
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
