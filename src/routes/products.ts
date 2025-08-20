import { Router } from 'express';
import { prisma } from '../prisma.ts';
import { requireAuth } from '../auth/middleware.ts';

export const productsRouter = Router();

// Todas estas rutas requieren auth
productsRouter.use(requireAuth);

/**
 * GET /products/catalog   (alias: /products, /products/categories)
 * Responde:
 * {
 *   categories: [
 *     { id, name, products: [{ id, title, detail, imageUrl }] }
 *   ]
 * }
 *
 * Nota:
 * - No se vuelve a leer el usuario en BD. Usamos req.user.companyId.
 * - Si la empresa no tiene productos habilitados, devolvemos categorías con 0 productos (UI muestra estado vacío).
 */
async function getCatalogByCompany(companyId: number) {
  // Productos habilitados para la empresa
  const allowed = await prisma.companyProduct.findMany({
    where: { companyId },
    select: { productId: true },
  });
  const allowedIds = new Set(allowed.map(a => a.productId));

  // Si no hay habilitados, devolvemos categorías vacías (la UI ya maneja "No hay productos habilitados")
  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      products: {
        select: { id: true, title: true, detail: true, imageUrl: true },
        orderBy: { title: 'asc' },
      },
    },
  });

  // Filtra por habilitados
  const categories = cats.map(c => ({
    id: c.id,
    name: c.name,
    products: c.products.filter(p => allowedIds.has(p.id)),
  }));

  // Log útil
  const total = categories.reduce((acc, c) => acc + c.products.length, 0);
  console.log(`[API] /products -> ${categories.length} categorías, ${total} productos`);
  return { categories: categories.filter(c => c.products.length > 0) };
}

// Handler principal
productsRouter.get(['/catalog', '/', '/categories'], async (req: any, res) => {
  const companyIdRaw = req?.user?.companyId;
  if (!Number.isFinite(Number(companyIdRaw))) {
    return res.status(400).json({ error: 'Tu usuario no tiene empresa asignada' });
  }
  const companyId = Number(companyIdRaw);

  const data = await getCatalogByCompany(companyId);
  return res.json(data);
});

export default productsRouter;
