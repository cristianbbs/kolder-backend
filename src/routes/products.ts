import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { requireAuth } from '../auth/middleware.ts';

export const productsRouter = Router();

productsRouter.use(requireAuth);

/* -------------------- helper de error unificado -------------------- */
function err(res: any, status: number, code: string, message: string, issues?: unknown) {
  const body: any = { ok: false, code, message };
  if (issues !== undefined) body.issues = issues;
  return res.status(status).json(body);
}

/**
 * GET /products/catalog  (alias: /products, /products/categories)
 * Responde:
 * { ok: true, categories: [{ id, name, products: [{ id, title, detail, imageUrl }] }] }
 *
 * Nota:
 * - Filtra SIEMPRE por allow-list de la empresa.
 * - **Se excluyen** categorías con 0 productos (comportamiento que ya tienes).
 */
async function getCatalogByCompany(companyId: number) {
  const allowed = await prisma.companyProduct.findMany({
    where: { companyId },
    select: { productId: true },
  });
  const allowedIds = new Set(allowed.map(a => a.productId));

  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      products: {
        select: { id: true, title: true, detail: true, imageUrl: true },
        orderBy: { title: 'asc' },
      },
    },
  });

  const categories = cats
    .map(c => ({
      id: c.id,
      name: c.name,
      products: c.products.filter(p => allowedIds.has(p.id)),
    }))
    .filter(c => c.products.length > 0); // <- mantener tu filtro de vacías

  const total = categories.reduce((acc, c) => acc + c.products.length, 0);
  console.log(`[API] /products -> ${categories.length} categorías, ${total} productos`);
  return { categories };
}

productsRouter.get(['/catalog', '/', '/categories'], async (req: any, res) => {
  const companyIdRaw = req?.user?.companyId;
  if (!Number.isFinite(Number(companyIdRaw))) {
    return err(res, 400, 'NO_COMPANY', 'Tu usuario no tiene empresa asignada');
  }
  const companyId = Number(companyIdRaw);

  const data = await getCatalogByCompany(companyId);
  return res.json({ ok: true, ...data });
});

export default productsRouter;
