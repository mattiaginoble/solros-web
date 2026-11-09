"use client";
import { useState } from "react";
import { Button } from "@/components/ui/controls";

export function AccessForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Accesso non riuscito");
      window.location.assign(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accesso non riuscito");
      setBusy(false);
    }
  };
  return (
    <main className="paper-grid flex min-h-dvh items-center justify-center bg-paper p-5">
      <form
        className="w-full max-w-sm rounded-[6px] border border-line-strong bg-panel p-6 shadow-[0_12px_30px_-18px_rgba(35,39,43,0.45)]"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1 className="text-lg font-semibold">Configuratore Casa</h1>
        <p className="mt-1 text-sm text-graphite-soft">Sito riservato: inserisci la password per entrare.</p>
        <label className="mt-5 flex flex-col gap-1">
          <span className="text-xs text-muted">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-[5px] border border-line-strong bg-panel px-3 text-sm outline-none focus:border-prussian"
          />
        </label>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy || !password} className="mt-5 w-full">
          {busy ? "Verifica…" : "Entra"}
        </Button>
      </form>
    </main>
  );
}
