/*
  # Permitir Pedidos Anônimos do Catálogo Público
  
  ## Descrição
  Adiciona policies para permitir que usuários não autenticados (anônimos) possam:
  - Criar clientes
  - Criar pedidos
  - Criar itens de pedidos
  
  ## Segurança
  - Apenas permite inserção (INSERT)
  - Não permite leitura, atualização ou exclusão por usuários anônimos
  - Pedidos criados ficam com origem 'catalogo_publico' para rastreamento
  
  ## Impacto
  - Clientes podem fazer pedidos pelo catálogo público sem criar conta
  - Administradores veem os pedidos no painel e podem aprovar/rejeitar
*/

-- Policy para permitir inserção de clientes por usuários anônimos
DROP POLICY IF EXISTS "Permitir cadastro de clientes do catálogo" ON clientes;
CREATE POLICY "Permitir cadastro de clientes do catálogo"
  ON clientes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy para permitir inserção de pedidos por usuários anônimos
DROP POLICY IF EXISTS "Permitir criação de pedidos do catálogo" ON pedidos;
CREATE POLICY "Permitir criação de pedidos do catálogo"
  ON pedidos FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy para permitir inserção de itens de pedidos por usuários anônimos
DROP POLICY IF EXISTS "Permitir criação de itens de pedidos do catálogo" ON pedido_itens;
CREATE POLICY "Permitir criação de itens de pedidos do catálogo"
  ON pedido_itens FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy para permitir leitura de produtos por usuários anônimos (catálogo)
DROP POLICY IF EXISTS "Permitir leitura de produtos no catálogo" ON produtos;
CREATE POLICY "Permitir leitura de produtos no catálogo"
  ON produtos FOR SELECT
  TO anon, authenticated
  USING (ativo = true);
