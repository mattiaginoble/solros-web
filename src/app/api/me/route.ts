import { prisma } from "@/lib/server/db";
import { handleError, HttpError, readJson } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/user";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({ user: { id: user.id, name: user.name } });
  } catch (err) {
    return handleError(err);
  }
}

/** Aggiorna il nome visualizzato dell'utente. */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await readJson(req, 10_000)) as { name?: string };
    const name = body.name?.trim();
    if (!name || name.length > 60) throw new HttpError(422, "Nome non valido");
    const u = await prisma.user.update({ where: { id: user.id }, data: { name } });
    return Response.json({ user: { id: u.id, name: u.name } });
  } catch (err) {
    return handleError(err);
  }
}
