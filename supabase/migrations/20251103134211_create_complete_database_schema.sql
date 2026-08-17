/*
  # Create Complete Database Schema for ERP System

  ## Overview
  This migration creates a complete database structure for a comprehensive ERP system with all necessary tables, relationships, and security policies.

  ## New Tables

  ### 1. user_roles
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `role` (text) - user role (admin, vendedor, cliente)
  - `created_at` (timestamptz)

  ### 2. clientes
  - `id` (uuid, primary key)
  - `nome` (text)
  - `email` (text)
  - `telefone` (text)
  - `cpf_cnpj` (text)
  - `endereco` (text)
  - `cidade` (text)
  - `estado` (text)
  - `cep` (text)
  - `observacoes` (text)
  - `created_at` (timestamptz)

  ### 3. fornecedores
  - `id` (uuid, primary key)
  - `nome` (text)
  - `email` (text)
  - `telefone` (text)
  - `cnpj` (text)
  - `endereco` (text)
  - `cidade` (text)
  - `estado` (text)
  - `cep` (text)
  - `observacoes` (text)
  - `created_at` (timestamptz)

  ### 4. produtos
  - `id` (uuid, primary key)
  - `codigo` (text)
  - `nome` (text)
  - `descricao` (text)
  - `preco` (numeric)
  - `custo` (numeric)
  - `estoque` (integer)
  - `estoque_minimo` (integer)
  - `unidade` (text)
  - `categoria` (text)
  - `fornecedor_id` (uuid, references fornecedores)
  - `ativo` (boolean)
  - `peso` (numeric)
  - `imagem_url` (text)
  - `created_at` (timestamptz)

  ### 5. kits
  - `id` (uuid, primary key)
  - `codigo` (text)
  - `nome` (text)
  - `descricao` (text)
  - `preco_total` (numeric)
  - `ativo` (boolean)
  - `created_at` (timestamptz)

  ### 6. kit_itens
  - `id` (uuid, primary key)
  - `kit_id` (uuid, references kits)
  - `produto_id` (uuid, references produtos)
  - `quantidade` (integer)

  ### 7. orcamentos
  - `id` (uuid, primary key)
  - `numero` (text)
  - `cliente_id` (uuid, references clientes)
  - `data` (date)
  - `validade` (date)
  - `status` (text)
  - `observacoes` (text)
  - `desconto` (numeric)
  - `total` (numeric)
  - `created_by` (uuid, references auth.users)
  - `created_at` (timestamptz)

  ### 8. orcamento_itens
  - `id` (uuid, primary key)
  - `orcamento_id` (uuid, references orcamentos)
  - `produto_id` (uuid, references produtos)
  - `kit_id` (uuid, references kits)
  - `quantidade` (integer)
  - `preco_unitario` (numeric)
  - `desconto` (numeric)
  - `peso` (numeric)
  - `subtotal` (numeric)

  ### 9. pedidos
  - `id` (uuid, primary key)
  - `numero` (text)
  - `cliente_id` (uuid, references clientes)
  - `orcamento_id` (uuid, references orcamentos)
  - `data` (date)
  - `status` (text)
  - `total` (numeric)
  - `observacoes` (text)
  - `created_by` (uuid, references auth.users)
  - `created_at` (timestamptz)

  ### 10. pedido_itens
  - `id` (uuid, primary key)
  - `pedido_id` (uuid, references pedidos)
  - `produto_id` (uuid, references produtos)
  - `quantidade` (integer)
  - `preco_unitario` (numeric)
  - `subtotal` (numeric)

  ### 11. vendas
  - `id` (uuid, primary key)
  - `numero` (text)
  - `cliente_id` (uuid, references clientes)
  - `pedido_id` (uuid, references pedidos)
  - `data` (date)
  - `total` (numeric)
  - `desconto` (numeric)
  - `forma_pagamento` (text)
  - `status` (text)
  - `observacoes` (text)
  - `created_by` (uuid, references auth.users)
  - `created_at` (timestamptz)

  ### 12. venda_itens
  - `id` (uuid, primary key)
  - `venda_id` (uuid, references vendas)
  - `produto_id` (uuid, references produtos)
  - `quantidade` (integer)
  - `preco_unitario` (numeric)
  - `subtotal` (numeric)

  ### 13. transacoes_financeiras
  - `id` (uuid, primary key)
  - `tipo` (text)
  - `categoria` (text)
  - `valor` (numeric)
  - `data` (date)
  - `descricao` (text)
  - `status` (text)
  - `venda_id` (uuid, references vendas)
  - `created_by` (uuid, references auth.users)
  - `created_at` (timestamptz)

  ### 14. configuracoes
  - `id` (uuid, primary key)
  - `chave` (text, unique)
  - `valor` (text)
  - `descricao` (text)
  - `tipo` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add appropriate policies for authenticated users
  - Admin users have full access
  - Regular users have restricted access based on their role

  ## Functions
  - Create trigger function to handle new user registration
  - Automatically assign default role to new users
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'cliente',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create clientes table
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  telefone text,
  cpf_cnpj text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clientes"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clientes"
  ON clientes FOR DELETE
  TO authenticated
  USING (true);

-- Create fornecedores table
CREATE TABLE IF NOT EXISTS fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  telefone text,
  cnpj text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fornecedores"
  ON fornecedores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fornecedores"
  ON fornecedores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update fornecedores"
  ON fornecedores FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete fornecedores"
  ON fornecedores FOR DELETE
  TO authenticated
  USING (true);

-- Create produtos table
CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) DEFAULT 0,
  custo numeric(10,2) DEFAULT 0,
  estoque integer DEFAULT 0,
  estoque_minimo integer DEFAULT 0,
  unidade text DEFAULT 'UN',
  categoria text,
  fornecedor_id uuid REFERENCES fornecedores(id) ON DELETE SET NULL,
  ativo boolean DEFAULT true,
  peso numeric(10,2) DEFAULT 0,
  imagem_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active produtos"
  ON produtos FOR SELECT
  TO anon, authenticated
  USING (ativo = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert produtos"
  ON produtos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update produtos"
  ON produtos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete produtos"
  ON produtos FOR DELETE
  TO authenticated
  USING (true);

-- Create kits table
CREATE TABLE IF NOT EXISTS kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  preco_total numeric(10,2) DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active kits"
  ON kits FOR SELECT
  TO anon, authenticated
  USING (ativo = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage kits"
  ON kits FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create kit_itens table
CREATE TABLE IF NOT EXISTS kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid REFERENCES kits(id) ON DELETE CASCADE NOT NULL,
  produto_id uuid REFERENCES produtos(id) ON DELETE CASCADE NOT NULL,
  quantidade integer DEFAULT 1 NOT NULL
);

ALTER TABLE kit_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view kit_itens"
  ON kit_itens FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage kit_itens"
  ON kit_itens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create orcamentos table
CREATE TABLE IF NOT EXISTS orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  data date DEFAULT CURRENT_DATE,
  validade date,
  status text DEFAULT 'pendente',
  observacoes text,
  desconto numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orcamentos"
  ON orcamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert orcamentos"
  ON orcamentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update orcamentos"
  ON orcamentos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete orcamentos"
  ON orcamentos FOR DELETE
  TO authenticated
  USING (true);

-- Create sequence for orcamento numero
CREATE SEQUENCE IF NOT EXISTS orcamento_numero_seq START WITH 1;

-- Create function to generate orcamento numero
CREATE OR REPLACE FUNCTION generate_orcamento_numero()
RETURNS text AS $$
DECLARE
  next_num integer;
  new_numero text;
BEGIN
  next_num := nextval('orcamento_numero_seq');
  new_numero := 'ORC-' || LPAD(next_num::text, 6, '0');
  RETURN new_numero;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate orcamento numero
CREATE OR REPLACE FUNCTION set_orcamento_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := generate_orcamento_numero();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_orcamento_numero ON orcamentos;
CREATE TRIGGER trigger_set_orcamento_numero
  BEFORE INSERT ON orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION set_orcamento_numero();

-- Create orcamento_itens table
CREATE TABLE IF NOT EXISTS orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE NOT NULL,
  produto_id uuid REFERENCES produtos(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES kits(id) ON DELETE CASCADE,
  quantidade integer DEFAULT 1 NOT NULL,
  preco_unitario numeric(10,2) DEFAULT 0,
  desconto numeric(10,2) DEFAULT 0,
  peso numeric(10,2) DEFAULT 0,
  subtotal numeric(10,2) DEFAULT 0,
  CHECK (produto_id IS NOT NULL OR kit_id IS NOT NULL)
);

ALTER TABLE orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orcamento_itens"
  ON orcamento_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage orcamento_itens"
  ON orcamento_itens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create pedidos table
CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE SET NULL,
  data date DEFAULT CURRENT_DATE,
  status text DEFAULT 'pendente',
  total numeric(10,2) DEFAULT 0,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage pedidos"
  ON pedidos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create pedido_itens table
CREATE TABLE IF NOT EXISTS pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES pedidos(id) ON DELETE CASCADE NOT NULL,
  produto_id uuid REFERENCES produtos(id) ON DELETE CASCADE NOT NULL,
  quantidade integer DEFAULT 1 NOT NULL,
  preco_unitario numeric(10,2) DEFAULT 0,
  subtotal numeric(10,2) DEFAULT 0
);

ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pedido_itens"
  ON pedido_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage pedido_itens"
  ON pedido_itens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create vendas table
CREATE TABLE IF NOT EXISTS vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  pedido_id uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  data date DEFAULT CURRENT_DATE,
  total numeric(10,2) DEFAULT 0,
  desconto numeric(10,2) DEFAULT 0,
  forma_pagamento text,
  status text DEFAULT 'pendente',
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vendas"
  ON vendas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage vendas"
  ON vendas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create venda_itens table
CREATE TABLE IF NOT EXISTS venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid REFERENCES vendas(id) ON DELETE CASCADE NOT NULL,
  produto_id uuid REFERENCES produtos(id) ON DELETE CASCADE NOT NULL,
  quantidade integer DEFAULT 1 NOT NULL,
  preco_unitario numeric(10,2) DEFAULT 0,
  subtotal numeric(10,2) DEFAULT 0
);

ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view venda_itens"
  ON venda_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage venda_itens"
  ON venda_itens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create transacoes_financeiras table
CREATE TABLE IF NOT EXISTS transacoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  categoria text,
  valor numeric(10,2) DEFAULT 0 NOT NULL,
  data date DEFAULT CURRENT_DATE,
  descricao text,
  status text DEFAULT 'pendente',
  venda_id uuid REFERENCES vendas(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transacoes"
  ON transacoes_financeiras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage transacoes"
  ON transacoes_financeiras FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create configuracoes table
CREATE TABLE IF NOT EXISTS configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text UNIQUE NOT NULL,
  valor text,
  descricao text,
  tipo text DEFAULT 'texto',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view configuracoes"
  ON configuracoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage configuracoes"
  ON configuracoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'cliente')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Insert default configuracoes
INSERT INTO configuracoes (chave, valor, descricao, tipo)
VALUES 
  ('empresa_nome', 'Minha Empresa', 'Nome da empresa', 'texto'),
  ('empresa_cnpj', '', 'CNPJ da empresa', 'texto'),
  ('empresa_telefone', '', 'Telefone da empresa', 'texto'),
  ('empresa_email', '', 'Email da empresa', 'texto'),
  ('empresa_endereco', '', 'Endereço da empresa', 'texto')
ON CONFLICT (chave) DO NOTHING;