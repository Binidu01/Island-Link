import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import LogisticsNavbar from '../components/LogisticsNavbar'
import { db, auth } from '../lib/firebase'

interface Order {
  id: string
  orderNumber?: string
  customerName?: string
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
  deliveredAt?: any
  rejectedAt?: any
  shippingInfo?: {
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
  deliveryAddress?: string
  rdcLocation?: string
  updatedAt?: any
  shippingStatus?: string
  shipping?: number
  subtotal?: number
  total?: number
  paymentMethod?: string
  userEmail?: string
  updatedBy?: string
  deliveryStartedAt?: any
  rejectionReason?: string
}

export default function DeliveryHistory() {
  const [user, setUser] = useState<any>(null)
  const [logisticsStaff, setLogisticsStaff] = useState(false)
  const [userRdcLocation, setUserRdcLocation] = useState<string>('')

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)

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
          const isLogisticsStaff =
            userRole === 'logistics team' ||
            userRole === 'logistics manager' ||
            userRole === 'admin' ||
            userRole === 'rdc staff'
          setLogisticsStaff(isLogisticsStaff)

          const userRdc = userData.rdc || userData.rdcLocation || 'South RDC'
          setUserRdcLocation(userRdc)

          if (!isLogisticsStaff) {
            window.location.href = '/'
            return
          }

          const email = currentUser.email || ''
          setupDataListeners(email)
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

  const setupDataListeners = (userEmail: string) => {
    setLoading(true)

    const ordersUnsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        try {
          const allOrders = snapshot.docs
            .map(
              (doc) =>
                ({
                  id: doc.id,
                  ...doc.data(),
                }) as Order
            )
            .filter(
              (order) =>
                (order.status === 'delivered' || order.status === 'rejected') &&
                order.updatedBy === userEmail
            )

          allOrders.sort((a, b) => {
            const aTime = a.deliveredAt?.seconds || a.rejectedAt?.seconds || 0
            const bTime = b.deliveredAt?.seconds || b.rejectedAt?.seconds || 0
            return bTime - aTime
          })

          setOrders(allOrders)
          setFilteredOrders(allOrders)
          setLoading(false)
        } catch (error) {
          console.error('Error processing orders data:', error)
          setLoading(false)
        }
      },
      (error) => {
        console.error('Error listening to orders:', error)
        setLoading(false)
      }
    )

    return () => {
      ordersUnsubscribe()
    }
  }

  // Apply filters
  useEffect(() => {
    let filtered = [...orders]

    if (searchTerm) {
      filtered = filtered.filter((order) => {
        const orderNum = getOrderNumber(order).toLowerCase()
        const customerName = getCustomerName(order).toLowerCase()
        const address = (order.shippingInfo?.address || order.deliveryAddress || '').toLowerCase()
        const search = searchTerm.toLowerCase()

        return (
          orderNum.includes(search) || customerName.includes(search) || address.includes(search)
        )
      })
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()

      if (dateFilter === 'today') {
        filterDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'week') {
        filterDate.setDate(now.getDate() - 7)
      } else if (dateFilter === 'month') {
        filterDate.setMonth(now.getMonth() - 1)
      }

      filtered = filtered.filter((order) => {
        const orderDate = order.deliveredAt?.toDate
          ? order.deliveredAt.toDate()
          : order.rejectedAt?.toDate
            ? order.rejectedAt.toDate()
            : new Date(order.deliveredAt || order.rejectedAt)
        return orderDate >= filterDate
      })
    }

    setFilteredOrders(filtered)
  }, [searchTerm, statusFilter, dateFilter, orders])

  const formatCurrency = (amount: number) => {
    if (!amount) return 'LKR 0.00'
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getCustomerName = (order: Order) => {
    if (order.shippingInfo?.fullName) return order.shippingInfo.fullName
    if (order.customerName) return order.customerName
    if (order.userEmail) return order.userEmail.split('@')[0]
    return 'Customer'
  }

  const getOrderNumber = (order: Order) => {
    if (order.orderNumber) return `#${order.orderNumber}`
    if (order.id) return `ORD-${order.id.slice(-6).toUpperCase()}`
    return 'Order'
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const getStatusBadge = (status: string) => {
    if (status === 'delivered') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
          Delivered
        </span>
      )
    } else if (status === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
          Rejected
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full mr-1.5"></span>
        {status}
      </span>
    )
  }

  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order)
    setShowOrderModal(true)
  }

  const totalDelivered = orders.filter((o) => o.status === 'delivered').length
  const totalRejected = orders.filter((o) => o.status === 'rejected').length
  const totalRevenue = orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading delivery history...</p>
        </div>
      </div>
    )
  }

  if (!logisticsStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to home page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <LogisticsNavbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Delivery History
              </h1>
              <p className="text-gray-500 mt-2">Track and manage your completed deliveries</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm">
                History View
              </span>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Delivered</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{totalDelivered}</p>
              </div>
              <div className="h-12 w-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
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
            </div>
          </div>

          <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Rejected</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{totalRejected}</p>
              </div>
              <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Orders</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Order number, customer, address..."
                  className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
                <svg
                  className="absolute left-3 top-3 w-5 h-5 text-gray-400"
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

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="all">All Status</option>
                <option value="delivered">Delivered</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all') && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setDateFilter('all')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Modern Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">Delivery Records</h2>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">
                {filteredOrders.length} records
              </span>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-gray-400"
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
              <p className="text-gray-500 font-medium">No delivery records found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {getOrderNumber(order)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {order.id.slice(-8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{getCustomerName(order)}</div>
                            <div className="text-xs text-gray-500">
                              {order.shippingInfo?.email || order.userEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 max-w-xs">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-sm text-gray-600 truncate" title={order.shippingInfo?.address || order.deliveryAddress}>
                            {order.shippingInfo?.address || order.deliveryAddress || 'No address'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {formatCurrency(order.total || order.totalAmount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm text-gray-600">
                            {formatDate(order.deliveredAt || order.rejectedAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => viewOrderDetails(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-all duration-200 group-hover:shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modern Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowOrderModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
                      <p className="text-sm text-gray-500">{getOrderNumber(selectedOrder)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOrderModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Order Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      Order Information
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        {getStatusBadge(selectedOrder.status)}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Date:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(selectedOrder.deliveredAt || selectedOrder.rejectedAt)}
                        </span>
                      </div>
                      {selectedOrder.status === 'rejected' && selectedOrder.rejectionReason && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Rejection Reason:</span>
                          <span className="text-sm font-medium text-red-600">
                            {selectedOrder.rejectionReason}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Payment Summary
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Subtotal:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(selectedOrder.subtotal || selectedOrder.totalAmount || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Shipping:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(selectedOrder.shipping || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-base font-bold text-gray-900">Total:</span>
                        <span className="text-base font-bold text-gray-900">
                          {formatCurrency(selectedOrder.total || selectedOrder.totalAmount || 0)}
                        </span>
                      </div>
                      {selectedOrder.paymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Payment Method:</span>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {selectedOrder.paymentMethod}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-gray-500">Name</span>
                        <p className="text-sm font-medium text-gray-900">{getCustomerName(selectedOrder)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Email</span>
                        <p className="text-sm text-gray-900">{selectedOrder.shippingInfo?.email || selectedOrder.userEmail || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-gray-500">Phone</span>
                        <p className="text-sm text-gray-900">{selectedOrder.shippingInfo?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Address</span>
                        <p className="text-sm text-gray-900">
                          {selectedOrder.shippingInfo?.address || selectedOrder.deliveryAddress || 'No address'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Order Items ({selectedOrder.items?.length || 0})
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-xl p-4 flex justify-between items-center hover:bg-gray-100 transition-all duration-200"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <div className="flex gap-4 mt-1">
                            <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                            <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                          <p className="text-xs text-gray-500">{formatCurrency(item.price)} each</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}