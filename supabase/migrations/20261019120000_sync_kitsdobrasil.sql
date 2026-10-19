-- Traz para a Exalum as estruturas de banco que o Kits do Brasil ganhou depois
-- da sincronizacao de agosto (telas copiadas do Kits dependem delas).

-- 1. Formas de pagamento personalizadas (Configuracoes > Formas de pagamento),
--    com chave opcional (ex.: chave Pix) exibida no orcamento.
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  chave text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view formas_pagamento" ON public.formas_pagamento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert formas_pagamento" ON public.formas_pagamento
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update formas_pagamento" ON public.formas_pagamento
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete formas_pagamento" ON public.formas_pagamento
  FOR DELETE TO authenticated USING (public.is_admin());

-- 2. Transferencias de estoque com varios itens e transportadora.
ALTER TABLE public.transferencias_estoque ADD COLUMN IF NOT EXISTS transportadora text;

CREATE TABLE IF NOT EXISTS public.transferencias_estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES public.transferencias_estoque(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id),
  kit_id uuid REFERENCES public.kits(id),
  quantidade numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transferencias_estoque_itens_um_tipo CHECK (
    (produto_id IS NOT NULL AND kit_id IS NULL) OR (produto_id IS NULL AND kit_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_transferencias_estoque_itens_transferencia
  ON public.transferencias_estoque_itens (transferencia_id);
ALTER TABLE public.transferencias_estoque_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados podem ver itens de transferencias" ON public.transferencias_estoque_itens
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuarios autenticados podem inserir itens de transferencias" ON public.transferencias_estoque_itens
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Editar uma transferencia pendente apaga e regrava os itens: sem esta policy
-- o delete nao afeta nenhuma linha e os itens duplicam.
CREATE POLICY "Usuarios autenticados podem excluir itens de transferencias" ON public.transferencias_estoque_itens
  FOR DELETE USING (auth.role() = 'authenticated');

INSERT INTO public.transferencias_estoque_itens (transferencia_id, produto_id, kit_id, quantidade)
SELECT t.id, t.produto_id, t.kit_id, t.quantidade
FROM public.transferencias_estoque t
WHERE (t.produto_id IS NOT NULL OR t.kit_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.transferencias_estoque_itens i WHERE i.transferencia_id = t.id);

ALTER TABLE public.transferencias_estoque ALTER COLUMN quantidade DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.gerar_numero_transferencia()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    prefixo text;
    sequencia integer;
BEGIN
    prefixo := 'TRF-' || TO_CHAR(CURRENT_DATE, 'YYYY') || TO_CHAR(CURRENT_DATE, 'MM') || '-';
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM char_length(prefixo) + 1) AS INTEGER)), 0) + 1
      INTO sequencia
      FROM public.transferencias_estoque
     WHERE numero LIKE prefixo || '%';
    RETURN prefixo || LPAD(sequencia::TEXT, 4, '0');
END;
$function$;

-- 3. Compras: status 'recebida' (gravado pela tela ao receber) e quantidade
--    efetivamente recebida por item.
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_status_check;
ALTER TABLE public.compras ADD CONSTRAINT compras_status_check CHECK (
  (status)::text = ANY ((ARRAY[
    'pendente'::character varying, 'aprovado'::character varying,
    'recebido'::character varying, 'recebida'::character varying,
    'cancelado'::character varying, 'cancelada'::character varying,
    'faturado'::character varying
  ])::text[])
);
ALTER TABLE public.compra_itens ADD COLUMN IF NOT EXISTS quantidade_recebida numeric;

-- 4. Ordens de producao: fornecedor da pintura.
ALTER TABLE public.ordens_producao
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid
  CONSTRAINT ordens_producao_fornecedor_id_fkey REFERENCES public.fornecedores(id);

-- 5. NF-e: informacoes adicionais da nota (campo usado pelo emissor).
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS informacoes_adicionais text;
