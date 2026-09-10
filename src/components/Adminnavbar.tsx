'use client'

import { onAuthStateChanged, signOut } from 'firebase/auth'
import { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import { auth, db } from '../lib/firebase'

export default function AdminNavbar() {
  const [user, setUser] = useState<User | null>(null)
  const [userPhoto, setUserPhoto] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          setUserPhoto(currentUser.photoURL || '')
          setUserName(currentUser.displayName || currentUser.email?.split('@')[0] || 'Admin')

          const userDocRef = doc(db, 'users', currentUser.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
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
        }
      } else {
        setUserPhoto('')
        setUserName('')
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  async function handleLogout() {
    try {
      await signOut(auth)
      setShowProfileMenu(false)
      setShowMobileMenu(false)
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const getUserDisplayName = () => {
    if (userName && userName !== '') return userName
    if (user?.displayName) return user.displayName
    if (user?.email) return user.email.split('@')[0]
    return 'Admin'
  }

  const getUserPhoto = () => {
    if (userPhoto && userPhoto !== '') return userPhoto
    if (user?.photoURL) return user.photoURL
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=random`
  }

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
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition -ml-2"
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

            {/* Logo & Title */}
            <a href="/admin" className="flex items-center gap-3 group shrink-0">
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
                        '<div class="h-10 w-10 rounded-xl bg-linear-to-br from-orange-500 via-cyan-500 to-green-500 flex items-center justify-center font-black text-white text-xl">IL</div>'
                    }
                  }}
                />
              </div>
              <div className="leading-tight hidden sm:block">
                <div className="font-bold bg-linear-to-r from-orange-500 via-cyan-500 to-green-500 bg-clip-text text-transparent">
                  IslandLink Admin
                </div>
                <div className="text-xs text-gray-500">Management Portal</div>
              </div>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <a
                href="/admin"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2"
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
                href="/manage-users"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Users
              </a>
              <a
                href="/manage-products"
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
                Products
              </a>
              <a
                href="/manage-orders"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Orders
              </a>
              <a
                href="/reports"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-cyan-600 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Reports
              </a>
            </div>

            {/* User Section (Desktop) */}
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
                      <p className="text-xs text-gray-500">Administrator</p>
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

                  {showProfileMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProfileMenu(false)}
                      />

                      <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-linear-to-br from-orange-50 via-cyan-50 to-green-50">
                          <p className="font-semibold text-gray-900">{getUserDisplayName()}</p>
                          <p className="text-xs text-gray-600 truncate">{user.email}</p>
                          <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-orange-500 to-orange-600 text-white">
                            Administrator
                          </span>
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
                            href="/audit"
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
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="text-sm">Audit Logs</span>
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

            {/* Mobile User Avatar (visible when logged in) */}
            {!loading && user && (
              <button
                onClick={() => setShowMobileMenu(true)}
                aria-label="Open profile menu"
                className="lg:hidden p-1 rounded-full hover:bg-gray-100 transition"
              >
                <img
                  src={getUserPhoto()}
                  alt={getUserDisplayName()}
                  className="h-9 w-9 rounded-full object-cover object-top border-2 border-gray-200"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=random`
                  }}
                />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] lg:hidden animate-fade-in"
            onClick={closeMobileMenu}
          />

          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-white z-[70] shadow-2xl lg:hidden animate-slide-in-left overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <a href="/admin" onClick={closeMobileMenu} className="flex items-center gap-3">
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
                          '<div class="h-10 w-10 rounded-xl bg-linear-to-br from-orange-500 via-cyan-500 to-green-500 flex items-center justify-center font-black text-white text-xl">IL</div>'
                      }
                    }}
                  />
                </div>
                <div className="leading-tight">
                  <div className="font-bold bg-linear-to-r from-orange-500 via-cyan-500 to-green-500 bg-clip-text text-transparent">
                    IslandLink Admin
                  </div>
                  <div className="text-xs text-gray-500">Management Portal</div>
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
              <div className="p-4 border-b border-gray-200 bg-linear-to-br from-orange-50 via-cyan-50 to-green-50">
                <a href="/profile" onClick={closeMobileMenu} className="flex items-center gap-3">
                  <img
                    src={getUserPhoto()}
                    alt={getUserDisplayName()}
                    className="h-12 w-12 rounded-full object-cover object-top border-2 border-white shadow-sm"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=random`
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-600 truncate">{user.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-linear-to-r from-orange-500 to-orange-600 text-white">
                      Administrator
                    </span>
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
            <div className="p-3 space-y-1 flex-1">
              <a
                href="/admin"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                href="/manage-users"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Users
              </a>
              <a
                href="/manage-products"
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
                Products
              </a>
              <a
                href="/manage-orders"
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
                Orders
              </a>
              <a
                href="/reports"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Reports
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
                    href="/audit"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition text-gray-700 font-medium"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Audit Logs
                  </a>
                </>
              )}
            </div>

            {/* Drawer Footer - Login/Logout */}
            <div className="p-3 border-t border-gray-200 mt-auto">
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