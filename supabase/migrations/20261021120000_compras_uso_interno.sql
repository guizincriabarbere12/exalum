-- Compras de itens que NAO sao produtos de venda (ex.: vidros para obras,
-- ferramentas, material de consumo). Nao mexem no estoque; viram despesa no
-- financeiro (transacoes_financeiras.origem_tipo = 'compra_uso_interno').

CREATE SEQUENCE IF NOT EXISTS public.compras_uso_interno_seq;

CREATE TABLE IF NOT EXISTS public.compras_uso_interno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE DEFAULT ('UI-' || lpad(nextval('public.compras_uso_interno_seq')::text, 4, '0')),
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  fornecedor_nome text,
  obra text,
  data_compra date NOT NULL DEFAULT current_date,
  forma_pagamento text,
  condicao_pagamento text,
  valor_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada', 'cancelada')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compras_uso_interno_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.compras_uso_interno(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  unidade text NOT NULL DEFAULT 'un',
  valor_unitario numeric NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compras_uso_interno_itens_compra ON public.compras_uso_interno_itens (compra_id);

ALTER TABLE public.compras_uso_interno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados veem compras de uso interno" ON public.compras_uso_interno
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem compras de uso interno" ON public.compras_uso_interno
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam compras de uso interno" ON public.compras_uso_interno
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.compras_uso_interno_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados veem itens de compras de uso interno" ON public.compras_uso_interno_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem itens de compras de uso interno" ON public.compras_uso_interno_itens
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados excluem itens de compras de uso interno" ON public.compras_uso_interno_itens
  FOR DELETE TO authenticated USING (true);
