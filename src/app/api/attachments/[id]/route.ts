import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { canManageMd } from '@/lib/rbac';
import { StorageService } from '@/lib/services/storage';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await requireSessionUser();
  const attachment = await prisma.attachment.findUnique({ where: { id: params.id }, include: { serviceRequest: true } });
  if (!attachment || (!canManageMd(user.role) && attachment.serviceRequest.companyId !== user.companyId)) return new NextResponse('Nao encontrado', { status: 404 });

  const url = new URL(request.url);
  const viewInline = url.searchParams.get('view') === '1' || url.searchParams.get('disposition') === 'inline';
  const disposition = viewInline ? 'inline' : 'attachment';

  const path = StorageService.resolveLocalPath(attachment.storageKey);
  await stat(path);
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      'content-type': attachment.mimeType,
      'content-disposition': `${disposition}; filename="${attachment.fileName}"`
    }
  });
}
