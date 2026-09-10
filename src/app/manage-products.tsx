'use client'

import { fileToWebpBase64 } from 'avatar64'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  addDoc,
} from 'firebase/firestore'
import { useEffect, useState, useRef } from 'react'

import AdminNavbar from '../components/Adminnavbar'
import HOManagerNavbar from '../components/HOManagerNavbar'
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
  createdAt?: any
  updatedAt?: any
}

interface ProductFilters {
  category: string
  rdcLocation: string
  search: string
  stockStatus: string
}

export default function ManageProducts() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isHOManager, setIsHOManager] = useState(false)
  const [isRDCStaff, setIsRDCStaff] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filters, setFilters] = useState<ProductFilters>({
    category: 'all',
    rdcLocation: 'all',
    search: '',
    stockStatus: 'all',
  })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [productToEdit, setProductToEdit] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    price: 0,
    stock: 0,
    imageURL: '',
    description: '',
    rdcLocation: '',
    sku: '',
  })
  const [addForm, setAddForm] = useState({
    name: '',
    category: '',
    price: 0,
    stock: 0,
    imageURL: '',
    description: '',
    rdcLocation: '',
    sku: '',
  })
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
  })

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRefEdit = useRef<HTMLInputElement>(null)

  // Fixed RDC Locations
  const fixedRdcLocations = ['North RDC', 'South RDC', 'East RDC', 'West RDC', 'Central RDC']

  // Log product action to auditLogs
  const logAuditAction = async (
    action: string,
    details: string,
    productId?: string,
    productSku?: string
  ) => {
    try {
      const auditLogData = {
        action,
        details,
        performedBy: currentUser?.email || 'system',
        timestamp: new Date(),
        productId: productId || null,
        productSku: productSku || null,
        userEmail: currentUser?.email || 'system',
        status: 'success',
      }

      await addDoc(collection(db, 'auditLogs'), auditLogData)
      console.log(`✓ Product audit log created: ${action}`)
    } catch (error) {
      console.error('Error creating product audit log:', error)
    }
  }

  // Show success modal
  const showSuccess = (message: string) => {
    setModalMessage(message)
    setShowSuccessModal(true)
  }

  // Show error modal
  const showError = (message: string) => {
    setModalMessage(message)
    setShowErrorModal(true)
  }

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setCurrentUser(currentUser)

      // Check if user is admin, HO Manager, or RDC Staff
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const userRole = userData.role

          const isUserAdmin = userRole === 'admin'
          const isUserHOManager = userRole === 'HO Manager'
          const isUserRDCStaff = userRole === 'RDC Staff'

          setIsAdmin(isUserAdmin)
          setIsHOManager(isUserHOManager)
          setIsRDCStaff(isUserRDCStaff)

          // Allow admin, HO Manager, and RDC Staff to access this page
          if (!isUserAdmin && !isUserHOManager && !isUserRDCStaff) {
            // Redirect unauthorized users
            window.location.href = '/'
            return
          }

          // Setup real-time listener for products
          setupProductsListener()
        } else {
          // User document doesn't exist
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking user status:', error)
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  // Setup real-time listener for products
  const setupProductsListener = () => {
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[]

        // Sort by creation date (newest first)
        const sortedProducts = productsData.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0
          const bTime = b.createdAt?.seconds || 0
          return bTime - aTime
        })

        setProducts(sortedProducts)

        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(productsData.map((p) => p.category).filter(Boolean))
        )

        setCategories(uniqueCategories)

        // Calculate stats
        calculateStats(sortedProducts)

        setLoading(false)
      },
      (error) => {
        console.error('Error listening to products:', error)
        showError('Failed to load products. Please refresh the page.')
        setLoading(false)
      }
    )

    return unsubscribe
  }

  // Calculate product statistics
  const calculateStats = (products: Product[]) => {
    const totalProducts = products.length
    const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)
    const lowStock = products.filter((p) => p.stock < 20 && p.stock > 0).length
    const outOfStock = products.filter((p) => p.stock === 0).length

    setStats({
      totalProducts,
      totalValue,
      lowStock,
      outOfStock,
    })
  }

  // Apply filters whenever products or filters change
  useEffect(() => {
    applyFilters()
  }, [products, filters])

  const applyFilters = () => {
    let result = [...products]

    // Apply category filter
    if (filters.category !== 'all') {
      result = result.filter(
        (product) => product.category?.toLowerCase() === filters.category.toLowerCase()
      )
    }

    // Apply location filter
    if (filters.rdcLocation !== 'all') {
      result = result.filter(
        (product) => product.rdcLocation?.toLowerCase() === filters.rdcLocation.toLowerCase()
      )
    }

    // Apply stock status filter
    if (filters.stockStatus !== 'all') {
      switch (filters.stockStatus) {
        case 'in-stock':
          result = result.filter((p) => p.stock >= 20)
          break
        case 'low-stock':
          result = result.filter((p) => p.stock < 20 && p.stock > 0)
          break
        case 'out-of-stock':
          result = result.filter((p) => p.stock === 0)
          break
      }
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      result = result.filter(
        (product) =>
          product.name?.toLowerCase().includes(searchTerm) ||
          product.sku?.toLowerCase().includes(searchTerm) ||
          product.description?.toLowerCase().includes(searchTerm) ||
          product.category?.toLowerCase().includes(searchTerm)
      )
    }

    setFilteredProducts(result)
  }

  const handleFilterChange = (key: keyof ProductFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return

    try {
      setDeleting(true)

      // Delete product document from Firestore
      await deleteDoc(doc(db, 'products', productToDelete.id))

      // Log audit action
      await logAuditAction(
        'Delete Product',
        `Product ID: ${productToDelete.id} (${productToDelete.name}) deleted. SKU: ${productToDelete.sku}, Category: ${productToDelete.category}`,
        productToDelete.id,
        productToDelete.sku
      )

      // Update local state
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id))

      // Close modal
      setShowDeleteModal(false)
      setProductToDelete(null)

      // Show success message
      showSuccess(`Product "${productToDelete.name}" deleted successfully!`)
    } catch (error: any) {
      console.error('Error deleting product:', error)
      showError(error.message || 'Failed to delete product. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditClick = (product: Product) => {
    setProductToEdit(product)
    setEditForm({
      name: product.name || '',
      category: product.category || '',
      price: product.price || 0,
      stock: product.stock || 0,
      imageURL: product.imageURL || '',
      description: product.description || '',
      rdcLocation: product.rdcLocation || '',
      sku: product.sku || '',
    })
    setShowEditModal(true)
    setError('')
    setUploadError('')
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productToEdit) return

    // Validate form
    if (!editForm.name.trim()) {
      setError('Product name is required')
      return
    }
    if (editForm.price <= 0) {
      setError('Price must be greater than 0')
      return
    }
    if (editForm.stock < 0) {
      setError('Stock cannot be negative')
      return
    }
    if (!editForm.category.trim()) {
      setError('Category is required')
      return
    }
    if (!editForm.rdcLocation.trim()) {
      setError('RDC Location is required')
      return
    }

    try {
      setEditing(true)
      setError('')

      const productRef = doc(db, 'products', productToEdit.id)
      await updateDoc(productRef, {
        ...editForm,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        updatedAt: new Date(),
      })

      // Log audit action
      const changedFields = []
      if (editForm.name !== productToEdit.name) changedFields.push('name')
      if (editForm.price !== productToEdit.price)
        changedFields.push(`price (${productToEdit.price} → ${editForm.price})`)
      if (editForm.stock !== productToEdit.stock)
        changedFields.push(`stock (${productToEdit.stock} → ${editForm.stock})`)
      if (editForm.category !== productToEdit.category)
        changedFields.push(`category (${productToEdit.category} → ${editForm.category})`)
      if (editForm.rdcLocation !== productToEdit.rdcLocation)
        changedFields.push(`location (${productToEdit.rdcLocation} → ${editForm.rdcLocation})`)

      await logAuditAction(
        'Update Product',
        `Product ID: ${productToEdit.id} (${editForm.name}) updated. Changes: ${changedFields.join(', ')}. SKU: ${editForm.sku}`,
        productToEdit.id,
        editForm.sku
      )

      // Update local state
      setProducts((prev) =>
        prev.map((p) => (p.id === productToEdit.id ? { ...p, ...editForm } : p))
      )

      // Close modal
      setShowEditModal(false)
      setProductToEdit(null)
      setEditForm({
        name: '',
        category: '',
        price: 0,
        stock: 0,
        imageURL: '',
        description: '',
        rdcLocation: '',
        sku: '',
      })

      // Show success message
      showSuccess(`Product "${editForm.name}" updated successfully!`)
    } catch (error) {
      console.error('Error updating product:', error)
      setError('Failed to update product. Please try again.')
    } finally {
      setEditing(false)
    }
  }

  // Handle image upload for add product
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      setUploadError('')

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type)) {
        throw new Error('Please upload a valid image file (JPEG, PNG, WebP, or GIF)')
      }

      // Convert image to WebP base64 using avatar64
      const result = await fileToWebpBase64(file, {
        maxSize: 800,
        quality: 0.85,
        allowedMime: validTypes,
        maxInputBytes: 10 * 1024 * 1024,
      })

      // Set the image URL in the add form
      setAddForm((prev) => ({
        ...prev,
        imageURL: result.dataUrl,
      }))

      console.log(`Image converted: ${result.width}x${result.height}, ${result.decodedBytes} bytes`)
    } catch (error: any) {
      console.error('Image upload failed:', error)
      setUploadError(error.message || 'Failed to upload image. Please try again.')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setUploadingImage(false)
    }
  }

  // Handle image upload for edit product
  const handleImageUploadEdit = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingImage(true)
      setUploadError('')

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type)) {
        throw new Error('Please upload a valid image file (JPEG, PNG, WebP, or GIF)')
      }

      // Convert image to WebP base64 using avatar64
      const result = await fileToWebpBase64(file, {
        maxSize: 800,
        quality: 0.85,
        allowedMime: validTypes,
        maxInputBytes: 10 * 1024 * 1024,
      })

      // Set the image URL in the edit form
      setEditForm((prev) => ({
        ...prev,
        imageURL: result.dataUrl,
      }))

      console.log(`Image converted: ${result.width}x${result.height}, ${result.decodedBytes} bytes`)
    } catch (error: any) {
      console.error('Image upload failed:', error)
      setUploadError(error.message || 'Failed to upload image. Please try again.')
      if (fileInputRefEdit.current) {
        fileInputRefEdit.current.value = ''
      }
    } finally {
      setUploadingImage(false)
    }
  }

  // Trigger file input click for add form
  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  // Trigger file input click for edit form
  const triggerFileInputEdit = () => {
    fileInputRefEdit.current?.click()
  }

  const handleAddClick = () => {
    setShowAddModal(true)
    setError('')
    setUploadError('')
    setAddForm({
      name: '',
      category: '',
      price: 0,
      stock: 0,
      imageURL: '',
      description: '',
      rdcLocation: '',
      sku: '',
    })
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!addForm.name.trim()) {
      setError('Product name is required')
      return
    }
    if (addForm.price <= 0) {
      setError('Price must be greater than 0')
      return
    }
    if (addForm.stock < 0) {
      setError('Stock cannot be negative')
      return
    }
    if (!addForm.category.trim()) {
      setError('Category is required')
      return
    }
    if (!addForm.rdcLocation.trim()) {
      setError('RDC Location is required')
      return
    }

    try {
      setAdding(true)
      setError('')

      // Generate SKU if not provided
      const finalSku =
        addForm.sku.trim() ||
        `${addForm.category.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

      // Extract base64 from data URL if present
      let finalImageURL = addForm.imageURL
      if (addForm.imageURL.startsWith('data:image/webp;base64,')) {
        finalImageURL = addForm.imageURL
      } else if (addForm.imageURL) {
        finalImageURL = addForm.imageURL
      }

      // Add product to Firestore
      const docRef = await addDoc(collection(db, 'products'), {
        ...addForm,
        sku: finalSku,
        imageURL: finalImageURL,
        price: Number(addForm.price),
        stock: Number(addForm.stock),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Log audit action
      await logAuditAction(
        'Create Product',
        `Product ID: ${docRef.id} (${addForm.name}) created. SKU: ${finalSku}, Price: ${addForm.price}, Stock: ${addForm.stock}, Category: ${addForm.category}, Location: ${addForm.rdcLocation}`,
        docRef.id,
        finalSku
      )

      // Close modal
      setShowAddModal(false)
      setAddForm({
        name: '',
        category: '',
        price: 0,
        stock: 0,
        imageURL: '',
        description: '',
        rdcLocation: '',
        sku: '',
      })

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Show success message
      showSuccess(`Product "${addForm.name}" added successfully!`)
    } catch (error) {
      console.error('Error adding product:', error)
      setError('Failed to add product. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  // Get stock badge class
  const getStockBadgeClass = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800 border border-red-200'
    if (stock < 5) return 'bg-red-50 text-red-700 border border-red-100'
    if (stock < 10) return 'bg-orange-50 text-orange-700 border border-orange-100'
    if (stock < 20) return 'bg-yellow-50 text-yellow-700 border border-yellow-100'
    return 'bg-green-50 text-green-700 border border-green-100'
  }

  // Get stock text
  const getStockText = (stock: number) => {
    if (stock === 0) return 'Out of Stock'
    if (stock < 5) return `${stock} units (CRITICAL)`
    if (stock < 10) return `${stock} units (VERY LOW)`
    if (stock < 20) return `${stock} units (LOW)`
    return `${stock} units`
  }

  // Get stock icon
  const getStockIcon = (stock: number) => {
    if (stock === 0) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    } else if (stock < 5) {
      return (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="w-4 h-4 text-orange-500"
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
          className="w-4 h-4 text-yellow-500"
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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Get category badge color
  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      electronics: 'bg-blue-100 text-blue-800',
      clothing: 'bg-purple-100 text-purple-800',
      home: 'bg-green-100 text-green-800',
      kitchen: 'bg-orange-100 text-orange-800',
      sports: 'bg-red-100 text-red-800',
      books: 'bg-indigo-100 text-indigo-800',
      beauty: 'bg-pink-100 text-pink-800',
      toys: 'bg-cyan-100 text-cyan-800',
    }

    return colors[category?.toLowerCase()] || 'bg-gray-100 text-gray-800'
  }

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

  // Determine which navbar to show
  const getNavbar = () => {
    if (isAdmin) {
      return <AdminNavbar />
    } else if (isHOManager) {
      return <HOManagerNavbar />
    } else if (isRDCStaff) {
      return <RDCNavbar />
    }
    return <AdminNavbar /> // Default fallback
  }

  // Get page title based on role
  const getPageTitle = () => {
    if (isAdmin) {
      return 'Manage Products'
    } else if (isHOManager) {
      return 'Inventory Management'
    } else if (isRDCStaff) {
      return 'RDC Product Management'
    }
    return 'Products'
  }

  // Get page description based on role
  const getPageDescription = () => {
    if (isAdmin) {
      return 'View and manage all products in inventory'
    } else if (isHOManager) {
      return 'Monitor and manage inventory stock levels'
    } else if (isRDCStaff) {
      return 'Manage products at your RDC location'
    }
    return 'Manage products'
  }

  // If not authorized, show loading or redirect
  if (!isAdmin && !isHOManager && !isRDCStaff && loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin && !isHOManager && !isRDCStaff) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      {getNavbar()}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{getPageTitle()}</h1>
              <p className="text-gray-600 mt-2">{getPageDescription()}</p>
            </div>
            <button
              onClick={handleAddClick}
              className="px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-500 to-cyan-600 text-white text-sm font-bold hover:from-blue-600 hover:to-cyan-700 transition shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add New Product
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">In inventory</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inventory Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatCurrency(stats.totalValue)}
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
              <span className="text-xs text-gray-500">Total stock value</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock Alert</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.lowStock}</p>
              </div>
              <div className="w-12 h-12 bg-linear-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-yellow-600"
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
              <span className="text-xs text-gray-500">&lt; 20 units</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.outOfStock}</p>
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Need restocking</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Products
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
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
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                  placeholder="Search by name, SKU, category..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                aria-label="Filter by category"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">RDC Location</label>
              <select
                value={filters.rdcLocation}
                onChange={(e) => handleFilterChange('rdcLocation', e.target.value)}
                aria-label="Filter by RDC location"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
              >
                <option value="all">All Locations</option>
                {fixedRdcLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
              <select
                value={filters.stockStatus}
                onChange={(e) => handleFilterChange('stockStatus', e.target.value)}
                aria-label="Filter by stock status"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
              >
                <option value="all">All Stock Status</option>
                <option value="in-stock">In Stock (≥20)</option>
                <option value="low-stock">Low Stock (&lt;20)</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() =>
                setFilters({
                  category: 'all',
                  rdcLocation: 'all',
                  search: '',
                  stockStatus: 'all',
                })
              }
              className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Products ({filteredProducts.length})
            </h2>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Critical (&lt;5)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Very Low (&lt;10)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Low (&lt;20)</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
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
              <p className="text-gray-400 text-sm mt-1">
                Try changing your filters or add a new product
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price & Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-gray-50 transition ${
                        product.stock < 5
                          ? 'bg-red-50'
                          : product.stock < 10
                            ? 'bg-orange-50'
                            : product.stock < 20
                              ? 'bg-yellow-50'
                              : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-12 w-12 shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={product.imageURL || 'https://via.placeholder.com/100'}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src =
                                  'https://via.placeholder.com/100?text=No+Image'
                              }}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-sm text-gray-500">SKU: {product.sku || 'N/A'}</div>
                            <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">
                              {product.description || 'No description'}
                            </div>
                          </div>
                        </div>
                       </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(product.category)}`}
                        >
                          {product.category || 'Uncategorized'}
                        </span>
                       </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(product.price)}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {getStockIcon(product.stock)}
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockBadgeClass(product.stock)}`}
                          >
                            {getStockText(product.stock)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Value: {formatCurrency(product.price * product.stock)}
                        </div>
                       </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{product.rdcLocation || 'N/A'}</div>
                        <div className="text-xs text-gray-500">
                          {formatTimestamp(product.createdAt)}
                        </div>
                       </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEditClick(product)}
                            className="text-blue-600 hover:text-blue-900 transition flex items-center gap-1"
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
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleDeleteClick(product)}
                            className="text-red-600 hover:text-red-900 transition flex items-center gap-1"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </button>
                          {product.stock < 20 && (
                            <>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => handleEditClick(product)}
                                className="text-green-600 hover:text-green-900 transition flex items-center gap-1"
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
                              </button>
                            </>
                          )}
                        </div>
                       </td>
                     </tr>
                  ))}
                </tbody>
               </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal with Blur */}
        {showDeleteModal && productToDelete && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => !deleting && setShowDeleteModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    aria-label="Close"
                    className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-16 w-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={productToDelete.imageURL || 'https://via.placeholder.com/100'}
                        alt={productToDelete.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Image'
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{productToDelete.name}</p>
                      <p className="text-sm text-gray-600">SKU: {productToDelete.sku || 'N/A'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStockBadgeClass(productToDelete.stock)}`}
                        >
                          {getStockText(productToDelete.stock)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(productToDelete.category)}`}
                        >
                          {productToDelete.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600">
                    Are you sure you want to delete this product? This action cannot be undone. All
                    order history and references to this product will be affected.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className="px-4 py-2 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete Product'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit Product Modal with Blur */}
        {showEditModal && productToEdit && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowEditModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Edit Product</h3>
                    <button
                      onClick={() => setShowEditModal(false)}
                      aria-label="Close"
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <svg
                        className="w-5 h-5"
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
                    </button>
                  </div>

                  {(error || uploadError) && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-600 text-sm">{error || uploadError}</p>
                    </div>
                  )}

                  <form onSubmit={handleEditSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="Enter product name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            SKU
                          </label>
                          <input
                            type="text"
                            value={editForm.sku}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, sku: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            placeholder="Enter SKU"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category *
                          </label>
                          <input
                            type="text"
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, category: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="e.g., Electronics, Clothing"
                            list="categories"
                          />
                          <datalist id="categories">
                            {categories.map((cat) => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Price (LKR) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.price}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                price: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Stock Quantity *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.stock}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                stock: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            RDC Location *
                          </label>
                          <select
                            value={editForm.rdcLocation}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, rdcLocation: e.target.value }))
                            }
                            aria-label="Select RDC location for product"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                          >
                            <option value="">Select Location</option>
                            {fixedRdcLocations.map((location) => (
                              <option key={location} value={location}>
                                {location}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Image Upload Section */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Image
                          </label>
                          <div className="space-y-3">
                            {/* File Upload Button */}
                            <div>
                              <input
                                type="file"
                                ref={fileInputRefEdit}
                                onChange={handleImageUploadEdit}
                                accept="image/*"
                                aria-label="Upload product image"
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={triggerFileInputEdit}
                                disabled={uploadingImage}
                                aria-label="Upload product image"
                                className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {uploadingImage ? (
                                  <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                                    <span>Uploading Image...</span>
                                  </div>
                                ) : (
                                  <>
                                    <svg
                                      className="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                      />
                                    </svg>
                                    <span>Click to upload image</span>
                                    <span className="text-xs text-gray-500">
                                      JPEG, PNG, WebP, GIF (Max 10MB)
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Image URL Input (alternative) */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">
                                Or enter image URL:
                              </label>
                              <input
                                type="url"
                                value={editForm.imageURL}
                                onChange={(e) =>
                                  setEditForm((prev) => ({ ...prev, imageURL: e.target.value }))
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
                                placeholder="https://example.com/image.jpg"
                              />
                            </div>

                            {/* Image Preview */}
                            {editForm.imageURL && editForm.imageURL.startsWith('data:image/') && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                                <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                                  <img
                                    src={editForm.imageURL}
                                    alt="Product preview"
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        'https://via.placeholder.com/400x300?text=Invalid+Image'
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-center">
                                  Image will be stored as WebP Base64 format
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description (Full width) */}
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                        placeholder="Enter product description..."
                      />
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowEditModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={editing || uploadingImage}
                        className="px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {editing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Add Product Modal with Blur */}
        {showAddModal && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowAddModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Add New Product</h3>
                    <button
                      onClick={() => setShowAddModal(false)}
                      aria-label="Close"
                      className="text-gray-400 hover:text-gray-600 transition"
                    >
                      <svg
                        className="w-5 h-5"
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
                    </button>
                  </div>

                  {(error || uploadError) && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-600 text-sm">{error || uploadError}</p>
                    </div>
                  )}

                  <form onSubmit={handleAddSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            value={addForm.name}
                            onChange={(e) =>
                              setAddForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="Enter product name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            SKU
                          </label>
                          <input
                            type="text"
                            value={addForm.sku}
                            onChange={(e) =>
                              setAddForm((prev) => ({ ...prev, sku: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            placeholder="Enter SKU (auto-generated if empty)"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category *
                          </label>
                          <input
                            type="text"
                            value={addForm.category}
                            onChange={(e) =>
                              setAddForm((prev) => ({ ...prev, category: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="e.g., Electronics, Clothing"
                            list="add-categories"
                          />
                          <datalist id="add-categories">
                            {categories.map((cat) => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Price (LKR) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={addForm.price || ''}
                            onChange={(e) =>
                              setAddForm((prev) => ({
                                ...prev,
                                price: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Stock Quantity *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={addForm.stock || ''}
                            onChange={(e) =>
                              setAddForm((prev) => ({
                                ...prev,
                                stock: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                            placeholder="0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            RDC Location *
                          </label>
                          <select
                            value={addForm.rdcLocation}
                            onChange={(e) =>
                              setAddForm((prev) => ({ ...prev, rdcLocation: e.target.value }))
                            }
                            aria-label="Select RDC location for new product"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                            required
                          >
                            <option value="">Select Location</option>
                            {fixedRdcLocations.map((location) => (
                              <option key={location} value={location}>
                                {location}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Image Upload Section */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Image
                          </label>
                          <div className="space-y-3">
                            {/* File Upload Button */}
                            <div>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                aria-label="Upload product image"
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={triggerFileInput}
                                disabled={uploadingImage}
                                aria-label="Upload product image"
                                className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 transition flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {uploadingImage ? (
                                  <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                                    <span>Uploading Image...</span>
                                  </div>
                                ) : (
                                  <>
                                    <svg
                                      className="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                      />
                                    </svg>
                                    <span>Click to upload image</span>
                                    <span className="text-xs text-gray-500">
                                      JPEG, PNG, WebP, GIF (Max 10MB)
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Image URL Input (alternative) */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">
                                Or enter image URL:
                              </label>
                              <input
                                type="url"
                                value={addForm.imageURL}
                                onChange={(e) =>
                                  setAddForm((prev) => ({ ...prev, imageURL: e.target.value }))
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
                                placeholder="https://example.com/image.jpg"
                              />
                            </div>

                            {/* Image Preview */}
                            {addForm.imageURL && addForm.imageURL.startsWith('data:image/') && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-gray-700 mb-2">Preview:</p>
                                <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                                  <img
                                    src={addForm.imageURL}
                                    alt="Product preview"
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        'https://via.placeholder.com/400x300?text=Invalid+Image'
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-center">
                                  Image will be stored as WebP Base64 format
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description (Full width) */}
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={addForm.description}
                        onChange={(e) =>
                          setAddForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                        placeholder="Enter product description..."
                      />
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={adding || uploadingImage}
                        className="px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {adding ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Adding...
                          </>
                        ) : (
                          'Add Product'
                        )}
                      </button>
                    </div>
                  </form>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Success</h3>
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    aria-label="Close"
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
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
                  <p className="text-gray-600 text-center whitespace-pre-line">{modalMessage}</p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="px-4 py-2 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition"
                  >
                    OK
                  </button>
                </div>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Error</h3>
                  <button
                    onClick={() => setShowErrorModal(false)}
                    aria-label="Close"
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
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
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-gray-600 text-center whitespace-pre-line">{modalMessage}</p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowErrorModal(false)}
                    className="px-4 py-2 bg-linear-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}