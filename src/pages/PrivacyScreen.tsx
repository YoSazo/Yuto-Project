export default function PrivacyScreen() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button onClick={() => window.history.back()} className="mb-6 text-sm text-gray-400 hover:text-black dark:hover:text-white font-semibold bg-transparent border-none cursor-pointer">← Back</button>
        <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: May 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          <h2 className="text-xl font-bold mt-8 mb-3">1. Information We Collect</h2>
          <p>
            When you create a Yuto account, we collect your username, display name, and optionally your phone number
            (for M-PESA integration). We also collect transaction data (amounts, timestamps, counterparties) to operate
            the payment service.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account data:</strong> Username, display name, avatar photo, phone number</li>
            <li><strong>Transaction data:</strong> Payment amounts, timestamps, sender/recipient identifiers, payment method</li>
            <li><strong>Device data:</strong> Device type, OS version, Bluetooth identifiers (for proximity transfers)</li>
            <li><strong>Usage data:</strong> App interactions, feature usage, error logs</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-3">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Process payments and transfers between users</li>
            <li>Verify your identity for M-PESA transactions</li>
            <li>Send you notifications about incoming payments and account activity</li>
            <li>Detect and prevent fraud, unauthorized access, and abuse</li>
            <li>Improve the app experience and fix bugs</li>
            <li>Comply with legal obligations and regulatory requirements</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-3">3. Bluetooth Data</h2>
          <p>
            Yuto uses Bluetooth Low Energy (BLE) to discover nearby users for proximity-based money transfers.
            Your device advertises a short identifier derived from your user ID. This identifier is only visible
            to other Yuto users within Bluetooth range (typically 10 meters). No location data is collected or stored
            from Bluetooth interactions.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">4. Data Sharing</h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>IntaSend:</strong> Our payment processor for M-PESA top-ups and withdrawals. They process your phone number and transaction amounts under their own privacy policy.</li>
            <li><strong>Law enforcement:</strong> Only when required by valid legal process (court order, subpoena).</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-3">5. Data Security</h2>
          <p>
            We protect your data with encryption in transit (HTTPS/TLS), encrypted storage, row-level security
            policies on our database, and bcrypt-hashed transaction PINs. Offline BLE transfers use HMAC-SHA256
            signatures to prevent forgery.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">6. Data Retention</h2>
          <p>
            We retain your account data and transaction history for as long as your account is active.
            If you delete your account, we permanently remove your profile, wallet balance, and personal data.
            Some transaction records may be retained in anonymized form for regulatory compliance (up to 7 years
            as required by Kenyan financial regulations).
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access:</strong> View all data we hold about you (available in your profile and transaction history)</li>
            <li><strong>Delete:</strong> Permanently delete your account and data from Settings → Delete Account</li>
            <li><strong>Correct:</strong> Update your profile information at any time</li>
            <li><strong>Restrict:</strong> Lock your wallet to prevent all outgoing transactions</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-3">8. Children's Privacy</h2>
          <p>
            Yuto is not intended for users under 18 years of age. We do not knowingly collect personal
            information from children. If we learn that we have collected data from a child under 18,
            we will delete that information promptly.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes
            via in-app notification. Continued use of Yuto after changes constitutes acceptance.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-3">10. Contact</h2>
          <p>
            For privacy questions or data requests, contact us at{" "}
            <a href="mailto:privacy@yuto.social" className="text-black dark:text-white font-semibold underline">
              privacy@yuto.social
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
