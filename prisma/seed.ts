import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('alterar123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@mdcomercioeservicos.com.br' },
    update: { name: 'Administrador MD', role: UserRole.ADMIN_MD, passwordHash, active: true },
    create: { name: 'Administrador MD', email: 'admin@mdcomercioeservicos.com.br', role: UserRole.ADMIN_MD, passwordHash }
  });
}

main().finally(async () => prisma.$disconnect());
