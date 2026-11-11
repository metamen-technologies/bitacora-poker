import { cardLabel } from "../cards";
import type { Card, Elimination } from "../types";

type HandEntry = Pick<Elimination, "heroCards" | "villainCards" | "boardFlop" | "boardTurn" | "boardRiver" | "streetReached">;

const STREET_LABELS: Record<string, string> = {
  PREFLOP: "Preflop",
  FLOP: "Flop",
  TURN: "Turn",
  RIVER: "River",
};

export function CardChip({ card, compact = false }: { card: Card; compact?: boolean }) {
  return (
    <span className={`playing-card suit-${card[1]} ${compact ? "compact" : ""}`} aria-label={cardLabel(card)}>
      {cardLabel(card)}
    </span>
  );
}

export function HandSummary({ entry, compact = false }: { entry: HandEntry; compact?: boolean }) {
  const board = [
    ...(entry.boardFlop ?? []),
    ...(entry.boardTurn ? [entry.boardTurn] : []),
    ...(entry.boardRiver ? [entry.boardRiver] : []),
  ];
  return (
    <div className={`hand-summary ${compact ? "compact" : ""}`} aria-label="Cartas de la mano">
      <div className="hand-group">
        <small>HÉROE</small>
        <div>{entry.heroCards.length ? entry.heroCards.map((card) => <CardChip key={card} card={card} compact={compact} />) : <span className="unknown-hand">Sin cartas</span>}</div>
      </div>
      <div className="hand-group">
        <small>VILLANO</small>
        <div>{entry.villainCards === "UNKNOWN" ? <span className="unknown-hand">Desconocida</span> : entry.villainCards.map((card) => <CardChip key={card} card={card} compact={compact} />)}</div>
      </div>

      <div className="hand-group">
        <small>BOARD · {STREET_LABELS[entry.streetReached] ?? entry.streetReached}</small>
        <div>{board.length ? board.map((card) => <CardChip key={card} card={card} compact={compact} />) : <span className="unknown-hand">Sin board</span>}</div>
      </div>
    </div>
  );
}
