import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

interface ConfiguracaoEmpresa {
  nome_empresa: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  logo_url: string | null;
}

interface Cliente {
  nome: string;
  cpf_cnpj: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
}

interface OrcamentoItem {
  codigo: string;
  nome: string;
  localizacao: string;
  unidade?: string | null;
  quantidade: number;
  preco_unitario: number;
  desconto?: number;
  subtotal: number;
  peso?: number;
  peso_kg_m?: number | null;
  comprimento_barra?: number | null;
  peso_total_kg?: number | null;
  preco_por_kg?: number | null;
  imagem_url?: string | null;
  imagemDataURL?: string | null;
}

interface DadosOrcamento {
  numero: string;
  data: string;
  validade: string;
  cliente: Cliente;
  vendedor?: any;
  loja?: string;
  itens: OrcamentoItem[];
  valor_total: number;
  observacoes?: string;
  pagamento?: any;
  assinatura?: {
    nome: string;
    cargo?: string | null;
    tipo?: string | null;
    data: string;
    imagem?: string | null;
  } | null;
}

// Miniatura impressa com 14mm: 240px ≈ 435 dpi, nítida na tela e na impressão
const THUMB_SIZE = 240;
const THUMB_QUALITY = 0.85;
const MARGIN = 15;
const GRAY_LINE: [number, number, number] = [130, 130, 130];
const GRAY_HEAD: [number, number, number] = [235, 235, 235];
const GRAY_LABEL: [number, number, number] = [95, 95, 95];

function gerarMiniatura(img: HTMLImageElement): string {
  const scale = Math.min(THUMB_SIZE / img.width, THUMB_SIZE / img.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Fundo branco: sem ele, áreas transparentes de PNG viram preto no JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
}

async function carregarImagemDaURL(url: string): Promise<string> {
  const isDataURL = url.startsWith('data:');

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!isDataURL) img.crossOrigin = 'Anonymous';

    img.onload = () => resolve(gerarMiniatura(img));
    img.onerror = isDataURL ? () => resolve(url) : reject;
    img.src = url;
  });
}

interface LogoInfo {
  dataURL: string;
  aspect: number;
}

async function carregarLogo(url: string): Promise<LogoInfo | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      if (!url.startsWith('data:')) img.crossOrigin = 'Anonymous';

      img.onload = () => {
        const maxW = 320;
        const maxH = 160;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        resolve({ dataURL: canvas.toDataURL('image/png'), aspect: img.width / img.height });
      };
      img.onerror = reject;
      img.src = url;
    });
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
    return null;
  }
}

interface ParcelaCalculada {
  dias: number;
  data: string;
  forma: string;
  valor: number;
}

function calcularParcelasPDF(pagamento: any, valorTotal: number): ParcelaCalculada[] {
  if (!pagamento) return [];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const formaLabel = pagamento.forma || 'A combinar';

  if (pagamento.pagamento_misto) {
    return [
      {
        dias: 0,
        data: hoje.toLocaleDateString('pt-BR'),
        forma: 'Pagamento Misto (crédito + ' + (pagamento.forma_pagamento_restante || 'restante') + ')',
        valor: valorTotal,
      },
    ];
  }

  if (!pagamento.parcelas || pagamento.parcelas <= 1) {
    return [{ dias: 0, data: hoje.toLocaleDateString('pt-BR'), forma: formaLabel, valor: valorTotal }];
  }

  // Dias de vencimento extraidos da condicao digitada livremente
  // ("28/56", "0/28/56", "20/40/60"...). Sem condicao: cai em 30/60/90...
  const diasDaCondicao = String(pagamento.condicao || '')
    .split(/[^\d]+/)
    .filter((p: string) => p !== '')
    .map((n: string) => parseInt(n, 10))
    .filter((n: number) => Number.isFinite(n) && n >= 0);

  const diasVencimentos: number[] =
    diasDaCondicao.length > 0
      ? diasDaCondicao
      : Array.from({ length: pagamento.parcelas }, (_, i) => (i + 1) * 30);

  const resultado: ParcelaCalculada[] = [];

  if (pagamento.entrada && pagamento.entrada > 0) {
    resultado.push({ dias: 0, data: hoje.toLocaleDateString('pt-BR'), forma: formaLabel, valor: pagamento.entrada });

    const temZero = diasVencimentos[0] === 0;
    const diasParcelas = temZero ? diasVencimentos.slice(1) : diasVencimentos;
    const valorRestante = valorTotal - pagamento.entrada;
    const base = Number((valorRestante / (diasParcelas.length || 1)).toFixed(2));

    diasParcelas.forEach((d, i) => {
      const venc = new Date(hoje);
      venc.setDate(venc.getDate() + d);
      const valor = i === diasParcelas.length - 1 ? Number((valorRestante - base * i).toFixed(2)) : base;
      resultado.push({ dias: d, data: venc.toLocaleDateString('pt-BR'), forma: formaLabel, valor });
    });

    return resultado;
  }

  const base = pagamento.valor_parcela || Number((valorTotal / (diasVencimentos.length || 1)).toFixed(2));

  diasVencimentos.forEach((d, i) => {
    const venc = new Date(hoje);
    venc.setDate(venc.getDate() + d);
    const valor = i === diasVencimentos.length - 1 ? Number((valorTotal - base * i).toFixed(2)) : base;
    resultado.push({ dias: d, data: venc.toLocaleDateString('pt-BR'), forma: formaLabel, valor });
  });

  return resultado;
}

export type TipoDocumento = 'orcamento' | 'pedido';

export async function gerarPDFOrcamento(
  dados: DadosOrcamento,
  config: ConfiguracaoEmpresa,
  mostrarKg: boolean = true,
  tipo: TipoDocumento = 'orcamento'
): Promise<Blob> {
  const doc = new jsPDF();

  const ehPedido = tipo === 'pedido';
  const docLabel = ehPedido ? 'Pedido' : 'Orçamento';
  // No Pedido o número não leva o prefixo "ORC-" (é o mesmo registro do
  // orçamento aprovado, mas o documento é um Pedido).
  const numeroDoc = ehPedido ? dados.numero.replace(/^ORC-?/i, '') : dados.numero;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  let logo: LogoInfo | null = null;
  if (config.logo_url) {
    logo = await carregarLogo(config.logo_url);
  }

  await Promise.all(
    dados.itens.map(async item => {
      if (item.imagem_url) {
        try {
          item.imagemDataURL = await carregarImagemDaURL(item.imagem_url);
        } catch (error) {
          console.error(`Erro ao carregar imagem do item ${item.codigo}:`, error);
          item.imagemDataURL = null;
        }
      }
    })
  );

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(ehPedido ? `Pedido ${numeroDoc}` : `Válido até ${dados.validade}`, MARGIN, pageHeight - 8);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  /** Cabeçalho compacto usado apenas nas páginas de continuação (2+). */
  const drawContinuationHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${docLabel} ${numeroDoc} (continuação)`, MARGIN, 15);
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 18, pageWidth - MARGIN, 18);
  };

  const ensureSpace = (needed: number, y: number): number => {
    if (y + needed > pageHeight - 22) {
      doc.addPage();
      drawContinuationHeader();
      return 26;
    }
    return y;
  };

  // ========== CABEÇALHO (logo + dados da empresa) ==========
  let logoBottom = MARGIN;
  if (logo) {
    const boxW = 42;
    const boxH = 22;
    let imgW = boxW;
    let imgH = imgW / logo.aspect;
    if (imgH > boxH) {
      imgH = boxH;
      imgW = imgH * logo.aspect;
    }
    try {
      doc.addImage(logo.dataURL, 'PNG', MARGIN, 12, imgW, imgH);
      logoBottom = 12 + imgH;
    } catch (error) {
      console.error('Erro ao desenhar logo:', error);
    }
  }

  let companyY = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(config.nome_empresa || 'Empresa', pageWidth - MARGIN, companyY, { align: 'right' });
  companyY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  if (config.telefone) {
    doc.text(`Tel: ${config.telefone}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }
  if (config.endereco) {
    const linhas = doc.splitTextToSize(config.endereco, 95);
    linhas.forEach((linha: string) => {
      doc.text(linha, pageWidth - MARGIN, companyY, { align: 'right' });
      companyY += 4;
    });
  }
  if (config.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }
  if (config.email) {
    doc.text(config.email, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }

  let y = Math.max(logoBottom, companyY) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(`${docLabel} ${numeroDoc}`, pageWidth / 2, y, { align: 'center' });
  y += 9;

  // ========== CLIENTE + NÚMERO/DATA/VALIDADE ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Cliente', MARGIN, y);
  y += 3;

  const leftBoxW = contentWidth * 0.62;
  const rightBoxW = contentWidth - leftBoxW - 4;
  const clienteBoxH = 26;
  const clienteBoxTop = y;

  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, clienteBoxTop, leftBoxW, clienteBoxH);
  doc.rect(MARGIN + leftBoxW + 4, clienteBoxTop, rightBoxW, clienteBoxH);

  let cy = clienteBoxTop + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.cliente.nome, MARGIN + 3, cy);
  cy += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  if (dados.cliente.cpf_cnpj) {
    doc.text(`CNPJ/CPF: ${dados.cliente.cpf_cnpj}`, MARGIN + 3, cy);
    cy += 4;
  }
  if (dados.cliente.endereco) {
    const linhasEnd = doc.splitTextToSize(dados.cliente.endereco, leftBoxW - 6);
    linhasEnd.slice(0, 2).forEach((linha: string) => {
      doc.text(linha, MARGIN + 3, cy);
      cy += 4;
    });
  }
  const contatos = [dados.cliente.telefone ? `Fone: ${dados.cliente.telefone}` : null, dados.cliente.email]
    .filter(Boolean)
    .join('   ');
  if (contatos) doc.text(contatos, MARGIN + 3, cy);

  const rx = MARGIN + leftBoxW + 4;
  const rowH = clienteBoxH / 3;
  const metaRows: [string, string][] = [
    [ehPedido ? 'Número do pedido' : 'Número do orçamento', numeroDoc],
    ['Data', dados.data],
    [ehPedido ? 'Aprovado em' : 'Validade', dados.validade],
  ];
  metaRows.forEach((row, i) => {
    const ry = clienteBoxTop + rowH * i;
    if (i > 0) doc.line(rx, ry, rx + rightBoxW, ry);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(row[0].toUpperCase(), rx + 2, ry + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(row[1], rx + 2, ry + rowH - 2.5);
  });

  y = clienteBoxTop + clienteBoxH + 6;

  // ========== VENDEDOR / LOJA ==========
  const halfW = (contentWidth - 4) / 2;
  const vBoxH = 14;

  doc.setDrawColor(...GRAY_LINE);
  doc.rect(MARGIN, y, halfW, vBoxH);
  doc.rect(MARGIN + halfW + 4, y, halfW, vBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('VENDEDOR', MARGIN + 3, y + 4.5);
  doc.text('LOJA', MARGIN + halfW + 4 + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.vendedor?.nome || '-', MARGIN + 3, y + 10.5);
  doc.text(dados.loja || 'Matriz', MARGIN + halfW + 4 + 3, y + 10.5);

  y += vBoxH + 8;

  // ========== ITENS DO ORÇAMENTO ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Itens do ${docLabel}`, MARGIN, y);
  y += 3;

  const temInfoKg = dados.itens.some(item => item.peso_total_kg || item.preco_por_kg || item.peso_kg_m);
  const deveMostrarKg = mostrarKg && temInfoKg;

  let headers: string[];
  let columnStyles: any;

  if (deveMostrarKg) {
    headers = ['Foto', 'Código', 'Descrição', 'Localização', 'Un.', 'Qtd', 'Peso/Kg', 'Preço Unit.', 'Desc. %', 'Subtotal'];
    columnStyles = {
      0: { cellWidth: 16, halign: 'center', valign: 'middle' },
      1: { cellWidth: 16 },
      2: { cellWidth: 40 },
      3: { cellWidth: 18 },
      4: { halign: 'center', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 10 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'right', cellWidth: 20 },
      8: { halign: 'center', cellWidth: 12 },
      9: { halign: 'right', cellWidth: 22 },
    };
  } else {
    headers = ['Foto', 'Código', 'Descrição', 'Localização', 'Un.', 'Qtd', 'Preço Unit.', 'Desc. %', 'Subtotal'];
    columnStyles = {
      0: { cellWidth: 16, halign: 'center', valign: 'middle' },
      1: { cellWidth: 18 },
      2: { cellWidth: 48 },
      3: { cellWidth: 20 },
      4: { halign: 'center', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 10 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'right', cellWidth: 22 },
    };
  }

  const tableData = dados.itens.map(item => {
    const descontoFormatado = item.desconto ? `${item.desconto}%` : '0%';
    const unidade = item.unidade || 'Un';

    if (deveMostrarKg) {
      let pesoInfo = '-';
      if (item.peso_total_kg) {
        pesoInfo = `${item.peso_total_kg.toFixed(3)} kg`;
      } else if (item.preco_por_kg) {
        pesoInfo = `R$ ${item.preco_por_kg.toFixed(2)}/kg`;
      } else if (item.peso_kg_m) {
        const comprimento = item.comprimento_barra || 6;
        const pesoTotal = item.peso_kg_m * comprimento * item.quantidade;
        pesoInfo = `${pesoTotal.toFixed(3)} kg`;
      }

      return [
        '',
        item.codigo,
        item.nome,
        item.localizacao || '-',
        unidade,
        item.quantidade.toString(),
        pesoInfo,
        `R$ ${item.preco_unitario.toFixed(2)}`,
        descontoFormatado,
        `R$ ${item.subtotal.toFixed(2)}`,
      ];
    }

    return [
      '',
      item.codigo,
      item.nome,
      item.localizacao || '-',
      unidade,
      item.quantidade.toString(),
      `R$ ${item.preco_unitario.toFixed(2)}`,
      descontoFormatado,
      `R$ ${item.subtotal.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: tableData,
    theme: 'grid',

    headStyles: {
      fillColor: GRAY_HEAD,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },

    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
      valign: 'middle',
      textColor: [0, 0, 0],
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },

    columnStyles,

    margin: {
      top: 26,
      left: MARGIN,
      right: MARGIN,
      bottom: 22,
    },

    didParseCell: data => {
      if (data.section === 'body') {
        data.cell.styles.minCellHeight = 18;
      }
    },

    didDrawCell: data => {
      if (data.section === 'body' && data.column.index === 0) {
        const item = dados.itens[data.row.index];

        if (item?.imagemDataURL) {
          try {
            const format = item.imagemDataURL.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(item.imagemDataURL, format, data.cell.x + 2, data.cell.y + 2, 14, 14);
          } catch (error) {
            console.error('Erro ao desenhar imagem do item:', error);
          }
        } else {
          doc.setFontSize(6);
          doc.setTextColor(120, 120, 120);
          doc.text('Sem foto', data.cell.x + 3, data.cell.y + 10);
          doc.setTextColor(0, 0, 0);
        }
      }
    },

    didDrawPage: data => {
      if (data.pageNumber > 1) {
        drawContinuationHeader();
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ========== RESUMO / TOTAIS ==========
  const pesoTotal = dados.itens.reduce((sum, item) => {
    let itemPeso = 0;
    if (item.peso_total_kg) {
      itemPeso = item.peso_total_kg;
    } else if (item.peso_kg_m && item.comprimento_barra) {
      itemPeso = item.peso_kg_m * item.comprimento_barra * item.quantidade;
    } else if (item.peso) {
      itemPeso = item.peso * item.quantidade;
    }
    return sum + itemPeso;
  }, 0);
  const mostrarPeso = deveMostrarKg && pesoTotal > 0;

  const nItens = dados.itens.length;
  const somaQtdes = dados.itens.reduce((sum, item) => sum + item.quantidade, 0);

  y = ensureSpace(mostrarPeso ? 30 : 26, y);

  const totalsX = pageWidth - MARGIN;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);

  doc.text(`N° de itens: ${nItens}`, totalsX, y, { align: 'right' });
  y += 4.5;
  doc.text(`Soma das Qtdes: ${somaQtdes.toLocaleString('pt-BR')}`, totalsX, y, { align: 'right' });
  y += 4.5;
  if (mostrarPeso) {
    doc.text(`Peso Total: ${pesoTotal.toFixed(3)} kg`, totalsX, y, { align: 'right' });
    y += 4.5;
  }
  doc.text(
    `Total de produtos: R$ ${dados.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    totalsX,
    y,
    { align: 'right' }
  );
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Total do ${docLabel}: R$ ${dados.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    totalsX,
    y,
    { align: 'right' }
  );
  y += 10;

  // ========== PARCELAS ==========
  if (dados.pagamento) {
    const parcelas = calcularParcelasPDF(dados.pagamento, dados.valor_total);

    if (parcelas.length > 0) {
      y = ensureSpace(20, y);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('Parcelas', MARGIN, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [['Dias', 'Data vencimento', 'Forma de pagamento', 'Valor', 'Observação']],
        body: parcelas.map(p => [
          p.dias.toString(),
          p.data,
          p.forma,
          `R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          '',
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: GRAY_HEAD,
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'left',
          lineColor: GRAY_LINE,
          lineWidth: 0.2,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [0, 0, 0],
          lineColor: GRAY_LINE,
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 32 },
          3: { halign: 'right', cellWidth: 28 },
          4: { cellWidth: 30 },
        },
        margin: { left: MARGIN, right: MARGIN, bottom: 22 },
        didDrawPage: data => {
          if (data.pageNumber > 1) drawContinuationHeader();
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ========== OBSERVAÇÕES ==========
  const obsTexto = (dados.observacoes || '').trim();
  const obsLinhas = obsTexto ? doc.splitTextToSize(obsTexto, contentWidth - 6) : [];
  const obsBoxH = Math.max(18, obsLinhas.length * 4 + 8);

  y = ensureSpace(obsBoxH + 8, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Observações', MARGIN, y);
  y += 3;

  doc.setDrawColor(...GRAY_LINE);
  doc.rect(MARGIN, y, contentWidth, obsBoxH);

  if (obsLinhas.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(obsLinhas, MARGIN + 3, y + 5.5);
  }

  y += obsBoxH + 10;

  // ========== ASSINATURA DO CLIENTE (somente Pedido) ==========
  if (ehPedido) {
    const assinaturaBoxH = 34;
    y = ensureSpace(assinaturaBoxH + 6, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Assinatura do cliente', MARGIN, y);
    y += 3;

    const boxTop = y;
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, boxTop, contentWidth, assinaturaBoxH);

    const assinatura = dados.assinatura;

    if (assinatura && assinatura.imagem) {
      try {
        const fmt = assinatura.imagem.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(assinatura.imagem, fmt, MARGIN + 4, boxTop + 3, 70, 24);
      } catch (error) {
        console.error('Erro ao desenhar assinatura:', error);
      }
    } else if (assinatura) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(14);
      doc.setTextColor(30, 30, 30);
      doc.text(assinatura.nome, MARGIN + 6, boxTop + 16);
    }

    // Linha de assinatura + identificação
    const lineY = boxTop + assinaturaBoxH - 9;
    doc.setDrawColor(...GRAY_LINE);
    doc.line(MARGIN + 4, lineY, MARGIN + contentWidth * 0.6, lineY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_LABEL);

    if (assinatura) {
      const ident = [
        assinatura.nome,
        assinatura.cargo ? `(${assinatura.cargo})` : null,
      ]
        .filter(Boolean)
        .join(' ');
      doc.text(ident, MARGIN + 4, lineY + 4);
      const tipoLabel = assinatura.tipo === 'digital' ? 'Assinado digitalmente' : 'Assinatura manuscrita';
      doc.text(`${tipoLabel} em ${assinatura.data}`, MARGIN + 4, lineY + 8);
    } else {
      doc.text('Assinatura', MARGIN + 4, lineY + 4);
      doc.text('Nome legível / documento', MARGIN + contentWidth * 0.62, lineY + 4);
      doc.line(MARGIN + contentWidth * 0.62, lineY, MARGIN + contentWidth - 4, lineY);
    }
  }

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output('blob');
}

// ========== ROMANEIO DE ENTREGA ==========
interface RomaneioItem {
  codigo: string;
  nome: string;
  unidade?: string | null;
  quantidade_pedida: number;
  quantidade_entregue_antes: number;
  quantidade_entregue_agora: number;
}

interface DadosRomaneio {
  numero: string;
  data: string;
  pedidoNumero: string;
  cliente: Cliente;
  itens: RomaneioItem[];
  observacoes?: string;
}

export async function gerarPDFRomaneio(dados: DadosRomaneio, config: ConfiguracaoEmpresa): Promise<Blob> {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  let logo: LogoInfo | null = null;
  if (config.logo_url) {
    logo = await carregarLogo(config.logo_url);
  }

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(`Romaneio ${dados.numero}`, MARGIN, pageHeight - 8);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const drawContinuationHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Romaneio ${dados.numero} (continuação)`, MARGIN, 15);
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 18, pageWidth - MARGIN, 18);
  };

  const ensureSpace = (needed: number, y: number): number => {
    if (y + needed > pageHeight - 22) {
      doc.addPage();
      drawContinuationHeader();
      return 26;
    }
    return y;
  };

  // ========== CABEÇALHO (logo + dados da empresa) ==========
  let logoBottom = MARGIN;
  if (logo) {
    const boxW = 42;
    const boxH = 22;
    let imgW = boxW;
    let imgH = imgW / logo.aspect;
    if (imgH > boxH) {
      imgH = boxH;
      imgW = imgH * logo.aspect;
    }
    try {
      doc.addImage(logo.dataURL, 'PNG', MARGIN, 12, imgW, imgH);
      logoBottom = 12 + imgH;
    } catch (error) {
      console.error('Erro ao desenhar logo:', error);
    }
  }

  let companyY = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(config.nome_empresa || 'Empresa', pageWidth - MARGIN, companyY, { align: 'right' });
  companyY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  if (config.telefone) {
    doc.text(`Tel: ${config.telefone}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }
  if (config.endereco) {
    const linhas = doc.splitTextToSize(config.endereco, 95);
    linhas.forEach((linha: string) => {
      doc.text(linha, pageWidth - MARGIN, companyY, { align: 'right' });
      companyY += 4;
    });
  }
  if (config.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }

  let y = Math.max(logoBottom, companyY) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(`Romaneio de Entrega ${dados.numero}`, pageWidth / 2, y, { align: 'center' });
  y += 9;

  // ========== CLIENTE + PEDIDO/DATA ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Cliente', MARGIN, y);
  y += 3;

  const leftBoxW = contentWidth * 0.62;
  const rightBoxW = contentWidth - leftBoxW - 4;
  const clienteBoxH = 22;
  const clienteBoxTop = y;

  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, clienteBoxTop, leftBoxW, clienteBoxH);
  doc.rect(MARGIN + leftBoxW + 4, clienteBoxTop, rightBoxW, clienteBoxH);

  let cy = clienteBoxTop + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.cliente.nome, MARGIN + 3, cy);
  cy += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  if (dados.cliente.endereco) {
    const linhasEnd = doc.splitTextToSize(dados.cliente.endereco, leftBoxW - 6);
    linhasEnd.slice(0, 2).forEach((linha: string) => {
      doc.text(linha, MARGIN + 3, cy);
      cy += 4;
    });
  }
  const contatos = [dados.cliente.telefone ? `Fone: ${dados.cliente.telefone}` : null].filter(Boolean).join('   ');
  if (contatos) doc.text(contatos, MARGIN + 3, cy);

  const rx = MARGIN + leftBoxW + 4;
  const rowH = clienteBoxH / 2;
  const metaRows: [string, string][] = [
    ['Pedido', dados.pedidoNumero],
    ['Data da entrega', dados.data],
  ];
  metaRows.forEach((row, i) => {
    const ry = clienteBoxTop + rowH * i;
    if (i > 0) doc.line(rx, ry, rx + rightBoxW, ry);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(row[0].toUpperCase(), rx + 2, ry + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(row[1], rx + 2, ry + rowH - 2.5);
  });

  y = clienteBoxTop + clienteBoxH + 8;

  // ========== ITENS DO ROMANEIO ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Itens desta entrega', MARGIN, y);
  y += 3;

  const headers = ['Código', 'Descrição', 'Un.', 'Qtd. pedida', 'Entregue antes', 'Entregue agora', 'Pendente'];
  const columnStyles = {
    0: { cellWidth: 22 },
    1: { cellWidth: 60 },
    2: { halign: 'center' as const, cellWidth: 14 },
    3: { halign: 'center' as const, cellWidth: 22 },
    4: { halign: 'center' as const, cellWidth: 24 },
    5: { halign: 'center' as const, cellWidth: 24 },
    6: { halign: 'center' as const, cellWidth: 20 },
  };

  const tableData = dados.itens.map(item => {
    const pendente = item.quantidade_pedida - item.quantidade_entregue_antes - item.quantidade_entregue_agora;
    return [
      item.codigo,
      item.nome,
      item.unidade || 'Un',
      item.quantidade_pedida.toString(),
      item.quantidade_entregue_antes.toString(),
      item.quantidade_entregue_agora.toString(),
      Math.max(0, pendente).toString(),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: GRAY_HEAD,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      valign: 'middle',
      textColor: [0, 0, 0],
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    columnStyles,
    margin: { top: 26, left: MARGIN, right: MARGIN, bottom: 30 },
    didDrawPage: data => {
      if (data.pageNumber > 1) drawContinuationHeader();
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ========== OBSERVAÇÕES ==========
  const obsTexto = (dados.observacoes || '').trim();
  const obsLinhas = obsTexto ? doc.splitTextToSize(obsTexto, contentWidth - 6) : [];
  const obsBoxH = Math.max(14, obsLinhas.length * 4 + 8);

  y = ensureSpace(obsBoxH + 44, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Observações', MARGIN, y);
  y += 3;

  doc.setDrawColor(...GRAY_LINE);
  doc.rect(MARGIN, y, contentWidth, obsBoxH);

  if (obsLinhas.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(obsLinhas, MARGIN + 3, y + 5.5);
  }
  y += obsBoxH + 16;

  // ========== ASSINATURA DE RECEBIMENTO ==========
  y = ensureSpace(24, y);
  const assinaturaW = (contentWidth - 10) / 2;
  doc.setDrawColor(...GRAY_LINE);
  doc.line(MARGIN, y, MARGIN + assinaturaW, y);
  doc.line(MARGIN + assinaturaW + 10, y, MARGIN + assinaturaW + 10 + assinaturaW, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('Assinatura de quem recebeu', MARGIN, y + 4);
  doc.text('Nome legível / documento', MARGIN + assinaturaW + 10, y + 4);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc.output('blob');
}

interface TransferenciaItem {
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number;
}

interface DadosTransferencia {
  numero: string;
  data: string;
  status: string;
  origem: string;
  destino: string;
  transportadora?: string | null;
  observacoes?: string | null;
  itens: TransferenciaItem[];
}

/**
 * Gera o documento que acompanha fisicamente a mercadoria até a transportadora.
 * NAO e uma nota fiscal eletronica - e um romaneio interno de conferencia, por
 * isso o aviso "sem valor fiscal" fica destacado no cabecalho.
 */
export async function gerarPDFTransferencia(
  dados: DadosTransferencia,
  config: ConfiguracaoEmpresa
): Promise<Blob> {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  let logo: LogoInfo | null = null;
  if (config.logo_url) {
    logo = await carregarLogo(config.logo_url);
  }

  // ========== CABEÇALHO (logo + dados da empresa) ==========
  let logoBottom = MARGIN;
  if (logo) {
    const boxW = 42;
    const boxH = 22;
    let imgW = boxW;
    let imgH = imgW / logo.aspect;
    if (imgH > boxH) {
      imgH = boxH;
      imgW = imgH * logo.aspect;
    }
    try {
      doc.addImage(logo.dataURL, 'PNG', MARGIN, 12, imgW, imgH);
      logoBottom = 12 + imgH;
    } catch (error) {
      console.error('Erro ao desenhar logo:', error);
    }
  }

  let companyY = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(config.nome_empresa || 'Empresa', pageWidth - MARGIN, companyY, { align: 'right' });
  companyY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  if (config.telefone) {
    doc.text(`Tel: ${config.telefone}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }
  if (config.endereco) {
    const linhas = doc.splitTextToSize(config.endereco, 95);
    linhas.forEach((linha: string) => {
      doc.text(linha, pageWidth - MARGIN, companyY, { align: 'right' });
      companyY += 4;
    });
  }
  if (config.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }

  let y = Math.max(logoBottom, companyY) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(`Transferência de Estoque ${dados.numero}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('Documento para acompanhamento de transporte — sem valor fiscal', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // ========== ORIGEM / DESTINO ==========
  const halfW = (contentWidth - 4) / 2;
  const locBoxH = 16;

  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, halfW, locBoxH);
  doc.rect(MARGIN + halfW + 4, y, halfW, locBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('ORIGEM', MARGIN + 3, y + 4.5);
  doc.text('DESTINO', MARGIN + halfW + 4 + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.origem, MARGIN + 3, y + 11.5);
  doc.text(dados.destino, MARGIN + halfW + 4 + 3, y + 11.5);

  y += locBoxH + 6;

  // ========== NÚMERO / DATA / STATUS / TRANSPORTADORA ==========
  const metaBoxH = 16;
  const quarterW = (contentWidth - 12) / 4;
  const metaCols: [string, string][] = [
    ['NÚMERO', dados.numero],
    ['DATA', dados.data],
    ['STATUS', dados.status],
    ['TRANSPORTADORA', dados.transportadora || 'A definir'],
  ];

  metaCols.forEach((col, i) => {
    const bx = MARGIN + i * (quarterW + 4);
    doc.setDrawColor(...GRAY_LINE);
    doc.rect(bx, y, quarterW, metaBoxH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(col[0], bx + 2, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const linhas = doc.splitTextToSize(col[1], quarterW - 4);
    doc.text(linhas.slice(0, 2), bx + 2, y + 10);
  });

  y += metaBoxH + 8;

  // ========== ITENS ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Itens Transferidos', MARGIN, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Descrição', 'Un.', 'Quantidade']],
    body: dados.itens.map(item => [item.codigo, item.nome, item.unidade, item.quantidade.toString()]),
    theme: 'grid',
    headStyles: {
      fillColor: GRAY_HEAD,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [0, 0, 0],
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 30 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 30 },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 22 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ========== OBSERVAÇÕES ==========
  const obsTexto = (dados.observacoes || '').trim();
  if (obsTexto) {
    const obsLinhas = doc.splitTextToSize(obsTexto, contentWidth - 6);
    const obsBoxH = Math.max(14, obsLinhas.length * 4 + 6);

    if (y + obsBoxH > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Observações', MARGIN, y);
    y += 3;

    doc.setDrawColor(...GRAY_LINE);
    doc.rect(MARGIN, y, contentWidth, obsBoxH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(obsLinhas, MARGIN + 3, y + 5.5);

    y += obsBoxH + 10;
  }

  // ========== ASSINATURAS ==========
  if (y + 30 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  } else {
    y += 6;
  }

  const sigW = (contentWidth - 10) / 2;
  const sigY = y + 16;

  doc.setDrawColor(...GRAY_LINE);
  doc.line(MARGIN, sigY, MARGIN + sigW, sigY);
  doc.line(MARGIN + sigW + 10, sigY, MARGIN + sigW + 10 + sigW, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('Retirado por (nome / assinatura)', MARGIN, sigY + 5);
  doc.text('Recebido por (nome / assinatura)', MARGIN + sigW + 10, sigY + 5);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7.5);
  doc.text(`Data: ____/____/______`, MARGIN, sigY + 11);
  doc.text(`Data: ____/____/______`, MARGIN + sigW + 10, sigY + 11);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text('Documento sem valor fiscal', MARGIN, pageHeight - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
}

interface DadosOrdemProducao {
  numero: string;
  status: string;
  dataSaida: string;
  dataRetorno?: string | null;
  fornecedor?: string | null;
  corDestino?: string | null;
  itens: {
    codigo: string;
    nome: string;
    cor?: string | null;
    unidade: string;
    destino?: { nome: string; cor?: string | null } | null;
    quantidade: number;
    pesoUnitarioKg: number;
    pesoTotalKg: number;
  }[];
  pesoTotalKg: number;
  valorMaterial: number;
  custoPintura: number;
  observacoes?: string | null;
}

/**
 * Ordem de producao (envio para pintura): acompanha o material ate o
 * fornecedor. Sem valor fiscal, mesmo layout do documento de transferencia.
 */
export async function gerarPDFOrdemProducao(
  dados: DadosOrdemProducao,
  config: ConfiguracaoEmpresa
): Promise<Blob> {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const kg = (v: number) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;

  let logo: LogoInfo | null = null;
  if (config.logo_url) {
    logo = await carregarLogo(config.logo_url);
  }

  // ========== CABEÇALHO (logo + dados da empresa) ==========
  let logoBottom = MARGIN;
  if (logo) {
    const boxW = 42;
    const boxH = 22;
    let imgW = boxW;
    let imgH = imgW / logo.aspect;
    if (imgH > boxH) {
      imgH = boxH;
      imgW = imgH * logo.aspect;
    }
    try {
      doc.addImage(logo.dataURL, 'PNG', MARGIN, 12, imgW, imgH);
      logoBottom = 12 + imgH;
    } catch (error) {
      console.error('Erro ao desenhar logo:', error);
    }
  }

  let companyY = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(config.nome_empresa || 'Empresa', pageWidth - MARGIN, companyY, { align: 'right' });
  companyY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  if (config.telefone) {
    doc.text(`Tel: ${config.telefone}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }
  if (config.endereco) {
    const linhas = doc.splitTextToSize(config.endereco, 95);
    linhas.forEach((linha: string) => {
      doc.text(linha, pageWidth - MARGIN, companyY, { align: 'right' });
      companyY += 4;
    });
  }
  if (config.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }

  let y = Math.max(logoBottom, companyY) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(`Ordem de Produção ${dados.numero}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('Envio de material para pintura — sem valor fiscal', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // ========== FORNECEDOR ==========
  const fornecedorBoxH = 16;
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, contentWidth, fornecedorBoxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('FORNECEDOR (PINTURA)', MARGIN + 3, y + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.fornecedor || 'Não informado', MARGIN + 3, y + 11.5);
  y += fornecedorBoxH + 6;

  // ========== NÚMERO / SAÍDA / RETORNO / STATUS ==========
  const metaBoxH = 16;
  const quarterW = (contentWidth - 12) / 4;
  const metaCols: [string, string][] = [
    ['NÚMERO', dados.numero],
    ['SAÍDA', dados.dataSaida],
    ['RETORNO', dados.dataRetorno || '-'],
    ['STATUS', dados.status],
  ];
  metaCols.forEach((col, i) => {
    const bx = MARGIN + i * (quarterW + 4);
    doc.setDrawColor(...GRAY_LINE);
    doc.rect(bx, y, quarterW, metaBoxH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(col[0], bx + 2, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(doc.splitTextToSize(col[1], quarterW - 4).slice(0, 2), bx + 2, y + 10);
  });
  y += metaBoxH + 8;

  // ========== MATERIAL ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(dados.corDestino ? `Material - pintar na cor ${dados.corDestino}` : 'Material', MARGIN, y);
  y += 3;

  const nomeCor = (p: { nome: string; cor?: string | null }) => p.cor ? `${p.nome} (${p.cor})` : p.nome;
  const qtdTotal = dados.itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
  autoTable(doc, {
    startY: y,
    head: [['Código', 'Produto enviado', 'Pintar para', 'Qtd', 'Peso un.', 'Peso total']],
    body: dados.itens.map((i) => [
      i.codigo,
      nomeCor(i),
      i.destino ? nomeCor(i.destino) : 'Mesma cor',
      `${i.quantidade} ${i.unidade}`,
      kg(i.pesoUnitarioKg),
      kg(i.pesoTotalKg),
    ]),
    foot: dados.itens.length > 1
      ? [['', `${dados.itens.length} itens`, '', String(qtdTotal), '', kg(dados.pesoTotalKg)]]
      : undefined,
    footStyles: { fillColor: GRAY_HEAD, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, lineColor: GRAY_LINE, lineWidth: 0.2 },
    theme: 'grid',
    headStyles: { fillColor: GRAY_HEAD, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'left', lineColor: GRAY_LINE, lineWidth: 0.2 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: GRAY_LINE, lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 26 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 22 },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 22 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ========== VALORES ==========
  const precoKg = dados.pesoTotalKg > 0 ? dados.custoPintura / dados.pesoTotalKg : 0;
  const linhasValores: [string, string][] = [
    ['Material', brl(dados.valorMaterial)],
    [dados.pesoTotalKg > 0 ? `Pintura (${kg(dados.pesoTotalKg)} × ${brl(precoKg)}/kg)` : 'Pintura', brl(dados.custoPintura)],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  linhasValores.forEach(([rotulo, valor]) => {
    doc.text(rotulo, pageWidth - MARGIN - 70, y + 3);
    doc.text(valor, pageWidth - MARGIN, y + 3, { align: 'right' });
    y += 5;
  });
  doc.setDrawColor(...GRAY_LINE);
  doc.line(pageWidth - MARGIN - 70, y, pageWidth - MARGIN, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Valor da OP', pageWidth - MARGIN - 70, y + 6);
  doc.text(brl(dados.valorMaterial + dados.custoPintura), pageWidth - MARGIN, y + 6, { align: 'right' });
  y += 14;

  // ========== OBSERVAÇÕES ==========
  const obsTexto = (dados.observacoes || '').trim();
  if (obsTexto) {
    const obsLinhas = doc.splitTextToSize(obsTexto, contentWidth - 6);
    const obsBoxH = Math.max(14, obsLinhas.length * 4 + 6);
    if (y + obsBoxH > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Observações', MARGIN, y);
    y += 3;
    doc.setDrawColor(...GRAY_LINE);
    doc.rect(MARGIN, y, contentWidth, obsBoxH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(obsLinhas, MARGIN + 3, y + 5.5);
    y += obsBoxH + 10;
  }

  // ========== ASSINATURAS ==========
  if (y + 30 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  } else {
    y += 6;
  }
  const sigW = (contentWidth - 10) / 2;
  const sigY = y + 16;
  doc.setDrawColor(...GRAY_LINE);
  doc.line(MARGIN, sigY, MARGIN + sigW, sigY);
  doc.line(MARGIN + sigW + 10, sigY, MARGIN + sigW + 10 + sigW, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('Entregue por (nome / assinatura)', MARGIN, sigY + 5);
  doc.text('Recebido pelo fornecedor (nome / assinatura)', MARGIN + sigW + 10, sigY + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7.5);
  doc.text(`Data: ____/____/______`, MARGIN, sigY + 11);
  doc.text(`Data: ____/____/______`, MARGIN + sigW + 10, sigY + 11);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text('Documento sem valor fiscal', MARGIN, pageHeight - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
}

interface RomaneioOrcamentoItem {
  codigo: string;
  nome: string;
  localizacao: string;
  unidade: string;
  quantidade: number;
  // Componentes de um kit (ja multiplicados pela quantidade de kits), listados
  // abaixo da linha do kit para a separacao.
  componentes?: { codigo: string; nome: string; localizacao: string; unidade: string; quantidade: number }[];
}

interface DadosRomaneioOrcamento {
  numero: string;
  data: string;
  status: string;
  loja: string;
  cliente: {
    nome: string;
    cpf_cnpj?: string | null;
    telefone?: string | null;
    endereco?: string | null;
  };
  vendedor?: string | null;
  observacoes?: string | null;
  itens: RomaneioOrcamentoItem[];
}

/**
 * Romaneio de separacao/entrega do orcamento: o que sai do estoque para o
 * cliente, sem valores, com os componentes dos kits abertos e a localizacao
 * de cada produto. Mesmo layout do documento de transferencia.
 */
export async function gerarPDFRomaneioOrcamento(
  dados: DadosRomaneioOrcamento,
  config: ConfiguracaoEmpresa
): Promise<Blob> {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  let logo: LogoInfo | null = null;
  if (config.logo_url) {
    logo = await carregarLogo(config.logo_url);
  }

  // ========== CABEÇALHO (logo + dados da empresa) ==========
  let logoBottom = MARGIN;
  if (logo) {
    const boxW = 42;
    const boxH = 22;
    let imgW = boxW;
    let imgH = imgW / logo.aspect;
    if (imgH > boxH) {
      imgH = boxH;
      imgW = imgH * logo.aspect;
    }
    try {
      doc.addImage(logo.dataURL, 'PNG', MARGIN, 12, imgW, imgH);
      logoBottom = 12 + imgH;
    } catch (error) {
      console.error('Erro ao desenhar logo:', error);
    }
  }

  let companyY = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(config.nome_empresa || 'Empresa', pageWidth - MARGIN, companyY, { align: 'right' });
  companyY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  if (config.telefone) {
    doc.text(`Tel: ${config.telefone}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }
  if (config.endereco) {
    const linhas = doc.splitTextToSize(config.endereco, 95);
    linhas.forEach((linha: string) => {
      doc.text(linha, pageWidth - MARGIN, companyY, { align: 'right' });
      companyY += 4;
    });
  }
  if (config.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }

  let y = Math.max(logoBottom, companyY) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(`Romaneio ${dados.numero}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('Documento para separação e entrega da mercadoria — sem valor fiscal', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // ========== CLIENTE ==========
  const enderecoLinhas = dados.cliente.endereco
    ? doc.splitTextToSize(`Entrega: ${dados.cliente.endereco}`, contentWidth - 6)
    : [];
  const clienteBoxH = 16 + enderecoLinhas.length * 4;
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, contentWidth, clienteBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('CLIENTE', MARGIN + 3, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.cliente.nome, MARGIN + 3, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const clienteLinha2 = [
    dados.cliente.cpf_cnpj ? `CPF/CNPJ: ${dados.cliente.cpf_cnpj}` : null,
    dados.cliente.telefone ? `Fone: ${dados.cliente.telefone}` : null,
  ].filter(Boolean).join('   ');
  if (clienteLinha2) doc.text(clienteLinha2, MARGIN + 3, y + 14);
  if (enderecoLinhas.length) doc.text(enderecoLinhas, MARGIN + 3, y + 18);

  y += clienteBoxH + 6;

  // ========== NÚMERO / DATA / UNIDADE / VENDEDOR ==========
  const metaBoxH = 16;
  const quarterW = (contentWidth - 12) / 4;
  const metaCols: [string, string][] = [
    ['ORÇAMENTO', dados.numero],
    ['DATA', dados.data],
    ['SAÍDA DE', dados.loja],
    ['VENDEDOR', dados.vendedor || '-'],
  ];

  metaCols.forEach((col, i) => {
    const bx = MARGIN + i * (quarterW + 4);
    doc.setDrawColor(...GRAY_LINE);
    doc.rect(bx, y, quarterW, metaBoxH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(col[0], bx + 2, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const linhas = doc.splitTextToSize(col[1], quarterW - 4);
    doc.text(linhas.slice(0, 2), bx + 2, y + 10);
  });

  y += metaBoxH + 8;

  // ========== ITENS ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Itens', MARGIN, y);
  y += 3;

  const linhasKit = new Set<number>();
  const body: string[][] = [];
  dados.itens.forEach(item => {
    if (item.componentes && item.componentes.length) linhasKit.add(body.length);
    body.push([item.codigo, item.nome, item.componentes?.length ? '' : item.localizacao, item.unidade, item.quantidade.toString(), '']);
    (item.componentes || []).forEach(c => {
      body.push([c.codigo, `   - ${c.nome}`, c.localizacao, c.unidade, c.quantidade.toString(), '']);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Descrição', 'Local', 'Un.', 'Qtd', 'Conf.']],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: GRAY_HEAD,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [0, 0, 0],
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      2: { cellWidth: 24 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 14 },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && linhasKit.has(data.row.index)) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [247, 247, 247];
      }
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 22 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ========== OBSERVAÇÕES ==========
  const obsTexto = (dados.observacoes || '').trim();
  if (obsTexto) {
    const obsLinhas = doc.splitTextToSize(obsTexto, contentWidth - 6);
    const obsBoxH = Math.max(14, obsLinhas.length * 4 + 6);

    if (y + obsBoxH > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Observações', MARGIN, y);
    y += 3;

    doc.setDrawColor(...GRAY_LINE);
    doc.rect(MARGIN, y, contentWidth, obsBoxH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(obsLinhas, MARGIN + 3, y + 5.5);

    y += obsBoxH + 10;
  }

  // ========== ASSINATURAS ==========
  if (y + 30 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  } else {
    y += 6;
  }

  const sigW = (contentWidth - 10) / 2;
  const sigY = y + 16;

  doc.setDrawColor(...GRAY_LINE);
  doc.line(MARGIN, sigY, MARGIN + sigW, sigY);
  doc.line(MARGIN + sigW + 10, sigY, MARGIN + sigW + 10 + sigW, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('Separado / conferido por (nome / assinatura)', MARGIN, sigY + 5);
  doc.text('Recebido pelo cliente (nome / assinatura)', MARGIN + sigW + 10, sigY + 5);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7.5);
  doc.text(`Data: ____/____/______`, MARGIN, sigY + 11);
  doc.text(`Data: ____/____/______`, MARGIN + sigW + 10, sigY + 11);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text('Documento sem valor fiscal', MARGIN, pageHeight - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
}

interface ItemDanfe {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

interface DadosDanfe {
  numero: number;
  serie: number;
  chaveAcesso: string;
  protocoloAutorizacao: string | null;
  dataAutorizacao: string | null;
  dataEmissao: string;
  ambiente: 'homologacao' | 'producao';
  status: string;
  emitente: ConfiguracaoEmpresa & { inscricaoEstadual?: string | null };
  destinatario: {
    nome: string;
    cpfCnpj: string;
    inscricaoEstadual?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  itens: ItemDanfe[];
  valorTotalProdutos: number;
  valorTotalNota: number;
  informacoesAdicionais?: string | null;
}

function formatarChaveEmGrupos(chave: string): string {
  return chave.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatarEnderecoDestinatario(d: DadosDanfe['destinatario']): string {
  const partes: string[] = [];
  if (d.endereco) partes.push(d.endereco);
  if (d.bairro) partes.push(d.bairro);
  if (d.cidade && d.estado) partes.push(`${d.cidade} - ${d.estado}`);
  else if (d.cidade) partes.push(d.cidade);
  if (d.cep) partes.push(`CEP: ${d.cep}`);
  return partes.join(', ');
}

function gerarBarcodeDataUrl(valor: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, valor, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 60,
      width: 1.6,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Erro ao gerar código de barras:', error);
    return null;
  }
}

/**
 * Gera uma versao simplificada do DANFE (Documento Auxiliar da NF-e) - tem
 * todo o conteudo textual exigido (chave de acesso, protocolo, emitente,
 * destinatario completo, dados adicionais, itens, totais), o codigo de
 * barras Code-128 tradicional do modelo 55 e um QR Code com a chave de
 * acesso em texto puro (nao a URL assinada digitalmente do layout oficial
 * "DANFE Simplificado Tipo 2"/NT 2026.003, cujo formato exato de URL nao foi
 * possivel confirmar em fontes confiaveis). Serve pra imprimir/conferir a
 * nota, mas nao substitui o DANFE oficial completo pra fiscalizacao de
 * transito de mercadoria.
 */
export async function gerarPDFDanfe(dados: DadosDanfe): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  let logo: LogoInfo | null = null;
  if (dados.emitente.logo_url) {
    logo = await carregarLogo(dados.emitente.logo_url);
  }

  let y = MARGIN;

  // ========== CABEÇALHO ==========
  const headerH = 28;
  const colEmitW = contentWidth * 0.45;
  const colTipoW = 18;
  const colNumW = contentWidth - colEmitW - colTipoW - 8;

  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, colEmitW, headerH);
  doc.rect(MARGIN + colEmitW + 4, y, colTipoW, headerH);
  doc.rect(MARGIN + colEmitW + colTipoW + 8, y, colNumW, headerH);

  let emitTextX = MARGIN + 3;
  if (logo) {
    const logoBoxW = 20;
    const logoBoxH = headerH - 4;
    let imgW = logoBoxW;
    let imgH = imgW / logo.aspect;
    if (imgH > logoBoxH) {
      imgH = logoBoxH;
      imgW = imgH * logo.aspect;
    }
    try {
      doc.addImage(logo.dataURL, 'PNG', MARGIN + 2, y + 2, imgW, imgH);
      emitTextX = MARGIN + 2 + logoBoxW + 3;
    } catch (error) {
      console.error('Erro ao desenhar logo no DANFE:', error);
    }
  }
  const emitTextW = colEmitW - (emitTextX - MARGIN) - 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.emitente.nome_empresa || 'Empresa', emitTextX, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  let ey = y + 10;
  if (dados.emitente.endereco) {
    const linhas = doc.splitTextToSize(dados.emitente.endereco, emitTextW);
    linhas.slice(0, 2).forEach((linha: string) => { doc.text(linha, emitTextX, ey); ey += 3.6; });
  }
  if (dados.emitente.cnpj) { doc.text(`CNPJ: ${dados.emitente.cnpj}`, emitTextX, ey); ey += 3.6; }
  if (dados.emitente.inscricaoEstadual) { doc.text(`IE: ${dados.emitente.inscricaoEstadual}`, emitTextX, ey); }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DANFE', MARGIN + colEmitW + 4 + colTipoW / 2, y + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('Documento Auxiliar da', MARGIN + colEmitW + 4 + colTipoW / 2, y + 12, { align: 'center' });
  doc.text('NF-e', MARGIN + colEmitW + 4 + colTipoW / 2, y + 15, { align: 'center' });
  doc.setFontSize(7);
  doc.text('0-Entrada', MARGIN + colEmitW + 4 + colTipoW / 2, y + 20, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('1-Saída', MARGIN + colEmitW + 4 + colTipoW / 2, y + 24, { align: 'center' });

  const numX = MARGIN + colEmitW + colTipoW + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Nº ${dados.numero}`, numX + colNumW / 2, y + 8, { align: 'center' });
  doc.text(`Série ${dados.serie}`, numX + colNumW / 2, y + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.text(dados.ambiente === 'producao' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO', numX + colNumW / 2, y + 20, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY_LABEL);
  doc.text(dados.dataEmissao, numX + colNumW / 2, y + 25, { align: 'center' });

  y += headerH + 4;

  // ========== CHAVE DE ACESSO + CÓDIGO DE BARRAS + QR CODE ==========
  // QR e codigo de barras contem a chave de 44 digitos em texto puro (nao a
  // URL assinada do layout oficial NT 2026.003, ainda nao confirmavel com
  // fontes confiaveis)
  const qrSize = 26;
  const chaveH = qrSize + 6;
  const chaveTextW = contentWidth - qrSize - 6;

  doc.setDrawColor(...GRAY_LINE);
  doc.rect(MARGIN, y, contentWidth, chaveH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('CHAVE DE ACESSO', MARGIN + 3, y + 4);

  const barcodeDataUrl = gerarBarcodeDataUrl(dados.chaveAcesso);
  if (barcodeDataUrl) {
    const barcodeW = chaveTextW - 10;
    const barcodeH = 9;
    try {
      doc.addImage(barcodeDataUrl, 'PNG', MARGIN + 5, y + 5, barcodeW, barcodeH);
    } catch (error) {
      console.error('Erro ao desenhar código de barras:', error);
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(formatarChaveEmGrupos(dados.chaveAcesso), MARGIN + chaveTextW / 2, y + 18, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY_LABEL);
  const consultaLinhas = doc.splitTextToSize(
    'Consulte a autenticidade no Portal Nacional da NF-e (www.nfe.fazenda.gov.br/portal) ou pelo QR Code.',
    chaveTextW - 6
  );
  doc.text(consultaLinhas, MARGIN + chaveTextW / 2, y + 22.5, { align: 'center' });

  try {
    const qrDataUrl = await QRCode.toDataURL(dados.chaveAcesso, { margin: 1, width: 240 });
    doc.addImage(qrDataUrl, 'PNG', MARGIN + contentWidth - qrSize - 2, y + (chaveH - qrSize) / 2, qrSize, qrSize);
  } catch (error) {
    console.error('Erro ao gerar QR Code da chave de acesso:', error);
  }

  y += chaveH + 3;

  if (dados.ambiente !== 'producao') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 30, 30);
    doc.text('SEM VALOR FISCAL — AMBIENTE DE HOMOLOGAÇÃO', pageWidth / 2, y + 3, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 7;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const statusLabel = dados.status === 'autorizada' ? `Protocolo de Autorização: ${dados.protocoloAutorizacao || '-'}   Data: ${dados.dataAutorizacao || '-'}` : `Status: ${dados.status}`;
  doc.text(statusLabel, MARGIN, y + 3);
  y += 8;

  // ========== DESTINATÁRIO / REMETENTE ==========
  const enderecoDest = formatarEnderecoDestinatario(dados.destinatario);
  const contatoDest = [
    dados.destinatario.telefone ? `Fone: ${dados.destinatario.telefone}` : null,
    dados.destinatario.email,
  ].filter(Boolean).join('   ');
  const destH = 26;

  doc.setDrawColor(...GRAY_LINE);
  doc.rect(MARGIN, y, contentWidth, destH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('DESTINATÁRIO / REMETENTE', MARGIN + 3, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.destinatario.nome, MARGIN + 3, y + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  let dy = y + 13.5;
  const docLine = [
    `CPF/CNPJ: ${dados.destinatario.cpfCnpj}`,
    dados.destinatario.inscricaoEstadual ? `IE: ${dados.destinatario.inscricaoEstadual}` : null,
  ].filter(Boolean).join('   ');
  doc.text(docLine, MARGIN + 3, dy);
  dy += 4;
  if (enderecoDest) {
    const linhasEnd = doc.splitTextToSize(enderecoDest, contentWidth - 6);
    linhasEnd.slice(0, 2).forEach((linha: string) => { doc.text(linha, MARGIN + 3, dy); dy += 4; });
  }
  if (contatoDest) {
    doc.text(contatoDest, MARGIN + 3, dy);
  }

  y += destH + 6;

  // ========== ITENS ==========
  autoTable(doc, {
    startY: y,
    head: [['Código', 'Descrição', 'NCM', 'CFOP', 'Un.', 'Qtd', 'V. Unit.', 'V. Total']],
    body: dados.itens.map(item => [
      item.codigo,
      item.descricao,
      item.ncm,
      item.cfop,
      item.unidade,
      item.quantidade.toString(),
      `R$ ${item.valorUnitario.toFixed(2)}`,
      `R$ ${item.valorTotal.toFixed(2)}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: GRAY_HEAD, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, lineColor: GRAY_LINE, lineWidth: 0.2 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0], lineColor: GRAY_LINE, lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 22 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (y + 16 > pageHeight - 20) {
    doc.addPage();
    y = MARGIN;
  }

  // ========== TOTAIS ==========
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Valor Total dos Produtos: R$ ${dados.valorTotalProdutos.toFixed(2)}`, pageWidth - MARGIN, y, { align: 'right' });
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Valor Total da NF-e: R$ ${dados.valorTotalNota.toFixed(2)}`, pageWidth - MARGIN, y, { align: 'right' });
  y += 8;

  // ========== DADOS ADICIONAIS ==========
  const infoAdic = (dados.informacoesAdicionais || '').trim();
  if (infoAdic) {
    const infoLinhas = doc.splitTextToSize(infoAdic, contentWidth - 6);
    const infoBoxH = Math.max(14, infoLinhas.length * 4 + 8);

    if (y + infoBoxH > pageHeight - 20) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_LABEL);
    doc.text('DADOS ADICIONAIS', MARGIN + 3, y + 4);

    doc.setDrawColor(...GRAY_LINE);
    doc.rect(MARGIN, y, contentWidth, infoBoxH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(infoLinhas, MARGIN + 3, y + 9);

    y += infoBoxH + 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('QR Code contém apenas a chave de acesso (texto puro), para conferência e arquivo interno.', MARGIN, pageHeight - 8);

  return doc.output('blob');
}

interface CompraItem {
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface DadosCompra {
  numero: string;
  dataEmissao: string;
  dataEntregaPrevista?: string | null;
  status: string;
  fornecedor: {
    nome: string;
    cnpj?: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  condicaoPagamento?: string | null;
  numeroParcelas?: number | null;
  formaPagamento?: string | null;
  observacoes?: string | null;
  itens: CompraItem[];
  valorTotal: number;
  // Quando informado, gera o romaneio de recebimento (conferencia da
  // mercadoria que chegou) em vez do pedido de compra: sem valores, com
  // coluna "Conferido" e campos de assinatura.
  romaneio?: { dataRecebimento: string } | null;
}

/**
 * Gera o pedido de compra para enviar/conferir com o fornecedor. Nao e' nota
 * fiscal - por isso o aviso "sem valor fiscal" no rodape, igual ao documento
 * de transferencia. Com `dados.romaneio`, gera o romaneio de recebimento.
 */
export async function gerarPDFCompra(dados: DadosCompra, config: ConfiguracaoEmpresa): Promise<Blob> {
  const romaneio = dados.romaneio || null;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  let logo: LogoInfo | null = null;
  if (config.logo_url) {
    logo = await carregarLogo(config.logo_url);
  }

  // ========== CABEÇALHO (logo + dados da empresa) ==========
  let logoBottom = MARGIN;
  if (logo) {
    const boxW = 42;
    const boxH = 22;
    let imgW = boxW;
    let imgH = imgW / logo.aspect;
    if (imgH > boxH) {
      imgH = boxH;
      imgW = imgH * logo.aspect;
    }
    try {
      doc.addImage(logo.dataURL, 'PNG', MARGIN, 12, imgW, imgH);
      logoBottom = 12 + imgH;
    } catch (error) {
      console.error('Erro ao desenhar logo:', error);
    }
  }

  let companyY = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(config.nome_empresa || 'Empresa', pageWidth - MARGIN, companyY, { align: 'right' });
  companyY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  if (config.telefone) {
    doc.text(`Tel: ${config.telefone}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }
  if (config.endereco) {
    const linhas = doc.splitTextToSize(config.endereco, 95);
    linhas.forEach((linha: string) => {
      doc.text(linha, pageWidth - MARGIN, companyY, { align: 'right' });
      companyY += 4;
    });
  }
  if (config.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, pageWidth - MARGIN, companyY, { align: 'right' });
    companyY += 4;
  }

  let y = Math.max(logoBottom, companyY) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(
    romaneio ? `Romaneio de Recebimento ${dados.numero}` : `Pedido de Compra ${dados.numero}`,
    pageWidth / 2, y, { align: 'center' }
  );
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_LABEL);
  doc.text(
    romaneio
      ? 'Documento para conferência do recebimento da mercadoria — sem valor fiscal'
      : 'Documento para conferência com o fornecedor — sem valor fiscal',
    pageWidth / 2, y, { align: 'center' }
  );
  y += 8;

  // ========== FORNECEDOR ==========
  const fornecedorBoxH = 22;
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, contentWidth, fornecedorBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LABEL);
  doc.text('FORNECEDOR', MARGIN + 3, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(dados.fornecedor.nome, MARGIN + 3, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const fornecedorLinha2 = [
    dados.fornecedor.cnpj ? `CNPJ: ${dados.fornecedor.cnpj}` : null,
    dados.fornecedor.telefone ? `Fone: ${dados.fornecedor.telefone}` : null,
    dados.fornecedor.email,
  ].filter(Boolean).join('   ');
  if (fornecedorLinha2) doc.text(fornecedorLinha2, MARGIN + 3, y + 16);

  y += fornecedorBoxH + 6;

  // ========== NÚMERO / EMISSÃO / ENTREGA / STATUS ==========
  const metaBoxH = 16;
  const quarterW = (contentWidth - 12) / 4;
  const metaCols: [string, string][] = [
    ['NÚMERO', dados.numero],
    ['EMISSÃO', dados.dataEmissao],
    romaneio
      ? ['RECEBIMENTO', romaneio.dataRecebimento]
      : ['ENTREGA PREVISTA', dados.dataEntregaPrevista || 'A definir'],
    ['STATUS', dados.status],
  ];

  metaCols.forEach((col, i) => {
    const bx = MARGIN + i * (quarterW + 4);
    doc.setDrawColor(...GRAY_LINE);
    doc.rect(bx, y, quarterW, metaBoxH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text(col[0], bx + 2, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const linhas = doc.splitTextToSize(col[1], quarterW - 4);
    doc.text(linhas.slice(0, 2), bx + 2, y + 10);
  });

  y += metaBoxH + 8;

  // ========== ITENS ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(romaneio ? 'Itens Recebidos' : 'Itens da Compra', MARGIN, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: romaneio
      ? [['Código', 'Produto', 'Un.', 'Qtd', 'Qtd Conferida', 'OK']]
      : [['Código', 'Produto', 'Un.', 'Qtd', 'Valor Unit.', 'Valor Total']],
    body: dados.itens.map(item => romaneio
      ? [item.codigo, item.nome, item.unidade, item.quantidade.toString(), '', '']
      : [
        item.codigo,
        item.nome,
        item.unidade,
        item.quantidade.toString(),
        `R$ ${item.valor_unitario.toFixed(2)}`,
        `R$ ${item.valor_total.toFixed(2)}`,
      ]),
    theme: 'grid',
    headStyles: {
      fillColor: GRAY_HEAD,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [0, 0, 0],
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
    },
    columnStyles: romaneio
      ? {
        0: { cellWidth: 26 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 14 },
      }
      : {
        0: { cellWidth: 26 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 28 },
      },
    margin: { left: MARGIN, right: MARGIN, bottom: 22 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (romaneio) {
    const totalVolumes = dados.itens.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${dados.itens.length} item(ns) — ${totalVolumes.toLocaleString('pt-BR')} unidade(s)`,
      pageWidth - MARGIN, y + 3, { align: 'right' }
    );
    y += 10;
  }

  // ========== TOTAL / CONDIÇÃO DE PAGAMENTO ==========
  if (!romaneio) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    const pagamentoLinha = [
      dados.condicaoPagamento ? `Condição: ${dados.condicaoPagamento}` : null,
      dados.numeroParcelas && dados.numeroParcelas > 1 ? `${dados.numeroParcelas}x de R$ ${(dados.valorTotal / dados.numeroParcelas).toFixed(2)}` : null,
      dados.formaPagamento ? `Forma: ${dados.formaPagamento}` : null,
    ].filter(Boolean).join('   —   ');
    if (pagamentoLinha) {
      doc.text(pagamentoLinha, MARGIN, y + 3);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total: R$ ${dados.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - MARGIN, y + 3, { align: 'right' });
    y += 10;
  }

  // ========== OBSERVAÇÕES ==========
  const obsTexto = (dados.observacoes || '').trim();
  if (obsTexto) {
    const obsLinhas = doc.splitTextToSize(obsTexto, contentWidth - 6);
    const obsBoxH = Math.max(14, obsLinhas.length * 4 + 6);

    if (y + obsBoxH > pageHeight - 22) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Observações', MARGIN, y);
    y += 3;

    doc.setDrawColor(...GRAY_LINE);
    doc.rect(MARGIN, y, contentWidth, obsBoxH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(obsLinhas, MARGIN + 3, y + 5.5);

    y += obsBoxH + 10;
  }

  // ========== ASSINATURAS (romaneio) ==========
  if (romaneio) {
    if (y + 30 > pageHeight - 20) {
      doc.addPage();
      y = 20;
    } else {
      y += 6;
    }

    const sigW = (contentWidth - 10) / 2;
    const sigY = y + 16;

    doc.setDrawColor(...GRAY_LINE);
    doc.line(MARGIN, sigY, MARGIN + sigW, sigY);
    doc.line(MARGIN + sigW + 10, sigY, MARGIN + sigW + 10 + sigW, sigY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_LABEL);
    doc.text('Entregue por (fornecedor / transportadora)', MARGIN, sigY + 5);
    doc.text('Conferido por (nome / assinatura)', MARGIN + sigW + 10, sigY + 5);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7.5);
    doc.text(`Data: ____/____/______`, MARGIN, sigY + 11);
    doc.text(`Data: ____/____/______`, MARGIN + sigW + 10, sigY + 11);
  }

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_LABEL);
    doc.text('Documento sem valor fiscal', MARGIN, pageHeight - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
