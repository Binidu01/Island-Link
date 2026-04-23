'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import RDCNavbar from '../components/RDCNavbar'
import { db, auth } from '../lib/firebase'

interface ProductQuestion {
  id: string
  productId: string
  question: string
  askedBy: string
  userId: string
  createdAt: Timestamp | string
  answer?: string
  answeredBy?: string
  answeredAt?: Timestamp | string
  status: 'pending' | 'answered'
  productName?: string
  productImage?: string
}

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
  minStockLevel?: number
  lastRestocked?: any
  createdAt?: any
  updatedAt?: any
}

export default function ProductQAPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [rdcStaff, setRdcStaff] = useState(false)
  const [userRdcLocation, setUserRdcLocation] = useState<string>('')

  const [questions, setQuestions] = useState<ProductQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<ProductQuestion[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState({
    totalQuestions: 0,
    pendingQuestions: 0,
    answeredQuestions: 0,
  })

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showAnswerModal, setShowAnswerModal] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<ProductQuestion | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Filter states
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'answered'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all')
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all')

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setUser(currentUser)

      // Check if user is RDC staff by checking their role in Firestore
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const userRole = userData.role?.toLowerCase()
          const isRdcStaff =
            userRole === 'rdc staff' ||
            userRole === 'rdc manager' ||
            userRole === 'logistics team' ||
            userRole === 'admin' ||
            userRole === 'customer service'
          setRdcStaff(isRdcStaff)

          // Get RDC location from 'rdc' field
          const userRdc = userData.rdc || userData.rdcLocation || 'North RDC'
          setUserRdcLocation(userRdc)

          if (!isRdcStaff) {
            // Allow all users to access Q&A page
            console.log('User is not RDC staff but can access Q&A')
          }

          // Start listening to data
          setupListeners(currentUser.uid)
        } else {
          console.error('User document not found')
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking user status:', error)
      }
    })

    return () => unsubscribe()
  }, [])

  // Setup real-time listeners
  const setupListeners = async (userId: string) => {
    setLoading(true)

    // Listen to productQuestions collection
    const questionsUnsubscribe = onSnapshot(
      collection(db, 'productQuestions'),
      async (snapshot) => {
        const questionsData: ProductQuestion[] = []

        // Get all questions and enrich with product data
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data()
          const question: ProductQuestion = {
            id: docSnap.id,
            productId: data.productId,
            question: data.question,
            askedBy: data.askedBy || 'Customer',
            userId: data.userId,
            createdAt: data.createdAt,
            answer: data.answer,
            answeredBy: data.answeredBy,
            answeredAt: data.answeredAt,
            status: data.answer ? 'answered' : 'pending',
          }

          // Get product details if needed
          if (question.productId) {
            try {
              const productDoc = await getDoc(doc(db, 'products', question.productId))
              if (productDoc.exists()) {
                const productData = productDoc.data()
                question.productName = productData.name
                question.productImage = productData.imageURL
              }
            } catch (error) {
              console.error('Error fetching product:', error)
            }
          }

          questionsData.push(question)
        }

        // Sort by creation date (newest first)
        questionsData.sort((a, b) => {
          const aTime =
            a.createdAt instanceof Timestamp
              ? a.createdAt.seconds
              : typeof a.createdAt === 'string'
                ? new Date(a.createdAt).getTime() / 1000
                : 0
          const bTime =
            b.createdAt instanceof Timestamp
              ? b.createdAt.seconds
              : typeof b.createdAt === 'string'
                ? new Date(b.createdAt).getTime() / 1000
                : 0
          return bTime - aTime
        })

        setQuestions(questionsData)
        applyFilters(
          questionsData,
          activeFilter,
          searchTerm,
          selectedProductFilter,
          selectedTimeframe
        )

        // Calculate stats
        const pendingQuestions = questionsData.filter((q) => q.status === 'pending').length
        const answeredQuestions = questionsData.filter((q) => q.status === 'answered').length

        setStats({
          totalQuestions: questionsData.length,
          pendingQuestions,
          answeredQuestions,
        })

        setLoading(false)
      },
      (error) => {
        console.error('Error listening to questions:', error)
        setLoading(false)
      }
    )

    // Listen to products for filtering
    const productsUnsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[]
        setProducts(productsData)
      },
      (error) => {
        console.error('Error listening to products:', error)
      }
    )

    // Cleanup listeners on unmount
    return () => {
      questionsUnsubscribe()
      productsUnsubscribe()
    }
  }

  // Apply filters
  const applyFilters = (
    questionsList: ProductQuestion[],
    filter: string,
    search: string,
    productId: string,
    timeframe: string
  ) => {
    let filtered = [...questionsList]

    // Apply status filter
    if (filter === 'pending') {
      filtered = filtered.filter((q) => q.status === 'pending')
    } else if (filter === 'answered') {
      filtered = filtered.filter((q) => q.status === 'answered')
    }

    // Apply product filter
    if (productId !== 'all') {
      filtered = filtered.filter((q) => q.productId === productId)
    }

    // Apply timeframe filter
    if (timeframe !== 'all') {
      const now = new Date()
      const cutoff = new Date()

      switch (timeframe) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0)
          break
        case 'week':
          cutoff.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoff.setMonth(now.getMonth() - 1)
          break
      }

      filtered = filtered.filter((q) => {
        const questionDate =
          q.createdAt instanceof Timestamp
            ? q.createdAt.toDate()
            : typeof q.createdAt === 'string'
              ? new Date(q.createdAt)
              : new Date()
        return questionDate >= cutoff
      })
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (q) =>
          q.question.toLowerCase().includes(searchLower) ||
          q.askedBy.toLowerCase().includes(searchLower) ||
          (q.productName && q.productName.toLowerCase().includes(searchLower)) ||
          (q.answer && q.answer.toLowerCase().includes(searchLower))
      )
    }

    setFilteredQuestions(filtered)
  }

  // Handle filter changes
  const handleFilterChange = (filter: 'all' | 'pending' | 'answered') => {
    setActiveFilter(filter)
    applyFilters(questions, filter, searchTerm, selectedProductFilter, selectedTimeframe)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    applyFilters(questions, activeFilter, value, selectedProductFilter, selectedTimeframe)
  }

  const handleProductFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedProductFilter(value)
    applyFilters(questions, activeFilter, searchTerm, value, selectedTimeframe)
  }

  const handleTimeframeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedTimeframe(value)
    applyFilters(questions, activeFilter, searchTerm, selectedProductFilter, value)
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
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp)
      } else {
        return 'N/A'
      }

      if (isNaN(date.getTime())) {
        return 'Invalid date'
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      console.error('Error formatting timestamp:', error)
      return 'N/A'
    }
  }

  // Handle answering a question - open modal
  const handleAnswerQuestion = (question: ProductQuestion) => {
    setSelectedQuestion(question)
    setAnswerText('')
    setShowAnswerModal(true)
  }

  // Submit answer
  const submitAnswer = async () => {
    if (!answerText.trim() || !selectedQuestion || !user) {
      setErrorMessage('Please enter an answer')
      setShowErrorModal(true)
      return
    }

    try {
      const questionRef = doc(db, 'productQuestions', selectedQuestion.id)
      await updateDoc(questionRef, {
        answer: answerText,
        answeredBy: user.displayName || user.email,
        answeredAt: new Date(),
        status: 'answered',
      })

      setShowAnswerModal(false)
      setShowSuccessModal(true)
      setSelectedQuestion(null)
      setAnswerText('')
    } catch (error) {
      console.error('Error answering question:', error)
      setErrorMessage('Error submitting answer. Please try again.')
      setShowErrorModal(true)
    }
  }

  // Handle viewing product in modal
  const handleViewProduct = async (productId: string) => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId))
      if (productDoc.exists()) {
        setSelectedProduct({
          id: productDoc.id,
          ...productDoc.data(),
        } as Product)
        setShowProductModal(true)
      } else {
        setErrorMessage('Product not found!')
        setShowErrorModal(true)
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      setErrorMessage('Error loading product details.')
      setShowErrorModal(true)
    }
  }

  // Close modals
  const closeProductModal = () => {
    setShowProductModal(false)
    setSelectedProduct(null)
  }

  const closeAnswerModal = () => {
    setShowAnswerModal(false)
    setSelectedQuestion(null)
    setAnswerText('')
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

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get product name
  const getProductName = (question: ProductQuestion) => {
    return question.productName || `Product ${question.productId?.slice(-6)}`
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-gray-100">
      <RDCNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Product Questions & Answers</h1>
              <p className="text-gray-600 mt-2">
                Manage customer inquiries about products {rdcStaff ? `• ${userRdcLocation}` : ''}
              </p>
            </div>
            {!rdcStaff && (
              <button
                onClick={() => (window.location.href = '/ask-question')}
                className="px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Ask a Question
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid - Removed "My Questions" */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Total Questions */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Questions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalQuestions}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Pending Questions */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Questions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingQuestions}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
            <div className="mt-4">
              <span className="text-xs text-gray-500">Awaiting response</span>
            </div>
          </div>

          {/* Answered Questions */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Answered Questions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.answeredQuestions}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-100 to-green-200 flex items-center justify-center">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Responses provided</span>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-900">Customer Questions</h2>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${activeFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All Questions
              </button>
              <button
                onClick={() => handleFilterChange('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${activeFilter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <span className="w-2 h-2 bg-yellow-500 rounded-full" aria-hidden="true"></span>
                Pending
              </button>
              <button
                onClick={() => handleFilterChange('answered')}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${activeFilter === 'answered' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <span className="w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></span>
                Answered
              </button>
            </div>

            {/* Product Filter */}
            <select
              value={selectedProductFilter}
              onChange={handleProductFilterChange}
              aria-label="Filter by product"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="all" className="text-gray-900">
                All Products
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id} className="text-gray-900">
                  {product.name}
                </option>
              ))}
            </select>

            {/* Timeframe Filter */}
            <select
              value={selectedTimeframe}
              onChange={handleTimeframeChange}
              aria-label="Filter by time period"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="all" className="text-gray-900">
                All Time
              </option>
              <option value="today" className="text-gray-900">
                Today
              </option>
              <option value="week" className="text-gray-900">
                Past Week
              </option>
              <option value="month" className="text-gray-900">
                Past Month
              </option>
            </select>
          </div>
        </div>

        {/* Questions List */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">
              Questions ({filteredQuestions.length})
            </h2>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading questions...</span>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-gray-500 mt-2">No questions found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try changing your filters or search term
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="border border-gray-200 rounded-xl p-6 hover:bg-gray-50 transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      {/* Question Info */}
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(question.status)}`}
                              >
                                {question.status === 'answered' ? 'Answered' : 'Pending Response'}
                              </span>
                              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {getProductName(question)}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {question.question}
                            </h3>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">{question.askedBy}</p>
                            <p className="text-xs text-gray-500">
                              {formatTimestamp(question.createdAt)}
                            </p>
                          </div>
                        </div>

                        {/* Answer Section */}
                        {question.answer && (
                          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-5 h-5 text-green-600 shrink-0"
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
                                <span className="font-medium text-green-800">
                                  Answer from {question.answeredBy}
                                </span>
                              </div>
                              <span className="text-sm text-green-600">
                                {formatTimestamp(question.answeredAt)}
                              </span>
                            </div>
                            <p className="text-gray-800">{question.answer}</p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full lg:w-auto">
                        {rdcStaff && question.status === 'pending' && (
                          <button
                            onClick={() => handleAnswerQuestion(question)}
                            className="px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-2"
                          >
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
                                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                              />
                            </svg>
                            Answer
                          </button>
                        )}
                        <button
                          onClick={() => handleViewProduct(question.productId)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                        >
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View Product
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Modal */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900 truncate">
                  {selectedProduct.name}
                </h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {selectedProduct.category}
                </span>
              </div>
              <button
                onClick={closeProductModal}
                aria-label="Close modal"
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

            {/* Modal Content */}
            <div className="p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Product Image */}
                <div className="lg:w-2/5">
                  <div className="bg-gray-100 rounded-xl overflow-hidden">
                    {selectedProduct.imageURL ? (
                      <img
                        src={selectedProduct.imageURL}
                        alt={selectedProduct.name}
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    ) : (
                      <div className="w-full h-64 flex items-center justify-center bg-linear-to-br from-gray-200 to-gray-300">
                        <svg
                          className="w-16 h-16 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Details */}
                <div className="lg:w-3/5">
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <p className="mt-2 text-gray-900">{selectedProduct.description}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-linear-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-600">Price</label>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatCurrency(selectedProduct.price)}
                      </p>
                    </div>

                    <div
                      className={`p-4 rounded-xl ${
                        selectedProduct.stock > 50
                          ? 'bg-linear-to-br from-green-50 to-green-100'
                          : selectedProduct.stock > 10
                            ? 'bg-linear-to-br from-yellow-50 to-yellow-100'
                            : 'bg-linear-to-br from-red-50 to-red-100'
                      }`}
                    >
                      <label className="text-sm font-medium text-gray-600">Stock</label>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {selectedProduct.stock} units
                      </p>
                      <p
                        className={`text-xs font-medium mt-1 ${
                          selectedProduct.stock > 50
                            ? 'text-green-700'
                            : selectedProduct.stock > 10
                              ? 'text-yellow-700'
                              : 'text-red-700'
                        }`}
                      >
                        {selectedProduct.stock > 50
                          ? 'In Stock'
                          : selectedProduct.stock > 10
                            ? 'Low Stock'
                            : 'Critical Stock'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">SKU</label>
                      <p className="mt-1 font-mono text-gray-900 bg-gray-100 px-3 py-2 rounded-lg">
                        {selectedProduct.sku}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600">RDC Location</label>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                          {selectedProduct.rdcLocation}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Minimum Stock Level
                      </label>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {selectedProduct.minStockLevel || 10} units
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600">Last Updated</label>
                      <p className="mt-1 text-gray-900">
                        {formatTimestamp(selectedProduct.updatedAt || selectedProduct.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeProductModal}
                className="px-6 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Answer Question Modal */}
      {showAnswerModal && selectedQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Answer Question</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Question about: {getProductName(selectedQuestion)}
                </p>
              </div>
              <button
                onClick={closeAnswerModal}
                aria-label="Close modal"
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

            {/* Modal Content */}
            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Customer Question:</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-800">{selectedQuestion.question}</p>
                  <p className="text-sm text-gray-500 mt-2">Asked by: {selectedQuestion.askedBy}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Answer</label>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  rows={5}
                  placeholder="Type your answer here..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeAnswerModal}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitAnswer}
                className="px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition"
              >
                Submit Answer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
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
              <h3 className="text-lg font-bold text-gray-900 mb-2">Success!</h3>
              <p className="text-gray-600 mb-6">Your answer has been submitted successfully.</p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
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
              <h3 className="text-lg font-bold text-gray-900 mb-2">Error</h3>
              <p className="text-gray-600 mb-6">{errorMessage}</p>
              <button
                onClick={() => setShowErrorModal(false)}
                className="w-full px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition"
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
