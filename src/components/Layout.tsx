import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api, downloadUrl } from "../api";
import { useAppState } from "../App";
import type { ProgressSaveResult } from "../types";

const TITLES: Record<string, string> = {
  "/": "Inicio",
  "/registro": "Registro de eliminación",
  "/historial": "Historial de eliminaciones",
  "/revision": "Revisión obligatoria",
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function Layout({ children }: { children: ReactNode }) {
  const { summary, notificationPermission, requestNotifications, saveActiveForm, refresh } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingBatch = summary?.pendingBatch;
  const reviewedInBatch = pendingBatch?.checks.filter((check) => check.checkedInReview).length ?? 0;
  const progress = pendingBatch ? reviewedInBatch : Math.min(summary?.counts.pending ?? 0, 5);
  const progressLabel = pendingBatch
    ? `${reviewedInBatch} de ${pendingBatch.checks.length} entradas revisadas`
    : `${progress} de 5 entradas`;
  const titleKey = location.pathname.startsWith("/registro") ? "/registro" : location.pathname;

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedLabel, setSavedLabel] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const messageTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => () => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
  }, []);

  function showMessage(next: string) {
    setMessage(next);
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 6000);
  }

  async function saveProgress() {
    if (saveState === "saving") return;
    setSaveState("saving");
    setMessage(null);
    try {
      const active = await saveActiveForm();
      const result = await api<ProgressSaveResult>("/api/progress/save", { method: "POST" });
      await refresh();
      const time = new Date(result.savedAt).toLocaleTimeString("es-MX", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setSavedLabel(`Progreso guardado • ${time}`);
      setSaveState("saved");
      showMessage(active.saved
        ? `Borrador activo guardado y base asegurada en ${result.backupPath}.`
        : `${active.message ?? "No había un borrador completo que guardar."} La base quedó asegurada en ${result.backupPath}.`);
      window.setTimeout(() => setSaveState("idle"), 7000);
    } catch (caught) {
      setSaveState("error");
      showMessage(caught instanceof Error ? caught.message : "No se pudo guardar el progreso local.");
    }
  }

  async function restoreLatest() {
    setMenuOpen(false);
    if (!window.confirm("Restaurar el último respaldo reemplazará todos los datos actuales. ¿Quieres continuar?")) return;
    setSaveState("saving");
    try {
      await api("/api/progress/restore", { method: "POST" });
      await refresh();
      window.dispatchEvent(new Event("river:data-restored"));
      // Evita que un formulario abierto antes de restaurar sobrescriba los datos recuperados.
      navigate("/historial", { replace: true });
      setSaveState("saved");
      setSavedLabel("Respaldo restaurado");
      showMessage("Último respaldo restaurado y validado correctamente.");
      window.setTimeout(() => setSaveState("idle"), 7000);
    } catch (caught) {
      setSaveState("error");
      showMessage(caught instanceof Error ? caught.message : "No se pudo restaurar el último respaldo.");
    }
  }

  const buttonLabel = saveState === "saving"
    ? "Guardando…"
    : saveState === "saved"
      ? savedLabel
      : saveState === "error"
        ? "Reintentar guardado"
        : "Guardar progreso";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="Ir al inicio">
          <span className="brand-mark">♠</span>
          <span><strong>RIVER</strong><small>NOTES</small></span>
        </NavLink>
        <p className="eyebrow sidebar-heading">TU JUEGO, EN PERSPECTIVA</p>
        <nav className="main-nav" aria-label="Navegación principal">
          <NavItem to="/" number="00" label="Inicio" />
          <NavItem to="/registro" number="01" label="Registrar eliminación" />
          <NavItem to="/historial" number="02" label="Historial" badge={summary?.counts.total} />
          <NavItem to="/revision" number="03" label="Revisión de bloque" alert={Boolean(summary?.pendingBatch)} />
        </nav>
        <div className="discipline-card">
          <span className="eyebrow">ESTUDIO CON INTENCIÓN</span>
          <strong>{pendingBatch ? `Revisión ${String(pendingBatch.id).padStart(2, "0")}` : "Próximo bloque"}</strong>
          <p>{progressLabel}</p>
          <div className="progress-pips" aria-label={progressLabel}>
            {[0, 1, 2, 3, 4].map((index) => <i key={index} className={index < progress ? "active" : ""} />)}
          </div>
          <small>{pendingBatch ? "Tu revisión está lista. Haz una pausa para aprender." : "Las entradas completadas construyen tu próximo bloque."}</small>
        </div>
        <div className="sidebar-footer"><span>● Solo en este equipo</span><small>Datos locales · v1.0</small></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div><span>Mi espacio</span><b>/</b><strong>{TITLES[titleKey] ?? "River Notes"}</strong></div>
          <div className="top-actions">
            <span className="local-badge">LOCAL</span>
            <div className="progress-save-wrap" ref={menuRef}>
              <button
                type="button"
                className={`save-progress-button ${saveState === "saved" ? "saved" : saveState === "error" ? "error" : ""}`}
                disabled={saveState === "saving"}
                onClick={() => void saveProgress()}
                title="Guarda el formulario activo, ejecuta WAL checkpoint y crea data/backup-latest.json"
              >
                {buttonLabel}
              </button>
              <button
                type="button"
                className="save-menu-toggle"
                aria-label="Opciones de respaldo"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                ▾
              </button>
              {menuOpen && (
                <div className="save-menu" role="menu">
                  <span className="save-menu-title">RESPALDO LOCAL</span>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); downloadUrl("/api/progress/backup"); }}>Descargar backup-latest.json</button>
                  <button type="button" role="menuitem" onClick={() => void restoreLatest()}>Restaurar último respaldo</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); downloadUrl("/api/backup/json"); }}>Descargar JSON completo</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); downloadUrl("/api/backup/sqlite"); }}>Descargar SQLite</button>
                  <small>El respaldo se escribe junto a la base de datos.</small>
                </div>
              )}
            </div>
            {notificationPermission === "granted" ? (
              <span className="notification-state">Notificaciones activas</span>
            ) : notificationPermission === "unsupported" ? (
              <span className="notification-state">Notificaciones no disponibles</span>
            ) : notificationPermission === "denied" ? (
              <span className="notification-state">Notificaciones bloqueadas</span>
            ) : (
              <button type="button" className="text-button" onClick={() => void requestNotifications()}>Activar notificaciones</button>
            )}
          </div>
        </header>
        {summary?.pendingBatch && location.pathname !== "/revision" && (
          <NavLink to="/revision" className="lock-banner">
            <strong>Revisión obligatoria pendiente</strong>
            <span>Puedes guardar borradores, pero no finalizar entradas hasta cerrar el bloque. El historial sigue disponible.</span>
            <b>Revisar ahora →</b>
          </NavLink>
        )}
        <main className="main-content">{children}</main>
      </div>
      {message && <div className="toast" role="status">{message}</div>}
    </div>
  );
}

function NavItem({ to, number, label, badge, alert }: { to: string; number: string; label: string; badge?: number; alert?: boolean }) {
  return (
    <NavLink to={to} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
      <span>{number}</span><strong>{label}</strong>
      {badge !== undefined && <em>{String(badge).padStart(2, "0")}</em>}
      {alert && <i className="alert-dot" aria-label="Revisión pendiente" />}
    </NavLink>
  );
}
