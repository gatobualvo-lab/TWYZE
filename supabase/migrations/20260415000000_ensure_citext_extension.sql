/*
  # Ensure citext is resolvable (search_path), not just installed

  ## Problem
  citext was never installed on this project (all three earlier
  `CREATE EXTENSION IF NOT EXISTS citext;` calls silently no-op'd). Creating
  it now lands it in the `extensions` schema regardless of an explicit
  `SCHEMA public` clause — this project's platform pins extensions there.
  `extensions` is not on the default search_path (`"$user", public`), and
  the next two migrations (20260416160437, 20260421222809) declare a bare
  `citext`-typed variable inside handle_new_user() with `SET search_path =
  public` on the function itself — which only controls the function's
  runtime search_path, not the search_path used to resolve types while the
  CREATE FUNCTION statement is being compiled. That resolution uses this
  session/database's ambient search_path, which needs `extensions` on it.

  ## Fix
  Install the extension (wherever the platform puts it), then add
  `extensions` to the database's default search_path so both this
  migration session and any future one can resolve it unqualified. This
  matches the search_path convention the codebase's own later migrations
  already use elsewhere in Supabase-managed projects.
*/

CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path TO "$user", public, extensions, pg_temp',
    current_database()
  );
END $$;

SET search_path TO "$user", public, extensions, pg_temp;
