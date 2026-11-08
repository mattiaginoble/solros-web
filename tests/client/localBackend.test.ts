import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { createRectRoom } from "@/domain/factory";
import { localBackend as api } from "@/lib/client/localBackend";

const product = (id: string, name: string, price: number) => ({
  id,
  name,
  category: "Soggiorno",
  width: 100,
  depth: 50,
  height: 80,
  price,
  currency: "EUR",
  priceUpdatedAt: "2026-11-08",
  source: "import" as const,
  retailer: "Negozio Prova",
  mount: "floor" as const,
  clearance: { front: 0, sides: 0 },
});

describe("archivio nel browser (versione statica)", () => {
  it("elenca le case di esempio in sola lettura e ne crea copie modificabili", async () => {
    const { projects, examples } = await api.listProjects();
    expect(projects).toHaveLength(0);
    expect(examples.map((e) => e.id)).toContain("esempio-bilocale");
    const { project: ex } = await api.getProject("esempio-bilocale");
    expect(ex.readOnly).toBe(true);
    const { project } = await api.createProject({ fromExampleId: "esempio-bilocale" });
    expect(project.readOnly).toBe(false);
    expect(project.stats.rooms).toBe(ex.stats.rooms);
    expect(project.data.floors[0].rooms[0].id).not.toBe(ex.data.floors[0].rooms[0].id);
  });

  it("crea, salva, duplica ed elimina un progetto", async () => {
    const { project } = await api.createProject({ name: "Casa al mare" });
    const house = { ...project.data, name: "Casa al mare rinnovata" };
    house.floors[0].rooms.push(createRectRoom(400, 300));
    await api.saveProject(project.id, house);
    const { project: saved } = await api.getProject(project.id);
    expect(saved.name).toBe("Casa al mare rinnovata");
    expect(saved.stats.rooms).toBe(1);
    const { project: copy } = await api.duplicateProject(project.id);
    expect(copy.name).toBe("Casa al mare rinnovata (copia)");
    await api.deleteProject(project.id);
    await expect(api.getProject(project.id)).rejects.toMatchObject({ status: 404 });
    const ids = (await api.listProjects()).projects.map((p) => p.id);
    expect(ids).toContain(copy.id);
    expect(ids).not.toContain(project.id);
  });

  it("non modifica né elimina le case di esempio", async () => {
    const { project } = await api.getProject("esempio-monolocale");
    await expect(api.saveProject("esempio-monolocale", project.data)).rejects.toMatchObject({ status: 403 });
    await expect(api.deleteProject("esempio-monolocale")).rejects.toMatchObject({ status: 403 });
  });

  it("rifiuta documenti casa non validi", async () => {
    await expect(api.createProject({ data: { nonUnaCasa: true } as never })).rejects.toMatchObject({ status: 422 });
  });

  it("cerca nel catalogo demo e nei prodotti importati, poi elimina il lotto", async () => {
    const demo = await api.searchCatalog({ limit: 500 });
    expect(demo.total).toBe(DEMO_PRODUCTS.length);
    expect(demo.providers.map((p) => p.id)).not.toContain("link");
    await api.importProducts("Listino prova", [product("imp-1", "Divano Prova", 500), product("imp-2", "Poltrona Prova", 200)]);
    const found = await api.searchCatalog({ q: "Prova", source: ["import"] });
    expect(found.items.map((p) => p.name).sort()).toEqual(["Divano Prova", "Poltrona Prova"]);
    expect((await api.listImportBatches()).batches).toEqual([expect.objectContaining({ batch: "Listino prova", count: 2 })]);
    // Reimport dello stesso lotto: aggiorna senza duplicare
    await api.importProducts("Listino prova", [product("imp-1", "Divano Prova", 450)]);
    const again = await api.searchCatalog({ q: "Divano Prova" });
    expect(again.items.filter((p) => p.id === "imp-1").map((p) => p.price)).toEqual([450]);
    expect(await api.deleteImportBatch("Listino prova")).toEqual({ deleted: 2 });
    expect((await api.searchCatalog({ q: "Prova", source: ["import"] })).total).toBe(0);
  });

  it("salva prodotti manuali, protegge quelli demo e segnala le funzioni senza server", async () => {
    const { product: p } = await api.saveProduct({ ...product("x", "Libreria su misura", 300), source: "link", url: "javascript:alert(1)" });
    expect(p.source).toBe("manual");
    expect(p.url).toBeUndefined();
    expect((await api.searchCatalog({ q: "Libreria su misura" })).items[0]?.id).toBe(p.id);
    await api.deleteProduct(p.id);
    await expect(api.deleteProduct(DEMO_PRODUCTS[0].id)).rejects.toMatchObject({ status: 403 });
    await expect(api.readProductLink("https://esempio.it")).rejects.toMatchObject({ status: 501 });
    await expect(api.shareProject("qualsiasi")).rejects.toMatchObject({ status: 501 });
  });
});
