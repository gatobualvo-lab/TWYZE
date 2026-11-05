import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckEmailPanel, { inboxLinkFor, RESEND_COOLDOWN_SECONDS } from './CheckEmailPanel';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

const setup = (overrides: Partial<React.ComponentProps<typeof CheckEmailPanel>> = {}) => {
  const props = { email: 'wanjiku@gmail.com', onResend: vi.fn().mockResolvedValue(undefined), onChangeEmail: vi.fn(), onLogin: vi.fn(), ...overrides };
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<CheckEmailPanel {...props} />);
  return { props, user };
};

// One second at a time: each tick schedules the next one only after React has re-rendered.
const wait = async (seconds: number) => {
  for (let i = 0; i < seconds; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
};

describe('inboxLinkFor', () => {
  it('offers the web inbox for the common providers', () => {
    expect(inboxLinkFor('a@gmail.com')).toEqual({ label: 'Open Gmail', url: 'https://mail.google.com/' });
    expect(inboxLinkFor('a@Outlook.com')?.label).toBe('Open Outlook');
    expect(inboxLinkFor('a@yahoo.com')?.label).toBe('Open Yahoo Mail');
  });

  it('offers nothing for a company address or a mistyped one', () => {
    expect(inboxLinkFor('a@mybusiness.co.ke')).toBeNull();
    expect(inboxLinkFor('not-an-email')).toBeNull();
  });
});

describe('CheckEmailPanel', () => {
  it('says where the email went and how to open it', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Check your email' })).toHaveFocus();
    expect(screen.getByText('wanjiku@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Gmail/ })).toHaveAttribute('href', 'https://mail.google.com/');
    expect(screen.getByText(/spam or promotions/)).toBeInTheDocument();
  });

  it('waits a minute before the email can be sent again, then sends it and starts the wait over', async () => {
    const { props, user } = setup();
    const button = () => screen.getByRole('button', { name: /Send it again/ });
    expect(button()).toBeDisabled();
    expect(button()).toHaveTextContent(`Send it again in ${RESEND_COOLDOWN_SECONDS}s`);

    await wait(RESEND_COOLDOWN_SECONDS);
    expect(button()).toBeEnabled();

    await user.click(button());
    expect(props.onResend).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Sent again/)).toBeInTheDocument();
    expect(button()).toBeDisabled();
  });

  it('shows a readable message if it could not be sent, and lets them try again', async () => {
    const { user } = setup({ onResend: vi.fn().mockRejectedValue(new Error('Please wait a little before asking for another email.')) });
    await wait(RESEND_COOLDOWN_SECONDS);
    await user.click(screen.getByRole('button', { name: /Send it again/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait a little');
    expect(screen.getByRole('button', { name: /Send it again/ })).toBeEnabled();
  });

  it('offers a way back for a mistyped address and a way to log in', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: /Use a different email/ }));
    expect(props.onChangeEmail).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Log in/ }));
    expect(props.onLogin).toHaveBeenCalled();
  });
});
