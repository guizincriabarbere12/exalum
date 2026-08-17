/*
  # Fix pedido_itens produto_id constraint
  
  1. Changes
    - Make produto_id nullable in pedido_itens table
    - This allows kits to be added to pedidos (kit_id filled, produto_id NULL)
  
  2. Validation
    - Add check constraint to ensure either produto_id OR kit_id is filled (not both, not neither)
*/

-- Remove NOT NULL constraint from produto_id
ALTER TABLE pedido_itens 
ALTER COLUMN produto_id DROP NOT NULL;

-- Add check constraint to ensure either produto_id or kit_id is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pedido_itens_produto_ou_kit_check'
  ) THEN
    ALTER TABLE pedido_itens
    ADD CONSTRAINT pedido_itens_produto_ou_kit_check 
    CHECK (
      (produto_id IS NOT NULL AND kit_id IS NULL) OR 
      (produto_id IS NULL AND kit_id IS NOT NULL)
    );
  END IF;
END $$;
