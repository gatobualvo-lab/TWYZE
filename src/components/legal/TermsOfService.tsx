import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const TermsOfService: React.FC = () => (
  <LegalPageLayout title="Terms of Service" lastUpdated="August 20, 2026">
    <p>
      These Terms of Service ("Terms") govern your use of TrackWyze, a business management platform operated by
      [Company Legal Name], a company registered in Kenya under registration number [Registration Number], with its
      registered address at [Physical Address] ("TrackWyze", "we", "us"). By creating an account or using TrackWyze,
      you agree to these Terms.
    </p>

    <h2>1. What TrackWyze is</h2>
    <p>
      TrackWyze is software that helps small and growing businesses track sales, expenses, inventory, customers,
      suppliers, and related business records, and generates reports, documents (quotations/invoices/receipts), and
      optional AI-assisted insights from that data.
    </p>

    <h2>2. Your account</h2>
    <ul>
      <li>You must provide accurate information when creating an account and keep your login credentials confidential.</li>
      <li>You're responsible for all activity that happens under your account, including actions taken by team members you invite.</li>
      <li>You must be legally able to enter into a contract to use TrackWyze on behalf of a business.</li>
    </ul>

    <h2>3. Subscriptions and billing</h2>
    <ul>
      <li>Paid plans are billed as described at checkout. Prices are shown in Kenyan Shillings (KES).</li>
      <li>Payments are processed by Flutterwave; TrackWyze does not store your card or M-Pesa credentials.</li>
      <li>
        If a subscription is not renewed, your account enters a grace period (currently 5 days) with full access,
        after which it moves to a restricted, view-only state — your data is retained and never deleted for
        non-payment. See our <a href="/refund">Refund Policy</a> for details on cancellations and refunds.
      </li>
    </ul>

    <h2>4. Your data</h2>
    <p>
      You retain ownership of all business data you enter into TrackWyze (sales records, customer information,
      inventory, etc.). You're responsible for the accuracy of that data and for having the right to store any
      customer/supplier information you enter. See our <a href="/privacy">Privacy Policy</a> for how we handle and
      protect that data, including our use of Supabase (hosting/database) and, where you enable it, Anthropic's
      Claude API (AI Business Assistant) to process it.
    </p>

    <h2>5. Acceptable use</h2>
    <p>You agree not to use TrackWyze to:</p>
    <ul>
      <li>Store or process data you don't have the right to store (e.g. data belonging to someone else's business without authorization).</li>
      <li>Attempt to access another business's data, bypass rate limits, or interfere with the platform's normal operation.</li>
      <li>Use the platform for any unlawful purpose.</li>
    </ul>

    <h2>6. Team accounts</h2>
    <p>
      If you invite team members to your account, you're responsible for the permissions you grant them and for
      removing access when appropriate. Team members' access to your business data is governed by the permissions
      you set.
    </p>

    <h2>7. Termination</h2>
    <p>
      You may stop using TrackWyze at any time. We may suspend or terminate accounts that violate these Terms or the
      acceptable use section above. On termination, we'll retain your data for a reasonable period in case you wish
      to export it or reactivate, then delete it in line with our data retention practices [specify retention period].
    </p>

    <h2>8. Disclaimers and limitation of liability</h2>
    <p>
      TrackWyze is provided "as is." We work to keep the service accurate and available, but we don't guarantee it
      will be error-free or uninterrupted. AI-generated content (from the AI Business Assistant) is provided for
      informational purposes and should not be your sole basis for financial or business decisions — see the
      AI-specific notes in our Privacy Policy. To the maximum extent permitted by Kenyan law, [Company Legal Name]'s
      liability for any claim relating to TrackWyze is limited to the amount you paid us in the 12 months before the
      claim arose.
    </p>

    <h2>9. Changes to these Terms</h2>
    <p>
      We may update these Terms from time to time. We'll notify you of material changes (e.g. by email or an in-app
      notice) before they take effect.
    </p>

    <h2>10. Contact</h2>
    <p>
      Questions about these Terms: [support email]. Governing law: these Terms are governed by the laws of Kenya.
    </p>
  </LegalPageLayout>
);

export default TermsOfService;
