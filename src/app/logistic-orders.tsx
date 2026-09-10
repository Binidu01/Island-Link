'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  Timestamp,
  updateDoc,
  addDoc,
  setDoc,
} from 'firebase/firestore'
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

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
    imageURL?: string
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
    latitude?: number
    longitude?: number
  }
  shippingStatus?: string
  trackingNumber?: string
  shipmentId?: string
  shipmentNumber?: string
  shipmentDate?: any
  deliveryDate?: any
  route?: string
  driver?: string
  location?: string
  rdc?: string
  userEmail?: string
  subtotal?: number
  total?: number
  paymentMethod?: string
  shipping?: number
  notes?: string
  updatedAt?: any
  updatedBy?: string
  updatedByRDC?: string
  updatedByRole?: string
  shippingData?: {
    status: string
    trackingNumber?: string
    shipmentNumber?: string
    estimatedDelivery?: any
    needsTransit?: boolean
    sourceRDC?: string
    destinationRDC?: string
  }
  lockedByRDC?: string
}

interface Product {
  id: string
  name: string
  price: number
  stock: number
  rdcLocation: string
  sku: string
  category: string
  location?: string
}

interface ProvinceGroup {
  id: string
  province: string
  orders: Order[]
  orderCount: number
  totalValue: number
  cities: string[]
  deliveryAreas: string[]
  driverCount?: number
  estimatedDeliveryDays?: number
}

// Success Modal Component with Blur
const SuccessModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  deliveryDetails?: Array<{
    province: string
    orderCount: number
    deliveryAreas: number
    assignedDrivers?: number
    deliveryRoutes?: number
  }>
}> = ({ isOpen, onClose, title, message, deliveryDetails }) => {
  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close success modal"
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg
                  className="w-6 h-6 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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

            <p className="text-gray-700 text-center mb-4">{message}</p>

            {deliveryDetails && deliveryDetails.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Delivery Planning Results:</h4>
                <ul className="space-y-2 text-sm">
                  {deliveryDetails.map((detail, index) => (
                    <li key={index} className="border-b pb-2 last:border-0">
                      <div className="text-green-700">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <div>
                            <div className="font-medium">{detail.province}</div>
                            <div className="text-xs text-gray-600">
                              {detail.orderCount} orders • {detail.deliveryAreas} delivery areas
                              {detail.assignedDrivers && ` • ${detail.assignedDrivers} drivers`}
                            </div>
                          </div>
                        </div>
                        {detail.deliveryRoutes && (
                          <div className="text-xs text-gray-500 ml-6 mt-1">
                            Created {detail.deliveryRoutes} optimized delivery routes
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-linear-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Error Modal Component with Blur
const ErrorModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
}> = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close error modal"
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg
                  className="w-6 h-6 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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

            <p className="text-gray-700 text-center mb-4">{message}</p>

            <div className="mt-6 flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-linear-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-red-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Order Details Modal Component with Blur
const OrderDetailsModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  order: Order | null
  formatCurrency: (amount: number) => string
}> = ({ isOpen, onClose, order, formatCurrency }) => {
  if (!isOpen || !order) return null

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'processing':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'ready to ship':
      case 'packed':
        return 'bg-blue-100 text-blue-800'
      case 'shipped':
      case 'in transit':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      return 'Invalid date'
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={onClose}
                aria-label="Close order details"
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg
                  className="w-6 h-6 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Order Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-medium text-gray-900">{order.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Number:</span>
                    <span className="font-medium text-gray-900">
                      {order.orderNumber || `ORD-${order.id.slice(-6).toUpperCase()}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span
                      className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(order.status)}`}
                    >
                      {order.status || 'Processing'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium text-gray-900">{formatDate(order.createdAt)}</span>
                  </div>
                  {order.updatedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Updated:</span>
                      <span className="font-medium text-gray-900">{formatDate(order.updatedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Customer Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium text-gray-900">
                      {order.shippingInfo?.fullName || order.customerName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium text-gray-900">
                      {order.shippingInfo?.email || order.userEmail || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium text-gray-900">
                      {order.shippingInfo?.phone || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium text-gray-900">
                      {order.paymentMethod ? order.paymentMethod.toUpperCase() : 'COD'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Shipping Information</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600 mb-1 text-sm">Address:</p>
                    <p className="font-medium text-gray-900 text-sm">
                      {order.shippingInfo?.address || order.deliveryAddress || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1 text-sm">City:</p>
                    <p className="font-medium text-gray-900 text-sm">
                      {order.shippingInfo?.city || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1 text-sm">Postal Code:</p>
                    <p className="font-medium text-gray-900 text-sm">
                      {order.shippingInfo?.postalCode || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1 text-sm">Notes:</p>
                    <p className="font-medium text-gray-900 text-sm">
                      {order.shippingInfo?.notes || order.notes || 'No notes'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                Order Items ({order.items?.length || 0})
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {order.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {item.imageURL && (
                              <img
                                src={item.imageURL}
                                alt={item.productName || 'Product'}
                                className="h-10 w-10 rounded object-cover mr-3"
                              />
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.productName || 'Product'}
                              </p>
                              <p className="text-sm text-gray-500">SKU: {item.sku || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{item.quantity}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-bold">
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(order.subtotal || order.totalAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(order.shipping || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-2">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(order.total || order.totalAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Province Card Component - Fully Fixed with Better Visibility
const ProvinceCard: React.FC<{
  provinceGroup: ProvinceGroup
  onSelectAll: () => void
  onSelectOrder: (orderId: string) => void
  selectedOrders: string[]
  formatCurrency: (amount: number) => string
  getCustomerName: (order: Order) => string
  getOrderNumber: (order: Order) => string
  getCityFromAddress: (order: Order) => string
  getOrderItemsCount: (order: Order) => number
  viewOrderDetails: (order: Order) => void
}> = ({
  provinceGroup,
  onSelectAll,
  onSelectOrder,
  selectedOrders,
  formatCurrency,
  getCustomerName,
  getOrderNumber,
  getCityFromAddress,
  getOrderItemsCount,
  viewOrderDetails,
}) => {
  const allSelected = provinceGroup.orders.every((order) => selectedOrders.includes(order.id))
  const selectedCount = provinceGroup.orders.filter((order) =>
    selectedOrders.includes(order.id)
  ).length

  const getProvinceColor = (province: string) => {
    const provinceColors: Record<
      string,
      {
        bgFrom: string
        bgTo: string
        bgLight: string
        border: string
        text: string
        button: string
        iconBg: string
        iconColor: string
        badgeBg: string
        badgeText: string
      }
    > = {
      'Northern Province': {
        bgFrom: 'from-blue-500',
        bgTo: 'to-blue-600',
        bgLight: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        button: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'Southern Province': {
        bgFrom: 'from-green-500',
        bgTo: 'to-green-600',
        bgLight: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        button: 'bg-green-100 text-green-700 hover:bg-green-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'Western Province': {
        bgFrom: 'from-purple-500',
        bgTo: 'to-purple-600',
        bgLight: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-800',
        button: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'Eastern Province': {
        bgFrom: 'from-orange-500',
        bgTo: 'to-orange-600',
        bgLight: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        button: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'Central Province': {
        bgFrom: 'from-red-500',
        bgTo: 'to-red-600',
        bgLight: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        button: 'bg-red-100 text-red-700 hover:bg-red-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'North Western Province': {
        bgFrom: 'from-indigo-500',
        bgTo: 'to-indigo-600',
        bgLight: 'bg-indigo-50',
        border: 'border-indigo-200',
        text: 'text-indigo-800',
        button: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'North Central Province': {
        bgFrom: 'from-cyan-500',
        bgTo: 'to-cyan-600',
        bgLight: 'bg-cyan-50',
        border: 'border-cyan-200',
        text: 'text-cyan-800',
        button: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'Uva Province': {
        bgFrom: 'from-yellow-500',
        bgTo: 'to-yellow-600',
        bgLight: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        button: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
      'Sabaragamuwa Province': {
        bgFrom: 'from-pink-500',
        bgTo: 'to-pink-600',
        bgLight: 'bg-pink-50',
        border: 'border-pink-200',
        text: 'text-pink-800',
        button: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      },
    }

    return (
      provinceColors[province] || {
        bgFrom: 'from-gray-500',
        bgTo: 'to-gray-600',
        bgLight: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-800',
        button: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        iconBg: 'bg-white/20',
        iconColor: 'text-white',
        badgeBg: 'bg-white/30',
        badgeText: 'text-white',
      }
    )
  }

  const colors = getProvinceColor(provinceGroup.province)

  const getDeliveryDays = () => {
    if (provinceGroup.orderCount <= 5) return '1-2 days'
    if (provinceGroup.orderCount <= 15) return '2-3 days'
    if (provinceGroup.orderCount <= 30) return '3-4 days'
    return '4-5 days'
  }

  const getDriverCount = () => {
    if (provinceGroup.orderCount <= 10) return 1
    if (provinceGroup.orderCount <= 25) return 2
    if (provinceGroup.orderCount <= 50) return 3
    return 4
  }

  return (
    <div
      className={`bg-gradient-to-r ${colors.bgFrom} ${colors.bgTo} rounded-xl shadow-lg border ${colors.border} overflow-hidden h-full flex flex-col`}
    >
      {/* Header Section - Improved visibility */}
      <div className="p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 ${colors.iconBg} rounded-full flex items-center justify-center ${colors.iconColor} backdrop-blur-sm`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white drop-shadow-md">{provinceGroup.province}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-white text-xs ${colors.badgeBg} backdrop-blur-sm px-2 py-1 rounded font-medium`}>
                  {provinceGroup.orderCount} orders
                </span>
                <span className={`text-white text-xs ${colors.badgeBg} backdrop-blur-sm px-2 py-1 rounded font-medium`}>
                  {provinceGroup.cities.length} cities
                </span>
                <span className={`text-white text-xs ${colors.badgeBg} backdrop-blur-sm px-2 py-1 rounded font-medium`}>
                  ~{getDeliveryDays()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onSelectAll}
              className={`px-3 py-1 bg-white ${colors.text} text-sm font-semibold rounded-lg hover:opacity-90 transition shadow-sm`}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {/* Cities Section - Better visibility with backdrop blur */}
        <div className="mt-3 flex flex-wrap gap-2">
          {provinceGroup.cities.slice(0, 5).map((city, index) => (
            <span
              key={index}
              className={`text-white text-xs ${colors.badgeBg} backdrop-blur-sm px-2 py-1 rounded font-medium`}
            >
              {city}
            </span>
          ))}
          {provinceGroup.cities.length > 5 && (
            <span className={`text-white text-xs ${colors.badgeBg} backdrop-blur-sm px-2 py-1 rounded font-medium`}>
              +{provinceGroup.cities.length - 5} more
            </span>
          )}
        </div>

        {/* Delivery Stats Section - Improved visibility */}
        <div className="mt-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-medium">Est: {getDeliveryDays()}</span>
            </div>
            <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm px-2 py-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="text-sm font-medium">
                {getDriverCount()} driver{getDriverCount() > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="text-right bg-black/20 backdrop-blur-sm px-2 py-1 rounded">
            <span className="font-semibold text-white">{formatCurrency(provinceGroup.totalValue)}</span>
          </div>
        </div>
      </div>

      {/* Orders List Section */}
      <div className={`p-4 ${colors.bgLight} grow overflow-auto`}>
        <div className="space-y-3">
          {provinceGroup.orders.map((order) => (
            <div
              key={order.id}
              className={`flex items-center justify-between p-3 bg-white rounded-lg border ${colors.border} hover:shadow-md transition-all duration-200`}
            >
              <div className="flex items-center gap-4 flex-1">
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.id)}
                  onChange={() => onSelectOrder(order.id)}
                  aria-label={`Select order ${getOrderNumber(order)}`}
                  className={`h-4 w-4 ${colors.text} rounded focus:ring-2 focus:ring-offset-2 focus:ring-${colors.text.split('-')[1]}-500`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{getOrderNumber(order)}</p>
                      <p className="text-sm text-gray-600">{getCustomerName(order)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(order.total || order.totalAmount || 0)}
                      </p>
                      <p className="text-xs text-gray-500">{getOrderItemsCount(order)} items</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {getCityFromAddress(order)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Summary Section */}
        <div className="mt-4 pt-4 border-t border-gray-300">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${colors.text} font-medium`}>
                Selected:{' '}
                <span className="font-bold">
                  {selectedCount}/{provinceGroup.orders.length}
                </span>{' '}
                orders
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${colors.text}`}>
                Total Value: {formatCurrency(provinceGroup.totalValue)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LogisticsOrders() {
  const navigate = useNavigate()
  const [initialLoading, setInitialLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [logisticsStaff, setLogisticsStaff] = useState(false)
  const [userRdcLocation, setUserRdcLocation] = useState<string>('')

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [processingOrders, setProcessingOrders] = useState<Order[]>([])

  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [provinceGroups, setProvinceGroups] = useState<ProvinceGroup[]>([])

  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    deliveryDetails: [] as Array<{
      province: string
      orderCount: number
      deliveryAreas: number
      assignedDrivers?: number
      deliveryRoutes?: number
    }>,
  })

  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: '',
    message: '',
  })

  const [orderDetailsModal, setOrderDetailsModal] = useState({
    isOpen: false,
    order: null as Order | null,
  })

  const [stats, setStats] = useState({
    total: 0,
    processing: 0,
    pending: 0,
    readyToShip: 0,
    shipped: 0,
    delivered: 0,
  })

  const saveAuditLog = async (
    action: string,
    details: string,
    orderId?: string,
    orderNumber?: string,
    status: 'success' | 'failed' | 'pending' = 'success'
  ) => {
    try {
      const auditLogData: any = {
        action,
        details,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        performedBy: user?.email || '',
        userRole: 'Logistics Team',
        status,
        timestamp: new Date(),
      }

      if (orderId) auditLogData.orderId = orderId
      if (orderNumber) auditLogData.orderNumber = orderNumber
      if (userRdcLocation) auditLogData.userRDC = userRdcLocation

      await addDoc(collection(db, 'auditLogs'), auditLogData)
    } catch (error) {
      console.error('Error saving audit log:', error)
    }
  }

  const extractProvinceFromAddress = useCallback((address: string): string => {
    if (!address) return 'Unknown'

    const addressLower = address.toLowerCase()

    const sriLankanProvinces = [
      'Northern Province',
      'Southern Province',
      'Western Province',
      'Eastern Province',
      'Central Province',
      'North Western Province',
      'North Central Province',
      'Uva Province',
      'Sabaragamuwa Province',
    ]

    for (const province of sriLankanProvinces) {
      if (addressLower.includes(province.toLowerCase())) {
        return province
      }
    }

    const districtProvinceMap: Record<string, string> = {
      jaffna: 'Northern Province',
      kilinochchi: 'Northern Province',
      mannar: 'Northern Province',
      mullaitivu: 'Northern Province',
      vavuniya: 'Northern Province',
      vanni: 'Northern Province',
      galle: 'Southern Province',
      matara: 'Southern Province',
      hambantota: 'Southern Province',
      colombo: 'Western Province',
      gampaha: 'Western Province',
      kalutara: 'Western Province',
      batticaloa: 'Eastern Province',
      trincomalee: 'Eastern Province',
      ampara: 'Eastern Province',
      kandy: 'Central Province',
      matale: 'Central Province',
      'nuwara eliya': 'Central Province',
      kurunegala: 'North Western Province',
      puttalam: 'North Western Province',
      anuradhapura: 'North Central Province',
      polonnaruwa: 'North Central Province',
      badulla: 'Uva Province',
      monaragala: 'Uva Province',
      ratnapura: 'Sabaragamuwa Province',
      kegalle: 'Sabaragamuwa Province',
    }

    for (const [district, province] of Object.entries(districtProvinceMap)) {
      if (addressLower.includes(district)) {
        return province
      }
    }

    return 'Unknown'
  }, [])

  const getCityFromAddress = useCallback((address: string): string => {
    if (!address) return 'Unknown'

    const parts = address.split(',').map((p) => p.trim())

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (
        /^\d+$/.test(part) ||
        part.toLowerCase().includes('district') ||
        part.toLowerCase().includes('province') ||
        part.toLowerCase().includes('sri lanka')
      ) {
        continue
      }

      if (part.length > 0 && !/^\d+$/.test(part)) {
        return part
      }
    }

    return 'Unknown'
  }, [])

  const getDeliveryArea = useCallback((city: string): string => {
    if (!city || city === 'Unknown') return 'Unknown'
    return city
  }, [])

  const groupOrdersByProvince = useCallback(
    (ordersToGroup: Order[]): ProvinceGroup[] => {
      const groupsMap = new Map<string, ProvinceGroup>()

      ordersToGroup.forEach((order) => {
        const address = order.shippingInfo?.address || order.deliveryAddress || ''
        const province = extractProvinceFromAddress(address)
        const city = getCityFromAddress(address)
        const deliveryArea = getDeliveryArea(city)

        if (!groupsMap.has(province)) {
          groupsMap.set(province, {
            id: province.toLowerCase().replace(/\s+/g, '-'),
            province,
            orders: [],
            orderCount: 0,
            totalValue: 0,
            cities: [],
            deliveryAreas: [],
          })
        }

        const group = groupsMap.get(province)!
        group.orders.push(order)
        group.orderCount += 1
        group.totalValue += order.total || order.totalAmount || 0

        if (city !== 'Unknown' && !group.cities.includes(city)) {
          group.cities.push(city)
        }

        if (deliveryArea !== 'Unknown' && !group.deliveryAreas.includes(deliveryArea)) {
          group.deliveryAreas.push(deliveryArea)
        }
      })

      const groups = Array.from(groupsMap.values())
      groups.sort((a, b) => b.orderCount - a.orderCount)

      groups.forEach((group) => {
        group.orders.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0
          const bTime = b.createdAt?.seconds || 0
          return bTime - aTime
        })

        group.cities.sort()
        group.deliveryAreas.sort()

        if (group.orderCount <= 5) {
          group.estimatedDeliveryDays = 2
          group.driverCount = 1
        } else if (group.orderCount <= 15) {
          group.estimatedDeliveryDays = 3
          group.driverCount = 2
        } else if (group.orderCount <= 30) {
          group.estimatedDeliveryDays = 4
          group.driverCount = 3
        } else {
          group.estimatedDeliveryDays = 5
          group.driverCount = 4
        }
      })

      return groups
    },
    [extractProvinceFromAddress, getCityFromAddress, getDeliveryArea]
  )

  const saveSelectedOrdersToFirestore = async (orderIds: string[]) => {
    try {
      const sessionId = `route-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const routeSessionRef = doc(db, 'routeSessions', sessionId)

      const selectedOrderDetails = processingOrders
        .filter((order) => orderIds.includes(order.id))
        .map((order) => ({
          id: order.id,
          orderNumber: getOrderNumber(order),
          customerName: getCustomerName(order),
          totalAmount: order.total || order.totalAmount || 0,
          shippingInfo: order.shippingInfo,
          status: order.status,
          createdAt: order.createdAt,
        }))

      const sessionData = {
        sessionId,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userRDC: userRdcLocation,
        selectedOrderIds: orderIds,
        selectedOrderDetails,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true,
      }

      await setDoc(routeSessionRef, sessionData)

      await saveAuditLog(
        'Create Route Session',
        `Created route planning session with ${orderIds.length} orders`,
        undefined,
        undefined,
        'success'
      )

      return sessionId
    } catch (error) {
      console.error('Error saving route session:', error)
      throw error
    }
  }

  const sendToRoutePlanner = async () => {
    if (selectedOrders.length === 0) {
      setErrorModal({
        isOpen: true,
        title: 'No Orders Selected',
        message: 'Please select orders to send to route planner.',
      })
      return
    }

    try {
      setProcessing(true)

      const ordersWithCoordinates = processingOrders.filter(
        (order) =>
          selectedOrders.includes(order.id) &&
          order.shippingInfo?.latitude &&
          order.shippingInfo?.longitude
      )

      const ordersWithoutCoordinates = selectedOrders.filter((orderId) => {
        const order = processingOrders.find((o) => o.id === orderId)
        return !order?.shippingInfo?.latitude || !order?.shippingInfo?.longitude
      })

      if (ordersWithoutCoordinates.length > 0) {
        setErrorModal({
          isOpen: true,
          title: 'Some Orders Missing Coordinates',
          message: `${ordersWithoutCoordinates.length} selected order(s) don't have coordinates and cannot be added to route planner. Only ${ordersWithCoordinates.length} order(s) will be sent.`,
        })
      }

      if (ordersWithCoordinates.length === 0) {
        setErrorModal({
          isOpen: true,
          title: 'No Orders with Coordinates',
          message:
            'None of the selected orders have coordinates. Please select orders with shipping addresses that have been geocoded.',
        })
        return
      }

      const sessionId = await saveSelectedOrdersToFirestore(ordersWithCoordinates.map((o) => o.id))

      await saveAuditLog(
        'Send to Route Planner',
        `Sent ${ordersWithCoordinates.length} orders to route planner. Session: ${sessionId}`,
        undefined,
        undefined,
        'success'
      )

      navigate(`/route?session=${sessionId}`)
    } catch (error) {
      console.error('Error sending to route planner:', error)
      setProcessing(false)
      setErrorModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to send orders to route planner. Please try again.',
      })
    }
  }

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
            userRole === 'admin'
          setLogisticsStaff(isLogisticsStaff)

          const userRdc = userData.rdc || userData.rdcLocation || 'South RDC'
          setUserRdcLocation(userRdc)

          if (!isLogisticsStaff) {
            window.location.href = '/'
            return
          }

          setupDataListeners(userRdc)
          setInitialLoading(false)

          await saveAuditLog(
            'Logistics Team Login',
            `User ${currentUser.email} logged into delivery planning page`,
            undefined,
            undefined,
            'success'
          )
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

  const setupDataListeners = (rdcLocation: string) => {
    setLoading(true)

    const ordersUnsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        try {
          const allOrders = snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
              id: doc.id,
              ...data,
              rdcLocation: data.rdcLocation || data.location || data.rdc || rdcLocation,
              lockedByRDC: data.lockedByRDC || null,
            }
          }) as Order[]

          const processingOrdersData = allOrders.filter((o) => {
            const isProcessing = o.status === 'processing'
            return isProcessing
          })

          processingOrdersData.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0
            const bTime = b.createdAt?.seconds || 0
            return bTime - aTime
          })

          setOrders(allOrders)
          setProcessingOrders(processingOrdersData)

          const grouped = groupOrdersByProvince(processingOrdersData)
          setProvinceGroups(grouped)

          const statsData = {
            total: allOrders.length,
            processing: allOrders.filter((o) => o.status === 'processing').length,
            pending: allOrders.filter((o) => o.status === 'pending').length,
            readyToShip: allOrders.filter(
              (o) => o.status === 'ready to ship' || o.status === 'packed'
            ).length,
            shipped: allOrders.filter((o) => o.status === 'shipped' || o.status === 'in transit')
              .length,
            delivered: allOrders.filter((o) => o.status === 'delivered' || o.status === 'completed')
              .length,
          }
          setStats(statsData)

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

    const productsUnsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        try {
          const productsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[]
          setProducts(productsData)
        } catch (error) {
          console.error('Error processing products data:', error)
        }
      },
      (error) => {
        console.error('Error listening to products:', error)
      }
    )

    return () => {
      ordersUnsubscribe()
      productsUnsubscribe()
    }
  }

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

  const getOrderCity = (order: Order) => {
    const address = order.shippingInfo?.address || order.deliveryAddress || ''
    return getCityFromAddress(address)
  }

  const getOrderItemsCount = (order: Order) => {
    if (order.items && Array.isArray(order.items)) {
      return order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    }
    return 0
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    )
  }

  const selectAllOrdersInGroup = (orderIds: string[]) => {
    const allSelected = orderIds.every((id) => selectedOrders.includes(id))

    if (allSelected) {
      setSelectedOrders((prev) => prev.filter((id) => !orderIds.includes(id)))
    } else {
      const newSelection = [...selectedOrders]
      orderIds.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id)
        }
      })
      setSelectedOrders(newSelection)
    }
  }

  const selectAllOrders = () => {
    const allOrderIds = processingOrders.map((order) => order.id)
    const allSelected = allOrderIds.every((id) => selectedOrders.includes(id))

    if (allSelected) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(allOrderIds)
    }
  }

  const viewOrderDetails = async (order: Order) => {
    setOrderDetailsModal({
      isOpen: true,
      order: order,
    })

    await saveAuditLog(
      'View Order Details',
      `Viewed order details for Order ID: ${order.id} (${getOrderNumber(order)})`,
      order.id,
      getOrderNumber(order),
      'success'
    )
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading delivery orders...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <LogisticsNavbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Delivery Planning</h1>
              <p className="text-gray-600 mt-2">
                Group orders by province for efficient delivery planning
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-blue-600 text-white text-sm font-semibold rounded-full">
                Delivery Planning
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Processing</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.processing}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Ready for Delivery</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{processingOrders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Provinces</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">{provinceGroups.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Cities</p>
            <p className="text-2xl font-bold text-indigo-600 mt-2">
              {provinceGroups.reduce((sum, g) => sum + g.cities.length, 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {formatCurrency(
                processingOrders.reduce(
                  (sum, order) => sum + (order.total || order.totalAmount || 0),
                  0
                )
              )}
            </p>
          </div>
        </div>

        {selectedOrders.length > 0 && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold">
                  {selectedOrders.length}
                </div>
                <p className="text-white font-medium">
                  {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
                </p>
                <div className="text-white text-sm bg-white/30 px-2 py-1 rounded backdrop-blur-sm">
                  {
                    processingOrders.filter(
                      (o) =>
                        selectedOrders.includes(o.id) &&
                        o.shippingInfo?.latitude &&
                        o.shippingInfo?.longitude
                    ).length
                  }{' '}
                  with coordinates
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={sendToRoutePlanner}
                  disabled={processing}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  Send to Route Planner
                </button>
                <button
                  onClick={() => setSelectedOrders([])}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Orders Grouped by Province</h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
                {processingOrders.length} orders ready
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                {provinceGroups.length} provinces
              </span>
              {selectedOrders.length > 0 && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {selectedOrders.length} selected
                </span>
              )}
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            Orders are automatically grouped by province from shipping addresses. Select orders to
            plan deliveries.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
            <p className="text-gray-600">Loading orders...</p>
            <p className="text-sm text-gray-400 mt-1">Grouping orders by province</p>
          </div>
        ) : provinceGroups.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
            <p className="text-gray-500 mt-2">No orders ready for delivery</p>
            <p className="text-sm text-gray-400 mt-1">
              All orders have been processed or are in transit
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-min">
              {provinceGroups.map((group) => (
                <div key={group.id} className="h-fit">
                  <ProvinceCard
                    provinceGroup={group}
                    onSelectAll={() => selectAllOrdersInGroup(group.orders.map((o) => o.id))}
                    onSelectOrder={toggleOrderSelection}
                    selectedOrders={selectedOrders}
                    formatCurrency={formatCurrency}
                    getCustomerName={getCustomerName}
                    getOrderNumber={getOrderNumber}
                    getCityFromAddress={getOrderCity}
                    getOrderItemsCount={getOrderItemsCount}
                    viewOrderDetails={viewOrderDetails}
                  />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Delivery Planning Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {provinceGroups.map((group) => (
                  <div key={group.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{group.province}</p>
                        <p className="text-sm text-gray-600">{group.orderCount} orders</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatCurrency(group.totalValue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {group.driverCount} driver
                          {group.driverCount && group.driverCount > 1 ? 's' : ''} •{' '}
                          {group.estimatedDeliveryDays} days
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Delivery areas:</div>
                      <div className="flex flex-wrap gap-1">
                        {group.deliveryAreas.slice(0, 3).map((area, index) => (
                          <span
                            key={index}
                            className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                          >
                            {area}
                          </span>
                        ))}
                        {group.deliveryAreas.length > 3 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            +{group.deliveryAreas.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Total Orders Ready:{' '}
                      <span className="font-bold">{processingOrders.length}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Selected: <span className="font-bold">{selectedOrders.length}</span> orders
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      Total Value:{' '}
                      {formatCurrency(
                        processingOrders.reduce(
                          (sum, order) => sum + (order.total || order.totalAmount || 0),
                          0
                        )
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      Across {provinceGroups.length} provinces •{' '}
                      {provinceGroups.reduce((sum, g) => sum + g.cities.length, 0)} cities
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <OrderDetailsModal
        isOpen={orderDetailsModal.isOpen}
        onClose={() => setOrderDetailsModal({ isOpen: false, order: null })}
        order={orderDetailsModal.order}
        formatCurrency={formatCurrency}
      />

      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
        deliveryDetails={successModal.deliveryDetails}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  )
}