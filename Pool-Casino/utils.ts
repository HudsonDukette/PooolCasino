import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useEffect, useState } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(amount);
}

export function useCasinoId(): number | undefined {
  const [casinoId, setCasinoId] = useState<number | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("casinoId");
    if (raw) {
      const parsed = parseInt(raw);
      if (!isNaN(parsed)) setCasinoId(parsed);
    }
  }, []);
  return casinoId;
}
