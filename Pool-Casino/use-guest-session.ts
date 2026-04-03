import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("poolcasino_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("poolcasino_device_id", id);
  }
  return id;
}

export function useGuestSession(isLoggedIn: boolean, isLoading: boolean) {
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (isLoggedIn) return;
    if (initialized.current) return;
    initialized.current = true;

    const deviceId = getOrCreateDeviceId();

    fetch("/api/auth/guest/init", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    })
      .then((r) => {
        if (r.ok) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }
      })
      .catch(() => {});
  }, [isLoggedIn, isLoading, queryClient]);
}
