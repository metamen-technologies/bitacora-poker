import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, downloadUrl } from "../api";
import { useAppState } from "../App";
import { CardChip, HandSummary } from "../components/PlayingCards";
import type { ActivityDay, Counts, Elimination, ReviewBatch, ReviewCheck } from "../types";

interface HistoryResponse {
  entries: Elimination[];
  tournaments: string[];
  counts: Counts;
  activity: ActivityDay[];
}

type Tab = "ALL" | "PENDING" | "REVIEWED" | "DRAFT";

const EMPTY_FILTERS = { search: "", tournament: "", dateFrom: "", dateTo: "", buyInAmount: "", currency: "" };
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const EMPTY_COUNTS: Counts = { total: 0, drafts: 0, pending: 0, reviewed: 0 };

export function HistoryPage() {
  const { summary, refresh } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<Elimination[]>([]);
  const [tournaments, setTournaments] = useState<string[]>([]);
  const [counts, setCounts] = useState<Counts>(summary?.counts ?? EMPTY_COUNTS);
  const [activity, setActivity] = useState<ActivityDay[]>(summary?.activity ?? []);
  const [reviews, setReviews] = useState<ReviewBatch[]>([]);
  const [tab, setTab] = useState<Tab>("ALL");
  const [selectedId, setSelectedId] = useState<number | null>(Number(searchParams.get("entrada")) || null);
  const [detail, setDetail] = useState<{ entry: Elimination; canonical: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthKey(new Date()));
  const [message, setMessage] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const requestId = useRef(0);
  const calendarInitialized = useRef(false);
  const messageTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    if (tab !== "ALL") query.set("reviewStatus", tab);
    try {
      const result = await api<HistoryResponse>(`/api/eliminations?${query}`);
      if (currentRequest !== requestId.current) return;
      setEntries(result.entries);
      setTournaments(result.tournaments);
      setCounts(result.counts);
      setActivity(result.activity);
      setSelectedId((current) => result.entries.some((entry) => entry.id === current) ? current : result.entries[0]?.id ?? null);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el historial");
    }
  }, [filters, tab]);

  const loadReviews = useCallback(async () => {
    try {
      const result = await api<{ batches: ReviewBatch[] }>("/api/reviews/history");
      setReviews(result.batches);
    } catch {
      // El archivo de bloques se conserva en memoria si el servidor se reinicia.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadReviews(); }, [loadReviews]);

  useEffect(() => {
    const reload = () => { void load(); void loadReviews(); };
    window.addEventListener("river:data-restored", reload);
    return () => window.removeEventListener("river:data-restored", reload);
  }, [load, loadReviews]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    api<{ entry: Elimination; canonical: string }>(`/api/eliminations/${selectedId}`)
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch(() => { if (!cancelled) setDetail(null); });
    setSearchParams({ entrada: String(selectedId) }, { replace: true });
    return () => { cancelled = true; };
  }, [selectedId, setSearchParams]);

  useEffect(() => {
    if (calendarInitialized.current || activity.length === 0) return;
    const latest = activity[activity.length - 1];
    if (latest?.date) setCalendarMonth(latest.date.slice(0, 7));
    calendarInitialized.current = true;
  }, [activity]);

  useEffect(() => () => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
  }, []);

  function showMessage(next: string) {
    setMessage(next);
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 5000);
  }

  const activeCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);
  const tabCounts = counts ?? summary?.counts ?? EMPTY_COUNTS;
  const activityByDay = useMemo(() => new Map(activity.map((day) => [day.date, day])), [activity]);

  const calendar = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    if (!year || !month) return { label: "", cells: [] as Array<{ date: string; day: number; data?: ActivityDay } | null> };
    const first = new Date(year, month - 1, 1);
    const totalDays = new Date(year, month, 0).getDate();
    const leading = (first.getDay() + 6) % 7;
    const cells: Array<{ date: string; day: number; data?: ActivityDay } | null> = [];
    for (let index = 0; index < leading; index += 1) cells.push(null);
    for (let day = 1; day <= totalDays; day += 1) {
      const date = `${year}-${pad(month)}-${pad(day)}`;
      cells.push({ date, day, data: activityByDay.get(date) });
    }
    return {
      label: first.toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
      cells,
    };
  }, [activityByDay, calendarMonth]);

  function toggleSelection(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyCanonical() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.canonical);
      showMessage("Formato canónico copiado");
    } catch {
      showMessage("No se pudo copiar. Usa la exportación .md.");
    }
  }

  async function removeEntry() {
    if (!detail || !window.confirm(`¿Eliminar ENTRADA ${String(detail.entry.id).padStart(2, "0")}? Su número no volverá a utilizarse.`)) return;
    try {
      await api(`/api/eliminations/${detail.entry.id}`, { method: "DELETE" });
      setSelectedId(null);
      await Promise.all([load(), loadReviews(), refresh()]);
      showMessage("Entrada eliminada");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo eliminar la entrada");
    }
  }

  function selectDay(date: string) {
    if (selectedDay === date) {
      clearDay();
      return;
    }
    setSelectedDay(date);
    setFilters((current) => ({ ...current, dateFrom: date, dateTo: date }));
  }

  function clearDay() {
    setSelectedDay(null);
    setFilters((current) => ({ ...current, dateFrom: "", dateTo: "" }));
  }

  function clearFilters() {
    setSelectedDay(null);
    setFilters(EMPTY_FILTERS);
  }

  function shiftMonth(delta: number) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    calendarInitialized.current = true;
    setCalendarMonth(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
  }

  function selectEntry(id: number, clear = false) {
    if (clear) {
      clearFilters();
      setTab("ALL");
    }
    setSelectedId(id);
  }

  const exportIds = selectedIds.size ? `?ids=${[...selectedIds].join(",")}` : "";

  async function restoreBackup(file: File | undefined) {
    if (!file || !window.confirm("La restauración reemplazará todos los datos locales actuales. ¿Quieres continuar?")) return;
    setRestoring(true);
    setMessage(null);
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const snapshot = JSON.parse(await file.text()) as unknown;
        await api("/api/backup/json/restore", { method: "POST", body: JSON.stringify(snapshot) });
      } else {
        await api("/api/backup/sqlite/restore", {
          method: "POST",
          headers: { "Content-Type": "application/x-sqlite3" },
          body: file,
        });
      }
      setSelectedId(null);
      setSelectedIds(new Set());
      await Promise.all([load(), loadReviews(), refresh()]);
      showMessage("Copia restaurada y validada correctamente");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "La copia no pudo restaurarse");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading split-heading">
        <div><span className="eyebrow">HISTORIAL / TU ARCHIVO DE APRENDIZAJE</span><h1>Las manos pasan. Las lecciones quedan.</h1><p>Cada registro conserva las cartas, el contexto y lo que aprendiste. Nada se oculta.</p></div>
        <div className="heading-actions"><button className="button secondary" onClick={() => downloadUrl(`/api/export/markdown${exportIds}`)}>Exportar {selectedIds.size ? `${selectedIds.size} seleccionadas` : "historial"} .md</button><Link className="button primary" to="/registro">Nueva entrada</Link></div>
      </div>

      {summary?.pendingBatch && <Link to="/revision" className="review-callout slim"><strong>REVISIÓN</strong><div><h2>Es momento de revisar tu juego.</h2><p>La finalización está bloqueada hasta cerrar el bloque, pero todo el historial sigue visible.</p></div><span className="button warning">Revisar ahora</span></Link>}

      <section className="panel history-controls" aria-label="Filtros del historial">
        <div className="history-tabs" role="tablist" aria-label="Filtrar historial por estado">
          {([
            ["ALL", "Todas", tabCounts.total],
            ["PENDING", "Pendientes de Revisión", tabCounts.pending],
            ["REVIEWED", "Revisadas", tabCounts.reviewed],
            ["DRAFT", "Borradores", tabCounts.drafts],
          ] as Array<[Tab, string, number]>).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`history-tab ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        <div className="filter-panel">
          <input aria-label="Buscar torneo o entrada" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Buscar torneo o entrada…" />
          <select aria-label="Filtrar por torneo" value={filters.tournament} onChange={(event) => setFilters({ ...filters, tournament: event.target.value })}><option value="">Todos los torneos</option>{tournaments.map((tournament) => <option key={tournament}>{tournament}</option>)}</select>
          <input aria-label="Importe de Buy-in" type="number" min="0" step="0.01" value={filters.buyInAmount} onChange={(event) => setFilters({ ...filters, buyInAmount: event.target.value })} placeholder="Buy-in" />
          <input aria-label="Moneda" value={filters.currency} maxLength={8} onChange={(event) => setFilters({ ...filters, currency: event.target.value.toUpperCase() })} placeholder="Moneda" />
          <label><span>Desde</span><input type="date" value={filters.dateFrom} onChange={(event) => { setSelectedDay(null); setFilters({ ...filters, dateFrom: event.target.value }); }} /></label>
          <label><span>Hasta</span><input type="date" value={filters.dateTo} onChange={(event) => { setSelectedDay(null); setFilters({ ...filters, dateTo: event.target.value }); }} /></label>
          {activeCount > 0 && <button type="button" className="text-button" onClick={clearFilters}>Limpiar {activeCount} filtros</button>}
        </div>
      </section>

      <section className="history-layout">
        <aside className="panel entry-list-panel">
          <div className="entry-list-heading"><div><h2>Tus eliminaciones</h2><span>{entries.length} resultados · Más recientes primero</span></div><label><input type="checkbox" checked={entries.length > 0 && entries.every((entry) => selectedIds.has(entry.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(entries.map((entry) => entry.id)) : new Set())} /> Todas</label></div>
          <div className="entry-list">
            {entries.map((entry) => (
              <div key={entry.id} className={`entry-list-item ${selectedId === entry.id ? "active" : ""}`}>
                <input aria-label={`Seleccionar entrada ${entry.id}`} type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleSelection(entry.id)} />
                <button onClick={() => setSelectedId(entry.id)}>
                  <span className="entry-main"><b>ENTRADA {String(entry.id).padStart(2, "0")}</b><strong>{entry.tournamentName}</strong><Status entry={entry} /></span>
                  <span className="entry-cards-line">
                    <span className="mini-cards">
                      {entry.heroCards.map((card) => <CardChip key={`h-${entry.id}-${card}`} card={card} compact />)}
                      <i>vs</i>
                      {entry.villainCards === "UNKNOWN" ? <span className="unknown-hand">Desconocida</span> : entry.villainCards.map((card) => <CardChip key={`v-${entry.id}-${card}`} card={card} compact />)}
                    </span>
                    <span className="entry-meta"><time>{formatDate(entry.eliminatedAt)}</time><small>{entry.buyInAmount} {entry.buyInCurrency} · {entry.heroStackBb} BB</small></span>
                  </span>
                </button>
              </div>
            ))}
            {!entries.length && <div className="empty-state compact">No hay entradas que coincidan con estos filtros. <button type="button" className="text-button" onClick={clearFilters}>Ver todas</button></div>}
          </div>
        </aside>
        <article className="panel canonical-panel">
          {detail ? (
            <>
              <div className="canonical-heading"><div><span className="eyebrow">ENTRADA {String(detail.entry.id).padStart(2, "0")}</span><h2>{detail.entry.tournamentName}</h2><p>{formatDate(detail.entry.eliminatedAt)}</p></div><div><Link className="button secondary small" to={`/registro/${detail.entry.id}`}>Editar</Link><button className="button danger small" onClick={removeEntry}>Eliminar</button></div></div>
              <HandSummary entry={detail.entry} />
              <pre>{detail.canonical}</pre>
              <footer><Status entry={detail.entry} /><div><button className="button secondary" onClick={copyCanonical}>Copiar formato canónico</button><button className="button secondary" onClick={() => downloadUrl(`/api/export/markdown?ids=${detail.entry.id}`)}>Exportar .md</button></div></footer>
            </>
          ) : <div className="empty-state">Selecciona una entrada para ver todos sus detalles.</div>}
        </article>
      </section>

      <section className="panel review-history-panel">
        <div className="section-title-row">
          <div><h2>Historial de Revisiones</h2><p>Las conclusiones y las manos de cada bloque de 5 entradas o ciclo de 7 días quedan visibles para siempre.</p></div>
          <span className="count-badge">{reviews.length} {reviews.length === 1 ? "bloque" : "bloques"}</span>
        </div>
        {reviews.length === 0 ? (
          <div className="empty-state compact">Todavía no hay bloques cerrados. Cuando completes una revisión, aparecerá aquí con sus tres conclusiones y todas sus manos.</div>
        ) : (
          <div className="review-archive-list">
            {reviews.map((batch) => (
              <details key={batch.id} className="review-archive">
                <summary>
                  <span className="review-archive-id">BLOQUE {String(batch.id).padStart(2, "0")}</span>
                  <strong>{batch.triggerType === "FIVE_ENTRIES" ? "Cinco entradas" : "Ciclo de siete días"}</strong>
                  <time>{batch.completedAt ? formatDate(batch.completedAt) : "Sin fecha"}</time>
                  <em>{(batch.checks ?? []).length} manos</em>
                </summary>
                <div className="review-archive-body">
                  <div className="review-conclusions">
                    <div><span>Patrón que se repite</span><p>{batch.repeatingPattern}</p></div>
                    <div><span>Señal de alerta ignorada</span><p>{batch.ignoredWarningSignal}</p></div>
                    <div><span>Regla para la próxima sesión</span><p>{batch.nextSessionRule}</p></div>
                  </div>
                  {(batch.checks ?? []).length === 0 ? (
                    <p className="archive-empty">Este bloque no tiene manos vinculadas, pero se conserva como registro histórico.</p>
                  ) : (
                    <div className="review-hands">
                      {(batch.checks ?? []).map((check) => <ReviewHand key={check.eliminationId} check={check} onSelect={() => selectEntry(check.eliminationId, true)} />)}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="panel history-calendar" aria-label="Mapa de actividad">
        <div className="calendar-intro">
          <h2>Tu mes en cuadros</h2>
          <p>La intensidad indica cuántas eliminaciones registraste. Los puntos distinguen pendientes y revisadas.</p>
          <div className="calendar-controls">
            <button type="button" className="calendar-arrow" aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>←</button>
            <input
              type="month"
              aria-label="Mes del calendario"
              value={calendarMonth}
              onChange={(event) => {
                if (!event.target.value) return;
                calendarInitialized.current = true;
                setCalendarMonth(event.target.value);
              }}
            />
            <button type="button" className="calendar-arrow" aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>→</button>
            <button type="button" className="text-button calendar-today" onClick={() => { calendarInitialized.current = true; setCalendarMonth(monthKey(new Date())); }}>Hoy</button>
          </div>
          <div className="calendar-legend">
            <span><i className="legend-swatch pending" /> Pendientes</span>
            <span><i className="legend-swatch reviewed" /> Revisadas</span>
            <span><i className="legend-swatch draft" /> Borradores</span>
            <span className="legend-scale">Menos <i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /> Más</span>
          </div>
          {selectedDay && <div className="calendar-filter-chip"><span>Mostrando <strong>{formatLongDate(selectedDay)}</strong></span><button type="button" onClick={clearDay}>Quitar filtro de fecha</button></div>}
        </div>
        <div className="calendar-main">
          <div className="calendar-grid" aria-label={`Calendario de actividad de ${calendar.label}`}>
            {WEEKDAYS.map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
            {calendar.cells.map((cell, index) => cell ? (
              <button
                key={cell.date}
                type="button"
                aria-pressed={selectedDay === cell.date}
                aria-label={dayTooltip(cell.date, cell.data)}
                title={dayTooltip(cell.date, cell.data)}
                data-tooltip={dayTooltip(cell.date, cell.data)}
                className={`calendar-day ${heatClass(cell.data)} ${selectedDay === cell.date ? "selected" : ""} ${cell.date === todayKey() ? "today" : ""}`}
                onClick={() => selectDay(cell.date)}
              >
                <span className="day-number">{cell.day}</span>
                {cell.data && cell.data.total > 0 && <em className="day-count">{cell.data.total}</em>}
                <span className="day-dots" aria-hidden="true">
                  {cell.data?.pending ? <i className="dot pending" /> : null}
                  {cell.data?.reviewed ? <i className="dot reviewed" /> : null}
                  {cell.data?.drafts ? <i className="dot draft" /> : null}
                </span>
              </button>
            ) : <span key={`empty-${index}`} className="calendar-day empty" aria-hidden="true" />)}
          </div>
        </div>
      </section>

      <section className="panel backup-panel">
        <div><h2>Tu información, bajo tu control.</h2><p>«Guardar progreso» crea <code>data/backup-latest.json</code> junto a la base. Descarga una copia completa o restaura una copia validada. La restauración conserva entradas, borradores, revisiones y secuencias permanentes.</p></div>
        <div className="backup-actions">
          <button className="button secondary" onClick={() => downloadUrl("/api/progress/backup")}>Descargar último respaldo</button>
          <button className="button secondary" onClick={() => downloadUrl("/api/backup/json")}>Descargar copia JSON</button>
          <button className="button secondary" onClick={() => downloadUrl("/api/backup/sqlite")}>Descargar SQLite</button>
          <label className={`button warning ${restoring ? "disabled" : ""}`}>Restaurar copia<input disabled={restoring} type="file" accept=".json,.db,.sqlite,application/json,application/x-sqlite3" onChange={(event) => { void restoreBackup(event.target.files?.[0]); event.target.value = ""; }} /></label>
        </div>
      </section>
      <p className="page-footnote">Los números de entrada son permanentes. El historial se ordena por la fecha de eliminación y muestra por defecto todas las entradas, incluidas las revisadas y los borradores.</p>
    </div>
  );
}

function ReviewHand({ check, onSelect }: { check: ReviewCheck; onSelect: () => void }) {
  const entry = check.elimination;
  return (
    <article className="review-hand">
      <div className="review-hand-head"><b>ENTRADA {String(entry.id).padStart(2, "0")}</b><Status entry={entry} /></div>
      <strong>{entry.tournamentName}</strong>
      <time>{formatDate(entry.eliminatedAt)}</time>
      <HandSummary entry={entry} compact />
      <button type="button" className="text-button" onClick={onSelect}>Ver entrada completa →</button>
    </article>
  );
}

function Status({ entry }: { entry: Elimination }) {
  const label = entry.status === "DRAFT" ? "Borrador" : entry.isReviewed ? "Completada - Revisada" : "Completada - Pendiente";
  return <span className={`status status-${entry.status === "DRAFT" ? "draft" : entry.isReviewed ? "reviewed" : "pending"}`}>{label}</span>;
}

function heatClass(day: ActivityDay | undefined): string {
  if (!day || day.total === 0) return "";
  const level = day.total >= 6 ? 4 : day.total >= 4 ? 3 : day.total >= 2 ? 2 : 1;
  const categories = [day.pending > 0, day.reviewed > 0, day.drafts > 0].filter(Boolean).length;
  const mix = categories > 1 ? "heat-mixed" : day.pending > 0 ? "heat-pending" : day.reviewed > 0 ? "heat-reviewed" : "heat-draft";
  return `has-entries ${mix} level-${level}`;
}

function dayTooltip(date: string, day: ActivityDay | undefined): string {
  const label = formatLongDate(date);
  if (!day || day.total === 0) return `${label} · Sin eliminaciones registradas`;
  return `${label} · ${day.total} ${day.total === 1 ? "eliminación" : "eliminaciones"} · ${day.pending} pendientes · ${day.reviewed} revisadas${day.drafts ? ` · ${day.drafts} borradores` : ""}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatLongDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function todayKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
