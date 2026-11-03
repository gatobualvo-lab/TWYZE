import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const guide = vi.hoisted(() => ({ askGuide: vi.fn(), submitGuideFeedback: vi.fn() }));
vi.mock('../../services/helpAssistant/helpAssistantService', async () => {
  class GuideError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  }
  return { askGuide: guide.askGuide, submitGuideFeedback: guide.submitGuideFeedback, GuideError };
});
vi.mock('../../lib/analytics', () => ({ trackEvent: vi.fn() }));

import FloatingHelp, { SUPPORT_WHATSAPP_URL } from './FloatingHelp';
import { GuideError } from '../../services/helpAssistant/helpAssistantService';

const LABELS: Record<string, string> = { 'add-sale': 'Add Sale', inventory: 'Inventory', advisor: 'Business Advisor' };

function setup(props: Partial<React.ComponentProps<typeof FloatingHelp>> = {}) {
  const onNavigate = vi.fn();
  const view = render(
    <FloatingHelp onNavigate={onNavigate} activeTab="dashboard" isPhone={false} labelFor={(id) => LABELS[id]} {...props} />
  );
  return { onNavigate, ...view };
}

const openGuide = async () => userEvent.click(screen.getByRole('button', { name: /Open the TrackWyze Guide/ }));

beforeEach(() => {
  vi.clearAllMocks();
  guide.submitGuideFeedback.mockResolvedValue(undefined);
  sessionStorage.clear();
});

describe('FloatingHelp', () => {
  it('is a floating Help button that opens the Guide', async () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openGuide();
    const dialog = screen.getByRole('dialog', { name: 'TrackWyze Guide' });
    expect(dialog).toHaveTextContent("I'm the TrackWyze Guide");
    expect(dialog).toHaveTextContent("I can't see your sales or stock");
    expect(screen.getByLabelText('Ask the Guide a question')).toHaveFocus();
  });

  it('says plainly that it is not the Business Advisor, and points to it', async () => {
    const { onNavigate } = setup();
    await openGuide();
    await userEvent.click(screen.getByRole('button', { name: 'ask the Business Advisor' }));
    expect(onNavigate).toHaveBeenCalledWith('advisor');
  });

  it('suggests questions that fit the page being viewed', async () => {
    setup({ activeTab: 'documents-invoices' });
    await openGuide();
    expect(screen.getByRole('button', { name: 'How do I add a discount to an invoice?' })).toBeInTheDocument();
  });

  it('asks the question, shows the answer and offers the page, never sending business data', async () => {
    guide.askGuide.mockResolvedValue({ reply: 'Open Add Sale and pick the product.', pages: ['add-sale', 'not-a-page-for-you'], needsHuman: false });
    const { onNavigate } = setup({ activeTab: 'inventory' });
    await openGuide();
    await userEvent.click(screen.getByRole('button', { name: 'How do I add a new category?' }));

    await screen.findByText('Open Add Sale and pick the product.');
    expect(guide.askGuide).toHaveBeenCalledWith(
      [{ role: 'user', content: 'How do I add a new category?' }],
      { tab: 'inventory', tier: 'business' } // no provider in the test, so the open default
    );
    // only pages this person can open get a button
    expect(screen.queryByText(/not-a-page-for-you/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Open Add Sale/ }));
    expect(onNavigate).toHaveBeenCalledWith('add-sale');
  });

  it('on a phone, opening a page closes the sheet so the page can be seen', async () => {
    guide.askGuide.mockResolvedValue({ reply: 'Go here.', pages: ['inventory'], needsHuman: false });
    setup({ isPhone: true });
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'where is stock?{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: /Open Inventory/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the team on WhatsApp when the Guide asks for them', async () => {
    guide.askGuide.mockResolvedValue({ reply: 'That needs our team.', pages: [], needsHuman: true });
    setup({ userEmail: 'wanjiku@example.com', activeTab: 'inventory' });
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'I paid but my plan did not change{Enter}');
    const link = await screen.findByRole('link', { name: /Talk to our team on WhatsApp/ });
    expect(link.getAttribute('href')).toContain(`${SUPPORT_WHATSAPP_URL}?text=`);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(SUPPORT_WHATSAPP_URL).toBe('https://wa.me/254113476311');
    // the team sees who is asking, where, and what, without anyone retyping it
    const message = decodeURIComponent(link.getAttribute('href')!.split('?text=')[1]);
    expect(message).toContain('Email: wanjiku@example.com');
    expect(message).toContain('Plan: Business');
    expect(message).toContain('Page: Inventory');
    expect(message).toContain('My question: I paid but my plan did not change');
  });

  it('says it is an AI and can make mistakes', async () => {
    setup();
    await openGuide();
    const dialog = screen.getByRole('dialog', { name: 'TrackWyze Guide' });
    expect(dialog).toHaveTextContent('AI assistant');
    expect(dialog).toHaveTextContent("I'm an AI, so I can make mistakes");
    expect(dialog).toHaveTextContent('AI can make mistakes. Never share your password or M-Pesa PIN.');
  });

  it('lets the person rate an answer, once, and records only the question and answer', async () => {
    guide.askGuide.mockResolvedValue({ reply: 'Open Inventory.', pages: [], needsHuman: false });
    setup({ activeTab: 'inventory' });
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'where is stock?{Enter}');
    await screen.findByText('Open Inventory.');

    await userEvent.click(screen.getByRole('button', { name: 'Yes, this was helpful' }));
    expect(guide.submitGuideFeedback).toHaveBeenCalledWith({ rating: 'up', question: 'where is stock?', answer: 'Open Inventory.', page: 'inventory', tier: 'business' });
    expect(await screen.findByText('Thanks for the feedback.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No, this was not helpful' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Talk to our team on WhatsApp/ })).not.toBeInTheDocument();
  });

  it('a thumbs down offers the team', async () => {
    guide.askGuide.mockResolvedValue({ reply: 'Try the menu.', pages: [], needsHuman: false });
    setup();
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'how do I export?{Enter}');
    await screen.findByText('Try the menu.');
    await userEvent.click(screen.getByRole('button', { name: 'No, this was not helpful' }));
    expect(guide.submitGuideFeedback).toHaveBeenCalledWith(expect.objectContaining({ rating: 'down' }));
    const link = await screen.findByRole('link', { name: /Talk to our team on WhatsApp/ });
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('My question: how do I export?');
  });

  it('lets them try again if the rating could not be saved', async () => {
    guide.submitGuideFeedback.mockRejectedValueOnce(new Error('offline'));
    guide.askGuide.mockResolvedValue({ reply: 'An answer.', pages: [], needsHuman: false });
    setup();
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'hello{Enter}');
    await screen.findByText('An answer.');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, this was helpful' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Yes, this was helpful' })).toBeInTheDocument());
    expect(screen.queryByText('Thanks for the feedback.')).not.toBeInTheDocument();
  });

  it('does not ask for a rating on an error message', async () => {
    guide.askGuide.mockRejectedValue(new GuideError('unavailable', 'The Guide is not available right now.'));
    setup();
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'hello{Enter}');
    await screen.findByText('The Guide is not available right now.');
    expect(screen.queryByText('Was this helpful?')).not.toBeInTheDocument();
  });

  it('shows a clear message and the team link when something fails', async () => {
    guide.askGuide.mockRejectedValue(new GuideError('rate_limited', 'You have asked a lot of questions in a short time.'));
    setup();
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'hello{Enter}');
    await screen.findByText('You have asked a lot of questions in a short time.');
    expect(screen.getByRole('link', { name: /Talk to our team on WhatsApp/ })).toBeInTheDocument();
  });

  it('does not send an error message back as part of the conversation', async () => {
    guide.askGuide.mockRejectedValueOnce(new GuideError('unavailable', 'The Guide is not available right now.'));
    guide.askGuide.mockResolvedValueOnce({ reply: 'OK now.', pages: [], needsHuman: false });
    setup();
    await openGuide();
    const box = screen.getByLabelText('Ask the Guide a question');
    await userEvent.type(box, 'first{Enter}');
    await screen.findByText('The Guide is not available right now.');
    await userEvent.type(box, 'second{Enter}');
    await screen.findByText('OK now.');
    const history = guide.askGuide.mock.calls[1][0];
    expect(history.map((m: { content: string }) => m.content)).toEqual(['first', 'second']);
  });

  it('ignores empty messages and Shift+Enter, and Enter sends', async () => {
    guide.askGuide.mockResolvedValue({ reply: 'Sure.', pages: [], needsHuman: false });
    setup();
    await openGuide();
    const box = screen.getByLabelText('Ask the Guide a question');
    await userEvent.type(box, '   {Enter}');
    expect(guide.askGuide).not.toHaveBeenCalled();
    await userEvent.type(box, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(guide.askGuide).not.toHaveBeenCalled();
    await userEvent.type(box, '{Enter}');
    await waitFor(() => expect(guide.askGuide).toHaveBeenCalledTimes(1));
  });

  it('Escape closes it and gives focus back to the button', async () => {
    setup();
    await openGuide();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open the TrackWyze Guide/ })).toHaveFocus();
  });

  it('keeps the conversation while moving around the app, and "new chat" clears it', async () => {
    guide.askGuide.mockResolvedValue({ reply: 'Remembered answer.', pages: [], needsHuman: false });
    const { unmount } = setup();
    await openGuide();
    await userEvent.type(screen.getByLabelText('Ask the Guide a question'), 'remember me{Enter}');
    await screen.findByText('Remembered answer.');
    unmount();

    setup();
    await openGuide();
    expect(screen.getByText('Remembered answer.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start a new chat' }));
    expect(screen.queryByText('Remembered answer.')).not.toBeInTheDocument();
  });

  it('steps aside while the phone menu is open', async () => {
    const { rerender } = setup();
    await openGuide();
    rerender(<FloatingHelp onNavigate={vi.fn()} activeTab="dashboard" isPhone labelFor={() => undefined} hidden />);
    expect(screen.queryByRole('button', { name: /Open the TrackWyze Guide/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cannot be used to send more than 500 characters at a time', async () => {
    setup();
    await openGuide();
    expect(screen.getByLabelText('Ask the Guide a question')).toHaveAttribute('maxlength', '500');
  });
});
