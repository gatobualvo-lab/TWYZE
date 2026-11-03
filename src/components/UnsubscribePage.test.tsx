import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const service = vi.hoisted(() => ({
  checkEmailSubscription: vi.fn(),
  setEmailSubscription: vi.fn(),
}));
vi.mock('../services/email/unsubscribeService', () => service);

import UnsubscribePage from './UnsubscribePage';

const open = (query = '?u=11111111-2222-4333-8444-555555555555&t=abc') =>
  render(
    <MemoryRouter initialEntries={[`/unsubscribe${query}`]}>
      <UnsubscribePage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnsubscribePage', () => {
  it('only asks; opening the link does not unsubscribe anyone', async () => {
    service.checkEmailSubscription.mockResolvedValue({ kind: 'ok', subscribed: true });
    open();
    await screen.findByText('Unsubscribe from TrackWyze emails?');
    expect(service.setEmailSubscription).not.toHaveBeenCalled();
    expect(screen.getByText(/Payment receipts and notices about your account are still sent/)).toBeInTheDocument();
  });

  it('the button unsubscribes and confirms', async () => {
    service.checkEmailSubscription.mockResolvedValue({ kind: 'ok', subscribed: true });
    service.setEmailSubscription.mockResolvedValue({ kind: 'ok', subscribed: false });
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Unsubscribe/ }));
    await screen.findByText('You are unsubscribed');
    expect(service.setEmailSubscription).toHaveBeenCalledWith('11111111-2222-4333-8444-555555555555', 'abc', 'unsubscribe');
  });

  it('can be undone with Resubscribe', async () => {
    service.checkEmailSubscription.mockResolvedValue({ kind: 'ok', subscribed: false });
    service.setEmailSubscription.mockResolvedValue({ kind: 'ok', subscribed: true });
    open();
    await screen.findByText('You are unsubscribed');
    await userEvent.click(screen.getByRole('button', { name: /resubscribe/i }));
    await screen.findByText('Unsubscribe from TrackWyze emails?');
    expect(service.setEmailSubscription).toHaveBeenCalledWith(expect.any(String), 'abc', 'resubscribe');
  });

  it('"Keep my emails" does not change anything', async () => {
    service.checkEmailSubscription.mockResolvedValue({ kind: 'ok', subscribed: true });
    open();
    const keep = await screen.findByRole('link', { name: 'Keep my emails' });
    expect(keep).toHaveAttribute('href', '/');
    expect(service.setEmailSubscription).not.toHaveBeenCalled();
  });

  it('explains a link that is not valid', async () => {
    service.checkEmailSubscription.mockResolvedValue({ kind: 'invalid', message: 'This unsubscribe link is not valid.' });
    open();
    await screen.findByText('This link is not valid');
    expect(screen.getByRole('alert')).toHaveTextContent('This unsubscribe link is not valid.');
    expect(screen.getByText(/Notification Center, then Settings/)).toBeInTheDocument();
  });

  it('an incomplete link does not even ask the server', async () => {
    open('?u=only-half');
    await screen.findByText('This link is not valid');
    expect(service.checkEmailSubscription).not.toHaveBeenCalled();
  });

  it('shows an error if saving fails, without claiming success', async () => {
    service.checkEmailSubscription.mockResolvedValue({ kind: 'ok', subscribed: true });
    service.setEmailSubscription.mockResolvedValue({ kind: 'error', message: 'We could not reach TrackWyze.' });
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Unsubscribe/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('We could not reach TrackWyze.'));
    expect(screen.queryByText('You are unsubscribed')).not.toBeInTheDocument();
  });
});
