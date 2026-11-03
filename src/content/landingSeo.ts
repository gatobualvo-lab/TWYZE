import { FREE_LIMITS, TIER_PRICES } from '../services/subscription/entitlements';

// Words on the landing page that people (and search engines) read. The prices and Free limits come from
// the app's own plan table, so the page cannot disagree with what the app does.

const kes = (amount: number) => `KES ${amount.toLocaleString('en-US')}`;

export interface Faq {
  question: string;
  answer: string;
}

export const LANDING_FAQS: Faq[] = [
  {
    question: 'What is Trackwyze?',
    answer:
      'Trackwyze is business management software for shops and small businesses in Kenya. You record sales, track stock, manage expenses, customers, suppliers and deliveries, create invoices, quotations and receipts, and see your real profit, all in one place.',
  },
  {
    question: 'How much does Trackwyze cost?',
    answer: `Your first month is free with every feature. After that you can keep using the Free plan for as long as you like, or choose Starter at ${kes(TIER_PRICES.starter)} a month or Business at ${kes(TIER_PRICES.business)} a month. No credit card is needed to start.`,
  },
  {
    question: 'What do I get on the Free plan?',
    answer: `The Free plan is free forever and includes up to ${FREE_LIMITS.salesPerMonth} sales a month, ${FREE_LIMITS.products} products and ${FREE_LIMITS.customers} customers for one user, with receipts, invoices and quotations, and expense tracking.`,
  },
  {
    question: 'Can I pay for Trackwyze with M-Pesa?',
    answer:
      'Yes. Choose a plan and Trackwyze sends an M-Pesa payment request (STK push) to your phone. You enter your PIN and your plan is activated. You can also pay by card or send proof of payment manually.',
  },
  {
    question: 'Does Trackwyze work on my phone?',
    answer:
      'Yes. Trackwyze runs in your browser on a phone, tablet or computer, stays in sync across them, and can be installed on your phone like an app.',
  },
  {
    question: 'Can I send invoices and receipts to my customers on WhatsApp?',
    answer:
      'Yes. You can create invoices, quotations and receipts with your own logo and colours, then print them, save them as PDF or share them with customers on WhatsApp.',
  },
];

export interface BusinessType {
  title: string;
  description: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    title: 'Retail shops and dukas',
    description: 'Record every sale, keep stock counts right and see which products make the most profit, from a corner shop to a supermarket.',
  },
  {
    title: 'Online and social media sellers',
    description: 'Track what you spend on adverts against what you sell, so you know whether Facebook, Instagram and TikTok ads really pay.',
  },
  {
    title: 'Wholesalers and distributors',
    description: 'Manage suppliers, vendor balances and deliveries, and chase the customers who still owe you.',
  },
  {
    title: 'Salons, workshops and service businesses',
    description: 'Send quotations and invoices, record payments and keep your expenses in order, with or without products to stock.',
  },
];

/** The FAQ in the form search engines read, so answers can show up directly in search results. */
export const faqStructuredData = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: LANDING_FAQS.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
});
