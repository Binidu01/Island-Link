'use client'

import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import RDCNavbar from '../components/RDCNavbar'
import { db, auth } from '../lib/firebase'

interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  imageURL: string
  description: string
  rdcLocation: string
  sku: string
  minStockLevel: number
  lastRestocked: any
  createdAt?: any
  updatedAt?: any
}

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
  total?: number
  subtotal?: number
  shipping?: number
  userEmail?: string
  assignedTo?: string
  priority?: string
  pickupDate?: string
  deliveryStatus?: string
  userId?: string
  location?: string
  rdc?: string
}

interface RDCInventory {
  id: string
  productId: string
  productName: string
  sku: string
  currentStock: number
  reservedStock: number
  availableStock: number
  location: string
  aisle: string
  shelf: string
  bin: string
  lastUpdated: any
  minStockLevel: number
  reorderPoint: number
  reorderQuantity: number
}

export default function RDCDashboard() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [rdcStaff, setRdcStaff] = useState(false)
  const [userRdcLocation, setUserRdcLocation] = useState<string>('')

  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingProcessing: 0,
    readyForPickup: 0,
    inTransit: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalInventoryValue: 0,
    itemsToPickToday: 0,
  })

  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [inventoryItems, setInventoryItems] = useState<RDCInventory[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<RDCInventory[]>([])
  const [todayPickupList, setTodayPickupList] = useState<Order[]>([])

  // Helper to safely get timestamp seconds for sorting
  const getTimestampSeconds = (timestamp: any): number => {
    if (!timestamp) return 0
    if (timestamp.seconds) return timestamp.seconds
    if (timestamp.toDate) return timestamp.toDate().getTime() / 1000
    if (typeof timestamp === 'string') return new Date(timestamp).getTime() / 1000
    return 0
  }

  // Helper to safely resolve a raw date field (Firestore timestamp or string) to an ISO string
  const resolveDateString = (rawDate: any): string => {
    if (!rawDate) return ''
    if (typeof rawDate === 'string') return rawDate
    if (rawDate?.seconds) return new Date(rawDate.seconds * 1000).toISOString()
    if (rawDate?.toDate) return (rawDate.toDate() as Date).toISOString()
    return String(rawDate)
  }

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
          const userRole = (userData.role as string | undefined)?.toLowerCase()
          const isRdcStaff =
            userRole === 'rdc staff' ||
            userRole === 'rdc manager' ||
            userRole === 'logistics team' ||
            userRole === 'admin'
          setRdcStaff(isRdcStaff)

          const userRdc = (userData.rdc as string | undefined) || 'North RDC'
          setUserRdcLocation(userRdc)

          if (!isRdcStaff) {
            window.location.href = '/'
            return
          }

          setupRDCListeners(userRdc)
        } else {
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking RDC staff status:', error)
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  // Setup real-time listeners
  const setupRDCListeners = (rdcLocation: string) => {
    setLoading(true)

    // ─── ORDERS LISTENER ────────────────────────────────────────────────────
    const ordersUnsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const ordersData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Order[]

        // Sort using safe timestamp helper
        ordersData.sort((a, b) => {
          const aTime = getTimestampSeconds(a.createdAt)
          const bTime = getTimestampSeconds(b.createdAt)
          return bTime - aTime
        })

        const totalOrders = ordersData.length

        const pendingProcessing = ordersData.filter((o) => {
          const status = o.status?.toLowerCase().trim()
          return status === 'pending' || status === 'confirmed' || status === 'processing'
        }).length

        const readyForPickup = ordersData.filter((o) => {
          const status = o.status?.toLowerCase().trim()
          return status === 'ready for pickup' || status === 'packed'
        }).length

        const inTransit = ordersData.filter((o) => {
          const status = o.status?.toLowerCase().trim()
          return status === 'shipped' || status === 'in transit'
        }).length

        const today = new Date().toISOString().split('T')[0]

        const itemsToPickToday = ordersData.filter((o) => {
          const rawDate: any = o.pickupDate || o.estimatedDelivery
          const status = o.status?.toLowerCase().trim()
          const pickupDateStr = resolveDateString(rawDate)
          return (
            pickupDateStr.includes(today) &&
            (status === 'processing' || status === 'ready for pickup')
          )
        }).length

        const pendingOrdersList = ordersData
          .filter((o) => {
            const status = o.status?.toLowerCase().trim()
            return status === 'pending' || status === 'confirmed' || status === 'processing'
          })
          .slice(0, 5)

        setPendingOrders(pendingOrdersList)
        setRecentOrders(ordersData.slice(0, 10))

        const todayPickups = ordersData
          .filter((o) => {
            const rawDate: any = o.pickupDate || o.estimatedDelivery
            const status = o.status?.toLowerCase().trim()
            const pickupDateStr = resolveDateString(rawDate)
            return (
              pickupDateStr.includes(today) &&
              (status === 'processing' || status === 'ready for pickup')
            )
          })
          .slice(0, 5)
        setTodayPickupList(todayPickups)

        setStats((prev) => ({
          ...prev,
          totalOrders,
          pendingProcessing,
          readyForPickup,
          inTransit,
          itemsToPickToday,
        }))
      },
      (error) => {
        console.error('Error listening to orders:', error)
      }
    )

    // ─── PRODUCTS LISTENER ──────────────────────────────────────────────────
    const productsUnsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const allProducts = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Product[]

        const inventoryData: RDCInventory[] = allProducts.map((product) => ({
          id: product.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku || `SKU-${product.id.slice(-6)}`,
          currentStock: product.stock || 0,
          reservedStock: 0,
          availableStock: product.stock || 0,
          location: product.rdcLocation || rdcLocation,
          aisle: 'A',
          shelf: '1',
          bin: '01',
          lastUpdated: product.updatedAt || product.createdAt || new Date(),
          minStockLevel: product.minStockLevel || 20,
          reorderPoint: product.minStockLevel || 20,
          reorderQuantity: 50,
        }))

        setInventoryItems(inventoryData)

        const lowStock = inventoryData.filter(
          (item) => item.currentStock < 20 && item.currentStock > 0
        )
        const outOfStock = inventoryData.filter((item) => item.currentStock === 0)

        const totalInventoryValue = inventoryData.reduce((sum, item) => {
          const product = allProducts.find((p) => p.id === item.productId)
          return sum + item.currentStock * (product?.price || 0)
        }, 0)

        setLowStockAlerts([...outOfStock, ...lowStock])

        setStats((prev) => ({
          ...prev,
          lowStockItems: lowStock.length,
          outOfStockItems: outOfStock.length,
          totalInventoryValue,
        }))

        setLoading(false)
      },
      (error) => {
        console.error('Error listening to products:', error)
        setLoading(false)
      }
    )

    return () => {
      ordersUnsubscribe()
      productsUnsubscribe()
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A'
    try {
      let date: Date
      if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000)
      } else if (timestamp.toDate) {
        date = timestamp.toDate() as Date
      } else {
        date = new Date(timestamp as string)
      }
      if (isNaN(date.getTime())) return 'Invalid date'
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'N/A'
    }
  }

  const formatDateOnly = (dateString: string): string => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const getStatusColor = (status: string): string => {
    if (!status) return 'bg-gray-100 text-gray-800'
    switch (status.toLowerCase().trim()) {
      case 'pending':
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'ready for pickup':
      case 'packed':
        return 'bg-indigo-100 text-indigo-800'
      case 'shipped':
      case 'in transit':
        return 'bg-purple-100 text-purple-800'
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

  const getPriorityColor = (priority: string): string => {
    if (!priority) return 'bg-gray-100 text-gray-800'
    switch (priority.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number): string => {
    if (!amount) return 'LKR 0.00'
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getStockBadgeClass = (current: number, _reorderPoint: number): string => {
    if (current === 0) return 'bg-red-100 text-red-800'
    if (current < 5) return 'bg-red-50 text-red-700'
    if (current < 10) return 'bg-orange-100 text-orange-800'
    if (current < 20) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getStockStatusText = (current: number, _reorderPoint: number): string => {
    if (current === 0) return 'OUT OF STOCK'
    if (current < 5) return 'CRITICAL'
    if (current < 10) return 'VERY LOW'
    if (current < 20) return 'LOW STOCK'
    return 'IN STOCK'
  }

  const getCustomerName = (order: Order): string => {
    if (order.shippingInfo?.fullName) return order.shippingInfo.fullName
    if (order.customerName) return order.customerName
    if (order.userEmail) return order.userEmail.split('@')[0]
    return 'Customer'
  }

  const getOrderNumber = (order: Order): string => {
    if (order.orderNumber) return `#${order.orderNumber}`
    if (order.id) return `ORD-${order.id.slice(-6).toUpperCase()}`
    return 'Order'
  }

  const getOrderItemsCount = (order: Order): number => {
    if (order.items && Array.isArray(order.items)) {
      return order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    }
    return 0
  }

  // ─── LOADING / AUTH GUARD ─────────────────────────────────────────────────

  if (!rdcStaff && loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!rdcStaff) return null

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-gray-100">
      <RDCNavbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RDC Operations Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Welcome back! {userRdcLocation} • Here&apos;s what needs your attention today.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-linear-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-full">
                {userRdcLocation}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Pending / Confirmed / Processing Orders */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending &amp; Confirmed Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingProcessing}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                  <path d="M7 7h2v2H7zm0 4h2v2H7zm4-4h2v2h-2zm0 4h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Awaiting processing</span>
            </div>
          </div>

          {/* Ready for Pickup */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ready for Pickup</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.readyForPickup}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                  <path d="M17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99 8-8z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Packages ready</span>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock Items</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.lowStockItems}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM13 16h-2v2h2v-2zm0-6h-2v4h2v-4z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-xs text-gray-500">{stats.outOfStockItems} out of stock</span>
              </span>
            </div>
          </div>

          {/* Today's Pickups */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today&apos;s Pickups</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.itemsToPickToday}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-100 to-green-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Items to pick today</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* ── Pending & Confirmed Orders Card ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Pending &amp; Confirmed Orders — Needs Processing
                </h2>
                <a
                  href="/rdc-orders"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  View All Orders
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </a>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600">Loading orders...</span>
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                  </svg>
                  <p className="text-gray-500 mt-2">No pending or confirmed orders</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Pending and confirmed orders will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 hover:bg-blue-50 rounded-xl transition border border-gray-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-linear-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{getOrderNumber(order)}</p>
                          <p className="text-sm text-gray-600">{getCustomerName(order)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                            >
                              {order.status || 'Pending'}
                            </span>
                            {order.priority && (
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(order.priority)}`}
                              >
                                {order.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{getOrderItemsCount(order)} items</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(order.total || order.totalAmount || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(order.createdAt)}
                        </p>
                        <a
                          href="/rdc-orders"
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-linear-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition"
                        >
                          Process Now
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
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                            />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => (window.location.href = '/rdc-orders')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-linear-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900">Process Orders</span>
              </button>

              <button
                onClick={() => (window.location.href = '/manage-products')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-linear-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 6c3.31 0 6-2.69 6-6h-2c0 2.21-1.79 4-4 4S8 2.21 8 0H6c0 3.31 2.69 6 6 6zm0 2c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900">Update Stock</span>
              </button>

              <button
                onClick={() => (window.location.href = '/questions')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-linear-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-linear-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zm-9-4h2v2h-2zm0-6h2v4h-2z" />
                  </svg>
                </div>
                <span className="font-medium text-gray-900">Customer Care</span>
              </button>
            </div>

            {/* Today's Pickup List */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">Today&apos;s Pickups</h3>
              {todayPickupList.length === 0 ? (
                <p className="text-gray-500 text-sm">No pickups scheduled for today</p>
              ) : (
                <div className="space-y-2">
                  {todayPickupList.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="font-medium text-sm text-gray-900">
                        {getOrderNumber(order)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {getOrderItemsCount(order)} items
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Low Stock & Reorder Alerts */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Low Stock Alerts</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Showing all products with stock below 20 units across all locations
                </p>
              </div>
              <a
                href="/manage-products"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                Manage Products
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </a>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading inventory...</span>
              </div>
            ) : lowStockAlerts.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <p className="text-gray-500 mt-2">All inventory levels are good</p>
                <p className="text-sm text-gray-400 mt-1">No low stock alerts at this time</p>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Out of Stock</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <span>Critical (&lt;5)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                    <span>Very Low (&lt;10)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <span>Low (&lt;20)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {lowStockAlerts.map((item) => (
                    <div
                      key={item.id}
                      className={`border rounded-xl p-4 ${
                        item.currentStock === 0
                          ? 'bg-red-50 border-red-200'
                          : item.currentStock < 5
                            ? 'bg-red-50 border-red-100'
                            : item.currentStock < 10
                              ? 'bg-orange-50 border-orange-200'
                              : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{item.productName}</h3>
                          <p className="text-sm text-gray-600 mt-1">{item.sku}</p>
                          <p className="text-xs text-gray-500 mt-1">{item.location}</p>
                        </div>
                        <span
                          className={`ml-2 shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStockBadgeClass(item.currentStock, item.reorderPoint)}`}
                        >
                          {getStockStatusText(item.currentStock, item.reorderPoint)}
                        </span>
                      </div>

                      <div className="mt-4 space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Current Stock:</span>
                          <span
                            className={`font-bold ${item.currentStock === 0 ? 'text-red-600' : item.currentStock < 5 ? 'text-red-500' : item.currentStock < 10 ? 'text-orange-600' : 'text-yellow-700'}`}
                          >
                            {item.currentStock} units
                          </span>
                        </div>
                      </div>

                      {/* Stock bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              item.currentStock === 0
                                ? 'bg-red-500'
                                : item.currentStock < 5
                                  ? 'bg-red-400'
                                  : item.currentStock < 10
                                    ? 'bg-orange-400'
                                    : 'bg-yellow-400'
                            } w-[${Math.min((item.currentStock / 20) * 100, 100)}%]`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {recentOrders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition"
              >
                <div className="w-10 h-10 rounded-lg bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  {order.status === 'delivered' || order.status === 'completed' ? (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : order.status === 'shipped' || order.status === 'in transit' ? (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-yellow-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {getOrderNumber(order)} — {getCustomerName(order)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Status:{' '}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                    >
                      {order.status || 'Pending'}
                    </span>
                    {order.pickupDate && ` • Pickup: ${formatDateOnly(order.pickupDate)}`}
                  </div>
                </div>
                <div className="text-sm text-gray-500">{formatTimestamp(order.createdAt)}</div>
              </div>
            ))}

            {recentOrders.length === 0 && !loading && (
              <div className="text-center py-8">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
                <p className="text-gray-500 mt-2">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
