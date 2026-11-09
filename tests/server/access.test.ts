import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { DELETE, POST } from "@/app/api/access/route";
import { accessToken, safeRedirectPath } from "@/lib/access";
import { config, proxy } from "@/proxy";

const PASSWORD = "una-password-di-prova";
afterEach(() => {
  delete process.env.SITE_PASSWORD;
});
const req = (path: string, cookie?: string) => new NextRequest(`https://casa.example.com${path}`, { headers: cookie ? { cookie } : {} });
const login = (password: string, ip: string) =>
  POST(new Request("https://casa.example.com/api/access", { method: "POST", body: JSON.stringify({ password }), headers: { "x-forwarded-for": ip } }));

describe("accesso riservato", () => {
  it("senza SITE_PASSWORD il sito resta aperto", async () => {
    const res = await proxy(req("/editor/abc"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("con SITE_PASSWORD manda le pagine alla password e blocca le API", async () => {
    process.env.SITE_PASSWORD = PASSWORD;
    const page = await proxy(req("/editor/abc?azione=rettangolo"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("https://casa.example.com/accesso?da=%2Feditor%2Fabc%3Fazione%3Drettangolo");
    const api = await proxy(req("/api/projects"));
    expect(api.status).toBe(401);
    const wrong = await proxy(req("/api/projects", "cc_access=falso"));
    expect(wrong.status).toBe(401);
    const ok = await proxy(req("/api/projects", `cc_access=${await accessToken(PASSWORD)}`));
    expect(ok.headers.get("x-middleware-next")).toBe("1");
  });

  it("un cambio di password invalida gli accessi precedenti", async () => {
    process.env.SITE_PASSWORD = "nuova-password";
    const res = await proxy(req("/", `cc_access=${await accessToken(PASSWORD)}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://casa.example.com/accesso");
  });

  it("esclude dal controllo accesso, link di condivisione e file statici", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const p of ["/", "/editor/abc", "/api/projects", "/catalogo", "/configuratori", "/api/admin/projects", "/pdf.worker.min.mjs"]) expect(re.test(p), p).toBe(true);
    for (const p of ["/accesso", "/api/access", "/share/abc123", "/api/share/abc123", "/api/cron/store-sync", "/_next/static/x.js", "/icon.svg", "/esempio-feed.xml"]) {
      expect(re.test(p), p).toBe(false);
    }
  });

  it("la route di accesso imposta il cookie solo con la password giusta e limita i tentativi", async () => {
    process.env.SITE_PASSWORD = PASSWORD;
    const bad = await login("sbagliata", "10.0.0.1");
    expect(bad.status).toBe(401);
    expect(bad.headers.get("set-cookie")).toBeNull();
    const ok = await login(PASSWORD, "10.0.0.1");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain(`cc_access=${await accessToken(PASSWORD)}`);
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    for (let i = 0; i < 10; i++) await login("sbagliata", "10.0.0.2");
    expect((await login(PASSWORD, "10.0.0.2")).status).toBe(429);
    expect((await login(PASSWORD, "10.0.0.3")).status).toBe(200);
    expect((await DELETE()).headers.get("set-cookie")).toMatch(/cc_access=;/);
  });

  it("dopo l'accesso torna solo a percorsi interni", () => {
    expect(safeRedirectPath("/editor/abc?x=1")).toBe("/editor/abc?x=1");
    for (const p of ["https://evil.example", "//evil.example", "/\\evil.example", "", null]) expect(safeRedirectPath(p)).toBe("/");
  });
});
