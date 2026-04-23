'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import { useEffect, useState, useCallback, useMemo } from 'react'

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
  createdAt?: any
}

interface OrderItem {
  productId: string
  productName: string
  quantity: number
  price: number
  imageURL?: string
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
  shippingInfo: {
    fullName: string
    email: string
    phone: string
    address: string
    city: string
    postalCode: string
    latitude?: number
    longitude?: number
    notes?: string
  }
  total: number
  subtotal: number
  shipping: number
  userEmail: string
  paymentMethod: string
  rdcLocation?: string
  updatedAt?: any
}

interface RDCStats {
  rdcName: string
  location: string
  totalProducts: number
  totalValue: number
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  deliveredOrders: number
  lowStockProducts: number
  outOfStockProducts: number
  avgOrderValue: number
  popularCategories: string[]
  monthlyGrowth: number
  performanceScore: number
}

interface SalesTrend {
  month: string
  revenue: number
  orders: number
  rdcName: string
}

interface ProductPerformance {
  productId: string
  name: string
  sku: string
  category: string
  totalSold: number
  revenue: number
  currentStock: number
  rdcLocation: string
}

export default function RDCTracking() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isHOManager, setIsHOManager] = useState(false)
  const [rdcStats, setRdcStats] = useState<RDCStats[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [selectedRDC, setSelectedRDC] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('month')
  const [showRDCModal, setShowRDCModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedRDCData, setSelectedRDCData] = useState<RDCStats | null>(null)
  const [rdcProducts, setRdcProducts] = useState<ProductPerformance[]>([])
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([])
  const [uniqueRdcLocations, setUniqueRdcLocations] = useState<string[]>([])
  const [topPerformingRDC, setTopPerformingRDC] = useState<string>('')
  const [highestValueRDC, setHighestValueRDC] = useState<string>('')

  // Memoized helper functions
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

  const getGrowthColor = useCallback((growth: number) => {
    if (growth > 20) return 'text-green-600 bg-green-100'
    if (growth > 0) return 'text-green-500 bg-green-50'
    if (growth < -20) return 'text-red-600 bg-red-100'
    if (growth < 0) return 'text-red-500 bg-red-50'
    return 'text-gray-600 bg-gray-100'
  }, [])

  const getPerformanceColor = useCallback((score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }, [])

  const getStockStatusColor = useCallback((stock: number) => {
    if (stock === 0) return 'text-red-600 bg-red-100'
    if (stock < 5) return 'text-red-500 bg-red-50'
    if (stock < 10) return 'text-orange-500 bg-orange-50'
    if (stock < 20) return 'text-yellow-500 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }, [])

  const getStatusColor = useCallback((status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }, [])

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setCurrentUser(currentUser)

      // Check if user is admin or HO Manager
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const isUserAdmin = userData.role === 'admin'
          const isUserHOManager = userData.role === 'HO Manager'

          setIsAdmin(isUserAdmin)
          setIsHOManager(isUserHOManager)

          // Allow both admin and HO Manager to access this page
          if (!isUserAdmin && !isUserHOManager) {
            window.location.href = '/'
            return
          }

          // Load data
          loadData()
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

  // Load data from Firestore
  const loadData = async () => {
    try {
      setLoading(true)

      // Load products
      const productsQuery = query(collection(db, 'products'))
      const productsSnapshot = await getDocs(productsQuery)
      const productsData = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[]
      setAllProducts(productsData)

      // Load orders - always load all orders for calculations
      const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      const ordersSnapshot = await getDocs(ordersQuery)
      const ordersData = ordersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[]
      setAllOrders(ordersData)

      // Calculate RDC stats
      calculateRDCStats(productsData, ordersData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate RDC statistics
  const calculateRDCStats = useCallback((products: Product[], orders: Order[]) => {
    // Get unique RDC locations from products
    const uniqueLocations = Array.from(
      new Set(
        products
          .map((p) => p.rdcLocation)
          .filter(Boolean)
          .filter((loc) => loc.trim() !== '')
      )
    )
    setUniqueRdcLocations(uniqueLocations)

    if (uniqueLocations.length === 0) {
      setRdcStats([])
      setSalesTrend([])
      return
    }

    // Process orders to determine RDC for each order (based on products)
    const ordersWithRDC = orders.map((order) => {
      // Find RDC locations from order items
      const rdcsInOrder = order.items
        .map((item) => {
          const product = products.find((p) => p.id === item.productId)
          return product?.rdcLocation
        })
        .filter(Boolean) as string[]

      if (rdcsInOrder.length === 0) {
        return { ...order, rdcLocation: 'Unknown' }
      }

      // Determine primary RDC for the order (most common RDC in order)
      const rdcCount: { [key: string]: number } = {}
      rdcsInOrder.forEach((rdc) => {
        rdcCount[rdc] = (rdcCount[rdc] || 0) + 1
      })

      const primaryRDC =
        Object.entries(rdcCount)
          .sort(([, a], [, b]) => b - a)
          .map(([rdc]) => rdc)[0] || 'Unknown'

      return { ...order, rdcLocation: primaryRDC }
    })

    // Calculate stats for each RDC
    const stats: RDCStats[] = uniqueLocations.map((location) => {
      // Filter products by RDC location
      const rdcProducts = products.filter((p) => p.rdcLocation === location)
      const totalProducts = rdcProducts.length
      const totalValue = rdcProducts.reduce((sum, p) => sum + p.price * p.stock, 0)
      const lowStockProducts = rdcProducts.filter((p) => p.stock < 20 && p.stock > 0).length
      const outOfStockProducts = rdcProducts.filter((p) => p.stock === 0).length

      // Filter orders by RDC location
      const rdcOrders = ordersWithRDC.filter((o) => o.rdcLocation === location)
      const totalOrders = rdcOrders.length

      // Calculate revenue from delivered/confirmed orders
      const deliveredOrders = rdcOrders.filter(
        (o) => o.status === 'delivered' || o.status === 'completed' || o.status === 'confirmed'
      )
      const totalRevenue = deliveredOrders.reduce(
        (sum, o) => sum + (o.total || o.totalAmount || 0),
        0
      )

      const pendingOrders = rdcOrders.filter(
        (o) => o.status === 'pending' || o.status === 'processing'
      ).length

      const deliveredCount = deliveredOrders.length
      const avgOrderValue = deliveredCount > 0 ? totalRevenue / deliveredCount : 0

      // Calculate popular categories
      const categoryCounts: { [key: string]: number } = {}
      rdcProducts.forEach((p) => {
        if (p.category) {
          categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1
        }
      })
      const popularCategories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category]) => category)

      // Calculate monthly growth (last 30 days vs previous 30 days)
      const now = new Date()
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const previous30Days = new Date(last30Days.getTime() - 30 * 24 * 60 * 60 * 1000)

      const recentOrders = rdcOrders.filter((o) => {
        let orderDate: Date
        if (o.createdAt?.seconds) {
          orderDate = new Date(o.createdAt.seconds * 1000)
        } else if (o.createdAt?.toDate) {
          orderDate = o.createdAt.toDate()
        } else {
          orderDate = new Date(o.createdAt)
        }
        return orderDate >= last30Days
      }).length

      const previousOrders = rdcOrders.filter((o) => {
        let orderDate: Date
        if (o.createdAt?.seconds) {
          orderDate = new Date(o.createdAt.seconds * 1000)
        } else if (o.createdAt?.toDate) {
          orderDate = o.createdAt.toDate()
        } else {
          orderDate = new Date(o.createdAt)
        }
        return orderDate >= previous30Days && orderDate < last30Days
      }).length

      const monthlyGrowth =
        previousOrders > 0
          ? ((recentOrders - previousOrders) / previousOrders) * 100
          : recentOrders > 0
            ? 100
            : 0

      // Calculate performance score (0-100)
      const performanceScore = calculatePerformanceScore(
        totalProducts,
        totalRevenue,
        deliveredCount,
        lowStockProducts,
        totalValue
      )

      return {
        rdcName: location,
        location: location,
        totalProducts,
        totalValue,
        totalOrders,
        totalRevenue,
        pendingOrders,
        deliveredOrders: deliveredCount,
        lowStockProducts,
        outOfStockProducts,
        avgOrderValue,
        popularCategories,
        monthlyGrowth,
        performanceScore,
      }
    })

    // Calculate "All" aggregated stats
    const deliveredAllOrders = orders.filter(
      (o) => o.status === 'delivered' || o.status === 'completed' || o.status === 'confirmed'
    )
    const totalRevenueAll = deliveredAllOrders.reduce(
      (sum, o) => sum + (o.total || o.totalAmount || 0),
      0
    )

    const allStats: RDCStats = {
      rdcName: 'All RDCs',
      location: 'All Locations',
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + p.price * p.stock, 0),
      totalOrders: orders.length,
      totalRevenue: totalRevenueAll,
      pendingOrders: orders.filter((o) => o.status === 'pending' || o.status === 'processing')
        .length,
      deliveredOrders: deliveredAllOrders.length,
      lowStockProducts: products.filter((p) => p.stock < 20 && p.stock > 0).length,
      outOfStockProducts: products.filter((p) => p.stock === 0).length,
      avgOrderValue:
        deliveredAllOrders.length > 0 ? totalRevenueAll / deliveredAllOrders.length : 0,
      popularCategories: Array.from(new Set(products.map((p) => p.category).filter(Boolean))).slice(
        0,
        3
      ),
      monthlyGrowth: 0,
      performanceScore:
        stats.length > 0
          ? Math.round(stats.reduce((sum, stat) => sum + stat.performanceScore, 0) / stats.length)
          : 0,
    }

    // Find top performing RDC
    const topRDC =
      stats.length > 0
        ? stats.reduce((prev, current) =>
            prev.performanceScore > current.performanceScore ? prev : current
          )
        : null
    setTopPerformingRDC(topRDC?.rdcName || 'N/A')

    // Find highest inventory value RDC
    const highestValue =
      stats.length > 0
        ? stats.reduce((prev, current) => (prev.totalValue > current.totalValue ? prev : current))
        : null
    setHighestValueRDC(highestValue?.rdcName || 'N/A')

    setRdcStats([allStats, ...stats])
    calculateSalesTrend(ordersWithRDC, stats, products)
  }, [])

  // Calculate performance score (0-100)
  const calculatePerformanceScore = useCallback(
    (
      totalProducts: number,
      totalRevenue: number,
      deliveredOrders: number,
      lowStockProducts: number,
      totalValue: number
    ): number => {
      let score = 0

      // Revenue per product score (0-30)
      if (totalProducts > 0) {
        const revenuePerProduct = totalRevenue / totalProducts
        score += Math.min((revenuePerProduct / 1000) * 30, 30)
      }

      // Order fulfillment score (0-30)
      if (deliveredOrders > 0) {
        score += Math.min((deliveredOrders / 10) * 30, 30)
      }

      // Stock health score (0-20)
      if (totalProducts > 0) {
        const healthyStockRatio = 1 - lowStockProducts / totalProducts
        score += healthyStockRatio * 20
      }

      // Inventory turnover score (0-20)
      if (totalValue > 0) {
        const turnoverScore = Math.min((totalRevenue / totalValue) * 20, 20)
        score += turnoverScore
      }

      return Math.round(Math.min(score, 100))
    },
    []
  )

  // Calculate sales trend data - ONLY includes months with actual revenue
  const calculateSalesTrend = useCallback(
    (orders: Order[], rdcStats: RDCStats[], products: Product[]) => {
      const now = new Date()
      const trendData: SalesTrend[] = []

      // Generate last 6 months data
      const months: { date: Date; name: string }[] = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthName = date.toLocaleDateString('en-US', { month: 'short' })
        months.push({ date, name: monthName })
      }

      // Get all RDCs including "All Locations"
      const rdcsToShow = ['All Locations', ...rdcStats.map((stat) => stat.location)]

      rdcsToShow.forEach((rdc) => {
        months.forEach(({ date, name: monthName }) => {
          const monthOrders = orders.filter((o) => {
            // Get order date
            let orderDate: Date
            if (o.createdAt?.seconds) {
              orderDate = new Date(o.createdAt.seconds * 1000)
            } else if (o.createdAt?.toDate) {
              orderDate = o.createdAt.toDate()
            } else {
              orderDate = new Date(o.createdAt)
            }

            // Check if order is in the right month and year
            const isRightMonth =
              orderDate.getMonth() === date.getMonth() &&
              orderDate.getFullYear() === date.getFullYear()

            // Check if order is delivered/confirmed
            const isDelivered =
              o.status === 'delivered' || o.status === 'completed' || o.status === 'confirmed'

            // Check RDC location
            if (rdc === 'All Locations') {
              return isRightMonth && isDelivered
            } else {
              // For specific RDC, we need to check if order belongs to that RDC
              const orderRDCs = o.items
                .map((item) => {
                  const product = products.find((p) => p.id === item.productId)
                  return product?.rdcLocation
                })
                .filter(Boolean) as string[]

              if (orderRDCs.length === 0) return false

              // Determine primary RDC for the order
              const rdcCount: { [key: string]: number } = {}
              orderRDCs.forEach((rdcLoc) => {
                rdcCount[rdcLoc] = (rdcCount[rdcLoc] || 0) + 1
              })

              const primaryRDC = Object.entries(rdcCount)
                .sort(([, a], [, b]) => b - a)
                .map(([rdcLoc]) => rdcLoc)[0]

              return isRightMonth && isDelivered && primaryRDC === rdc
            }
          })

          const revenue = monthOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || 0), 0)
          const ordersCount = monthOrders.length

          // ONLY add to trend data if there are ACTUAL sales in this month for this RDC
          if (revenue > 0) {
            trendData.push({
              month: monthName,
              revenue,
              orders: ordersCount,
              rdcName: rdc,
            })
          }
        })
      })

      // Sort trend data by month and RDC for better display
      const monthOrder = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]
      trendData.sort((a, b) => {
        // First sort by month
        const monthDiff = monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
        if (monthDiff !== 0) return monthDiff

        // Then sort by RDC (All Locations first, then alphabetical)
        if (a.rdcName === 'All Locations') return -1
        if (b.rdcName === 'All Locations') return 1
        return a.rdcName.localeCompare(b.rdcName)
      })

      setSalesTrend(trendData)
    },
    []
  )

  // Handle RDC selection
  const handleRDCClick = useCallback(
    (rdc: RDCStats) => {
      setSelectedRDCData(rdc)
      setShowRDCModal(true)

      // Calculate product performance for selected RDC
      if (rdc.location !== 'All Locations') {
        const filteredProducts = allProducts.filter((p) => p.rdcLocation === rdc.location)
        const productPerformance: ProductPerformance[] = filteredProducts
          .map((product) => {
            // Find orders containing this product
            const productOrders = allOrders.filter((o) =>
              o.items.some((item) => item.productId === product.id)
            )

            // Only count delivered/confirmed orders
            const validOrders = productOrders.filter(
              (o) =>
                o.status === 'delivered' || o.status === 'completed' || o.status === 'confirmed'
            )

            const totalSold = validOrders.reduce((sum, order) => {
              const item = order.items.find((i) => i.productId === product.id)
              return sum + (item?.quantity || 0)
            }, 0)

            const revenue = validOrders.reduce((sum, order) => {
              const item = order.items.find((i) => i.productId === product.id)
              return sum + (item?.quantity || 0) * (item?.price || 0)
            }, 0)

            return {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              totalSold,
              revenue,
              currentStock: product.stock,
              rdcLocation: product.rdcLocation,
            }
          })
          .sort((a, b) => b.revenue - a.revenue)

        setRdcProducts(productPerformance)
      } else {
        // For "All RDCs", aggregate all products
        const productPerformance: ProductPerformance[] = allProducts
          .map((product) => {
            const productOrders = allOrders.filter((o) =>
              o.items.some((item) => item.productId === product.id)
            )

            // Only count delivered/confirmed orders
            const validOrders = productOrders.filter(
              (o) =>
                o.status === 'delivered' || o.status === 'completed' || o.status === 'confirmed'
            )

            const totalSold = validOrders.reduce((sum, order) => {
              const item = order.items.find((i) => i.productId === product.id)
              return sum + (item?.quantity || 0)
            }, 0)

            const revenue = validOrders.reduce((sum, order) => {
              const item = order.items.find((i) => i.productId === product.id)
              return sum + (item?.quantity || 0) * (item?.price || 0)
            }, 0)

            return {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              totalSold,
              revenue,
              currentStock: product.stock,
              rdcLocation: product.rdcLocation,
            }
          })
          .sort((a, b) => b.revenue - a.revenue)

        setRdcProducts(productPerformance)
      }
    },
    [allProducts, allOrders]
  )

  // Handle product performance view
  const handleViewProducts = useCallback(
    (rdc: RDCStats) => {
      handleRDCClick(rdc)
      setShowProductModal(true)
    },
    [handleRDCClick]
  )

  // Format date from Firestore timestamp
  const formatFirestoreDate = useCallback((timestamp: any) => {
    if (!timestamp) return 'N/A'

    try {
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString()
      } else if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString()
      } else {
        return new Date(timestamp).toLocaleDateString()
      }
    } catch (error) {
      console.error('Error formatting date:', error)
      return 'N/A'
    }
  }, [])

  // Memoized filtered stats
  const filteredRdcStats = useMemo(() => {
    return selectedRDC === 'all'
      ? rdcStats
      : rdcStats.filter(
          (stat) => stat.location === selectedRDC || stat.location === 'All Locations'
        )
  }, [selectedRDC, rdcStats])

  // Filter recent orders by selected RDC and time range
  const filteredRecentOrders = useMemo(() => {
    let filtered = allOrders

    // Filter by RDC
    if (selectedRDC !== 'all') {
      // For specific RDC, we need to calculate RDC for each order
      filtered = filtered.filter((order) => {
        const orderRDCs = order.items
          .map((item) => {
            const product = allProducts.find((p) => p.id === item.productId)
            return product?.rdcLocation
          })
          .filter(Boolean) as string[]

        if (orderRDCs.length === 0) return false

        // Determine primary RDC for the order
        const rdcCount: { [key: string]: number } = {}
        orderRDCs.forEach((rdc) => {
          rdcCount[rdc] = (rdcCount[rdc] || 0) + 1
        })

        const primaryRDC = Object.entries(rdcCount)
          .sort(([, a], [, b]) => b - a)
          .map(([rdc]) => rdc)[0]

        return primaryRDC === selectedRDC
      })
    }

    // Filter by time range
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0) // All time
    }

    filtered = filtered.filter((order) => {
      let orderDate: Date
      if (order.createdAt?.seconds) {
        orderDate = new Date(order.createdAt.seconds * 1000)
      } else if (order.createdAt?.toDate) {
        orderDate = order.createdAt.toDate()
      } else {
        orderDate = new Date(order.createdAt)
      }
      return orderDate >= startDate
    })

    return filtered.slice(0, 10)
  }, [allOrders, allProducts, selectedRDC, timeRange])

  // If not authorized, show loading or redirect
  if (!isAdmin && !isHOManager && loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading RDC Tracking...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin && !isHOManager) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <HOManagerNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RDC Performance Tracking</h1>
              <p className="text-gray-600 mt-2">
                Monitor inventory, sales, and performance across {uniqueRdcLocations.length}{' '}
                Regional Distribution Centers
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedRDC}
                onChange={(e) => setSelectedRDC(e.target.value)}
                aria-label="Filter by RDC location"
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
              >
                <option value="all">All RDCs</option>
                {uniqueRdcLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                aria-label="Filter by time range"
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
              >
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
                <option value="year">Last 365 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        {rdcStats.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3">
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
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Top Performing RDC</p>
                  <p className="font-bold text-gray-900 mt-1">{topPerformingRDC}</p>
                  <p className="text-xs text-gray-500 mt-1">Based on overall performance score</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3">
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
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Highest Inventory Value</p>
                  <p className="font-bold text-gray-900 mt-1">{highestValueRDC}</p>
                  <p className="text-xs text-gray-500 mt-1">Most valuable stock location</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3">
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Low Stock Items</p>
                  <p className="font-bold text-gray-900 mt-1">
                    {rdcStats[0]?.lowStockProducts || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Items below 20 units across all RDCs</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RDC Performance Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">RDC Performance Overview</h2>
            <div className="text-sm text-gray-500">
              Showing {selectedRDC === 'all' ? 'all RDCs' : selectedRDC} •{' '}
              {Math.max(filteredRdcStats.length - 1, 0)} locations
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredRdcStats.length === 0 ? (
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <p className="text-gray-500 mt-2">No RDC data available</p>
              <p className="text-gray-400 text-sm mt-1">
                Add products with RDC locations to see data
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRdcStats.map((rdc, index) => (
                <div
                  key={index}
                  className={`border rounded-xl p-5 hover:shadow-md transition cursor-pointer ${
                    rdc.location === 'All Locations'
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => handleRDCClick(rdc)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{rdc.rdcName}</h3>
                      <p className="text-sm text-gray-600">{rdc.location}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getPerformanceColor(rdc.performanceScore)}`}
                      >
                        {rdc.performanceScore}/100
                      </div>
                      <div
                        className={`px-2 py-0.5 rounded-full text-xs ${getGrowthColor(rdc.monthlyGrowth)}`}
                      >
                        {rdc.monthlyGrowth > 0 ? '+' : ''}
                        {rdc.monthlyGrowth.toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Products</p>
                        <p className="font-semibold text-gray-900">{rdc.totalProducts}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Inventory Value</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(rdc.totalValue)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Orders</p>
                        <p className="font-semibold text-gray-900">{rdc.totalOrders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Revenue</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(rdc.totalRevenue)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Stock Health</p>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              rdc.lowStockProducts === 0
                                ? 'bg-green-500'
                                : rdc.lowStockProducts < 5
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                          ></div>
                          <span className="font-semibold text-gray-900 text-sm">
                            {rdc.lowStockProducts} low
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Avg. Order</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(rdc.avgOrderValue)}
                        </p>
                      </div>
                    </div>

                    {rdc.popularCategories.length > 0 && rdc.location !== 'All Locations' && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Top Categories</p>
                        <div className="flex flex-wrap gap-1">
                          {rdc.popularCategories.map((category, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <span className="text-xs text-gray-600">{rdc.pendingOrders} pending</span>
                        </div>
                        {rdc.location !== 'All Locations' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewProducts(rdc)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View Products →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales Trend Chart - Only shows when there's actual sales data */}
        {salesTrend.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Sales Trend (Last 6 Months)</h2>
              <div className="text-sm text-gray-500">Revenue comparison across RDCs</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RDC
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orders
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg. Order Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salesTrend.map((trend, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {trend.month}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              trend.rdcName === 'All Locations'
                                ? 'bg-blue-500'
                                : trend.rdcName === uniqueRdcLocations[0]
                                  ? 'bg-green-500'
                                  : trend.rdcName === uniqueRdcLocations[1]
                                    ? 'bg-purple-500'
                                    : 'bg-orange-500'
                            }`}
                          ></div>
                          {trend.rdcName}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                        {formatCurrency(trend.revenue)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {trend.orders}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatCurrency(trend.orders > 0 ? trend.revenue / trend.orders : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          // Only show the "no sales data" message if there are RDCs but no sales
          rdcStats.length > 0 &&
          rdcStats[0]?.totalRevenue === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Sales Trend (Last 6 Months)</h2>
                <div className="text-sm text-gray-500">Revenue comparison across RDCs</div>
              </div>
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-gray-500 mt-2">No sales data available for the last 6 months</p>
                <p className="text-gray-400 text-sm mt-1">
                  Sales data will appear here once orders are placed
                </p>
              </div>
            </div>
          )
        )}

        {/* Recent Orders */}
        {filteredRecentOrders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Recent Orders by RDC</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RDC
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecentOrders.map((order) => {
                    // Determine RDC for this order
                    const orderRDCs = order.items
                      .map((item) => {
                        const product = allProducts.find((p) => p.id === item.productId)
                        return product?.rdcLocation
                      })
                      .filter(Boolean) as string[]

                    let rdcLocation = 'Unknown'
                    if (orderRDCs.length > 0) {
                      const rdcCount: { [key: string]: number } = {}
                      orderRDCs.forEach((rdc) => {
                        rdcCount[rdc] = (rdcCount[rdc] || 0) + 1
                      })

                      rdcLocation =
                        Object.entries(rdcCount)
                          .sort(([, a], [, b]) => b - a)
                          .map(([rdc]) => rdc)[0] || 'Unknown'
                    }

                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{order.id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          <div>
                            <p className="font-medium">{order.shippingInfo?.fullName || 'N/A'}</p>
                            <p className="text-xs text-gray-500">
                              {order.userEmail || order.customerId}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {rdcLocation}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                          {formatCurrency(order.total || order.totalAmount || 0)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                          >
                            {order.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {formatFirestoreDate(order.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* RDC Detail Modal */}
      {showRDCModal && selectedRDCData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedRDCData.rdcName}</h2>
                  <p className="text-gray-600">Detailed Performance Analysis</p>
                </div>
                <button
                  onClick={() => setShowRDCModal(false)}
                  aria-label="Close modal"
                  className="text-gray-400 hover:text-gray-600"
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

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                  <p className="text-sm text-blue-700 font-medium">Performance Score</p>
                  <div className="flex items-center justify-between mt-2">
                    <p
                      className={`text-3xl font-bold ${getPerformanceColor(selectedRDCData.performanceScore).split(' ')[0]}`}
                    >
                      {selectedRDCData.performanceScore}
                    </p>
                    <span className="text-sm text-blue-600">/100</span>
                  </div>
                </div>

                <div className="bg-linear-to-br from-green-50 to-green-100 rounded-xl p-4">
                  <p className="text-sm text-green-700 font-medium">Monthly Growth</p>
                  <div className="flex items-center justify-between mt-2">
                    <p
                      className={`text-3xl font-bold ${getGrowthColor(selectedRDCData.monthlyGrowth).split(' ')[0]}`}
                    >
                      {selectedRDCData.monthlyGrowth > 0 ? '+' : ''}
                      {selectedRDCData.monthlyGrowth.toFixed(1)}%
                    </p>
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
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                </div>

                <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                  <p className="text-sm text-purple-700 font-medium">Inventory Value</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-3xl font-bold text-purple-700">
                      {formatCurrency(selectedRDCData.totalValue)}
                    </p>
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
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-xl p-4">
                  <p className="text-sm text-orange-700 font-medium">Order Fulfillment Rate</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-3xl font-bold text-orange-700">
                      {selectedRDCData.totalOrders > 0
                        ? Math.round(
                            (selectedRDCData.deliveredOrders / selectedRDCData.totalOrders) * 100
                          )
                        : 0}
                      %
                    </p>
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Stock Health Section */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Stock Health</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-green-600"
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
                      <div>
                        <p className="text-sm text-gray-600">In Stock Products</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {selectedRDCData.totalProducts - selectedRDCData.outOfStockProducts}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.73 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Low Stock Items</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {selectedRDCData.lowStockProducts}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
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
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Out of Stock</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {selectedRDCData.outOfStockProducts}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orders Overview */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Orders Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h4 className="font-medium text-gray-700 mb-3">Order Status Distribution</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Delivered/Confirmed</span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {selectedRDCData.deliveredOrders}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Pending</span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {selectedRDCData.pendingOrders}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Other</span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {selectedRDCData.totalOrders -
                            selectedRDCData.deliveredOrders -
                            selectedRDCData.pendingOrders}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h4 className="font-medium text-gray-700 mb-3">Revenue Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Revenue</span>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(selectedRDCData.totalRevenue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Average Order Value</span>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(selectedRDCData.avgOrderValue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Orders</span>
                        <span className="font-bold text-gray-900">
                          {selectedRDCData.totalOrders}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleViewProducts(selectedRDCData)}
                  className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  View Product Performance
                </button>
                <button
                  onClick={() => setShowRDCModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Performance Modal */}
      {showProductModal && selectedRDCData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Product Performance - {selectedRDCData.rdcName}
                  </h2>
                  <p className="text-gray-600">{rdcProducts.length} products • Sorted by revenue</p>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  aria-label="Close modal"
                  className="text-gray-400 hover:text-gray-600"
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

              {/* Product Performance Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Units Sold
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rdcProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                          No product data available for this RDC
                        </td>
                      </tr>
                    ) : (
                      rdcProducts.map((product) => (
                        <tr key={product.productId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                                <p className="text-xs text-gray-500">{product.rdcLocation}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {product.sku}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                            {product.totalSold}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                            {formatCurrency(product.revenue)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {product.currentStock}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockStatusColor(product.currentStock)}`}
                            >
                              {product.currentStock === 0
                                ? 'Out of Stock'
                                : product.currentStock < 5
                                  ? 'Very Low'
                                  : product.currentStock < 10
                                    ? 'Low'
                                    : product.currentStock < 20
                                      ? 'Warning'
                                      : 'Healthy'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Performance Summary */}
              {rdcProducts.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                      <p className="text-sm text-blue-700 font-medium">Top Product</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {rdcProducts[0]?.name || 'N/A'}
                      </p>
                      <p className="text-sm text-blue-600">
                        Revenue: {formatCurrency(rdcProducts[0]?.revenue || 0)}
                      </p>
                    </div>

                    <div className="bg-linear-to-br from-green-50 to-green-100 rounded-xl p-4">
                      <p className="text-sm text-green-700 font-medium">
                        Total Revenue from Products
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {formatCurrency(rdcProducts.reduce((sum, p) => sum + p.revenue, 0))}
                      </p>
                      <p className="text-sm text-green-600">{rdcProducts.length} products</p>
                    </div>

                    <div className="bg-linear-to-br from-red-50 to-red-100 rounded-xl p-4">
                      <p className="text-sm text-red-700 font-medium">Critical Stock Items</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {rdcProducts.filter((p) => p.currentStock < 5).length}
                      </p>
                      <p className="text-sm text-red-600">Need immediate attention</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowProductModal(false)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
