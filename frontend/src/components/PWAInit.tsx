"use client";

import { useEffect } from "react";

export function PWAInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !window.location.search.includes("pwa=1")) return;

    const url = "/sw.js";
    navigator.serviceWorker
      .register(url)
      .catch((err) => console.warn("sw: register failed", err));
  }, []);

  return null;
}
