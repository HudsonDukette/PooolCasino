import { useState, useCallback } from "react";

export function useGameApi<T = Record<string, unknown>>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const call = useCallback(async (path: string, body: unknown): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setData(json as T);
      return json as T;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { call, loading, error, data, reset };
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function useUserBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/user/me", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setBalance(parseFloat(d.balance));
      }
    } catch {}
  }, []);
  return { balance, refresh };
}
