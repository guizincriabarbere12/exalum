-- Add foto_url column to conferencia_baixas for storing conference photos
ALTER TABLE conferencia_baixas ADD COLUMN IF NOT EXISTS foto_url text;

-- Add qr_code_data column to produtos for storing QR code data
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS qr_code_data text;
