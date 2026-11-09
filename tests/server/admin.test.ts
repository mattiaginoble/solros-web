import { describe, expect, it } from "vitest";
import { assertAdmin } from "@/lib/server/admin";

const token = "x".repeat(40);
const req = (auth?: string) => new Request("http://localhost/api/admin/projects", { headers: auth ? { authorization: auth } : {} });

describe("route di manutenzione", () => {
  it("non esistono senza un token amministratore lungo", () => {
    expect(() => assertAdmin(req(`Bearer ${token}`), undefined)).toThrow();
    expect(() => assertAdmin(req("Bearer corto"), "corto")).toThrow();
  });
  it("rifiutano token mancanti o sbagliati con 404", () => {
    for (const auth of [undefined, "Bearer sbagliato", `Bearer ${token}y`]) {
      try {
        assertAdmin(req(auth), token);
        throw new Error("doveva fallire");
      } catch (e) {
        expect((e as { status?: number }).status).toBe(404);
      }
    }
  });
  it("accettano il token corretto", () => {
    expect(() => assertAdmin(req(`Bearer ${token}`), token)).not.toThrow();
  });
});
