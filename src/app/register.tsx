'use client'

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { auth, db } from '../lib/firebase'

export default function Register() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const isValid =
    form.fullName.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.phone.trim().length >= 9 &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword &&
    form.acceptTerms

  function updateField(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function signUpWithProvider(provider: GoogleAuthProvider | FacebookAuthProvider) {
    setLoading(true)
    setError('')
    try {
      const cred: UserCredential = await signInWithPopup(auth, provider)
      const user = cred.user
      const ref = doc(db, 'users', user.uid)
      const snap = await getDoc(ref)

      if (!snap.exists()) {
        let fullName = user.displayName || ''
        let email = user.email || ''
        let phone = user.phoneNumber || ''
        let photoURL = ''
        let providerName = ''

        if (provider instanceof GoogleAuthProvider) {
          providerName = 'google'
          if (user.photoURL) {
            photoURL = user.photoURL.replace('s96-c', 's400-c')
          }
        } else if (provider instanceof FacebookAuthProvider) {
          providerName = 'facebook'
          const fbData = user.providerData.find((p) => p.providerId === 'facebook.com')

          if (fbData) {
            fullName = fbData.displayName || fullName
            email = fbData.email || email
            if (fbData.photoURL) {
              photoURL = fbData.photoURL
            }
          }

          if (!photoURL && user.photoURL) {
            photoURL = user.photoURL
          }

          if (photoURL && photoURL.includes('graph.facebook.com')) {
            photoURL = photoURL.replace(/type=\w+/, 'type=large')
          }
        }

        await setDoc(ref, {
          uid: user.uid,
          fullName: fullName,
          email: email,
          phone: phone,
          role: 'customer',
          provider: providerName,
          photoURL: photoURL,
          createdAt: serverTimestamp(),
        })
      }

      window.location.href = '/'
    } catch (err) {
      console.error('Sign up error:', err)
      setError(
        provider instanceof GoogleAuthProvider
          ? 'Google sign up failed. Please try again.'
          : 'Facebook sign up failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function signUpWithGoogle() {
    await signUpWithProvider(new GoogleAuthProvider())
  }

  async function signUpWithFacebook() {
    await signUpWithProvider(new FacebookAuthProvider())
  }

  async function onSubmit(e: any) {
    e.preventDefault()
    setError('')
    if (!isValid) return

    try {
      setLoading(true)
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)

      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        role: 'customer',
        provider: 'password',
        photoURL: '',
        createdAt: serverTimestamp(),
      })

      window.location.href = '/login'
    } catch (err) {
      console.error(err)
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-8">
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500">Sign up to start shopping</p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={signUpWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              <GoogleIcon />
              Sign up with Google
            </button>

            <button
              onClick={signUpWithFacebook}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              <FacebookIcon />
              Sign up with Facebook
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition pr-20 text-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPw2 ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition pr-20 text-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2(!showPw2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPw2 ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => updateField('acceptTerms', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-600">
                I agree to IslandLink's{' '}
                <a href="/privacy" target="_blank" className="text-cyan-600 hover:underline">
                  Terms of Service
                </a>
              </span>
            </label>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-cyan-600 font-semibold hover:underline">
              Log in
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          By signing up, you agree to our terms and conditions
        </p>
      </div>
    </div>
  )
}

// GOOGLE ICON
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

// FACEBOOK ICON
function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M22.675 0h-21.35C.594 0 0 .593 0 1.326v21.348C0 23.406.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.894-4.788 4.66-4.788 1.325 0 2.462.099 2.793.142v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.762v2.31h3.588l-.467 3.622h-3.121V24h6.116c.73 0 1.323-.594 1.323-1.326V1.326C24 .593 23.406 0 22.675 0z" />
    </svg>
  )
}
