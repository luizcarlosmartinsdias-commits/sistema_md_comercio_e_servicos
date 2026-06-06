import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Company, Quote, QuoteItem, ServiceRequest, User } from '@prisma/client';
import { mdBrand } from '@/lib/brand';
import { formatMoney } from '@/lib/format';

type QuoteWithItems = Quote & { items: QuoteItem[] };
type RequestWithRelations = ServiceRequest & { company: Company; requester: User };

const mdCompany = {
  name: 'MD COMÉRCIO E SERVIÇOS',
  legalName: 'LUIZ CARLOS MARTINS DIAS JUNIOR 13345695766',
  document: '42.595.449/0001-90',
  address: 'Rua Arpoador, 75 - Areal - Araruama/RJ - CEP 28976-366',
  activity: 'manutenção, reparo, instalação e comércio de equipamentos eletroeletrônicos.'
};

export async function generateQuotePdf({ quote, request, portalUrl }: { quote: QuoteWithItems; request: RequestWithRelations; portalUrl: string }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.02, 0.22, 0.52);
  const dark = rgb(0.08, 0.12, 0.2);
  const gray = rgb(0.35, 0.39, 0.45);
  const light = rgb(0.94, 0.97, 1);
  const border = rgb(0.15, 0.36, 0.68);
  const margin = 32;
  let y = 804;

  const drawText = (value: string, x: number, top: number, size = 10, options?: { bold?: boolean; color?: ReturnType<typeof rgb> }) => {
    page.drawText(safe(value), { x, y: top, size, font: options?.bold ? bold : regular, color: options?.color ?? dark });
  };

  const ensureSpace = (height: number) => {
    if (y - height > 58) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 804;
  };

  await drawHeader();
  drawQuoteMetaCards();

  sectionTitle('DADOS DO CLIENTE');
  fieldLine('Empresa / Cliente', request.company.name, margin, 360);
  twoColumns([
    ['CNPJ / CPF', request.company.document ?? '-'],
    ['Contato', request.responsavel],
    ['Telefone', request.telefone],
    ['E-mail', request.requester.email],
    ['Endereço', request.company.address ?? '-']
  ]);

  sectionTitle('DADOS DO EQUIPAMENTO');
  twoColumns([
    ['Equipamento', request.tipoAparelho],
    ['Marca', request.marca],
    ['Modelo', request.modelo],
    ['Nº de série / IMEI', request.serial],
    ['Defeito informado', request.problema]
  ]);

  sectionTitle('ITENS DO ORÇAMENTO');
  tableHeader();
  quote.items.forEach((item, index) => {
    ensureSpace(24);
    const total = item.quantity * item.unitCents;
    page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: 563, y: y - 7 }, thickness: 0.3, color: rgb(0.82, 0.86, 0.9) });
    drawText(String(index + 1), margin + 13, y, 9, { bold: true, color: blue });
    drawText(trim(item.description, 58), margin + 48, y, 9);
    drawText(String(item.quantity), margin + 348, y, 9);
    drawText(formatMoney(item.unitCents), margin + 398, y, 9);
    drawText(formatMoney(total), margin + 482, y, 9);
    y -= 20;
  });

  y -= 6;
  totalsBox();
  y -= 28;

  sectionTitle('CONDIÇÕES');
  fieldLine('Prazo de execução', `${quote.executionDeadlineDays} dias`, margin, 520);
  fieldLine('Garantia', `${quote.warrantyDays} dias`, margin, 520);
  fieldLine('Validade do orçamento', `${quote.validityDays} dias`, margin, 520);
  fieldLine('Status', quoteStatusLabel(quote.status), margin, 520);
  if (quote.notes) fieldLine('Observações', wrapLine(quote.notes), margin, 520);

  page.drawLine({ start: { x: margin, y: 72 }, end: { x: 563, y: 72 }, thickness: 1, color: border });
  drawText(`Portal: ${portalUrl}`, 134, 52, 9, { color: gray });
  drawText('Documento gerado pelo Portal MD Comércio e Serviços', 134, 38, 9, { color: gray });
  drawText('A aprovação deste orçamento autoriza a execução dos serviços descritos.', 134, 24, 9, { color: gray });

  return pdf.save();

  async function drawHeader() {
    try {
      const logo = await pdf.embedPng(Buffer.from(mdBrand.logoPngBase64, 'base64'));
      page.drawImage(logo, { x: margin + 5, y: y - 78, width: 116, height: 87 });
    } catch (error) {
      console.error('[quote-pdf] Falha ao embutir logo MD no PDF', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      drawText('MD', margin + 24, y - 42, 28, { bold: true, color: blue });
      drawText(mdBrand.name, margin + 12, y - 62, 10, { bold: true, color: dark });
    }

    page.drawLine({ start: { x: 170, y: y - 8 }, end: { x: 170, y: y - 78 }, thickness: 1, color: border });
    drawText(mdCompany.name, 190, y - 10, 16, { bold: true, color: blue });
    drawText(`Razão Social: ${mdCompany.legalName}`, 190, y - 31, 9);
    drawText(`CNPJ: ${mdCompany.document}`, 190, y - 48, 9);
    drawText(`Endereço: ${mdCompany.address}`, 190, y - 65, 8);
    y -= 112;
    page.drawLine({ start: { x: margin, y: y + 15 }, end: { x: 242, y: y + 15 }, thickness: 1, color: border });
    drawText('ORÇAMENTO', 252, y, 30, { bold: true, color: blue });
    page.drawLine({ start: { x: 412, y: y + 15 }, end: { x: 563, y: y + 15 }, thickness: 1, color: border });
    y -= 42;
  }

  function drawQuoteMetaCards() {
    const cards = [
      ['Nº do Orçamento', quote.quoteNumber ?? quote.id],
      ['Data de Emissão', formatDate(quote.createdAt)],
      ['Validade', `${quote.validityDays} dias`],
      ['Ordem de Serviço / Protocolo', request.protocol]
    ];
    cards.forEach(([label, value], index) => {
      const x = margin + index * 132;
      page.drawRectangle({ x, y: y - 42, width: 120, height: 52, borderColor: border, borderWidth: 0.8, color: rgb(1, 1, 1) });
      drawText(label, x + 9, y - 9, 8, { bold: true, color: dark });
      drawText(trim(value, 18), x + 9, y - 30, 8, { color: gray });
    });
    y -= 66;
  }

  function sectionTitle(title: string) {
    ensureSpace(36);
    page.drawRectangle({ x: margin, y: y - 7, width: 132, height: 18, color: blue });
    drawText(title, margin + 7, y - 2, 10, { bold: true, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: margin + 138, y: y + 2 }, end: { x: 563, y: y + 2 }, thickness: 0.8, color: border });
    y -= 28;
  }

  function fieldLine(label: string, value: string, x: number, width: number) {
    ensureSpace(18);
    drawText(`${label}:`, x, y, 9);
    drawText(trim(value || '-', Math.floor(width / 7)), x + 104, y, 9);
    y -= 20;
  }

  function twoColumns(rows: Array<[string, string]>) {
    rows.forEach((row, index) => {
      ensureSpace(20);
      const x = index % 2 === 0 ? margin : 318;
      if (index % 2 === 0 && index > 0) y -= 20;
      drawText(`${row[0]}:`, x, y, 9);
      drawText(trim(row[1] || '-', 30), x + 92, y, 9);
    });
    y -= 32;
  }

  function tableHeader() {
    ensureSpace(24);
    page.drawRectangle({ x: margin, y: y - 8, width: 531, height: 22, color: blue });
    drawText('Item', margin + 10, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Descrição do Serviço / Peça', margin + 48, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Qtd.', margin + 344, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Valor Unitário', margin + 395, y, 8, { bold: true, color: rgb(1, 1, 1) });
    drawText('Total', margin + 482, y, 8, { bold: true, color: rgb(1, 1, 1) });
    y -= 28;
  }

  function totalsBox() {
    const x = 330;
    page.drawRectangle({ x, y: y - 58, width: 233, height: 64, borderColor: border, borderWidth: 0.8, color: rgb(1, 1, 1) });
    drawText('Subtotal', x + 14, y - 10, 10);
    drawText(formatMoney(quote.subtotalCents || quote.totalCents + quote.discountCents), x + 150, y - 10, 10);
    drawText('Desconto', x + 14, y - 30, 10);
    drawText(formatMoney(quote.discountCents), x + 150, y - 30, 10);
    page.drawRectangle({ x, y: y - 58, width: 233, height: 22, color: light });
    drawText('VALOR FINAL', x + 14, y - 51, 12, { bold: true, color: dark });
    drawText(formatMoney(quote.totalCents), x + 150, y - 51, 12, { bold: true, color: blue });
    y -= 70;
  }
}

function quoteStatusLabel(status: string) {
  if (status === 'ENVIADO') return 'Aguardando aprovação';
  if (status === 'APROVADO') return 'Aprovado';
  if (status === 'RECUSADO') return 'Reprovado';
  return status;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function safe(value: string) {
  return String(value ?? '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function trim(value: string, length: number) {
  const clean = safe(value);
  return clean.length > length ? `${clean.slice(0, length - 3)}...` : clean;
}

function wrapLine(value: string) {
  return trim(value.replace(/\s+/g, ' '), 110);
}
