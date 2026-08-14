import { AppState, type AppStateStatus } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { io } from "socket.io-client";

type RealtimeValue = { booksRevision: number; connected: boolean };
const RealtimeContext = createContext<RealtimeValue>({ booksRevision: 0, connected: false });

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
const socketUrl = apiUrl.replace(/\/api\/?$/, "");

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [booksRevision, setBooksRevision] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(socketUrl, { transports: ["websocket", "polling"], reconnection: true });
    const invalidate = () => setBooksRevision((value) => value + 1);
    const onAppState = (state: AppStateStatus) => {
      if (state === "active") invalidate();
    };
    socket.on("connect", () => { setConnected(true); invalidate(); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("books:changed", invalidate);
    const subscription = AppState.addEventListener("change", onAppState);
    return () => { subscription.remove(); socket.disconnect(); };
  }, []);

  const value = useMemo(() => ({ booksRevision, connected }), [booksRevision, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
