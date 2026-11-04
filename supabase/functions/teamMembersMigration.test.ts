import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Joining a team moves an account's whole data view onto another business, so only the invited
// person may do it. These checks fail if a later edit reopens the owner-writable membership hole.
const dir = resolve(__dirname, '../migrations');
const sql = readFileSync(resolve(dir, '20261108090000_lock_business_members_activation.sql'), 'utf8');
const squash = (s: string) => s.replace(/\s+/g, ' ');

describe('business_members activation lock', () => {
  it('only lets owners create pending, unclaimed invites', () => {
    const policy = squash(sql.slice(sql.indexOf('CREATE POLICY "business_members_insert"'), sql.indexOf(');', sql.indexOf('CREATE POLICY "business_members_insert"'))));
    expect(policy).toContain('owner_id = auth.uid()');
    expect(policy).toContain('member_id IS NULL');
    expect(policy).toContain("status = 'pending'");
    expect(policy).toContain('accepted_at IS NULL');
  });

  it('stops client roles changing who a membership belongs to or activating it', () => {
    expect(sql).toMatch(/BEFORE UPDATE ON public\.business_members/);
    for (const col of ['owner_id', 'member_id', 'invited_email', 'accepted_at']) {
      expect(sql).toMatch(new RegExp(`NEW\\.${col}\\s+IS DISTINCT FROM OLD\\.${col}`));
    }
    expect(sql).toContain("NEW.status <> 'revoked'");
  });

  it('removes the automatic claim and requires a confirmed email to accept one named invite', () => {
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.claim_pending_invite()');
    const accept = sql.slice(sql.indexOf('FUNCTION public.accept_team_invite'), sql.indexOf('REVOKE ALL ON FUNCTION public.accept_team_invite'));
    expect(accept).toContain('email_confirmed_at IS NOT NULL');
    expect(accept).toContain('WHERE id = p_invite_id');
    expect(accept).toContain('already_member');
  });

  it('is not undone by a later migration', () => {
    const later = readdirSync(dir).filter(f => f > '20261108090000_lock_business_members_activation.sql' && f.endsWith('.sql'));
    for (const file of later) {
      const text = readFileSync(resolve(dir, file), 'utf8');
      expect(text, file).not.toMatch(/business_members_insert|claim_pending_invite|trg_guard_business_members_update/);
    }
  });
});

describe('client never accepts invites on its own', () => {
  it('useBusinessRole does not call any accept or claim RPC', () => {
    const hook = readFileSync(resolve(__dirname, '../../src/services/team/useBusinessRole.ts'), 'utf8');
    expect(hook).not.toMatch(/acceptTeamInvite|claimPendingInvite|accept_team_invite|claim_pending_invite/);
  });
});
