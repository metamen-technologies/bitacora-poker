import { Link } from "react-router-dom";
import { useAppState } from "../App";
import { handNotation } from "../cards";

export function HomePage() {
  const { summary, loading } = useAppState();
  const pending = summary?.pendingBatch;

  return (
    <div className="page-stack home-page">
      <div className="page-heading"><span className="eyebrow">INICIO / MI ESPACIO</span><h1>¿En qué quieres trabajar hoy?</h1><p>Un lugar para registrar, revisar y seguir construyendo tu juego.</p></div>
      <div className="section-kicker"><strong>TUS HERRAMIENTAS</strong><span>{loading ? "Cargando…" : "2 funciones disponibles"}</span></div>
      <section className="tool-grid">
        <article className="panel tool-card">
          <div className="tool-meta"><span>01 / CAPTURA</span><em>Disponible</em></div>
          <h2>Registrar eliminación</h2><p>Captura las cartas y el contexto de tu última mano.<br />Registra lo que pasó y lo que aprendiste.</p>
          <small>Cartas con clics · Estado mental · Análisis</small>
          <Link className="button primary" to="/registro">Registrar eliminación</Link>
        </article>
        <article className="panel tool-card">
          <div className="tool-meta"><span>02 / APRENDIZAJE</span><em>{summary?.counts.total ?? 0} entradas</em></div>
          <h2>Historial y revisión</h2><p>Vuelve a tus eliminaciones en orden cronológico.<br />Detecta patrones y revisa con intención.</p>
          <small>Cronología · Exportación · Revisión por bloques</small>
          <Link className="button secondary" to="/historial">Abrir historial</Link>
        </article>
      </section>
      {pending ? (
        <section className="review-callout">
          <strong>{String(pending.checks.filter((check) => check.checkedInReview).length).padStart(2, "0")} / {String(pending.checks.length).padStart(2, "0")}</strong>
          <div><h3>Tu próximo paso: completar la revisión</h3><p>Tienes {pending.checks.length} entradas en este bloque. Puedes guardar borradores mientras revisas.</p></div>
          <Link className="button warning" to="/revision">Comenzar revisión</Link>
        </section>
      ) : (
        <section className="review-callout calm">
          <strong>{String(summary?.counts.pending ?? 0).padStart(2, "0")} / 05</strong>
          <div><h3>Tu próximo bloque se está construyendo</h3><p>Las entradas completadas y aún no revisadas cuentan para el siguiente ciclo.</p></div>
          <Link className="button secondary" to="/historial">Ver progreso</Link>
        </section>
      )}
      <section className="dashboard-grid">
        <article className="panel recent-panel">
          <h3>Tu actividad reciente</h3><p>Últimas eliminaciones registradas</p>
          <div className="recent-table">
            {summary?.recentEntries.length ? summary.recentEntries.map((entry) => (
              <Link key={entry.id} to={`/historial?entrada=${entry.id}`}>
                <b>#{String(entry.id).padStart(2, "0")}</b><strong>{entry.tournamentName}</strong><span>{handNotation(entry.heroCards)} / {entry.villainHandNotation}</span><time>{new Date(entry.eliminatedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</time>
              </Link>
            )) : <div className="empty-state compact">Tu primera entrada aparecerá aquí.</div>}
          </div>
        </article>
        <article className="panel promise-panel"><span className="eyebrow">UN SISTEMA QUE CRECE CONTIGO</span><h2>Más claridad.<br />Menos tilt.</h2><p>Todo queda en este equipo: sin cuentas, nubes, telemetría ni análisis automático.</p><hr /><small>Tu estudio sigue siendo tuyo.</small></article>
      </section>
    </div>
  );
}
