import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LinhaRelatorio } from '@/lib/esquadria';

interface OpcoesRelatorio {
  empresa?: string;
  cor: string;
  desejado: number;
  barra: number;
}

const textoFaltas = (v: LinhaRelatorio['versoes'][number]) =>
  v.faltas.length === 0
    ? 'Nada'
    : v.faltas
        .map((f) => `${f.codigo}: ${f.falta} ${f.falta === 1 ? 'barra' : 'barras'}${f.produtos.length === 0 ? ' (sem cadastro)' : !f.produtos.some((p) => p.naCor) ? ' (sem a cor)' : ''}`)
        .join('\n');

/** Relatório do módulo AlumIA: o que dá para montar com o estoque e o que falta, por modelo e versão. */
export function gerarPDFRelatorioEsquadrias(linhas: LinhaRelatorio[], op: OpcoesRelatorio): Blob {
  const doc = new jsPDF({ orientation: 'landscape' });
  const largura = doc.internal.pageSize.getWidth();

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de montagem – portas e janelas', 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    [
      `${op.empresa ? `${op.empresa} · ` : ''}Gerado em ${new Date().toLocaleString('pt-BR')}`,
      `Cor do perfil: ${op.cor || 'todas as cores (estoque somado)'} · Falta calculada para ${op.desejado} ${op.desejado === 1 ? 'unidade' : 'unidades'} · Barra ${op.barra} mm`,
    ],
    14,
    22,
  );

  const versoes = linhas.flatMap((l) => l.versoes.map((v) => ({ l, v })));
  const montaveis = versoes.filter(({ v }) => v.capacidade.maximo > 0).length;
  doc.text(`${montaveis} de ${versoes.length} modelos/versões podem ser montados com o estoque atual.`, 14, 32);

  autoTable(doc, {
    startY: 36,
    head: [['Linha', 'Modelo', 'Versão', 'Medida (mm)', 'Dá p/ montar', 'Acaba primeiro', `Falta p/ montar ${op.desejado}`]],
    body: versoes.map(({ l, v }) => [
      l.modelo.sistema,
      l.modelo.nome,
      l.versoes.length > 1 ? (v.semBaguete ? 'Sem baguete' : 'Com baguete') : 'Única',
      `${l.largura} × ${l.altura}`,
      v.capacidade.maximo >= 500 ? '500+' : String(v.capacidade.maximo),
      v.capacidade.limitante || '-',
      textoFaltas(v),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, valign: 'top' },
    headStyles: { fillColor: [42, 15, 58], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 70 },
      2: { cellWidth: 22 },
      3: { cellWidth: 24 },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 24 },
      6: { cellWidth: largura - 28 - 190 },
    },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 4) {
        d.cell.styles.textColor = d.cell.raw === '0' ? [185, 28, 28] : [21, 128, 61];
      }
    },
    margin: { left: 14, right: 14 },
  });

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Modelos de corte do catálogo Hydro (AlumIA) – confira as cotas na revisão vigente · página ${i}/${paginas}`, 14, doc.internal.pageSize.getHeight() - 6);
  }
  return doc.output('blob');
}
