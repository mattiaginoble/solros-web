import { describe, expect, it } from "vitest";
import { readJson } from "@/lib/server/http";

/** Richiesta con body in streaming (senza content-length) che conta i blocchi letti. */
function streamingRequest(chunks: number, chunkSize: number) {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (pulled >= chunks) return ctrl.close();
      pulled++;
      ctrl.enqueue(new Uint8Array(chunkSize).fill(32));
    },
  });
  const req = new Request("http://localhost/api", { method: "POST", body, duplex: "half" } as RequestInit);
  return { req, pulled: () => pulled };
}

describe("readJson", () => {
  it("interrompe la lettura appena il body supera il limite, anche senza content-length", async () => {
    const { req, pulled } = streamingRequest(200, 64 * 1024);
    await expect(readJson(req, 100_000)).rejects.toMatchObject({ status: 413 });
    expect(pulled()).toBeLessThan(5);
  });

  it("legge JSON valido e rifiuta quello malformato", async () => {
    const ok = new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ nome: "Cucina è" }) });
    await expect(readJson(ok)).resolves.toEqual({ nome: "Cucina è" });
    const bad = new Request("http://localhost/api", { method: "POST", body: "{non json" });
    await expect(readJson(bad)).rejects.toMatchObject({ status: 400 });
  });

  it("rifiuta subito un content-length oltre il limite", async () => {
    const req = new Request("http://localhost/api", { method: "POST", body: "{}", headers: { "content-length": "999999" } });
    await expect(readJson(req, 1000)).rejects.toMatchObject({ status: 413 });
  });
});
