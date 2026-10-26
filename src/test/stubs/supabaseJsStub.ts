// Stands in for `jsr:@supabase/supabase-js@2` (a Deno-only specifier) when
// edge-function files are imported by unit tests, which only exercise their
// pure helpers and never create a client.
export function createClient(): never {
  throw new Error('createClient is not available in unit tests');
}
