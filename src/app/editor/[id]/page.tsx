import { EditorLoader } from "@/components/editor/EditorLoader";

export default async function EditorPage({ params, searchParams }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const action = typeof sp.azione === "string" ? sp.azione : null;
  return <EditorLoader id={id} action={action} />;
}
