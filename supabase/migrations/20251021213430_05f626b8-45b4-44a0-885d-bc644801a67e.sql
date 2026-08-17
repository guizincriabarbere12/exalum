-- Create function to initialize stock when product is created
CREATE OR REPLACE FUNCTION initialize_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create stock entry with zero quantity when a new product is added
  INSERT INTO public.estoque (produto_id, quantidade, quantidade_minima)
  VALUES (NEW.id, 0, 10)
  ON CONFLICT (produto_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to initialize stock for new products
DROP TRIGGER IF EXISTS trigger_initialize_stock ON produtos;
CREATE TRIGGER trigger_initialize_stock
  AFTER INSERT ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION initialize_product_stock();

-- Add unique constraint on estoque.produto_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estoque_produto_id_key'
  ) THEN
    ALTER TABLE estoque ADD CONSTRAINT estoque_produto_id_key UNIQUE (produto_id);
  END IF;
END $$;