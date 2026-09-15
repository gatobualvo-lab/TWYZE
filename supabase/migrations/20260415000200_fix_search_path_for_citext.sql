/*
  # Add extensions schema to the default search_path

  ## Problem
  The prior migration (20260415000000) installed citext, but it landed in
  the `extensions` schema regardless of the SCHEMA clause requested — this
  project's platform pins extensions there. `extensions` is not on the
  default search_path (`"$user", public`), so the next migration's bare
  `citext`-typed variable in handle_new_user() fails to resolve at
  CREATE FUNCTION time (that resolution uses the session's ambient
  search_path, not the function's own `SET search_path` clause, which only
  applies once the function later executes).

  ## Fix
  Add `extensions` to the database's default search_path.
*/

DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path TO "$user", public, extensions, pg_temp',
    current_database()
  );
END $$;

SET search_path TO "$user", public, extensions, pg_temp;
