import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SetupRequestBody = {
  token?: string;
};

export async function POST(request: Request) {
  const expectedToken = process.env.ADMIN_SETUP_TOKEN;
  const missingConfig = requiredAdminEnv().filter((key) => !process.env[key]);

  if (!expectedToken) {
    return NextResponse.json({ message: 'Admin setup is not configured.' }, { status: 500 });
  }

  const receivedToken = await readSetupToken(request);
  if (!receivedToken || !safeTokenEquals(receivedToken, expectedToken)) {
    return NextResponse.json({ message: 'Invalid setup token.' }, { status: 401 });
  }

  const activeAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN_MD, active: true },
    select: { id: true }
  });

  if (activeAdmin) {
    return NextResponse.json({ message: 'Admin already initialized.' }, { status: 200 });
  }

  if (missingConfig.length > 0) {
    return NextResponse.json({ message: 'Admin setup environment is incomplete.', missing: missingConfig }, { status: 500 });
  }

  const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD as string);

  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME as string,
      email: (process.env.ADMIN_EMAIL as string).toLowerCase().trim(),
      passwordHash,
      role: UserRole.ADMIN_MD,
      active: true
    }
  });

  return NextResponse.json({ message: 'Admin initialized successfully.' }, { status: 201 });
}

function requiredAdminEnv() {
  return ['ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_SETUP_TOKEN'];
}

async function readSetupToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  try {
    const body = await request.json() as SetupRequestBody;
    return typeof body.token === 'string' ? body.token : undefined;
  } catch {
    return undefined;
  }
}

function safeTokenEquals(received: string, expected: string) {
  const receivedBytes = new TextEncoder().encode(received);
  const expectedBytes = new TextEncoder().encode(expected);

  if (receivedBytes.length !== expectedBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < receivedBytes.length; index += 1) {
    diff |= receivedBytes[index] ^ expectedBytes[index];
  }
  return diff === 0;
}
