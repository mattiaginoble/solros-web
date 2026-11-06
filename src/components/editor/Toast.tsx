"use client";
import { useEffect, useState } from "react";
import { useEditor } from "@/store/editor";

/** Avvisi brevi (vincoli violati, salvataggi, errori). */
export function Toast() {
  const notice = useEditor((s) => s.notice);
  const [hiddenId, setHiddenId] = useState<number | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setHiddenId(notice.id), notice.tone === "error" ? 6000 : 3800);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice || hiddenId === notice.id) return null;
  const tone =
    notice.tone === "error"
      ? "border-danger bg-danger-tint text-danger"
      : notice.tone === "warning"
        ? "border-warning bg-warning-tint text-warning"
        : "border-line-strong bg-panel text-graphite";
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center px-4">
      <div className={`pointer-events-auto max-w-md rounded-[6px] border px-4 py-2.5 text-sm shadow-[0_10px_30px_-15px_rgba(35,39,43,0.5)] ${tone}`}>
        {notice.text}
      </div>
    </div>
  );
}
