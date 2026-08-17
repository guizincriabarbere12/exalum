/*
# Fix movimentacoes_estoque: make usuario_id nullable

The `movimentacoes_estoque.usuario_id` column is NOT NULL, which causes inserts to fail
when the user ID is not available. This makes the column nullable so manual stock
adjustments can be recorded even without a user ID.
*/

ALTER TABLE movimentacoes_estoque ALTER COLUMN usuario_id DROP NOT NULL;
