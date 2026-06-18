import { WarrantyStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export function normalizeSerial(serial: string) {
  return serial.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export async function findActiveWarrantyBySerial(serial: string) {
  const normalized = normalizeSerial(serial);
  if (!normalized) return null;

  const warranties = await prisma.warranty.findMany({
    where: {
      status: WarrantyStatus.ATIVA,
      endDate: { gte: new Date() }
    },
    include: {
      serviceRequest: {
        select: {
          id: true,
          protocol: true,
          serial: true,
          problema: true,
          tipoAparelho: true,
          marca: true,
          modelo: true,
          requesterId: true,
          companyId: true
        }
      }
    },
    orderBy: { endDate: 'desc' }
  });

  return warranties.find((warranty) => normalizeSerial(warranty.serviceRequest.serial) === normalized) ?? null;
}
