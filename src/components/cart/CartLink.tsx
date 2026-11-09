"use client";
import Link from "next/link";
import { useCartCount } from "@/store/cart";

/** Link al carrello con il numero di pezzi. */
export function CartLink({ className = "" }: { className?: string }) {
  const count = useCartCount();
  return (
    <Link href="/carrello" className={`inline-flex items-center gap-1.5 text-sm font-medium hover:text-prussian ${className}`}>
      Carrello
      {count > 0 && <span className="min-w-5 rounded-full bg-prussian px-1.5 text-center text-xs text-white tabular-nums">{count}</span>}
    </Link>
  );
}
