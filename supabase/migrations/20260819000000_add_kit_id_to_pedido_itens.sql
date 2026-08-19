-- O código do catálogo público (sincronizado do kitsdobrasil) insere
-- kit_id em pedido_itens ao finalizar um pedido com kit no carrinho, mas
-- essa coluna nunca existiu aqui — dava "Could not find the 'kit_id'
-- column of 'pedido_itens' in the schema cache" e o pedido não era criado.
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS kit_id uuid REFERENCES public.kits(id);

-- produto_id era NOT NULL, o que impediria uma linha só-de-kit mesmo com
-- a coluna kit_id presente.
ALTER TABLE public.pedido_itens
  ALTER COLUMN produto_id DROP NOT NULL;
