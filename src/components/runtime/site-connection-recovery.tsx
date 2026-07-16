"use client";

import { useEffect } from "react";

const recoveryStorageKey = "bouncecore.connection.lastDeploymentRecovery";
const recoveryCooldownMs = 30_000;

export function isStaleDeploymentError(value: unknown) {
  const message =
    value instanceof Error
      ? `${value.name} ${value.message}`
      : typeof value === "string"
        ? value
        : value && typeof value === "object" && "message" in value
          ? String(value.message)
          : "";
  const normalized = message.toLowerCase();

  return normalized.includes("failed to find server action") ||
    (normalized.includes("server action") && normalized.includes("older or newer deployment"));
}

export function SiteConnectionRecovery() {
  useEffect(() => {
    let recovering = false;

    function recoverFromStaleDeployment(value: unknown) {
      if (recovering || !isStaleDeploymentError(value)) {
        return;
      }

      const now = Date.now();
      const previousRecoveryAt = Number(window.sessionStorage.getItem(recoveryStorageKey) ?? 0);

      if (Number.isFinite(previousRecoveryAt) && now - previousRecoveryAt < recoveryCooldownMs) {
        return;
      }

      recovering = true;
      window.sessionStorage.setItem(recoveryStorageKey, String(now));
      window.location.reload();
    }

    function handleWindowError(event: ErrorEvent) {
      recoverFromStaleDeployment(event.error ?? event.message);
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      recoverFromStaleDeployment(event.reason);
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
