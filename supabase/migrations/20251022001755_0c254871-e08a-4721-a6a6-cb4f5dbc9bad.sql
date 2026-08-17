-- Criar tabela de configurações gerais da empresa
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_empresa text NOT NULL DEFAULT 'Minha Empresa',
  cnpj text,
  telefone text,
  email text,
  endereco text,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.configuracoes (nome_empresa) VALUES ('Minha Empresa') ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas para configurações
CREATE POLICY "Todos podem visualizar configurações"
  ON public.configuracoes FOR SELECT
  USING (true);

CREATE POLICY "Admins podem atualizar configurações"
  ON public.configuracoes FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem inserir configurações"
  ON public.configuracoes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Garantir que clientes tenham user_id para área do cliente
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);

-- Função para gerar número de orçamento automaticamente
CREATE OR REPLACE FUNCTION public.gerar_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  new_numero TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM orcamentos
  WHERE numero ~ '^ORC-[0-9]+$';
  
  new_numero := 'ORC-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_numero;
END;
$$;

-- Trigger para calcular total do orçamento
CREATE OR REPLACE FUNCTION public.calcular_total_orcamento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE orcamentos
  SET valor_total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM orcamento_itens
    WHERE orcamento_id = NEW.orcamento_id
  )
  WHERE id = NEW.orcamento_id;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_calcular_total_orcamento ON public.orcamento_itens;
CREATE TRIGGER trigger_calcular_total_orcamento
  AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_total_orcamento();