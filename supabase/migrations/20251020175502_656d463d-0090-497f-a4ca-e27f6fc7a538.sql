-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (CRITICAL: separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create fornecedores table
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  telefone TEXT,
  email TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clientes table
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT UNIQUE NOT NULL,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create produtos table
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT,
  liga TEXT,
  cor TEXT,
  unidade TEXT NOT NULL DEFAULT 'UN',
  preco_custo DECIMAL(10,2) DEFAULT 0,
  preco_venda DECIMAL(10,2) NOT NULL,
  peso DECIMAL(10,3),
  foto_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create estoque table
CREATE TABLE public.estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL DEFAULT 0,
  quantidade_minima DECIMAL(10,3) DEFAULT 10,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create movimentacao_estoque table
CREATE TABLE public.movimentacao_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade DECIMAL(10,3) NOT NULL,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orcamentos table
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'convertido')),
  valor_total DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orcamento_itens table
CREATE TABLE public.orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vendas table
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  orcamento_id UUID REFERENCES public.orcamentos(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'entregue', 'cancelado')),
  valor_total DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create venda_itens table
CREATE TABLE public.venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID REFERENCES public.vendas(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacao_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for fornecedores
CREATE POLICY "Authenticated users can view fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert fornecedores" ON public.fornecedores FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update fornecedores" ON public.fornecedores FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete fornecedores" ON public.fornecedores FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for clientes
CREATE POLICY "Authenticated users can view clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete clientes" ON public.clientes FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for produtos
CREATE POLICY "Authenticated users can view produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert produtos" ON public.produtos FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update produtos" ON public.produtos FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete produtos" ON public.produtos FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for estoque
CREATE POLICY "Authenticated users can view estoque" ON public.estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage estoque" ON public.estoque FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for movimentacao_estoque
CREATE POLICY "Authenticated users can view movimentacoes" ON public.movimentacao_estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert movimentacoes" ON public.movimentacao_estoque FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for orcamentos
CREATE POLICY "Authenticated users can view orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete orcamentos" ON public.orcamentos FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for orcamento_itens
CREATE POLICY "Authenticated users can view orcamento_itens" ON public.orcamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert orcamento_itens" ON public.orcamento_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orcamento_itens" ON public.orcamento_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete orcamento_itens" ON public.orcamento_itens FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for vendas
CREATE POLICY "Authenticated users can view vendas" ON public.vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert vendas" ON public.vendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update vendas" ON public.vendas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete vendas" ON public.vendas FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for venda_itens
CREATE POLICY "Authenticated users can view venda_itens" ON public.venda_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert venda_itens" ON public.venda_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update venda_itens" ON public.venda_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete venda_itens" ON public.venda_itens FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Trigger function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'));
  
  -- First user becomes admin, others become regular users
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estoque_updated_at BEFORE UPDATE ON public.estoque FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orcamentos_updated_at BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();