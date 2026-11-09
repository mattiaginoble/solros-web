import { AccessForm } from "@/components/access/AccessForm";
import { safeRedirectPath } from "@/lib/access";

export const metadata = { title: "Accesso — Configuratore Casa", robots: { index: false } };

/** Pagina della password del sito (solo con il server). */
export default async function AccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <AccessForm next={safeRedirectPath(typeof sp.da === "string" ? sp.da : null)} />;
}
