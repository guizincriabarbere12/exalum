/*
  # Permitir Acesso Público às Configurações e Kits
  
  ## Descrição
  Adiciona policies para permitir que usuários não autenticados possam:
  - Ler configurações da empresa (logo e nome)
  - Ler kits disponíveis no catálogo
  
  ## Segurança
  - Apenas permite leitura (SELECT)
  - Não permite inserção, atualização ou exclusão por usuários anônimos
*/

-- Policy para permitir leitura de configurações por usuários anônimos
DROP POLICY IF EXISTS "Permitir leitura de configurações no catálogo" ON configuracoes;
CREATE POLICY "Permitir leitura de configurações no catálogo"
  ON configuracoes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy para permitir leitura de kits por usuários anônimos
DROP POLICY IF EXISTS "Permitir leitura de kits no catálogo" ON kits;
CREATE POLICY "Permitir leitura de kits no catálogo"
  ON kits FOR SELECT
  TO anon, authenticated
  USING (ativo = true);
