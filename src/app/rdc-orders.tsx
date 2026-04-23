'use client'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  doc,
  updateDoc,
  addDoc,
  onSnapshot,
  arrayUnion,
  getDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import RDCNavbar from '../components/RDCNavbar'
import { db, auth } from '../lib/firebase'

interface OrderItem {
  productId: string
  productName?: string
  name?: string
  quantity: number
  price: number
  imageURL?: string
  sku?: string
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

interface OrderStatusUpdate {
  status: string
  timestamp: any
  updatedBy: string
  updatedByRole: string
  updatedByRDC: string
  note?: string
}

interface Order {
  id: string
  orderNumber?: string
  customerId: string
  userId: string
  totalAmount: number
  status: string
  items: OrderItem[]
  createdAt: any
  shippingInfo: ShippingInfo
  total: number
  subtotal: number
  shipping: number
  userEmail: string
  paymentMethod: string
  pay: string
  rdcLocation?: string
  location?: string
  rdc?: string
  statusUpdates?: OrderStatusUpdate[]
}

interface OrderFilters {
  status: string
  search: string
  dateRange: string
  paymentMethod: string
}

interface StatusStats {
  pending: number
  confirmed: number
  processing: number
  delivered: number
  rejected: number
}

export default function RDCOrders() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isRDCStaff, setIsRDCStaff] = useState(false)
  const [rdcLocation, setRdcLocation] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    search: '',
    dateRange: 'all',
    paymentMethod: 'all',
  })
  const [statusStats, setStatusStats] = useState<StatusStats>({
    pending: 0,
    confirmed: 0,
    processing: 0,
    delivered: 0,
    rejected: 0,
  })

  const logAuditAction = async (action: string, details: string, orderId?: string) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        details,
        performedBy: currentUser?.email || 'system',
        timestamp: new Date(),
        orderId: orderId || null,
        userEmail: currentUser?.email || 'system',
        userRole: 'RDC Staff',
        rdcLocation,
      })
    } catch (error) {
      console.error('Error creating audit log:', error)
    }
  }

  const showSuccess = (message: string) => {
    setModalMessage(message)
    setShowSuccessModal(true)
  }

  const showError = (message: string) => {
    setModalMessage(message)
    setShowErrorModal(true)
  }

  // Auth and role check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '/login'
        return
      }

      setCurrentUser(user)

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const userRole = userData.role?.toLowerCase()
          const isRDC = userRole === 'rdc staff' || userRole === 'rdc manager'

          setIsRDCStaff(isRDC)

          if (!isRDC) {
            showError('Access Denied. Only RDC Staff can access this page.')
            setTimeout(() => (window.location.href = '/'), 2000)
            return
          }

          // Validate email exists
          if (!user.email) {
            showError('User email not found. Please contact administrator.')
            setTimeout(() => (window.location.href = '/'), 2000)
            return
          }

          const userRdcLocation =
            userData.rdc || userData.rdcLocation || userData.assignedRDC || 'North RDC'
          if (!userRdcLocation) {
            showError('RDC location not assigned. Please contact administrator.')
            setTimeout(() => (window.location.href = '/'), 2000)
            return
          }

          setRdcLocation(userRdcLocation)
        } else {
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking user:', error)
        window.location.href = '/'
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Orders listener
  useEffect(() => {
    if (!isRDCStaff || !rdcLocation) return

    const unsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const allOrders = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
              rdcLocation:
                doc.data().rdcLocation || doc.data().location || doc.data().rdc || rdcLocation,
            }) as Order
        )

        const filteredByRDC = allOrders
          .filter((o) => {
            const orderRDC = o.rdcLocation || o.location || o.rdc
            return orderRDC === rdcLocation
          })
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

        setOrders(filteredByRDC)
        calculateStatusStats(filteredByRDC)
        setLoading(false)
      },
      (error) => {
        console.error('Error listening to orders:', error)
        showError('Failed to load orders. Please refresh the page.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [isRDCStaff, rdcLocation])

  const calculateStatusStats = (ordersData: Order[]) => {
    const stats: StatusStats = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      delivered: 0,
      rejected: 0,
    }

    ordersData.forEach((order) => {
      const status = order.status?.toLowerCase() || 'pending'
      if (stats[status as keyof StatusStats] !== undefined) {
        stats[status as keyof StatusStats]++
      }
    })

    setStatusStats(stats)
  }

  // Apply filters
  useEffect(() => {
    let result = [...orders]

    if (filters.status !== 'all') {
      result = result.filter((o) => o.status?.toLowerCase() === filters.status.toLowerCase())
    }

    if (filters.search) {
      const term = filters.search.toLowerCase()
      result = result.filter(
        (o) =>
          getCustomerName(o).toLowerCase().includes(term) ||
          getOrderNumber(o).toLowerCase().includes(term) ||
          o.userEmail?.toLowerCase().includes(term) ||
          o.shippingInfo?.phone?.toLowerCase().includes(term)
      )
    }

    if (filters.dateRange !== 'all') {
      const now = new Date()
      const startDate = new Date()

      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1)
          break
      }

      result = result.filter((o) => {
        const orderDate = o.createdAt?.seconds
          ? new Date(o.createdAt.seconds * 1000)
          : new Date(o.createdAt)
        return orderDate >= startDate
      })
    }

    if (filters.paymentMethod !== 'all') {
      result = result.filter(
        (o) => o.paymentMethod?.toLowerCase() === filters.paymentMethod.toLowerCase()
      )
    }

    setFilteredOrders(result)
  }, [orders, filters])

  const decreaseProductStocks = async (order: Order) => {
    try {
      console.log('Decreasing product stocks for confirmed order:', order.id)

      const stockUpdates = []

      for (const item of order.items) {
        if (!item.productId) continue

        try {
          const productRef = doc(db, 'products', item.productId)
          const productDoc = await getDoc(productRef)

          if (productDoc.exists()) {
            const productData = productDoc.data()
            const currentStock = productData.stock || 0
            const orderedQuantity = item.quantity || 0

            // Calculate new stock (ensure no negative)
            const newStock = Math.max(0, currentStock - orderedQuantity)

            // Update product stock
            await updateDoc(productRef, {
              stock: newStock,
              updatedAt: new Date(),
            })

            stockUpdates.push({
              productId: item.productId,
              productName: item.name || productData.name,
              oldStock: currentStock,
              newStock: newStock,
              quantity: orderedQuantity,
            })

            console.log(`Decreased stock for ${item.productId}: ${currentStock} -> ${newStock}`)
          }
        } catch (productError) {
          console.error(`Error decreasing stock for product ${item.productId}:`, productError)
        }
      }

      // Log stock updates in audit
      if (stockUpdates.length > 0) {
        await logAuditAction(
          'Decrease Product Stocks',
          `Decreased stocks for confirmed order ${getOrderNumber(order)}. Changes: ${JSON.stringify(stockUpdates)}`,
          order.id
        )
      }
    } catch (error) {
      console.error('Error decreasing product stocks:', error)
      throw error
    }
  }

  const enrichOrderItemsWithProductData = async (order: Order): Promise<OrderItem[]> => {
    const enrichedItems = await Promise.all(
      order.items.map(async (item) => {
        try {
          // If we already have all the data, return as is
          if (item.productName && item.sku) {
            return item
          }

          // Fetch product details from Firestore
          const productDoc = await getDoc(doc(db, 'products', item.productId))

          if (productDoc.exists()) {
            const productData = productDoc.data()
            return {
              ...item,
              productName: productData.name || item.productName || item.name || 'Product',
              name: productData.name || item.name,
              sku: productData.sku || item.sku || item.productId,
              imageURL: item.imageURL || productData.imageURL,
              stock: productData.stock || 0,
            }
          }

          // If product not found, return with fallbacks
          return {
            ...item,
            productName: item.productName || item.name || 'Product',
            sku: item.sku || item.productId,
          }
        } catch (error) {
          console.error(`Error fetching product ${item.productId}:`, error)
          return {
            ...item,
            productName: item.productName || item.name || 'Product',
            sku: item.sku || item.productId,
          }
        }
      })
    )

    return enrichedItems
  }

  const sendOrderStatusUpdateEmail = async (order: Order, newStatus: string, note?: string) => {
    try {
      const enrichedItems = await enrichOrderItemsWithProductData(order)
      const enrichedOrder = { ...order, items: enrichedItems }

      let statusMessage = ''
      let statusColor = '#3b82f6'
      let statusIcon = '📦'
      let additionalInfo = ''

      switch (newStatus.toLowerCase()) {
        case 'pending':
          statusMessage = 'Your order has been moved back to pending status.'
          statusColor = '#eab308'
          statusIcon = '⏳'
          additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Processing at: <strong>${rdcLocation}</strong></p>`
          break

        case 'confirmed':
          statusMessage = 'Your order has been confirmed and is being prepared.'
          statusColor = '#14b8a6'
          statusIcon = '✅'
          additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Your order is being processed at <strong>${rdcLocation}</strong>.</p>`
          break

        case 'processing':
          statusMessage = 'Your order is now being processed at our warehouse.'
          statusColor = '#6366f1'
          statusIcon = '⚙️'
          additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Processing at: <strong>${rdcLocation}</strong></p>`
          break

        default:
          statusMessage = `Your order status has been updated to: ${newStatus.replace('_', ' ').toUpperCase()}`
          statusIcon = '📋'
          additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Updated by: <strong>${rdcLocation}</strong></p>`
      }

      const orderItemsHtml = enrichedOrder.items
        .map((item) => {
          const productName = item.productName || item.name || 'Product'
          const productSKU = item.sku || item.productId || 'N/A'
          const itemPrice = item.price || 0
          const itemQuantity = item.quantity || 1
          const itemTotal = itemPrice * itemQuantity

          return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 4px;">${productName}</div>
            <div style="color: #6b7280; font-size: 12px;">SKU: ${productSKU}</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; vertical-align: top;">
            ${itemQuantity}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #f97316; white-space: nowrap; vertical-align: top;">
            LKR ${itemTotal.toLocaleString()}
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
              <p style="font-size: 16px; color: #4b5563;">Dear <strong>${enrichedOrder.shippingInfo.fullName}</strong>,</p>
              
              <div class="order-id">
                <strong>Order ID: ${getOrderNumber(enrichedOrder)}</strong>
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
                    <td style="text-align: right; font-weight: 600;">LKR ${enrichedOrder.subtotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280;">Shipping Fee</td>
                    <td style="text-align: right; font-weight: 600; color: ${enrichedOrder.shipping === 0 ? '#10b981' : '#1f2937'};">
                      ${enrichedOrder.shipping === 0 ? 'FREE' : `LKR ${enrichedOrder.shipping.toLocaleString()}`}
                    </td>
                  </tr>
                  <tr class="total-row">
                    <td>Total Amount</td>
                    <td style="text-align: right;">LKR ${enrichedOrder.total.toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              
              <div class="section">
                <div class="section-title">🚚 Delivery Information</div>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                  <p style="margin: 5px 0; color: #4b5563;"><strong>Name:</strong> ${enrichedOrder.shippingInfo.fullName}</p>
                  <p style="margin: 5px 0; color: #4b5563;"><strong>Phone:</strong> ${enrichedOrder.shippingInfo.phone}</p>
                  <p style="margin: 5px 0; color: #4b5563;"><strong>Address:</strong> ${enrichedOrder.shippingInfo.address}</p>
                  <p style="margin: 5px 0; color: #4b5563;"><strong>City:</strong> ${enrichedOrder.shippingInfo.city}</p>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://your-domain.com/orders" class="button" style="color: white; text-decoration: none;">
                  Track Your Order
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

Dear ${enrichedOrder.shippingInfo.fullName},

${statusMessage}

ORDER DETAILS
Order ID: ${getOrderNumber(enrichedOrder)}
Status: ${newStatus.replace('_', ' ').toUpperCase()}
Updated by: ${rdcLocation}

ORDER ITEMS
${enrichedOrder.items
  .map((item) => {
    const productName = item.productName || item.name || 'Product'
    const productSKU = item.sku || item.productId || 'N/A'
    const itemPrice = item.price || 0
    const itemQuantity = item.quantity || 1
    const itemTotal = itemPrice * itemQuantity

    return `- ${productName}\n  SKU: ${productSKU}\n  Quantity: ${itemQuantity}\n  Total: LKR ${itemTotal.toLocaleString()}`
  })
  .join('\n\n')}

ORDER SUMMARY
Subtotal: LKR ${enrichedOrder.subtotal.toLocaleString()}
Shipping: ${enrichedOrder.shipping === 0 ? 'FREE' : `LKR ${enrichedOrder.shipping.toLocaleString()}`}
Total: LKR ${enrichedOrder.total.toLocaleString()}

DELIVERY ADDRESS
${enrichedOrder.shippingInfo.fullName}
${enrichedOrder.shippingInfo.phone}
${enrichedOrder.shippingInfo.address}
${enrichedOrder.shippingInfo.city}

Track your order: https://your-domain.com/orders

Need help? Contact us at support@islandlink.com or call +94 77 123 4567

© ${new Date().getFullYear()} IslandLink Smart Distribution. All rights reserved.
      `

      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: enrichedOrder.shippingInfo.email,
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
    }
  }

  const handleStatusConfirm = async (newStatus: string, note?: string) => {
    if (!selectedOrder || !currentUser) {
      showError('User not authenticated. Please refresh the page.')
      return
    }

    try {
      setUpdatingStatus(true)
      const orderRef = doc(db, 'orders', selectedOrder.id)

      // Validate all required fields
      if (!rdcLocation || !currentUser.email) {
        showError('Missing required information. Please refresh the page.')
        setUpdatingStatus(false)
        return
      }

      // Clean note - convert empty string to undefined
      const cleanedNote = note?.trim() || undefined

      // Create status update entry
      const statusUpdate: any = {
        status: newStatus,
        timestamp: new Date(),
        updatedBy: currentUser.email,
        updatedByRole: 'RDC Staff',
        updatedByRDC: rdcLocation,
      }

      // Add note only if it exists
      if (cleanedNote) {
        statusUpdate.note = cleanedNote
      }

      console.log('Status update data:', statusUpdate)

      // Prepare update data
      const updateData: any = {
        status: newStatus,
        statusUpdates: arrayUnion(statusUpdate),
      }

      // Update order status
      await updateDoc(orderRef, updateData)

      // Decrease product stocks only when order is confirmed
      if (newStatus.toLowerCase() === 'confirmed') {
        await decreaseProductStocks(selectedOrder)
      }

      // Log audit action
      await logAuditAction(
        'Update Order Status (RDC)',
        `Order ${getOrderNumber(selectedOrder)} status changed from ${selectedOrder.status} to ${newStatus} by RDC Staff at ${rdcLocation}. Note: ${cleanedNote || 'No note provided'}`,
        selectedOrder.id
      )

      // Send email notification to customer
      try {
        await sendOrderStatusUpdateEmail(selectedOrder, newStatus, cleanedNote)
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError)
      }

      setShowStatusModal(false)
      setSelectedOrder(null)
      showSuccess(
        `Order status updated to ${newStatus.toUpperCase()} successfully! ${newStatus.toLowerCase() === 'confirmed' ? 'Product stocks decreased.' : ''}`
      )
    } catch (error: any) {
      console.error('Error updating order status:', error)
      showError(error.message || 'Failed to update order status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const getStatusOptions = (
    currentStatus: string
  ): { value: string; label: string; noteRequired?: boolean }[] => {
    const statusFlow: Record<string, { value: string; label: string; noteRequired?: boolean }[]> = {
      pending: [{ value: 'confirmed', label: 'Confirm Order' }],
      confirmed: [{ value: 'processing', label: 'Start Processing' }],
      processing: [
        // RDC cannot mark as delivered or rejected - that's for logistic team
      ],
    }
    return statusFlow[currentStatus.toLowerCase()] || []
  }

  const canRDCStaffUpdate = (order: Order) => {
    const status = order.status?.toLowerCase() || ''
    const options = getStatusOptions(status)
    return options.length > 0 && ['pending', 'confirmed'].includes(status)
  }

  const formatCurrency = (amount: number) =>
    `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    try {
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'N/A'
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

  const getCustomerName = (order: Order) =>
    order.shippingInfo?.fullName || order.userEmail?.split('@')[0] || 'Customer'

  const getOrderNumber = (order: Order) =>
    order.orderNumber ? `#${order.orderNumber}` : `ORD-${order.id.slice(-8).toUpperCase()}`

  const getOrderTotal = (order: Order) =>
    order.total || order.totalAmount || order.subtotal + order.shipping || 0

  const getTotalItems = (order: Order) => order.items.reduce((sum, item) => sum + item.quantity, 0)

  const getPaymentStatus = (order: Order) => {
    if (order.pay === 'paid') return 'PAID'
    if (order.pay === 'refunded') return 'REFUNDED'
    if (order.pay === 'pending') return 'UNPAID'

    const status = order.status?.toLowerCase()
    const method = order.paymentMethod?.toLowerCase()

    if (method === 'cod') return status === 'delivered' ? 'PAID' : 'UNPAID'
    if (status === 'rejected') return 'REFUNDED'
    if (['confirmed', 'processing', 'delivered'].includes(status || '')) return 'PAID'
    return 'UNPAID'
  }

  const getLatestStatusUpdate = (order: Order): OrderStatusUpdate | null => {
    if (!order.statusUpdates || order.statusUpdates.length === 0) {
      return null
    }
    return order.statusUpdates[order.statusUpdates.length - 1]
  }

  // Loading/Access states
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isRDCStaff) {
    return (
      <div className="min-h-screen bg-linear-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">Only RDC Staff can access this page.</p>
          <p className="text-sm text-gray-500">Redirecting to homepage...</p>
        </div>
      </div>
    )
  }

  if (!rdcLocation) {
    return (
      <div className="min-h-screen bg-linear-to-br from-yellow-50 to-yellow-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">RDC Location Not Assigned</h2>
          <p className="text-gray-600">Please contact administrator to assign you to an RDC.</p>
        </div>
      </div>
    )
  }

  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => ['pending', 'confirmed'].includes(o.status?.toLowerCase()))
      .length,
    todayOrders: orders.filter((o) => {
      const orderDate = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return orderDate >= today
    }).length,
    processingOrders: statusStats.processing,
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-blue-50 to-indigo-50">
      <RDCNavbar />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RDC Order Management</h1>
          <p className="text-blue-600 font-semibold">{rdcLocation}</p>
          <p className="text-gray-600 text-sm">
            Manage orders for {rdcLocation} Regional Distribution Center
          </p>
          <p className="text-sm text-orange-600 mt-2 font-medium">
            ⚠️ Note: RDC can only update orders up to "Processing" status. Delivery/Rejection
            handled by Logistics team.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            {
              label: 'Total Orders',
              value: stats.totalOrders,
              desc: `All orders for ${rdcLocation}`,
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              ),
            },
            {
              label: 'To Process',
              value: stats.pendingOrders,
              desc: 'Pending + Confirmed',
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ),
            },
            {
              label: "Today's Orders",
              value: stats.todayOrders,
              desc: 'Orders placed today',
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              ),
            },
            {
              label: 'In Processing',
              value: stats.processingOrders,
              desc: 'Currently processing',
              icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              ),
            },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
              <div className="text-blue-600 mb-2">{stat.icon}</div>
              <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-blue-600">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.desc}</p>
            </div>
          ))}
        </div>

        {/* Status Overview */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Order Status Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(statusStats).map(([status, count]) => (
              <div key={status} className={`${getStatusColor(status)} rounded-lg p-4 text-center`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs font-medium capitalize mt-1">{status}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-4">
            RDC staff can only update: Pending → Confirmed → Processing
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Search & Filter Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Search orders..."
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
            />

            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              aria-label="Filter by status"
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="delivered">Delivered (View Only)</option>
              <option value="rejected">Rejected (View Only)</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
              aria-label="Filter by date range"
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>

            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              aria-label="Filter by payment method"
              className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="all">All Methods</option>
              <option value="cod">Cash on Delivery</option>
              <option value="card">Card</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>

          <button
            onClick={() =>
              setFilters({ status: 'all', search: '', dateRange: 'all', paymentMethod: 'all' })
            }
            className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
          >
            Clear Filters
          </button>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-xl font-bold text-gray-900">Orders ({filteredOrders.length})</h3>
            <p className="text-sm text-gray-600 mt-1">
              RDC Staff can only update: Pending → Confirmed → Processing
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Updated By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => {
                  const canUpdate = canRDCStaffUpdate(order)
                  const isProcessing = order.status?.toLowerCase() === 'processing'
                  const isDelivered = order.status?.toLowerCase() === 'delivered'
                  const isRejected = order.status?.toLowerCase() === 'rejected'
                  const latestUpdate = getLatestStatusUpdate(order)

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {getOrderNumber(order)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTimestamp(order.createdAt)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {getTotalItems(order)} items • {formatCurrency(getOrderTotal(order))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {getCustomerName(order)}
                        </div>
                        <div className="text-xs text-gray-500">{order.userEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {order.paymentMethod?.toUpperCase()}
                        </div>
                        <div className="text-xs font-medium text-gray-700">
                          {getPaymentStatus(order)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}
                        >
                          {order.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {latestUpdate ? (
                          <div className="text-xs text-gray-600">
                            <div>{latestUpdate.updatedByRDC}</div>
                            <div className="text-gray-500">
                              {formatTimestamp(latestUpdate.timestamp)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">System</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 text-sm">
                          <button
                            onClick={() => {
                              setSelectedOrder(order)
                              setShowOrderModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                          {canUpdate && (
                            <button
                              onClick={() => {
                                setSelectedOrder(order)
                                setShowStatusModal(true)
                              }}
                              className="text-green-600 hover:text-green-900"
                            >
                              Update
                            </button>
                          )}
                          {isProcessing && (
                            <span
                              className="text-gray-400"
                              title="Processing orders - no further RDC actions"
                            >
                              Processing
                            </span>
                          )}
                          {(isDelivered || isRejected) && (
                            <span className="text-gray-400" title="Handled by Logistics team">
                              Logistics Team
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                <p className="text-sm text-gray-900">{getOrderNumber(selectedOrder)}</p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                aria-label="Close order details"
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}
                  >
                    {selectedOrder.status?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatTimestamp(selectedOrder.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Payment</p>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedOrder.paymentMethod?.toUpperCase()}
                    </p>
                    <p className="text-xs font-medium text-gray-700">
                      {getPaymentStatus(selectedOrder)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Items</p>
                  <p className="text-sm font-medium text-gray-900">
                    {getTotalItems(selectedOrder)} items
                  </p>
                </div>
              </div>

              {/* Status History */}
              {selectedOrder.statusUpdates && selectedOrder.statusUpdates.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Status History</h3>
                  <div className="space-y-3">
                    {selectedOrder.statusUpdates
                      .slice()
                      .reverse()
                      .map((update, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                          <div
                            className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(update.status)}`}
                          >
                            {update.status.toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">
                              Updated by <span className="font-medium">{update.updatedBy}</span> (
                              {update.updatedByRole})
                            </p>
                            <p className="text-xs text-gray-600">
                              {update.updatedByRDC} • {formatTimestamp(update.timestamp)}
                            </p>
                            {update.note && (
                              <p className="text-xs text-gray-700 mt-1 bg-gray-100 p-2 rounded">
                                Note: {update.note}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => {
                    const productName = item.productName || item.name || 'Product'
                    const productSKU = item.sku || item.productId || 'N/A'

                    return (
                      <div key={idx} className="flex gap-4 items-center bg-gray-50 p-3 rounded-lg">
                        <img
                          src={item.imageURL || 'https://via.placeholder.com/80'}
                          alt={productName}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{productName}</p>
                          <p className="text-sm text-gray-600">SKU: {productSKU}</p>
                          <p className="text-sm text-gray-600">
                            Qty: {item.quantity} × {formatCurrency(item.price)}
                          </p>
                        </div>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(selectedOrder.subtotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(selectedOrder.shipping || 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-blue-600 text-lg">
                    {formatCurrency(getOrderTotal(selectedOrder))}
                  </span>
                </div>
              </div>

              {/* Customer & Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-900">
                      <span className="text-gray-600">Name:</span> {getCustomerName(selectedOrder)}
                    </p>
                    <p className="text-gray-900">
                      <span className="text-gray-600">Email:</span> {selectedOrder.userEmail}
                    </p>
                    <p className="text-gray-900">
                      <span className="text-gray-600">Phone:</span>{' '}
                      {selectedOrder.shippingInfo?.phone || 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Shipping Information</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-900">
                      <span className="text-gray-600">Address:</span>{' '}
                      {selectedOrder.shippingInfo?.address}
                    </p>
                    <p className="text-gray-900">
                      <span className="text-gray-600">City:</span>{' '}
                      {selectedOrder.shippingInfo?.city}
                    </p>
                    <p className="text-gray-900">
                      <span className="text-gray-600">Postal:</span>{' '}
                      {selectedOrder.shippingInfo?.postalCode}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {canRDCStaffUpdate(selectedOrder) && (
                <button
                  onClick={() => {
                    setShowOrderModal(false)
                    setShowStatusModal(true)
                  }}
                  className="w-full px-4 py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition font-semibold"
                >
                  Update Order Status
                </button>
              )}
              {(selectedOrder.status?.toLowerCase() === 'processing' ||
                selectedOrder.status?.toLowerCase() === 'delivered' ||
                selectedOrder.status?.toLowerCase() === 'rejected') && (
                <div
                  className={`${
                    selectedOrder.status?.toLowerCase() === 'processing'
                      ? 'bg-blue-50 border-blue-200'
                      : selectedOrder.status?.toLowerCase() === 'delivered'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                  } border rounded-xl p-4 text-center`}
                >
                  <p
                    className={`${
                      selectedOrder.status?.toLowerCase() === 'processing'
                        ? 'text-blue-700'
                        : selectedOrder.status?.toLowerCase() === 'delivered'
                          ? 'text-green-700'
                          : 'text-red-700'
                    } font-medium`}
                  >
                    {selectedOrder.status?.toLowerCase() === 'processing'
                      ? '📦 Order is processing at RDC'
                      : selectedOrder.status?.toLowerCase() === 'delivered'
                        ? '✅ Order delivered by Logistics team'
                        : '⚠️ Order rejected by Logistics team'}
                  </p>
                  <p
                    className={`${
                      selectedOrder.status?.toLowerCase() === 'processing'
                        ? 'text-blue-600'
                        : selectedOrder.status?.toLowerCase() === 'delivered'
                          ? 'text-green-600'
                          : 'text-red-600'
                    } text-sm mt-1`}
                  >
                    {selectedOrder.status?.toLowerCase() === 'processing'
                      ? 'Ready for Logistics team pickup'
                      : selectedOrder.status?.toLowerCase() === 'delivered'
                        ? 'Delivery completed by Logistics team'
                        : 'Rejection handled by Logistics team'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Update Order Status</h2>
              <button
                onClick={() => setShowStatusModal(false)}
                disabled={updatingStatus}
                aria-label="Close status update"
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Order Number</p>
                <p className="font-semibold text-gray-900">{getOrderNumber(selectedOrder)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Current Status</p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}
                >
                  {selectedOrder.status?.toUpperCase()}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Select New Status</p>
                <div className="space-y-3">
                  {getStatusOptions(selectedOrder.status || 'pending').map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusConfirm(option.value)}
                      disabled={updatingStatus}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 hover:bg-gray-50 transition font-medium disabled:opacity-50 flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-500">→ {option.value.toUpperCase()}</span>
                    </button>
                  ))}
                  {getStatusOptions(selectedOrder.status || 'pending').length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-gray-700">No further actions available for this status.</p>
                      <p className="text-sm text-gray-500 mt-1">
                        RDC staff can only update orders up to "Processing" status.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Delivery and rejection handled by Logistics team.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
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
              <h2 className="text-xl font-bold text-gray-900 mb-2">Success</h2>
              <p className="text-gray-900 mb-4">{modalMessage}</p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-6 py-2.5 bg-linear-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-900 mb-4">{modalMessage}</p>
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-6 py-2.5 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
