import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Company, Quote, QuoteItem, ServiceRequest, User } from '@prisma/client';
import { formatMoney } from '@/lib/format';

type QuoteWithItems = Quote & { items: QuoteItem[] };
type RequestWithRelations = ServiceRequest & { company: Company; requester: User };

const mdCompany = {
  name: 'MD COMERCIO E SERVICOS',
  legalName: 'LUIZ CARLOS MARTINS DIAS JUNIOR 13345695766',
  document: '42.595.449/0001-90',
  address: 'Rua Arpoador, 75 - Areal - Araruama/RJ - CEP 28976-366',
  activity: 'manutencao, reparo, instalacao e comercio de equipamentos eletroeletronicos.'
};

export async function generateQuotePdf({ quote, request, portalUrl }: { quote: QuoteWithItems; request: RequestWithRelations; portalUrl: string }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.04, 0.18, 0.36);
  const yellow = rgb(0.95, 0.75, 0.18);
  const gray = rgb(0.35, 0.39, 0.45);
  const light = rgb(0.94, 0.97, 1);
  const margin = 36;
  let y = 800;

  const drawText = (value: string, x: number, top: number, size = 10, options?: { bold?: boolean; color?: ReturnType<typeof rgb> }) => {
    page.drawText(safe(value), { x, y: top, size, font: options?.bold ? bold : regular, color: options?.color ?? rgb(0.08, 0.1, 0.14) });
  };

  const ensureSpace = (height: number) => {
    if (y - height > 50) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 800;
  };

  page.drawRectangle({ x: margin, y: y - 58, width: 82, height: 48, color: blue });
  page.drawRectangle({ x: margin + 54, y: y - 58, width: 28, height: 48, color: yellow });
  drawText('MD', margin + 13, y - 42, 24, { bold: true, color: rgb(1, 1, 1) });
  drawText(mdCompany.name, margin + 96, y - 8, 16, { bold: true, color: blue });
  drawText(mdCompany.legalName, margin + 96, y - 24, 9, { color: gray });
  drawText(`CNPJ: ${mdCompany.document}`, margin + 96, y - 38, 9, { color: gray });
  drawText(mdCompany.address, margin + 96, y - 52, 8, { color: gray });
  drawText(`Orcamento: ${quote.quoteNumber ?? quote.id}`, 405, y - 10, 10, { bold: true });
  drawText(`Emissao: ${formatDate(quote.createdAt)}`, 405, y - 26, 9);
  y -= 86;

  sectionTitle('Cliente');
  twoColumns([
    ['Empresa cliente', request.company.name],
    ['CNPJ/CPF', request.company.document ?? '-'],
    ['Solicitante', request.requester.name],
    ['Telefone', request.telefone],
    ['E-mail', request.requester.email],
    ['Protocolo/O.S.', request.protocol]
  ]);

  sectionTitle('Aparelho');
  twoColumns([
    ['Tipo de aparelho', request.tipoAparelho],
    ['Marca', request.marca],
    ['Modelo', request.modelo],
    ['Serial/IMEI', request.serial],
    ['Problema informado', request.problema]
  ]);

  sectionTitle('Servicos e pecas');
  tableHeader();
  quote.items.forEach((item, index) => {
    ensureSpace(24);
    const total = item.quantity * item.unitCents;
    drawText(String(index + 1), margin, y, 9);
    drawText(trim(item.description, 54), margin + 34, y, 9);
    drawText(String(item.quantity), margin + 330, y, 9);
    drawText(formatMoney(item.unitCents), margin + 390, y, 9);
    drawText(formatMoney(total), margin + 475, y, 9);
    y -= 18;
  });

  y -= 8;
  drawText(`Subtotal: ${formatMoney(quote.subtotalCents || quote.totalCents + quote.discountCents)}`, 365, y, 10, { bold: true });
  y -= 16;
  drawText(`Desconto: ${formatMoney(quote.discountCents)}`, 365, y, 10);
  y -= 18;
  drawText(`Valor final: ${formatMoney(quote.totalCents)}`, 365, y, 12, { bold: true, color: blue });
  y -= 36;

  sectionTitle('Condicoes');
  twoColumns([
    ['Validade do orcamento', `${quote.validityDays} dias`],
    ['Prazo de execucao', `${quote.executionDeadlineDays} dias`],
    ['Garantia', `${quote.warrantyDays} dias`],
    ['Status', quoteStatusLabel(quote.status)]
  ]);

  if (quote.notes) {
    ensureSpace(44);
    sectionTitle('Observacoes');
    drawText(wrapLine(quote.notes), margin, y, 9);
    y -= 24;
  }

  ensureSpace(74);
  page.drawLine({ start: { x: margin, y: 74 }, end: { x: 560, y: 74 }, thickness: 0.5, color: rgb(0.82, 0.86, 0.9) });
  drawText(`Portal: ${portalUrl}`, margin, 56, 8, { color: gray });
  drawText('Documento gerado pelo Portal MD Comercio e Servicos', margin, 42, 8, { color: gray });
  drawText(mdCompany.activity, margin, 28, 8, { color: gray });

  return pdf.save();

  function sectionTitle(title: string) {
    ensureSpace(36);
    page.drawRectangle({ x: margin, y: y - 7, width: 523, height: 20, color: light });
    drawText(title, margin + 8, y, 11, { bold: true, color: blue });
    y -= 30;
  }

  function twoColumns(rows: Array<[string, string]>) {
    rows.forEach((row, index) => {
      ensureSpace(20);
      const x = index % 2 === 0 ? margin : 318;
      if (index % 2 === 0 && index > 0) y -= 20;
      drawText(`${row[0]}:`, x, y, 8, { bold: true, color: gray });
      drawText(trim(row[1] || '-', 32), x + 92, y, 8);
    });
    y -= 30;
  }

  function tableHeader() {
    ensureSpace(24);
    page.drawRectangle({ x: margin, y: y - 7, width: 523, height: 20, color: blue });
    drawText('Item', margin, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Servico/peca', margin + 34, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Qtd.', margin + 330, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Valor unit.', margin + 390, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Total', margin + 475, y, 8, { bold: true, color: rgb(1, 1, 1) });
    y -= 28;
  }
}

function quoteStatusLabel(status: string) {
  if (status === 'ENVIADO') return 'Aguardando aprovacao';
  if (status === 'APROVADO') return 'Aprovado';
  if (status === 'RECUSADO') return 'Reprovado';
  return status;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function safe(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

function trim(value: string, length: number) {
  const clean = safe(value);
  return clean.length > length ? `${clean.slice(0, length - 3)}...` : clean;
}

function wrapLine(value: string) {
  return trim(value.replace(/\s+/g, ' '), 110);
}
