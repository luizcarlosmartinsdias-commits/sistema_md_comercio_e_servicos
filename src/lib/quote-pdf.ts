import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
  const blue = rgb(0.02, 0.21, 0.52);
  const black = rgb(0.08, 0.1, 0.16);
  const gray = rgb(0.36, 0.4, 0.47);
  const line = rgb(0.82, 0.86, 0.9);
  const margin = 40;
  let y = 798;

  const text = (value: string, x: number, size = 10, font = regular, color = black) => {
    page.drawText(safe(value), { x, y, size, font, color });
  };
  const label = (value: string, x: number) => text(value, x, 9, bold, blue);
  const move = (amount: number) => { y -= amount; };
  const ensure = (height: number) => {
    if (y - height > 48) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 798;
  };
  const rule = () => page.drawLine({ start: { x: margin, y }, end: { x: 555, y }, thickness: 0.8, color: line });

  console.info('[quote-pdf]', { etapa: 'draw_header_start', quoteId: quote.id, requestId: request.id });
  drawSafeTextLogo();
  page.drawText(mdCompany.name, { x: 158, y: y - 8, size: 16, font: bold, color: blue });
  page.drawText(`Razão Social: ${mdCompany.legalName}`, { x: 158, y: y - 28, size: 9, font: regular, color: black });
  page.drawText(`CNPJ: ${mdCompany.document}`, { x: 158, y: y - 44, size: 9, font: regular, color: black });
  page.drawText(`Endereço: ${mdCompany.address}`, { x: 158, y: y - 60, size: 8, font: regular, color: black });
  move(92);

  page.drawText('ORÇAMENTO', { x: margin, y, size: 24, font: bold, color: blue });
  page.drawText(`Nº do Orçamento: ${quote.quoteNumber ?? quote.id}`, { x: 318, y: y + 8, size: 9, font: bold, color: black });
  page.drawText(`Data de Emissão: ${formatDate(quote.createdAt)}`, { x: 318, y: y - 8, size: 9, font: regular, color: black });
  move(22);
  rule();
  move(26);

  section('Dados do Cliente');
  row('Empresa / Cliente', request.company.name, 'CNPJ / CPF', request.company.document ?? '-');
  row('Solicitante', displayValue(request.responsavel), 'E-mail', request.requester.email);
  row('Telefone', displayValue(request.telefone), 'Ordem de Serviço / Protocolo', request.protocol);
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
    ensure(28);
    const total = item.quantity * item.unitCents;
    page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: 555, y: y - 7 }, thickness: 0.4, color: line });
    page.drawText(String(index + 1), { x: margin + 5, y, size: 9, font: regular, color: black });
    page.drawText(trim(item.description, 66), { x: margin + 34, y, size: 9, font: regular, color: black });
    page.drawText(String(item.quantity), { x: 374, y, size: 9, font: regular, color: black });
    page.drawText(formatMoney(item.unitCents), { x: 420, y, size: 9, font: regular, color: black });
    page.drawText(formatMoney(total), { x: 500, y, size: 9, font: regular, color: black });
    move(20);
  });
  move(8);

  console.info('[quote-pdf]', { etapa: 'draw_totals_start', quoteId: quote.id, requestId: request.id });
  const subtotal = quote.subtotalCents || quote.totalCents + quote.discountCents;
  page.drawRectangle({ x: 338, y: y - 56, width: 217, height: 68, borderColor: line, borderWidth: 0.8 });
  page.drawText('Subtotal', { x: 352, y: y - 8, size: 10, font: regular, color: black });
  page.drawText(formatMoney(subtotal), { x: 468, y: y - 8, size: 10, font: regular, color: black });
  page.drawText('Desconto', { x: 352, y: y - 28, size: 10, font: regular, color: black });
  page.drawText(formatMoney(quote.discountCents), { x: 468, y: y - 28, size: 10, font: regular, color: black });
  page.drawText('VALOR FINAL', { x: 352, y: y - 48, size: 12, font: bold, color: blue });
  page.drawText(formatMoney(quote.totalCents), { x: 468, y: y - 48, size: 12, font: bold, color: blue });
  move(86);

  section('Condições');
  row('Validade', `${quote.validityDays} dias`, 'Garantia', `${quote.warrantyDays} dias`);
  row('Prazo de Execução', `${quote.executionDeadlineDays} dias`, 'Status', quoteStatusLabel(quote.status));
  fullRow('Forma de Pagamento', 'Conforme negociação entre as partes.');
  if (quote.notes) fullRow('Observações', quote.notes);

  y = Math.max(y - 18, 72);
  rule();
  move(18);
  text(`Portal: ${portalUrl}`, margin, 8, regular, gray);
  move(14);
  text('Documento gerado pelo Portal MD Comércio e Serviços', margin, 8, regular, gray);
  move(14);
  text('A aprovação deste orçamento autoriza a execução dos serviços descritos.', margin, 8, regular, gray);

  const pdfBytes = await pdf.save();
  console.info('[quote-pdf]', { etapa: 'generate_pdf_done', quoteId: quote.id, requestId: request.id, protocol: request.protocol, pdfBytes: pdfBytes.length });
  return pdfBytes;

  function drawSafeTextLogo() {
    try {
      console.info('[quote-pdf]', { etapa: 'load_logo_start', quoteId: quote.id, requestId: request.id });
      page.drawRectangle({ x: margin, y: y - 64, width: 94, height: 58, borderColor: blue, borderWidth: 1.2, color: rgb(0.97, 0.99, 1) });
      page.drawText('MD', { x: margin + 12, y: y - 42, size: 32, font: bold, color: blue });
      page.drawLine({ start: { x: margin + 12, y: y - 52 }, end: { x: margin + 82, y: y - 52 }, thickness: 1, color: blue });
      page.drawText('Comércio e Serviços', { x: margin + 8, y: y - 62, size: 6, font: regular, color: black });
      console.info('[quote-pdf]', { etapa: 'load_logo_done', quoteId: quote.id, requestId: request.id });
    } catch (error) {
      console.error('[quote-pdf]', { etapa: 'load_logo_failed', quoteId: quote.id, requestId: request.id, error: errorMessage(error) });
      page.drawText('MD Comércio e Serviços', { x: margin, y: y - 34, size: 14, font: bold, color: blue });
    }
  }

  function section(title: string) {
    ensure(38);
    page.drawRectangle({ x: margin, y: y - 4, width: 515, height: 18, color: blue });
    page.drawText(safe(title.toUpperCase()), { x: margin + 8, y, size: 10, font: bold, color: rgb(1, 1, 1) });
    move(30);
  }

  function row(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
    ensure(22);
    label(`${leftLabel}:`, margin);
    text(trim(leftValue || '-', 34), margin + 104, 9);
    label(`${rightLabel}:`, 318);
    text(trim(rightValue || '-', 26), 405, 9);
    move(20);
  }

  function fullRow(rowLabel: string, value: string) {
    ensure(22);
    label(`${rowLabel}:`, margin);
    text(trim(value || '-', 88), margin + 118, 9);
    move(20);
  }

  function tableHeader() {
    ensure(26);
    page.drawRectangle({ x: margin, y: y - 6, width: 515, height: 20, color: blue });
    page.drawText('Item', { x: margin + 5, y, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Serviço / Peça', { x: margin + 34, y, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Qtd.', { x: 368, y, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Valor Unitário', { x: 410, y, size: 8, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Total', { x: 500, y, size: 8, font: bold, color: rgb(1, 1, 1) });
    move(26);
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
