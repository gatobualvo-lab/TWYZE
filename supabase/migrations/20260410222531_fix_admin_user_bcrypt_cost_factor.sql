/*
  # Fix admin user SQL function to use bcrypt cost factor 10

  Supabase auth requires bcrypt cost factor 10. The previous function used the
  default gen_salt('bf') which produces cost 6. This fixes it to use cost 10.
*/

CREATE OR REPLACE FUNCTION create_admin_user_sql(
  p_id uuid,
  p_email text,
  p_password text,
  p_meta text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    aud,
    role
  ) VALUES (
    p_id,
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    p_meta::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  );
END;
$$;
