/*
# Add Nested Kit Support

This migration enables kits to contain other kits as sub-components (nested kits).

## Changes Made

1. Modified Columns
   - `kit_itens.produto_id`: Changed from NOT NULL to NULLABLE
     - Allows a kit item to reference either a product OR a sub-kit
   
2. New Columns
   - `kit_itens.sub_kit_id` (uuid, NULLABLE): Foreign key to kits.id
     - When set, this kit item references another kit as a sub-component
     - Uses ON DELETE CASCADE to remove kit items when sub-kit is deleted

3. Constraints
   - Check constraint `kit_item_must_have_reference`: Ensures each kit item has
     either a produto_id OR a sub_kit_id set (but not both null)

## Business Logic
- A kit component can now be either a product OR another kit (sub-kit)
- This allows building hierarchical kit structures
- Circular references must be prevented at application level

## Security
- Table already has RLS enabled
- Existing policies remain unchanged
*/

-- Make produto_id nullable to allow sub_kit_id as alternative
ALTER TABLE kit_itens ALTER COLUMN produto_id DROP NOT NULL;

-- Add sub_kit_id column for nested kit support
ALTER TABLE kit_itens 
ADD COLUMN IF NOT EXISTS sub_kit_id uuid REFERENCES kits(id) ON DELETE CASCADE;

-- Add check constraint: must have either produto_id or sub_kit_id
ALTER TABLE kit_itens 
ADD CONSTRAINT kit_item_must_have_reference 
CHECK (produto_id IS NOT NULL OR sub_kit_id IS NOT NULL);

-- Add index for sub_kit_id lookups
CREATE INDEX IF NOT EXISTS idx_kit_itens_sub_kit_id ON kit_itens(sub_kit_id);