import { SharedLoader } from "@/components/editor/SharedLoader";

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  return <SharedLoader token={token} />;
}
