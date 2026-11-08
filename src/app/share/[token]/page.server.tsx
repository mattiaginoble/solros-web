import { SharedLoader } from "@/components/editor/SharedLoader";

/** Progetto condiviso in sola lettura (solo con il server). */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedLoader token={token} />;
}
