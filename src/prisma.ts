// src/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'info',  emit: 'event' },
    { level: 'warn',  emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('error', (e) => console.error('[PRISMA][error]', e));
prisma.$on('warn',  (e) => console.warn('[PRISMA][warn]', e));
prisma.$on('info',  (e) => console.info('[PRISMA][info]', e));
// Si quieres ver queries en consola, descomenta:
// prisma.$on('query', (e) => console.debug('[PRISMA][query]', e.query, e.params));

export default prisma;
