import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Company, Quote, QuoteItem, ServiceRequest, User } from '@prisma/client';
import { formatMoney } from '@/lib/format';

type QuoteWithItems = Quote & { items: QuoteItem[] };
type RequestWithRelations = ServiceRequest & { company: Company; requester: User };

const mdCompany = {
  name: 'MD COMÉRCIO E SERVIÇOS',
  legalName: 'LUIZ CARLOS MARTINS DIAS JUNIOR 13345695766',
  document: '42.595.449/0001-90',
  address: 'Rua Arpoador, 75 - Areal - Araruama/RJ - CEP 28976-366'
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const RIGHT_EDGE = 555;
const CONTENT_WIDTH = RIGHT_EDGE - MARGIN;

export async function generateQuotePdf({ quote, request, portalUrl }: { quote: QuoteWithItems; request: RequestWithRelations; portalUrl: string }) {
  console.info('[quote-pdf]', { etapa: 'generate_pdf_start', quoteId: quote.id, requestId: request.id, protocol: request.protocol });

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const blue = rgb(0.02, 0.21, 0.52);
  const black = rgb(0.08, 0.1, 0.16);
  const gray = rgb(0.36, 0.4, 0.47);
  const line = rgb(0.82, 0.86, 0.9);
  const lightBlue = rgb(0.94, 0.97, 1);

  let y = 800;

  const draw = (value: string, x: number, yy: number, size = 10, font = regular, color = black) => {
    page.drawText(safe(value), { x, y: yy, size, font, color });
  };
  const move = (amount: number) => { y -= amount; };
  const ensure = (height: number) => {
    if (y - height > 52) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = 800;
  };
  const rule = () => page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT_EDGE, y }, thickness: 0.8, color: line });

  console.info('[quote-pdf]', { etapa: 'draw_header_start', quoteId: quote.id, requestId: request.id });
  await drawLogoOrFallback(pdf, page, { x: MARGIN, y: y - 76, width: 150, height: 76 }, bold, regular, blue, black);

  draw(mdCompany.name, 210, y - 8, 16, bold, blue);
  draw(`Razão Social: ${mdCompany.legalName}`, 210, y - 28, 9, regular, black);
  draw(`CNPJ: ${mdCompany.document}`, 210, y - 44, 9, regular, black);
  draw(`Endereço: ${mdCompany.address}`, 210, y - 60, 8, regular, black);
  move(100);

  draw('ORÇAMENTO', MARGIN, y, 25, bold, blue);
  draw(`Nº do Orçamento: ${quote.quoteNumber ?? quote.id}`, 330, y + 6, 9, bold, black);
  draw(`Data de Emissão: ${formatDate(quote.createdAt)}`, 330, y - 10, 9, regular, black);
  move(26);
  rule();
  move(26);

  section('Dados do Cliente');
  row('Empresa / Cliente', request.company.name, 'CNPJ / CPF', request.company.document ?? '-');
  row('Solicitante', displayValue(request.responsavel), 'E-mail', request.requester.email);
  row('Telefone', displayValue(request.telefone), 'Protocolo / O.S.', request.protocol);
  move(10);

  section('Dados do Equipamento');
  row('Equipamento', displayValue(request.tipoAparelho), 'Marca', displayValue(request.marca));
  row('Modelo', displayValue(request.modelo), 'Nº de Série / IMEI', displayValue(request.serial));
  fullRow('Defeito Informado', displayValue(request.problema));
  move(10);

  console.info('[quote-pdf]', { etapa: 'draw_items_start', quoteId: quote.id, requestId: request.id, items: quote.items.length });
  section('Itens do Orçamento');
  tableHeader();
  quote.items.forEach((item, index) => {
    ensure(30);
    const total = item.quantity * item.unitCents;
    page.drawLine({ start: { x: MARGIN, y: y - 7 }, end: { x: RIGHT_EDGE, y: y - 7 }, thickness: 0.4, color: line });
    draw(String(index + 1), MARGIN + 6, y, 9, regular, black);
    draw(trim(item.description, 70), MARGIN + 38, y, 9, regular, black);
    draw(String(item.quantity), 382, y, 9, regular, black);
    draw(formatMoney(item.unitCents), 425, y, 9, regular, black);
    draw(formatMoney(total), 500, y, 9, regular, black);
    move(22);
  });
  move(8);

  console.info('[quote-pdf]', { etapa: 'draw_totals_start', quoteId: quote.id, requestId: request.id });
  const subtotal = quote.subtotalCents || quote.totalCents + quote.discountCents;
  page.drawRectangle({ x: 338, y: y - 58, width: 217, height: 70, borderColor: line, borderWidth: 0.8, color: rgb(1, 1, 1) });
  draw('Subtotal', 352, y - 8, 10, regular, black);
  draw(formatMoney(subtotal), 468, y - 8, 10, regular, black);
  draw('Desconto', 352, y - 30, 10, regular, black);
  draw(formatMoney(quote.discountCents), 468, y - 30, 10, regular, black);
  page.drawRectangle({ x: 339, y: y - 58, width: 215, height: 24, color: lightBlue });
  draw('VALOR FINAL', 352, y - 50, 12, bold, blue);
  draw(formatMoney(quote.totalCents), 468, y - 50, 12, bold, blue);
  move(90);

  section('Condições');
  row('Validade', `${quote.validityDays} dias`, 'Garantia', `${quote.warrantyDays} dias`);
  row('Prazo de Execução', `${quote.executionDeadlineDays} dias`, 'Status', quoteStatusLabel(quote.status));
  fullRow('Forma de Pagamento', 'Conforme negociação entre as partes.');
  if (quote.notes) fullRow('Observações', quote.notes);

  y = Math.max(y - 18, 78);
  rule();
  move(18);
  draw(`Portal: ${portalUrl}`, MARGIN, y, 8, regular, gray);
  move(14);
  draw('Documento gerado pelo Portal MD Comércio e Serviços', MARGIN, y, 8, regular, gray);
  move(14);
  draw('A aprovação deste orçamento autoriza a execução dos serviços descritos.', MARGIN, y, 8, regular, gray);

  const pdfBytes = await pdf.save();
  console.info('[quote-pdf]', { etapa: 'generate_pdf_done', quoteId: quote.id, requestId: request.id, protocol: request.protocol, pdfBytes: pdfBytes.length });
  return pdfBytes;

  function section(title: string) {
    ensure(38);
    page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_WIDTH, height: 18, color: blue });
    draw(title.toUpperCase(), MARGIN + 8, y, 10, bold, rgb(1, 1, 1));
    move(30);
  }

  function row(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
    ensure(24);
    draw(`${leftLabel}:`, MARGIN, y, 9, bold, blue);
    draw(trim(leftValue || '-', 30), MARGIN + 118, y, 9, regular, black);
    draw(`${rightLabel}:`, 318, y, 9, bold, blue);
    draw(trim(rightValue || '-', 20), 432, y, 9, regular, black);
    move(22);
  }

  function fullRow(rowLabel: string, value: string) {
    ensure(24);
    draw(`${rowLabel}:`, MARGIN, y, 9, bold, blue);
    draw(trim(value || '-', 82), MARGIN + 128, y, 9, regular, black);
    move(22);
  }

  function tableHeader() {
    ensure(28);
    page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT_WIDTH, height: 20, color: blue });
    draw('Item', MARGIN + 6, y, 8, bold, rgb(1, 1, 1));
    draw('Serviço / Peça', MARGIN + 38, y, 8, bold, rgb(1, 1, 1));
    draw('Qtd.', 374, y, 8, bold, rgb(1, 1, 1));
    draw('Valor Unitário', 418, y, 8, bold, rgb(1, 1, 1));
    draw('Total', 500, y, 8, bold, rgb(1, 1, 1));
    move(28);
  }
}

async function drawLogoOrFallback(
  pdf: PDFDocument,
  page: PDFPage,
  box: { x: number; y: number; width: number; height: number },
  bold: PDFFont,
  regular: PDFFont,
  blue: ReturnType<typeof rgb>,
  black: ReturnType<typeof rgb>
) {
  try {
    console.info('[quote-pdf]', { etapa: 'load_logo_start' });
    const logoBuffer = await readLogoWithTimeout();
    if (logoBuffer) {
      const logo = await embedLogo(pdf, logoBuffer);
      if (logo) {
        page.drawImage(logo, { x: box.x, y: box.y, width: box.width, height: box.height });
        console.info('[quote-pdf]', { etapa: 'load_logo_done' });
        return;
      }
    }
    console.info('[quote-pdf]', { etapa: 'load_logo_fallback' });
  } catch (error) {
    console.error('[quote-pdf]', { etapa: 'load_logo_failed', error: errorMessage(error) });
  }

  page.drawRectangle({ x: box.x, y: box.y + 8, width: box.width, height: box.height - 10, borderColor: blue, borderWidth: 1.2, color: rgb(0.97, 0.99, 1) });
  page.drawText('MD', { x: box.x + 16, y: box.y + 30, size: 36, font: bold, color: blue });
  page.drawLine({ start: { x: box.x + 16, y: box.y + 22 }, end: { x: box.x + 120, y: box.y + 22 }, thickness: 1, color: blue });
  page.drawText('Comércio e Serviços', { x: box.x + 16, y: box.y + 10, size: 7, font: regular, color: black });
}

async function readLogoWithTimeout() {
  const candidates = ['logo-md.png', 'logo-md.jpg', 'logo-md.jpeg'];
  for (const fileName of candidates) {
    try {
      const filePath = path.join(process.cwd(), 'public', fileName);
      return await Promise.race([
        readFile(filePath),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1200))
      ]);
    } catch {
      // tenta o próximo arquivo
    }
  }
  return undefined;
}

async function embedLogo(pdf: PDFDocument, logoBuffer: Buffer) {
  try {
    return await pdf.embedPng(logoBuffer);
  } catch {
    try {
      return await pdf.embedJpg(logoBuffer);
    } catch {
      return null;
    }
  }
}

function quoteStatusLabel(status: string) {
  if (status === 'ENVIADO') return 'Aguardando aprovação';
  if (status === 'APROVADO') return 'Aprovado';
  if (status === 'RECUSADO') return 'Reprovado';
  return status.replace(/_/g, ' ').toLowerCase();
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function displayValue(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized && normalized !== '0' ? normalized : '-';
}

function safe(value: string) {
  return String(value ?? '')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
}

function trim(value: string, length: number) {
  const clean = safe(value).replace(/\s+/g, ' ');
  return clean.length > length ? `${clean.slice(0, length - 3)}...` : clean;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}
