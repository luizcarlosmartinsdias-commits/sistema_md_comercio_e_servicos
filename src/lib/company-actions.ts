'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { canManageMd } from '@/lib/rbac';

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function createCompanyAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');

  const name = text(form, 'name');
  const document = text(form, 'document') || null;
  const email = text(form, 'email') || null;
  const phone = text(form, 'phone') || null;

  if (!name) return;

  if (document) {
    const existing = await prisma.company.findUnique({ where: { document } });
    if (existing) {
      await prisma.company.update({ where: { id: existing.id }, data: { name, email, phone, active: true } });
      await audit(user.id, 'COMPANY_UPDATED_BY_DOCUMENT', 'Company', existing.id, { document });
      revalidatePath('/dashboard');
      return;
    }
  }

  const company = await prisma.company.create({ data: { name, document, email, phone } });
  await audit(user.id, 'COMPANY_CREATED', 'Company', company.id);
  revalidatePath('/dashboard');
}
