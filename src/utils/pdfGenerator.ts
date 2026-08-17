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
  itens: OrcamentoItem[];
  valor_total: number;
  observacoes?: string;
  pagamento?: any;
}

const THUMB_SIZE = 56;

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

export async function gerarPDFOrcamento(
  dados: DadosOrcamento,
  config: ConfiguracaoEmpresa,
  mostrarKg: boolean = true
): Promise<Blob> {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const primaryColor: [number, number, number] = [41, 128, 185];
  const lightGray: [number, number, number] = [245, 245, 245];
  const redColor: [number, number, number] = [231, 76, 60];

  let logoDataURL: string | null = null;

  if (config.logo_url) {
    try {
      logoDataURL = await carregarImagemDaURL(config.logo_url);
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
  }

  await Promise.all(dados.itens.map(async (item) => {
    if (item.imagem_url) {
      try {
        item.imagemDataURL = await carregarImagemDaURL(item.imagem_url);
      } catch (error) {
        console.error(`Erro ao carregar imagem do item ${item.codigo}:`, error);
        item.imagemDataURL = null;
      }
    }
  }));

  const drawHeaderWithoutLogo = (isFirstPage: boolean = true) => {
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text((config.nome_empresa || 'EMPRESA').toUpperCase(), pageWidth / 2, 15, {
      align: 'center',
    });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    let headerY = 23;
    const infoEmpresa: string[] = [];

    if (config.cnpj) infoEmpresa.push(`CNPJ: ${config.cnpj}`);
    if (config.telefone) infoEmpresa.push(`Tel: ${config.telefone}`);
    if (config.email) infoEmpresa.push(`Email: ${config.email}`);

    doc.text(infoEmpresa.join(' | '), pageWidth / 2, headerY, {
      align: 'center',
    });

    headerY += 4;

    if (config.endereco) {
      doc.text(config.endereco, pageWidth / 2, headerY, {
        align: 'center',
      });
    }
  };

  const drawHeader = (isFirstPage: boolean = true) => {
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    if (logoDataURL) {
      try {
        const logoFormat = logoDataURL.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logoDataURL, logoFormat, 10, 5, 30, 30);

        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text((config.nome_empresa || 'EMPRESA').toUpperCase(), pageWidth / 2, 15, {
          align: 'center',
        });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        let headerY = 23;
        const infoEmpresa: string[] = [];

        if (config.cnpj) infoEmpresa.push(`CNPJ: ${config.cnpj}`);
        if (config.telefone) infoEmpresa.push(`Tel: ${config.telefone}`);
        if (config.email) infoEmpresa.push(`Email: ${config.email}`);

        doc.text(infoEmpresa.join(' | '), pageWidth / 2, headerY, {
          align: 'center',
        });

        headerY += 4;

        if (config.endereco) {
          doc.text(config.endereco, pageWidth / 2, headerY, {
            align: 'center',
          });
        }
      } catch (error) {
        console.error('Erro ao adicionar logo:', error);
        drawHeaderWithoutLogo(isFirstPage);
      }
    } else {
      drawHeaderWithoutLogo(isFirstPage);
    }

    if (isFirstPage) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Orçamento ${dados.numero}`, pageWidth / 2, 38, {
        align: 'center',
      });
    }

    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(...primaryColor);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);

    doc.text(
      `Válido até ${dados.validade} | Agradecemos sua preferência!`,
      pageWidth / 2,
      pageHeight - 11,
      { align: 'center' }
    );

    doc.setFontSize(7);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 25, pageHeight - 6);
  };

  drawHeader(true);

  let yPos = 50;

  doc.setFillColor(...lightGray);
  doc.roundedRect(15, yPos, (pageWidth - 30) / 2 - 5, 22, 2, 2, 'F');
  doc.roundedRect(pageWidth / 2 + 5, yPos, (pageWidth - 30) / 2 - 5, 22, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);

  doc.text('NÚMERO:', 20, yPos + 6);
  doc.text('DATA:', 20, yPos + 12);
  doc.text('VALIDADE:', 20, yPos + 18);
  doc.text('CLIENTE:', pageWidth / 2 + 10, yPos + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  doc.text(dados.numero, 42, yPos + 6);
  doc.text(dados.data, 42, yPos + 12);
  doc.text(dados.validade, 42, yPos + 18);
  doc.text(dados.cliente.nome, pageWidth / 2 + 10, yPos + 12);

  yPos += 30;

  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, yPos, pageWidth - 30, 25, 2, 2);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('DADOS DO CLIENTE', 20, yPos + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  let clienteY = yPos + 12;

  doc.text(`Nome: ${dados.cliente.nome}`, 20, clienteY);

  clienteY += 5;

  doc.text(`CPF/CNPJ: ${dados.cliente.cpf_cnpj}`, 20, clienteY);

  if (dados.cliente.telefone) {
    doc.text(`Tel: ${dados.cliente.telefone}`, pageWidth / 2 + 10, yPos + 12);
  }

  if (dados.cliente.email) {
    doc.text(`Email: ${dados.cliente.email}`, pageWidth / 2 + 10, yPos + 17);
  }

  yPos += 35;

  if (dados.vendedor && dados.vendedor.nome) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.text(`Vendedor: ${dados.vendedor.nome}`, 20, yPos);

    if (dados.vendedor.comissao_percentual) {
      doc.text(`Comissão: ${dados.vendedor.comissao_percentual}%`, pageWidth / 2 + 10, yPos);
    }

    yPos += 8;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('ITENS DO ORÇAMENTO', 20, yPos);

  yPos += 4;

  const temInfoKg = dados.itens.some(
    item => item.peso_total_kg || item.preco_por_kg || item.peso_kg_m
  );

  const deveMostrarKg = mostrarKg && temInfoKg;

  let headers: string[];
  let columnStyles: any;

  if (deveMostrarKg) {
    headers = [
      'Foto',
      'Código',
      'Descrição',
      'Localização',
      'Qtd',
      'Peso/Kg',
      'Preço Unit.',
      'Desc. %',
      'Subtotal',
    ];

    columnStyles = {
      0: { cellWidth: 18, halign: 'center', valign: 'middle' },
      1: { cellWidth: 18 },
      2: { cellWidth: 42 },
      3: { cellWidth: 22 },
      4: { halign: 'center', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'center', cellWidth: 14 },
      8: { halign: 'right', cellWidth: 22 },
    };
  } else {
    headers = [
      'Foto',
      'Código',
      'Descrição',
      'Localização',
      'Qtd',
      'Preço Unit.',
      'Desc. %',
      'Subtotal',
    ];

    columnStyles = {
      0: { cellWidth: 18, halign: 'center', valign: 'middle' },
      1: { cellWidth: 20 },
      2: { cellWidth: 48 },
      3: { cellWidth: 24 },
      4: { halign: 'center', cellWidth: 10 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 24 },
    };
  }

  const tableData = dados.itens.map(item => {
    const descontoFormatado = item.desconto ? `${item.desconto}%` : '0%';

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
      item.quantidade.toString(),
      `R$ ${item.preco_unitario.toFixed(2)}`,
      descontoFormatado,
      `R$ ${item.subtotal.toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: tableData,
    theme: 'grid',

    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
    },

    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
      valign: 'middle',
    },

    alternateRowStyles: {
      fillColor: lightGray,
    },

    columnStyles,

    margin: {
      top: 55,
      left: 15,
      right: 15,
      bottom: 25,
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
            doc.addImage(
              item.imagemDataURL,
              format,
              data.cell.x + 2,
              data.cell.y + 2,
              14,
              14
            );
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
      const totalPages = (doc as any).internal.getNumberOfPages();
      drawHeader(data.pageNumber === 1);
      drawFooter(data.pageNumber, totalPages);
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

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
  const boxHeight = mostrarPeso ? 28 : 20;

  if (yPos + boxHeight > pageHeight - 30) {
    doc.addPage();
    drawHeader(false);
    yPos = 50;
  }

  doc.setFillColor(...primaryColor);
  doc.roundedRect(pageWidth - 85, yPos, 70, boxHeight, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);

  let totalY = yPos + 6;

  if (mostrarPeso) {
    doc.text(`Peso Total: ${pesoTotal.toFixed(3)} kg`, pageWidth - 80, totalY);
    totalY += 7;
  }

  doc.setFontSize(10);
  doc.text('VALOR TOTAL:', pageWidth - 80, totalY);

  doc.setFontSize(12);
  doc.text(
    `R$ ${dados.valor_total.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    })}`,
    pageWidth - 80,
    totalY + 7
  );

  yPos += boxHeight + 10;

  if (dados.pagamento) {
    if (yPos + 35 > pageHeight - 30) {
      doc.addPage();
      drawHeader(false);
      yPos = 50;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('CONDIÇÕES DE PAGAMENTO', 20, yPos);

    yPos += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    let pagamentoY = yPos;

    if (dados.pagamento.pagamento_misto) {
      doc.text('Forma de Pagamento: PAGAMENTO MISTO', 20, pagamentoY);
      pagamentoY += 4;

      doc.text(
        `Crédito utilizado: R$ ${dados.pagamento.valor_credito_utilizado?.toFixed(2) || '0,00'}`,
        20,
        pagamentoY
      );

      pagamentoY += 4;
      doc.text(`Restante: ${dados.pagamento.forma_pagamento_restante}`, 20, pagamentoY);
    } else if (dados.pagamento.forma === 'Crédito do Cliente') {
      doc.text('Forma de Pagamento: CRÉDITO DO CLIENTE', 20, pagamentoY);
      pagamentoY += 4;
      doc.text(`Valor total: R$ ${dados.valor_total.toFixed(2)}`, 20, pagamentoY);
    } else if (!dados.pagamento.parcelas || dados.pagamento.parcelas <= 1) {
      doc.text(`Forma de Pagamento: ${dados.pagamento.forma}`, 20, pagamentoY);
      pagamentoY += 4;
      doc.text(`Valor: R$ ${dados.valor_total.toFixed(2)}`, 20, pagamentoY);
    } else {
      doc.text(`Forma de Pagamento: ${dados.pagamento.forma}`, 20, pagamentoY);
      pagamentoY += 4;

      if (dados.pagamento.entrada && dados.pagamento.entrada > 0) {
        doc.text(`Entrada: R$ ${dados.pagamento.entrada.toFixed(2)} hoje`, 20, pagamentoY);
        pagamentoY += 4;
      }

      const parcelasInfo = dados.pagamento.condicao?.startsWith('0/')
        ? `${dados.pagamento.parcelas - 1}x de R$ ${
            dados.pagamento.valor_parcela?.toFixed(2) || '0,00'
          }`
        : `${dados.pagamento.parcelas}x de R$ ${
            dados.pagamento.valor_parcela?.toFixed(2) || '0,00'
          }`;

      doc.text(`Parcelas: ${parcelasInfo}`, 20, pagamentoY);
      pagamentoY += 4;

      if (dados.pagamento.descricao_condicao) {
        doc.text(`Condição: ${dados.pagamento.descricao_condicao}`, 20, pagamentoY);
      }
    }

    yPos = pagamentoY + 8;
  }

  if (dados.observacoes && dados.observacoes.trim()) {
    const remainingSpace = pageHeight - yPos - 30;
    const estimatedObsHeight = (dados.observacoes.length / 80) * 20;

    if (remainingSpace < estimatedObsHeight) {
      doc.addPage();
      drawHeader(false);
      yPos = 50;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...redColor);
    doc.text('OBSERVAÇÕES IMPORTANTES', 20, yPos);

    yPos += 7;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    doc.setFillColor(255, 248, 248);

    const splitObs = doc.splitTextToSize(dados.observacoes, pageWidth - 40);
    const obsHeight = splitObs.length * 4;

    doc.roundedRect(15, yPos, pageWidth - 30, obsHeight + 8, 2, 2, 'F');

    doc.setTextColor(...redColor);
    doc.text(splitObs, 20, yPos + 5);
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