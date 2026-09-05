'use client'

import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import AdminNavbar from '../components/Adminnavbar'
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

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
  })
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [lowStockItems, setLowStockItems] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setUser(currentUser)

      // Check if user is admin by checking their role in Firestore
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const isUserAdmin = userData.role === 'admin'
          setIsAdmin(isUserAdmin)

          if (!isUserAdmin) {
            // Redirect non-admin users
            window.location.href = '/'
            return
          }

          // Start listening to data if admin
          try {
            // Try to fetch initial users data for setup
            const userDoc = await getDocs(collection(db, 'users'))
            const usersData = userDoc.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as User[]

            setupListeners(usersData)
          } catch (error) {
            console.error('Error fetching users:', error)
            setupListeners([])
          }
        } else {
          // User document doesn't exist
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  // Setup real-time listeners for Firestore collections
  const setupListeners = (initialUsers: User[]) => {
    setLoading(true)

    // Listen for products changes (public read - allowed for all)
    const productsUnsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[]
        setProducts(productsData)
        setAllProducts(productsData)

        // Calculate low stock items (stock < 10)
        const lowStock = productsData.filter((p) => p.stock < 10)
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

    // Listen for users changes - only admins can access
    const usersUnsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as User[]
        setUsers(usersData)
        setRecentUsers(
          usersData
            .sort((a, b) => {
              const aTime = a.createdAt?.seconds || 0
              const bTime = b.createdAt?.seconds || 0
              return bTime - aTime
            })
            .slice(0, 6)
        )

        // Update stats
        setStats((prev) => ({
          ...prev,
          totalUsers: usersData.length,
        }))
      },
      (error) => {
        console.error('Error listening to users:', error)
        setUsers(initialUsers)
        setRecentUsers(initialUsers.slice(0, 5))
        setStats((prev) => ({
          ...prev,
          totalUsers: initialUsers.length,
        }))
      }
    )

    // Listen for orders changes - authenticated users can read
    const ordersUnsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[]
        setOrders(ordersData)

        // Sort and get recent orders
        const sortedOrders = ordersData.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0
          const bTime = b.createdAt?.seconds || 0
          return bTime - aTime
        })
        setRecentOrders(sortedOrders.slice(0, 5))

        // Calculate stats - use total field if it exists, otherwise use totalAmount
        const totalRevenue = ordersData
          .filter((o) => o.status === 'delivered' || o.status === 'completed')
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
      usersUnsubscribe()
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

      // Check if date is valid
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

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get role badge color - removed "staff" as requested
  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'rdc staff':
        return 'bg-blue-100 text-blue-800'
      case 'ho manager':
        return 'bg-purple-100 text-purple-800'
      case 'logistics team':
        return 'bg-cyan-100 text-cyan-800'
      case 'customer':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
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

  // Get profile picture with fallback
  const getUserProfilePic = (user: User) => {
    if (user.photoURL && user.photoURL.startsWith('data:image')) {
      return user.photoURL // Base64 image
    }
    if (user.photoURL) {
      return user.photoURL // Regular URL
    }
    // Fallback to UI Avatars
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.email || 'User')}&background=random`
  }

  // Get stock badge class
  const getStockBadgeClass = (stock: number) => {
    if (stock < 10) return 'bg-red-100 text-red-800'
    if (stock < 20) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  // Get stock text
  const getStockText = (stock: number) => {
    if (stock < 10) return `${stock} units (LOW STOCK)`
    if (stock < 20) return `${stock} units (WARNING)`
    return `${stock} units`
  }

  // If not admin, show loading or redirect
  if (!isAdmin && loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <AdminNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-2">
            Welcome back, Admin! Here's what's happening with your store in real-time.
          </p>
        </div>

        {/* Stats Grid - PROFESSIONAL MODERN DESIGN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-100 hover:border-green-200 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-linear-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg shadow-green-500/30">
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 mb-1 truncate leading-tight">
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p className="text-xs text-gray-400">From completed orders</p>
            </div>
          </div>

          {/* Total Orders */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-100 hover:border-blue-200 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
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
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Total Orders</p>
              <p className="text-xl font-bold text-gray-900 mb-1 truncate leading-tight">
                {stats.totalOrders}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                <p className="text-xs text-gray-400">{stats.pendingOrders} pending</p>
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-100 hover:border-purple-200 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-linear-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/30">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Total Users</p>
              <p className="text-xl font-bold text-gray-900 mb-1 truncate leading-tight">
                {stats.totalUsers}
              </p>
              <p className="text-xs text-gray-400">Registered users</p>
            </div>
          </div>

          {/* Total Products */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-100 hover:border-orange-200 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-linear-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/30">
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Total Products</p>
              <p className="text-xl font-bold text-gray-900 mb-1 truncate leading-tight">
                {stats.totalProducts}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                <p className="text-xs text-gray-400">{stats.lowStockProducts} low stock</p>
              </div>
            </div>
          </div>

          {/* Pending Orders */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-100 hover:border-amber-200 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-linear-to-br from-amber-500 to-yellow-600 rounded-xl shadow-lg shadow-amber-500/30">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Pending Orders</p>
              <p className="text-xl font-bold text-gray-900 mb-1 truncate leading-tight">
                {stats.pendingOrders}
              </p>
              <p className="text-xs text-gray-400">Need attention</p>
            </div>
          </div>

          {/* Low Stock Items */}
          <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg p-6 border border-gray-100 hover:border-rose-200 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-linear-to-br from-rose-500 to-red-600 rounded-xl shadow-lg shadow-rose-500/30">
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
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Low Stock</p>
              <p className="text-xl font-bold text-gray-900 mb-1 truncate leading-tight">
                {stats.lowStockProducts}
              </p>
              <p className="text-xs text-gray-400">Below 10 units</p>
            </div>
          </div>
        </div>

        {/* Recent Orders & Users Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
                <a
                  href="/manage-orders"
                  className="text-sm font-medium text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                >
                  View all
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
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                </div>
              ) : recentOrders.length === 0 ? (
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-gray-500 mt-2">No orders yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{getOrderNumber(order)}</p>
                        <p className="text-sm text-gray-600">{getCustomerName(order)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                        >
                          {(order.status || 'pending').toUpperCase()}
                        </span>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {formatCurrency(getOrderTotal(order))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Users */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Recent Users</h2>
                <a
                  href="/manage-users"
                  className="text-sm font-medium text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                >
                  View all
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
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                </div>
              ) : recentUsers.length === 0 ? (
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <p className="text-gray-500 mt-2">No users yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-gray-200 to-gray-300 flex items-center justify-center overflow-hidden">
                        <img
                          src={getUserProfilePic(user)}
                          alt={user.fullName}
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.email || 'User')}&background=random`
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {user.fullName || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-600">{user.email || 'No email'}</p>
                      </div>
                      <div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role || 'customer')}`}
                        >
                          {user.role?.toUpperCase() || 'CUSTOMER'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Products with Stock Alert */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">All Products Stock Status</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Low Stock (&lt;10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Warning (&lt;20)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Good Stock</span>
                </div>
                <a
                  href="/manage-products"
                  className="text-sm font-medium text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
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
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
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
                    className={`border rounded-lg p-4 hover:shadow-md transition ${product.stock < 10 ? 'border-red-200 bg-red-50' : product.stock < 20 ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'}`}
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
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockBadgeClass(product.stock)}`}
                          >
                            {getStockText(product.stock)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {product.rdcLocation || 'Unknown Location'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <a
                        href={`/manage-products`}
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
                        Edit
                      </a>
                      {product.stock < 10 && (
                        <a
                          href={`/manage-products`}
                          className="px-3 py-1.5 bg-linear-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-lg hover:from-red-600 hover:to-red-700 transition flex items-center gap-2"
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
                          Restock Now
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="/manage-users"
              className="p-4 bg-linear-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100 hover:border-cyan-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                  <p className="font-semibold text-gray-900">Manage Users</p>
                  <p className="text-sm text-gray-600">View & manage users</p>
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Add New Product</p>
                  <p className="text-sm text-gray-600">Add to inventory</p>
                </div>
              </div>
            </a>

            <a
              href="/manage-orders"
              className="p-4 bg-linear-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100 hover:border-purple-200 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-violet-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition">
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
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Manage Orders</p>
                  <p className="text-sm text-gray-600">Process pending orders</p>
                </div>
              </div>
            </a>

            <a
              href="/reports"
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">View Reports</p>
                  <p className="text-sm text-gray-600">Sales & analytics</p>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
