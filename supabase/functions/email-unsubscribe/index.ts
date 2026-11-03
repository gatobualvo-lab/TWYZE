// Public: the address behind every "Unsubscribe" link and every mail app's Unsubscribe button.
// Nobody is logged in here, so everything is decided by the signed token in the link (see
// _shared/sendgrid.ts, unsubscribeLinks) and the work is done with the service key.
// Deploy with "Verify JWT" switched OFF. Needs the UNSUBSCRIBE_SECRET secret.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { handleUnsubscribe, type PreferenceStore } from '../_shared/emailPreferences.ts';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const store: PreferenceStore = {
    async isUnsubscribed(userId) {
      const { data: profile } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (!profile) return null;
      const { data } = await db.from('notification_preferences').select('emails_unsubscribed').eq('user_id', userId).maybeSingle();
      return data?.emails_unsubscribed === true;
    },
    async setUnsubscribed(userId, unsubscribed) {
      const stamp = new Date().toISOString();
      const { error } = await db.from('notification_preferences').upsert({
        user_id: userId,
        emails_unsubscribed: unsubscribed,
        emails_unsubscribed_at: unsubscribed ? stamp : null,
        email_consent_source: 'email-link',
        updated_at: stamp,
      });
      if (error) throw new Error(error.message);
    },
  };

  try {
    const result = await handleUnsubscribe(
      { method: req.method, url: req.url, text: () => req.text(), contentType: req.headers.get('content-type') },
      Deno.env.get('UNSUBSCRIBE_SECRET'),
      store
    );
    return json(result.body, result.status);
  } catch (err) {
    console.error('email-unsubscribe error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
