'use client'

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  UserCredential,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import React, { useEffect, useState, FormEvent } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth, db } from '../lib/firebase'

export default function Login(): React.ReactElement {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function mapAuthError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found') return 'No account found with this email.'
      if (code === 'auth/wrong-password') return 'Incorrect password.'
      if (code === 'auth/invalid-email') return 'Invalid email address.'
      if (code === 'auth/invalid-credential') return 'Invalid email or password.'
    }
    return 'Unable to sign in. Please try again.'
  }

  async function handleLogin(cred: UserCredential) {
    const userEmail = cred.user.email

    const ref = doc(db, 'users', cred.user.uid)
    const snap = await getDoc(ref)

    // Create profile if it doesn't exist (Google/Facebook signup)
    if (!snap.exists()) {
      let photoURL = ''

      if (cred.user.photoURL) {
        const providerId = cred.user.providerData[0]?.providerId
        if (providerId === 'google.com') {
          photoURL = cred.user.photoURL.replace('s96-c', 's400-c')
        } else if (providerId === 'facebook.com') {
          photoURL = cred.user.photoURL
        }
      }

      await setDoc(ref, {
        uid: cred.user.uid,
        fullName: cred.user.displayName || '',
        email: userEmail || '',
        phone: cred.user.phoneNumber || '',
        role: 'customer',
        provider: cred.user.providerData[0]?.providerId || 'unknown',
        photoURL: photoURL,
        createdAt: serverTimestamp(),
      })
    }

    const { role } = (snap.exists() ? snap.data() : { role: 'customer' }) as { role?: string }

    // Role-based redirect
    switch (role) {
      case 'customer':
        window.location.href = '/'
        break
      case 'RDC Staff':
        window.location.href = '/rdc'
        break
      case 'Logistics Team':
        window.location.href = '/logistics'
        break
      case 'HO Manager':
        window.location.href = '/manager'
        break
      case 'admin':
        window.location.href = '/admin'
        break
      default:
        window.location.href = '/'
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    try {
      setLoading(true)
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await handleLogin(cred)
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setError('')
    try {
      setLoading(true)
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      await handleLogin(cred)
    } catch (err) {
      console.error('Google sign-in error:', err)
      setError('Google sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function signInWithFacebook() {
    setError('')
    try {
      setLoading(true)
      const provider = new FacebookAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      await handleLogin(cred)
    } catch (err) {
      console.error('Facebook sign-in error:', err)
      setError('Facebook sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-8">
        {/* Main Container */}
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-sm text-gray-500">Sign in to your account</p>
          </div>

          {/* Form Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            {/* Social Login Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                <GoogleIcon />
                Sign in with Google
              </button>

              <button
                onClick={signInWithFacebook}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                <FacebookIcon />
                Sign in with Facebook
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition pr-20 text-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <a href="/forgot-password" className="text-sm text-cyan-600 hover:underline">
                  Forgot password?
                </a>
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
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Register Link */}
            <p className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <a href="/register" className="text-cyan-600 font-semibold hover:underline">
                Sign up
              </a>
            </p>
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

// Icons
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.3 0 6.3 1.1 8.6 3.2l6.4-6.4C34.9 2.5 29.8 0 24 0 14.6 0 6.4 5.4 2.6 13.2l7.5 5.8C12 13.1 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.4h12.7c-.5 3-2.2 5.6-4.8 7.4l7.4 5.7c4.3-4 6.8-9.9 6.8-16.6z"
      />
      <path
        fill="#FBBC05"
        d="M10.1 28.9c-.6-1.7-.9-3.6-.9-5.4s.3-3.7.9-5.4l-7.5-5.8C.9 15.6 0 19.7 0 24s.9 8.4 2.6 11.7l7.5-5.8z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 12-2.1 16-5.7l-7.4-5.7c-2 1.4-4.6 2.2-8.6 2.2-6.4 0-12-3.6-14.7-8.8l-7.5 5.8C6.4 42.6 14.6 48 24 48z"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M22.675 0h-21.35C.594 0 0 .593 0 1.326v21.348C0 23.406.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.894-4.788 4.66-4.788 1.325 0 2.462.099 2.793.142v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.762v2.31h3.588l-.467 3.622h-3.121V24h6.116c.73 0 1.323-.594 1.323-1.326V1.326C24 .593 23.406 0 22.675 0z" />
    </svg>
  )
}
