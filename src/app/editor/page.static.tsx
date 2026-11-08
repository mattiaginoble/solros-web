"use client";
/** Editor nella build statica: il progetto è indicato da ?id= perché non ci sono percorsi dinamici. */
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EditorLoader } from "@/components/editor/EditorLoader";

function StaticEditor() {
  const sp = useSearchParams();
  const id = sp.get("id");
  if (!id) {
    return <p className="p-8 text-sm text-graphite-soft">Nessun progetto indicato: torna alla home e aprine uno.</p>;
  }
  return <EditorLoader key={id} id={id} action={sp.get("azione")} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <StaticEditor />
    </Suspense>
  );
}
