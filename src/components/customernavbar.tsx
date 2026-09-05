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
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(0)

  // Helper function to get user's name for avatar
  const getUserName = () => {
    if (!user) return 'User'
    return user.displayName || user.email?.split('@')[0] || 'User'
  }

  // Helper function to generate avatar URL
  const getAvatarUrl = (name: string) => {
    // Encode the name and create unique color based on name hash
    const encodedName = encodeURIComponent(name)
    // Create a simple hash for consistent colors
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = [
      'f97316', // orange-500
      '3b82f6', // blue-500
      '8b5cf6', // violet-500
      '10b981', // emerald-500
      'ef4444', // red-500
      'ec4899', // pink-500
      '6366f1', // indigo-500
      '14b8a6', // teal-500
      'f59e0b', // amber-500
      '84cc16', // lime-500
    ]
    const colorIndex = hash % colors.length

    return `https://ui-avatars.com/api/?name=${encodedName}&background=${colors[colorIndex]}&color=ffffff&bold=true`
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      // Fetch photoURL from Firestore (includes base64 images)
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
            // Prioritize Firestore photoURL (can be base64) over Auth photoURL
            setUserPhoto(userData.photoURL || currentUser.photoURL || '')
          } else {
            // Fallback to Auth photoURL if no Firestore doc
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

  // Listen for profile updates
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

    // Listen for custom profile update event
    window.addEventListener('profileUpdated', handleProfileUpdate)

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate)
    }
  }, [user])

  useEffect(() => {
    // Update cart count on mount and when user changes
    updateCartCount()

    // Listen for custom cart update events
    window.addEventListener('cartUpdated', updateCartCount)

    return () => {
      window.removeEventListener('cartUpdated', updateCartCount)
    }
  }, [user]) // Add user dependency

  async function updateCartCount() {
    // Only show cart count if user is logged in
    if (!user) {
      setCartCount(0)
      return
    }

    try {
      // Query Firebase for user's cart items
      const q = query(collection(db, 'carts'), where('userId', '==', user.uid))
      const querySnapshot = await getDocs(q)

      // Count number of items in cart
      const total = querySnapshot.size
      setCartCount(total)
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
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
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

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
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
          <div className="flex items-center gap-2">
            {loading ? (
              <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition"
                >
                  <img
                    src={userPhoto || getAvatarUrl(getUserName())}
                    alt={getUserName()}
                    className="h-10 w-10 rounded-full object-cover object-top border-2 border-gray-200"
                    onError={(e) => {
                      // If the image fails to load (including ui-avatars), use a fallback
                      const fallbackUrl = getAvatarUrl('User')
                      if (e.currentTarget.src !== fallbackUrl) {
                        e.currentTarget.src = fallbackUrl
                      }
                    }}
                  />
                  <span className="hidden md:block text-sm font-semibold text-gray-900">
                    {getUserName()}
                  </span>
                  <span className="text-xs text-gray-500">▼</span>
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />

                    {/* Menu */}
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
                className="px-5 py-2 rounded-xl bg-linear-to-r from-cyan-400 to-blue-500 text-white text-sm font-bold hover:from-cyan-500 hover:to-blue-600 transition shadow-sm"
              >
                Login
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
