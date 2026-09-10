'use client'

import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth, db } from '../lib/firebase'

interface CartItem {
  id?: string // Firestore document ID
  productId: string
  name: string
  price: number
  quantity: number
  imageURL: string
  stock: number
}

export default function CartPage() {
  const [user, setUser] = useState<User | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        // Load cart with user ID
        loadCartForUser(currentUser.uid)
      } else {
        setCart([])
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  async function loadCartForUser(userId: string) {
    try {
      setLoading(true)
      // Query Firebase for user's cart items
      const q = query(collection(db, 'carts'), where('userId', '==', userId))
      const querySnapshot = await getDocs(q)

      const cartItems: CartItem[] = querySnapshot.docs.map((doc) => ({
        id: doc.id, // Store document ID for updates/deletes
        productId: doc.data().productId,
        name: doc.data().name,
        price: doc.data().price,
        quantity: doc.data().quantity,
        imageURL: doc.data().imageURL,
        stock: doc.data().stock,
      }))

      setCart(cartItems)
    } catch (error) {
      console.error('Error loading cart:', error)
    } finally {
      setLoading(false)
    }
  }

  function loadCart() {
    if (!user) {
      setCart([])
      return
    }

    loadCartForUser(user.uid)
  }

  async function updateQuantity(productId: string, newQuantity: number) {
    if (!user) return

    try {
      // Find the cart item
      const cartItem = cart.find((item) => item.productId === productId)
      if (!cartItem || !cartItem.id) return

      // Calculate new quantity within bounds
      const currentQuantity = Number(cartItem.quantity) || 1
      const targetQuantity = Number(newQuantity) || 1
      const maxStock = Number(cartItem.stock) || 999
      const quantity = Math.min(Math.max(1, targetQuantity), maxStock)

      // Update in Firebase
      const cartDocRef = doc(db, 'carts', cartItem.id)
      await updateDoc(cartDocRef, { quantity })

      // Update local state
      const updatedCart = cart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
      setCart(updatedCart)

      // Trigger cart update event for navbar
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (error) {
      console.error('Error updating quantity:', error)
    }
  }

  async function removeItem(productId: string) {
    if (!user) return

    try {
      // Find the cart item
      const cartItem = cart.find((item) => item.productId === productId)
      if (!cartItem || !cartItem.id) return

      // Delete from Firebase
      await deleteDoc(doc(db, 'carts', cartItem.id))

      // Update local state
      const updatedCart = cart.filter((item) => item.productId !== productId)
      setCart(updatedCart)

      // Trigger cart update event for navbar
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  async function clearCart() {
    if (!user) return

    try {
      // Delete all cart items from Firebase
      const deletePromises = cart.map((item) => {
        if (item.id) {
          return deleteDoc(doc(db, 'carts', item.id))
        }
        return Promise.resolve()
      })

      await Promise.all(deletePromises)

      // Update local state
      setCart([])

      // Trigger cart update event for navbar
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (error) {
      console.error('Error clearing cart:', error)
    }
  }

  // Calculate totals - ensure all values are numbers
  const subtotal = cart.reduce((sum, item) => {
    const price = Number(item.price) || 0
    const quantity = Number(item.quantity) || 0
    const itemTotal = price * quantity
    console.log('Cart item:', item.name, 'Price:', price, 'Qty:', quantity, 'Total:', itemTotal)
    return sum + itemTotal
  }, 0)
  console.log('Final subtotal:', subtotal)
  const shipping = subtotal >= 10000 ? 0 : 300 // Free shipping over LKR 10,000
  const total = subtotal + shipping

  function handleCheckout() {
    if (cart.length === 0) return
    window.location.href = '/checkout'
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-500 mt-1">
            {cart.length} {cart.length === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : !user ? (
          // Not Logged In
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto text-gray-300 mb-4"
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
            <p className="text-gray-500 mb-6">Please login to view your shopping cart</p>
            <a
              href="/login?redirect=/cart"
              className="inline-block px-8 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition shadow-md"
            >
              Login to Continue
            </a>
          </div>
        ) : cart.length === 0 ? (
          // Empty Cart
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto text-gray-300 mb-4"
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some products to get started!</p>
            <a
              href="/products"
              className="inline-block px-8 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition shadow-md"
            >
              Continue Shopping
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Clear Cart Button */}
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Cart Items</h2>
                <button
                  onClick={clearCart}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear Cart
                </button>
              </div>

              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition"
                >
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <a
                      href={`/product?id=${item.productId}`}
                      className="shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden"
                    >
                      <img
                        src={item.imageURL || 'https://via.placeholder.com/200'}
                        alt={item.name}
                        className="w-full h-full object-cover hover:scale-105 transition"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/200?text=No+Image'
                        }}
                      />
                    </a>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/product?id=${item.productId}`}
                        className="text-base font-medium text-gray-900 hover:text-cyan-600 line-clamp-2 mb-2"
                      >
                        {item.name}
                      </a>

                      <div className="flex items-center gap-4 mb-3">
                        <div className="text-orange-600 font-bold text-lg">
                          LKR {(Number(item.price) || 0).toLocaleString()}
                        </div>
                        {item.stock < 10 && (
                          <span className="text-xs text-red-600 font-medium">
                            Only {Number(item.stock) || 0} left!
                          </span>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center border border-gray-300 rounded-lg">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label="Decrease quantity"
                            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-lg transition"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                              />
                            </svg>
                          </button>
                          <span className="w-12 text-center py-1.5 border-x border-gray-300 font-medium text-gray-900">
                            {Number(item.quantity) || 1}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            aria-label="Increase quantity"
                            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-lg transition"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        LKR{' '}
                        {(
                          (Number(item.price) || 0) * (Number(item.quantity) || 0)
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({cart.length} items)</span>
                    <span>LKR {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className={shipping === 0 ? 'text-green-600 font-medium' : ''}>
                      {shipping === 0 ? 'FREE' : `LKR ${shipping.toLocaleString()}`}
                    </span>
                  </div>
                  {subtotal > 0 && subtotal < 10000 && (
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                      Add LKR {Math.ceil(10000 - subtotal).toLocaleString()} more for free shipping!
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-orange-600">LKR {total.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition shadow-md mb-3"
                >
                  Proceed to Checkout
                </button>

                <a
                  href="/products"
                  className="block w-full py-3 text-center border-2 border-cyan-500 text-cyan-600 rounded-lg font-semibold hover:bg-cyan-50 transition"
                >
                  Continue Shopping
                </a>

                {/* Payment Methods */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">We Accept</h3>
                  <div className="flex gap-2 flex-wrap">
                    <div className="px-3 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                      Cash on Delivery
                    </div>
                    <div className="px-3 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                      Visa
                    </div>
                    <div className="px-3 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                      Mastercard
                    </div>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Secure Checkout
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="w-5 h-5 text-green-600"
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
                    Easy Returns
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Fast Delivery
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
