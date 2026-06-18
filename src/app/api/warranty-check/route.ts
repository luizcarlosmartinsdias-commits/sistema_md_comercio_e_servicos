import { NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/session';
import { findActiveWarrantyBySerial } from '@/lib/warranty-lookup';

export async function GET(request: Request) {
  const user = await requireSessionUser();
  const { searchParams } = new URL(request.url);
  const serial = searchParams.get('serial') ?? '';
  const warranty = await findActiveWarrantyBySerial(serial);

  if (!warranty) return NextResponse.json({ active: false });

  const sameRequester = warranty.serviceRequest.requesterId === user.id;
  const sameCompany = Boolean(user.companyId && warranty.serviceRequest.companyId === user.companyId);
  if (!sameRequester && !sameCompany) return NextResponse.json({ active: false });

  return NextResponse.json({
    active: true,
    warrantyId: warranty.id,
    originRequestId: warranty.serviceRequest.id,
    originProtocol: warranty.serviceRequest.protocol,
    endDate: warranty.endDate.toISOString(),
    status: warranty.status,
    problem: warranty.serviceRequest.problema,
    equipment: `${warranty.serviceRequest.tipoAparelho} ${warranty.serviceRequest.marca} ${warranty.serviceRequest.modelo}`
  });
}
