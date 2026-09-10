'use client'

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { User } from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { auth, db } from '../lib/firebase'

export default function CustomerNavbar() {
  const [user, setUser] = useState<User | null>(null)
  const [userPhoto, setUserPhoto] = useState<string>('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(0)

  // Helper function to get user's name for avatar
  const getUserName = () => {
    if (!user) return 'User'
    return user.displayName || user.email?.split('@')[0] || 'User'
  }

  // Helper function to generate avatar URL
  const getAvatarUrl = (name: string) => {
    const encodedName = encodeURIComponent(name)
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = [
      'f97316',
      '3b82f6',
      '8b5cf6',
      '10b981',
      'ef4444',
      'ec4899',
      '6366f1',
      '14b8a6',
      'f59e0b',
      '84cc16',
    ]
    const colorIndex = hash % colors.length

    return `https://ui-avatars.com/api/?name=${encodedName}&background=${colors[colorIndex]}&color=ffffff&bold=true`
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUserPhoto(userData.photoURL || currentUser.photoURL || '')
          } else {
            setUserPhoto(currentUser.photoURL || '')
          }
        } catch (error) {
          console.error('Error fetching user photo:', error)
          setUserPhoto(currentUser.photoURL || '')
        }
      } else {
        setUserPhoto('')
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleProfileUpdate = async () => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUserPhoto(userData.photoURL || user.photoURL || '')
          }
        } catch (error) {
          console.error('Error refreshing user photo:', error)
        }
      }
    }

    window.addEventListener('profileUpdated', handleProfileUpdate)

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate)
    }
  }, [user])

  useEffect(() => {
    updateCartCount()
    window.addEventListener('cartUpdated', updateCartCount)
    return () => {
      window.removeEventListener('cartUpdated', updateCartCount)
    }
  }, [user])

  async function updateCartCount() {
    if (!user) {
      setCartCount(0)
      return
    }

    try {
      const q = query(collection(db, 'carts'), where('userId', '==', user.uid))
      const querySnapshot = await getDocs(q)
      setCartCount(querySnapshot.size)
    } catch (error) {
      console.error('Error reading cart:', error)
      setCartCount(0)
    }
  }

  async function handleLogout() {
    try {
      setCartCount(0)
      await signOut(auth)
      setShowProfileMenu(false)
      setShowMobileMenu(false)
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Close mobile menu when clicking a nav link
  const closeMobileMenu = () => setShowMobileMenu(false)

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(true)}
              aria-label="Open menu"
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition -ml-2"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Logo */}
            <a href="/" className="flex items-center gap-3 group shrink-0">
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
                        '<div class="h-10 w-10 rounded-xl bg-linear-to-br from-orange-500 via-cyan-500 to-green-500 flex items-center justify-center font-black text-white">IL</div>'
                    }
                  }}
                />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="font-semibold text-gray-900">IslandLink</div>
                <div className="text-xs text-gray-500">Shop Online</div>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              <a
                href="/"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Home
              </a>
              <a
                href="/orders"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                Orders
              </a>
              <a
                href="/messages"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Messages
              </a>
              <a
                href="/cart"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2 relative"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Cart
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-4.5 h-4.5 bg-linear-to-r from-orange-500 to-orange-600 rounded-full text-[10px] flex items-center justify-center font-bold text-white px-1">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </a>
            </div>

            {/* User Section */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mobile Cart Icon (visible on small screens) */}
              <a
                href="/cart"
                aria-label="Cart"
                className="md:hidden relative p-2 rounded-xl hover:bg-gray-100 transition"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 min-w-4.5 h-4.5 bg-linear-to-r from-orange-500 to-orange-600 rounded-full text-[10px] flex items-center justify-center font-bold text-white px-1">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </a>

              {loading ? (
                <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    aria-label="User menu"
                    className="flex items-center gap-2 p-1 sm:px-3 sm:py-2 rounded-xl hover:bg-gray-100 transition"
                  >
                    <img
                      src={userPhoto || getAvatarUrl(getUserName())}
                      alt={getUserName()}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover object-top border-2 border-gray-200"
                      onError={(e) => {
                        const fallbackUrl = getAvatarUrl('User')
                        if (e.currentTarget.src !== fallbackUrl) {
                          e.currentTarget.src = fallbackUrl
                        }
                      }}
                    />
                    <span className="hidden md:block text-sm font-semibold text-gray-900">
                      {getUserName()}
                    </span>
                    <span className="hidden md:block text-xs text-gray-500">▼</span>
                  </button>

                  {/* Dropdown Menu */}
                  {showProfileMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProfileMenu(false)}
                      />

                      <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-linear-to-br from-cyan-50 to-orange-50">
                          <p className="font-semibold text-gray-900">{getUserName()}</p>
                          <p className="text-xs text-gray-600 truncate">{user.email}</p>
                        </div>

                        <div className="p-2">
                          <a
                            href="/profile"
                            className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition text-gray-700"
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
                          <a
                            href="/orders"
                            className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition text-gray-700"
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
                                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                              />
                            </svg>
                            <span className="text-sm">My Orders</span>
                          </a>
                          <a
                            href="/wishlist"
                            className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition text-gray-700"
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
                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                            <span className="text-sm">Wishlist</span>
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
                  className="px-4 sm:px-5 py-2 rounded-xl bg-linear-to-r from-cyan-400 to-blue-500 text-white text-sm font-bold hover:from-cyan-500 hover:to-blue-600 transition shadow-sm"
                >
                  Login
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] md:hidden animate-fade-in"
            onClick={closeMobileMenu}
          />

          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-white z-[70] shadow-2xl md:hidden animate-slide-in-left overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <a href="/" onClick={closeMobileMenu} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center">
                  <img
                    src="/favicon.png"
                    alt="IslandLink"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent) {
                        parent.innerHTML =
                          '<div class="h-10 w-10 rounded-xl bg-linear-to-br from-orange-500 via-cyan-500 to-green-500 flex items-center justify-center font-black text-white">IL</div>'
                      }
                    }}
                  />
                </div>
                <div className="leading-tight">
                  <div className="font-semibold text-gray-900">IslandLink</div>
                  <div className="text-xs text-gray-500">Shop Online</div>
                </div>
              </a>
              <button
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="p-2 rounded-xl hover:bg-gray-100 transition"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* User Info (if logged in) */}
            {user && (
              <div className="p-4 border-b border-gray-200 bg-linear-to-br from-cyan-50 to-orange-50">
                <a href="/profile" onClick={closeMobileMenu} className="flex items-center gap-3">
                  <img
                    src={userPhoto || getAvatarUrl(getUserName())}
                    alt={getUserName()}
                    className="h-12 w-12 rounded-full object-cover object-top border-2 border-white shadow-sm"
                    onError={(e) => {
                      const fallbackUrl = getAvatarUrl('User')
                      if (e.currentTarget.src !== fallbackUrl) {
                        e.currentTarget.src = fallbackUrl
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{getUserName()}</p>
                    <p className="text-xs text-gray-600 truncate">{user.email}</p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </a>
              </div>
            )}

            {/* Navigation Links */}
            <div className="p-3 space-y-1">
              <a
                href="/"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Home
              </a>
              <a
                href="/orders"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                Orders
              </a>
              <a
                href="/messages"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Messages
              </a>
              <a
                href="/cart"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span className="flex-1">Cart</span>
                {cartCount > 0 && (
                  <span className="min-w-6 h-6 bg-linear-to-r from-orange-500 to-orange-600 rounded-full text-[11px] flex items-center justify-center font-bold text-white px-2">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </a>

              {user && (
                <>
                  <div className="my-2 border-t border-gray-200" />
                  <a
                    href="/profile"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    My Profile
                  </a>
                  <a
                    href="/wishlist"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    Wishlist
                  </a>
                </>
              )}
            </div>

            {/* Drawer Footer - Login/Logout */}
            <div className="p-3 mt-auto border-t border-gray-200">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition w-full font-semibold"
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
              ) : (
                <a
                  href="/login"
                  onClick={closeMobileMenu}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-linear-to-r from-cyan-400 to-blue-500 text-white font-bold hover:from-cyan-500 hover:to-blue-600 transition shadow-sm"
                >
                  Login
                </a>
              )}
            </div>
          </div>
        </>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.25s ease-out;
        }
      `}</style>
    </>
  )
}