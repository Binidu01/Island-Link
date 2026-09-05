'use client'

import { sendPasswordResetEmail } from 'firebase/auth'
import React, { useState, FormEvent } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth } from '../lib/firebase'

export default function ForgotPassword(): React.ReactElement {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function mapAuthError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found') return 'No account found with this email.'
      if (code === 'auth/invalid-email') return 'Invalid email address.'
      if (code === 'auth/too-many-requests') return 'Too many requests. Please try again later.'
    }
    return 'Unable to send reset email. Please try again.'
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Please enter your email address.')
      return
    }

    try {
      setLoading(true)
      await sendPasswordResetEmail(auth, email, {
        url: 'http://localhost:3000/login',
        handleCodeInApp: false,
      })
      setSent(true)
    } catch (err) {
      console.error('Password reset error:', err)
      setError(mapAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <a href="/" className="inline-flex items-center justify-center gap-3 mb-2">
              <div className="h-14 w-14 rounded-2xl overflow-hidden flex items-center justify-center">
                <img
                  src="/favicon.png"
                  alt="IslandLink"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const parent = e.currentTarget.parentElement
                    if (parent) {
                      parent.innerHTML =
                        '<div class="h-14 w-14 rounded-2xl bg-linear-to-br from-orange-500 via-cyan-500 to-green-500 flex items-center justify-center font-black text-white text-2xl">IL</div>'
                    }
                  }}
                />
              </div>
            </a>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset your password</h1>
            <p className="text-sm text-gray-500">
              {sent
                ? 'Check your inbox for the reset link'
                : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          {/* Form Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            {sent ? (
              /* Success State */
              <div className="text-center">
                {/* Checkmark Icon */}
                <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="text-lg font-semibold text-gray-900 mb-2">Email sent!</h2>
                <p className="text-sm text-gray-500 mb-1">We've sent a password reset link to</p>
                <p className="text-sm font-medium text-gray-800 mb-6 break-all">{email}</p>

                <p className="text-xs text-gray-400 mb-6">
                  Didn't receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => {
                      setSent(false)
                      setEmail('')
                    }}
                    className="text-cyan-600 hover:underline font-medium"
                  >
                    try again
                  </button>
                  .
                </p>

                <a
                  href="/login"
                  className="block w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition shadow-sm text-center"
                >
                  Back to Sign In
                </a>
              </div>
            ) : (
              /* Form State */
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition text-black"
                    autoFocus
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

                {/* Back to Login */}
                <div className="text-center pt-1">
                  <a
                    href="/login"
                    className="text-sm text-cyan-600 hover:underline inline-flex items-center gap-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Sign In
                  </a>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-6">
            © {new Date().getFullYear()} IslandLink Smart Distribution Platform
          </p>
        </div>
      </div>
    </div>
  )
}
