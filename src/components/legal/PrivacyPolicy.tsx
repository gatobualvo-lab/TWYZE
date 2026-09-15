import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PrivacyPolicy: React.FC = () => (
  <LegalPageLayout title="Privacy Policy" lastUpdated="August 20, 2026">
    <p>
      [Company Legal Name] ("TrackWyze", "we", "us") operates TrackWyze, a business management platform. This policy
      explains what data we collect, why, and how it's protected — for you as a TrackWyze account holder, and for the
      customer/supplier data you enter about your own business.
    </p>

    <h2>1. Data we collect</h2>
    <ul>
      <li><strong>Account data:</strong> your name, email, phone number, and password (stored securely, never in plain text).</li>
      <li><strong>Business data you enter:</strong> sales, expenses, inventory, customer records, supplier records, documents (quotations/invoices/receipts), and business goals.</li>
      <li><strong>Payment data:</strong> subscription payments are processed by Flutterwave — we store the amount, method, and a reference number, never your full card or M-Pesa details.</li>
      <li><strong>Usage data:</strong> basic technical information (device/browser type, error logs) to keep the service running reliably.</li>
    </ul>

    <h2>2. How we use your data</h2>
    <ul>
      <li>To provide the service — record your transactions, generate reports, and calculate the analytics you see (Health Score, Opportunity Center, etc).</li>
      <li>To communicate with you — welcome emails, payment confirmations, subscription renewal reminders, and support responses.</li>
      <li>To improve TrackWyze — aggregated, non-identifying usage patterns help us understand which features are useful.</li>
      <li>To keep the platform secure — detecting abuse, enforcing rate limits, and investigating suspicious activity.</li>
    </ul>

    <h2>3. The AI Business Assistant</h2>
    <p>
      If you use the AI Business Assistant, your question and a small, relevant excerpt of your business data (e.g.
      revenue and profit figures for a period, product/customer names relevant to your question) is sent to
      Anthropic (the maker of Claude) to generate a response. Anthropic does not have standing access to your
      database — only the specific data needed to answer that one question is sent, for that one request. This
      feature is off by default and only available to eligible paid accounts.
    </p>

    <h2>4. Who we share data with (sub-processors)</h2>
    <ul>
      <li><strong>Supabase</strong> — our database and hosting provider. All your business data is stored here.</li>
      <li><strong>Flutterwave</strong> — processes subscription payments.</li>
      <li><strong>Anthropic</strong> — processes AI Business Assistant questions, only when you use that feature.</li>
      <li><strong>SendGrid</strong> — sends transactional emails (welcome, payment confirmation, renewal reminders) on our behalf.</li>
      <li><strong>[Error monitoring provider, e.g. Sentry]</strong> — receives error reports to help us fix bugs; these reports may include technical details but are not used to build a profile of you.</li>
    </ul>
    <p>We do not sell your data or your customers' data to anyone, for any purpose.</p>

    <h2>5. Data protection and your rights</h2>
    <p>
      We process personal data in line with Kenya's Data Protection Act, 2019. You have the right to access, correct,
      or request deletion of your personal data, and to export your business data (via the in-app Data Export
      feature) at any time. [Company Legal Name]'s registration with the Office of the Data Protection Commissioner
      (ODPC): [registration number, once obtained]. To exercise these rights, contact [support/privacy email].
    </p>

    <h2>6. Data retention</h2>
    <p>
      We keep your data for as long as your account is active. If your account is closed, we retain your data for
      [retention period] in case you wish to reactivate, then delete it. Backups may persist for a limited additional
      period as part of our standard backup rotation.
    </p>

    <h2>7. Security</h2>
    <p>
      Your data is protected by database-level access controls that ensure your business's data is never visible to
      another business, encrypted connections (HTTPS) for all traffic, and rate limiting to prevent abuse. No system
      is perfectly secure, and we encourage you to use a strong, unique password.
    </p>

    <h2>8. Children</h2>
    <p>TrackWyze is intended for business use by adults and is not directed at children under 18.</p>

    <h2>9. Changes to this policy</h2>
    <p>We'll notify you of material changes to this policy before they take effect.</p>

    <h2>10. Contact</h2>
    <p>Questions about this policy or your data: [privacy/support email].</p>
  </LegalPageLayout>
);

export default PrivacyPolicy;
