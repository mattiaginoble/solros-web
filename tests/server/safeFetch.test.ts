import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertPublicUrl, guardedGet, isPrivateIp, parseRobots, publicLookup, robotsAllows } from "@/lib/server/safeFetch";

describe("robots.txt", () => {
  const txt = `
User-agent: *
Disallow: /checkout
Disallow: /*?filter=
Allow: /checkout/help

User-agent: configuratorecasa
Disallow: /privato/
`;
  it("applica il gruppo specifico del nostro user agent se presente", () => {
    const rules = parseRobots(txt);
    expect(robotsAllows(rules, "/privato/x")).toBe(false);
    expect(robotsAllows(rules, "/checkout")).toBe(true);
  });

  it("altrimenti usa il gruppo generico, con la regola più lunga", () => {
    const rules = parseRobots(txt, "altrobot");
    expect(robotsAllows(rules, "/checkout/pay")).toBe(false);
    expect(robotsAllows(rules, "/checkout/help")).toBe(true);
    expect(robotsAllows(rules, "/divani?filter=blu")).toBe(false);
    expect(robotsAllows(rules, "/divani/lisa")).toBe(true);
  });

  it("Disallow: / blocca tutto", () => {
    expect(robotsAllows(parseRobots("User-agent: *\nDisallow: /"), "/qualsiasi")).toBe(false);
  });
});

describe("protezione SSRF", () => {
  it("rifiuta indirizzi privati, protocolli e porte non ammessi", async () => {
    for (const url of ["http://127.0.0.1/", "http://2130706433/", "http://[::ffff:127.0.0.1]/", "http://[::127.0.0.1]/", "http://[64:ff9b::7f00:1]/", "http://10.1.2.3/x", "http://192.168.1.1", "http://169.254.169.254/latest", "http://[::1]/", "ftp://example.com/", "http://localhost:3000/", "https://example.com:8443/", "http://user:pw@example.com/"]) {
      await expect(assertPublicUrl(url)).rejects.toThrow();
    }
  });

  it("accetta indirizzi IP pubblici", async () => {
    await expect(assertPublicUrl("https://93.184.216.34/prodotto")).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl("https://192.0.78.9/negozio")).resolves.toBeInstanceOf(URL);
  });

  it.each([
    "0.0.0.0", "127.0.0.1", "10.0.0.1", "100.64.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "192.0.0.8", "192.0.2.1", "198.18.0.1", "224.0.0.1",
    "::", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:1", "::7f00:1", "64:ff9b::7f00:1", "2002:7f00:1::", "2002:a9fe:a9fe::1",
    "fe80::1", "fe80::1%eth0", "fc00::1", "fd12:3456::1", "fec0::1", "ff02::1", "2001:db8::1", "2001::1", "100::1",
  ])("%s non è un indirizzo pubblico", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "192.0.78.9", "2606:4700::1111", "2a00:1450:4002::200e", "::ffff:5db8:d822", "64:ff9b::808:808", "2002:5db8:d822::1"])(
    "%s è un indirizzo pubblico",
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );

  it("il lookup usato per la connessione rifiuta nomi che risolvono a indirizzi interni", async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => publicLookup("localhost", {}, (e) => resolve(e)));
    expect(err?.code).toBe("EPRIVATE");
  });
});

describe("guardedGet", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/gzip") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" });
        res.end(gzipSync("<html>Divano è bello</html>"));
      } else if (req.url === "/grande") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("x".repeat(50_000));
      } else if (req.url === "/verso-interno") {
        res.writeHead(302, { location: "http://10.0.0.1/admin" });
        res.end();
      } else if (req.url === "/lento") {
        res.writeHead(200, { "content-type": "text/html" });
        res.write("<html>");
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it("decomprime le risposte gzip", async () => {
    const res = await guardedGet(new URL(`${base}/gzip`), "text/html", 10_000);
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    expect(res.body).toBe("<html>Divano è bello</html>");
  });

  it("tronca le risposte oltre la dimensione massima", async () => {
    const res = await guardedGet(new URL(`${base}/grande`), "text/html", 1000);
    expect(res.body).toHaveLength(1000);
  });

  it("rivalida la destinazione dei redirect", async () => {
    await expect(guardedGet(new URL(`${base}/verso-interno`), "text/html", 1000)).rejects.toMatchObject({ status: 400 });
  });

  it("rifiuta la connessione se il nome risolve a un indirizzo interno (DNS rebinding)", async () => {
    const port = new URL(base).port;
    await expect(guardedGet(new URL(`http://localhost:${port}/gzip`), "text/html", 1000)).rejects.toMatchObject({ status: 400 });
  });

  it("interrompe le risposte troppo lente", async () => {
    await expect(guardedGet(new URL(`${base}/lento`), "text/html", 1000, { timeoutMs: 200 })).rejects.toMatchObject({ status: 504 });
  });
});
