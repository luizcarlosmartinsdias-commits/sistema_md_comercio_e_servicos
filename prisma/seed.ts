import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const defaultServices = [
  { name: 'Diagnostico tecnico', description: 'Analise tecnica inicial do equipamento e identificacao do problema.', category: 'Diagnostico', defaultUnitCents: 5000 },
  { name: 'Troca de componente', description: 'Substituicao de componente eletroeletronico danificado.', category: 'Reparo', defaultUnitCents: 12000 },
  { name: 'Reparo de placa', description: 'Reparo tecnico em placa eletronica com testes funcionais.', category: 'Reparo', defaultUnitCents: 18000 },
  { name: 'Troca de conector', description: 'Substituicao de conector de carga, sinal ou alimentacao.', category: 'Reparo', defaultUnitCents: 9000 },
  { name: 'Instalacao eletrica', description: 'Servico de instalacao eletrica para equipamento ou ponto de uso.', category: 'Instalacao', defaultUnitCents: 15000 },
  { name: 'Manutencao preventiva', description: 'Limpeza, revisao, testes e ajustes preventivos.', category: 'Manutencao', defaultUnitCents: 11000 },
  { name: 'Configuracao de equipamento', description: 'Configuracao operacional, parametrizacao e testes de uso.', category: 'Configuracao', defaultUnitCents: 8000 },
  { name: 'Mao de obra tecnica', description: 'Hora tecnica para execucao de servicos especializados.', category: 'Mao de obra', defaultUnitCents: 10000 }
];

async function main() {
  const passwordHash = await bcrypt.hash('alterar123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@mdcomercioeservicos.com.br' },
    update: { name: 'Administrador MD', role: UserRole.ADMIN_MD, passwordHash, active: true },
    create: { name: 'Administrador MD', email: 'admin@mdcomercioeservicos.com.br', role: UserRole.ADMIN_MD, passwordHash }
  });

  for (const service of defaultServices) {
    const existing = await prisma.serviceCatalog.findFirst({ where: { name: service.name } });
    if (!existing) await prisma.serviceCatalog.create({ data: service });
  }
}

main().finally(async () => prisma.$disconnect());
