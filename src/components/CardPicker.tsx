import { useMemo, useState } from "react";
import { RANKS, SUITS, SUIT_SYMBOLS, cardLabel, handNotation } from "../cards";
import type { Card, EliminationInput, Street } from "../types";

type CardTarget = "hero" | "villain" | "flop" | "turn" | "river";
type HandCards = Pick<EliminationInput, "heroCards" | "villainCards" | "streetReached" | "boardFlop" | "boardTurn" | "boardRiver">;

const SUIT_NAMES = { s: "Picas", h: "Corazones", d: "Diamantes", c: "Tréboles" } as const;

function completeFlop(value: HandCards): boolean {
  return value.boardFlop?.length === 3;
}

function streetFor(value: HandCards): Street {
  if (completeFlop(value) && value.boardTurn && value.boardRiver) return "RIVER";
  if (completeFlop(value) && value.boardTurn) return "TURN";
  if (completeFlop(value)) return "FLOP";
  return "PREFLOP";
}

export function CardPicker({ value, onChange }: { value: HandCards; onChange: (next: HandCards) => void }) {
  const [activeTarget, setActiveTarget] = useState<CardTarget>("hero");
  const [notice, setNotice] = useState<string | null>(null);
  const usedCards = useMemo(() => new Set<Card>([
    ...value.heroCards,
    ...(value.villainCards === "UNKNOWN" ? [] : value.villainCards),
    ...(value.boardFlop ?? []),
    ...(value.boardTurn ? [value.boardTurn] : []),
    ...(value.boardRiver ? [value.boardRiver] : []),
  ]), [value]);

  function activateTarget(target: CardTarget) {
    setNotice(null);
    setActiveTarget(target);
    const nextStreet = streetFor(value);
    if (nextStreet !== value.streetReached) onChange({ ...value, streetReached: nextStreet });
  }

  function assignCard(card: Card) {
    if (usedCards.has(card)) return;
    setNotice(null);

    if (activeTarget === "hero") {
      if (value.heroCards.length >= 2) { setActiveTarget("villain"); return; }
      const heroCards = [...value.heroCards, card];
      onChange({ ...value, heroCards });
      if (heroCards.length === 2) setActiveTarget("villain");
      return;
    }

    if (activeTarget === "villain") {
      const current = value.villainCards === "UNKNOWN" ? [] : value.villainCards;
      if (current.length >= 2) { setActiveTarget("flop"); return; }
      const villainCards = [...current, card];
      onChange({ ...value, villainCards });
      if (villainCards.length === 2) setActiveTarget("flop");
      return;
    }

    if (activeTarget === "flop") {
      const flop = value.boardFlop ?? [];
      if (flop.length >= 3) { setActiveTarget("turn"); return; }
      const boardFlop = [...flop, card];
      onChange({
        ...value,
        boardFlop,
        boardTurn: null,
        boardRiver: null,
        streetReached: boardFlop.length === 3 ? "FLOP" : "PREFLOP",
      });
      if (boardFlop.length === 3) setActiveTarget("turn");
      return;
    }

    if (activeTarget === "turn") {
      if (!completeFlop(value)) {
        setNotice("Completa el Flop (3 cartas) antes de colocar el Turn. El selector ya está desbloqueado.");
        setActiveTarget("flop");
        return;
      }
      if (value.boardTurn) { setActiveTarget("river"); return; }
      onChange({ ...value, boardTurn: card, boardRiver: null, streetReached: "TURN" });
      setActiveTarget("river");
      return;
    }

    if (activeTarget === "river") {
      if (!completeFlop(value) || !value.boardTurn) {
        setNotice("Completa el Flop y el Turn antes de colocar el River. El selector ya está desbloqueado.");
        setActiveTarget(completeFlop(value) ? "turn" : "flop");
        return;
      }
      if (value.boardRiver) return;
      onChange({ ...value, boardRiver: card, streetReached: "RIVER" });
      setActiveTarget("river");
    }
  }

  function removeCard(target: CardTarget, index = 0) {
    setNotice(null);
    setActiveTarget(target);
    if (target === "hero") onChange({ ...value, heroCards: value.heroCards.filter((_, current) => current !== index) });
    if (target === "villain" && value.villainCards !== "UNKNOWN") {
      onChange({ ...value, villainCards: value.villainCards.filter((_, current) => current !== index) });
    }
    if (target === "flop") {
      const boardFlop = (value.boardFlop ?? []).filter((_, current) => current !== index);
      onChange({
        ...value,
        boardFlop: boardFlop.length ? boardFlop : null,
        boardTurn: null,
        boardRiver: null,
        streetReached: boardFlop.length === 3 ? "FLOP" : "PREFLOP",
      });
    }
    if (target === "turn") onChange({ ...value, boardTurn: null, boardRiver: null, streetReached: "FLOP" });
    if (target === "river") onChange({ ...value, boardRiver: null, streetReached: "TURN" });
  }

  function endedPreflop() {
    setNotice(null);
    onChange({ ...value, streetReached: "PREFLOP", boardFlop: null, boardTurn: null, boardRiver: null });
    setActiveTarget("hero");
  }

  function unknownVillain() {
    setNotice(null);
    onChange({ ...value, villainCards: "UNKNOWN" });
    setActiveTarget("flop");
  }

  return (
    <section className="panel card-picker" aria-label="Selector visual de cartas">
      <div className="section-title-row">
        <div><h2>Cartas de la mano</h2><p>Haz clic en cualquier destino y después en las cartas. No hay candados: el flujo avanza solo.</p></div>
        <button type="button" className={value.streetReached === "PREFLOP" ? "chip active" : "chip"} onClick={endedPreflop}>Terminó Preflop</button>
      </div>

      <div className="card-destinations">
        <CardDestination label="Héroe" target="hero" active={activeTarget === "hero"} cards={value.heroCards} notation={handNotation(value.heroCards)} onActivate={activateTarget} onRemove={removeCard} />
        <div className="destination-wrap">
          <CardDestination label="Villano" target="villain" active={activeTarget === "villain"} cards={value.villainCards === "UNKNOWN" ? [] : value.villainCards} notation={value.villainCards === "UNKNOWN" ? "Desconocida" : handNotation(value.villainCards)} onActivate={activateTarget} onRemove={removeCard} />
          <button type="button" className="unknown-button" onClick={unknownVillain}>Desconocida</button>
        </div>
      </div>

      <div className="board-row">
        <BoardDestination label="Flop" target="flop" cards={value.boardFlop ?? []} active={activeTarget === "flop"} onActivate={activateTarget} onRemove={removeCard} />
        <BoardDestination label="Turn" target="turn" cards={value.boardTurn ? [value.boardTurn] : []} active={activeTarget === "turn"} onActivate={activateTarget} onRemove={removeCard} />
        <BoardDestination label="River" target="river" cards={value.boardRiver ? [value.boardRiver] : []} active={activeTarget === "river"} onActivate={activateTarget} onRemove={removeCard} />
      </div>

      {notice && <p className="card-picker-notice" role="status">{notice}</p>}

      <div className="deck-label"><span>BARAJA DE 4 COLORES · 13 RANGOS × 4 PALOS</span><small>En uso: cartas atenuadas · Seleccionadas: contorno verde</small></div>
      <div className="deck-legend" aria-hidden="true">
        {SUITS.map((suit) => <span key={suit} className={`legend-suit suit-${suit}`}>{SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}</span>)}
      </div>
      <div className="deck-scroll">
        <div className="deck-grid">
          {SUITS.map((suit) => RANKS.map((rank) => {
            const card = `${rank}${suit}` as Card;
            const used = usedCards.has(card);
            return (
              <button
                type="button"
                key={card}
                aria-label={`Seleccionar ${card}`}
                title={`${rank} de ${SUIT_NAMES[suit]}`}
                disabled={used}
                className={`deck-card suit-${suit} ${used ? "used" : ""}`}
                onClick={() => assignCard(card)}
              >
                <b>{rank}</b><span>{SUIT_SYMBOLS[suit]}</span>
              </button>
            );
          }))}
        </div>
      </div>
      <p className="panel-footnote">Las cartas en uso no pueden repetirse en esta mano. La calle se calcula automáticamente según el board completo.</p>
    </section>
  );
}

function CardDestination({ label, target, cards, notation, active, onActivate, onRemove }: {
  label: string; target: CardTarget; cards: Card[]; notation: string; active: boolean;
  onActivate: (target: CardTarget) => void; onRemove: (target: CardTarget, index: number) => void;
}) {
  return (
    <div className={`card-destination ${active ? "active" : ""}`}>
      <button type="button" className="destination-title" aria-pressed={active} onClick={() => onActivate(target)}>{label} · {cards.length}/2</button>
      <div className="chosen-cards">
        {cards.map((card, index) => <ChosenCard key={card} card={card} onRemove={() => onRemove(target, index)} />)}
        {cards.length === 0 && <span className="empty-card">Elige cartas</span>}
        <strong>{notation}</strong>
      </div>
    </div>
  );
}

function BoardDestination({ label, target, cards, active, onActivate, onRemove }: {
  label: string; target: CardTarget; cards: Card[]; active: boolean;
  onActivate: (target: CardTarget) => void; onRemove: (target: CardTarget, index: number) => void;
}) {
  const capacity = target === "flop" ? 3 : 1;
  return (
    <div className={`board-destination ${active ? "active" : ""}`}>
      <button type="button" aria-pressed={active} onClick={() => onActivate(target)}>{label} · {cards.length}/{capacity}</button>
      <div>{cards.map((card, index) => <ChosenCard key={card} card={card} compact onRemove={() => onRemove(target, index)} />)}</div>
    </div>
  );
}

function ChosenCard({ card, onRemove, compact = false }: { card: Card; onRemove: () => void; compact?: boolean }) {
  return <button type="button" className={`chosen-card suit-${card[1]} ${compact ? "compact" : ""}`} onClick={onRemove} aria-label={`Quitar ${card}`}>{cardLabel(card)}</button>;
}
