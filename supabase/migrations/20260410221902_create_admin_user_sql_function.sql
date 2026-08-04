/*
  # Create admin user SQL helper function

  Creates a SECURITY DEFINER function that inserts directly into auth.users,
  bypassing the auth API limitation that causes "Database error creating new user".
  The existing on_auth_user_created trigger will automatically create the profile row.
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
SET search_path = public
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
    crypt(p_password, gen_salt('bf')),
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
