import fs from "node:fs";
import path from "node:path";
import { LocalDatabase } from "../server/database.js";
import type { EliminationInput } from "../server/domain.js";

const temporaryRoot = path.join(process.env.LOCALAPPDATA ?? process.cwd(), "Temp", "opencode");

export function createTestStore(): { store: LocalDatabase; directory: string; cleanup: () => void } {
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "river-notes-test-"));
  const store = new LocalDatabase(path.join(directory, "eliminations.db"));
  return {
    store,
    directory,
    cleanup: () => {
      store.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function validInput(overrides: Partial<EliminationInput> = {}): EliminationInput {
  return {
    status: "COMPLETED",
    eliminatedAt: "2026-01-01T18:30:00.000Z",
    tournamentName: "Daily Deepstack",
    buyInAmount: 10,
    buyInCurrency: "USD",
    finishPosition: 11,
    heroStackBb: 17,
    heroPosition: "SB",
    villainPosition: "UTG",
    heroCards: ["9s", "9d"],
    villainCards: ["Ac", "Ah"],
    streetReached: "PREFLOP",
    boardFlop: null,
    boardTurn: null,
    boardRiver: null,
    analysisPrEl: "Presión antes de decidir.\nNecesitaba hacer una pausa.",
    analysisErr01: "Forcé una decisión sin revisar el rango.",
    analysisOk01: "Respirar, revisar posiciones y después actuar.",
    ...overrides,
  };
}
