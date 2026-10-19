import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { montarChaveAcesso } from "../_lib/nfe/chaveAcesso.js";
import { montarXmlNFe } from "../_lib/nfe/xmlBuilder.js";
import { assinarNFe, extrairChaveECertificadoDoP12 } from "../_lib/nfe/assinatura.js";
import { chamarServicoSoap, extrairResultadoDaNota } from "../_lib/nfe/soapClient.js";
import { ACTION_AUTORIZACAO, CUF_ESPIRITO_SANTO, NAMESPACE_AUTORIZACAO, urlAutorizacao, type AmbienteNFe } from "../_lib/nfe/webservices.js";
import type { ItemNFe, NotaFiscalInput } from "../_lib/nfe/tipos.js";

const SUPABASE_URL = "https://mwyatiehfbtjouowhwwu.supabase.co";

function apenasDigitos(v: string | null | undefined): string {
  return (v || "").replace(/\D/g, "");
}

async function getUsuarioAutenticado(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);

  const supabaseAnon = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY!);
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Use POST" });
  }

  const p12Base64 = process.env.NFE_CERTIFICADO_P12_BASE64;
  const senha = process.env.NFE_CERTIFICADO_SENHA;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!p12Base64 || !senha) {
    return res.status(500).json({ erro: "Certificado nao configurado no ambiente do Vercel" });
  }
  if (!serviceRoleKey) {
    return res.status(500).json({ erro: "SUPABASE_SERVICE_ROLE_KEY nao configurado no ambiente do Vercel" });
  }

  const usuario = await getUsuarioAutenticado(req);
  if (!usuario) {
    return res.status(401).json({ erro: "Nao autenticado" });
  }

  const supabase = createClient(SUPABASE_URL, serviceRoleKey);

  const { data: perfilAdmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", usuario.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!perfilAdmin) {
    return res.status(403).json({ erro: "Apenas administradores podem emitir NF-e" });
  }

  const { vendaId } = req.body ?? {};
  if (!vendaId) {
    return res.status(400).json({ erro: "Informe vendaId" });
  }

  try {
    // ========== 1. Dados fiscais do emitente ==========
    const { data: config, error: configError } = await supabase.from("configuracoes").select("*").limit(1).single();
    if (configError || !config) throw new Error("Configuracoes da empresa nao encontradas");

    const camposFaltando = [
      !config.cnpj && "CNPJ",
      !config.inscricao_estadual && "Inscricao Estadual",
      !config.crt && "Regime Tributario (CRT)",
      !config.logradouro && "Logradouro",
      !config.numero_endereco && "Numero",
      !config.bairro && "Bairro",
      !config.municipio && "Municipio",
      !config.codigo_municipio_ibge && "Codigo IBGE do municipio",
      !config.uf && "UF",
      !config.cep && "CEP",
    ].filter(Boolean);
    if (camposFaltando.length > 0) {
      return res.status(400).json({
        erro: `Configuracao fiscal incompleta. Faltam: ${camposFaltando.join(", ")}. Preencha em Configuracao Fiscal.`,
      });
    }

    // ========== 2. Venda + orcamento + itens ==========
    const { data: venda, error: vendaError } = await supabase
      .from("vendas")
      .select("*, clientes(*)")
      .eq("id", vendaId)
      .single();
    if (vendaError || !venda) throw new Error("Venda nao encontrada");

    const { data: notaExistente } = await supabase
      .from("notas_fiscais")
      .select("id, status, chave_acesso")
      .eq("venda_id", vendaId)
      .eq("status", "autorizada")
      .maybeSingle();
    if (notaExistente) {
      return res.status(409).json({ erro: "Ja existe uma NF-e autorizada para esta venda", chaveAcesso: notaExistente.chave_acesso });
    }

    if (!venda.orcamento_id) throw new Error("Venda sem orcamento vinculado - nao ha itens para gerar a NF-e");

    const { data: orcamentoItens, error: itensError } = await supabase
      .from("orcamento_itens")
      .select("*, produtos(*), kits(*)")
      .eq("orcamento_id", venda.orcamento_id);
    if (itensError) throw itensError;
    if (!orcamentoItens || orcamentoItens.length === 0) throw new Error("Orcamento sem itens");

    // ========== 3. Expande kits em produtos (NF-e nao conhece "kit", so produto com NCM) ==========
    const itensNFe: ItemNFe[] = [];
    const produtosSemNcm: string[] = [];
    let numeroItem = 1;

    for (const item of orcamentoItens) {
      if (item.produto_id && item.produtos) {
        const p = item.produtos;
        if (!p.ncm) produtosSemNcm.push(p.nome || p.codigo);
        itensNFe.push({
          numeroItem: numeroItem++,
          codigo: p.codigo,
          descricao: p.nome || p.codigo,
          ncm: p.ncm || "",
          cfop: p.cfop || "5102",
          cstIcms: p.cst_icms || "060",
          origemMercadoria: p.origem_mercadoria ?? 0,
          unidade: p.unidade || "UN",
          quantidade: item.quantidade,
          valorUnitario: item.preco_unitario,
          valorTotal: item.subtotal,
        });
      } else if (item.kit_id && item.kits) {
        const { data: kitItens, error: kitItensError } = await supabase
          .from("kit_itens")
          .select("*, produtos(*)")
          .eq("kit_id", item.kit_id);
        if (kitItensError) throw kitItensError;

        const valorTotalKit = item.subtotal;
        const qtdComponentes = (kitItens || []).length || 1;

        for (const ki of kitItens || []) {
          const p = ki.produtos;
          if (!p) continue;
          if (!p.ncm) produtosSemNcm.push(p.nome || p.codigo);
          const qtdComponente = ki.quantidade * item.quantidade;
          itensNFe.push({
            numeroItem: numeroItem++,
            codigo: p.codigo,
            descricao: p.nome || p.codigo,
            ncm: p.ncm || "",
            cfop: p.cfop || "5102",
            cstIcms: p.cst_icms || "060",
            origemMercadoria: p.origem_mercadoria ?? 0,
            unidade: p.unidade || "UN",
            quantidade: qtdComponente,
            // rateio simples do valor do kit entre os componentes, por quantidade
            valorUnitario: Number((valorTotalKit / qtdComponentes / (ki.quantidade || 1)).toFixed(4)),
            valorTotal: Number((valorTotalKit / qtdComponentes).toFixed(2)),
          });
        }
      }
    }

    if (produtosSemNcm.length > 0) {
      return res.status(400).json({
        erro: `Produtos sem NCM cadastrado (obrigatorio pra NF-e): ${[...new Set(produtosSemNcm)].join(", ")}`,
      });
    }

    // ========== 4. Destinatario ==========
    const cliente = venda.clientes;
    if (!cliente) throw new Error("Venda sem cliente vinculado");
    const doc = apenasDigitos(cliente.cpf_cnpj);
    if (doc.length !== 11 && doc.length !== 14) {
      throw new Error(`CPF/CNPJ do cliente invalido: "${cliente.cpf_cnpj}"`);
    }

    // ========== 5. Numero/serie da NF-e ==========
    const numeroNF = config.proximo_numero_nfe;
    const serie = config.serie_nfe;
    const tpAmb: 1 | 2 = config.nfe_ambiente === "producao" ? 1 : 2;
    const ambiente: AmbienteNFe = config.nfe_ambiente === "producao" ? "producao" : "homologacao";

    // proximo_numero_nfe so avanca numa autorizacao de verdade (cStat 100),
    // entao uma tentativa anterior que falhou (erro/rejeitada) deixa o mesmo
    // numero "ocupado" pelo proprio rascunho dela - limpa antes de tentar de
    // novo, ja que uma nota nunca autorizada pela SEFAZ nao e um documento
    // fiscal real, so o nosso registro da tentativa.
    await supabase
      .from("notas_fiscais")
      .delete()
      .eq("serie", serie)
      .eq("numero", numeroNF)
      .eq("ambiente", ambiente)
      .in("status", ["erro", "rejeitada"]);

    const chaveAcesso = montarChaveAcesso({
      cUF: CUF_ESPIRITO_SANTO,
      dataEmissao: new Date(),
      cnpj: config.cnpj,
      modelo: "55",
      serie,
      numeroNF,
    });

    const valorTotalNota = itensNFe.reduce((soma, i) => soma + i.valorTotal, 0);

    const dadosNota: NotaFiscalInput = {
      chaveAcesso,
      cUF: CUF_ESPIRITO_SANTO,
      cNF: chaveAcesso.slice(34, 42),
      numeroNF,
      serie,
      dataEmissao: new Date(),
      tpAmb,
      naturezaOperacao: "Venda de mercadoria",
      emitente: {
        cnpj: config.cnpj,
        xNome: config.nome_empresa,
        ie: config.inscricao_estadual,
        crt: config.crt,
        logradouro: config.logradouro,
        numero: config.numero_endereco,
        bairro: config.bairro,
        codigoMunicipioIbge: config.codigo_municipio_ibge,
        municipio: config.municipio,
        uf: config.uf,
        cep: config.cep,
        telefone: config.telefone,
      },
      destinatario: {
        cnpj: doc.length === 14 ? doc : undefined,
        cpf: doc.length === 11 ? doc : undefined,
        xNome: cliente.nome,
        indicadorIE: (cliente.indicador_ie as 1 | 2 | 9) ?? 9,
        logradouro: cliente.logradouro,
        numero: cliente.numero_endereco,
        bairro: cliente.bairro,
        codigoMunicipioIbge: cliente.codigo_municipio_ibge,
        municipio: cliente.cidade,
        uf: cliente.estado,
        cep: cliente.cep,
        email: cliente.email,
      },
      itens: itensNFe,
      valorTotalProdutos: valorTotalNota,
      valorTotalNota,
      indFinal: 1,
      indPres: 1,
      modFrete: 9,
      informacoesAdicionais: venda.numero ? `Ref. Venda n. ${venda.numero}` : null,
    };

    // ========== 6. Monta, assina e envia ==========
    const xml = montarXmlNFe(dadosNota);
    const credenciais = extrairChaveECertificadoDoP12(p12Base64, senha);
    const xmlAssinado = assinarNFe(xml, credenciais);

    const idLote = Date.now().toString();
    // xmlAssinado tem seu proprio prolog <?xml ...?> (valido como documento
    // standalone, guardado assim no banco) - mas um <?xml?> no MEIO de outro
    // documento XML (aqui dentro do enviNFe/SOAP) é invalido e faz o proprio
    // servidor da SEFAZ rejeitar com HTTP 400 antes de processar qualquer
    // coisa. Precisa tirar o prolog só na hora de embutir.
    const nfeSemProlog = xmlAssinado.replace(/^<\?xml[^>]*\?>/, "");
    const enviNFe = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${idLote}</idLote><indSinc>1</indSinc>${nfeSemProlog}</enviNFe>`;

    const { data: notaRascunho, error: notaRascunhoError } = await supabase
      .from("notas_fiscais")
      .insert({
        numero: numeroNF,
        serie,
        ambiente,
        chave_acesso: chaveAcesso,
        status: "enviando",
        venda_id: vendaId,
        orcamento_id: venda.orcamento_id,
        cliente_id: cliente.id,
        valor_total: valorTotalNota,
        xml_assinado: xmlAssinado,
        data_emissao: dadosNota.dataEmissao.toISOString(),
        informacoes_adicionais: dadosNota.informacoesAdicionais,
        created_by: usuario.id,
      })
      .select()
      .single();

    if (notaRascunhoError || !notaRascunho) {
      throw new Error(`Falha ao gravar rascunho da nota fiscal: ${notaRascunhoError?.message ?? "insert nao retornou dados"}`);
    }

    const pfxBuffer = Buffer.from(p12Base64, "base64");
    let respostaSefaz: string;
    try {
      respostaSefaz = await chamarServicoSoap(
        urlAutorizacao(ambiente),
        NAMESPACE_AUTORIZACAO,
        ACTION_AUTORIZACAO,
        enviNFe,
        { pfxBuffer, senha },
      );
    } catch (erroSefaz: any) {
      await supabase.from("notas_fiscais").update({ status: "erro", motivo_status: erroSefaz.message }).eq("id", notaRascunho.id);
      await supabase.from("notas_fiscais_eventos").insert({
        nota_fiscal_id: notaRascunho.id,
        tipo: "erro_comunicacao",
        mensagem: erroSefaz.message,
        xml_enviado: enviNFe,
        created_by: usuario.id,
      });
      throw erroSefaz;
    }

    const { cStat, xMotivo, nProt } = extrairResultadoDaNota(respostaSefaz);

    await supabase.from("notas_fiscais_eventos").insert({
      nota_fiscal_id: notaRascunho.id,
      tipo: "envio",
      codigo_status: cStat,
      mensagem: xMotivo,
      xml_enviado: enviNFe,
      xml_recebido: respostaSefaz,
      created_by: usuario.id,
    });

    if (cStat === "100") {
      // 100 = Autorizado o uso da NF-e
      await supabase
        .from("notas_fiscais")
        .update({
          status: "autorizada",
          protocolo_autorizacao: nProt,
          motivo_status: xMotivo,
          xml_retorno: respostaSefaz,
          data_autorizacao: new Date().toISOString(),
        })
        .eq("id", notaRascunho.id);

      await supabase.from("notas_fiscais_itens").insert(
        itensNFe.map((item) => ({
          nota_fiscal_id: notaRascunho.id,
          numero_item: item.numeroItem,
          codigo: item.codigo,
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
          cst_icms: item.cstIcms,
          origem_mercadoria: item.origemMercadoria,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          valor_total: item.valorTotal,
        })),
      );

      await supabase.from("configuracoes").update({ proximo_numero_nfe: numeroNF + 1 }).eq("id", config.id);

      return res.status(200).json({
        sucesso: true,
        chaveAcesso,
        protocolo: nProt,
        status: cStat,
        motivo: xMotivo,
      });
    }

    // rejeitada / denegada / outro cStat - numero NAO e consumido, pode reemitir apos corrigir
    await supabase
      .from("notas_fiscais")
      .update({ status: "rejeitada", motivo_status: xMotivo, xml_retorno: respostaSefaz })
      .eq("id", notaRascunho.id);

    return res.status(422).json({ sucesso: false, cStat, xMotivo, chaveAcesso });
  } catch (error: any) {
    return res.status(500).json({ erro: error.message ?? String(error) });
  }
}
