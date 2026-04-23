'use client'

import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import HOManagerNavbar from '../components/HOManagerNavbar'
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
}

interface User {
  id: string
  fullName: string
  email: string
  role: string
  phone: string
  photoURL: string
  createdAt: any
  uid: string
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
}

export default function HOManagerHome() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isHOManager, setIsHOManager] = useState(false)
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
    todayRevenue: 0,
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [lowStockItems, setLowStockItems] = useState<Product[]>([])

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setUser(currentUser)

      // Check if user is HO Manager by checking their role in Firestore
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const isUserHOManager = userData.role === 'HO Manager'
          setIsHOManager(isUserHOManager)

          if (!isUserHOManager) {
            window.location.href = '/'
            return
          }

          // Start listening to data if HO Manager
          setupListeners()
        } else {
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking HO Manager status:', error)
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  // Setup real-time listeners for Firestore collections
  const setupListeners = () => {
    setLoading(true)

    // Get today's date for revenue calculation
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Listen for products changes
    const productsUnsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[]
        setAllProducts(productsData)

        // Calculate low stock items (stock < 20 for HO Manager)
        const lowStock = productsData.filter((p) => p.stock < 20)
        setLowStockItems(lowStock)

        // Update stats
        setStats((prev) => ({
          ...prev,
          totalProducts: productsData.length,
          lowStockProducts: lowStock.length,
        }))
      },
      (error) => {
        console.error('Error listening to products:', error)
      }
    )

    // Listen for orders changes
    const ordersUnsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[]

        // Sort and get recent orders
        const sortedOrders = ordersData.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0
          const bTime = b.createdAt?.seconds || 0
          return bTime - aTime
        })
        setRecentOrders(sortedOrders.slice(0, 5))

        // Calculate today's revenue
        const todayRevenue = ordersData
          .filter((o) => {
            const orderDate = o.createdAt?.seconds
              ? new Date(o.createdAt.seconds * 1000)
              : new Date(o.createdAt)
            return (
              orderDate >= today &&
              (o.status === 'confirmed' || o.status === 'completed' || o.status === 'delivered')
            )
          })
          .reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)

        // Calculate total revenue from completed orders
        const totalRevenue = ordersData
          .filter(
            (o) => o.status === 'confirmed' || o.status === 'completed' || o.status === 'delivered'
          )
          .reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)

        const pendingOrders = ordersData.filter(
          (o) => o.status === 'pending' || o.status === 'processing'
        ).length

        // Update stats
        setStats((prev) => ({
          ...prev,
          totalOrders: ordersData.length,
          totalRevenue,
          pendingOrders,
          todayRevenue,
        }))

        setLoading(false)
      },
      (error) => {
        console.error('Error listening to orders:', error)
        setLoading(false)
      }
    )

    // Cleanup listeners on unmount
    return () => {
      productsUnsubscribe()
      ordersUnsubscribe()
    }
  }

  // Format Firestore timestamp
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
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch (error) {
      return 'N/A'
    }
  }

  // Format relative time
  const formatRelativeTime = (timestamp: any) => {
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

      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

      if (diffInSeconds < 60) {
        return 'Just now'
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60)
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600)
        return `${hours} hour${hours > 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400)
        return `${days} day${days > 1 ? 's' : ''} ago`
      } else {
        return formatTimestamp(timestamp)
      }
    } catch (error) {
      return 'N/A'
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'shipped':
      case 'in-transit':
        return 'bg-indigo-100 text-indigo-800'
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Get customer name from order
  const getCustomerName = (order: Order) => {
    if (order.shippingInfo?.fullName) return order.shippingInfo.fullName
    if (order.customerName) return order.customerName
    if (order.userEmail) return order.userEmail.split('@')[0]
    if (order.customerId) return `User: ${order.customerId.slice(-6)}`
    return 'Customer'
  }

  // Get order total amount
  const getOrderTotal = (order: Order) => {
    if (order.total !== undefined) return order.total
    if (order.totalAmount !== undefined) return order.totalAmount
    if (order.subtotal !== undefined && order.shipping !== undefined) {
      return order.subtotal + order.shipping
    }
    if (order.subtotal !== undefined) return order.subtotal
    return 0
  }

  // Get order number or ID
  const getOrderNumber = (order: Order) => {
    if (order.orderNumber) return `#${order.orderNumber}`
    if (order.id) return `Order ${order.id.slice(-8).toUpperCase()}`
    return 'Order #N/A'
  }

  // Get stock badge class
  const getStockBadgeClass = (stock: number) => {
    if (stock < 5) return 'bg-red-100 text-red-800 border border-red-200'
    if (stock < 10) return 'bg-red-50 text-red-700 border border-red-100'
    if (stock < 20) return 'bg-yellow-50 text-yellow-700 border border-yellow-100'
    return 'bg-green-50 text-green-700 border border-green-100'
  }

  // Get stock icon
  const getStockIcon = (stock: number) => {
    if (stock < 5) {
      return (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.282 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      )
    } else if (stock < 10) {
      return (
        <svg
          className="w-5 h-5 text-orange-500"
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
      )
    } else if (stock < 20) {
      return (
        <svg
          className="w-5 h-5 text-yellow-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.282 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      )
    }
    return null
  }

  // Get stock text
  const getStockText = (stock: number) => {
    if (stock < 5) return `${stock} units (CRITICAL)`
    if (stock < 10) return `${stock} units (VERY LOW)`
    if (stock < 20) return `${stock} units (LOW)`
    return `${stock} units`
  }

  // If not HO Manager, show loading or redirect
  if (!isHOManager && loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isHOManager) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <HOManagerNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Head Office Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Welcome back! Here's your inventory and order overview in real-time.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setupListeners()}
                className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Today's Revenue */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <div className="w-12 h-12 bg-linear-to-br from-green-100 to-green-50 rounded-lg flex items-center justify-center">
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-green-600">
                Total: {formatCurrency(stats.totalRevenue)}
              </span>
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalOrders}</p>
              </div>
              <div className="w-12 h-12 bg-linear-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
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
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                <span className="text-xs text-gray-500">{stats.pendingOrders} pending</span>
              </span>
            </div>
          </div>

          {/* Total Products */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Products</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
              </div>
              <div className="w-12 h-12 bg-linear-to-br from-purple-100 to-purple-50 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
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
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                <span className="text-xs text-yellow-600">{stats.lowStockProducts} low stock</span>
              </span>
            </div>
          </div>

          {/* Low Stock Items */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock Alert</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.lowStockProducts}</p>
              </div>
              <div className="w-12 h-12 bg-linear-to-br from-red-100 to-red-50 rounded-lg flex items-center justify-center">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.282 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Below 20 units</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <a
              href="/manage-products"
              className="p-4 bg-linear-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100 hover:border-blue-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Add Product</p>
                  <p className="text-sm text-gray-600">Add new product to inventory</p>
                </div>
              </div>
            </a>

            <a
              href="/manage-orders"
              className="p-4 bg-linear-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:border-purple-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Process Orders</p>
                  <p className="text-sm text-gray-600">Review and process new orders</p>
                </div>
              </div>
            </a>

            <a
              href="/manage-products"
              className="p-4 bg-linear-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 hover:border-green-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Manage Inventory</p>
                  <p className="text-sm text-gray-600">Update stock levels</p>
                </div>
              </div>
            </a>

            <a
              href="/q&a"
              className="p-4 bg-linear-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100 hover:border-orange-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Customer Support</p>
                  <p className="text-sm text-gray-600">Answer product questions</p>
                </div>
              </div>
            </a>

            <a
              href="/manage-products?filter=low-stock"
              className="p-4 bg-linear-to-br from-red-50 to-rose-50 rounded-xl border border-red-100 hover:border-red-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-red-500 to-rose-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.282 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Stock Alert</p>
                  <p className="text-sm text-gray-600">Review low stock items</p>
                </div>
              </div>
            </a>

            <a
              href="/manage-users"
              className="p-4 bg-linear-to-br from-indigo-50 to-violet-50 rounded-xl border border-indigo-100 hover:border-indigo-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">User Management</p>
                  <p className="text-sm text-gray-600">View registered users</p>
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Recent Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Recent Orders</h3>
              <a href="/manage-orders" className="text-sm text-blue-600 hover:text-blue-800">
                View all →
              </a>
            </div>
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-500">No recent orders</p>
                </div>
              ) : (
                recentOrders.map((order) => (
                  <div key={order.id} className="px-6 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            Order #{order.id.substring(0, 8)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{getCustomerName(order)}</p>
                        <p className="text-xs text-gray-500">
                          {order.shippingInfo?.city || 'Unknown'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(getOrderTotal(order))}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Items: {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} items
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Low Stock Products - Highlighted Version */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">Low Stock Products</h3>
                {stats.lowStockProducts > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {stats.lowStockProducts} urgent
                  </span>
                )}
              </div>
              <a href="/manage-products" className="text-sm text-blue-600 hover:text-blue-800">
                View all →
              </a>
            </div>
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : lowStockItems.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-700 font-medium">
                      All products are sufficiently stocked
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      No items below minimum stock threshold (20 units)
                    </p>
                  </div>
                </div>
              ) : (
                lowStockItems.map((product) => (
                  <div
                    key={product.id}
                    className={`px-6 py-4 transition ${
                      product.stock < 5
                        ? 'bg-red-50 hover:bg-red-100'
                        : product.stock < 10
                          ? 'bg-orange-50 hover:bg-orange-100'
                          : 'bg-yellow-50 hover:bg-yellow-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        {getStockIcon(product.stock)}
                        <div>
                          <h4 className="font-semibold text-gray-900">{product.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">{product.category}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(product.price)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStockBadgeClass(product.stock)}`}
                        >
                          {getStockIcon(product.stock)}
                          {getStockText(product.stock)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{product.rdcLocation}</p>
                      </div>
                    </div>
                    {product.stock < 5 && (
                      <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
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
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Critical stock level - Reorder immediately
                      </div>
                    )}
                    {product.stock >= 5 && product.stock < 10 && (
                      <div className="mt-2 text-xs text-orange-600 font-medium flex items-center gap-1">
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Very low stock - Urgent reorder needed
                      </div>
                    )}
                    {product.stock >= 10 && product.stock < 20 && (
                      <div className="mt-2 text-xs text-yellow-600 font-medium flex items-center gap-1">
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.282 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                        Low stock - Consider reordering soon
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* All Products Stock Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">All Products Stock Status</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Critical (&lt;5)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Very Low (&lt;10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Low (&lt;20)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Good Stock</span>
                </div>
                <a
                  href="/manage-products"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
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
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : allProducts.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400"
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
                <p className="text-gray-500 mt-2">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`border rounded-lg p-4 hover:shadow-md transition ${
                      product.stock < 5
                        ? 'border-red-200 bg-red-50'
                        : product.stock < 10
                          ? 'border-orange-200 bg-orange-50'
                          : product.stock < 20
                            ? 'border-yellow-200 bg-yellow-50'
                            : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                        <img
                          src={product.imageURL || 'https://via.placeholder.com/100'}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Image'
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-600">
                          {product.category || 'Uncategorized'}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(product.price)}
                          </span>
                          <div
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockBadgeClass(product.stock)}`}
                          >
                            {getStockIcon(product.stock)}
                            {getStockText(product.stock)}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {product.rdcLocation || 'Unknown Location'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <a
                        href={`/manage-products/edit?id=${product.id}`}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit Stock
                      </a>
                      {product.stock < 20 && (
                        <a
                          href={`/manage-products/edit?id=${product.id}`}
                          className="px-3 py-1.5 bg-linear-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition flex items-center gap-2"
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
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                          Restock
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
