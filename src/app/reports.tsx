'use client'

import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import AdminNavbar from '../components/Adminnavbar'
import { auth, db } from '../lib/firebase'

interface ReportData {
  // Sales & Revenue
  totalRevenue: number
  todayRevenue: number
  monthRevenue: number
  averageOrderValue: number

  // Orders
  totalOrders: number
  pendingOrders: number
  confirmedOrders: number
  processingOrders: number
  outForDeliveryOrders: number
  deliveredOrders: number
  cancelledOrders: number

  // Users
  totalUsers: number
  totalCustomers: number
  totalRDCStaff: number
  totalLogisticsTeam: number
  totalHOManagers: number
  newUsersThisMonth: number

  // Products
  totalProducts: number
  lowStockProducts: number
  outOfStockProducts: number
  topSellingProducts: Array<{
    name: string
    sales: number
    revenue: number
    imageURL: string
    sku: string
    category: string
  }>

  // Performance by RDC
  rdcPerformance: Array<{ rdc: string; orders: number; revenue: number }>
}

interface Order {
  id: string
  total: number
  status: string
  createdAt: any
  items: Array<{ productId: string; productName: string; quantity: number; price: number }>
}

export default function AdminReports() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('month')
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      // Check if user is admin
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        setAuthorized(true)
        loadReportData()
      } else {
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  async function loadReportData() {
    try {
      setLoading(true)

      // Fetch all orders
      const ordersSnapshot = await getDocs(collection(db, 'orders'))
      const orders: Order[] = []
      ordersSnapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() } as Order)
      })

      // Fetch all users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users: any[] = []
      usersSnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() })
      })

      // Fetch all products
      const productsSnapshot = await getDocs(collection(db, 'products'))
      const products: any[] = []
      productsSnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() })
      })

      // Calculate metrics
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Revenue calculations
      const totalRevenue = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const todayRevenue = orders
        .filter((o) => {
          const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt)
          return o.status === 'delivered' && orderDate >= today
        })
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const monthRevenue = orders
        .filter((o) => {
          const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt)
          return o.status === 'delivered' && orderDate >= firstDayOfMonth
        })
        .reduce((sum, o) => sum + (o.total || 0), 0)

      const deliveredOrders = orders.filter((o) => o.status === 'delivered')
      const averageOrderValue =
        deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0

      // Order status counts
      const totalOrders = orders.length
      const pendingOrders = orders.filter(
        (o) => o.status === 'pending' || o.status === 'paid'
      ).length
      const confirmedOrders = orders.filter((o) => o.status === 'confirmed').length
      const processingOrders = orders.filter((o) => o.status === 'processing').length
      const outForDeliveryOrders = orders.filter(
        (o) => o.status === 'out_for_delivery' || o.status === 'out for delivery'
      ).length
      const deliveredOrdersCount = deliveredOrders.length
      const cancelledOrders = orders.filter(
        (o) => o.status === 'cancelled' || o.status === 'rejected'
      ).length

      // User counts
      const totalUsers = users.length
      const totalCustomers = users.filter((u) => u.role === 'customer' || !u.role).length
      const totalRDCStaff = users.filter((u) => u.role === 'RDC Staff').length
      const totalLogisticsTeam = users.filter((u) => u.role === 'Logistics Team').length
      const totalHOManagers = users.filter((u) => u.role === 'HO Manager').length

      const newUsersThisMonth = users.filter((u) => {
        const createdAt = u.createdAt?.toDate ? u.createdAt.toDate() : new Date(u.createdAt)
        return createdAt >= firstDayOfMonth
      }).length

      // Product metrics
      const totalProducts = products.length
      const lowStockProducts = products.filter(
        (p) => (p.stock || 0) < 10 && (p.stock || 0) > 0
      ).length
      const outOfStockProducts = products.filter((p) => (p.stock || 0) === 0).length

      // Top selling products
      const productSales: {
        [key: string]: {
          name: string
          sales: number
          revenue: number
          imageURL: string
          sku: string
          category: string
        }
      } = {}

      orders
        .filter((o) => o.status === 'delivered')
        .forEach((order) => {
          order.items?.forEach((item) => {
            if (!productSales[item.productId]) {
              // Find the product to get image, SKU, and category
              const product = products.find((p) => p.id === item.productId)
              productSales[item.productId] = {
                name: item.productName,
                sales: 0,
                revenue: 0,
                imageURL: product?.imageURL || '',
                sku: product?.sku || 'N/A',
                category: product?.category || 'Uncategorized',
              }
            }
            productSales[item.productId].sales += item.quantity
            productSales[item.productId].revenue += item.quantity * item.price
          })
        })

      const topSellingProducts = Object.values(productSales)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5)

      // RDC Performance
      const rdcPerformanceMap: { [key: string]: { orders: number; revenue: number } } = {}

      orders
        .filter((o) => o.status === 'delivered')
        .forEach((order) => {
          // Get RDC from first product
          if (order.items && order.items.length > 0) {
            const firstProductId = order.items[0].productId
            const product = products.find((p) => p.id === firstProductId)
            const rdc = product?.rdcLocation || product?.rdc || 'Unknown'

            if (!rdcPerformanceMap[rdc]) {
              rdcPerformanceMap[rdc] = { orders: 0, revenue: 0 }
            }
            rdcPerformanceMap[rdc].orders++
            rdcPerformanceMap[rdc].revenue += order.total || 0
          }
        })

      const rdcPerformance = Object.entries(rdcPerformanceMap)
        .map(([rdc, data]) => ({ rdc, ...data }))
        .sort((a, b) => b.revenue - a.revenue)

      setReportData({
        totalRevenue,
        todayRevenue,
        monthRevenue,
        averageOrderValue,
        totalOrders,
        pendingOrders,
        confirmedOrders,
        processingOrders,
        outForDeliveryOrders,
        deliveredOrders: deliveredOrdersCount,
        cancelledOrders,
        totalUsers,
        totalCustomers,
        totalRDCStaff,
        totalLogisticsTeam,
        totalHOManagers,
        newUsersThisMonth,
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        topSellingProducts,
        rdcPerformance,
      })
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function generateDetailedReport() {
    if (!reportData) return

    setGeneratingReport(true)

    try {
      // Dynamically load jsPDF from CDN
      const script1 = document.createElement('script')
      script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      document.head.appendChild(script1)

      await new Promise((resolve) => {
        script1.onload = resolve
      })

      const script2 = document.createElement('script')
      script2.src =
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
      document.head.appendChild(script2)

      await new Promise((resolve) => {
        script2.onload = resolve
      })

      // @ts-ignore
      const { jsPDF } = window.jspdf
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPosition = 20

      // Title
      doc.setFontSize(20)
      doc.setFont(undefined, 'bold')
      doc.text('IslandLink - Business Analytics Report', pageWidth / 2, yPosition, {
        align: 'center',
      })

      yPosition += 10
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(
        'Generated on: ' +
          new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        pageWidth / 2,
        yPosition,
        { align: 'center' }
      )

      yPosition += 15

      // Revenue Overview Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Revenue Overview', 14, yPosition)
      yPosition += 5

      ;(doc as any).autoTable({
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: [
          ['Total Revenue', 'LKR ' + reportData.totalRevenue.toLocaleString()],
          ["Today's Revenue", 'LKR ' + reportData.todayRevenue.toLocaleString()],
          ['This Month Revenue', 'LKR ' + reportData.monthRevenue.toLocaleString()],
          [
            'Average Order Value',
            'LKR ' + Math.round(reportData.averageOrderValue).toLocaleString(),
          ],
        ],
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0] },
        margin: { left: 14, right: 14 },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 15

      // Order Analytics Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Order Analytics', 14, yPosition)
      yPosition += 5

      ;(doc as any).autoTable({
        startY: yPosition,
        head: [['Status', 'Count']],
        body: [
          ['Total Orders', reportData.totalOrders.toString()],
          ['Pending', reportData.pendingOrders.toString()],
          ['Confirmed', reportData.confirmedOrders.toString()],
          ['Processing', reportData.processingOrders.toString()],
          ['Out for Delivery', reportData.outForDeliveryOrders.toString()],
          ['Delivered', reportData.deliveredOrders.toString()],
          ['Cancelled', reportData.cancelledOrders.toString()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0] },
        margin: { left: 14, right: 14 },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 5

      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.text(
        'Order Completion Rate: ' +
          ((reportData.deliveredOrders / reportData.totalOrders) * 100).toFixed(1) +
          '%',
        14,
        yPosition
      )

      yPosition += 15

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }

      // User Analytics Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('User Analytics', 14, yPosition)
      yPosition += 5

      ;(doc as any).autoTable({
        startY: yPosition,
        head: [['User Type', 'Count']],
        body: [
          ['Total Users', reportData.totalUsers.toString()],
          ['Customers', reportData.totalCustomers.toString()],
          ['RDC Staff', reportData.totalRDCStaff.toString()],
          ['Logistics Team', reportData.totalLogisticsTeam.toString()],
          ['HO Managers', reportData.totalHOManagers.toString()],
          ['New Users This Month', reportData.newUsersThisMonth.toString()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0] },
        margin: { left: 14, right: 14 },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 15

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }

      // Product Analytics Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Product Analytics', 14, yPosition)
      yPosition += 5

      ;(doc as any).autoTable({
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: [
          ['Total Products', reportData.totalProducts.toString()],
          ['Low Stock (<10 units)', reportData.lowStockProducts.toString()],
          ['Out of Stock', reportData.outOfStockProducts.toString()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0] },
        margin: { left: 14, right: 14 },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 15

      // Check if we need a new page
      if (yPosition > 220) {
        doc.addPage()
        yPosition = 20
      }

      // Top Selling Products Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('Top 5 Best Selling Products', 14, yPosition)
      yPosition += 5

      ;(doc as any).autoTable({
        startY: yPosition,
        head: [['Rank', 'Product', 'SKU', 'Category', 'Units', 'Revenue']],
        body: reportData.topSellingProducts.map((product: any, index: number) => [
          (index + 1).toString(),
          product.name,
          product.sku,
          product.category,
          product.sales.toString(),
          'LKR ' + product.revenue.toLocaleString(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 20 },
          5: { cellWidth: 35 },
        },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 15

      // Check if we need a new page
      if (yPosition > 220) {
        doc.addPage()
        yPosition = 20
      }

      // RDC Performance Section
      doc.setFontSize(14)
      doc.setFont(undefined, 'bold')
      doc.text('RDC Performance Analysis', 14, yPosition)
      yPosition += 5

      ;(doc as any).autoTable({
        startY: yPosition,
        head: [['RDC Location', 'Orders', 'Revenue', 'Avg Order']],
        body: reportData.rdcPerformance.map((rdc: any) => [
          rdc.rdc,
          rdc.orders.toString(),
          'LKR ' + rdc.revenue.toLocaleString(),
          'LKR ' + Math.round(rdc.revenue / rdc.orders).toLocaleString(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0] },
        margin: { left: 14, right: 14 },
      })

      // Footer on all pages
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont(undefined, 'italic')
        doc.text(
          'Report generated by IslandLink Admin Dashboard',
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
        doc.text(
          'Page ' + i + ' of ' + pageCount,
          pageWidth - 20,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'right' }
        )
      }

      // Save the PDF
      doc.save('IslandLink_Analytics_Report.pdf')

      setGeneratingReport(false)
    } catch (error: any) {
      console.error('Error generating report:', error)
      setGeneratingReport(false)
      alert('❌ Failed to generate report: ' + (error.message || 'Unknown error'))
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Verifying access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <AdminNavbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
              <p className="text-gray-500 mt-1">
                Comprehensive business insights and performance metrics
              </p>
            </div>
            <button
              onClick={generateDetailedReport}
              disabled={generatingReport}
              className="px-6 py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {generatingReport ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export Report
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading report data...</p>
            </div>
          </div>
        ) : reportData ? (
          <div className="space-y-6">
            {/* Revenue Overview */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                Revenue Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-linear-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <p className="text-sm text-green-700 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    LKR {reportData.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium">Today's Revenue</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    LKR {reportData.todayRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                  <p className="text-sm text-purple-700 font-medium">This Month</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    LKR {reportData.monthRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                  <p className="text-sm text-orange-700 font-medium">Avg Order Value</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    LKR{' '}
                    {reportData.averageOrderValue.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Statistics */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                Order Analytics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{reportData.totalOrders}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                  <p className="text-xs text-yellow-700 font-medium">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">
                    {reportData.pendingOrders}
                  </p>
                </div>
                <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
                  <p className="text-xs text-teal-700 font-medium">Confirmed</p>
                  <p className="text-2xl font-bold text-teal-900 mt-1">
                    {reportData.confirmedOrders}
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                  <p className="text-xs text-indigo-700 font-medium">Processing</p>
                  <p className="text-2xl font-bold text-indigo-900 mt-1">
                    {reportData.processingOrders}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <p className="text-xs text-orange-700 font-medium">Out for Delivery</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {reportData.outForDeliveryOrders}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-xs text-green-700 font-medium">Delivered</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {reportData.deliveredOrders}
                  </p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <p className="text-xs text-red-700 font-medium">Cancelled</p>
                  <p className="text-2xl font-bold text-red-900 mt-1">
                    {reportData.cancelledOrders}
                  </p>
                </div>
              </div>

              {/* Order Completion Rate */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Order Completion Rate</span>
                  <span className="text-sm font-bold text-green-600">
                    {reportData.totalOrders > 0
                      ? ((reportData.deliveredOrders / reportData.totalOrders) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`bg-linear-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500 w-[${
                      reportData.totalOrders > 0
                        ? (reportData.deliveredOrders / reportData.totalOrders) * 100
                        : 0
                    }%]`}
                  />
                </div>
              </div>
            </div>

            {/* Users & Products Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Statistics */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  User Analytics
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700 font-medium">Total Users</span>
                    <span className="text-lg font-bold text-gray-900">{reportData.totalUsers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700 font-medium">Customers</span>
                    <span className="text-lg font-bold text-blue-900">
                      {reportData.totalCustomers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700 font-medium">RDC Staff</span>
                    <span className="text-lg font-bold text-green-900">
                      {reportData.totalRDCStaff}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm text-purple-700 font-medium">Logistics Team</span>
                    <span className="text-lg font-bold text-purple-900">
                      {reportData.totalLogisticsTeam}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                    <span className="text-sm text-pink-700 font-medium">HO Managers</span>
                    <span className="text-lg font-bold text-pink-900">
                      {reportData.totalHOManagers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg border-2 border-cyan-300">
                    <span className="text-sm text-cyan-700 font-medium">New Users This Month</span>
                    <span className="text-lg font-bold text-cyan-900">
                      {reportData.newUsersThisMonth}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Statistics */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-indigo-600"
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
                  Product Analytics
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700 font-medium">Total Products</span>
                    <span className="text-lg font-bold text-gray-900">
                      {reportData.totalProducts}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border-2 border-yellow-300">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-yellow-600"
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
                      <span className="text-sm text-yellow-700 font-medium">
                        Low Stock (&lt;10)
                      </span>
                    </div>
                    <span className="text-lg font-bold text-yellow-900">
                      {reportData.lowStockProducts}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-2 border-red-300">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-red-600"
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
                      <span className="text-sm text-red-700 font-medium">Out of Stock</span>
                    </div>
                    <span className="text-lg font-bold text-red-900">
                      {reportData.outOfStockProducts}
                    </span>
                  </div>
                </div>

                {/* Stock Health */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Stock Health</span>
                    <span className="text-sm font-bold text-green-600">
                      {reportData.totalProducts > 0
                        ? (
                            ((reportData.totalProducts - reportData.outOfStockProducts) /
                              reportData.totalProducts) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`bg-linear-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500 w-[${
                        reportData.totalProducts > 0
                          ? ((reportData.totalProducts - reportData.outOfStockProducts) /
                              reportData.totalProducts) *
                            100
                          : 0
                      }%]`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Selling Products */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                Top 5 Best Selling Products
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Rank
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Product
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        SKU
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Category
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Units Sold
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topSellingProducts.map((product, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-100 hover:bg-gray-50 transition"
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                              index === 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : index === 1
                                  ? 'bg-gray-100 text-gray-800'
                                  : index === 2
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                product.imageURL || 'https://via.placeholder.com/60?text=No+Image'
                              }
                              alt={product.name}
                              className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/60?text=No+Image'
                              }}
                            />
                            <span className="font-medium text-gray-900 text-sm">
                              {product.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 font-mono">
                            {product.sku}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {product.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">
                          {product.sales}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          LKR {product.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {reportData.topSellingProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          No sales data available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RDC Performance */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-cyan-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                RDC Performance Analysis
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        RDC Location
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Total Orders
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Revenue Generated
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Avg Order Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rdcPerformance.map((rdc, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-100 hover:bg-gray-50 transition"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900">{rdc.rdc}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">
                          {rdc.orders}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          LKR {rdc.revenue.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-600">
                          LKR{' '}
                          {rdc.orders > 0
                            ? (rdc.revenue / rdc.orders).toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })
                            : 0}
                        </td>
                      </tr>
                    ))}
                    {reportData.rdcPerformance.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500">
                          No RDC performance data available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  )
}
