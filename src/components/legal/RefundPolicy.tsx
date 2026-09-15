import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const RefundPolicy: React.FC = () => (
  <LegalPageLayout title="Refund Policy" lastUpdated="August 20, 2026">
    <p>
      This policy covers subscription payments made to TrackWyze via M-Pesa or card (processed by Flutterwave) or by
      manual payment submission.
    </p>

    <h2>1. Free trial</h2>
    <p>
      New accounts start on a free trial. You're never charged during the trial — cancel or simply stop using the
      account and nothing is billed.
    </p>

    <h2>2. Subscription charges</h2>
    <p>
      Paid plans are billed [monthly, in advance] in Kenyan Shillings (KES). Your subscription renews automatically
      unless you cancel before the renewal date.
    </p>

    <h2>3. Cancellations</h2>
    <p>
      You can cancel anytime from Account Settings or by contacting [support email]. Cancelling stops future billing
      — you keep full access until the end of the period you already paid for, then your account moves into the
      grace period described in our Terms of Service (view-only after 5 days without renewal). We never delete your
      data for non-payment.
    </p>

    <h2>4. Refunds</h2>
    <ul>
      <li><strong>Accidental/duplicate charges:</strong> full refund if you contact us within [7 days] of the charge.</li>
      <li><strong>Unused subscription time:</strong> [specify: pro-rated refund available on request / no refund for partial periods — decide your policy here].</li>
      <li><strong>Manually-submitted payments awaiting approval:</strong> if a manual payment is rejected by our team (e.g. the proof of payment doesn't match), no charge was ever applied — nothing to refund.</li>
    </ul>
    <p>
      To request a refund, contact [support email] with your account email and the transaction reference. We aim to
      respond within [X business days].
    </p>

    <h2>5. How refunds are issued</h2>
    <p>
      Refunds are returned to the original payment method via Flutterwave (M-Pesa or card) and may take [X–Y business
      days] to appear, depending on your provider.
    </p>

    <h2>6. Contact</h2>
    <p>Billing questions: [support/billing email].</p>
  </LegalPageLayout>
);

export default RefundPolicy;
