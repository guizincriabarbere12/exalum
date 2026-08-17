-- Adicionar campo de localização ao produto
ALTER TABLE produtos ADD COLUMN localizacao text;

COMMENT ON COLUMN produtos.localizacao IS 'Localização física do perfil/produto dentro do galpão';