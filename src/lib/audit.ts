import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function audit(userId: string | null, action: string, entity: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, metadata: metadata ?? undefined } });
}
