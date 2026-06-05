import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SetupRequestBody = {
  token?: string;
};

type ExecError = Error & {
  stdout?: string;
  stderr?: string;
  code?: number | string;
};

type PrismaCommand = {
  command: string;
  args: string[];
};

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const expectedToken = process.env.ADMIN_SETUP_TOKEN;

  if (!expectedToken) {
    return NextResponse.json({ message: 'Migration setup is not configured.' }, { status: 500 });
  }

  const receivedToken = await readSetupToken(request);
  if (!receivedToken || !safeTokenEquals(receivedToken, expectedToken)) {
    return NextResponse.json({ message: 'Invalid setup token.' }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ message: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  const prismaCommand = resolvePrismaCommand();
  if (!prismaCommand) {
    return NextResponse.json({
      message: 'Prisma CLI was not found in the server bundle.',
      summary: 'The production function could not find node_modules/.bin/prisma or node_modules/prisma/build/index.js. Run migrations with npm run prisma:deploy in a trusted terminal, or check the Vercel output tracing configuration.'
    }, { status: 500 });
  }

  try {
    const result = await execFileAsync(prismaCommand.command, prismaCommand.args, {
      cwd: process.cwd(),
      env: process.env,
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    });

    return NextResponse.json({
      message: 'Migrations executed successfully.',
      summary: summarizeOutput(result.stdout)
    }, { status: 200 });
  } catch (error) {
    const migrationError = error as ExecError;
    return NextResponse.json({
      message: 'Migration execution failed.',
      summary: summarizeError(migrationError)
    }, { status: 500 });
  }
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

function resolvePrismaCommand(): PrismaCommand | null {
  const root = process.cwd();
  const prismaBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

  if (existsSync(prismaBin)) {
    return { command: prismaBin, args: ['migrate', 'deploy'] };
  }

  if (existsSync(prismaCli)) {
    return { command: process.execPath, args: [prismaCli, 'migrate', 'deploy'] };
  }

  return null;
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

function summarizeOutput(output?: string) {
  const sanitized = sanitizeSensitiveText(output ?? '');
  const lines = sanitized.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.slice(-8).join('\n') || 'Prisma migrate deploy completed.';
}

function summarizeError(error: ExecError) {
  const parts = [error.message, error.stderr, error.stdout]
    .filter(Boolean)
    .map((value) => sanitizeSensitiveText(String(value)));
  const lines = parts.join('\n').split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, 10).join('\n') || 'Unexpected migration error.';
}

function sanitizeSensitiveText(text: string) {
  let sanitized = text;
  const databaseUrl = process.env.DATABASE_URL;
  const setupToken = process.env.ADMIN_SETUP_TOKEN;

  if (databaseUrl) sanitized = sanitized.split(databaseUrl).join('[REDACTED_DATABASE_URL]');
  if (setupToken) sanitized = sanitized.split(setupToken).join('[REDACTED_SETUP_TOKEN]');

  return sanitized
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/password=[^\s&]+/gi, 'password=[REDACTED]');
}
