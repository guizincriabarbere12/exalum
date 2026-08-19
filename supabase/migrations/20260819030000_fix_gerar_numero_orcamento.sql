-- BUG CRÍTICO ao vivo: gerar_numero_orcamento() calculava corretamente o
-- próximo número (MAX dos sufixos numéricos + 1), mas o LPAD(..., 5, '0')
-- seguinte TRUNCA strings mais longas que 5 caracteres em vez de só
-- preencher com zero à esquerda quando são menores. Como os números reais
-- de orçamento no exalum são "ORC-CLIENTE-20260803172010933" (nome +
-- timestamp), o "próximo número" sempre teve ~17 dígitos, e o LPAD sempre
-- cortava pros 5 primeiros — sempre o mesmo valor ("ORC-20260"). Desde que
-- o primeiro orçamento pegou esse número (12:02 de hoje), TODO novo
-- orçamento colidia com ele e falhava ao criar.
--
-- A lógica de "MAX dos sufixos + 1" nunca fez sentido pra esse formato de
-- numeração baseado em nome+timestamp usado pelo app de verdade. Troca
-- para gerar diretamente por timestamp de milissegundo, que é o mesmo
-- padrão que o app já usa manualmente (nome do cliente + timestamp) e é
-- naturalmente único e crescente.
CREATE OR REPLACE FUNCTION public.gerar_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Microssegundo (não só milissegundo) + sufixo aleatório: chamadas quase
  -- simultâneas (dois admins criando orçamento ao mesmo tempo) já colidiram
  -- só com milissegundo na mesma consulta, então aumentei a precisão do
  -- timestamp e adicionei um componente aleatório como reforço.
  RETURN 'ORC-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS') || '-' || lpad(floor(random() * 1000)::int::text, 3, '0');
END;
$function$;
