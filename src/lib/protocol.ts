import { prisma } from '@/lib/prisma';

export async function nextProtocol() {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('service_request_protocol_seq') AS value`;
  const nextNumber = Number(rows[0]?.value ?? 1);
  return `MD-${year}-${String(nextNumber).padStart(5, '0')}`;
}
