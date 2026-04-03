import { useEffect, useRef } from "react";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(userId: number | undefined) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId || subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const setup = async () => {
      try {
        const reg = await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: "/" });
        await navigator.serviceWorker.ready;

        if (Notification.permission === "denied") return;

        const permission = Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
        if (permission !== "granted") return;

        const { publicKey } = await apiFetch("api/push/vapid-key");
        if (!publicKey) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        await apiFetch("api/push/subscribe", {
          method: "POST",
          body: JSON.stringify(sub.toJSON()),
        });

        subscribedRef.current = true;
      } catch {
      }
    };

    setup();
  }, [userId]);
}
