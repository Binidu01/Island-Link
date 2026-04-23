import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AdminNavbar from '../components/Adminnavbar'
import CustomerNavbar from '../components/customernavbar'
import HOManagerNavbar from '../components/HOManagerNavbar'
import LogisticsNavbar from '../components/LogisticsNavbar'
import RDCNavbar from '../components/RDCNavbar'
import { auth, db } from '../lib/firebase'

export default function NotFound() {
  const [userRole, setUserRole] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid)
          const docSnap = await getDoc(docRef)
          setUserRole(docSnap.exists() ? docSnap.data().role || 'customer' : 'customer')
        } catch (error) {
          setUserRole('customer')
        }
      } else {
        setUserRole('customer')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  function getNavbar() {
    if (loading) return <div className="h-16 bg-white shadow-sm"></div>

    switch (userRole) {
      case 'admin':
        return <AdminNavbar />
      case 'HO Manager':
        return <HOManagerNavbar />
      case 'RDC Staff':
        return <RDCNavbar />
      case 'Logistics Team':
        return <LogisticsNavbar />
      default:
        return <CustomerNavbar />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <div className="h-16 bg-white shadow-sm"></div>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      {getNavbar()}

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center relative">
          <div className="relative h-64 mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-linear-to-r from-cyan-400/20 to-orange-400/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="text-8xl font-bold text-gray-800">
                  <span className="inline-block animate-bounce [animation-delay:0s]">4</span>
                  <span className="inline-block animate-bounce [animation-delay:0.1s]">0</span>
                  <span className="inline-block animate-bounce [animation-delay:0.2s]">4</span>
                </div>
              </div>
            </div>

            <div className="absolute top-4 left-1/4 animate-bounce [animation-delay:0.3s]">
              <div className="w-12 h-12 bg-linear-to-r from-orange-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
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
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="absolute top-8 right-1/4 animate-bounce [animation-delay:0.5s]">
              <div className="w-10 h-10 bg-linear-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                  />
                </svg>
              </div>
            </div>

            <div className="absolute bottom-8 left-1/3 animate-bounce [animation-delay:0.7s]">
              <div className="w-8 h-8 bg-linear-to-r from-cyan-400 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              </div>
            </div>

            <div className="absolute bottom-4 right-1/3 animate-bounce [animation-delay:0.9s]">
              <div className="w-6 h-6 bg-linear-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                <svg
                  className="w-3 h-3 text-white"
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
              </div>
            </div>

            <div className="absolute top-1/2 right-8 animate-pulse">
              <div className="w-16 h-16 border-4 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">Oops! Page Not Found</h1>

          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            It seems this product page has been moved or doesn't exist. Let's find something else!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/products')}
              className="group relative px-8 py-3 bg-linear-to-r from-cyan-400 to-cyan-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-cyan-600 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5 group-hover:rotate-12 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Browse Products
              </span>
              <div className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            <button
              onClick={() => navigate(-1)}
              className="group relative px-8 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Go Back
              </span>
              <div className="absolute inset-0 bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

          <div className="mt-8 p-4 bg-linear-to-r from-cyan-50 to-blue-50 rounded-lg max-w-md mx-auto">
            <p className="text-sm text-gray-600">
              Looking for something specific? Try using the search bar at the top of the page!
            </p>
          </div>
        </div>
      </div>

      {/* Floating dots background – inline styles used for random positioning */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 bg-cyan-300/30 rounded-full animate-pulse [animation-delay:${(i * 0.1).toFixed(1)}s] [animation-duration:${(3 + (i % 3)).toFixed(1)}s] top-[${(i * 7 + 3) % 100}%] left-[${(i * 13 + 7) % 100}%]`}
          />
        ))}
      </div>
    </div>
  )
}
