"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useEditor } from "@/store/editor";
import { Editor } from "./Editor";

/** Vista in sola lettura di un progetto condiviso tramite link. */
export function SharedLoader({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    api
      .getShared(token)
      .then(({ project }) => {
        useEditor.getState().load(project.data, { projectId: null, readOnly: true });
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [token]);
  if (state === "loading")
    return <div className="paper-grid flex h-dvh items-center justify-center text-sm text-muted">Apertura del progetto condiviso…</div>;
  if (state === "error")
    return (
      <div className="paper-grid flex h-dvh items-center justify-center p-6">
        <div className="max-w-sm rounded-[8px] border border-line-strong bg-panel p-6">
          <p className="font-semibold">Il link non è valido oppure è stato revocato dal proprietario.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-prussian underline">
            Vai al Configuratore Casa
          </Link>
        </div>
      </div>
    );
  return <Editor />;
}
