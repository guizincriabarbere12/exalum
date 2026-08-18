import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
}

const THUMB_SIZE = 56;
const MARGIN = 15;
const GRAY_LINE: [number, number, number] = [130, 130, 130];
const GRAY_HEAD: [number, number, number] = [235, 235, 235];
const GRAY_LABEL: [number, number, number] = [95, 95, 95];

function redimensionarBase64(dataURL: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(THUMB_SIZE / img.width, THUMB_SIZE / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

async function carregarImagemDaURL(url: string): Promise<string> {
  if (url.startsWith('data:')) {
    return redimensionarBase64(url);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(THUMB_SIZE / img.width, THUMB_SIZE / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };

    img.onerror = reject;
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

  const diasParaVencimento: Record<string, number[]> = {
    '28': [28],
    '28/56': [28, 56],
    '0/28/56': [0, 28, 56],
    '15': [15],
    '15/30': [15, 30],
    '0/15/30': [0, 15, 30],
  };

  const diasVencimentos: number[] =
    pagamento.condicao && diasParaVencimento[pagamento.condicao]
      ? diasParaVencimento[pagamento.condicao]
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

export async function gerarPDFOrcamento(
  dados: DadosOrcamento,
  config: ConfiguracaoEmpresa,
  mostrarKg: boolean = true
): Promise<Blob> {
  const doc = new jsPDF();

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
    doc.text(`Válido até ${dados.validade}`, MARGIN, pageHeight - 8);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  /** Cabeçalho compacto usado apenas nas páginas de continuação (2+). */
  const drawContinuationHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Orçamento ${dados.numero} (continuação)`, MARGIN, 15);
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
  doc.text(`Orçamento ${dados.numero}`, pageWidth / 2, y, { align: 'center' });
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
    ['Número do orçamento', dados.numero],
    ['Data', dados.data],
    ['Validade', dados.validade],
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
  doc.text('Itens do Orçamento', MARGIN, y);
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
    `Total do Orçamento: R$ ${dados.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
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

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
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
