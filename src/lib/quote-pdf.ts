import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from 'pdf-lib';
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

export async function generateQuotePdf({ quote, request, portalUrl }: { quote: QuoteWithItems; request: RequestWithRelations; portalUrl: string }) {
  console.info('[quote-pdf]', { etapa: 'generate_pdf_start', quoteId: quote.id, requestId: request.id, protocol: request.protocol });

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const rightEdge = 555;
  const contentWidth = rightEdge - margin;
  const blue = rgb(0.05, 0.22, 0.42);
  const lightBlue = rgb(0.91, 0.96, 1);
  const gray = rgb(0.35, 0.39, 0.45);
  const line = rgb(0.82, 0.86, 0.9);
  const black = rgb(0.08, 0.1, 0.12);
  let y = 800;

  await drawBrandHeader();
  move(100);

  draw('ORÇAMENTO', margin, y, 25, bold, blue);
  draw(`Nº do Orçamento: ${quote.quoteNumber ?? quote.id}`, 330, y + 6, 9, bold, black, 220);
  draw(`Data de Emissão: ${formatDate(quote.createdAt)}`, 330, y - 10, 9, regular, black, 220);
  move(26);
  rule();
  move(24);

  section('Dados do Cliente');
  fullRow('Empresa / Cliente', request.company.name);
  twoColumnRow('CNPJ / CPF', displayValue(request.company.document), 'Protocolo / O.S.', request.protocol);
  twoColumnRow('Solicitante', displayValue(request.responsavel), 'Telefone', displayValue(request.telefone));
  fullRow('E-mail', displayValue(request.requester.email));
  move(8);

  section('Dados do Equipamento');
  twoColumnRow('Equipamento', displayValue(request.tipoAparelho), 'Marca', displayValue(request.marca));
  twoColumnRow('Modelo', displayValue(request.modelo), 'Nº de Série / IMEI', displayValue(request.serial));
  fullRow('Defeito Informado', displayValue(request.problema));
  if (request.observacoes) fullRow('Observações', request.observacoes);
  move(8);

  section('Itens do Orçamento');
  tableHeader();

  quote.items.forEach((item, index) => {
    const total = item.quantity * item.unitCents;
    const descriptionLines = wrapText(item.description, 318, regular, 9);
    ensure(20 + descriptionLines.length * 12);
    page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: rightEdge, y: y - 7 }, thickness: 0.4, color: line });
    draw(String(index + 1), margin + 6, y, 9, regular, black);
    descriptionLines.forEach((lineText, lineIndex) => draw(lineText, margin + 38, y - lineIndex * 12, 9, regular, black, 318));
    draw(String(item.quantity), 382, y, 9, regular, black, 26);
    draw(formatMoney(item.unitCents), 425, y, 9, regular, black, 68);
    draw(formatMoney(total), 500, y, 9, regular, black, 54);
    move(Math.max(22, descriptionLines.length * 12 + 10));
  });
  move(8);

  ensure(92);
  const subtotal = quote.subtotalCents || quote.totalCents + quote.discountCents;
  page.drawRectangle({ x: 338, y: y - 58, width: 217, height: 70, borderColor: line, borderWidth: 0.8, color: rgb(1, 1, 1) });
  draw('Subtotal', 352, y - 8, 10, regular, black);
  draw(formatMoney(subtotal), 468, y - 8, 10, regular, black);
  draw('Desconto', 352, y - 30, 10, regular, black);
  draw(formatMoney(quote.discountCents), 468, y - 30, 10, regular, black);
  page.drawRectangle({ x: 339, y: y - 58, width: 215, height: 24, color: lightBlue });
  draw('VALOR FINAL', 352, y - 50, 12, bold, blue);
  draw(formatMoney(quote.totalCents), 468, y - 50, 12, bold, blue);
  move(88);

  section('Condições');
  twoColumnRow('Validade', `${quote.validityDays} dias`, 'Garantia', `${quote.warrantyDays} dias`);
  twoColumnRow('Prazo de Execução', `${quote.executionDeadlineDays} dias`, 'Status', quoteStatusLabel(quote.status));
  fullRow('Forma de Pagamento', 'Conforme negociação entre as partes.');
  if (quote.notes) fullRow('Observações', quote.notes);

  ensure(64);
  y = Math.max(y - 14, 78);
  rule();
  move(16);
  draw(`Portal: ${portalUrl}`, margin, y, 8, regular, gray, contentWidth);
  move(13);
  draw('Documento gerado pelo Portal MD Comércio e Serviços', margin, y, 8, regular, gray, contentWidth);
  move(13);
  draw('A aprovação deste orçamento autoriza a execução dos serviços descritos.', margin, y, 8, regular, gray, contentWidth);

  const pdfBytes = await pdf.save();
  console.info('[quote-pdf]', { etapa: 'generate_pdf_done', quoteId: quote.id, requestId: request.id, protocol: request.protocol, pdfBytes: pdfBytes.length });
  return pdfBytes;

  async function drawBrandHeader() {
    try {
      const logoBytes = await readFile(path.join(process.cwd(), 'public', 'brand', 'logo_orcamento.png'));
      const logo = await pdf.embedPng(logoBytes);
      const maxWidth = 150;
      const maxHeight = 70;
      const ratio = Math.min(maxWidth / logo.width, maxHeight / logo.height);
      const width = logo.width * ratio;
      const height = logo.height * ratio;
      page.drawImage(logo, { x: margin + 8, y: y - height + 10, width, height });
    } catch (error) {
      console.error('[quote-pdf]', { etapa: 'load_logo_failed', quoteId: quote.id, requestId: request.id, error: errorMessage(error) });
      page.drawRectangle({ x: margin, y: y - 72, width: 150, height: 70, borderColor: blue, borderWidth: 1.2, color: lightBlue });
      draw('MD', margin + 18, y - 44, 36, bold, blue);
      page.drawLine({ start: { x: margin + 18, y: y - 54 }, end: { x: margin + 128, y: y - 54 }, thickness: 1, color: blue });
      draw('Comércio e Serviços', margin + 18, y - 66, 7, regular, black);
    }

    draw(mdCompany.name, 210, y - 8, 16, bold, blue, 345);
    draw(`Razão Social: ${mdCompany.legalName}`, 210, y - 28, 9, regular, black, 345);
    draw(`CNPJ: ${mdCompany.document}`, 210, y - 44, 9, regular, black, 345);
    draw(`Endereço: ${mdCompany.address}`, 210, y - 60, 8, regular, black, 345);
  }

  function section(title: string) {
    ensure(38);
    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 18, color: blue });
    draw(title.toUpperCase(), margin + 8, y, 10, bold, rgb(1, 1, 1), contentWidth - 16);
    move(30);
  }

  function twoColumnRow(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
    const leftLabelWidth = 106;
    const rightLabelWidth = 104;
    const leftValueX = margin + leftLabelWidth;
    const rightLabelX = 318;
    const rightValueX = rightLabelX + rightLabelWidth;
    const leftLines = wrapText(leftValue || '-', rightLabelX - leftValueX - 12, regular, 9);
    const rightLines = wrapText(rightValue || '-', rightEdge - rightValueX, regular, 9);
    const lineCount = Math.max(leftLines.length, rightLines.length, 1);
    ensure(12 + lineCount * 12);
    draw(`${leftLabel}:`, margin, y, 9, bold, blue, leftLabelWidth - 6);
    leftLines.forEach((lineText, index) => draw(lineText, leftValueX, y - index * 12, 9, regular, black, rightLabelX - leftValueX - 12));
    draw(`${rightLabel}:`, rightLabelX, y, 9, bold, blue, rightLabelWidth - 6);
    rightLines.forEach((lineText, index) => draw(lineText, rightValueX, y - index * 12, 9, regular, black, rightEdge - rightValueX));
    move(Math.max(22, lineCount * 12 + 10));
  }

  function fullRow(rowLabel: string, value: string) {
    const labelWidth = 128;
    const valueX = margin + labelWidth;
    const lines = wrapText(value || '-', rightEdge - valueX, regular, 9);
    ensure(12 + lines.length * 12);
    draw(`${rowLabel}:`, margin, y, 9, bold, blue, labelWidth - 6);
    lines.forEach((lineText, index) => draw(lineText, valueX, y - index * 12, 9, regular, black, rightEdge - valueX));
    move(Math.max(22, lines.length * 12 + 10));
  }

  function tableHeader() {
    ensure(28);
    page.drawRectangle({ x: margin, y: y - 6, width: contentWidth, height: 20, color: blue });
    draw('Item', margin + 6, y, 8, bold, rgb(1, 1, 1));
    draw('Serviço / Peça', margin + 38, y, 8, bold, rgb(1, 1, 1));
    draw('Qtd.', 374, y, 8, bold, rgb(1, 1, 1));
    draw('Valor Unitário', 418, y, 8, bold, rgb(1, 1, 1));
    draw('Total', 500, y, 8, bold, rgb(1, 1, 1));
    move(28);
  }

  function ensure(height: number) {
    if (y - height > 52) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 800;
  }

  function rule() {
    page.drawLine({ start: { x: margin, y }, end: { x: rightEdge, y }, thickness: 0.8, color: line });
  }

  function move(amount: number) {
    y -= amount;
  }

  function draw(value: string, x: number, yPosition: number, size: number, font: PDFFont, color: RGB = black, maxWidth?: number) {
    const text = safe(value);
    page.drawText(maxWidth ? fitText(text, maxWidth, font, size) : text, { x, y: yPosition, size, font, color });
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

function wrapText(value: string, width: number, font: PDFFont, size: number) {
  const clean = safe(value).replace(/\s+/g, ' ').trim() || '-';
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= width) {
      current = word;
      return;
    }
    const chunks = breakLongWord(word, width, font, size);
    lines.push(...chunks.slice(0, -1));
    current = chunks[chunks.length - 1] ?? '';
  });

  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['-'];
}

function breakLongWord(word: string, width: number, font: PDFFont, size: number) {
  const chunks: string[] = [];
  let current = '';
  for (const char of word) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function fitText(value: string, width: number, font: PDFFont, size: number) {
  const clean = safe(value).replace(/\s+/g, ' ');
  if (font.widthOfTextAtSize(clean, size) <= width) return clean;
  let output = clean;
  while (output.length > 4 && font.widthOfTextAtSize(`${output}...`, size) > width) output = output.slice(0, -1);
  return `${output}...`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

function safe(value: string) {
  return String(value ?? '')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
}
