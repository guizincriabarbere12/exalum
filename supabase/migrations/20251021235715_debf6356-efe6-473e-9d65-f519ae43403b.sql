-- Fix invalid input syntax for quantidade_minima
-- This migration ensures the estoque table and related functions are properly configured

-- First, let's ensure any problematic data is cleaned up
-- Update any rows that might have issues (if table exists and has data)
DO $$
BEGIN
  -- Only run if estoque table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estoque') THEN
    -- Set a safe default for any problematic rows
    UPDATE public.estoque 
    SET quantidade_minima = 10 
    WHERE quantidade_minima IS NULL OR quantidade_minima < 0;
  END IF;
END $$;

-- Recreate the initialize_product_stock function with explicit type casting
CREATE OR REPLACE FUNCTION public.initialize_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create stock entry with zero quantity when a new product is added
  -- Use explicit numeric casting to prevent type errors
  INSERT INTO public.estoque (produto_id, quantidade, quantidade_minima)
  VALUES (NEW.id, 0::numeric, 10::numeric)
  ON CONFLICT (produto_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Add a constraint to ensure quantidade_minima is always a valid positive number
DO $$
BEGIN
  -- Drop constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'estoque_quantidade_minima_check'
  ) THEN
    ALTER TABLE public.estoque DROP CONSTRAINT estoque_quantidade_minima_check;
  END IF;
  
  -- Add the constraint
  ALTER TABLE public.estoque 
  ADD CONSTRAINT estoque_quantidade_minima_check 
  CHECK (quantidade_minima IS NULL OR quantidade_minima >= 0);
END $$;