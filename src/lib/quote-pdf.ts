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

const logoPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAABV7bNHAAAACXBIWXMAAAsTAAALEwEAmpwYAAABRUlEQVR4nO2YMU7DQBBF39GkIChogQpH4Ah0gAqXoKChSgqOgQ6QkKAgoQKJYYL8RDJZ2U7s7N2P6p5ZtiXb3Z2d2WcAAAAAAAAA4J8n0zQdG2OMbZ7n6bqusxACoKoqj8MwmMvl9vt9z2az+fM8P8/zfJ7n+fV6fQchBCFE0XUdgNls9nEcxzAMwzRN02Kx+H6/3+93u93u0tJSLBYLwzAMGYYhSZJcW1vL5XL5arW6Uqk8k8mEw+Hw4XBYaWkpq9XK5XJ5cHCwWCw+Go2+2+2m0+m8Xi8/Pz86nQ6n0+n5+fnk8/lwOJw4HE4kEgnP8+Tz+WQymUwmk8vl8sLCQjqdDgCA3W5nMpm8vb3V6/WWy+V6vd7tdvvn8/nc3Nz0ej0AANfr9e12+8fHh9ls9uTk5Kqqqg4ODqLRaAAAuVwul8vl+vr6KioqzGYzAIBOp9Pp9KqqqnK5XAAAJpNJp9Pp8vLyAADRaDRdXV2+vr7u7u6kUilBEIQgCHr9fr/fHwAAAAD8G+0ByxKk1cUZFqYAAAAASUVORK5CYII=';

export async function generateQuotePdf({ quote, request, portalUrl }: { quote: QuoteWithItems; request: RequestWithRelations; portalUrl: string }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(logoPngBase64, 'base64'));
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

  page.drawImage(logo, { x: margin, y: y - 62, width: 112, height: 56 });
  page.drawText(mdCompany.name, { x: 138, y: y - 8, size: 16, font: bold, color: blue });
  page.drawText(`Razão Social: ${mdCompany.legalName}`, { x: 138, y: y - 28, size: 9, font: regular, color: black });
  page.drawText(`CNPJ: ${mdCompany.document}`, { x: 138, y: y - 44, size: 9, font: regular, color: black });
  page.drawText(`Endereço: ${mdCompany.address}`, { x: 138, y: y - 60, size: 8, font: regular, color: black });
  move(92);

  page.drawText('ORÇAMENTO', { x: margin, y, size: 24, font: bold, color: blue });
  page.drawText(`Nº: ${quote.quoteNumber ?? quote.id}`, { x: 350, y: y + 8, size: 10, font: bold, color: black });
  page.drawText(`Emissão: ${formatDate(quote.createdAt)}`, { x: 350, y: y - 8, size: 9, font: regular, color: black });
  move(22);
  rule();
  move(26);

  section('Dados do cliente');
  row('Empresa / Cliente', request.company.name, 'CNPJ / CPF', request.company.document ?? '-');
  row('Solicitante', displayValue(request.responsavel), 'E-mail', request.requester.email);
  row('Telefone', displayValue(request.telefone), 'Protocolo / O.S.', request.protocol);
  move(10);

  section('Dados do equipamento');
  row('Equipamento', displayValue(request.tipoAparelho), 'Marca', displayValue(request.marca));
  row('Modelo', displayValue(request.modelo), 'Serial / IMEI', displayValue(request.serial));
  fullRow('Problema informado', displayValue(request.problema));
  move(10);

  section('Itens do orçamento');
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
  row('Prazo de execução', `${quote.executionDeadlineDays} dias`, 'Status', quoteStatusLabel(quote.status));
  if (quote.notes) fullRow('Observações', quote.notes);

  y = Math.max(y - 18, 72);
  rule();
  move(18);
  text(`Portal: ${portalUrl}`, margin, 8, regular, gray);
  move(14);
  text('Documento gerado pelo Portal MD Comércio e Serviços', margin, 8, regular, gray);
  move(14);
  text('A aprovação deste orçamento autoriza a execução dos serviços descritos.', margin, 8, regular, gray);

  return pdf.save();

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
    page.drawText('Unitário', { x: 420, y, size: 8, font: bold, color: rgb(1, 1, 1) });
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
