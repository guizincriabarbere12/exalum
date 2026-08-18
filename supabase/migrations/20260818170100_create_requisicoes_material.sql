-- Requisições internas de material: o serralheiro monta um pedido de produtos/kits
-- (sem valores, é uma retirada de estoque, não uma venda) e a administração aprova
-- ou rejeita. A aprovação debita o estoque de forma atômica (uma única transação).

CREATE TABLE IF NOT EXISTS public.requisicoes_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  solicitante_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  observacoes text,
  motivo_rejeicao text,
  aprovado_por uuid REFERENCES auth.users ON DELETE SET NULL,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requisicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id uuid NOT NULL REFERENCES public.requisicoes_material ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos ON DELETE CASCADE,
  kit_id uuid REFERENCES public.kits ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (produto_id IS NOT NULL AND kit_id IS NULL) OR
    (produto_id IS NULL AND kit_id IS NOT NULL)
  )
);

ALTER TABLE public.requisicoes_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar requisicoes"
  ON public.requisicoes_material FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Solicitante pode criar propria requisicao"
  ON public.requisicoes_material FOR INSERT
  TO authenticated
  WITH CHECK (solicitante_id = auth.uid());

CREATE POLICY "Solicitante pode ver propria requisicao"
  ON public.requisicoes_material FOR SELECT
  TO authenticated
  USING (solicitante_id = auth.uid());

CREATE POLICY "Admins podem gerenciar itens de requisicao"
  ON public.requisicao_itens FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Solicitante pode inserir itens da propria requisicao"
  ON public.requisicao_itens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requisicoes_material r
      WHERE r.id = requisicao_id AND r.solicitante_id = auth.uid()
    )
  );

CREATE POLICY "Solicitante pode ver itens da propria requisicao"
  ON public.requisicao_itens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requisicoes_material r
      WHERE r.id = requisicao_id AND r.solicitante_id = auth.uid()
    )
  );

-- Numeração sequencial (REQ-0001). SECURITY DEFINER para enxergar todas as
-- requisições ao calcular o próximo número, já que o solicitante só vê as próprias.
CREATE OR REPLACE FUNCTION public.gerar_numero_requisicao()
RETURNS text AS $$
DECLARE
  ultimo_numero integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 'REQ-(\d+)') AS integer)), 0)
  INTO ultimo_numero
  FROM public.requisicoes_material;

  RETURN 'REQ-' || LPAD((ultimo_numero + 1)::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expande um kit recursivamente (suporta sub-kits via kit_itens.sub_kit_id) em
-- produtos-base e a quantidade total necessária.
CREATE OR REPLACE FUNCTION public.expandir_kit_requisicao(kit_id_param uuid, multiplicador integer)
RETURNS TABLE(produto_id uuid, quantidade_total integer) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE expansao AS (
    SELECT ki.produto_id, ki.sub_kit_id, (ki.quantidade * multiplicador) AS quantidade
    FROM public.kit_itens ki
    WHERE ki.kit_id = kit_id_param
    UNION ALL
    SELECT ki2.produto_id, ki2.sub_kit_id, (ki2.quantidade * e.quantidade) AS quantidade
    FROM public.kit_itens ki2
    JOIN expansao e ON ki2.kit_id = e.sub_kit_id
  )
  SELECT e.produto_id, SUM(e.quantidade)::integer
  FROM expansao e
  WHERE e.produto_id IS NOT NULL
  GROUP BY e.produto_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Aprova a requisição: valida estoque suficiente e debita tudo numa única
-- transação.
CREATE OR REPLACE FUNCTION public.aprovar_requisicao_material(requisicao_id_param uuid)
RETURNS json AS $$
DECLARE
  faltando json[] := '{}';
  rec RECORD;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Apenas administradores podem aprovar requisições');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.requisicoes_material WHERE id = requisicao_id_param AND status = 'pendente') THEN
    RETURN json_build_object('success', false, 'message', 'Requisição não encontrada ou já processada');
  END IF;

  CREATE TEMP TABLE necessidade ON COMMIT DROP AS
  WITH itens AS (
    SELECT produto_id, kit_id, quantidade
    FROM public.requisicao_itens
    WHERE requisicao_id = requisicao_id_param
  ),
  diretos AS (
    SELECT produto_id, quantidade FROM itens WHERE produto_id IS NOT NULL
  ),
  kits_expandidos AS (
    SELECT ek.produto_id, ek.quantidade_total AS quantidade
    FROM itens i
    CROSS JOIN LATERAL public.expandir_kit_requisicao(i.kit_id, i.quantidade) ek
    WHERE i.kit_id IS NOT NULL
  )
  SELECT produto_id, SUM(quantidade)::integer AS quantidade
  FROM (SELECT * FROM diretos UNION ALL SELECT * FROM kits_expandidos) t
  GROUP BY produto_id;

  FOR rec IN
    SELECT n.quantidade AS necessario, p.estoque, p.nome
    FROM necessidade n JOIN public.produtos p ON p.id = n.produto_id
    WHERE p.estoque < n.quantidade
  LOOP
    faltando := array_append(faltando, json_build_object('produto', rec.nome, 'necessario', rec.necessario, 'disponivel', rec.estoque));
  END LOOP;

  IF array_length(faltando, 1) > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Estoque insuficiente para aprovar a requisição', 'itens_faltando', array_to_json(faltando));
  END IF;

  UPDATE public.produtos p
  SET estoque = p.estoque - n.quantidade,
      updated_at = now()
  FROM necessidade n
  WHERE p.id = n.produto_id;

  INSERT INTO public.movimentacoes_estoque (produto_id, tipo, quantidade, motivo, usuario_id, usuario_nome)
  SELECT n.produto_id, 'saida', n.quantidade,
         'Aprovação da requisição ' || (SELECT numero FROM public.requisicoes_material WHERE id = requisicao_id_param),
         auth.uid(),
         (SELECT email FROM auth.users WHERE id = auth.uid())
  FROM necessidade n;

  UPDATE public.requisicoes_material
  SET status = 'aprovado', aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  WHERE id = requisicao_id_param;

  RETURN json_build_object('success', true, 'message', 'Requisição aprovada e estoque atualizado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rejeita a requisição (não mexe em estoque).
CREATE OR REPLACE FUNCTION public.rejeitar_requisicao_material(requisicao_id_param uuid, motivo_param text DEFAULT NULL)
RETURNS json AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Apenas administradores podem rejeitar requisições');
  END IF;

  UPDATE public.requisicoes_material
  SET status = 'rejeitado', motivo_rejeicao = motivo_param, aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  WHERE id = requisicao_id_param AND status = 'pendente';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Requisição não encontrada ou já processada');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Requisição rejeitada');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
