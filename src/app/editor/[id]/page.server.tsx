import { EditorLoader } from "@/components/editor/EditorLoader";

/** Editor di un progetto salvato sul server (la build statica usa /editor/?id=…). */
export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const action = typeof sp.azione === "string" ? sp.azione : null;
  return <EditorLoader id={id} action={action} />;
}
