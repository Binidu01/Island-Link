'use client'

import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth, db } from '../lib/firebase'

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  imageURL: string
  stock?: number
}

interface ShippingInfo {
  fullName: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  notes?: string
  latitude?: number
  longitude?: number
}

interface StatusUpdate {
  status: string
  timestamp: any
  updatedBy: string
  updatedByRDC?: string
  updatedByRole?: string
  rejectionReason?: string
}

interface Order {
  id: string
  userId: string
  userEmail: string
  items: CartItem[]
  shippingInfo: ShippingInfo
  paymentMethod: string
  subtotal: number
  shipping: number
  total: number
  status: string
  shippingStatus?: string
  createdAt: any
  updatedAt?: any
  trackingNumber?: string

  // Status history array
  statusUpdates?: StatusUpdate[]

  // Delivery tracking fields
  deliveryStartedAt?: any
  estimatedDelivery?: any
  deliveredAt?: any
  rejectedAt?: any
  rejectionReason?: string
  updatedBy?: string
  updatedByRole?: string
  updatedByRDC?: string

  // Payment details for online payments
  paymentDetails?: {
    cardLast4: string
    cardName: string
    transactionId: string
    paidAt: any
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        loadOrders(currentUser.uid)
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, selectedStatus, searchQuery])

  async function loadOrders(userId: string) {
    try {
      const ordersQuery = query(collection(db, 'orders'), where('userId', '==', userId))

      const querySnapshot = await getDocs(ordersQuery)
      const ordersData: Order[] = []
      const userIdsToFetch = new Set<string>()

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        ordersData.push({
          id: docSnap.id,
          ...data,
          trackingNumber: data.trackingNumber || `ORD-${docSnap.id.toUpperCase()}`,
        } as Order)

        if (data.updatedBy) {
          userIdsToFetch.add(data.updatedBy)
        }
        if (data.statusUpdates && Array.isArray(data.statusUpdates)) {
          data.statusUpdates.forEach((update: StatusUpdate) => {
            if (update.updatedBy) {
              userIdsToFetch.add(update.updatedBy)
            }
          })
        }
      })

      ordersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
        return dateB.getTime() - dateA.getTime()
      })

      setOrders(ordersData)

      const names: Record<string, string> = {}
      for (const identifier of userIdsToFetch) {
        const name = await getUserDisplayName(identifier)
        names[identifier] = name
      }
      setUserNames(names)
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function getUserDisplayName(email: string): Promise<string> {
    try {
      const usersQuery = query(collection(db, 'users'), where('email', '==', email))
      const querySnapshot = await getDocs(usersQuery)

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data()
        return userData.fullName || email
      }
      return getNameFromEmail(email)
    } catch (error) {
      console.error('Error fetching user name:', error)
      return getNameFromEmail(email)
    }
  }

  function getNameFromEmail(email: string): string {
    if (!email || !email.includes('@')) return email
    const username = email.split('@')[0]
    return username.charAt(0).toUpperCase() + username.slice(1)
  }

  function filterOrders() {
    let filtered = [...orders]

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((order) => {
        const orderStatus = (order.shippingStatus || order.status).toLowerCase()
        return orderStatus === selectedStatus.toLowerCase()
      })
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.items.some((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    setFilteredOrders(filtered)
  }

  function formatDate(timestamp: any) {
    if (!timestamp) return 'N/A'

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch (error) {
      return 'N/A'
    }
  }

  function formatDateTime(timestamp: any) {
    if (!timestamp) return 'N/A'

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
      const formattedDate = date.toLocaleDateString('en-US', options)
      const [monthDay, yearTime] = formattedDate.split(', ')
      const [month, day] = monthDay.split(' ')
      const timePart = yearTime ? yearTime.split(', ')[1] || yearTime : ''
      return `${month} ${day}, ${timePart}`
    } catch (error) {
      return 'N/A'
    }
  }

  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'paid':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'confirmed':
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'out for delivery':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  function getStatusIcon(status: string) {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'paid':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )
      case 'confirmed':
      case 'processing':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        )
      case 'out for delivery':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
            />
          </svg>
        )
      case 'delivered':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'rejected':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )
      default:
        return null
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      pending: 'Order Placed',
      paid: 'Payment Confirmed',
      confirmed: 'Order Confirmed',
      processing: 'Processing',
      'out for delivery': 'Out For Delivery',
      delivered: 'Delivered',
      rejected: 'Rejected',
    }
    return labels[status.toLowerCase()] || status
  }

  function buildTimeline(order: Order) {
    const timeline: Array<{
      status: string
      message: string
      location?: string
      timestamp: any
      person?: string
      userId?: string
    }> = []

    if (order.statusUpdates && Array.isArray(order.statusUpdates)) {
      order.statusUpdates.forEach((update: StatusUpdate) => {
        let message = ''
        const status = update.status?.toLowerCase() || ''

        switch (status) {
          case 'pending':
            message = `Order placed successfully. Payment method: ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}`
            break
          case 'paid':
            message = `Payment confirmed${order.paymentDetails ? `. Transaction ID: ${order.paymentDetails.transactionId}` : ''}`
            break
          case 'confirmed':
            message = `Order confirmed by RDC staff`
            break
          case 'processing':
            message = `Order is being processed at RDC`
            break
          case 'out for delivery':
            message = `Our courier is on the way to deliver your parcel!`
            break
          case 'delivered':
            message = `Successfully delivered to ${order.shippingInfo?.fullName || 'customer'}`
            break
          case 'rejected':
            message = update.rejectionReason || 'Order was rejected'
            break
          default:
            message = `Order status updated to ${update.status}`
        }

        let location = order.shippingInfo?.city
        if (status !== 'delivered' && status !== 'rejected') {
          location = update.updatedByRDC || order.shippingInfo?.city
        }

        timeline.push({
          status: update.status,
          message: message,
          location: location,
          timestamp: update.timestamp,
          person: update.updatedBy,
          userId: update.updatedBy,
        })
      })
    } else {
      const currentStatus = (order.shippingStatus || order.status).toLowerCase()

      if (order.createdAt) {
        timeline.push({
          status: 'pending',
          message: `Order placed successfully. Payment method: ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}`,
          location: order.shippingInfo?.city,
          timestamp: order.createdAt,
        })
      }

      if (order.paymentMethod === 'online' && order.paymentDetails) {
        timeline.push({
          status: 'paid',
          message: `Payment confirmed. Transaction ID: ${order.paymentDetails.transactionId}`,
          location: order.shippingInfo?.city,
          timestamp: order.paymentDetails.paidAt || order.createdAt,
        })
      }

      if (order.deliveredAt) {
        timeline.push({
          status: 'delivered',
          message: `Successfully delivered to ${order.shippingInfo?.fullName}`,
          location: order.shippingInfo?.city,
          timestamp: order.deliveredAt,
          person: order.updatedBy,
          userId: order.updatedBy,
        })
      }

      if (order.rejectedAt) {
        timeline.push({
          status: 'rejected',
          message: order.rejectionReason || 'Order rejected during delivery',
          location: order.shippingInfo?.city,
          timestamp: order.rejectedAt,
          person: order.updatedBy,
          userId: order.updatedBy,
        })
      }
    }

    return timeline.sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0)
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0)
      return dateA.getTime() - dateB.getTime()
    })
  }

  function toggleOrderExpansion(orderId: string) {
    setExpandedOrder(expandedOrder === orderId ? null : orderId)
  }

  function openCancelModal(orderId: string) {
    setOrderToCancel(orderId)
    setShowCancelModal(true)
  }

  async function confirmCancelOrder() {
    if (!orderToCancel) return

    setCancellingOrderId(orderToCancel)
    setShowCancelModal(false)

    try {
      const orderRef = doc(db, 'orders', orderToCancel)
      await updateDoc(orderRef, {
        status: 'cancelled',
        shippingStatus: 'cancelled',
        updatedAt: new Date(),
      })

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderToCancel
            ? { ...order, status: 'cancelled', shippingStatus: 'cancelled' }
            : order
        )
      )

      setModalMessage('Order cancelled successfully!')
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error cancelling order:', error)
      setModalMessage('Failed to cancel order. Please try again.')
      setShowSuccessModal(true)
    } finally {
      setCancellingOrderId(null)
      setOrderToCancel(null)
    }
  }

  function CancelModal() {
    if (!showCancelModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Cancel Order?</h3>
          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to cancel this order? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowCancelModal(false)
                setOrderToCancel(null)
              }}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Keep Order
            </button>
            <button
              onClick={confirmCancelOrder}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Yes, Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  function SuccessModal() {
    if (!showSuccessModal) return null

    const isSuccess = modalMessage.includes('successfully') || modalMessage.includes('copied')

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
          <div
            className={`flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-4 ${
              isSuccess ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            {isSuccess ? (
              <svg
                className="w-8 h-8 text-green-600"
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
            ) : (
              <svg
                className="w-8 h-8 text-red-600"
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
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
            {isSuccess ? 'Success!' : 'Error'}
          </h3>
          <p className="text-gray-600 text-center mb-6">{modalMessage}</p>
          <button
            onClick={() => setShowSuccessModal(false)}
            className={`w-full px-4 py-3 rounded-lg font-semibold transition ${
              isSuccess
                ? 'bg-linear-to-r from-cyan-400 to-blue-500 text-white hover:from-cyan-500 hover:to-blue-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
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
          <div className="bg-white rounded-xl shadow-sm p-12">
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
            <p className="text-gray-500 mb-6">Please login to view your orders</p>
            <a
              href="/login?redirect=/orders"
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

      <CancelModal />
      <SuccessModal />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 mt-1">Track and manage your orders</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading your orders...</p>
            </div>
          </div>
        ) : orders.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Orders Yet</h2>
            <p className="text-gray-500 mb-6">
              You haven't placed any orders yet. Start shopping to see your orders here!
            </p>
            <a
              href="/products"
              className="inline-block px-8 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition"
            >
              Start Shopping
            </a>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
                    <input
                      type="text"
                      placeholder="Search by Order ID, Tracking Number or Product..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { value: 'all', label: 'All', count: orders.length },
                    {
                      value: 'pending',
                      label: 'Pending',
                      count: orders.filter((o) =>
                        ['pending', 'paid'].includes((o.shippingStatus || o.status).toLowerCase())
                      ).length,
                    },
                    {
                      value: 'processing',
                      label: 'Processing',
                      count: orders.filter(
                        (o) => (o.shippingStatus || o.status).toLowerCase() === 'processing'
                      ).length,
                    },
                    {
                      value: 'delivered',
                      label: 'Delivered',
                      count: orders.filter(
                        (o) => (o.shippingStatus || o.status).toLowerCase() === 'delivered'
                      ).length,
                    },
                    {
                      value: 'rejected',
                      label: 'Rejected',
                      count: orders.filter(
                        (o) => (o.shippingStatus || o.status).toLowerCase() === 'rejected'
                      ).length,
                    },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setSelectedStatus(filter.value)}
                      className={`px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                        selectedStatus === filter.value
                          ? 'bg-linear-to-r from-orange-500 to-orange-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Found</h3>
                <p className="text-gray-500">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const timeline = buildTimeline(order)
                  const isExpanded = expandedOrder === order.id
                  const displayStatus = order.shippingStatus || order.status
                  const isFinalStatus =
                    displayStatus.toLowerCase() === 'delivered' ||
                    displayStatus.toLowerCase() === 'rejected'

                  return (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900 text-lg">
                                Order #{order.id.substring(0, 8).toUpperCase()}
                              </h3>
                              <div
                                className={`flex items-center gap-2 px-3 py-1 rounded-full border-2 text-sm font-medium ${getStatusColor(displayStatus)}`}
                              >
                                {getStatusIcon(displayStatus)}
                                <span>{getStatusLabel(displayStatus)}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
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
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                <span>{formatDate(order.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-1">
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
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                  />
                                </svg>
                                <span>
                                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                                </span>
                              </div>
                              {order.trackingNumber && (
                                <div className="flex items-center gap-1 font-mono text-blue-600">
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
                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                    />
                                  </svg>
                                  <span>{order.trackingNumber}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Total</p>
                              <p className="text-2xl font-bold text-orange-600">
                                LKR {order.total.toLocaleString()}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleOrderExpansion(order.id)}
                              aria-label={
                                isExpanded ? 'Collapse order details' : 'Expand order details'
                              }
                              className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                              <svg
                                className={`w-6 h-6 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-6 bg-gray-50">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Delivery Timeline */}
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-gray-900">Delivery Timeline</h4>
                                {order.trackingNumber && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(order.trackingNumber || '')
                                      setModalMessage('Tracking number copied!')
                                      setShowSuccessModal(true)
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                  >
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                      />
                                    </svg>
                                    Copy Tracking
                                  </button>
                                )}
                              </div>

                              <div className="bg-white rounded-lg p-4">
                                <div className="space-y-4">
                                  {timeline.map((update, index) => {
                                    const isActive = update.timestamp
                                    const isFirst = index === 0
                                    const statusLower = update.status?.toLowerCase() || ''

                                    const showTrackingButton =
                                      statusLower === 'out for delivery' && !isFinalStatus

                                    return (
                                      <div key={index} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                          <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                              isActive
                                                ? 'bg-linear-to-br from-blue-500 to-cyan-400 text-white shadow-lg'
                                                : 'bg-gray-200 text-gray-400'
                                            }`}
                                          >
                                            {getStatusIcon(update.status)}
                                          </div>
                                          {index < timeline.length - 1 && (
                                            <div
                                              className={`w-0.5 h-full min-h-10 ${
                                                isActive ? 'bg-blue-300' : 'bg-gray-200'
                                              }`}
                                            />
                                          )}
                                        </div>

                                        <div className="flex-1 pb-4">
                                          <div className="flex items-start justify-between mb-1">
                                            <h5
                                              className={`font-semibold ${
                                                isActive ? 'text-gray-900' : 'text-gray-400'
                                              }`}
                                            >
                                              {getStatusLabel(update.status)}
                                            </h5>
                                            {update.timestamp && (
                                              <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                                {formatDateTime(update.timestamp)}
                                              </span>
                                            )}
                                          </div>
                                          <p
                                            className={`text-sm ${
                                              isActive ? 'text-gray-600' : 'text-gray-400'
                                            }`}
                                          >
                                            {update.message}
                                          </p>
                                          {update.location && isActive && (
                                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                              <svg
                                                className="w-3 h-3"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                />
                                              </svg>
                                              <span>{update.location}</span>
                                            </div>
                                          )}
                                          {update.person && (
                                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                              <svg
                                                className="w-3 h-3"
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
                                              <span>
                                                By{' '}
                                                {userNames[update.person] ||
                                                  getNameFromEmail(update.person)}
                                              </span>
                                            </div>
                                          )}
                                          {showTrackingButton && (
                                            <div className="mt-2">
                                              <a
                                                href={`/tracking?id=${order.id}`}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition text-sm shadow-md"
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
                                                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                                  />
                                                </svg>
                                                Live Track Order
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Order Details */}
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
                                <div className="bg-white rounded-lg p-4 space-y-3">
                                  {order.items.map((item, index) => (
                                    <div key={index} className="flex gap-3">
                                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                        <img
                                          src={item.imageURL}
                                          alt={item.name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h5 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                                          {item.name}
                                        </h5>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-gray-500">
                                            Qty: {item.quantity}
                                          </span>
                                          <span className="text-sm font-semibold text-orange-600">
                                            LKR {(item.price * item.quantity).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <div className="border-t pt-3 space-y-2">
                                    <div className="flex justify-between text-sm text-gray-600">
                                      <span>Subtotal</span>
                                      <span>LKR {order.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600">
                                      <span>Shipping</span>
                                      <span
                                        className={
                                          order.shipping === 0 ? 'text-green-600 font-medium' : ''
                                        }
                                      >
                                        {order.shipping === 0
                                          ? 'FREE'
                                          : `LKR ${order.shipping.toLocaleString()}`}
                                      </span>
                                    </div>
                                    <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t">
                                      <span>Total</span>
                                      <span className="text-orange-600">
                                        LKR {order.total.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold text-gray-900 mb-3">
                                  Shipping Information
                                </h4>
                                <div className="bg-white rounded-lg p-4 space-y-3 text-sm">
                                  <div>
                                    <p className="text-xs text-gray-500">Recipient</p>
                                    <p className="font-medium text-gray-900">
                                      {order.shippingInfo.fullName}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Phone</p>
                                    <p className="font-medium text-gray-900">
                                      {order.shippingInfo.phone}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Address</p>
                                    <p className="font-medium text-gray-900">
                                      {order.shippingInfo.address}
                                    </p>
                                    <p className="text-gray-600">
                                      {order.shippingInfo.city}
                                      {order.shippingInfo.postalCode &&
                                        ` - ${order.shippingInfo.postalCode}`}
                                    </p>
                                  </div>
                                  {order.shippingInfo.notes && (
                                    <div>
                                      <p className="text-xs text-gray-500">Notes</p>
                                      <p className="font-medium text-gray-900">
                                        {order.shippingInfo.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold text-gray-900 mb-3">
                                  Payment Information
                                </h4>
                                <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Method</span>
                                    <span className="font-medium text-gray-900 capitalize">
                                      {order.paymentMethod === 'cod'
                                        ? 'Cash on Delivery'
                                        : 'Online Payment'}
                                    </span>
                                  </div>
                                  {order.paymentDetails && (
                                    <>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Card</span>
                                        <span className="font-medium text-gray-900">
                                          **** {order.paymentDetails.cardLast4}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Transaction ID</span>
                                        <span className="font-mono text-xs text-gray-900">
                                          {order.paymentDetails.transactionId}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2">
                                {['pending', 'paid'].includes(displayStatus.toLowerCase()) && (
                                  <button
                                    onClick={() => openCancelModal(order.id)}
                                    disabled={cancellingOrderId === order.id}
                                    className="w-full py-2.5 bg-white border-2 border-red-300 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition disabled:opacity-50"
                                  >
                                    {cancellingOrderId === order.id
                                      ? 'Cancelling...'
                                      : 'Cancel Order'}
                                  </button>
                                )}
                                <a
                                  href={`/order-success?orderId=${order.id}`}
                                  className="block w-full py-2.5 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition text-center"
                                >
                                  View Receipt
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

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
