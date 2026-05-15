export default function TermsScreen() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button onClick={() => window.history.back()} className="mb-6 text-sm text-gray-400 hover:text-black dark:hover:text-white font-semibold bg-transparent border-none cursor-pointer">← Back</button>
        <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: May 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-[15px] leading-relaxed">

          <p>
            Welcome to Yuto ("Platform", "we", "us"). By creating an account or using any part of the Yuto application
            at yuto.social, you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Platform.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">1. What Yuto Is</h2>
          <p>
            Yuto is a <strong>social coordination and technology platform</strong>. We provide a digital interface that enables
            users to organize group payments ("Splits"), social events ("Functions"), peer-to-peer transfers, and commerce
            ("Storefronts") using mobile money infrastructure.
          </p>
          <p>
            <strong>Yuto is not a bank, deposit-taking institution, microfinance institution, or licensed Payment Service Provider (PSP).</strong>{" "}
            We do not hold deposits, issue credit, provide investment services, or guarantee returns on any balance displayed
            within the application. We are a technology company providing a coordination layer.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">2. Payment Processing & Third-Party Services</h2>
          <p>
            All actual custody of funds, fiat currency processing, M-PESA STK push collections, B2C disbursements, and
            settlement operations are executed exclusively by our licensed payment processing partner,{" "}
            <strong>IntaSend Payments Limited</strong>, a Payment Service Provider licensed and regulated under the laws of Kenya.
          </p>
          <p>
            By initiating any top-up, withdrawal, payment, or payout through Yuto, you acknowledge and agree that:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are simultaneously bound by IntaSend's Terms of Service, Privacy Policy, and AML/KYC policies.</li>
            <li>IntaSend may independently verify your identity, flag transactions, or freeze funds in accordance with their regulatory obligations.</li>
            <li>Yuto has no control over M-PESA network availability, IntaSend processing times, or Safaricom STK push delivery.</li>
            <li>Transaction fees, if any, are determined by IntaSend and/or Safaricom and are not set by Yuto.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-3">3. Your Yuto Balance</h2>
          <p>
            The "Yuto Balance" displayed on your profile is a <strong>closed-loop digital ledger entry</strong> — a virtual
            representation of value. It is:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Not</strong> a bank deposit account.</li>
            <li><strong>Not</strong> insured by the Kenya Deposit Insurance Corporation (KDIC) or any government body.</li>
            <li><strong>Not</strong> interest-bearing. Your balance does not accrue interest or dividends.</li>
            <li>Redeemable only through the Platform's withdrawal mechanism (M-PESA B2C transfer via IntaSend), subject to availability and processing limits.</li>
          </ul>
          <p>
            Underlying funds corresponding to user balances are held in a regulated trust/escrow account maintained by
            IntaSend in accordance with their PSP license obligations. Yuto does not commingle user funds with operational funds.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">4. Prohibited Activities & Anti-Fraud Authority</h2>
          <p>You agree not to use Yuto to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Launder money, finance terrorism, or facilitate any illegal activity under Kenyan or international law.</li>
            <li>Create fraudulent Functions, Splits, or Storefronts to deceive other users or extract funds under false pretenses.</li>
            <li>Circumvent transaction limits, create multiple accounts, or manipulate the referral system.</li>
            <li>Sell prohibited goods or services (drugs, weapons, counterfeit items, stolen property).</li>
            <li>Harass, threaten, or abuse other users through any communication feature.</li>
          </ul>
          <p>
            <strong>Yuto reserves the absolute and unilateral right to:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Immediately freeze, suspend, or permanently terminate any account suspected of fraudulent or illegal activity.</li>
            <li>Reverse, cancel, or withhold any transaction without prior notice if fraud is suspected.</li>
            <li>Report suspicious activity to relevant Kenyan authorities including the Financial Reporting Centre (FRC), the Directorate of Criminal Investigations (DCI), or the Central Bank of Kenya (CBK).</li>
            <li>Cooperate fully with law enforcement investigations and provide user data pursuant to valid legal process.</li>
          </ul>
          <p>
            These actions may be taken at our sole discretion, without liability to the affected user, and without obligation
            to provide evidence or justification prior to action.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">5. User Responsibilities</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least 18 years old or the age of majority in your jurisdiction.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must provide accurate information. Impersonation of another person is prohibited.</li>
            <li>You acknowledge that peer-to-peer transactions (Splits, transfers, Function payments) are between users. Yuto is not a party to these transactions and is not liable for disputes between users.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-3">6. Functions, Splits & Storefronts</h2>
          <p>
            Hosts of Functions and operators of Storefronts are solely responsible for delivering the goods, services, or
            experiences they advertise. Yuto provides the coordination and payment infrastructure but does not guarantee
            delivery, quality, or fulfillment.
          </p>
          <p>
            Refunds for cancelled Functions are processed automatically to the attendee's Yuto Balance. Disputes regarding
            Storefront transactions should be resolved between buyer and seller. Yuto may intervene at its discretion but
            is not obligated to do so.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by Kenyan law, Yuto shall not be liable for:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Loss of funds due to user error, unauthorized account access, or sharing of credentials.</li>
            <li>Delays or failures in M-PESA processing, IntaSend downtime, or network outages.</li>
            <li>Actions taken by other users on the platform (scams, non-delivery, disputes).</li>
            <li>Any indirect, incidental, or consequential damages arising from use of the Platform.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-3">8. Privacy & Data</h2>
          <p>
            We collect and process personal data (username, phone number, transaction history) to operate the Platform.
            We do not sell personal data to third parties. Data may be shared with IntaSend for payment processing and
            with law enforcement pursuant to valid legal process. Full details are in our Privacy Policy.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">9. Modifications</h2>
          <p>
            We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance.
            Material changes will be communicated via in-app notification or push notification.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">10. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of the Republic of Kenya. Any disputes
            arising from these Terms or use of the Platform shall be subject to the exclusive jurisdiction of the courts
            of Kenya.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">11. Contact</h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <a href="mailto:support@yuto.social" className="text-blue-600 dark:text-blue-400 underline">support@yuto.social</a>.
          </p>

          <div className="mt-12 pt-6 border-t border-gray-200 dark:border-zinc-800">
            <p className="text-xs text-gray-400">
              Yuto is operated by Yuto Technologies. Payment processing services are provided by IntaSend Payments Limited,
              a licensed Payment Service Provider in Kenya.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
