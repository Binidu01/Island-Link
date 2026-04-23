'use client'

import { onAuthStateChanged, User } from 'firebase/auth'
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth, db } from '../lib/firebase'

interface WishlistItem {
  id: string
  userId: string
  productId: string
  productName: string
  productImage: string
  productPrice: number
  createdAt: any
}

export default function WishlistPage() {
  const [user, setUser] = useState<User | null>(null)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        loadWishlist(currentUser.uid)
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  async function loadWishlist(userId: string) {
    try {
      setLoading(true)
      const q = query(collection(db, 'wishlists'), where('userId', '==', userId))

      const querySnapshot = await getDocs(q)
      const wishlistData: WishlistItem[] = []

      querySnapshot.forEach((docSnap) => {
        wishlistData.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as WishlistItem)
      })

      // Sort by createdAt descending (newest first)
      wishlistData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
        return dateB.getTime() - dateA.getTime()
      })

      setWishlist(wishlistData)
    } catch (error) {
      console.error('Error loading wishlist:', error)
    } finally {
      setLoading(false)
    }
  }

  async function addToCart(item: WishlistItem) {
    try {
      if (!user) {
        window.location.href = '/login?redirect=/wishlist'
        return
      }

      // Add to Firestore carts collection
      const cartsRef = collection(db, 'carts')

      // Check if item already exists in cart
      const q = query(
        cartsRef,
        where('userId', '==', user.uid),
        where('productId', '==', item.productId)
      )

      const existingCartItems = await getDocs(q)

      if (!existingCartItems.empty) {
        // Item exists, increment quantity
        const cartDoc = existingCartItems.docs[0]
        const currentQuantity = cartDoc.data().quantity || 1
        await updateDoc(doc(db, 'carts', cartDoc.id), {
          quantity: currentQuantity + 1,
        })
      } else {
        // Item doesn't exist, add new
        await addDoc(cartsRef, {
          userId: user.uid,
          productId: item.productId,
          name: item.productName,
          price: item.productPrice,
          quantity: 1,
          imageURL: item.productImage,
          stock: 999, // Default stock
          createdAt: new Date(),
        })
      }

      // Also update localStorage for immediate UI update
      const cart = JSON.parse(localStorage.getItem('isdp_cart') || '[]')
      const existingIndex = cart.findIndex((cartItem: any) => cartItem.productId === item.productId)

      if (existingIndex > -1) {
        cart[existingIndex].quantity += 1
      } else {
        cart.push({
          productId: item.productId,
          name: item.productName,
          price: item.productPrice,
          quantity: 1,
          imageURL: item.productImage,
          stock: 999,
        })
      }

      localStorage.setItem('isdp_cart', JSON.stringify(cart))

      // Trigger cart update event
      window.dispatchEvent(new Event('cartUpdated'))

      setSuccessMessage('Added to cart! 🛒')
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error adding to cart:', error)
      setSuccessMessage('Failed to add to cart. Please try again.')
      setShowSuccessModal(true)
    }
  }

  async function removeFromWishlist(wishlistId: string) {
    setRemovingId(wishlistId)

    try {
      await deleteDoc(doc(db, 'wishlists', wishlistId))

      // Update local state
      setWishlist((prev) => prev.filter((item) => item.id !== wishlistId))

      setSuccessMessage('Removed from wishlist')
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error removing from wishlist:', error)
      setSuccessMessage('Failed to remove item. Please try again.')
      setShowSuccessModal(true)
    } finally {
      setRemovingId(null)
    }
  }

  // Success Modal Component
  function SuccessModal() {
    if (!showSuccessModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scale-up">
          <div className="flex items-center justify-center w-16 h-16 bg-linear-to-br from-cyan-400 to-green-500 rounded-full mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-gray-900 font-medium text-center mb-4">{successMessage}</p>
          <button
            onClick={() => setShowSuccessModal(false)}
            className="w-full px-4 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition"
          >
            OK
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <CustomerNavbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-12">
            <svg
              className="w-20 h-20 mx-auto text-gray-300 mb-4"
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
            <p className="text-gray-500 mb-6">Please login to view your wishlist</p>
            <a
              href="/login?redirect=/wishlist"
              className="inline-block px-8 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition"
            >
              Login to Continue
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      {/* Success Modal */}
      <SuccessModal />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
          <p className="text-gray-600 mt-1">
            {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading your wishlist...</p>
            </div>
          </div>
        ) : wishlist.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-12 text-center">
            <div className="w-32 h-32 mx-auto mb-6 relative">
              <svg
                className="w-full h-full text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Wishlist is Empty</h2>
            <p className="text-gray-500 mb-6">Save items you love to buy them later!</p>
            <a
              href="/products"
              className="inline-block px-8 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition shadow-md"
            >
              Start Shopping
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlist.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-md border-2 border-gray-200 overflow-hidden group hover:shadow-xl hover:border-cyan-300 transition-all"
              >
                {/* Product Image */}
                <a
                  href={`/product?id=${item.productId}`}
                  className="block relative aspect-square bg-linear-to-br from-gray-50 to-gray-100 overflow-hidden"
                >
                  <img
                    src={item.productImage || 'https://via.placeholder.com/300x300?text=No+Image'}
                    alt={item.productName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/300x300?text=No+Image'
                    }}
                  />

                  {/* Remove Button Overlay */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      removeFromWishlist(item.id)
                    }}
                    disabled={removingId === item.id}
                    aria-label={`Remove ${item.productName} from wishlist`}
                    className="absolute top-3 right-3 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors disabled:opacity-50 border-2 border-gray-200"
                  >
                    {removingId === item.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500"></div>
                    ) : (
                      <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                </a>

                {/* Product Info */}
                <div className="p-4 bg-white">
                  <a href={`/product?id=${item.productId}`} className="block mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 min-h-10 hover:text-cyan-600 transition-colors">
                      {item.productName}
                    </h3>
                  </a>

                  <div className="mb-4">
                    <span className="text-xl font-bold text-orange-600">
                      LKR {item.productPrice.toLocaleString()}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => addToCart(item)}
                      disabled={removingId === item.id}
                      className="w-full px-4 py-2.5 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold text-sm hover:from-orange-600 hover:to-orange-700 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {wishlist.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Looking for something specific?</h3>
                  <p className="text-sm text-gray-500">
                    Browse more products to add to your wishlist
                  </p>
                </div>
              </div>
              <a
                href="/products"
                className="px-6 py-2.5 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition shadow-md hover:shadow-lg whitespace-nowrap"
              >
                Continue Shopping
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Add animation styles */}
      <style>{`
        @keyframes scale-up {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
