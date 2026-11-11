// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { CardPicker } from "../src/components/CardPicker";
import type { EliminationInput } from "../src/types";

type HandCards = Pick<EliminationInput, "heroCards" | "villainCards" | "streetReached" | "boardFlop" | "boardTurn" | "boardRiver">;

function Harness({ initial }: { initial?: Partial<HandCards> }) {
  const [cards, setCards] = useState<HandCards>({
    heroCards: [],
    villainCards: "UNKNOWN",
    streetReached: "PREFLOP",
    boardFlop: null,
    boardTurn: null,
    boardRiver: null,
    ...initial,
  });
  return <CardPicker value={cards} onChange={setCards} />;
}

function deckCard(card: string) {
  return screen.getByRole("button", { name: `Seleccionar ${card}` });
}

function destination(name: RegExp | string) {
  return screen.getByRole("button", { name });
}

describe("selector visual de cartas", () => {
  it("1. deshabilita de inmediato una carta ya asignada e impide repetirla en otro destino", () => {
    render(<Harness />);
    const aceHearts = deckCard("Ah");
    fireEvent.click(aceHearts);
    expect(aceHearts).toBeDisabled();
    fireEvent.click(destination(/Flop · 0\/3/));
    expect(deckCard("Ah")).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Quitar Ah" })).toHaveLength(1);
  });

  it("2. auto-avanza Héroe → Villano → Flop → Turn → River sin pulsar destinos", () => {
    render(<Harness />);

    fireEvent.click(deckCard("Ah"));
    expect(destination(/Héroe · 1\/2/)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(deckCard("Kh"));
    expect(destination(/Villano · 0\/2/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(deckCard("Qs"));
    fireEvent.click(deckCard("Js"));
    expect(destination(/Flop · 0\/3/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(deckCard("2c"));
    fireEvent.click(deckCard("3d"));
    fireEvent.click(deckCard("4h"));
    expect(destination(/Turn · 0\/1/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(deckCard("5s"));
    expect(destination(/River · 0\/1/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(deckCard("6c"));
    expect(destination(/River · 1\/1/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Quitar 6c" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("3. Héroe, Villano, Flop, Turn y River nunca están deshabilitados", () => {
    render(<Harness />);
    for (const name of [/Héroe · 0\/2/, /Villano · 0\/2/, /Flop · 0\/3/, /Turn · 0\/1/, /River · 0\/1/]) {
      expect(destination(name)).toBeEnabled();
    }

    fireEvent.click(destination(/Turn · 0\/1/));
    fireEvent.click(deckCard("Ah"));
    expect(screen.getByRole("status")).toHaveTextContent(/Completa el Flop/i);
    expect(destination(/Flop · 0\/3/)).toHaveAttribute("aria-pressed", "true");
    expect(destination(/Turn · 0\/1/)).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Quitar Ah" })).not.toBeInTheDocument();

    fireEvent.click(destination(/River · 0\/1/));
    fireEvent.click(deckCard("Kh"));
    expect(screen.getByRole("status")).toHaveTextContent(/Completa el Flop y el Turn/i);
    expect(destination(/River · 0\/1/)).toBeEnabled();
  });

  it("4. «Desconocida» salta directo al Flop y conserva el destino libre", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Desconocida" }));
    expect(destination(/Flop · 0\/3/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Desconocida" })).toBeInTheDocument();
    expect(screen.getAllByText("Desconocida").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(deckCard("Ah"));
    expect(destination(/Flop · 1\/3/)).toBeEnabled();
  });

  it("5. «Terminó Preflop» limpia las comunitarias sin bloquear el Flop", () => {
    render(<Harness />);
    fireEvent.click(deckCard("Ah"));
    fireEvent.click(deckCard("Kh"));
    fireEvent.click(deckCard("Qs"));
    fireEvent.click(deckCard("Js"));
    fireEvent.click(deckCard("2c"));
    fireEvent.click(deckCard("3d"));
    fireEvent.click(deckCard("4h"));
    fireEvent.click(deckCard("5s"));
    fireEvent.click(deckCard("6c"));
    expect(destination(/River · 1\/1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Terminó Preflop" }));
    expect(destination(/Flop · 0\/3/)).toBeInTheDocument();
    expect(destination(/Turn · 0\/1/)).toBeInTheDocument();
    expect(destination(/River · 0\/1/)).toBeInTheDocument();
    expect(destination(/Héroe · 2\/2/)).toBeInTheDocument();
    expect(destination(/Villano · 2\/2/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar 2c" })).not.toBeInTheDocument();

    fireEvent.click(destination(/Flop · 0\/3/));
    fireEvent.click(deckCard("2c"));
    expect(destination(/Flop · 1\/3/)).toBeInTheDocument();
  });

  it("6. usa la baraja de cuatro colores en el deck y en las cartas elegidas", () => {
    render(<Harness />);
    expect(deckCard("As")).toHaveClass("suit-s");
    expect(deckCard("Ah")).toHaveClass("suit-h");
    expect(deckCard("Ad")).toHaveClass("suit-d");
    expect(deckCard("Ac")).toHaveClass("suit-c");

    fireEvent.click(deckCard("Ah"));
    const chosen = screen.getByRole("button", { name: "Quitar Ah" });
    expect(chosen).toHaveClass("chosen-card", "suit-h");
    expect(screen.getByText("♠ Picas")).toBeInTheDocument();
    expect(screen.getByText("♥ Corazones")).toBeInTheDocument();
    expect(screen.getByText("♦ Diamantes")).toBeInTheDocument();
    expect(screen.getByText("♣ Tréboles")).toBeInTheDocument();
  });
});
