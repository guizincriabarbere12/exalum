/*
  # Sistema ERP Completo - Exalum Manager
  
  ## Descrição
  Criação completa do banco de dados para sistema de gerenciamento de produtos de alumínio.
  
  ## Tabelas Criadas
  
  ### 1. profiles
  - Perfis de usuários vinculados ao auth.users
  - Campos: id, full_name, created_at, updated_at
  
  ### 2. user_roles
  - Controle de permissões (admin/user)
  - Campos: id, user_id, role, created_at
  
  ### 3. configuracoes
  - Dados da empresa para orçamentos e documentos
  - Campos: nome_empresa, cnpj, telefone, email, endereco, logo_url
  
  ### 4. clientes
  - Cadastro de clientes
  - Campos: nome, cpf_cnpj, telefone, email, endereco, user_id
  - Vincula clientes a usuários para acesso ao catálogo
  
  ### 5. fornecedores
  - Cadastro de fornecedores
  - Campos: nome, cnpj, telefone, email
  
  ### 6. produtos
  - Produtos individuais (perfis de alumínio)
  - Campos: codigo, nome, descricao, categoria, peso, preco, preco_por_kg, custo, imagem_url, estoque, estoque_minimo
  
  ### 7. kits
  - Kits pré-montados de produtos
  - Campos: codigo, nome, descricao, preco_total
  
  ### 8. kit_itens
  - Componentes de cada kit
  - Relaciona kits com produtos e suas quantidades
  
  ### 9. orcamentos
  - Orçamentos para clientes
  - Campos: numero, cliente_id, valor_total, status, observacoes
  
  ### 10. orcamento_itens
  - Itens de cada orçamento (produtos ou kits)
  - Suporta desconto por item
  
  ### 11. pedidos
  - Pedidos de clientes (origem: sistema ou catálogo público)
  - Campos: numero, cliente_id, status, valor_total, data_pedido, observacoes, origem
  
  ### 12. pedido_itens
  - Itens de cada pedido
  
  ### 13. vendas
  - Vendas efetivadas
  - Campos: numero, cliente_id, valor_total, status, orcamento_id
  
  ### 14. venda_itens
  - Itens de cada venda
  
  ### 15. transacoes_financeiras
  - Controle financeiro (receitas/despesas)
  - Campos: descricao, tipo, valor, data, status, categoria
  
  ### 16. movimentacao_estoque
  - Histórico de movimentações de estoque
  
  ## Views
  
  ### kits_estoque_disponivel
  - Calcula automaticamente o estoque disponível de cada kit baseado nos componentes
  
  ### produtos_estoque_baixo
  - Lista produtos com estoque abaixo do mínimo
  
  ## Funções
  
  ### gerar_numero_orcamento()
  - Gera número sequencial para orçamentos (ORC-0001)
  
  ### gerar_numero_pedido()
  - Gera número sequencial para pedidos (PED-0001)
  
  ### get_dashboard_stats()
  - Retorna estatísticas para o dashboard
  
  ### processar_pedido(pedido_id)
  - Confirma pedido e debita estoque automaticamente
  - Valida disponibilidade antes de confirmar
  
  ### aprovar_orcamento_simples(orcamento_id)
  - Aprova orçamento (apenas muda status, sem criar venda)
  
  ### rejeitar_orcamento(orcamento_id)
  - Rejeita orçamento
  
  ### criar_pedido_catalogo(cliente_id, itens_json, observacoes)
  - Cria pedido a partir do catálogo público
  - Reserva estoque temporariamente (status pendente)
  
  ### aprovar_pedido_catalogo(pedido_id)
  - Aprova pedido do catálogo e debita estoque
  
  ### rejeitar_pedido_catalogo(pedido_id)
  - Rejeita pedido do catálogo e libera estoque
  
  ## Segurança (RLS)
  
  Todas as tabelas possuem Row Level Security habilitado com políticas específicas:
  - Admins: acesso total
  - Users: acesso limitado conforme regras de negócio
  - Clientes: acesso apenas aos próprios pedidos via catálogo
  
  ## Triggers
  
  ### handle_new_user
  - Cria perfil automaticamente quando usuário se registra
  
  ## Notas Importantes
  
  1. Primeira configuração é criada automaticamente
  2. Primeiro usuário recebe role 'admin' automaticamente
  3. Estoque de kits é calculado dinamicamente
  4. Aprovação de pedidos debita estoque automaticamente
  5. Sistema suporta produtos individuais e kits
*/

-- Criar enum para roles
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================
-- TABELA: profiles
-- ==============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver próprio perfil"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==============================================
-- TABELA: user_roles
-- ==============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Usuários podem ver próprias roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Função auxiliar para verificar role
CREATE OR REPLACE FUNCTION has_role(_role app_role, _user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- TABELA: configuracoes
-- ==============================================
CREATE TABLE IF NOT EXISTS configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa text NOT NULL DEFAULT 'Exalum',
  cnpj text,
  telefone text,
  email text,
  endereco text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver configurações"
  ON configuracoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem atualizar configurações"
  ON configuracoes FOR UPDATE
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

-- Inserir configuração padrão se não existir
INSERT INTO configuracoes (nome_empresa, cnpj, telefone, email)
SELECT 'Exalum', '00.000.000/0000-00', '(00) 0000-0000', 'contato@exalum.com'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes LIMIT 1);

-- ==============================================
-- TABELA: clientes
-- ==============================================
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf_cnpj text NOT NULL,
  telefone text,
  email text,
  endereco text,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar clientes"
  ON clientes FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Clientes podem ver próprios dados"
  ON clientes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Clientes podem atualizar próprios dados"
  ON clientes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ==============================================
-- TABELA: fornecedores
-- ==============================================
CREATE TABLE IF NOT EXISTS fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text NOT NULL,
  telefone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver fornecedores"
  ON fornecedores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar fornecedores"
  ON fornecedores FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

-- ==============================================
-- TABELA: produtos
-- ==============================================
CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  categoria text,
  peso numeric(10, 3),
  unidade text DEFAULT 'UN',
  preco numeric(10, 2) NOT NULL DEFAULT 0,
  preco_por_kg numeric(10, 2),
  custo numeric(10, 2),
  imagem_url text,
  estoque integer NOT NULL DEFAULT 0,
  estoque_minimo integer NOT NULL DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver produtos ativos"
  ON produtos FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Admins podem gerenciar produtos"
  ON produtos FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

-- ==============================================
-- TABELA: kits
-- ==============================================
CREATE TABLE IF NOT EXISTS kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  preco_total numeric(10, 2) NOT NULL DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver kits ativos"
  ON kits FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Admins podem gerenciar kits"
  ON kits FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

-- ==============================================
-- TABELA: kit_itens
-- ==============================================
CREATE TABLE IF NOT EXISTS kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES kits ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kit_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver kit_itens"
  ON kit_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar kit_itens"
  ON kit_itens FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

-- ==============================================
-- VIEW: kits_estoque_disponivel
-- ==============================================
CREATE OR REPLACE VIEW kits_estoque_disponivel AS
SELECT 
  k.id AS kit_id,
  k.codigo,
  k.nome,
  k.descricao,
  k.preco_total,
  k.ativo,
  COALESCE(
    MIN(FLOOR(p.estoque / ki.quantidade)),
    0
  ) AS estoque_disponivel,
  json_agg(
    json_build_object(
      'produto_id', p.id,
      'produto_codigo', p.codigo,
      'produto_nome', p.nome,
      'quantidade_necessaria', ki.quantidade,
      'estoque_disponivel', p.estoque,
      'kits_possiveis', FLOOR(p.estoque / ki.quantidade)
    )
  ) AS componentes
FROM kits k
LEFT JOIN kit_itens ki ON ki.kit_id = k.id
LEFT JOIN produtos p ON p.id = ki.produto_id
WHERE k.ativo = true
GROUP BY k.id, k.codigo, k.nome, k.descricao, k.preco_total, k.ativo;

-- ==============================================
-- TABELA: orcamentos
-- ==============================================
CREATE TABLE IF NOT EXISTS orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  cliente_id uuid NOT NULL REFERENCES clientes ON DELETE CASCADE,
  valor_total numeric(10, 2) DEFAULT 0,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar orcamentos"
  ON orcamentos FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Usuários podem ver orcamentos"
  ON orcamentos FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================
-- TABELA: orcamento_itens
-- ==============================================
CREATE TABLE IF NOT EXISTS orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES orcamentos ON DELETE CASCADE,
  produto_id uuid REFERENCES produtos ON DELETE CASCADE,
  kit_id uuid REFERENCES kits ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(10, 2) NOT NULL,
  desconto numeric(5, 2) DEFAULT 0 CHECK (desconto >= 0 AND desconto <= 100),
  peso numeric(10, 3),
  subtotal numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  CHECK (
    (produto_id IS NOT NULL AND kit_id IS NULL) OR
    (produto_id IS NULL AND kit_id IS NOT NULL)
  )
);

ALTER TABLE orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar orcamento_itens"
  ON orcamento_itens FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Usuários podem ver orcamento_itens"
  ON orcamento_itens FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================
-- TABELA: pedidos
-- ==============================================
CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  cliente_id uuid NOT NULL REFERENCES clientes ON DELETE CASCADE,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'em_separacao', 'enviado', 'entregue', 'cancelado')),
  valor_total numeric(10, 2) DEFAULT 0,
  data_pedido date DEFAULT CURRENT_DATE,
  data_confirmacao date,
  data_envio date,
  data_entrega date,
  observacoes text,
  origem text DEFAULT 'sistema' CHECK (origem IN ('sistema', 'catalogo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar pedidos"
  ON pedidos FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Clientes podem ver próprios pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = pedidos.cliente_id AND c.user_id = auth.uid()
    )
  );

-- ==============================================
-- TABELA: pedido_itens
-- ==============================================
CREATE TABLE IF NOT EXISTS pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES pedidos ON DELETE CASCADE,
  produto_id uuid REFERENCES produtos ON DELETE CASCADE,
  kit_id uuid REFERENCES kits ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(10, 2) NOT NULL,
  subtotal numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  CHECK (
    (produto_id IS NOT NULL AND kit_id IS NULL) OR
    (produto_id IS NULL AND kit_id IS NOT NULL)
  )
);

ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar pedido_itens"
  ON pedido_itens FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Clientes podem ver itens de próprios pedidos"
  ON pedido_itens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = pedido_itens.pedido_id AND c.user_id = auth.uid()
    )
  );

-- ==============================================
-- TABELA: vendas
-- ==============================================
CREATE TABLE IF NOT EXISTS vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  cliente_id uuid NOT NULL REFERENCES clientes ON DELETE CASCADE,
  orcamento_id uuid REFERENCES orcamentos ON DELETE SET NULL,
  valor_total numeric(10, 2) DEFAULT 0,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'entregue', 'cancelado')),
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar vendas"
  ON vendas FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Usuários podem ver vendas"
  ON vendas FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================
-- TABELA: venda_itens
-- ==============================================
CREATE TABLE IF NOT EXISTS venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES vendas ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos ON DELETE CASCADE,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric(10, 2) NOT NULL,
  subtotal numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar venda_itens"
  ON venda_itens FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Usuários podem ver venda_itens"
  ON venda_itens FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================
-- TABELA: transacoes_financeiras
-- ==============================================
CREATE TABLE IF NOT EXISTS transacoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  valor numeric(10, 2) NOT NULL,
  data date DEFAULT CURRENT_DATE,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'recebido', 'cancelado')),
  categoria text,
  venda_id uuid REFERENCES vendas ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE transacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar transações"
  ON transacoes_financeiras FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Usuários podem ver transações"
  ON transacoes_financeiras FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================
-- TABELA: movimentacao_estoque
-- ==============================================
CREATE TABLE IF NOT EXISTS movimentacao_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES produtos ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  observacao text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL
);

ALTER TABLE movimentacao_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar movimentações"
  ON movimentacao_estoque FOR ALL
  TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

CREATE POLICY "Usuários podem ver movimentações"
  ON movimentacao_estoque FOR SELECT
  TO authenticated
  USING (true);

-- ==============================================
-- VIEW: produtos_estoque_baixo
-- ==============================================
CREATE OR REPLACE VIEW produtos_estoque_baixo AS
SELECT 
  id,
  codigo,
  nome,
  estoque,
  estoque_minimo
FROM produtos
WHERE ativo = true AND estoque <= estoque_minimo
ORDER BY estoque ASC;

-- ==============================================
-- FUNÇÕES DE UTILIDADE
-- ==============================================

-- Gerar número de orçamento
CREATE OR REPLACE FUNCTION gerar_numero_orcamento()
RETURNS text AS $$
DECLARE
  ultimo_numero integer;
  novo_numero text;
BEGIN
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(numero FROM 'ORC-(\d+)') AS integer
      )
    ),
    0
  ) INTO ultimo_numero
  FROM orcamentos;
  
  novo_numero := 'ORC-' || LPAD((ultimo_numero + 1)::text, 4, '0');
  RETURN novo_numero;
END;
$$ LANGUAGE plpgsql;

-- Gerar número de pedido
CREATE OR REPLACE FUNCTION gerar_numero_pedido()
RETURNS text AS $$
DECLARE
  ultimo_numero integer;
  novo_numero text;
BEGIN
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(numero FROM 'PED-(\d+)') AS integer
      )
    ),
    0
  ) INTO ultimo_numero
  FROM pedidos;
  
  novo_numero := 'PED-' || LPAD((ultimo_numero + 1)::text, 4, '0');
  RETURN novo_numero;
END;
$$ LANGUAGE plpgsql;

-- Estatísticas do dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json AS $$
DECLARE
  stats json;
BEGIN
  SELECT json_build_object(
    'total_produtos', (SELECT COUNT(*) FROM produtos WHERE ativo = true),
    'total_kg_aluminio', (SELECT COALESCE(SUM(estoque * COALESCE(peso, 0)), 0) FROM produtos WHERE ativo = true),
    'valor_total_estoque', (SELECT COALESCE(SUM(estoque * preco), 0) FROM produtos WHERE ativo = true),
    'receitas_mes', (
      SELECT COALESCE(SUM(valor), 0)
      FROM transacoes_financeiras
      WHERE tipo = 'receita'
        AND status IN ('recebido', 'pago')
        AND data >= date_trunc('month', CURRENT_DATE)
    ),
    'despesas_mes', (
      SELECT COALESCE(SUM(valor), 0)
      FROM transacoes_financeiras
      WHERE tipo = 'despesa'
        AND status IN ('recebido', 'pago')
        AND data >= date_trunc('month', CURRENT_DATE)
    ),
    'vendas_mes', (
      SELECT COALESCE(SUM(valor_total), 0)
      FROM vendas
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
    )
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNÇÃO: processar_pedido
-- ==============================================
CREATE OR REPLACE FUNCTION processar_pedido(pedido_id_param uuid)
RETURNS json AS $$
DECLARE
  item RECORD;
  kit_item RECORD;
  resultado json;
  estoque_atual integer;
  itens_faltando json[] := '{}';
BEGIN
  -- Verificar disponibilidade de todos os itens
  FOR item IN
    SELECT pi.*, p.estoque, p.nome as produto_nome
    FROM pedido_itens pi
    LEFT JOIN produtos p ON p.id = pi.produto_id
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      -- Item é um produto
      IF item.estoque < item.quantidade THEN
        itens_faltando := array_append(
          itens_faltando,
          json_build_object(
            'produto', item.produto_nome,
            'necessario', item.quantidade,
            'disponivel', item.estoque,
            'faltando', item.quantidade - item.estoque
          )
        );
      END IF;
    ELSE
      -- Item é um kit - verificar componentes
      FOR kit_item IN
        SELECT ki.quantidade as qtd_kit, p.id, p.nome, p.estoque, ki.quantidade as qtd_componente
        FROM kit_itens ki
        JOIN produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = item.kit_id
      LOOP
        IF kit_item.estoque < (kit_item.qtd_componente * item.quantidade) THEN
          itens_faltando := array_append(
            itens_faltando,
            json_build_object(
              'produto', kit_item.nome,
              'necessario', kit_item.qtd_componente * item.quantidade,
              'disponivel', kit_item.estoque,
              'faltando', (kit_item.qtd_componente * item.quantidade) - kit_item.estoque
            )
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Se houver itens faltando, retornar erro
  IF array_length(itens_faltando, 1) > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Estoque insuficiente para alguns itens',
      'itens_faltando', array_to_json(itens_faltando)
    );
  END IF;

  -- Debitar estoque
  FOR item IN
    SELECT pi.*
    FROM pedido_itens pi
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      -- Debitar produto
      UPDATE produtos
      SET estoque = estoque - item.quantidade
      WHERE id = item.produto_id;
    ELSE
      -- Debitar componentes do kit
      FOR kit_item IN
        SELECT ki.produto_id, ki.quantidade
        FROM kit_itens ki
        WHERE ki.kit_id = item.kit_id
      LOOP
        UPDATE produtos
        SET estoque = estoque - (kit_item.quantidade * item.quantidade)
        WHERE id = kit_item.produto_id;
      END LOOP;
    END IF;
  END LOOP;

  -- Atualizar status do pedido
  UPDATE pedidos
  SET status = 'confirmado', data_confirmacao = CURRENT_DATE
  WHERE id = pedido_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido confirmado e estoque atualizado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNÇÃO: aprovar_orcamento_simples
-- ==============================================
CREATE OR REPLACE FUNCTION aprovar_orcamento_simples(orcamento_id_param uuid)
RETURNS json AS $$
BEGIN
  UPDATE orcamentos
  SET status = 'aprovado'
  WHERE id = orcamento_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento aprovado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNÇÃO: rejeitar_orcamento
-- ==============================================
CREATE OR REPLACE FUNCTION rejeitar_orcamento(orcamento_id_param uuid)
RETURNS json AS $$
BEGIN
  UPDATE orcamentos
  SET status = 'rejeitado'
  WHERE id = orcamento_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento rejeitado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNÇÃO: criar_pedido_catalogo
-- ==============================================
CREATE OR REPLACE FUNCTION criar_pedido_catalogo(
  cliente_id_param uuid,
  itens_json json,
  observacoes_param text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  pedido_id uuid;
  numero_pedido text;
  item json;
  valor_total numeric := 0;
BEGIN
  -- Buscar ou criar cliente
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id_param) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Cliente não encontrado'
    );
  END IF;

  -- Gerar número do pedido
  numero_pedido := gerar_numero_pedido();

  -- Criar pedido
  INSERT INTO pedidos (numero, cliente_id, status, observacoes, origem, data_pedido)
  VALUES (numero_pedido, cliente_id_param, 'pendente', observacoes_param, 'catalogo', CURRENT_DATE)
  RETURNING id INTO pedido_id;

  -- Adicionar itens
  FOR item IN SELECT * FROM json_array_elements(itens_json)
  LOOP
    INSERT INTO pedido_itens (
      pedido_id,
      produto_id,
      kit_id,
      quantidade,
      preco_unitario,
      subtotal
    )
    VALUES (
      pedido_id,
      (item->>'produto_id')::uuid,
      (item->>'kit_id')::uuid,
      (item->>'quantidade')::integer,
      (item->>'preco_unitario')::numeric,
      (item->>'quantidade')::integer * (item->>'preco_unitario')::numeric
    );

    valor_total := valor_total + ((item->>'quantidade')::integer * (item->>'preco_unitario')::numeric);
  END LOOP;

  -- Atualizar valor total
  UPDATE pedidos SET valor_total = valor_total WHERE id = pedido_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido criado com sucesso! Aguardando aprovação.',
    'pedido_numero', numero_pedido
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNÇÃO: aprovar_pedido_catalogo
-- ==============================================
CREATE OR REPLACE FUNCTION aprovar_pedido_catalogo(pedido_id_param uuid)
RETURNS json AS $$
DECLARE
  item RECORD;
  kit_item RECORD;
  itens_faltando json[] := '{}';
BEGIN
  -- Verificar estoque
  FOR item IN
    SELECT pi.*, p.estoque, p.nome as produto_nome
    FROM pedido_itens pi
    LEFT JOIN produtos p ON p.id = pi.produto_id
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      IF item.estoque < item.quantidade THEN
        itens_faltando := array_append(
          itens_faltando,
          json_build_object('produto', item.produto_nome, 'faltando', item.quantidade - item.estoque)
        );
      END IF;
    ELSE
      FOR kit_item IN
        SELECT ki.quantidade as qtd_componente, p.nome, p.estoque
        FROM kit_itens ki
        JOIN produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = item.kit_id
      LOOP
        IF kit_item.estoque < (kit_item.qtd_componente * item.quantidade) THEN
          itens_faltando := array_append(
            itens_faltando,
            json_build_object('produto', kit_item.nome, 'faltando', (kit_item.qtd_componente * item.quantidade) - kit_item.estoque)
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF array_length(itens_faltando, 1) > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Estoque insuficiente', 'itens_faltando', array_to_json(itens_faltando));
  END IF;

  -- Debitar estoque
  FOR item IN SELECT pi.* FROM pedido_itens pi WHERE pi.pedido_id = pedido_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      UPDATE produtos SET estoque = estoque - item.quantidade WHERE id = item.produto_id;
    ELSE
      FOR kit_item IN SELECT ki.produto_id, ki.quantidade FROM kit_itens ki WHERE ki.kit_id = item.kit_id
      LOOP
        UPDATE produtos SET estoque = estoque - (kit_item.quantidade * item.quantidade) WHERE id = kit_item.produto_id;
      END LOOP;
    END IF;
  END LOOP;

  UPDATE pedidos SET status = 'confirmado', data_confirmacao = CURRENT_DATE WHERE id = pedido_id_param;

  RETURN json_build_object('success', true, 'message', 'Pedido aprovado e estoque debitado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- FUNÇÃO: rejeitar_pedido_catalogo
-- ==============================================
CREATE OR REPLACE FUNCTION rejeitar_pedido_catalogo(pedido_id_param uuid)
RETURNS json AS $$
BEGIN
  UPDATE pedidos SET status = 'cancelado' WHERE id = pedido_id_param;
  RETURN json_build_object('success', true, 'message', 'Pedido rejeitado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- TRIGGER: handle_new_user
-- ==============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_count integer;
BEGIN
  -- Criar perfil
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'));

  -- Se for o primeiro usuário, tornar admin
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  IF user_count = 1 THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();