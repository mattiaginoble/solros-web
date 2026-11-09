import { prisma } from "@/lib/server/db";
import { assertAdmin } from "@/lib/server/admin";
import { handleError, HttpError } from "@/lib/server/http";
import { toSummary } from "@/lib/server/projects";

/** Manutenzione: elenco dei progetti degli utenti (non gli esempi), con proprietario. */
export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const rows = await prisma.project.findMany({ where: { isExample: false }, orderBy: { createdAt: "asc" } });
    return Response.json({
      projects: rows.map((p) => ({ ...toSummary(p), ownerId: p.ownerId, preview: undefined })),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Manutenzione: elimina un progetto (?id=) e il suo proprietario se non ha altri dati. */
export async function DELETE(req: Request) {
  try {
    assertAdmin(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "Progetto mancante");
    const p = await prisma.project.findUnique({ where: { id } });
    if (!p || p.isExample) throw new HttpError(404, "Progetto non trovato");
    await prisma.project.delete({ where: { id } });
    let ownerDeleted = false;
    if (p.ownerId) {
      const [projects, products] = await Promise.all([
        prisma.project.count({ where: { ownerId: p.ownerId } }),
        prisma.product.count({ where: { ownerId: p.ownerId } }),
      ]);
      if (!projects && !products) {
        await prisma.user.delete({ where: { id: p.ownerId } });
        ownerDeleted = true;
      }
    }
    return Response.json({ deleted: id, ownerDeleted });
  } catch (err) {
    return handleError(err);
  }
}
