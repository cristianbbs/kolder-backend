import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { authRouter } from './routes/auth.ts';
import { productsRouter } from './routes/products.ts';
import { ordersRouter } from './routes/orders.ts';
import { companyRouter } from './routes/company.ts';
import { configRouter } from './routes/config.ts';
import { buildAdmin } from './admin.ts';

const app = express();

/* -------- Seguridad/headers básicos -------- */
app.disable('x-powered-by');

/* -------- CORS + Body parsers --------
   - En dev, origin: true permite cualquier origen (Expo, etc.).
   - Si quieres bloquear, usa: origin: process.env.APP_ORIGIN?.split(',') ?? []
*/
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '256kb' })); // evita payloads gigantes por error

/* -------- Logger simple con timestamp -------- */
app.use((req, _res, next) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '') as string;
  const ts = new Date().toISOString();
  console.log(`[${ts}] [API] ${req.method} ${req.originalUrl} <- ${ip}`);
  next();
});

/* -------- Healthcheck --------
   Útil para probar desde Safari del iPhone: http://TU_IP:4000/health
*/
app.get('/health', (_req, res) => res.send('OK'));

/* -------- Rutas de la API -------- */
app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);   // <- AQUÍ ya vienen /:id y /:id/status
app.use('/company', companyRouter);
app.use('/config', configRouter);

/* -------- 404 explícito -------- */
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

/* -------- Manejador de errores final --------
   - Respeta status/statusCode si viene seteado.
   - Si es Zod, devuelve 400 con issues.
*/
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Zod
  if (err?.issues && Array.isArray(err.issues)) {
    return res.status(400).json({ error: 'Validación', details: err.issues });
  }

  // Si el error ya trae status/statusCode, respétalo
  const status = Number(err?.status || err?.statusCode);
  if (status && Number.isInteger(status)) {
    console.error('ERROR:', err);
    return res.status(status).json({ error: err?.message || 'Error' });
  }

  // JWT u otros con mensaje claro (si no traen status)
  if (err?.message) {
    console.error('ERROR:', err);
    return res.status(400).json({ error: err.message });
  }

  console.error('ERROR 500:', err);
  return res.status(500).json({ error: 'Internal Server Error' });
});

/* -------- Arranque del servidor --------
   Evita doble app.listen cuando ESM + ts-node/nodemon importan 2 veces.
*/
declare global {
  // eslint-disable-next-line no-var
  var __KOLDER_LISTENING__: boolean | undefined;
}

if (!global.__KOLDER_LISTENING__) {
  global.__KOLDER_LISTENING__ = true;

  (async () => {
    const PORT = Number(process.env.PORT || 4000);
    const SKIP_ADMIN = process.env.SKIP_ADMIN === '1';

    if (!SKIP_ADMIN) {
      try {
        const { admin, router } = await buildAdmin();
        app.use(admin.options.rootPath, router);
        console.log(`Panel KOLDER: http://localhost:${PORT}${admin.options.rootPath}`);
      } catch (err) {
        console.warn('AdminJS deshabilitado por error:', (err as Error).message);
      }
    } else {
      console.log('AdminJS deshabilitado por SKIP_ADMIN=1');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API en http://localhost:${PORT}`);
    });
  })();
} else {
  console.log('⏭️  Server ya estaba escuchando; se omite doble arranque');
}
