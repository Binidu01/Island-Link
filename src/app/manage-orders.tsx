'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import AdminNavbar from '../components/Adminnavbar'
import HOManagerNavbar from '../components/HOManagerNavbar'
import { db, auth } from '../lib/firebase'

interface User {
  uid: string
  email: string
  fullName: string
  role: string
  rdc?: string
}

interface Order {
  id: string
  orderNumber?: string
  userId: string
  userEmail: string
  status: string
  pay?: string
  items: Array<{
    productId: string
    productName: string
    name?: string
    quantity: number
    price: number
    imageURL?: string
    sku?: string
    stock?: number
  }>
  shippingInfo: {
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
  totalAmount: number
  total: number
  subtotal: number
  shipping: number
  paymentMethod: string
  createdAt: any
  updatedAt?: any
  updatedBy?: string
  updatedByRDC?: string
  updatedByRole?: string
  deliveryStartedAt?: any
  estimatedDelivery?: any
  deliveredAt?: any
  rejectedAt?: any
  rejectionReason?: string
  stockReduced?: boolean
  statusUpdates?: Array<{
    status: string
    timestamp: any
    updatedBy: string
    updatedByRDC?: string
    updatedByRole: string
    note?: string
  }>
  driverTracking?: {
    deliveryCompletedAt?: any
    deliveryStatus?: string
    driverEmail?: string
    driverId?: string
    lastCoordinates?: {
      accuracy: number
      latitude: number
      longitude: number
      timestamp: any
    }
    vehicleStatus?: string
    estimatedDelivery?: any
  }
  paidAt?: any
  cancelledAt?: any
  cancelledBy?: string
  cancellationReason?: string
}

interface StatusUpdateModal {
  isOpen: boolean
  order: Order | null
}

export default function ManageOrdersAdmin() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isHOManager, setIsHOManager] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [rdcStaff, setRdcStaff] = useState<User[]>([])
  const [logisticsTeam, setLogisticsTeam] = useState<User[]>([])
  const [filteredRDCStaff, setFilteredRDCStaff] = useState<User[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [statusUpdateModal, setStatusUpdateModal] = useState<StatusUpdateModal>({
    isOpen: false,
    order: null,
  })

  const [selectedNewStatus, setSelectedNewStatus] = useState('')
  const [selectedRDCStaff, setSelectedRDCStaff] = useState('')
  const [selectedLogistics, setSelectedLogistics] = useState('')
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState(3)

  // ⭐ Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [updating, setUpdating] = useState(false)

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '/login'
        return
      }

      setCurrentUser(user)

      try {
        const userDocRef = doc(db, 'users', user.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const isUserAdmin = userData.role === 'admin'
          const isUserHOManager = userData.role === 'HO Manager'

          setIsAdmin(isUserAdmin)
          setIsHOManager(isUserHOManager)

          if (!isUserAdmin && !isUserHOManager) {
            window.location.href = '/'
            return
          }
        } else {
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking user status:', error)
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  // Load orders and staff when authorized
  useEffect(() => {
    if (isAdmin || isHOManager) {
      loadOrders()
      loadStaff()
    }
  }, [isAdmin, isHOManager])

  const loadOrders = () => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[]

        setOrders(ordersData)
        applyFilters(ordersData, statusFilter, searchQuery)
        setLoading(false)
      },
      (error) => {
        console.error('Error loading orders:', error)
        setLoading(false)
      }
    )

    return unsubscribe
  }

  const loadStaff = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const allUsers = usersSnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as User[]

      const rdcStaffList = allUsers.filter((user) => user.role === 'RDC Staff')
      const logisticsTeamList = allUsers.filter((user) => user.role === 'Logistics Team')

      setRdcStaff(rdcStaffList)
      setLogisticsTeam(logisticsTeamList)
    } catch (error) {
      console.error('Error loading staff:', error)
    }
  }

  const applyFilters = (ordersData: Order[], status: string, search: string) => {
    let filtered = [...ordersData]

    if (status !== 'all') {
      if (status === 'paid') {
        filtered = filtered.filter((order) => order.pay?.toLowerCase() === 'paid')
      } else if (status === 'cancelled') {
        filtered = filtered.filter((order) => {
          const s = order.status?.toLowerCase()
          return s === 'cancelled' || s === 'canceled'
        })
      } else {
        filtered = filtered.filter((order) => order.status.toLowerCase() === status.toLowerCase())
      }
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(searchLower) ||
          order.orderNumber?.toLowerCase().includes(searchLower) ||
          order.userEmail.toLowerCase().includes(searchLower) ||
          order.shippingInfo.fullName.toLowerCase().includes(searchLower)
      )
    }

    setFilteredOrders(filtered)
  }

  useEffect(() => {
    applyFilters(orders, statusFilter, searchQuery)
  }, [statusFilter, searchQuery, orders])

  const getAvailableStatusTransitions = (currentStatus: string) => {
    const status = currentStatus.toLowerCase()
    const transitions = []

    switch (status) {
      case 'pending':
      case 'paid':
        transitions.push({ value: 'confirmed', label: '→ Confirm Order', requiresStaff: 'rdc' })
        transitions.push({
          value: 'processing',
          label: '→ Move to Processing (Skip Confirm)',
          requiresStaff: 'rdc',
        })
        // ⭐ Admin/HO can cancel pending orders
        transitions.push({
          value: 'cancel',
          label: '✕ Cancel Order',
          requiresStaff: null,
          isDestructive: true,
        })
        break

      case 'confirmed':
        transitions.push({
          value: 'processing',
          label: '→ Move to Processing',
          requiresStaff: 'rdc',
        })
        transitions.push({ value: 'pending', label: '← Back to Pending', requiresStaff: null })
        transitions.push({ value: 'change_rdc', label: '⚙ Change RDC Staff', requiresStaff: 'rdc' })
        // ⭐ Admin/HO can cancel confirmed orders
        transitions.push({
          value: 'cancel',
          label: '✕ Cancel Order',
          requiresStaff: null,
          isDestructive: true,
        })
        break

      case 'processing':
        transitions.push({
          value: 'out_for_delivery',
          label: '→ Move to Out for Delivery',
          requiresStaff: 'logistics',
        })
        transitions.push({ value: 'confirmed', label: '← Back to Confirmed', requiresStaff: null })
        transitions.push({ value: 'change_rdc', label: '⚙ Change RDC Staff', requiresStaff: 'rdc' })
        // ⭐ Admin/HO can cancel processing orders
        transitions.push({
          value: 'cancel',
          label: '✕ Cancel Order',
          requiresStaff: null,
          isDestructive: true,
        })
        break

      case 'out_for_delivery':
      case 'out for delivery':
        transitions.push({ value: 'delivered', label: '✓ Mark as Delivered', requiresStaff: null })
        transitions.push({
          value: 'processing',
          label: '← Back to Processing',
          requiresStaff: null,
        })
        transitions.push({
          value: 'change_logistics',
          label: '⚙ Change Logistics Team',
          requiresStaff: 'logistics',
        })
        // ⭐ Admin/HO can cancel out-for-delivery orders
        transitions.push({
          value: 'cancel',
          label: '✕ Cancel Order',
          requiresStaff: null,
          isDestructive: true,
        })
        break

      case 'delivered':
        transitions.push({
          value: 'out_for_delivery',
          label: '← Back to Out for Delivery',
          requiresStaff: null,
        })
        transitions.push({
          value: 'change_logistics',
          label: '⚙ Change Logistics Team',
          requiresStaff: 'logistics',
        })
        // Admin/HO should not cancel delivered orders — no cancel option
        break

      case 'rejected':
        transitions.push({
          value: 'pending',
          label: '↻ Reactivate to Pending',
          requiresStaff: null,
        })
        break

      case 'cancelled':
      case 'canceled':
        transitions.push({
          value: 'pending',
          label: '↻ Reactivate to Pending',
          requiresStaff: null,
        })
        break
    }

    return transitions
  }

  const openStatusUpdateModal = async (order: Order) => {
    setStatusUpdateModal({
      isOpen: true,
      order,
    })
    setSelectedNewStatus('')
    setSelectedRDCStaff('')
    setSelectedLogistics('')
    setEstimatedDeliveryDays(3)
    setFilteredRDCStaff(rdcStaff)
  }

  // ⭐ Open cancel modal
  const openCancelModal = (order: Order) => {
    setCancelOrder(order)
    setCancellationReason('')
    setShowCancelModal(true)
  }

  const getOutForDeliveryLogisticsMember = (order: Order): User | undefined => {
    if (!order.statusUpdates || order.statusUpdates.length === 0) {
      return undefined
    }

    const outForDeliveryUpdate = order.statusUpdates.find(
      (update) => update.status === 'out for delivery' || update.status === 'out_for_delivery'
    )

    if (!outForDeliveryUpdate) {
      return undefined
    }

    return logisticsTeam.find((member) => member.email === outForDeliveryUpdate.updatedBy)
  }

  const getLastRDCStaffMember = (order: Order): User | undefined => {
    if (!order.statusUpdates || order.statusUpdates.length === 0) {
      return undefined
    }

    const rdcUpdates = order.statusUpdates.filter(
      (update) => update.status === 'confirmed' || update.status === 'processing'
    )

    if (rdcUpdates.length === 0) {
      return undefined
    }

    const lastRDCUpdate = rdcUpdates[rdcUpdates.length - 1]
    return rdcStaff.find((staff) => staff.email === lastRDCUpdate.updatedBy)
  }

  const sendOrderStatusUpdateEmail = async (
    order: Order,
    newStatus: string,
    updateData: any,
    rdcStaffMember?: User,
    logisticsMember?: User
  ) => {
    try {
      let statusMessage = ''
      let statusColor = '#3b82f6'
      let statusIcon = '📦'
      let additionalInfo = ''

      switch (newStatus.toLowerCase()) {
        case 'confirmed':
          statusMessage = 'Your order has been confirmed and is being prepared.'
          statusColor = '#14b8a6'
          statusIcon = '✅'
          if (rdcStaffMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Your order is being processed at <strong>${rdcStaffMember.rdc || 'our warehouse'}</strong>.</p>`
          }
          break

        case 'processing':
          statusMessage = 'Your order is now being processed at our warehouse.'
          statusColor = '#6366f1'
          statusIcon = '⚙️'
          if (rdcStaffMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Processing at: <strong>${rdcStaffMember.rdc || 'Warehouse'}</strong></p>`
          }
          break

        case 'out_for_delivery':
        case 'out for delivery':
          statusMessage = 'Great news! Your order is out for delivery.'
          statusColor = '#f97316'
          statusIcon = '🚚'
          if (logisticsMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Delivery team: <strong>${logisticsMember.fullName}</strong></p>`
          }
          if (updateData.estimatedDelivery) {
            const estimatedDate = new Date(updateData.estimatedDelivery)
            additionalInfo += `<p style="color: #6b7280; margin: 10px 0;">Estimated delivery: <strong>${estimatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>`
          }
          break

        case 'delivered':
          statusMessage = 'Your order has been successfully delivered!'
          statusColor = '#10b981'
          statusIcon = '✓'
          if (logisticsMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Delivered by: <strong>${logisticsMember.fullName}</strong></p>`
          }
          break

        // ⭐ NEW: Cancellation email content
        case 'cancelled':
        case 'canceled':
          statusMessage = 'Your order has been cancelled.'
          statusColor = '#ef4444'
          statusIcon = '❌'
          additionalInfo = `
            <p style="color: #6b7280; margin: 10px 0;">Cancelled by: <strong>${isAdmin ? 'Admin' : 'HO Manager'}</strong></p>
            ${updateData.cancellationReason ? `<p style="color: #6b7280; margin: 10px 0;">Reason: <strong>${updateData.cancellationReason}</strong></p>` : ''}
            ${
              order.paymentMethod?.toLowerCase() === 'cod'
                ? '<p style="color: #6b7280; margin: 10px 0;">No payment was collected since this was a Cash on Delivery order.</p>'
                : '<p style="color: #6b7280; margin: 10px 0;">A refund will be initiated to your original payment method within 5–7 business days.</p>'
            }
          `
          break

        default:
          statusMessage = `Your order status has been updated to: ${newStatus.replace('_', ' ').toUpperCase()}`
          statusIcon = '📋'
      }

      const orderItemsHtml = order.items
        .map((item: any) => {
          const skuValue = item.sku || item.productId
          const itemName = item.productName || item.name
          return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 4px;">${itemName}</div>
            <div style="color: #6b7280; font-size: 12px;">SKU: ${skuValue}</div>
           </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; vertical-align: top;">
            ${item.quantity}
           </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #f97316; white-space: nowrap; vertical-align: top;">
            LKR ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}
           </td>
         </tr>
      `
        })
        .join('')

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #f97316 0%, #06b6d4 50%, #10b981 100%); padding: 40px 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 28px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }
            .content { padding: 30px 20px; }
            .status-box { background: ${statusColor}15; border-left: 4px solid ${statusColor}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .status-box h2 { color: ${statusColor}; margin: 0 0 10px 0; font-size: 24px; }
            .status-box p { color: #4b5563; margin: 0; font-size: 16px; }
            .order-id { background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
            .order-id strong { color: #1f2937; font-size: 18px; }
            .section { margin: 25px 0; }
            .section-title { font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .summary-table td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
            .summary-table tr:last-child td { border-bottom: none; }
            .total-row { background: #fef3c7; font-weight: 700; font-size: 18px; }
            .total-row td { padding: 15px 10px !important; color: #92400e; }
            .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #06b6d4, #0ea5e9); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; box-shadow: 0 4px 6px rgba(6, 182, 212, 0.3); }
            .footer { background: #1f2937; color: #9ca3af; padding: 30px 20px; text-align: center; }
            .footer a { color: #06b6d4; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${statusIcon} Order Status Update</h1>
              <p>IslandLink Smart Distribution</p>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; color: #4b5563;">Dear <strong>${order.shippingInfo.fullName}</strong>,</p>
              
              <div class="order-id">
                <strong>Order ID: #${order.id}</strong>
              </div>
              
              <div class="status-box">
                <h2>${statusIcon} ${newStatus.replace('_', ' ').toUpperCase()}</h2>
                <p>${statusMessage}</p>
                ${additionalInfo}
              </div>
              
              <div class="section">
                <div class="section-title">📦 Order Items</div>
                <table style="width: 100%; border-collapse: collapse;" cellpadding="0" cellspacing="0">
                  <thead>
                    <tr style="background: linear-gradient(135deg, #f97316 0%, #06b6d4 50%); color: white;">
                      <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product Details</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                      <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${orderItemsHtml}
                  </tbody>
                </table>
              </div>
              
              <div class="section">
                <div class="section-title">💰 Order Summary</div>
                <table class="summary-table" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color: #6b7280;">Subtotal</td>
                    <td style="text-align: right; font-weight: 600;">LKR ${order.subtotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280;">Shipping Fee</td>
                    <td style="text-align: right; font-weight: 600; color: ${order.shipping === 0 ? '#10b981' : '#1f2937'};">
                      ${order.shipping === 0 ? 'FREE' : `LKR ${order.shipping.toLocaleString()}`}
                    </td>
                  </tr>
                  <tr class="total-row">
                    <td>Total Amount</td>
                    <td style="text-align: right;">LKR ${order.total.toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              
              <div class="section">
                <div class="section-title">🚚 Delivery Information</div>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                  <p style="margin: 5px 0; color: #4b5563;"><strong>Name:</strong> ${order.shippingInfo.fullName}</p>
                  <p style="margin: 5px 0; color: #4b5563;"><strong>Phone:</strong> ${order.shippingInfo.phone}</p>
                  <p style="margin: 5px 0; color: #4b5563;"><strong>Address:</strong> ${order.shippingInfo.address}</p>
                  <p style="margin: 5px 0; color: #4b5563;"><strong>City:</strong> ${order.shippingInfo.city}</p>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://your-domain.com/orders" class="button" style="color: white; text-decoration: none;">
                  View My Orders
                </a>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin-top: 30px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Need Help?</strong> Contact us at 
                  <a href="mailto:support@islandlink.com" style="color: #d97706;">support@islandlink.com</a> or call +94 77 123 4567
                </p>
              </div>
            </div>
            
            <div class="footer">
              <p style="margin: 0 0 10px 0; font-size: 16px; color: #ffffff;">
                <strong>IslandLink Smart Distribution</strong>
              </p>
              <p style="margin: 10px 0; font-size: 14px;">
                Your trusted e-commerce platform for quality products
              </p>
              <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280;">
                © ${new Date().getFullYear()} IslandLink Smart Distribution. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailText = `
Order Status Update - IslandLink

Dear ${order.shippingInfo.fullName},

${statusMessage}

ORDER DETAILS
Order ID: #${order.id}
Status: ${newStatus.replace('_', ' ').toUpperCase()}

${rdcStaffMember ? `Processing at: ${rdcStaffMember.rdc || 'Warehouse'}` : ''}
${logisticsMember ? `Delivery team: ${logisticsMember.fullName}` : ''}
${updateData.estimatedDelivery ? `Estimated delivery: ${new Date(updateData.estimatedDelivery).toLocaleDateString()}` : ''}
${updateData.cancellationReason ? `Cancellation reason: ${updateData.cancellationReason}` : ''}

ORDER ITEMS
${order.items
  .map((item: any) => {
    const skuValue = item.sku || item.productId
    const itemName = item.productName || item.name
    return `- ${itemName}\n  SKU: ${skuValue}\n  Quantity: ${item.quantity}\n  Total: LKR ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`
  })
  .join('\n\n')}

ORDER SUMMARY
Subtotal: LKR ${order.subtotal.toLocaleString()}
Shipping: ${order.shipping === 0 ? 'FREE' : `LKR ${order.shipping.toLocaleString()}`}
Total: LKR ${order.total.toLocaleString()}

DELIVERY ADDRESS
${order.shippingInfo.fullName}
${order.shippingInfo.phone}
${order.shippingInfo.address}
${order.shippingInfo.city}

View your orders: https://your-domain.com/orders

Need help? Contact us at support@islandlink.com or call +94 77 123 4567

© ${new Date().getFullYear()} IslandLink Smart Distribution. All rights reserved.
      `

      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: order.shippingInfo.email,
          subject: `Order Update: ${newStatus.replace('_', ' ').toUpperCase()} - IslandLink`,
          html: emailHtml,
          text: emailText,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send email')
      }

      console.log('✅ Order status update email sent successfully')
    } catch (error) {
      console.error('❌ Email sending error:', error)
      throw error
    }
  }

  const reduceProductStock = async (order: Order) => {
    try {
      for (const item of order.items) {
        const productRef = doc(db, 'products', item.productId)
        const productDoc = await getDoc(productRef)

        if (productDoc.exists()) {
          const productData = productDoc.data()
          const currentStock = productData.stock || 0
          const newStock = currentStock - item.quantity

          if (newStock < 0) {
            throw new Error(
              `Insufficient stock for product ${item.productName}. Available: ${currentStock}, Required: ${item.quantity}`
            )
          }

          await updateDoc(productRef, {
            stock: newStock,
            updatedAt: new Date(),
          })
        }
      }
    } catch (error) {
      console.error('❌ Error reducing stock:', error)
      throw error
    }
  }

  // ⭐ NEW: Restore product stocks when cancelling an order that had stockReduced
  const restoreProductStock = async (order: Order) => {
    try {
      for (const item of order.items) {
        const productRef = doc(db, 'products', item.productId)
        const productDoc = await getDoc(productRef)

        if (productDoc.exists()) {
          const productData = productDoc.data()
          const currentStock = productData.stock || 0
          const newStock = currentStock + item.quantity

          await updateDoc(productRef, {
            stock: newStock,
            updatedAt: new Date(),
          })
        }
      }
    } catch (error) {
      console.error('❌ Error restoring stock:', error)
      throw error
    }
  }

  const shouldUpdatePaymentToPaid = (order: Order, newStatus: string): boolean => {
    return newStatus === 'delivered' && order.paymentMethod?.toLowerCase() === 'cod'
  }

  const shouldResetPaymentToPending = (order: Order, newStatus: string): boolean => {
    return (
      newStatus === 'out_for_delivery' &&
      order.status === 'delivered' &&
      order.paymentMethod?.toLowerCase() === 'cod'
    )
  }

  // ⭐ NEW: Handle order cancellation
  const handleCancelOrder = async () => {
    if (!cancelOrder || !currentUser) return

    if (!cancellationReason.trim()) {
      setModalMessage('Please provide a reason for cancellation')
      setShowErrorModal(true)
      return
    }

    setCancelling(true)

    try {
      const orderRef = doc(db, 'orders', cancelOrder.id)

      const statusUpdateEntry: any = {
        status: 'cancelled',
        timestamp: new Date(),
        updatedBy: currentUser.email,
        updatedByRole: isAdmin ? 'admin' : 'HO Manager',
        note: cancellationReason.trim(),
      }

      const updateData: any = {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: currentUser.email,
        cancellationReason: cancellationReason.trim(),
        statusUpdates: [...(cancelOrder.statusUpdates || []), statusUpdateEntry],
        updatedAt: new Date(),
        updatedBy: currentUser.email,
        updatedByRole: isAdmin ? 'admin' : 'HO Manager',
      }

      // If order was paid online, mark it as refunded
      if (
        cancelOrder.paymentMethod?.toLowerCase() !== 'cod' &&
        cancelOrder.pay === 'paid'
      ) {
        updateData.pay = 'refunded'
      }

      // Restore stock if it was previously reduced
      if (
        cancelOrder.stockReduced ||
        ['confirmed', 'processing', 'out_for_delivery'].includes(
          cancelOrder.status?.toLowerCase() || ''
        )
      ) {
        await restoreProductStock(cancelOrder)
        updateData.stockReduced = false
      }

      await updateDoc(orderRef, updateData)

      // Send email notification
      try {
        await sendOrderStatusUpdateEmail(cancelOrder, 'cancelled', updateData)
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError)
      }

      setShowCancelModal(false)
      setCancelOrder(null)
      setCancellationReason('')
      setStatusUpdateModal({ isOpen: false, order: null })
      setSelectedNewStatus('')
      setModalMessage(
        `Order ${getOrderNumber(cancelOrder)} cancelled successfully!${
          cancelOrder.paymentMethod?.toLowerCase() !== 'cod' && cancelOrder.pay === 'paid'
            ? ' Refund will be processed.'
            : ''
        }`
      )
      setShowSuccessModal(true)
    } catch (error: any) {
      console.error('Error cancelling order:', error)
      setModalMessage(error.message || 'Failed to cancel order')
      setShowErrorModal(true)
    } finally {
      setCancelling(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!statusUpdateModal.order || !selectedNewStatus) return

    setUpdating(true)

    try {
      const orderRef = doc(db, 'orders', statusUpdateModal.order.id)
      const updateData: any = {
        updatedAt: new Date(),
        updatedByRole: isAdmin ? 'admin' : 'HO Manager',
      }

      let rdcStaffMember: User | undefined
      let logisticsMember: User | undefined

      const existingStatusUpdates = statusUpdateModal.order.statusUpdates || []
      let newStatusUpdates = [...existingStatusUpdates]

      if (selectedNewStatus === 'change_rdc') {
        if (!selectedRDCStaff) {
          setModalMessage('Please select an RDC staff member')
          setShowErrorModal(true)
          setUpdating(false)
          return
        }
        rdcStaffMember = rdcStaff.find((s) => s.uid === selectedRDCStaff)
        updateData.updatedByRDC = rdcStaffMember?.rdc || 'Unknown RDC'

        const statusUpdateEntry = {
          status: 'processing',
          timestamp: new Date(),
          updatedBy: rdcStaffMember?.email || currentUser.email,
          updatedByRDC: rdcStaffMember?.rdc || 'Unknown RDC',
          updatedByRole: rdcStaffMember?.role || 'RDC Staff',
        }
        newStatusUpdates = [...newStatusUpdates, statusUpdateEntry]
      } else if (selectedNewStatus === 'change_logistics') {
        if (!selectedLogistics) {
          setModalMessage('Please select a logistics team member')
          setShowErrorModal(true)
          setUpdating(false)
          return
        }
        logisticsMember = logisticsTeam.find((l) => l.uid === selectedLogistics)
        updateData.updatedBy = logisticsMember?.email

        const statusUpdateEntry = {
          status: 'out for delivery',
          timestamp: new Date(),
          updatedBy: logisticsMember?.email || currentUser.email,
          updatedByRDC: statusUpdateModal.order.updatedByRDC || 'Unknown RDC',
          updatedByRole: logisticsMember?.role || 'Logistics Team',
        }
        newStatusUpdates = [...newStatusUpdates, statusUpdateEntry]
      } else {
        updateData.status = selectedNewStatus

        const isReversingStatus =
          (statusUpdateModal.order.status === 'delivered' &&
            selectedNewStatus === 'out_for_delivery') ||
          (statusUpdateModal.order.status === 'out_for_delivery' &&
            selectedNewStatus === 'processing') ||
          (statusUpdateModal.order.status === 'processing' && selectedNewStatus === 'confirmed') ||
          (statusUpdateModal.order.status === 'confirmed' && selectedNewStatus === 'pending') ||
          (statusUpdateModal.order.status === 'rejected' && selectedNewStatus === 'pending') ||
          (statusUpdateModal.order.status === 'cancelled' && selectedNewStatus === 'pending') ||
          (statusUpdateModal.order.status === 'canceled' && selectedNewStatus === 'pending')

        if (isReversingStatus && newStatusUpdates.length > 0) {
          newStatusUpdates = newStatusUpdates.slice(0, -1)
        }

        const statusUpdateEntry: any = {
          status: selectedNewStatus,
          timestamp: new Date(),
          updatedBy: currentUser.email,
          updatedByRole: isAdmin ? 'admin' : 'HO Manager',
        }

        if (selectedNewStatus === 'delivered') {
          updateData.deliveredAt = new Date()

          if (shouldUpdatePaymentToPaid(statusUpdateModal.order, 'delivered')) {
            updateData.pay = 'paid'
            updateData.paidAt = new Date()
          }

          logisticsMember = getOutForDeliveryLogisticsMember(statusUpdateModal.order)

          if (logisticsMember) {
            statusUpdateEntry.updatedBy = logisticsMember.email
            statusUpdateEntry.updatedByRole = logisticsMember.role
            updateData.updatedBy = logisticsMember.email
          }

          if (statusUpdateModal.order.driverTracking) {
            updateData.driverTracking = {
              ...statusUpdateModal.order.driverTracking,
              deliveryCompletedAt: new Date(),
              deliveryStatus: 'delivered',
              vehicleStatus: 'delivered',
            }
          }

          updateData.updatedByRDC = null
        } else if (selectedNewStatus === 'out_for_delivery') {
          updateData.deliveredAt = null
          updateData.paidAt = null

          if (!selectedLogistics) {
            setModalMessage('Please select a logistics team member')
            setShowErrorModal(true)
            setUpdating(false)
            return
          }
          logisticsMember = logisticsTeam.find((l) => l.uid === selectedLogistics)
          updateData.updatedBy = logisticsMember?.email
          updateData.deliveryStartedAt = new Date()

          const estimatedDate = new Date()
          estimatedDate.setDate(estimatedDate.getDate() + estimatedDeliveryDays)
          updateData.estimatedDelivery = estimatedDate

          updateData.driverTracking = {
            deliveryStartedAt: new Date(),
            driverEmail: logisticsMember?.email,
            driverId: logisticsMember?.uid,
            estimatedDelivery: estimatedDate,
            vehicleStatus: 'on_delivery',
          }

          statusUpdateEntry.updatedBy = logisticsMember?.email || currentUser.email
          statusUpdateEntry.updatedByRole = logisticsMember?.role || 'Logistics Team'

          updateData.updatedByRDC = null
        } else if (
          selectedNewStatus === 'out_for_delivery' &&
          statusUpdateModal.order.status === 'delivered'
        ) {
          updateData.deliveredAt = null

          if (shouldResetPaymentToPending(statusUpdateModal.order, 'out_for_delivery')) {
            updateData.pay = 'pending'
            updateData.paidAt = null
          }

          if (statusUpdateModal.order.driverTracking) {
            updateData.driverTracking = {
              ...statusUpdateModal.order.driverTracking,
              deliveryCompletedAt: null,
              deliveryStatus: 'out_for_delivery',
              vehicleStatus: 'on_delivery',
            }
          }

          updateData.updatedBy = currentUser.email
        } else if (selectedNewStatus === 'pending') {
          updateData.deliveredAt = null
          updateData.paidAt = null
          updateData.driverTracking = null
          updateData.deliveryStartedAt = null
          updateData.estimatedDelivery = null
          updateData.updatedBy = null
          updateData.updatedByRDC = null

          if (statusUpdateModal.order.paymentMethod?.toLowerCase() === 'cod') {
            updateData.pay = 'pending'
          }
        } else if (selectedNewStatus === 'processing' || selectedNewStatus === 'confirmed') {
          updateData.deliveredAt = null
          updateData.paidAt = null
          updateData.driverTracking = null
          updateData.deliveryStartedAt = null
          updateData.estimatedDelivery = null
          updateData.updatedBy = null
        }

        const statusesWithRDC = ['confirmed', 'processing']
        const statusesWithoutRDC = [
          'out_for_delivery',
          'delivered',
          'rejected',
          'pending',
          'cancelled',
        ]

        if (statusesWithRDC.includes(selectedNewStatus)) {
          statusUpdateEntry.updatedByRDC = statusUpdateModal.order.updatedByRDC || 'Unknown RDC'
        } else if (statusesWithoutRDC.includes(selectedNewStatus)) {
          delete statusUpdateEntry.updatedByRDC
        }

        const lastStatusUpdate = newStatusUpdates[newStatusUpdates.length - 1]
        const shouldAddNewEntry =
          !isReversingStatus && (!lastStatusUpdate || lastStatusUpdate.status !== selectedNewStatus)

        if (shouldAddNewEntry) {
          newStatusUpdates = [...newStatusUpdates, statusUpdateEntry]
        }

        if (selectedNewStatus === 'confirmed') {
          if (!selectedRDCStaff) {
            setModalMessage('Please select an RDC staff member')
            setShowErrorModal(true)
            setUpdating(false)
            return
          }

          await reduceProductStock(statusUpdateModal.order)

          rdcStaffMember = filteredRDCStaff.find((s) => s.uid === selectedRDCStaff)
          updateData.updatedByRDC = rdcStaffMember?.rdc || 'Unknown RDC'
          updateData.stockReduced = true

          statusUpdateEntry.updatedBy = rdcStaffMember?.email || currentUser.email
          statusUpdateEntry.updatedByRDC = rdcStaffMember?.rdc || 'Unknown RDC'
          statusUpdateEntry.updatedByRole = rdcStaffMember?.role || 'RDC Staff'
        }

        if (selectedNewStatus === 'processing') {
          if (!selectedRDCStaff) {
            setModalMessage('Please select an RDC staff member')
            setShowErrorModal(true)
            setUpdating(false)
            return
          }

          if (!statusUpdateModal.order.stockReduced) {
            await reduceProductStock(statusUpdateModal.order)
            updateData.stockReduced = true
          }

          rdcStaffMember = filteredRDCStaff.find((s) => s.uid === selectedRDCStaff)
          updateData.updatedByRDC = rdcStaffMember?.rdc || 'Unknown RDC'

          statusUpdateEntry.updatedBy = rdcStaffMember?.email || currentUser.email
          statusUpdateEntry.updatedByRDC = rdcStaffMember?.rdc || 'Unknown RDC'
          statusUpdateEntry.updatedByRole = rdcStaffMember?.role || 'RDC Staff'
        }

        if (selectedNewStatus === 'rejected') {
          updateData.rejectedAt = new Date()
          delete statusUpdateEntry.updatedByRDC
        }
      }

      if (newStatusUpdates.length > 0) {
        updateData.statusUpdates = newStatusUpdates
      }

      await updateDoc(orderRef, updateData)

      if (!selectedNewStatus.startsWith('change_')) {
        const isReversing =
          (statusUpdateModal.order.status === 'delivered' &&
            selectedNewStatus === 'out_for_delivery') ||
          (statusUpdateModal.order.status === 'out_for_delivery' &&
            selectedNewStatus === 'processing') ||
          (statusUpdateModal.order.status === 'processing' && selectedNewStatus === 'confirmed') ||
          (statusUpdateModal.order.status === 'confirmed' && selectedNewStatus === 'pending') ||
          (statusUpdateModal.order.status === 'rejected' && selectedNewStatus === 'pending') ||
          (statusUpdateModal.order.status === 'cancelled' && selectedNewStatus === 'pending')

        if (!isReversing) {
          try {
            await sendOrderStatusUpdateEmail(
              statusUpdateModal.order,
              selectedNewStatus,
              updateData,
              rdcStaffMember,
              logisticsMember
            )
          } catch (emailError) {
            console.error('Failed to send email notification:', emailError)
          }
        }
      }

      const message = selectedNewStatus.startsWith('change_')
        ? 'Staff assignments updated successfully!'
        : `Order status updated to ${selectedNewStatus.toUpperCase().replace('_', ' ')} successfully!${
            selectedNewStatus === 'delivered' &&
            shouldUpdatePaymentToPaid(statusUpdateModal.order, 'delivered')
              ? ' Payment status automatically set to PAID for COD orders.'
              : selectedNewStatus === 'delivered'
                ? ' Payment status remains unchanged for online payments.'
                : ''
          }`

      setModalMessage(message)
      setShowSuccessModal(true)
      setStatusUpdateModal({ isOpen: false, order: null })
      setSelectedNewStatus('')
    } catch (error: any) {
      console.error('Error updating order:', error)
      setModalMessage(error.message || 'Failed to update order')
      setShowErrorModal(true)
    } finally {
      setUpdating(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      return 'N/A'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      case 'confirmed':
        return 'bg-teal-100 text-teal-800'
      case 'processing':
        return 'bg-indigo-100 text-indigo-800'
      case 'out_for_delivery':
        return 'bg-orange-100 text-orange-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'rejected':
      case 'cancelled':
      case 'canceled':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOrderNumber = (order: Order) => {
    if (order.orderNumber) return `#${order.orderNumber}`
    return `ORD-${order.id.toUpperCase().substring(0, 8)}`
  }

  const getPaymentStatus = (order: Order): string => {
    if (order.pay) {
      return order.pay.toUpperCase()
    }

    if (order.paymentMethod?.toLowerCase() === 'cod') {
      return 'PENDING'
    }

    return 'PAID'
  }

  const getAssignedStaff = (order: Order) => {
    const rdcStaffMember = getLastRDCStaffMember(order)
    const logisticsMember = getOutForDeliveryLogisticsMember(order)

    return {
      rdcStaff: rdcStaffMember,
      logisticsMember: logisticsMember,
    }
  }

  if (!isAdmin && !isHOManager && loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  const needsLogistics =
    selectedNewStatus === 'out_for_delivery' || selectedNewStatus === 'change_logistics'
  const needsRDCStaff =
    selectedNewStatus === 'processing' ||
    selectedNewStatus === 'change_rdc' ||
    selectedNewStatus === 'confirmed'

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      {isAdmin ? <AdminNavbar /> : <HOManagerNavbar />}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600 mt-2">
            Manage orders and assign to RDC staff and logistics team
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Orders</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                placeholder="Search by order ID, customer name, email..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
              >
                <option value="all">All Orders</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Orders ({filteredOrders.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => {
                    const assignedStaff = getAssignedStaff(order)
                    const isRDCWork = order.status === 'confirmed' || order.status === 'processing'
                    const isLogisticsWork =
                      order.status === 'out_for_delivery' || order.status === 'delivered'
                    const isCancelled =
                      order.status?.toLowerCase() === 'cancelled' ||
                      order.status?.toLowerCase() === 'canceled'

                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {getOrderNumber(order)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatTimestamp(order.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {order.shippingInfo.fullName}
                          </div>
                          <div className="text-sm text-gray-500">{order.userEmail}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(order.total)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                          >
                            {order.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(getPaymentStatus(order))}`}
                          >
                            {getPaymentStatus(order)}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {order.paymentMethod?.toUpperCase() || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {isRDCWork && assignedStaff.rdcStaff && (
                              <div className="mb-1">
                                <span className="font-medium">RDC:</span>{' '}
                                {assignedStaff.rdcStaff.rdc || 'Unknown RDC'}
                                <div className="text-xs text-gray-500">
                                  {assignedStaff.rdcStaff.fullName} (
                                  {assignedStaff.rdcStaff.email.split('@')[0]})
                                </div>
                              </div>
                            )}

                            {isLogisticsWork && assignedStaff.logisticsMember && (
                              <div className="mt-1">
                                <span className="font-medium">Delivery:</span>{' '}
                                {assignedStaff.logisticsMember.fullName}
                                <div className="text-xs text-gray-500">
                                  {assignedStaff.logisticsMember.email.split('@')[0]}
                                </div>
                              </div>
                            )}

                            {!assignedStaff.rdcStaff && !assignedStaff.logisticsMember && (
                              <span className="text-gray-400">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openStatusUpdateModal(order)}
                              className="inline-flex items-center px-3 py-1.5 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition text-xs"
                            >
                              Update
                            </button>
                            {!isCancelled && order.status?.toLowerCase() !== 'delivered' && (
                              <button
                                onClick={() => openCancelModal(order)}
                                className="inline-flex items-center px-3 py-1.5 bg-white border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Status Update Modal with Blur */}
      {statusUpdateModal.isOpen && statusUpdateModal.order && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => !updating && setStatusUpdateModal({ isOpen: false, order: null })}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Update Order: {getOrderNumber(statusUpdateModal.order)}
                </h3>
                <button
                  onClick={() => setStatusUpdateModal({ isOpen: false, order: null })}
                  disabled={updating}
                  aria-label="Close status update modal"
                  className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Status
                  </label>
                  <div
                    className={`px-4 py-2 rounded-lg ${getStatusColor(statusUpdateModal.order.status)}`}
                  >
                    {statusUpdateModal.order.status.toUpperCase().replace('_', ' ')}
                  </div>
                </div>

                {statusUpdateModal.order.cancellationReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-red-800 mb-1">
                      ❌ Order Cancelled
                    </p>
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Reason:</span>{' '}
                      {statusUpdateModal.order.cancellationReason}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Payment Status
                  </label>
                  <div
                    className={`px-4 py-2 rounded-lg ${getStatusColor(getPaymentStatus(statusUpdateModal.order))}`}
                  >
                    {getPaymentStatus(statusUpdateModal.order)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Payment Method: {statusUpdateModal.order.paymentMethod?.toUpperCase() || 'N/A'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currently Assigned
                  </label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    {(() => {
                      const assignedStaff = getAssignedStaff(statusUpdateModal.order)
                      const isRDCWork =
                        statusUpdateModal.order.status === 'confirmed' ||
                        statusUpdateModal.order.status === 'processing'
                      const isLogisticsWork =
                        statusUpdateModal.order.status === 'out_for_delivery' ||
                        statusUpdateModal.order.status === 'delivered'

                      return (
                        <>
                          {isRDCWork && assignedStaff.rdcStaff && (
                            <div className="mb-2">
                              <span className="font-medium">RDC Staff:</span>{' '}
                              {assignedStaff.rdcStaff.fullName}
                              <div className="text-sm text-gray-500">
                                {assignedStaff.rdcStaff.rdc} • {assignedStaff.rdcStaff.email}
                              </div>
                            </div>
                          )}
                          {isLogisticsWork && assignedStaff.logisticsMember && (
                            <div>
                              <span className="font-medium">Logistics Team:</span>{' '}
                              {assignedStaff.logisticsMember.fullName}
                              <div className="text-sm text-gray-500">
                                {assignedStaff.logisticsMember.email}
                              </div>
                            </div>
                          )}
                          {!assignedStaff.rdcStaff && !assignedStaff.logisticsMember && (
                            <span className="text-gray-400">No staff assigned</span>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Action *
                  </label>
                  <select
                    value={selectedNewStatus}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'cancel') {
                        setShowCancelModal(true)
                        setCancelOrder(statusUpdateModal.order)
                        setCancellationReason('')
                        setStatusUpdateModal({ isOpen: false, order: null })
                        setSelectedNewStatus('')
                      } else {
                        setSelectedNewStatus(val)
                        setSelectedRDCStaff('')
                        setSelectedLogistics('')
                      }
                    }}
                    aria-label="Select action to update order status"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  >
                    <option value="">Choose an action...</option>
                    {getAvailableStatusTransitions(statusUpdateModal.order.status).map(
                      (transition) => (
                        <option key={transition.value} value={transition.value}>
                          {transition.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {needsRDCStaff && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select RDC Staff *
                    </label>
                    <select
                      value={selectedRDCStaff}
                      onChange={(e) => setSelectedRDCStaff(e.target.value)}
                      aria-label="Select RDC staff member"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    >
                      <option value="">Select RDC Staff Member</option>
                      {filteredRDCStaff.length > 0 ? (
                        filteredRDCStaff.map((staff) => (
                          <option key={staff.uid} value={staff.uid}>
                            {staff.fullName} - {staff.rdc} ({staff.email})
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          No RDC staff available
                        </option>
                      )}
                    </select>
                  </div>
                )}

                {needsLogistics && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Logistics Team *
                      </label>
                      <select
                        value={selectedLogistics}
                        onChange={(e) => setSelectedLogistics(e.target.value)}
                        aria-label="Select logistics team member"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
                        required
                      >
                        <option value="">Select Logistics Team Member</option>
                        {logisticsTeam.map((member) => (
                          <option key={member.uid} value={member.uid}>
                            {member.fullName} - {member.rdc} ({member.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="estimatedDeliveryDays"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Estimated Delivery Days
                      </label>
                      <input
                        id="estimatedDeliveryDays"
                        type="number"
                        min="1"
                        max="10"
                        value={estimatedDeliveryDays}
                        onChange={(e) => setEstimatedDeliveryDays(parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setStatusUpdateModal({ isOpen: false, order: null })}
                  disabled={updating}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusUpdate}
                  disabled={updating || !selectedNewStatus}
                  className="px-6 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {updating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Order'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ⭐ NEW: Cancel Order Modal with Blur */}
      {showCancelModal && cancelOrder && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => !cancelling && setShowCancelModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-red-600">Cancel Order</h2>
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  aria-label="Close cancel modal"
                  className="text-gray-400 hover:text-gray-600 text-2xl disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto">
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

                <div>
                  <p className="text-sm text-gray-500 mb-1">Order Number</p>
                  <p className="font-semibold text-gray-900">{getOrderNumber(cancelOrder)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Customer</p>
                  <p className="font-semibold text-gray-900">
                    {cancelOrder.shippingInfo?.fullName || 'Customer'}
                  </p>
                </div>

                {cancelOrder.paymentMethod?.toLowerCase() !== 'cod' &&
                  cancelOrder.pay === 'paid' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800">
                        💳 This order was paid online. A refund will be initiated to the customer's
                        original payment method.
                      </p>
                    </div>
                  )}

                {cancelOrder.stockReduced && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      📦 Product stock will be restored to inventory.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cancellation Reason *
                  </label>
                  <textarea
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Please provide a reason for cancelling this order..."
                    rows={3}
                    disabled={cancelling}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 resize-none disabled:opacity-50"
                  />
                </div>

                <p className="text-sm text-gray-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  ⚠️ This action cannot be undone. The customer will be notified by email.
                </p>
              </div>

              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling || !cancellationReason.trim()}
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel Order'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Success Modal with Blur */}
      {showSuccessModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowSuccessModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
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
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Success</h3>
              <p className="text-gray-600 text-center mb-4">{modalMessage}</p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full px-4 py-2 bg-linear-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </>
      )}

      {/* Error Modal with Blur */}
      {showErrorModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowErrorModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
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
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Error</h3>
              <p className="text-gray-600 text-center mb-4">{modalMessage}</p>
              <button
                onClick={() => setShowErrorModal(false)}
                className="w-full px-4 py-2 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}