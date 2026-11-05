import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  checkRateLimit: vi.fn(),
  checkLeakedPassword: vi.fn(),
}));

vi.mock('../utils/supabase', () => ({ supabase: { auth: { signUp: mocks.signUp, resend: mocks.resend, signInWithPassword: vi.fn() }, from: vi.fn() } }));
vi.mock('../utils/security', () => ({
  checkRateLimit: mocks.checkRateLimit,
  checkLeakedPassword: mocks.checkLeakedPassword,
  RATE_LIMIT_MESSAGE: 'Too many attempts',
  LEAKED_PASSWORD_MESSAGE: 'That password has been leaked',
}));
vi.mock('../services/email/emailService', () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock('../lib/analytics', () => ({ trackEvent: vi.fn() }));

import EnhancedAuthScreen from './EnhancedAuthScreen';
import { TERMS_VERSION } from '../constants/legal';

const setup = () => render(<MemoryRouter><EnhancedAuthScreen /></MemoryRouter>);

async function openSignup() {
  await userEvent.click(screen.getAllByRole('button', { name: 'Sign Up' })[0]);
}

async function fillAccountStep() {
  await userEvent.type(screen.getByLabelText('Full name'), 'Wanjiku Mwangi');
  await userEvent.type(screen.getByLabelText('Email address'), 'wanjiku@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'a-long-password');
}

async function fillBusinessStep(age: string) {
  await userEvent.selectOptions(screen.getByLabelText('What kind of business is it?'), 'retail');
  const referral = screen.getByLabelText('How did you hear about Trackwyze?') as HTMLSelectElement;
  await userEvent.selectOptions(referral, referral.options[1].value);
  await userEvent.click(screen.getByLabelText(age));
}

beforeEach(() => {
  vi.clearAllMocks();
  // The toast container asks the browser about reduced motion; the test environment has no such thing.
  window.matchMedia = window.matchMedia || ((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() })) as unknown as typeof window.matchMedia;
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.checkLeakedPassword.mockResolvedValue(false);
  mocks.signUp.mockResolvedValue({ data: { session: null, user: { identities: [{ id: '1' }] } }, error: null });
  mocks.resend.mockResolvedValue({ error: null });
});

describe('signup', () => {
  // Each test types through a whole form, which is slow when the whole suite is running at once.
  vi.setConfig({ testTimeout: 20000 });

  it('starts with just the account: name, email and password (no confirm field)', async () => {
    setup();
    await openSignup();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Confirm password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('What kind of business is it?')).not.toBeInTheDocument();
  });

  it('does not move on until the account details are valid', async () => {
    setup();
    await openSignup();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Full name is required');
    await userEvent.type(screen.getByLabelText('Full name'), 'Wanjiku');
    await userEvent.type(screen.getByLabelText('Email address'), 'wanjiku@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('shows the business step next, and Back keeps what was typed', async () => {
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About your business' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Full name')).toHaveValue('Wanjiku Mwangi');
    expect(screen.getByLabelText('Email address')).toHaveValue('wanjiku@example.com');
  });

  it('refuses under 18 with a clear message and never calls signup', async () => {
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await fillBusinessStep('Under 18');
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('aged 18 and above');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('asks for the age group before creating the account', async () => {
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.selectOptions(screen.getByLabelText('What kind of business is it?'), 'retail');
    const referral = screen.getByLabelText('How did you hear about Trackwyze?') as HTMLSelectElement;
    await userEvent.selectOptions(referral, referral.options[1].value);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please tick your age group');
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('creates the account with the age group and the email choice', async () => {
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.selectOptions(screen.getByLabelText('What kind of business is it?'), 'retail');
    const referral = screen.getByLabelText('How did you hear about Trackwyze?') as HTMLSelectElement;
    await userEvent.selectOptions(referral, referral.options[1].value);
    await userEvent.click(screen.getByLabelText('25 to 34'));
    await userEvent.click(screen.getByLabelText(/I agree to the/));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(mocks.signUp).toHaveBeenCalledTimes(1);
    const call = mocks.signUp.mock.calls[0][0];
    expect(call.email).toBe('wanjiku@example.com');
    expect(call.options.data).toMatchObject({ full_name: 'Wanjiku Mwangi', business_category: 'retail', age_group: '25_34', email_opt_in: false, terms_accepted: true, terms_version: TERMS_VERSION });
  });

  it('will not create the account until the Terms and Privacy Policy are agreed to', async () => {
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await fillBusinessStep('25 to 34');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('agree to the Terms of Service and Privacy Policy');
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  });

  it('after signup, tells the person to check their email and lets them send it again', async () => {
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await fillBusinessStep('25 to 34');
    await userEvent.click(screen.getByLabelText(/I agree to the/));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('wanjiku@example.com')).toBeInTheDocument();
    // the form is gone and the password is not kept
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send it again in/ })).toBeDisabled();
  });

  it('says so when the email already has an account (the answer Supabase gives is a user with no identities)', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { identities: [] } }, error: null });
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await fillBusinessStep('25 to 34');
    await userEvent.click(screen.getByLabelText(/I agree to the/));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This email is already registered. Please log in instead.');
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
  });

  it('lets the person go back and fix a mistyped email', async () => {
    setup();
    await openSignup();
    await fillAccountStep();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await fillBusinessStep('25 to 34');
    await userEvent.click(screen.getByLabelText(/I agree to the/));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('heading', { name: 'Check your email' });

    await userEvent.click(screen.getByRole('button', { name: /Use a different email/ }));
    expect(screen.getByLabelText('Email address')).toHaveValue('wanjiku@example.com');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('lets the person show and hide the password with a labelled button', async () => {
    setup();
    await openSignup();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});
