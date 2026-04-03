import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";
import { useGetMe, useGetPool } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { CasinoGameEditor, type PayTableEntry } from "@/components/casino-game-editor";

interface GameShellProps {
  title: string;
  description: string;
  accentColor?: string;
  heroImage?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  casinoId?: number;
  gameType?: string;
  payTableEntries?: PayTableEntry[];
  onEditorSaved?: (payouts: Record<string, number>, multiplier: number) => void;
  skipOwnerEditor?: boolean;
}

export function GameShell({ title, description, accentColor = "text-primary", heroImage, backHref = "/games", backLabel, children, casinoId, gameType, payTableEntries, onEditorSaved, skipOwnerEditor }: GameShellProps) {
  const label = backLabel ?? (backHref === "/games" ? "All Games" : "Back to Casino");
  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-4">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            {label}
          </Button>
        </Link>
      </div>
      {heroImage && (
        <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-white/10">
          <img src={heroImage} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h1 className={`text-3xl md:text-4xl font-display font-bold ${accentColor}`}>{title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
          </div>
        </div>
      )}
      {!heroImage && (
        <div className="space-y-1">
          <h1 className={`text-3xl md:text-4xl font-display font-bold ${accentColor}`}>{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      )}
      {children}
      {!skipOwnerEditor && casinoId && gameType && (
        <CasinoGameEditor
          casinoId={casinoId}
          gameType={gameType}
          payTableEntries={payTableEntries}
          onSaved={onEditorSaved}
        />
      )}
    </div>
  );
}

interface BetInputProps {
  value: string;
  onChange: (v: string) => void;
  max?: number;
  disabled?: boolean;
}

export function BetInput({ value, onChange, max, disabled }: BetInputProps) {
  const { data: user } = useGetMe({ query: { retry: false } });
  const balance = user ? parseFloat(String(user.balance)) : 0;
  const effectiveMax = Math.min(max ?? balance, balance);

  const presets = [1, 5, 10, 50, 100, 500];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
          <Input
            type="number"
            min={0.01}
            step={0.01}
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className="pl-7 font-mono bg-black/40 border-white/10 text-white"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-white/10"
          disabled={disabled}
          onClick={() => onChange(String(Math.max(0.01, (parseFloat(value) || 0) / 2)))}
        >
          ½
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-white/10"
          disabled={disabled}
          onClick={() => onChange(String(Math.min(effectiveMax, (parseFloat(value) || 0) * 2)))}
        >
          2×
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-white/10"
          disabled={disabled}
          onClick={() => onChange(String(effectiveMax))}
        >
          Max
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button
            key={p}
            disabled={disabled || p > effectiveMax}
            onClick={() => onChange(String(p))}
            className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 font-mono transition-colors"
          >
            ${p}
          </button>
        ))}
      </div>
      {user && (
        <p className="text-xs text-muted-foreground">
          Balance: <span className="text-primary font-mono">{formatCurrency(balance)}</span>
        </p>
      )}
    </div>
  );
}

export function ResultCard({ won, payout, label, children }: {
  won?: boolean | null;
  payout?: number;
  label?: string;
  children?: React.ReactNode;
}) {
  if (won === undefined || won === null) return null;
  return (
    <Card className={`border ${won ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className={`text-2xl font-display font-bold ${won ? "text-primary" : "text-destructive"}`}>
            {label ?? (won ? "You Win!" : "You Lose")}
          </p>
          {children}
        </div>
        {payout !== undefined && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Payout</p>
            <p className={`text-2xl font-mono font-bold ${won ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(payout)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function usePool() {
  const { data: pool } = useGetPool({ query: { refetchInterval: 10000 } });
  return { poolTotal: parseFloat(String(pool?.totalAmount ?? "1000")), maxBet: parseFloat(String(pool?.maxBet ?? "10000")) };
}
