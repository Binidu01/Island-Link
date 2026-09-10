'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import LogisticsNavbar from '../components/LogisticsNavbar'
import { db, auth } from '../lib/firebase'

interface Order {
  id: string
  orderNumber?: string
  customerName?: string
  customerId: string
  totalAmount: number
  status: string
  items: Array<{
    productId: string
    productName: string
    quantity: number
    price: number
    sku: string
  }>
  createdAt: any
  deliveryAddress?: string
  rdcLocation?: string
  estimatedDelivery?: string
  shippingInfo?: {
    fullName: string
    email: string
    phone: string
    address: string
    city: string
    postalCode: string
    notes?: string
  }
  shippingStatus?: string
  trackingNumber?: string
  carrier?: string
  shipmentDate?: any
  deliveryDate?: any
  route?: string
  vehicle?: string
  driver?: string
  location?: string
  rdc?: string
  userEmail?: string
  total?: number
}

interface Route {
  id: string
  routeNumber: string
  origin: string
  destination: string
  distance: number
  estimatedDuration: number
  status: string
  assignedVehicle?: string
  assignedDriver?: string
  scheduledDeparture: any
  scheduledArrival: any
  shipments: string[]
  usedAt?: any // Added for TypeScript fix
}

export default function LogisticsDashboard() {
  const [initialLoading, setInitialLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [logisticsStaff, setLogisticsStaff] = useState(false)
  const [userRdcLocation, setUserRdcLocation] = useState<string>('')

  // Separate loading states for each section
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [routesLoading, setRoutesLoading] = useState(true)

  // Stats state
  const [stats, setStats] = useState({
    totalOrders: 0,
    processingOrders: 0,
    outForDelivery: 0,
    deliveredToday: 0,
    deliveredCount: 0,
    rejectedCount: 0,
    activeRoutes: 0,
    onTimeDelivery: 0,
  })

  // Data states
  const [rdcOrders, setRdcOrders] = useState<Order[]>([])
  const [processingOrders, setProcessingOrders] = useState<Order[]>([])
  const [activeRoutes, setActiveRoutes] = useState<Route[]>([])

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setUser(currentUser)

      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const userRole = userData.role?.toLowerCase()
          const isLogisticsStaff = userRole === 'logistics team'
          setLogisticsStaff(isLogisticsStaff)

          // Get user's RDC location
          const userRdc = userData.rdc || userData.rdcLocation || 'South RDC'
          setUserRdcLocation(userRdc)

          if (!isLogisticsStaff) {
            window.location.href = '/'
            return
          }

          setupListeners(userRdc)
          setInitialLoading(false)
        } else {
          console.error('User document not found')
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking logistics staff status:', error)
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  // Setup real-time listeners
  const setupListeners = (rdcLocation: string) => {
    setOrdersLoading(true)
    setRoutesLoading(true)

    console.log(`Setting up listeners for RDC: ${rdcLocation}`)

    // Listen to orders collection for specific RDC
    const ordersUnsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        try {
          const allOrders = snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
              id: doc.id,
              ...data,
              // Check for rdcLocation in different possible field names
              rdcLocation: data.rdcLocation || data.location || data.rdc || rdcLocation,
            }
          }) as Order[]

          // Filter orders by this RDC location
          const rdcOrdersData = allOrders.filter((o) => {
            const orderRDC = o.rdcLocation || o.location || o.rdc
            return orderRDC === rdcLocation
          })

          console.log(`Filtered orders for ${rdcLocation}: ${rdcOrdersData.length} orders`)

          // Sort by creation date (newest first)
          rdcOrdersData.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0
            const bTime = b.createdAt?.seconds || 0
            return bTime - aTime
          })

          // Set RDC orders
          setRdcOrders(rdcOrdersData)

          // Find orders with "processing" status only (these are ready for delivery planning)
          const processingOrdersData = rdcOrdersData.filter((o) => o.status === 'processing')
          setProcessingOrders(processingOrdersData.slice(0, 10)) // Show top 10

          // Calculate order stats for this RDC
          const totalOrders = rdcOrdersData.length
          const processingCount = processingOrdersData.length
          const outForDeliveryCount = rdcOrdersData.filter(
            (o) => o.status === 'out for delivery'
          ).length
          const rejectedCount = rdcOrdersData.filter((o) => o.status === 'rejected').length
          const deliveredCount = rdcOrdersData.filter(
            (o) => o.status === 'delivered' || o.status === 'completed'
          ).length

          // Calculate today's delivered orders
          const today = new Date().toISOString().split('T')[0]
          const deliveredToday = rdcOrdersData.filter((o) => {
            const deliveryDate = o.deliveryDate
            return (
              deliveryDate?.includes(today) &&
              (o.status === 'delivered' || o.status === 'completed')
            )
          }).length

          // Calculate on-time delivery rate
          const totalDelivered = rdcOrdersData.filter(
            (o) => o.status === 'delivered' || o.status === 'completed'
          ).length
          const onTimeDelivered = rdcOrdersData.filter((o) => {
            if (o.status !== 'delivered' && o.status !== 'completed') return false
            const deliveryDate = o.deliveryDate ? new Date(o.deliveryDate) : null
            const estimated = o.estimatedDelivery ? new Date(o.estimatedDelivery) : null
            if (!deliveryDate || !estimated) return false
            return deliveryDate <= estimated
          }).length

          const onTimeDeliveryRate =
            totalDelivered > 0 ? Math.round((onTimeDelivered / totalDelivered) * 100) : 0

          setStats((prev) => ({
            ...prev,
            totalOrders,
            processingOrders: processingCount,
            outForDelivery: outForDeliveryCount,
            rejectedCount,
            deliveredCount,
            deliveredToday,
            onTimeDelivery: onTimeDeliveryRate,
          }))

          setOrdersLoading(false)
        } catch (error) {
          console.error('Error processing orders data:', error)
          setOrdersLoading(false)
        }
      },
      (error) => {
        console.error('Error listening to orders:', error)
        setOrdersLoading(false)
      }
    )

    // Listen to routeSessions collection for active delivery routes
    const routeSessionsUnsubscribe = onSnapshot(
      collection(db, 'routeSessions'),
      (snapshot) => {
        try {
          const sessionsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as any[]

          console.log(`Total route sessions: ${sessionsData.length}`)

          // Filter sessions for this user's RDC
          // Show both active sessions AND recently created sessions (within last 2 hours)
          const now = new Date()
          const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

          const relevantSessions = sessionsData.filter((s) => {
            const sessionRDC = s.userRDC === rdcLocation

            // Check if created within last 2 hours
            const createdAt = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt)
            const isRecent = createdAt > twoHoursAgo

            // Check if expires date hasn't passed by more than 1 hour (grace period)
            const expiresAt = s.expiresAt?.toDate ? s.expiresAt.toDate() : new Date(s.expiresAt)
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
            const notTooOld = expiresAt > oneHourAgo

            return sessionRDC && (s.isActive || (isRecent && notTooOld))
          })

          console.log(`Relevant sessions for ${rdcLocation}: ${relevantSessions.length}`)

          // Convert to route format for display
          const activeRoutesData = relevantSessions.map((session) => ({
            id: session.sessionId,
            routeNumber: `ROUTE-${session.sessionId.split('-').pop()?.toUpperCase().slice(0, 6) || 'UNKNOWN'}`,
            origin: rdcLocation,
            destination: 'Multiple Locations',
            distance: 0,
            estimatedDuration: 0,
            status: session.isActive ? 'active' : 'recent',
            assignedDriver: session.userEmail,
            scheduledDeparture: session.createdAt,
            scheduledArrival: null,
            shipments: session.selectedOrderIds || [],
            usedAt: session.usedAt,
          }))

          // Sort by creation date (newest first)
          activeRoutesData.sort((a, b) => {
            const aTime = a.scheduledDeparture?.seconds || 0
            const bTime = b.scheduledDeparture?.seconds || 0
            return bTime - aTime
          })

          setActiveRoutes(activeRoutesData.slice(0, 5))

          // Calculate active routes count (only truly active ones)
          const activeCount = relevantSessions.filter((s) => s.isActive).length

          setStats((prev) => ({
            ...prev,
            activeRoutes: activeCount,
          }))

          setRoutesLoading(false)
        } catch (error) {
          console.error('Error processing route sessions data:', error)
          setRoutesLoading(false)
        }
      },
      (error) => {
        console.error('Error listening to route sessions:', error)
        setRoutesLoading(false)
      }
    )

    // Cleanup listeners
    return () => {
      ordersUnsubscribe()
      routeSessionsUnsubscribe()
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    try {
      let date: Date
      if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000)
      } else if (timestamp.toDate) {
        date = timestamp.toDate()
      } else {
        date = new Date(timestamp)
      }

      if (isNaN(date.getTime())) {
        return 'Invalid date'
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      console.error('Error formatting timestamp:', error)
      return 'N/A'
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'

    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'out for delivery':
        return 'bg-blue-100 text-blue-800'
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    if (!amount) return 'LKR 0.00'
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Get customer name from order
  const getCustomerName = (order: Order) => {
    if (order.shippingInfo?.fullName) return order.shippingInfo.fullName
    if (order.customerName) return order.customerName
    if (order.userEmail) return order.userEmail.split('@')[0]
    return 'Customer'
  }

  // Get order number
  const getOrderNumber = (order: Order) => {
    if (order.orderNumber) return `#${order.orderNumber}`
    if (order.id) return `ORD-${order.id.slice(-6).toUpperCase()}`
    return 'Order'
  }

  // Get city from address
  const getCityFromAddress = (order: Order) => {
    if (order.shippingInfo?.city) return order.shippingInfo.city
    if (order.deliveryAddress) {
      // Try to extract city from address
      const parts = order.deliveryAddress.split(',')
      return parts.length > 1 ? parts[parts.length - 3]?.trim() || 'Unknown' : 'Unknown'
    }
    return 'Unknown'
  }

  // Get items count from order
  const getOrderItemsCount = (order: Order) => {
    if (order.items && Array.isArray(order.items)) {
      return order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    }
    return 0
  }

  // If initial loading, show loading screen
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading logistics dashboard...</p>
        </div>
      </div>
    )
  }

  // If not logistics staff, show loading or redirect
  if (!logisticsStaff) {
    return (
      <div className="min-h-screen bg-linear-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to home page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-blue-50 to-purple-50">
      <LogisticsNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Logistics Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Welcome back! {userRdcLocation} • Real-time delivery overview
              </p>
              {/* Debug Info */}
              {rdcOrders.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  Order statuses in system:{' '}
                  {[...new Set(rdcOrders.map((o) => o.status))].join(', ')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-linear-to-r from-green-500 to-blue-600 text-white text-sm font-semibold rounded-full">
                {userRdcLocation}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Processing Orders */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.processingOrders}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Ready for dispatch</span>
            </div>
          </div>

          {/* Out for Delivery */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Out for Delivery</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.outForDelivery}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Currently delivering</span>
            </div>
          </div>

          {/* Delivered Orders */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Delivered</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.deliveredCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-100 to-green-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Delivered orders</span>
            </div>
          </div>

          {/* Rejected Orders */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.rejectedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-red-100 to-red-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Failed deliveries</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Processing Orders List */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Processing Orders - Ready for Dispatch
                </h2>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                  {processingOrders.length} orders
                </span>
              </div>
            </div>

            <div className="p-6">
              {ordersLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500 mb-3"></div>
                  <p className="text-gray-600">Loading orders...</p>
                  <p className="text-sm text-gray-400 mt-1">Fetching data from {userRdcLocation}</p>
                </div>
              ) : processingOrders.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-300 mb-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-gray-500 mt-2">No processing orders in {userRdcLocation}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    All orders have been dispatched or delivered
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 hover:bg-yellow-50 rounded-xl transition border border-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-linear-to-br from-yellow-100 to-yellow-200 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-yellow-600"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{getOrderNumber(order)}</p>
                          <p className="text-sm text-gray-600">
                            {getCustomerName(order)} • {getCityFromAddress(order)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                            >
                              {order.status || 'Processing'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {getOrderItemsCount(order)} items
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(order.total || order.totalAmount || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {formatTimestamp(order.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Active Routes */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="space-y-3 mb-8">
              <button
                onClick={() => (window.location.href = '/deliveries')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-linear-to-r from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <span className="font-medium text-gray-900 block">Plan Deliveries</span>
                  <span className="text-xs text-gray-600">Group orders by location</span>
                </div>
              </button>

              <button
                onClick={() => (window.location.href = '/route')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-linear-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
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
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <span className="font-medium text-gray-900 block">Route Planner</span>
                  <span className="text-xs text-gray-600">Optimize delivery routes</span>
                </div>
              </button>

              <button
                onClick={() => (window.location.href = '/delivery-history')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-linear-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-green-500 to-green-600 flex items-center justify-center">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <span className="font-medium text-gray-900 block">Delivery History</span>
                  <span className="text-xs text-gray-600">View past deliveries</span>
                </div>
              </button>
            </div>

            {/* Active Routes */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Delivery Routes</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                  {activeRoutes.length}
                </span>
              </div>
              {routesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-green-500 mr-2"></div>
                  <span className="text-sm text-gray-500">Loading routes...</span>
                </div>
              ) : activeRoutes.length === 0 ? (
                <div className="text-center py-4">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-300 mb-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-gray-500 text-sm">No recent routes</p>
                  <p className="text-xs text-gray-400 mt-1">Create routes from delivery planning</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeRoutes.map((route) => {
                    const isActive = route.status === 'active'
                    const isClickable = isActive

                    return isClickable ? (
                      <button
                        key={route.id}
                        onClick={() => (window.location.href = `/route?session=${route.id}`)}
                        className="w-full flex items-center justify-between p-3 hover:bg-blue-50 rounded-lg transition border border-gray-200"
                      >
                        <div className="text-left flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg
                              className="w-4 h-4 text-blue-600"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                            </svg>
                            <span className="font-medium text-sm text-gray-900">
                              {route.routeNumber}
                            </span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {route.assignedDriver?.split('@')[0]}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {route.shipments?.length || 0} orders
                          </span>
                          <svg
                            className="w-4 h-4 text-gray-400"
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
                        </div>
                      </button>
                    ) : (
                      <div
                        key={route.id}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                      >
                        <div className="text-left flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                            </svg>
                            <span className="font-medium text-sm text-gray-500">
                              {route.routeNumber}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded">
                              Expired
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {route.assignedDriver?.split('@')[0]}
                          </p>
                          {route.usedAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Used: {formatTimestamp(route.usedAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded">
                            {route.shipments?.length || 0} orders
                          </span>
                          <svg
                            className="w-4 h-4 text-gray-300"
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
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
