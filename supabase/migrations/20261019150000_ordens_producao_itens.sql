-- OP com varios itens pintados para a mesma cor.
-- Cada item tem o produto de origem (debitado na saida), o produto destino
-- (creditado no retorno; null = volta para o proprio produto) e a quantidade.
-- ordens_producao.produto_id/quantidade continuam preenchidos (1o item / total)
-- por compatibilidade.

ALTER TABLE public.ordens_producao ADD COLUMN IF NOT EXISTS cor_destino text;

CREATE TABLE IF NOT EXISTS public.ordens_producao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL CONSTRAINT ordens_producao_itens_produto_id_fkey REFERENCES public.produtos(id),
  produto_destino_id uuid CONSTRAINT ordens_producao_itens_produto_destino_id_fkey REFERENCES public.produtos(id),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ordens_producao_itens_op ON public.ordens_producao_itens (op_id);

ALTER TABLE public.ordens_producao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados veem itens de OP" ON public.ordens_producao_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem itens de OP" ON public.ordens_producao_itens
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam itens de OP" ON public.ordens_producao_itens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados excluem itens de OP" ON public.ordens_producao_itens
  FOR DELETE TO authenticated USING (true);

-- OPs ja existentes viram OPs de 1 item.
INSERT INTO public.ordens_producao_itens (op_id, produto_id, produto_destino_id, quantidade, created_at)
SELECT o.id, o.produto_id, o.produto_destino_id, o.quantidade, coalesce(o.created_at, now())
FROM public.ordens_producao o
WHERE o.quantidade > 0
  AND NOT EXISTS (SELECT 1 FROM public.ordens_producao_itens i WHERE i.op_id = o.id);

UPDATE public.ordens_producao o
SET cor_destino = p.cor
FROM public.produtos p
WHERE p.id = o.produto_destino_id AND o.cor_destino IS NULL;
