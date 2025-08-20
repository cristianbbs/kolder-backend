import { prisma } from './prisma.ts';
import bcrypt from 'bcryptjs';

async function main() {
  await prisma.orderStatusLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.companyProduct.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.globalConfig.deleteMany();

  await prisma.globalConfig.create({
    data: { emergencyFeeCLP: 5000, emergencySchedule: 'Lun-Sab 08:00-13:00' }
  });

  const company = await prisma.company.create({
    data: {
      name: 'Empresa Demo SPA',
      rut: '77.777.777-7',
      phone: '+56 9 1111 1111',
      email: 'contacto@demo.cl',
      contactName: 'Jane Doe',
      contactPhone: '+56 9 2222 2222'
    }
  });

  const superPass = await bcrypt.hash('super1234', 10);
  await prisma.user.create({
    data: { email: 'super@kolder.cl', name: 'Super Admin', role: 'SUPER_ADMIN', passwordHash: superPass }
  });

  const adminPass = await bcrypt.hash('admin1234', 10);
  await prisma.user.create({
    data: { email: 'responsable@demo.cl', name: 'Responsable Demo', role: 'COMPANY_ADMIN', companyId: company.id, passwordHash: adminPass }
  });

  const userPass = await bcrypt.hash('usuario1234', 10);
  await prisma.user.create({
    data: { email: 'user1@demo.cl', name: 'Usuario Uno', role: 'USER', companyId: company.id, passwordHash: userPass }
  });

  const catHielo = await prisma.category.create({ data: { name: 'Hielo' } });
  const catAcc = await prisma.category.create({ data: { name: 'Accesorios' } });

  const p1 = await prisma.product.create({ data: { title: 'Bolsa de Hielo 5 kg', detail: 'Hielo en cubos', imageUrl: '', categoryId: catHielo.id } });
  const p2 = await prisma.product.create({ data: { title: 'Hielo Molido 10 kg', detail: 'Hielo molido', imageUrl: '', categoryId: catHielo.id } });
  const p3 = await prisma.product.create({ data: { title: 'Cooler 20L', detail: 'Conserva por horas', imageUrl: '', categoryId: catAcc.id } });

  await prisma.companyProduct.createMany({ data: [
    { companyId: company.id, productId: p1.id },
    { companyId: company.id, productId: p3.id }
  ]});

  console.log('Seed OK');
  console.log('- SUPER: super@kolder.cl / super1234');
  console.log('- COMPANY_ADMIN: responsable@demo.cl / admin1234');
  console.log('- USER: user1@demo.cl / usuario1234');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
