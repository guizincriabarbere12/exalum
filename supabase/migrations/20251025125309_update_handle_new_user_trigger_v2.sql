/*
  # Update handle_new_user Trigger to Support Admin Creation

  1. Changes
    - Drop trigger first, then function, then recreate both
    - Modify handle_new_user function to check for is_admin flag in metadata
    - If is_admin is true in raw_user_meta_data, assign admin role
    - Otherwise, assign regular user role as before
    
  2. Security
    - Only the first user gets admin automatically
    - Additional admins can be created by passing is_admin: true in metadata
*/

-- Drop trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate function with admin metadata support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_be_admin BOOLEAN;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'));
  
  -- Check if this should be an admin
  -- First user becomes admin automatically
  -- OR if is_admin flag is set in metadata
  should_be_admin := NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
                     OR (NEW.raw_user_meta_data->>'is_admin')::boolean = true;
  
  IF should_be_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
