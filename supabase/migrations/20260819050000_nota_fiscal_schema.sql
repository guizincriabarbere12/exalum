-- Estrutura pra emissão de NF-e (modelo 55) direto com a SEFAZ, sem gateway
-- terceiro. Cobre: dados fiscais que faltavam na empresa/clientes/produtos,
-- a tabela de notas emitidas e o histórico de eventos (autorização,
-- rejeição, cancelamento).

-- ==============================================
-- Dados fiscais do emitente (a empresa)
-- ==============================================
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS crt smallint, -- Código de Regime Tributário: 1=Simples Nacional, 3=Regime Normal (Lucro Presumido/Real)
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero_endereco text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge text, -- 7 dígitos, obrigatório na NF-e
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS proximo_numero_nfe integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS serie_nfe integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfe_ambiente text NOT NULL DEFAULT 'homologacao' CHECK (nfe_ambiente IN ('homologacao', 'producao'));

-- ==============================================
-- Dados fiscais do destinatário (clientes) — endereço estruturado
-- ==============================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero_endereco text,
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge text,
  ADD COLUMN IF NOT EXISTS indicador_ie smallint DEFAULT 9; -- 1=Contribuinte ICMS, 2=Isento, 9=Não contribuinte

-- ==============================================
-- Classificação fiscal dos produtos
-- ==============================================
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cfop text DEFAULT '5102', -- venda dentro do estado, padrão; ajustável por item na emissão
  ADD COLUMN IF NOT EXISTS cst_icms text DEFAULT '060', -- Lucro Presumido: default seguro é ICMS já tributado antes (ajustar conforme o produto)
  ADD COLUMN IF NOT EXISTS origem_mercadoria smallint DEFAULT 0, -- 0=nacional
  ADD COLUMN IF NOT EXISTS cest text;

-- ==============================================
-- Notas fiscais emitidas
-- ==============================================
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL,
  serie integer NOT NULL,
  modelo text NOT NULL DEFAULT '55',
  ambiente text NOT NULL CHECK (ambiente IN ('homologacao', 'producao')),
  chave_acesso text UNIQUE,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'assinada', 'enviando', 'autorizada', 'rejeitada', 'denegada', 'cancelada', 'erro'
  )),
  venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  xml_assinado text,
  xml_retorno text,
  protocolo_autorizacao text,
  motivo_status text,
  data_emissao timestamptz,
  data_autorizacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL,
  UNIQUE (serie, numero, ambiente)
);

CREATE TABLE IF NOT EXISTS public.notas_fiscais_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id),
  numero_item integer NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  ncm text NOT NULL,
  cfop text NOT NULL,
  cst_icms text NOT NULL,
  origem_mercadoria smallint NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'UN',
  quantidade numeric(12,4) NOT NULL,
  valor_unitario numeric(12,4) NOT NULL,
  valor_total numeric(12,2) NOT NULL,
  aliquota_icms numeric(5,2) DEFAULT 0,
  valor_icms numeric(12,2) DEFAULT 0,
  aliquota_pis numeric(5,2) DEFAULT 0,
  valor_pis numeric(12,2) DEFAULT 0,
  aliquota_cofins numeric(5,2) DEFAULT 0,
  valor_cofins numeric(12,2) DEFAULT 0
);

-- Histórico de eventos/tentativas (autorização, rejeição, cancelamento,
-- carta de correção) — auditoria de tudo que foi trocado com a SEFAZ.
CREATE TABLE IF NOT EXISTS public.notas_fiscais_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- envio, autorizacao, rejeicao, cancelamento, cce, erro_comunicacao
  codigo_status text,
  mensagem text,
  xml_enviado text,
  xml_recebido text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver notas fiscais"
  ON public.notas_fiscais FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar notas fiscais"
  ON public.notas_fiscais FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Autenticados podem ver itens de notas fiscais"
  ON public.notas_fiscais_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar itens de notas fiscais"
  ON public.notas_fiscais_itens FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Autenticados podem ver eventos de notas fiscais"
  ON public.notas_fiscais_eventos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar eventos de notas fiscais"
  ON public.notas_fiscais_eventos FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Preenche o CRT já sabendo que é Lucro Presumido (Regime Normal = 3).
UPDATE public.configuracoes SET crt = 3 WHERE crt IS NULL;
