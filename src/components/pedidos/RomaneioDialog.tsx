import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck, Loader2, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { gerarPDFRomaneio, downloadPDF } from "@/utils/pdfGenerator";

interface LinhaRomaneio {
  pedidoItemId: string;
  produtoId: string | null;
  kitId: string | null;
  codigo: string;
  nome: string;
  unidade: string;
  quantidadePedida: number;
  quantidadeEntregueAntes: number;
  estoqueDisponivel: number | null; // null = kit, sem checagem de estoque
  quantidadeEntregarAgora: string;
}

interface Props {
  pedidoId: string;
  pedidoNumero: string;
  clienteNome: string;
  clienteTelefone: string | null;
  onSalvo?: () => void;
}

export function RomaneioDialog({ pedidoId, pedidoNumero, clienteNome, clienteTelefone, onSalvo }: Props) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaRomaneio[]>([]);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!aberto) return;
    carregarItens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const carregarItens = async () => {
    setCarregando(true);
    try {
      const { data: itensBasicos, error } = await supabase
        .from("pedido_itens")
        .select("id, produto_id, kit_id, quantidade")
        .eq("pedido_id", pedidoId)
        .order("created_at");
      if (error) throw error;

      const { data: entreguesAntes } = await supabase
        .from("romaneio_itens")
        .select("pedido_item_id, quantidade_entregue, romaneios!inner(status)")
        .eq("romaneios.pedido_id", pedidoId)
        .eq("romaneios.status", "finalizado");

      const somaEntregue = new Map<string, number>();
      (entreguesAntes || []).forEach((e: any) => {
        somaEntregue.set(e.pedido_item_id, (somaEntregue.get(e.pedido_item_id) || 0) + Number(e.quantidade_entregue));
      });

      const linhasMontadas: LinhaRomaneio[] = await Promise.all(
        (itensBasicos || []).map(async (item) => {
          let codigo = "-";
          let nome = "-";
          let unidade = "Un";
          let estoqueDisponivel: number | null = null;

          if (item.produto_id) {
            const { data: produto } = await supabase
              .from("produtos")
              .select("codigo, nome, unidade, estoque")
              .eq("id", item.produto_id)
              .single();
            if (produto) {
              codigo = produto.codigo;
              nome = produto.nome;
              unidade = produto.unidade || "Un";
              estoqueDisponivel = Number(produto.estoque ?? 0);
            }
          } else if (item.kit_id) {
            const { data: kit } = await supabase.from("kits").select("codigo, nome").eq("id", item.kit_id).single();
            if (kit) {
              codigo = kit.codigo;
              nome = kit.nome;
            }
          }

          const entregueAntes = somaEntregue.get(item.id) || 0;
          const pendente = Math.max(0, Number(item.quantidade) - entregueAntes);
          const sugestao = estoqueDisponivel != null ? Math.min(pendente, Math.max(0, estoqueDisponivel)) : pendente;

          return {
            pedidoItemId: item.id,
            produtoId: item.produto_id,
            kitId: item.kit_id,
            codigo,
            nome,
            unidade,
            quantidadePedida: Number(item.quantidade),
            quantidadeEntregueAntes: entregueAntes,
            estoqueDisponivel,
            quantidadeEntregarAgora: String(sugestao),
          };
        })
      );

      setLinhas(linhasMontadas);
      setObservacoes("");
    } catch (error: any) {
      toast.error("Erro ao carregar itens do pedido", { description: error.message });
    } finally {
      setCarregando(false);
    }
  };

  const atualizarQuantidade = (pedidoItemId: string, valor: string) => {
    setLinhas((prev) => prev.map((l) => (l.pedidoItemId === pedidoItemId ? { ...l, quantidadeEntregarAgora: valor } : l)));
  };

  const gerarNumeroRomaneio = async (): Promise<string> => {
    const { data } = await supabase.from("romaneios").select("numero").order("numero", { ascending: false }).limit(1);
    let proximo = 1;
    if (data && data.length > 0) {
      const match = data[0].numero.match(/ROM(\d+)/);
      if (match) proximo = parseInt(match[1]) + 1;
    }
    return `ROM${proximo.toString().padStart(6, "0")}`;
  };

  const confirmar = async () => {
    const itensParaEntregar = linhas.filter((l) => Number(l.quantidadeEntregarAgora.replace(",", ".")) > 0);
    if (itensParaEntregar.length === 0) {
      toast.error("Informe a quantidade a entregar em pelo menos um item");
      return;
    }

    const excedendoEstoque = itensParaEntregar.find(
      (l) => l.estoqueDisponivel != null && Number(l.quantidadeEntregarAgora.replace(",", ".")) > l.estoqueDisponivel
    );
    if (excedendoEstoque && !confirm(`"${excedendoEstoque.nome}" não tem estoque suficiente. Gerar o romaneio mesmo assim?`)) {
      return;
    }

    setSalvando(true);
    try {
      const numero = await gerarNumeroRomaneio();

      const { data: romaneio, error: erroRomaneio } = await supabase
        .from("romaneios")
        .insert({
          numero,
          pedido_id: pedidoId,
          observacoes: observacoes.trim() || null,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (erroRomaneio || !romaneio) throw erroRomaneio;

      const itensInsert = itensParaEntregar.map((l) => ({
        romaneio_id: romaneio.id,
        pedido_item_id: l.pedidoItemId,
        produto_id: l.produtoId,
        kit_id: l.kitId,
        quantidade_entregue: Number(l.quantidadeEntregarAgora.replace(",", ".")),
      }));
      const { error: erroItens } = await supabase.from("romaneio_itens").insert(itensInsert);
      if (erroItens) throw erroItens;

      // baixa estoque dos produtos (matriz) - kits nao tem baixa automatica aqui
      for (const item of itensParaEntregar) {
        if (!item.produtoId || item.estoqueDisponivel == null) continue;
        const qtd = Number(item.quantidadeEntregarAgora.replace(",", "."));
        await supabase
          .from("produtos")
          .update({ estoque: Math.max(0, item.estoqueDisponivel - qtd) })
          .eq("id", item.produtoId);
      }

      const tudoEntregue = linhas.every((l) => {
        const entregueAgora = itensParaEntregar.find((i) => i.pedidoItemId === l.pedidoItemId);
        const total = l.quantidadeEntregueAntes + (entregueAgora ? Number(entregueAgora.quantidadeEntregarAgora.replace(",", ".")) : 0);
        return total >= l.quantidadePedida;
      });
      await supabase
        .from("pedidos")
        .update({ status: tudoEntregue ? "entregue" : "em_separacao", ...(tudoEntregue ? { data_entrega: new Date().toISOString() } : {}) })
        .eq("id", pedidoId);

      const { data: config } = await supabase.from("configuracoes").select("*").limit(1).single();

      try {
        const pdfBlob = await gerarPDFRomaneio(
          {
            numero,
            data: new Date().toLocaleDateString("pt-BR"),
            pedidoNumero,
            cliente: { nome: clienteNome, cpf_cnpj: "", telefone: clienteTelefone, email: null, endereco: null },
            itens: itensParaEntregar.map((l) => ({
              codigo: l.codigo,
              nome: l.nome,
              unidade: l.unidade,
              quantidade_pedida: l.quantidadePedida,
              quantidade_entregue_antes: l.quantidadeEntregueAntes,
              quantidade_entregue_agora: Number(l.quantidadeEntregarAgora.replace(",", ".")),
            })),
            observacoes: observacoes.trim() || undefined,
          },
          config || { nome_empresa: "Empresa", cnpj: null, telefone: null, email: null, endereco: null, logo_url: null }
        );
        downloadPDF(pdfBlob, `Romaneio_${numero}.pdf`);
      } catch (erroPdf) {
        console.error("Erro ao gerar PDF do romaneio:", erroPdf);
      }

      toast.success(`Romaneio ${numero} gerado!`, {
        description: tudoEntregue ? "Pedido marcado como entregue." : "Pedido em separação — ainda há itens pendentes.",
      });
      setAberto(false);
      onSalvo?.();
    } catch (error: any) {
      toast.error("Erro ao gerar romaneio", { description: error.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Truck className="h-4 w-4 mr-1" />
          Romaneio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Romaneio de entrega — Pedido {pedidoNumero}
          </DialogTitle>
          <DialogDescription>
            Confira a quantidade que está saindo pra entrega agora. O que não sair fica pendente pra um próximo
            romaneio.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Pedido</TableHead>
                    <TableHead className="text-center">Já entregue</TableHead>
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead className="text-center w-28">Entregar agora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((linha) => {
                    const pendente = linha.quantidadePedida - linha.quantidadeEntregueAntes;
                    const entrando = Number(linha.quantidadeEntregarAgora.replace(",", ".")) || 0;
                    const excedeEstoque = linha.estoqueDisponivel != null && entrando > linha.estoqueDisponivel;
                    return (
                      <TableRow key={linha.pedidoItemId}>
                        <TableCell>
                          <p className="text-sm font-medium">{linha.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {linha.codigo} · pendente: {pendente} {linha.unidade}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">{linha.quantidadePedida}</TableCell>
                        <TableCell className="text-center">{linha.quantidadeEntregueAntes}</TableCell>
                        <TableCell className="text-center">
                          {linha.estoqueDisponivel != null ? linha.estoqueDisponivel : "—"}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-24 text-center"
                            value={linha.quantidadeEntregarAgora}
                            onChange={(e) => atualizarQuantidade(linha.pedidoItemId, e.target.value)}
                          />
                          {excedeEstoque && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-red-600">
                              <TriangleAlert className="h-3 w-3" /> acima do estoque
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-sm font-medium">Observações (motorista, veículo, etc.)</label>
              <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={carregando || salvando}>
            {salvando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : (
              "Gerar romaneio e PDF"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
