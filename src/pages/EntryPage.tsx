import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAppState } from "../App";
import { CardPicker } from "../components/CardPicker";
import type { Elimination, EliminationInput, Position, ReviewBatch } from "../types";

const POSITIONS: Position[] = ["UTG", "UTG+1", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

function initialInput(): EliminationInput {
  return {
    status: "DRAFT",
    eliminatedAt: new Date().toISOString(),
    tournamentName: "",
    buyInAmount: 0,
    buyInCurrency: "USD",
    finishPosition: null,
    heroStackBb: 10,
    heroPosition: "BTN",
    villainPosition: "BB",
    heroCards: [],
    villainCards: "UNKNOWN",
    streetReached: "PREFLOP",
    boardFlop: null,
    boardTurn: null,
    boardRiver: null,
    analysisPrEl: "",
    analysisErr01: "",
    analysisOk01: "",
  };
}

interface SaveResult {
  entry: Elimination;
  pendingBatch: ReviewBatch | null;
}

export function EntryPage() {
  const { id } = useParams();
  const numericId = id ? Number(id) : null;
  const navigate = useNavigate();
  const { summary, refresh, registerActiveSave } = useAppState();
  const [entryId, setEntryId] = useState<number | null>(numericId);
  const [form, setForm] = useState<EliminationInput>(initialInput);
  const [originalStatus, setOriginalStatus] = useState<Elimination["status"] | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ field: string; message: string }>>([]);

  const formRef = useRef(form);
  formRef.current = form;
  const entryIdRef = useRef(entryId);
  entryIdRef.current = entryId;
  const originalStatusRef = useRef(originalStatus);
  originalStatusRef.current = originalStatus;

  useEffect(() => {
    if (!numericId) {
      setEntryId(null);
      setOriginalStatus(null);
      setForm(initialInput());
      setStep(1);
      setError(null);
      setIssues([]);
      return;
    }
    let cancelled = false;
    api<{ entry: Elimination }>(`/api/eliminations/${numericId}`).then(({ entry }) => {
      if (cancelled) return;
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, heroHandNotation: _hero, villainHandNotation: _villain, isReviewed: _reviewed, reviewBatchId: _batch, ...editable } = entry;
      setForm(editable);
      setEntryId(entry.id);
      setOriginalStatus(entry.status);
      setError(null);
      setIssues([]);
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo abrir la entrada");
    });
    return () => { cancelled = true; };
  }, [numericId]);

  const locked = Boolean(summary?.pendingBatch) && originalStatus !== "COMPLETED";

  function update<K extends keyof EliminationInput>(field: K, value: EliminationInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function persist(status: "DRAFT" | "COMPLETED"): Promise<SaveResult> {
    const payload = { ...formRef.current, status };
    const currentId = entryIdRef.current;
    const result = currentId
      ? await api<SaveResult>(`/api/eliminations/${currentId}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api<SaveResult>("/api/eliminations", { method: "POST", body: JSON.stringify(payload) });
    entryIdRef.current = result.entry.id;
    setEntryId(result.entry.id);
    setOriginalStatus(result.entry.status);
    setForm((current) => ({ ...current, status: result.entry.status }));
    await refresh();
    return result;
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    registerActiveSave(async () => {
      const current = formRef.current;
      if (!current.tournamentName.trim()) {
        return { saved: false, message: "Añade el nombre del torneo para guardar el borrador activo." };
      }
      if (current.heroCards.length !== 2) {
        return { saved: false, message: "Selecciona las 2 cartas del héroe para guardar el borrador activo." };
      }
      const status = originalStatusRef.current === "COMPLETED" ? "COMPLETED" : "DRAFT";
      try {
        const result = await persistRef.current(status);
        return { saved: true, entryId: result.entry.id };
      } catch (caught) {
        return {
          saved: false,
          message: caught instanceof ApiError ? caught.message : "No se pudo guardar el borrador activo.",
        };
      }
    });
    return () => registerActiveSave(null);
  }, [registerActiveSave]);

  async function save(status: "DRAFT" | "COMPLETED") {
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      const result = await persist(status);
      if (status === "COMPLETED") {
        if (result.pendingBatch) navigate("/revision", { replace: true });
        else navigate(`/historial?entrada=${result.entry.id}`);
      } else {
        navigate(`/historial?entrada=${result.entry.id}`);
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setIssues(caught.issues);
      } else setError("No se pudo guardar la entrada");
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) setStep(2);
    else void save("COMPLETED");
  }

  return (
    <form onSubmit={submit} className="page-stack">
      <div className="page-heading split-heading">
        <div><span className="eyebrow">REGISTRO / {entryId ? `ENTRADA ${String(entryId).padStart(2, "0")}` : "NUEVA ENTRADA"}</span><h1>Cada eliminación, una lección.</h1><p>Captura la mano. Entiende la decisión. Vuelve con un plan.</p></div>
        <label className="date-field"><span>Fecha y hora</span><input type="datetime-local" value={toDateTimeLocal(form.eliminatedAt)} onChange={(event) => {
          if (!event.target.value) return;
          const next = new Date(event.target.value);
          if (!Number.isNaN(next.getTime())) update("eliminatedAt", next.toISOString());
        }} /></label>
      </div>

      <div className="stepper">
        <button type="button" className={step === 1 ? "active" : ""} onClick={() => setStep(1)}><b>01</b> Datos y cartas</button>
        <button type="button" className={step === 2 ? "active" : ""} onClick={() => setStep(2)}><b>02</b> Reflexión de la mano</button>
        <span>{locked ? "Finalización bloqueada por revisión pendiente · el borrador sí se puede guardar" : "Solo las entradas completas cuentan para la revisión."}</span>
      </div>

      {error && <div className="error-box" role="alert"><strong>{error}</strong>{issues.length > 0 && <ul>{issues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}</ul>}</div>}

      {step === 1 ? (
        <>
          <section className="panel">
            <div className="section-title-row"><h2>Datos del torneo</h2><p>Registra el contexto de la eliminación.</p></div>
            <div className="form-grid three">
              <Field label="Torneo"><input required value={form.tournamentName} onChange={(event) => update("tournamentName", event.target.value)} placeholder="Ej. Daily Deepstack" /></Field>
              <Field label="Buy-in"><input required type="number" min="0" step="0.01" value={form.buyInAmount} onChange={(event) => update("buyInAmount", event.target.valueAsNumber)} /></Field>
              <Field label="Moneda"><input required maxLength={8} value={form.buyInCurrency} onChange={(event) => update("buyInCurrency", event.target.value.toUpperCase())} placeholder="USD" /></Field>
              <Field label="Posición final"><input type="number" min="1" value={form.finishPosition ?? ""} onChange={(event) => update("finishPosition", event.target.value ? event.target.valueAsNumber : null)} placeholder="Puede quedar pendiente en borrador" /></Field>
              <Field label="Stack del héroe (BB)"><input required type="number" min="0.01" step="0.01" value={form.heroStackBb} onChange={(event) => update("heroStackBb", event.target.valueAsNumber)} /></Field>
              <Field label="Posición del héroe"><select value={form.heroPosition} onChange={(event) => update("heroPosition", event.target.value as Position)}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></Field>
              <Field label="Posición del villano"><select value={form.villainPosition} onChange={(event) => update("villainPosition", event.target.value as Position)}>{POSITIONS.map((position) => <option key={position}>{position}</option>)}</select></Field>
            </div>
          </section>
          <CardPicker value={form} onChange={(cards) => setForm((current) => ({ ...current, ...cards }))} />
        </>
      ) : (
        <section className="analysis-grid">
          <div className="panel analysis-intro"><span className="eyebrow">REFLEXIÓN SIN JUICIO</span><h2>La mano también se juega aquí.</h2><p>Escribe con honestidad, no con dureza. Conservaremos cada salto de línea exactamente como lo escribas.</p><Link to="#" onClick={() => setStep(1)}>← Volver a cartas y datos</Link></div>
          <div className="panel analysis-fields">
            <AnalysisField code="[PR-EL]" label="Estado mental previo" value={form.analysisPrEl} onChange={(value) => update("analysisPrEl", value)} placeholder="¿Qué sentías antes de tomar la decisión?" />
            <AnalysisField code="[ERR-01]" label="Error crítico" value={form.analysisErr01} onChange={(value) => update("analysisErr01", value)} placeholder="¿Qué decisión consideras un error y por qué?" />
            <AnalysisField code="[OK-01]" label="Línea correcta / revisión" value={form.analysisOk01} onChange={(value) => update("analysisOk01", value)} placeholder="¿Qué harás diferente ante esta situación?" />
          </div>
        </section>
      )}

      <div className="save-bar">
        <div><strong>{locked ? "Revisión obligatoria activa" : step === 1 ? "Datos listos para continuar" : "Convierte esta mano en aprendizaje"}</strong><p>{locked ? "Puedes guardar este registro como borrador sin perder la mano." : "Los borradores no cuentan para activar una revisión. Usa «Guardar progreso» para asegurar el formulario activo."}</p></div>
        <div>
          {originalStatus !== "COMPLETED" && <button type="button" className="button secondary" disabled={saving} onClick={() => void save("DRAFT")}>Guardar borrador</button>}
          {step === 1 ? <button className="button primary" type="submit">Continuar a reflexión</button> : <button className="button primary" type="submit" disabled={saving || locked}>{originalStatus === "COMPLETED" ? "Guardar cambios" : locked ? "Finalización bloqueada" : "Finalizar entrada"}</button>}
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function AnalysisField({ code, label, value, onChange, placeholder }: { code: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="analysis-field"><span className="code">{code}</span><strong>{label}</strong><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
