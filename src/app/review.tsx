import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { auth, db } from '../lib/firebase'

interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
  imageURL: string
  stock: number
}

interface Order {
  id: string
  orderNumber: string
  items: OrderItem[]
  total: number
  status: string
  createdAt: any
  deliveredAt?: any
}

interface ReviewData {
  rating: number
  review: string
  userId: string
  userEmail: string
  orderId: string
  productId: string
  createdAt: any
}

export default function ReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [orderId, setOrderId] = useState<string | null>(null)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  // State for reviews
  const [reviews, setReviews] = useState<{ [key: string]: { rating: number; review: string } }>({})

  useEffect(() => {
    // Extract orderId from query params
    const searchParams = new URLSearchParams(location.search)
    const id = searchParams.get('orderId')
    setOrderId(id)
  }, [location])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid)
        setCurrentUserEmail(user.email)
      } else {
        navigate('/login?redirect=/review')
      }
    })

    return () => unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (orderId && currentUserId) {
      fetchOrder()
    }
  }, [orderId, currentUserId])

  async function fetchOrder() {
    try {
      if (!orderId) {
        setError('No order ID provided')
        setLoading(false)
        return
      }

      // Fetch order
      const orderDoc = await getDoc(doc(db, 'orders', orderId))
      if (!orderDoc.exists()) {
        setError('Order not found')
        setLoading(false)
        return
      }

      const orderData = orderDoc.data()

      // Verify the order belongs to the current user
      if (orderData.userEmail !== currentUserEmail && orderData.userId !== currentUserId) {
        setError('You are not authorized to review this order')
        setLoading(false)
        return
      }

      // Verify order is delivered or out for delivery
      const orderStatus =
        orderData.status === 'out-for-delivery' ? 'out_for_delivery' : orderData.status
      if (orderStatus !== 'delivered' && orderStatus !== 'out_for_delivery') {
        setError('You can only review delivered orders')
        setLoading(false)
        return
      }

      // Check if already reviewed
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('orderId', '==', orderId),
        where('userId', '==', currentUserId)
      )

      const reviewsSnapshot = await getDocs(reviewsQuery)
      if (!reviewsSnapshot.empty) {
        const existingReviews: { [key: string]: { rating: number; review: string } } = {}
        reviewsSnapshot.forEach((doc) => {
          const reviewData = doc.data()
          existingReviews[reviewData.productId] = {
            rating: reviewData.rating,
            review: reviewData.review,
          }
        })
        setReviews(existingReviews)
      }

      // Initialize reviews state for each product
      const initialReviews: { [key: string]: { rating: number; review: string } } = {}
      orderData.items.forEach((item: OrderItem) => {
        if (!initialReviews[item.productId]) {
          initialReviews[item.productId] = { rating: 0, review: '' }
        }
      })

      // Merge with existing reviews
      setReviews((prev) => ({ ...initialReviews, ...prev }))

      setOrder({
        id: orderDoc.id,
        orderNumber: orderData.orderNumber || `ORD-${orderDoc.id.substring(0, 8).toUpperCase()}`,
        items: orderData.items || [],
        total: orderData.total || 0,
        status: orderData.status,
        createdAt: orderData.createdAt,
        deliveredAt: orderData.deliveredAt,
      })
    } catch (error) {
      console.error('Error fetching order:', error)
      setError('Failed to load order details')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(timestamp: any) {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate()
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch (error) {
      return ''
    }
  }

  function handleRatingChange(productId: string, rating: number) {
    setReviews((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], rating },
    }))
  }

  function handleReviewChange(productId: string, review: string) {
    setReviews((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], review },
    }))
  }

  function hasAllRatings() {
    if (!order) return false

    // Check if all items have a rating (review is optional)
    return order.items.every((item) => {
      const review = reviews[item.productId]
      return review && review.rating > 0
    })
  }

  async function handleSubmitReview() {
    if (!order || !currentUserId || !currentUserEmail) return

    if (!hasAllRatings()) {
      setError('Please rate all products before submitting')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      // Submit each product review
      const reviewPromises = order.items.map(async (item) => {
        const reviewData = reviews[item.productId]

        // Check if review already exists
        const existingReviewQuery = query(
          collection(db, 'reviews'),
          where('orderId', '==', order.id),
          where('productId', '==', item.productId),
          where('userId', '==', currentUserId)
        )

        const existingReviewSnapshot = await getDocs(existingReviewQuery)

        if (!existingReviewSnapshot.empty) {
          // Update existing review
          const existingReviewDoc = existingReviewSnapshot.docs[0]
          return updateDoc(doc(db, 'reviews', existingReviewDoc.id), {
            rating: reviewData.rating,
            review: reviewData.review,
            updatedAt: new Date(),
          })
        } else {
          // Create new review
          return addDoc(collection(db, 'reviews'), {
            orderId: order.id,
            productId: item.productId,
            productName: item.name,
            rating: reviewData.rating,
            review: reviewData.review,
            userId: currentUserId,
            userEmail: currentUserEmail,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      })

      await Promise.all(reviewPromises)

      setSuccess('Thank you for your review! Your feedback has been submitted successfully.')

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/messages')
      }, 2000)
    } catch (error) {
      console.error('Error submitting reviews:', error)
      setError('Failed to submit reviews. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 font-medium">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-200">
            <div className="w-24 h-24 mx-auto bg-linear-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-12 h-12 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Unable to Review Order</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/messages')}
                className="px-8 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
              >
                Back to Orders
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Review Your Order</h1>
            {order && (
              <p className="text-gray-600 mt-1">
                Order #{order.orderNumber} • Delivered{' '}
                {order.deliveredAt ? formatDate(order.deliveredAt) : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/messages')}
            className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Orders
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-5 bg-linear-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-green-600"
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
              <div>
                <h3 className="text-lg font-bold text-green-800">Review Submitted Successfully!</h3>
                <p className="text-green-700 mt-1">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !success && (
          <div className="mb-6 p-5 bg-linear-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-800">Please Complete Your Review</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {order && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border-2 border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-cyan-100 to-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-cyan-600"
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
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Review Progress</p>
                  <p className="text-sm text-gray-600">
                    {order?.items.filter((item) => reviews[item.productId]?.rating > 0).length || 0}{' '}
                    of {order?.items.length || 0} products rated
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-cyan-600">
                  {Math.round(
                    ((order?.items.filter((item) => reviews[item.productId]?.rating > 0).length ||
                      0) /
                      (order?.items.length || 1)) *
                      100
                  )}
                  %
                </div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`bg-linear-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all duration-300 w-[${
                  ((order?.items.filter((item) => reviews[item.productId]?.rating > 0).length ||
                    0) /
                    (order?.items.length || 1)) *
                  100
                }%]`}
              />
            </div>
          </div>
        )}

        {/* Order Items for Review */}
        {order && (
          <div className="space-y-6">
            {order.items.map((item, index) => (
              <div
                key={item.productId}
                className="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-gray-200"
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Product Image */}
                    <div className="w-full lg:w-32 h-32 bg-linear-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden shrink-0 border-2 border-gray-300">
                      <img
                        src={item.imageURL || 'https://via.placeholder.com/400'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/400?text=No+Image'
                        }}
                      />
                    </div>

                    {/* Product Details and Review */}
                    <div className="flex-1">
                      <div className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{item.name}</h3>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                              <span className="font-medium">Qty: {item.quantity}</span>
                              <span>•</span>
                              <span>LKR {item.price?.toLocaleString() || '0'} each</span>
                            </div>
                          </div>
                          <div className="text-left lg:text-right">
                            <div className="text-xl font-bold text-orange-600">
                              LKR {(item.quantity * item.price)?.toLocaleString() || '0'}
                            </div>
                            <div className="text-sm text-gray-500">Subtotal</div>
                          </div>
                        </div>
                      </div>

                      {/* Rating Section */}
                      <div className="mb-6 p-4 bg-linear-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-base font-bold text-gray-900">
                            Rate this product
                          </label>
                          <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                            Required
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center space-x-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRatingChange(item.productId, star)}
                                aria-label={`Rate ${item.name} ${star} out of 5 stars`}
                                className="focus:outline-none transform hover:scale-110 transition-transform"
                              >
                                <svg
                                  className={`w-9 h-9 ${
                                    reviews[item.productId]?.rating >= star
                                      ? 'text-yellow-500'
                                      : 'text-gray-300'
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              </button>
                            ))}
                          </div>
                          {reviews[item.productId]?.rating > 0 && (
                            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border-2 border-yellow-300">
                              <div className="text-2xl font-bold text-gray-900">
                                {reviews[item.productId]?.rating || 0}.0
                              </div>
                              <div className="text-xs text-gray-600">out of 5.0</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Review Text Section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label
                            htmlFor={`review-${item.productId}`}
                            className="block text-base font-bold text-gray-900"
                          >
                            Share your experience
                          </label>
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Optional
                          </span>
                        </div>
                        <textarea
                          id={`review-${item.productId}`}
                          value={reviews[item.productId]?.review || ''}
                          onChange={(e) => handleReviewChange(item.productId, e.target.value)}
                          placeholder="Tell us what you think about this product..."
                          rows={4}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all resize-none text-gray-900 placeholder-gray-400 bg-white"
                        />
                        <div className="mt-2 text-xs text-gray-500">
                          Share details about quality, performance, or anything else
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit Button Section */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border-2 border-gray-200 sticky bottom-0">
          <div className="flex flex-col items-center">
            <button
              onClick={handleSubmitReview}
              disabled={submitting || !hasAllRatings()}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 w-full max-w-md shadow-md ${
                hasAllRatings()
                  ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 hover:shadow-lg'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              } ${submitting ? 'opacity-50' : ''}`}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Submitting Reviews...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Submit All Reviews</span>
                </>
              )}
            </button>

            {!hasAllRatings() && (
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-gray-700">
                  Please rate all products to submit your reviews
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
