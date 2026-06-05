import { prisma } from '@/lib/prisma';

export async function nextProtocol() {
  const year = new Date().getFullYear();
  const count = await prisma.serviceRequest.count({ where: { protocol: { startsWith: `MD-${year}-` } } });
  return `MD-${year}-${String(count + 1).padStart(5, '0')}`;
}
