'use client'

import CustomerNavbar from '../components/customernavbar'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-12 w-12 rounded-xl bg-linear-to-br from-orange-500 via-cyan-500 to-green-500 flex items-center justify-center shrink-0">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms & Conditions</h1>
              <p className="text-gray-600 leading-relaxed">
                These Terms govern your access to and use of the IslandLink Smart Distribution
                Platform, including all services, features, and transactions conducted through it.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-8">
          {/* 1. Introduction */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-cyan-100 to-cyan-200 text-cyan-700 text-sm font-bold">
                1
              </span>
              Introduction
            </h2>
            <div className="ml-10 space-y-3 text-gray-700 leading-relaxed">
              <p>
                Welcome to{' '}
                <strong className="text-gray-900">IslandLink Smart Distribution Platform</strong>{' '}
                ("IslandLink", "we", "us"). We operate a digital platform that enables users to
                access distribution, marketplace, and logistics-related services.
              </p>
              <p>
                By accessing or using the Platform, you agree to be legally bound by these Terms. If
                you do not agree, you must discontinue use of the Platform immediately.
              </p>
            </div>
          </section>

          {/* 2. User Accounts */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-orange-100 to-orange-200 text-orange-700 text-sm font-bold">
                2
              </span>
              User Accounts
            </h2>
            <div className="ml-10 space-y-3 text-gray-700 leading-relaxed">
              <p>
                Certain features require account registration. You are responsible for safeguarding
                your credentials and for all activity conducted through your account.
              </p>
              <p>
                We reserve the right to suspend or terminate accounts for security, compliance, or
                misuse reasons without prior notice.
              </p>
            </div>
          </section>

          {/* 3. Privacy */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-green-100 to-green-200 text-green-700 text-sm font-bold">
                3
              </span>
              Privacy & Data Protection
            </h2>
            <div className="ml-10 space-y-3 text-gray-700 leading-relaxed">
              <p>
                Personal data is handled in accordance with applicable Sri Lankan laws and internal
                data protection practices. By using the Platform, you consent to lawful data
                processing for operational and security purposes.
              </p>
            </div>
          </section>

          {/* 4. User Conduct */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-cyan-100 to-cyan-200 text-cyan-700 text-sm font-bold">
                4
              </span>
              User Conduct & Platform Rules
            </h2>

            <div className="ml-10">
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-linear-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Category</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Rules</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {/* Account Registration */}
                    <tr className="align-top hover:bg-gray-50 transition">
                      <td className="px-4 py-4 font-semibold text-gray-900 w-1/4">
                        Account Registration
                      </td>
                      <td className="px-4 py-4 text-gray-700">
                        <ul className="space-y-2 list-disc list-inside">
                          <li>
                            Users must maintain a single account and must not create multiple
                            accounts to gain unfair advantages or abuse promotions.
                          </li>
                          <li>
                            All registration details must be accurate, authentic, and owned by the
                            user.
                          </li>
                          <li>
                            Any attempt to bypass security controls, clone the application, or mask
                            activity is strictly prohibited.
                          </li>
                        </ul>
                      </td>
                    </tr>

                    {/* Transactions */}
                    <tr className="align-top hover:bg-gray-50 transition">
                      <td className="px-4 py-4 font-semibold text-gray-900">Transactions</td>
                      <td className="px-4 py-4 text-gray-700">
                        <ul className="space-y-2 list-disc list-inside">
                          <li>
                            All agreements and communications conducted through official IslandLink
                            channels are binding.
                          </li>
                          <li>
                            Fraudulent activity, including fake orders or misleading behavior, is
                            strictly prohibited.
                          </li>
                          <li>
                            All transactions must remain within the Platform. Offline payments or
                            redirection to external platforms are not permitted.
                          </li>
                          <li>
                            IslandLink is not responsible for transactions conducted outside the
                            Platform.
                          </li>
                          <li>
                            Users must provide accurate delivery details and follow official return
                            or dispute procedures if issues arise.
                          </li>
                        </ul>
                      </td>
                    </tr>

                    {/* Post-Transaction */}
                    <tr className="align-top hover:bg-gray-50 transition">
                      <td className="px-4 py-4 font-semibold text-gray-900">Post-Transaction</td>
                      <td className="px-4 py-4 text-gray-700">
                        <ul className="space-y-2 list-disc list-inside">
                          <li>
                            Feedback and reviews must be honest, factual, and relevant to the
                            transaction.
                          </li>
                          <li>Fake, misleading, abusive, or unlawful content is prohibited.</li>
                          <li>
                            Users must not initiate payment disputes if a refund has already been
                            processed.
                          </li>
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 5. Intellectual Property */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-orange-100 to-orange-200 text-orange-700 text-sm font-bold">
                5
              </span>
              Intellectual Property
            </h2>
            <div className="ml-10 space-y-3 text-gray-700 leading-relaxed">
              <p>
                All software, branding, content, and design elements on the Platform are owned by or
                licensed to IslandLink and protected by applicable intellectual property laws.
              </p>
            </div>
          </section>

          {/* 6. Limitation of Liability */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-green-100 to-green-200 text-green-700 text-sm font-bold">
                6
              </span>
              Limitation of Liability
            </h2>
            <div className="ml-10 space-y-3 text-gray-700 leading-relaxed">
              <p>
                The Platform is provided on an "as-is" basis. IslandLink shall not be liable for
                indirect, incidental, or consequential damages, including loss of data or business
                opportunities.
              </p>
            </div>
          </section>

          {/* 7. Governing Law */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-cyan-100 to-cyan-200 text-cyan-700 text-sm font-bold">
                7
              </span>
              Governing Law
            </h2>
            <div className="ml-10 space-y-3 text-gray-700 leading-relaxed">
              <p>
                These Terms are governed by the laws of the Democratic Socialist Republic of Sri
                Lanka. All disputes fall under the exclusive jurisdiction of Sri Lankan courts.
              </p>
            </div>
          </section>

          {/* 8. Contact */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-orange-100 to-orange-200 text-orange-700 text-sm font-bold">
                8
              </span>
              Contact
            </h2>
            <div className="ml-10 space-y-3 text-gray-700 leading-relaxed">
              <p>
                For legal or policy-related inquiries, please contact us through official
                communication channels provided on the Platform.
              </p>
            </div>
          </section>

          {/* Last Updated */}
          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              Last updated:{' '}
              {new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-500 mt-6 mb-4">
          © {new Date().getFullYear()} IslandLink Smart Distribution Platform
        </footer>
      </main>
    </div>
  )
}
