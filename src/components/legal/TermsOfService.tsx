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

    <h2>2. Current status: free testing phase</h2>
    <p>
      TrackWyze is currently in an active testing / early-access phase. While this notice appears on this page:
    </p>
    <ul>
      <li>
        Every feature currently available is provided <strong>free of charge</strong>. We are not collecting any
        subscription payments, and nothing you do in the app will result in a charge unless we explicitly launch
        paid plans and you separately choose to sign up for one after being notified in advance.
      </li>
      <li>
        Features, pricing, availability, and any part of the Service may be added, changed, limited, or discontinued
        at any time, with or without notice, as we continue actively developing and testing the product.
      </li>
      <li>
        The Service is provided on an "as is" and "as available" basis during this phase, without any warranty that
        it will be uninterrupted, error-free, or free of data loss.
      </li>
      <li>
        We recommend regularly exporting your data (via the in-app Data Export feature) as a precaution while the
        product is still being actively developed.
      </li>
    </ul>
    <p>
      Once we introduce paid subscriptions, we'll update these Terms and notify existing users before any billing
      begins — at that point, the "Subscriptions and billing" section below takes effect.
    </p>

    <h2>3. Your account</h2>
    <ul>
      <li>You must provide accurate information when creating an account and keep your login credentials confidential.</li>
      <li>You're responsible for all activity that happens under your account, including actions taken by team members you invite.</li>
      <li>You must be legally able to enter into a contract to use TrackWyze on behalf of a business.</li>
    </ul>

    <h2>4. Subscriptions and billing</h2>
    <p>
      <em>
        Not currently in effect — see Section 2 above. The terms below describe how billing will work once we
        launch paid plans; we'll notify existing users in advance before any charges begin.
      </em>
    </p>
    <ul>
      <li>Paid plans will be billed as described at checkout. Prices will be shown in Kenyan Shillings (KES).</li>
      <li>Payments will be processed by Flutterwave; TrackWyze will not store your card or M-Pesa credentials.</li>
      <li>
        We'll email you a reminder 3 days before your subscription ends. If it is not renewed by then, your account
        moves to the Free plan as soon as it expires — your data is retained and never deleted for non-payment,
        and you can renew at any time to get your paid features back. See our <a href="/refund">Refund Policy</a>
        for details on cancellations and refunds.
      </li>
    </ul>

    <h2>5. Your data</h2>
    <p>
      You retain ownership of all business data you enter into TrackWyze (sales records, customer information,
      inventory, etc.). You're responsible for the accuracy of that data and for having the right to store any
      customer/supplier information you enter. See our <a href="/privacy">Privacy Policy</a> for how we handle and
      protect that data, including our use of Supabase (hosting/database) and, where you enable it, Anthropic's
      Claude API (AI Business Assistant) to process it.
    </p>

    <h2>6. Acceptable use</h2>
    <p>You agree not to use TrackWyze to:</p>
    <ul>
      <li>Store or process data you don't have the right to store (e.g. data belonging to someone else's business without authorization).</li>
      <li>Attempt to access another business's data, bypass rate limits, or interfere with the platform's normal operation.</li>
      <li>Use the platform for any unlawful purpose.</li>
    </ul>

    <h2>7. Team accounts</h2>
    <p>
      If you invite team members to your account, you're responsible for the permissions you grant them and for
      removing access when appropriate. Team members' access to your business data is governed by the permissions
      you set.
    </p>

    <h2>8. Termination</h2>
    <p>
      You may stop using TrackWyze at any time. We may suspend or terminate accounts that violate these Terms or the
      acceptable use section above. We may also suspend or discontinue all or part of the Service, or any test
      account or environment, at any time during the free testing phase described in Section 2, with notice where
      practical. On termination, we'll retain your data for a reasonable period in case you wish to export it or
      reactivate, then delete it in line with our data retention practices [specify retention period].
    </p>

    <h2>9. Disclaimers and limitation of liability</h2>
    <p>
      TrackWyze is provided "as is" and "as available." We work to keep the service accurate and available, but we
      don't guarantee it will be error-free, uninterrupted, or free of data loss — this is especially true during
      the free testing phase described in Section 2. AI-generated content (from the AI Business Assistant) is
      provided for informational purposes and should not be your sole basis for financial or business decisions —
      see the AI-specific notes in our Privacy Policy.
    </p>
    <p>
      To the maximum extent permitted by Kenyan law, [Company Legal Name]'s total liability for any claim relating
      to TrackWyze is limited to the total amount you paid us in the 12 months before the claim arose. For as long
      as TrackWyze remains free to use as described in Section 2, this means [Company Legal Name] bears no monetary
      liability to you under this clause. Nothing in these Terms limits liability where doing so would be unlawful
      — for example, liability for fraud, or for death or personal injury caused by negligence.
    </p>

    <h2>10. Changes to these Terms</h2>
    <p>
      We may update these Terms from time to time. We'll notify you of material changes (e.g. by email or an in-app
      notice) before they take effect.
    </p>

    <h2>11. Contact</h2>
    <p>
      Questions about these Terms: [support email]. Governing law: these Terms are governed by the laws of Kenya.
    </p>
  </LegalPageLayout>
);

export default TermsOfService;
