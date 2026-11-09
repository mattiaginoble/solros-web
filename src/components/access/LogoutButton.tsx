"use client";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ACCESS_HINT_COOKIE } from "@/lib/access";

const subscribe = () => () => {};
const hasAccessCookie = () => document.cookie.split(";").some((c) => c.trim() === `${ACCESS_HINT_COOKIE}=1`);

/** "Esci": visibile solo quando il sito è protetto da password e si è entrati. */
export function LogoutButton() {
  const router = useRouter();
  const visible = useSyncExternalStore(subscribe, hasAccessCookie, () => false);
  if (!visible) return null;
  return (
    <button
      type="button"
      className="text-sm font-medium text-graphite-soft hover:text-prussian"
      onClick={async () => {
        await fetch("/api/access", { method: "DELETE" }).catch(() => {});
        router.replace("/accesso");
      }}
    >
      Esci
    </button>
  );
}
