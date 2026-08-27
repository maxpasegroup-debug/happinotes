"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app";

/** Refreshes server-rendered catalog data when an admin changes a book/episode. */
export function CatalogRealtime() {
  const router = useRouter();

  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket", "polling"] });
    const refresh = () => router.refresh();
    socket.on("books:changed", refresh);
    return () => {
      socket.off("books:changed", refresh);
      socket.disconnect();
    };
  }, [router]);

  return null;
}
