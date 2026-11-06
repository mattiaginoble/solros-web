import { describe, expect, it } from "vitest";
import { assertPublicUrl, parseRobots, robotsAllows } from "@/lib/server/safeFetch";

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
    for (const url of ["http://127.0.0.1/", "http://10.1.2.3/x", "http://192.168.1.1", "http://169.254.169.254/latest", "http://[::1]/", "ftp://example.com/", "http://localhost:3000/", "https://example.com:8443/", "http://user:pw@example.com/"]) {
      await expect(assertPublicUrl(url)).rejects.toThrow();
    }
  });

  it("accetta indirizzi IP pubblici", async () => {
    await expect(assertPublicUrl("https://93.184.216.34/prodotto")).resolves.toBeInstanceOf(URL);
  });
});
