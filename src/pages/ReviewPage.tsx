import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAppState } from "../App";
import { HandSummary } from "../components/PlayingCards";
import type { ReviewBatch, ReviewCheck } from "../types";

export function ReviewPage() {
  const { refresh } = useAppState();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<ReviewBatch | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [synthesis, setSynthesis] = useState({ repeatingPattern: "", ignoredWarningSignal: "", nextSessionRule: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCheckId, setSavingCheckId] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    api<{ batch: ReviewBatch | null }>("/api/reviews/pending").then(({ batch: pending }) => {
      if (pending && (!pending.checks || pending.checks.length === 0)) {
        // Defensa final del cliente: un lote vacío nunca puede bloquear la aplicación.
        setBatch(null);
        setActiveId(null);
        void refresh();
        setLoading(false);
        return;
      }
      setBatch(pending);
      setActiveId(pending?.checks.find((check) => !check.checkedInReview)?.eliminationId ?? pending?.checks[0]?.eliminationId ?? null);
      setLoading(false);
    }).catch((caught) => { setError(caught instanceof Error ? caught.message : "No se pudo abrir la revisión"); setLoading(false); });
  }, [refresh]);

  const activeCheck = batch?.checks.find((check) => check.eliminationId === activeId) ?? null;
  const checkedCount = batch?.checks.filter((check) => check.checkedInReview).length ?? 0;
  const allChecked = Boolean(batch?.checks.length && checkedCount === batch.checks.length);
  const synthesisComplete = Object.values(synthesis).every((value) => value.trim());

  async function markCheck(check: ReviewCheck) {
    if (!batch || !batch.checks?.length || savingCheckId !== null) return;
    setError(null);
    setSavingCheckId(check.eliminationId);
    try {
      const result = await api<{ batch: ReviewBatch }>(`/api/reviews/${batch.id}/checks/${check.eliminationId}`, { method: "PATCH", body: JSON.stringify({ checked: !check.checkedInReview }) });
      setBatch(result.batch);
      if (!check.checkedInReview) {
        const next = result.batch.checks.find((item) => !item.checkedInReview);
        if (next) setActiveId(next.eliminationId);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la marca"); }
    finally { setSavingCheckId(null); }
  }

  async function complete() {
    if (!batch || !batch.checks?.length || completing) return;
    setError(null);
    setCompleting(true);
    try {
      await api(`/api/reviews/${batch.id}/complete`, { method: "POST", body: JSON.stringify(synthesis) });
      await refresh();
      navigate("/historial");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo cerrar la revisión");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <div className="empty-state">Consultando la disciplina pendiente…</div>;
  if (!batch) return (
    <div className="empty-state panel no-review"><span>✓</span><h1>No hay una revisión pendiente.</h1><p>Puedes seguir registrando y finalizando entradas. El historial y los bloques cerrados siguen disponibles.</p><div className="no-review-actions"><Link className="button primary" to="/registro">Registrar eliminación</Link><Link className="button secondary" to="/historial">Ver historial</Link></div></div>
  );

  return (
    <div className="page-stack review-page">
      <div className="page-heading split-heading"><div><span className="eyebrow">REVISIÓN / BLOQUE {String(batch.id).padStart(2, "0")}</span><h1>Antes de seguir, mira hacia atrás.</h1><p>Revisa cada mano y convierte tus conclusiones en una regla para la próxima sesión.</p></div><span className="mandatory-badge">Revisión obligatoria · {batch.triggerType === "FIVE_ENTRIES" ? "5 entradas" : "7 días"}</span></div>
      <div className="review-progress panel">
        <div><strong>{checkedCount} de {batch.checks.length} entradas revisadas</strong><p>{allChecked ? "Cada mano está marcada. Completa las conclusiones." : `Te ${batch.checks.length - checkedCount === 1 ? "queda" : "quedan"} ${batch.checks.length - checkedCount} por revisar.`}</p></div>
        <div>{batch.checks.map((check, index) => <button key={check.eliminationId} className={`${check.checkedInReview ? "checked" : ""} ${activeId === check.eliminationId ? "active" : ""}`} onClick={() => setActiveId(check.eliminationId)}>{check.checkedInReview ? "✓" : String(index + 1).padStart(2, "0")}</button>)}</div>
      </div>
      {error && <div className="error-box" role="alert">{error}</div>}
      <section className="review-layout">
        <article className="panel review-entry">
          {activeCheck && <>
            <div className="review-entry-heading"><div><span className="eyebrow">ENTRADA {String(activeCheck.elimination.id).padStart(2, "0")} / {String(batch.checks.length).padStart(2, "0")}</span><h2>{activeCheck.elimination.tournamentName}</h2><p>{new Date(activeCheck.elimination.eliminatedAt).toLocaleString("es-MX")}</p></div><strong>{activeCheck.elimination.heroHandNotation} vs {activeCheck.elimination.villainHandNotation}</strong></div>
            <div className="review-data"><span><small>BUY-IN</small>{activeCheck.elimination.buyInAmount} {activeCheck.elimination.buyInCurrency}</span><span><small>POSICIÓN</small>{activeCheck.elimination.finishPosition ?? "—"}</span><span><small>STACK</small>{activeCheck.elimination.heroStackBb} BB</span><span><small>CALLE</small>{streetLabel(activeCheck.elimination.streetReached)}</span></div>
            <HandSummary entry={activeCheck.elimination} />
            <ReviewText code="[PR-EL]" title="Estado mental previo" text={activeCheck.elimination.analysisPrEl} />
            <ReviewText code="[ERR-01]" title="Error crítico" text={activeCheck.elimination.analysisErr01} />
            <ReviewText code="[OK-01]" title="Línea correcta / revisión" text={activeCheck.elimination.analysisOk01} />
            <footer><span>Léela con calma antes de confirmar.</span><button className={activeCheck.checkedInReview ? "button secondary" : "button primary"} disabled={savingCheckId !== null} onClick={() => void markCheck(activeCheck)}>{savingCheckId === activeCheck.eliminationId ? "Guardando…" : activeCheck.checkedInReview ? "Desmarcar revisión" : "Marcar como revisada"}</button></footer>
          </>}
        </article>
        <aside className="panel synthesis-panel"><h2>Lo que te llevas de este bloque</h2><p>Una conclusión concreta vale más que varias manos archivadas.</p>
          <SynthesisField number="01" label="Patrón que se repite" value={synthesis.repeatingPattern} onChange={(value) => setSynthesis({ ...synthesis, repeatingPattern: value })} />
          <SynthesisField number="02" label="Señal de alerta que ignoraste" value={synthesis.ignoredWarningSignal} onChange={(value) => setSynthesis({ ...synthesis, ignoredWarningSignal: value })} />
          <SynthesisField number="03" label="Regla concreta para tu próxima sesión" value={synthesis.nextSessionRule} onChange={(value) => setSynthesis({ ...synthesis, nextSessionRule: value })} />
          <small>Las tres conclusiones son necesarias para cerrar la revisión.</small>
        </aside>
      </section>
      <div className="save-bar"><div><strong>Una última confirmación</strong><p>{allChecked ? "Cada entrada fue revisada. Convierte el aprendizaje en una regla." : "Marca cada entrada como revisada para habilitar el cierre."}</p></div><div><Link className="button secondary" to="/historial">Volver al historial</Link><button className="button primary" disabled={!allChecked || !synthesisComplete || completing} onClick={() => void complete()}>{completing ? "Finalizando…" : "Finalizar revisión"}</button></div></div>
      <p className="page-footnote">La revisión pendiente se conserva aunque cierres la aplicación. Puedes seguir guardando borradores.</p>
    </div>
  );
}

function ReviewText({ code, title, text }: { code: string; title: string; text: string }) { return <section className="review-text"><div><span className="code">{code}</span><strong>{title}</strong></div><p>{text}</p></section>; }
function SynthesisField({ number, label, value, onChange }: { number: string; label: string; value: string; onChange: (value: string) => void }) { return <label><span><b>{number}</b> {label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function streetLabel(street: string) { return ({ PREFLOP: "Preflop", FLOP: "Flop", TURN: "Turn", RIVER: "River" } as Record<string, string>)[street]; }
