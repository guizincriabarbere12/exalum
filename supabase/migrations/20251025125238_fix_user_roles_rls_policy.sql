/*
  # Fix User Roles RLS Policy

  1. Changes
    - Drop existing restrictive INSERT policy for user_roles
    - Create new INSERT policy that allows:
      - Admins to create new admin accounts
      - System (via trigger) to create initial user roles during signup
    
  2. Security
    - Maintains admin-only control for creating admin accounts
    - Allows trigger function to assign roles to new users
    - Prevents regular users from granting themselves admin privileges
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

-- Create a new policy that allows both admins and the trigger function
CREATE POLICY "System and admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  -- Allow if current user is admin
  public.has_role(auth.uid(), 'admin'::app_role)
  -- OR if being inserted by a security definer function (like handle_new_user trigger)
  OR current_setting('role', true) = 'authenticator'
);
