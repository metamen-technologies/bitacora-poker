import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import type { ActiveSaveResult, AppSummary } from "./types";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { EntryPage } from "./pages/EntryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ReviewPage } from "./pages/ReviewPage";

type NotificationState = NotificationPermission | "unsupported";
type ActiveSaveHandler = () => Promise<ActiveSaveResult>;

interface AppStateContextValue {
  summary: AppSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  notificationPermission: NotificationState;
  requestNotifications: () => Promise<void>;
  registerActiveSave: (handler: ActiveSaveHandler | null) => void;
  saveActiveForm: () => Promise<ActiveSaveResult>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("El estado de la aplicación no está disponible");
  return value;
}

export default function App() {
  const [summary, setSummary] = useState<AppSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationState>(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const activeSaveRef = useRef<ActiveSaveHandler | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api<AppSummary>("/api/state");
      setSummary(next);
    } catch {
      // Si el servidor local se está reiniciando, conservamos el último estado conocido.
    } finally {
      setLoading(false);
    }
  }, []);

  const requestNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    setNotificationPermission(await Notification.requestPermission());
  }, []);

  const registerActiveSave = useCallback((handler: ActiveSaveHandler | null) => {
    activeSaveRef.current = handler;
  }, []);

  const saveActiveForm = useCallback(async (): Promise<ActiveSaveResult> => {
    const handler = activeSaveRef.current;
    if (!handler) return { saved: false, message: "No hay un formulario activo que guardar." };
    return handler();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const checkForChanges = () => { void refresh(); };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") checkForChanges();
    };
    const interval = window.setInterval(checkForChanges, 60_000);
    window.addEventListener("focus", checkForChanges);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkForChanges);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const pending = summary?.pendingBatch;
    if (!pending) return;

    const notificationKey = `revision-notificada-${pending.id}`;
    if (notificationPermission === "granted" && !sessionStorage.getItem(notificationKey)) {
      new Notification("Revisión obligatoria pendiente", {
        body: "Revisa cada entrada y define una regla concreta antes de finalizar nuevas manos.",
        tag: `revision-${pending.id}`,
      });
      sessionStorage.setItem(notificationKey, "1");
    }
    // No redirigimos a /revision: el aviso vive en el banner y en el menú lateral.
    // Así el historial, los borradores y los bloques cerrados nunca quedan ocultos.
  }, [notificationPermission, summary?.pendingBatch]);

  const context = useMemo(
    () => ({ summary, loading, refresh, notificationPermission, requestNotifications, registerActiveSave, saveActiveForm }),
    [summary, loading, refresh, notificationPermission, requestNotifications, registerActiveSave, saveActiveForm],
  );

  return (
    <AppStateContext.Provider value={context}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/registro" element={<EntryPage />} />
          <Route path="/registro/:id" element={<EntryPage />} />
          <Route path="/historial" element={<HistoryPage />} />
          <Route path="/revision" element={<ReviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppStateContext.Provider>
  );
}
