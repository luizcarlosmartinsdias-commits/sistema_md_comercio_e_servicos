import { prisma } from '@/lib/prisma';

export async function nextProtocol() {
  const year = new Date().getFullYear();
  const prefix = `MD-${year}-`;
  const lastRequest = await prisma.serviceRequest.findFirst({
    where: { protocol: { startsWith: prefix } },
    orderBy: { protocol: 'desc' },
    select: { protocol: true }
  });
  const lastNumber = Number(lastRequest?.protocol.replace(prefix, '') ?? '0');
  return `${prefix}${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(5, '0')}`;
}
