/*
  # Separate Orçamento Approval from Pedido Creation
  
  1. Changes
    - Create new function to approve orçamento WITHOUT creating pedido automatically
    - Orçamentos are just quotes/estimates
    - Pedidos come from catalog purchases and need manual acceptance
  
  2. New Function
    - `aprovar_orcamento_simples` - Just changes status to 'aprovado'
    - Does NOT create pedido
    - Does NOT debit stock
*/

-- Function to simply approve an orçamento (no pedido, no stock debit)
CREATE OR REPLACE FUNCTION aprovar_orcamento_simples(orcamento_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  orcamento_row RECORD;
BEGIN
  -- Get orçamento data
  SELECT * INTO orcamento_row
  FROM orcamentos
  WHERE id = orcamento_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Orçamento não encontrado'
    );
  END IF;

  -- Check if already approved
  IF orcamento_row.status = 'aprovado' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Este orçamento já foi aprovado anteriormente'
    );
  END IF;

  -- Simply update status to aprovado
  UPDATE orcamentos
  SET status = 'aprovado'
  WHERE id = orcamento_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento aprovado com sucesso!'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao aprovar orçamento: ' || SQLERRM
    );
END;
$$;

-- Function to reject an orçamento
CREATE OR REPLACE FUNCTION rejeitar_orcamento(orcamento_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  orcamento_row RECORD;
BEGIN
  -- Get orçamento data
  SELECT * INTO orcamento_row
  FROM orcamentos
  WHERE id = orcamento_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Orçamento não encontrado'
    );
  END IF;

  -- Update status to rejeitado
  UPDATE orcamentos
  SET status = 'rejeitado'
  WHERE id = orcamento_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento rejeitado'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao rejeitar orçamento: ' || SQLERRM
    );
END;
$$;
