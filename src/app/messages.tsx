'use client'

import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where, limit } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth, db } from '../lib/firebase'

interface OrderItem {
  productId: string
  name: string
  quantity: number
  price: number
  imageURL: string
  stock: number
}

interface StatusUpdate {
  status: string
  timestamp: any
  updatedBy: string
  updatedByRDC?: string
  updatedByRole: string
}

interface DriverTracking {
  deliveryCompletedAt?: any
  deliveryStartedAt?: any
  deliveryStatus: string
  driverEmail: string
  driverId: string
  estimatedDelivery?: any
  vehicleStatus: string
}

interface ShippingInfo {
  address: string
  city: string
  email: string
  fullName: string
  latitude: number
  longitude: number
  notes: string
  phone: string
  postalCode: string
  status: string
}

interface Order {
  id: string
  orderNumber: string
  customerId: string
  userEmail: string
  items: OrderItem[]
  totalAmount: number
  total: number
  subtotal: number
  shipping: number
  status: 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'rejected'
  paymentStatus: string
  pay: string
  paymentMethod: string
  shippingInfo: ShippingInfo
  createdAt: any
  confirmedAt?: any
  confirmedBy?: string
  confirmedByRDC?: string
  deliveredAt?: any
  deliveryStartedAt?: any
  driverTracking?: DriverTracking
  estimatedDelivery?: any
  paidAt?: any
  stockReduced: boolean
  statusUpdates: StatusUpdate[]
  updatedAt: any
  updatedBy: string
  updatedByRDC?: string | null
  updatedByRole: string
  trackingNumber?: string
}

interface Review {
  id: string
  orderId: string
  productId: string
  rating: number
  review: string
  createdAt: any
  userId?: string
}

export default function MessagesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'topay' | 'toreceive' | 'toreview'>('all')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCheckingAuth(true)
      if (user) {
        setCurrentUserId(user.uid)
        setCurrentUserEmail(user.email)
      } else {
        setCurrentUserId(null)
        setCurrentUserEmail(null)
      }
      setCheckingAuth(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (currentUserEmail) {
      fetchOrders()
      fetchReviews()
    } else if (!checkingAuth) {
      setLoading(false)
    }
  }, [currentUserEmail, checkingAuth])

  async function fetchOrders() {
    try {
      if (!currentUserEmail) return

      const q = query(
        collection(db, 'orders'),
        where('userEmail', '==', currentUserEmail),
        limit(50)
      )

      const querySnapshot = await getDocs(q)
      const ordersData: Order[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const orderStatus = data.status === 'out-for-delivery' ? 'out_for_delivery' : data.status

        ordersData.push({
          id: doc.id,
          orderNumber: data.orderNumber || `ORD-${doc.id.substring(0, 8).toUpperCase()}`,
          customerId: data.userId || currentUserId || '',
          userEmail: data.userEmail || currentUserEmail || '',
          items: data.items || [],
          totalAmount: data.total || 0,
          total: data.total || 0,
          subtotal: data.subtotal || 0,
          shipping: data.shipping || 0,
          status: orderStatus,
          paymentStatus: data.pay === 'paid' ? 'paid' : data.paymentStatus || 'pending',
          pay: data.pay || 'pending',
          paymentMethod: data.paymentMethod || 'cod',
          shippingInfo: data.shippingInfo || {
            address: '',
            city: '',
            email: '',
            fullName: '',
            latitude: 0,
            longitude: 0,
            notes: '',
            phone: '',
            postalCode: '',
            status: '',
          },
          createdAt: data.createdAt,
          confirmedAt: data.confirmedAt,
          confirmedBy: data.confirmedBy,
          confirmedByRDC: data.confirmedByRDC,
          deliveredAt: data.deliveredAt,
          deliveryStartedAt: data.deliveryStartedAt,
          driverTracking: data.driverTracking,
          estimatedDelivery: data.estimatedDelivery,
          paidAt: data.paidAt,
          stockReduced: data.stockReduced || false,
          statusUpdates: data.statusUpdates || [],
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy || '',
          updatedByRDC: data.updatedByRDC,
          updatedByRole: data.updatedByRole || '',
          trackingNumber: data.trackingNumber,
        })
      })

      const sortedOrders = ordersData.sort((a, b) => {
        try {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
          return dateB.getTime() - dateA.getTime()
        } catch (error) {
          return 0
        }
      })

      setOrders(sortedOrders)
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchReviews() {
    try {
      if (!currentUserId) return

      const q = query(collection(db, 'reviews'), where('userId', '==', currentUserId))

      const querySnapshot = await getDocs(q)
      const reviewsData: Review[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        reviewsData.push({
          id: doc.id,
          orderId: data.orderId,
          productId: data.productId,
          rating: data.rating,
          review: data.review,
          createdAt: data.createdAt,
          userId: data.userId,
        })
      })

      setReviews(reviewsData)
    } catch (error) {
      console.error('Error fetching reviews:', error)
    }
  }

  function hasOrderBeenReviewed(orderId: string): boolean {
    return reviews.some((review) => review.orderId === orderId)
  }

  const getFilteredOrders = () => {
    const filteredOrders = orders.filter((order) => order.status !== 'rejected')

    let result
    switch (activeTab) {
      case 'topay':
        result = filteredOrders.filter(
          (order) => order.pay === 'pending' || order.paymentStatus === 'pending'
        )
        break
      case 'toreceive':
        result = filteredOrders.filter((order) => order.status === 'out_for_delivery')
        break
      case 'toreview':
        result = filteredOrders.filter(
          (order) => order.status === 'delivered' && !hasOrderBeenReviewed(order.id)
        )
        break
      default:
        result = filteredOrders
    }

    return result.sort((a, b) => {
      try {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        return dateB.getTime() - dateA.getTime()
      } catch (error) {
        return 0
      }
    })
  }

  const getOrdersToReview = () => {
    return orders.filter((order) => order.status === 'delivered' && !hasOrderBeenReviewed(order.id))
  }

  const stats = {
    topay: orders.filter(
      (order) =>
        (order.pay === 'pending' || order.paymentStatus === 'pending') &&
        order.status !== 'rejected'
    ).length,
    toreceive: orders.filter((order) => order.status === 'out_for_delivery').length,
    toreview: getOrdersToReview().length,
  }

  function formatDate(timestamp: any) {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate()
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
        if (diffHours === 0) {
          const diffMinutes = Math.floor(diffTime / (1000 * 60))
          if (diffMinutes === 0) return 'Just now'
          return `${diffMinutes}m ago`
        }
        return `${diffHours}h ago`
      }
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch (error) {
      return ''
    }
  }

  function formatFullDate(timestamp: any) {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate()
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      return ''
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'confirmed':
        return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'processing':
        return 'text-purple-700 bg-purple-50 border-purple-200'
      case 'out_for_delivery':
        return 'text-orange-700 bg-orange-50 border-orange-200'
      case 'delivered':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'confirmed':
        return 'Confirmed'
      case 'processing':
        return 'Processing'
      case 'out_for_delivery':
        return 'Out for Delivery'
      case 'delivered':
        return 'Delivered'
      case 'rejected':
        return 'Rejected'
      default:
        return status
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
    }
  }

  function getPaymentStatusText(pay: string) {
    switch (pay) {
      case 'paid':
        return 'Paid'
      case 'pending':
        return 'Payment Pending'
      default:
        return pay.charAt(0).toUpperCase() + pay.slice(1)
    }
  }

  function getPaymentStatusColor(pay: string) {
    switch (pay) {
      case 'paid':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  function handleReviewOrder(orderId: string) {
    window.location.href = `/review?orderId=${orderId}`
  }

  function handleTrackOrder(orderId: string) {
    window.location.href = `/tracking?orderId=${orderId}`
  }

  function handleViewDetails(order: Order) {
    setSelectedOrder(order)
    setShowOrderModal(true)
  }

  // ── Auth loading ──────────────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // ── Not logged in ─────────────────────────────────────────────────────────────
  if (!currentUserId) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <CustomerNavbar />
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-600 mt-1">Track, review, and manage your orders</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-24 h-24 mx-auto bg-linear-to-br from-cyan-100 to-blue-200 rounded-2xl flex items-center justify-center mb-6">
              <svg
                className="w-12 h-12 text-cyan-600"
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
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
            <p className="text-gray-500 mb-2">
              Please login to view your orders and track deliveries.
            </p>
            <p className="text-gray-400 text-sm mb-8">
              Login to see your full order history and track your deliveries.
            </p>
            <a
              href="/login?redirect=/messages"
              className="inline-flex items-center justify-center px-8 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition shadow-md"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              Login to Continue
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Main page ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Messages</h1>
          <p className="text-gray-600 mt-1">Track, review, and manage your orders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* To Pay Card */}
          <div
            onClick={() => setActiveTab('topay')}
            className={`bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'topay'
                ? 'border-cyan-500 ring-2 ring-cyan-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="w-14 h-14 bg-linear-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center mb-3">
                  <svg
                    className="w-7 h-7 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">To Pay</p>
                <div className="text-3xl font-bold text-gray-900">{stats.topay}</div>
                <div className="text-xs text-gray-500 mt-1">Pending payment</div>
              </div>
            </div>
          </div>

          {/* To Receive Card */}
          <div
            onClick={() => setActiveTab('toreceive')}
            className={`bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'toreceive'
                ? 'border-cyan-500 ring-2 ring-cyan-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="w-14 h-14 bg-linear-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mb-3">
                  <svg
                    className="w-7 h-7 text-blue-600"
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
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">To Receive</p>
                <div className="text-3xl font-bold text-gray-900">{stats.toreceive}</div>
                <div className="text-xs text-gray-500 mt-1">Out for delivery</div>
              </div>
            </div>
          </div>

          {/* To Review Card */}
          <div
            onClick={() => setActiveTab('toreview')}
            className={`bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer transition-all hover:shadow-md ${
              activeTab === 'toreview'
                ? 'border-cyan-500 ring-2 ring-cyan-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="w-14 h-14 bg-linear-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center mb-3">
                  <svg
                    className="w-7 h-7 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">To Review</p>
                <div className="text-3xl font-bold text-gray-900">{stats.toreview}</div>
                <div className="text-xs text-gray-500 mt-1">Awaiting feedback</div>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Orders List */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
              </div>
            ) : orders.length === 0 ? (
              // ── No orders at all ─────────────────────────────────────────────
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto bg-linear-to-br from-cyan-100 to-blue-200 rounded-2xl flex items-center justify-center mb-6">
                  <svg
                    className="w-12 h-12 text-cyan-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No orders yet</h3>
                <p className="text-gray-500 mb-8">Looks like you haven't placed any orders yet.</p>
                <a
                  href="/products"
                  className="inline-flex items-center justify-center px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition shadow-md"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  Start Shopping
                </a>
              </div>
            ) : getFilteredOrders().length === 0 ? (
              // ── Orders exist but none match current tab filter ───────────────
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto bg-linear-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-6">
                  <svg
                    className="w-12 h-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No orders in this category</h3>
                <p className="text-gray-500 mb-6">You don't have any orders here right now.</p>
                <button
                  onClick={() => setActiveTab('all')}
                  className="inline-flex items-center px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition shadow-md"
                >
                  View All Orders
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {getFilteredOrders().map((order) => {
                  const canReview = order.status === 'delivered' && !hasOrderBeenReviewed(order.id)
                  const isPaid = order.pay === 'paid' || order.paymentStatus === 'paid'

                  return (
                    <div
                      key={order.id}
                      className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all"
                    >
                      {/* Order Header */}
                      <div className="bg-linear-to-r from-gray-50 to-gray-100/50 px-6 py-4 border-b-2 border-gray-200">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center flex-wrap gap-3 mb-3">
                              <h3 className="text-base font-bold text-gray-900">
                                Order #{order.orderNumber || order.id.substring(0, 8)}
                              </h3>
                              <span
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(order.status)}`}
                              >
                                {getStatusText(order.status)}
                              </span>
                              <span
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getPaymentStatusColor(order.pay)}`}
                              >
                                {getPaymentStatusText(order.pay)}
                              </span>
                              {canReview && (
                                <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-linear-to-r from-green-100 to-green-200 text-green-800 border border-green-300">
                                  ⭐ Ready to Review
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              <p className="text-gray-600">
                                <span className="font-medium text-gray-700">Placed:</span>{' '}
                                {formatDate(order.createdAt)}
                              </p>
                              {order.confirmedAt && (
                                <p className="text-gray-600">
                                  <span className="font-medium text-gray-700">Confirmed:</span>{' '}
                                  {formatDate(order.confirmedAt)}
                                </p>
                              )}
                              {order.deliveredAt && (
                                <p className="text-gray-600">
                                  <span className="font-medium text-gray-700">Delivered:</span>{' '}
                                  {formatDate(order.deliveredAt)}
                                </p>
                              )}
                              {order.trackingNumber && (
                                <p className="text-gray-600">
                                  <span className="font-medium text-gray-700">Tracking:</span>{' '}
                                  {order.trackingNumber}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-left lg:text-right">
                            <div className="text-2xl font-bold bg-linear-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                              LKR{' '}
                              {order.total?.toLocaleString() ||
                                order.totalAmount?.toLocaleString() ||
                                '0'}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                              {order.shipping > 0 &&
                                ` • Shipping: LKR ${order.shipping.toLocaleString()}`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="p-6">
                        <div className="space-y-4 mb-6">
                          {order.items?.slice(0, 2).map((item, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="w-20 h-20 bg-white rounded-lg overflow-hidden shrink-0 border-2 border-gray-200">
                                <img
                                  src={item.imageURL || 'https://via.placeholder.com/400'}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src =
                                      'https://via.placeholder.com/400?text=No+Image'
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate mb-1">
                                  {item.name}
                                </h4>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                  <span className="font-medium">Qty: {item.quantity}</span>
                                  <span>•</span>
                                  <span>LKR {item.price?.toLocaleString() || '0'} each</span>
                                  <span>•</span>
                                  <span className="font-semibold text-orange-600">
                                    Total: LKR{' '}
                                    {(item.quantity * item.price)?.toLocaleString() || '0'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}

                          {order.items?.length > 2 && (
                            <div className="text-center py-3 bg-gray-50 rounded-lg">
                              <p className="text-sm font-medium text-gray-600">
                                +{order.items.length - 2} more item
                                {order.items.length - 2 !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t-2 border-gray-200">
                          <button
                            onClick={() => handleViewDetails(order)}
                            className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 transition"
                          >
                            <svg
                              className="w-4 h-4 inline-block mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            View Details
                          </button>

                          {canReview && (
                            <button
                              onClick={() => handleReviewOrder(order.id)}
                              className="px-4 py-2.5 bg-linear-to-r from-green-500 to-green-600 text-white rounded-lg text-sm font-semibold hover:from-green-600 hover:to-green-700 transition shadow-md"
                            >
                              <svg
                                className="w-4 h-4 inline-block mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                              </svg>
                              Rate & Review
                            </button>
                          )}

                          {order.status === 'out_for_delivery' && order.driverTracking && (
                            <button
                              onClick={() => handleTrackOrder(order.id)}
                              className="px-4 py-2.5 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-md"
                            >
                              <svg
                                className="w-4 h-4 inline-block mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                />
                              </svg>
                              Track Order
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-linear-to-r from-cyan-500 to-blue-600 px-6 py-5 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">Order Details</h3>
                <p className="text-cyan-50 text-sm mt-1">
                  #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
                </p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                aria-label="Close order details"
                className="text-white/80 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Order Status */}
              <div className="mb-6 p-4 bg-linear-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 ${getStatusColor(selectedOrder.status)}`}
                  >
                    {getStatusText(selectedOrder.status)}
                  </span>
                  <span
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 ${getPaymentStatusColor(selectedOrder.pay)}`}
                  >
                    {getPaymentStatusText(selectedOrder.pay)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Placed:</span>
                    <p className="font-semibold text-gray-900">
                      {formatFullDate(selectedOrder.createdAt)}
                    </p>
                  </div>
                  {selectedOrder.deliveredAt && (
                    <div>
                      <span className="text-gray-600">Delivered:</span>
                      <p className="font-semibold text-gray-900">
                        {formatFullDate(selectedOrder.deliveredAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Order Items</h4>
                <div className="space-y-3">
                  {selectedOrder.items?.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200"
                    >
                      <div className="w-20 h-20 bg-white rounded-lg overflow-hidden shrink-0 border-2 border-gray-300">
                        <img
                          src={item.imageURL || 'https://via.placeholder.com/400'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/400?text=No+Image'
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900 mb-2">{item.name}</h5>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                          <span className="font-medium">Qty: {item.quantity}</span>
                          <span>•</span>
                          <span>LKR {item.price?.toLocaleString() || '0'} each</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">
                          LKR {(item.quantity * item.price)?.toLocaleString() || '0'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="mb-6 p-4 bg-linear-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Subtotal</span>
                    <span className="font-semibold text-gray-900">
                      LKR {selectedOrder.subtotal?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Shipping Fee</span>
                    <span
                      className={`font-semibold ${selectedOrder.shipping === 0 ? 'text-green-700' : 'text-gray-900'}`}
                    >
                      {selectedOrder.shipping === 0
                        ? 'FREE'
                        : `LKR ${selectedOrder.shipping?.toLocaleString() || '0'}`}
                    </span>
                  </div>
                  <div className="border-t-2 border-orange-300 pt-2 mt-2 flex justify-between">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-orange-600">
                      LKR{' '}
                      {selectedOrder.total?.toLocaleString() ||
                        selectedOrder.totalAmount?.toLocaleString() ||
                        '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shipping Information */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Shipping Information</h4>
                <div className="p-4 bg-linear-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 space-y-2 text-sm">
                  <div className="flex">
                    <span className="text-gray-700 w-32 font-medium">Name:</span>
                    <span className="text-gray-900 font-semibold">
                      {selectedOrder.shippingInfo?.fullName}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-700 w-32 font-medium">Phone:</span>
                    <span className="text-gray-900 font-semibold">
                      {selectedOrder.shippingInfo?.phone}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-700 w-32 font-medium">Email:</span>
                    <span className="text-gray-900 font-semibold">
                      {selectedOrder.shippingInfo?.email}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-700 w-32 font-medium">Address:</span>
                    <span className="text-gray-900 font-semibold flex-1">
                      {selectedOrder.shippingInfo?.address}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-700 w-32 font-medium">City:</span>
                    <span className="text-gray-900 font-semibold">
                      {selectedOrder.shippingInfo?.city}
                    </span>
                  </div>
                  {selectedOrder.shippingInfo?.postalCode && (
                    <div className="flex">
                      <span className="text-gray-700 w-32 font-medium">Postal Code:</span>
                      <span className="text-gray-900 font-semibold">
                        {selectedOrder.shippingInfo?.postalCode}
                      </span>
                    </div>
                  )}
                  {selectedOrder.shippingInfo?.notes && (
                    <div className="flex">
                      <span className="text-gray-700 w-32 font-medium">Notes:</span>
                      <span className="text-gray-900 font-semibold flex-1">
                        {selectedOrder.shippingInfo?.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4">Payment Information</h4>
                <div className="p-4 bg-linear-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 space-y-2 text-sm">
                  <div className="flex">
                    <span className="text-gray-700 w-32 font-medium">Method:</span>
                    <span className="text-gray-900 font-semibold capitalize">
                      {selectedOrder.paymentMethod || 'Cash on Delivery'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-700 w-32 font-medium">Status:</span>
                    <span
                      className={`font-semibold ${selectedOrder.pay === 'paid' ? 'text-green-700' : 'text-yellow-700'}`}
                    >
                      {selectedOrder.pay === 'paid' ? '✅ Paid' : '⏳ Payment Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t-2 border-gray-200 rounded-b-2xl">
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-full px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:from-cyan-600 hover:to-blue-700 transition shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
