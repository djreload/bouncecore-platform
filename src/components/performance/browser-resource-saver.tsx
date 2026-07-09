"use client";

import { useEffect } from "react";
import { isBouncecoreAndroidUserAgent } from "@/lib/runtime/mobile-app-runtime";

export function BrowserResourceSaver() {
  useEffect(() => {
    const root = document.documentElement;
    const isAndroidWebView = isBouncecoreAndroidUserAgent(window.navigator.userAgent);

    root.dataset.bcAndroidWebview = isAndroidWebView ? "true" : "false";

    function applyVisibilityState() {
      root.dataset.bcPageVisibility = document.visibilityState;
      root.classList.toggle("bc-page-hidden", document.visibilityState === "hidden");
    }

    applyVisibilityState();
    document.addEventListener("visibilitychange", applyVisibilityState);

    return () => {
      document.removeEventListener("visibilitychange", applyVisibilityState);
      delete root.dataset.bcAndroidWebview;
      delete root.dataset.bcPageVisibility;
      root.classList.remove("bc-page-hidden");
    };
  }, []);

  return null;
}
