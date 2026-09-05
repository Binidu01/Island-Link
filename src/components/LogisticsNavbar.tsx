// components/LogisticsNavbar.tsx
'use client'

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { auth, db } from '../lib/firebase'

export default function LogisticsNavbar() {
  const [user, setUser] = useState<User | null>(null)
  const [userPhoto, setUserPhoto] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          // First set the Firebase Auth data as fallback
          setUserPhoto(currentUser.photoURL || '')
          setUserName(currentUser.displayName || currentUser.email?.split('@')[0] || 'Logistics')

          // Try to get more detailed data from Firestore
          const userDocRef = doc(db, 'users', currentUser.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
            // Set user role
            setUserRole(userData.role || 'Logistics Team')

            // Only update if we have better data from Firestore
            if (userData.photoURL && userData.photoURL !== '') {
              setUserPhoto(userData.photoURL)
            }
            if (userData.fullName && userData.fullName !== '') {
              setUserName(userData.fullName)
            } else if (userData.email && userData.email !== '') {
              setUserName(userData.email.split('@')[0])
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          // Keep the Firebase Auth data as fallback
          setUserRole('Logistics Team')
        }
      } else {
        setUserPhoto('')
        setUserName('')
        setUserRole('')
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  async function handleLogout() {
    try {
      await signOut(auth)
      setShowProfileMenu(false)
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Get user display name with fallbacks
  const getUserDisplayName = () => {
    if (userName && userName !== '') return userName
    if (user?.displayName) return user.displayName
    if (user?.email) return user.email.split('@')[0]
    return 'Logistics'
  }

  // Get user photo with fallbacks
  const getUserPhoto = () => {
    if (userPhoto && userPhoto !== '') return userPhoto
    if (user?.photoURL) return user.photoURL
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=random`
  }

  // Get role display name
  const getRoleDisplay = () => {
    if (userRole === 'Logistics Team') return 'Logistics Team'
    return userRole || 'Logistics'
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <a href="/logistics" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center group-hover:scale-105 transition">
              <img
                src="/favicon.png"
                alt="IslandLink"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const parent = e.currentTarget.parentElement
                  if (parent) {
                    parent.innerHTML =
                      '<div class="h-10 w-10 rounded-xl bg-linear-to-br from-green-500 via-blue-500 to-purple-500 flex items-center justify-center font-black text-white text-xl">IL</div>'
                  }
                }}
              />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-bold bg-linear-to-r from-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                IslandLink Logistics
              </div>
              <div className="text-xs text-gray-500">Supply Chain Management</div>
            </div>
          </a>

          {/* Desktop Navigation - Logistics Specific */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Main 4 items */}
            <a
              href="/logistics"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-green-600 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Dashboard
            </a>
            <a
              href="/logistic-orders"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Orders
            </a>
            <a
              href="/deliveries"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-purple-600 transition flex items-center gap-2"
            >
              {/* Updated Rider/Delivery SVG */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
              Deliveries
            </a>
            <a
              href="/route"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-green-600 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              Routes
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {showMobileMenu ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* User Section */}
          <div className="hidden lg:flex items-center gap-2">
            {loading ? (
              <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition"
                >
                  <img
                    src={getUserPhoto()}
                    alt={getUserDisplayName()}
                    className="h-10 w-10 rounded-full object-cover object-top border-2 border-gray-200"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=random`
                    }}
                  />
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-500">{getRoleDisplay()}</p>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />

                    <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-200 bg-linear-to-br from-green-50 via-blue-50 to-purple-50">
                        <p className="font-semibold text-gray-900">{getUserDisplayName()}</p>
                        <p className="text-xs text-gray-600 truncate">{user.email}</p>
                        <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-green-500 to-blue-600 text-white">
                          {getRoleDisplay()}
                        </span>
                      </div>

                      <div className="p-2">
                        <a
                          href="/profile"
                          className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition text-gray-700"
                          onClick={() => setShowProfileMenu(false)}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span className="text-sm">My Profile</span>
                        </a>
                      </div>

                      <div className="p-2 border-t border-gray-200">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-red-50 hover:text-red-600 transition w-full text-left text-gray-700"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          <span className="text-sm">Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a
                href="/login"
                className="px-5 py-2 rounded-xl bg-linear-to-r from-green-400 to-blue-500 text-white text-sm font-bold hover:from-green-500 hover:to-blue-600 transition shadow-sm"
              >
                Login
              </a>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="lg:hidden border-t border-gray-200 py-4 space-y-2">
            <a
              href="/logistics"
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-green-600 transition"
              onClick={() => setShowMobileMenu(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Dashboard
            </a>
            <a
              href="/logistic-orders"
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition"
              onClick={() => setShowMobileMenu(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Orders
            </a>
            <a
              href="/deliveries"
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-purple-600 transition"
              onClick={() => setShowMobileMenu(false)}
            >
              {/* Updated Rider/Delivery SVG for mobile */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
              Deliveries
            </a>

            {user && (
              <>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="px-4 py-2">
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={getUserPhoto()}
                      alt={getUserDisplayName()}
                      className="h-10 w-10 rounded-full object-cover object-top border-2 border-gray-200"
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=random`
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
                      <p className="text-xs text-gray-500">{getRoleDisplay()}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-green-500 to-blue-600 text-white font-semibold hover:from-green-600 hover:to-blue-700 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
