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

// Logo otimizada e embutida no código para evitar falha de leitura do /public na Vercel.
const logoPngBase64 = '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';

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
  const lightBlue = rgb(0.94, 0.97, 1);

  const margin = 40;
  const rightEdge = 555;
  const contentWidth = rightEdge - margin;
  let y = 800;

  const draw = (value: string, x: number, yy: number, size = 10, font = regular, color = black) => {
    page.drawText(safe(value), { x, y: yy, size, font, color });
  };
  const move = (amount: number) => { y -= amount; };
  const ensure = (height: number) => {
    if (y - height > 52) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 800;
  };
  const rule = () => page.drawLine({ start: { x: margin, y }, end: { x: rightEdge, y }, thickness: 0.8, color: line });

  console.info('[quote-pdf]', { etapa: 'draw_header_start', quoteId: quote.id, requestId: request.id });
  await drawLogo();

  draw(mdCompany.name, 210, y - 8, 16, bold, blue);
  draw(`Razão Social: ${mdCompany.legalName}`, 210, y - 28, 9, regular, black);
  draw(`CNPJ: ${mdCompany.document}`, 210, y - 44, 9, regular, black);
  draw(`Endereço: ${mdCompany.address}`, 210, y - 60, 8, regular, black);
  move(100);

  draw('ORÇAMENTO', margin, y, 25, bold, blue);
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
    page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: rightEdge, y: y - 7 }, thickness: 0.4, color: line });
    draw(String(index + 1), margin + 6, y, 9, regular, black);
    draw(trim(item.description, 70), margin + 38, y, 9, regular, black);
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
  draw(`Portal: ${portalUrl}`, margin, y, 8, regular, gray);
  move(14);
  draw('Documento gerado pelo Portal MD Comércio e Serviços', margin, y, 8, regular, gray);
  move(14);
  draw('A aprovação deste orçamento autoriza a execução dos serviços descritos.', margin, y, 8, regular, gray);

  const pdfBytes = await pdf.save();
  console.info('[quote-pdf]', { etapa: 'generate_pdf_done', quoteId: quote.id, requestId: request.id, protocol: request.protocol, pdfBytes: pdfBytes.length });
  return pdfBytes;

  async function drawLogo() {
    try {
      console.info('[quote-pdf]', { etapa: 'load_logo_start', quoteId: quote.id, requestId: request.id });
      const logo = await pdf.embedPng(Buffer.from(logoPngBase64, 'base64'));
      page.drawImage(logo, { x: margin, y: y - 82, width: 150, height: 88 });
      console.info('[quote-pdf]', { etapa: 'load_logo_done', quoteId: quote.id, requestId: request.id });
    } catch (error) {
      console.error('[quote-pdf]', { etapa: 'load_logo_failed', quoteId: quote.id, requestId: request.id, error: errorMessage(error) });
      page.drawRectangle({ x: margin, y: y - 72, width: 150, height: 70, borderColor: blue, borderWidth: 1.2, color: rgb(0.97, 0.99, 1) });
      draw('MD', margin + 18, y - 44, 36, bold, blue);
      page.drawLine({ start: { x: margin + 18, y: y - 54 }, end: { x: margin + 128, y: y - 54 }, thickness: 1, color: blue });
      draw('Comércio e Serviços', margin + 18, y - 66, 7, regular, black);
    }
  }

  function section(title: string) {
    ensure(38);
    page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 18, color: blue });
    draw(title.toUpperCase(), margin + 8, y, 10, bold, rgb(1, 1, 1));
    move(30);
  }

  function row(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
    ensure(24);
    draw(`${leftLabel}:`, margin, y, 9, bold, blue);
    draw(trim(leftValue || '-', 30), margin + 118, y, 9, regular, black);
    draw(`${rightLabel}:`, 318, y, 9, bold, blue);
    draw(trim(rightValue || '-', 20), 432, y, 9, regular, black);
    move(22);
  }

  function fullRow(rowLabel: string, value: string) {
    ensure(24);
    draw(`${rowLabel}:`, margin, y, 9, bold, blue);
    draw(trim(value || '-', 82), margin + 128, y, 9, regular, black);
    move(22);
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
