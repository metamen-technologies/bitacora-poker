import { z } from "zod";

z.config(z.locales.es());

export const POSITIONS = ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"] as const;
export const STREETS = ["PREFLOP", "FLOP", "TURN", "RIVER"] as const;
export const STATUSES = ["DRAFT", "COMPLETED"] as const;
export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export type Position = (typeof POSITIONS)[number];
export type Street = (typeof STREETS)[number];
export type EntryStatus = (typeof STATUSES)[number];
export type Card = `${(typeof RANKS)[number]}${(typeof SUITS)[number]}`;
export type VillainCards = Card[] | "UNKNOWN";

export interface EliminationInput {
  status: EntryStatus;
  eliminatedAt: string;
  tournamentName: string;
  buyInAmount: number;
  buyInCurrency: string;
  finishPosition: number | null;
  heroStackBb: number;
  heroPosition: Position;
  villainPosition: Position;
  heroCards: Card[];
  villainCards: VillainCards;
  streetReached: Street;
  boardFlop: Card[] | null;
  boardTurn: Card | null;
  boardRiver: Card | null;
  analysisPrEl: string;
  analysisErr01: string;
  analysisOk01: string;
}

export interface Elimination extends EliminationInput {
  id: number;
  createdAt: string;
  updatedAt: string;
  heroHandNotation: string;
  villainHandNotation: string;
  isReviewed: boolean;
  reviewBatchId: number | null;
}

export interface ReviewCheck {
  eliminationId: number;
  reviewBatchId: number;
  checkedInReview: boolean;
  elimination: Elimination;
}

export interface ReviewBatch {
  id: number;
  triggerType: "FIVE_ENTRIES" | "SEVEN_DAYS";
  createdAt: string;
  completedAt: string | null;
  status: "PENDING" | "COMPLETED";
  repeatingPattern: string;
  ignoredWarningSignal: string;
  nextSessionRule: string;
  checks?: ReviewCheck[];
}

const cardSchema = z.string().regex(/^[AKQJT98765432][shdc]$/, "Carta no válida") as z.ZodType<Card>;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export const isoDateTimeSchema = z
  .string()
  .regex(ISO_DATE_TIME_PATTERN, "Usa una fecha y hora ISO-8601")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Fecha y hora no válidas")
  .transform((value) => new Date(value).toISOString());

export const eliminationInputSchema = z.object({
  status: z.enum(STATUSES),
  eliminatedAt: isoDateTimeSchema,
  tournamentName: z.string().trim().min(1, "Escribe el nombre del torneo").max(200),
  buyInAmount: z.number().finite().min(0, "El Buy-in no puede ser negativo"),
  buyInCurrency: z.string().trim().min(1).max(8).transform((value) => value.toUpperCase()),
  finishPosition: z.number().int().positive().nullable(),
  heroStackBb: z.number().finite().positive("El Stack debe ser mayor que cero"),
  heroPosition: z.enum(POSITIONS),
  villainPosition: z.enum(POSITIONS),
  heroCards: z.array(cardSchema).length(2, "Selecciona exactamente 2 cartas para el héroe"),
  villainCards: z.union([
    z.literal("UNKNOWN"),
    z.array(cardSchema).length(2, "Selecciona exactamente 2 cartas para el villano"),
  ]),
  streetReached: z.enum(STREETS),
  boardFlop: z.array(cardSchema).length(3).nullable(),
  boardTurn: cardSchema.nullable(),
  boardRiver: cardSchema.nullable(),
  analysisPrEl: z.string().max(100_000),
  analysisErr01: z.string().max(100_000),
  analysisOk01: z.string().max(100_000),
}).superRefine((value, context) => {
  if (value.status === "COMPLETED") {
    if (value.finishPosition === null) {
      context.addIssue({ code: "custom", path: ["finishPosition"], message: "La posición final es obligatoria" });
    }
    const analyses: Array<[keyof EliminationInput, string]> = [
      ["analysisPrEl", "Completa [PR-EL] Estado mental previo"],
      ["analysisErr01", "Completa [ERR-01] Error crítico"],
      ["analysisOk01", "Completa [OK-01] Línea correcta / revisión"],
    ];
    for (const [field, message] of analyses) {
      if (!(value[field] as string).trim()) {
        context.addIssue({ code: "custom", path: [field], message });
      }
    }
  }

  if (value.streetReached === "PREFLOP" && (value.boardFlop || value.boardTurn || value.boardRiver)) {
    context.addIssue({ code: "custom", path: ["boardFlop"], message: "Una mano Preflop no puede tener Board" });
  }
  if (value.streetReached === "FLOP" && (!value.boardFlop || value.boardTurn || value.boardRiver)) {
    context.addIssue({ code: "custom", path: ["boardFlop"], message: "El Flop requiere 3 cartas y no admite Turn o River" });
  }
  if (value.streetReached === "TURN" && (!value.boardFlop || !value.boardTurn || value.boardRiver)) {
    context.addIssue({ code: "custom", path: ["boardTurn"], message: "El Turn requiere un Flop completo y no admite River" });
  }
  if (value.streetReached === "RIVER" && (!value.boardFlop || !value.boardTurn || !value.boardRiver)) {
    context.addIssue({ code: "custom", path: ["boardRiver"], message: "El River requiere Flop y Turn completos" });
  }

  const allCards = [
    ...value.heroCards,
    ...(value.villainCards === "UNKNOWN" ? [] : value.villainCards),
    ...(value.boardFlop ?? []),
    ...(value.boardTurn ? [value.boardTurn] : []),
    ...(value.boardRiver ? [value.boardRiver] : []),
  ];
  const duplicate = allCards.find((card, index) => allCards.indexOf(card) !== index);
  if (duplicate) {
    context.addIssue({
      code: "custom",
      path: ["heroCards"],
      message: `La carta ${duplicate} está repetida en la mano`,
    });
  }
});

export type ParsedEliminationInput = z.infer<typeof eliminationInputSchema>;

export function handNotation(cards: Card[]): string {
  if (cards.length !== 2) throw new Error("Se necesitan exactamente dos cartas");
  const sorted = [...cards].sort(
    (first, second) => RANKS.indexOf(first[0] as (typeof RANKS)[number]) - RANKS.indexOf(second[0] as (typeof RANKS)[number]),
  );
  const firstRank = sorted[0][0];
  const secondRank = sorted[1][0];
  if (firstRank === secondRank) return `${firstRank}${secondRank}`;
  return `${firstRank}${secondRank}${sorted[0][1] === sorted[1][1] ? "s" : "o"}`;
}

export function formatEntryNumber(id: number): string {
  return String(id).padStart(2, "0");
}

export function assertEliminationInput(input: unknown): EliminationInput {
  return eliminationInputSchema.parse(input) as EliminationInput;
}
