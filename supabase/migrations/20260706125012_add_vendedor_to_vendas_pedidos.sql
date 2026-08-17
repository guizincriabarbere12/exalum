-- Add vendedor_id to vendas table
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id);

-- Add vendedor_id to pedidos table
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor_id ON vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_id ON pedidos(vendedor_id);

-- Enable RLS policies for vendedores table (ensure proper access)
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;

-- Policies for vendedores
CREATE POLICY "select_vendedores" ON vendedores FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_vendedores" ON vendedores FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_vendedores" ON vendedores FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_vendedores" ON vendedores FOR DELETE
  TO authenticated USING (true);