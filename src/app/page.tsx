'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  query,
  limit,
  where,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth, db } from '../lib/firebase'

interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  imageURL: string
  description: string
  rdcLocation: string
  rating?: number
  reviewCount?: number
}

interface Review {
  productId: string
  rating: number
}

interface WishlistItem {
  id: string
  productId: string
  userId: string
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [currentBanner, setCurrentBanner] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [addingToWishlist, setAddingToWishlist] = useState<string | null>(null)

  const banners = [
    {
      title: 'Welcome to IslandLink',
      subtitle: 'Your Trusted Distribution Network',
      bgColor: 'bg-white',
      textColor: 'text-gray-900',
      gradientText: true,
    },
    {
      title: 'New Arrivals',
      subtitle: 'Fresh Products Every Day',
      bgColor: 'bg-linear-to-r from-cyan-50 to-blue-50',
      textColor: 'text-gray-900',
      gradientText: false,
    },
    {
      title: 'Flash Deals',
      subtitle: 'Limited Time Offers',
      bgColor: 'bg-linear-to-r from-orange-50 to-orange-100',
      textColor: 'text-gray-900',
      gradientText: false,
    },
  ]

  useEffect(() => {
    // Check user authentication and role
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCheckingAuth(true)
      if (user) {
        setCurrentUserId(user.uid)
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            const data = userDoc.data()
            const role = data.role || 'customer'
            setUserRole(role)

            // Redirect non-customer users to their respective dashboards
            if (role !== 'customer') {
              redirectBasedOnRole(role)
              return
            }
          } else {
            setUserRole('customer')
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          setUserRole('customer')
        }
      } else {
        setUserRole(null)
        setCurrentUserId(null)
      }
      setCheckingAuth(false)
    })

    fetchProducts()

    // Auto-rotate banners
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 5000)

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (currentUserId) {
      fetchWishlist()
    }
  }, [currentUserId])

  function redirectBasedOnRole(role: string) {
    switch (role) {
      case 'RDC Staff':
        window.location.href = '/rdc'
        break
      case 'Logistics Team':
        window.location.href = '/logistics'
        break
      case 'HO Manager':
        window.location.href = '/manager'
        break
      case 'admin':
        window.location.href = '/admin'
        break
      default:
        break
    }
  }

  async function fetchProducts() {
    try {
      const q = query(collection(db, 'products'), limit(30))
      const querySnapshot = await getDocs(q)
      const productsData = querySnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((p: any) => p.stock > 0) as Product[]

      // Fetch reviews and calculate ratings for each product
      const productsWithRatings = await Promise.all(
        productsData.map(async (product) => {
          const reviewsQuery = query(
            collection(db, 'reviews'),
            where('productId', '==', product.id)
          )
          const reviewsSnapshot = await getDocs(reviewsQuery)

          if (reviewsSnapshot.empty) {
            return { ...product, rating: 0, reviewCount: 0 }
          }

          let totalRating = 0
          reviewsSnapshot.forEach((doc) => {
            const reviewData = doc.data() as Review
            totalRating += reviewData.rating
          })

          const avgRating = totalRating / reviewsSnapshot.size

          return {
            ...product,
            rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
            reviewCount: reviewsSnapshot.size,
          }
        })
      )

      setProducts(productsWithRatings)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchWishlist() {
    try {
      if (!currentUserId) return

      const q = query(collection(db, 'wishlists'), where('userId', '==', currentUserId))
      const querySnapshot = await getDocs(q)

      const wishlistData: WishlistItem[] = []
      querySnapshot.forEach((doc) => {
        wishlistData.push({
          id: doc.id,
          ...doc.data(),
        } as WishlistItem)
      })

      setWishlist(wishlistData)
    } catch (error) {
      console.error('Error fetching wishlist:', error)
    }
  }

  function isInWishlist(productId: string): boolean {
    return wishlist.some((item) => item.productId === productId)
  }

  async function toggleWishlist(e: React.MouseEvent, product: Product) {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUserId) {
      // Redirect to login if not authenticated
      window.location.href = '/login?redirect=/'
      return
    }

    setAddingToWishlist(product.id)

    try {
      const existingItem = wishlist.find((item) => item.productId === product.id)

      if (existingItem) {
        // Remove from wishlist
        await deleteDoc(doc(db, 'wishlists', existingItem.id))
        setWishlist((prev) => prev.filter((item) => item.id !== existingItem.id))
      } else {
        // Add to wishlist
        const docRef = await addDoc(collection(db, 'wishlists'), {
          userId: currentUserId,
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          productImage: product.imageURL,
          createdAt: new Date(),
        })

        setWishlist((prev) => [
          ...prev,
          {
            id: docRef.id,
            productId: product.id,
            userId: currentUserId,
          },
        ])
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error)
      alert('Failed to update wishlist. Please try again.')
    } finally {
      setAddingToWishlist(null)
    }
  }

  const categories = [
    { name: 'Electric', icon: '📱' },
    { name: 'Clothing', icon: '👕' },
    { name: 'Food', icon: '🍔' },
    { name: 'Books', icon: '📚' },
    { name: 'Home', icon: '🏠' },
    { name: 'Sports', icon: '⚽' },
    { name: 'Beauty', icon: '💄' },
    { name: 'Toys', icon: '🧸' },
  ]

  // Get search suggestions
  const suggestions =
    searchTerm.length > 0
      ? products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.category.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .slice(0, 8)
      : []

  // Handle search submit
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchTerm.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchTerm)}`
    }
  }

  // Handle suggestion click
  function handleSuggestionClick(productName: string) {
    window.location.href = `/products?search=${encodeURIComponent(productName)}`
  }

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect non-customer users
  if (userRole && userRole !== 'customer') {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      {/* Hero Carousel */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="relative h-100 rounded-2xl overflow-hidden shadow-lg border border-gray-200">
          {banners.map((banner, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-500 ${
                index === currentBanner ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div
                className={`w-full h-full ${banner.bgColor} flex items-center justify-between px-16`}
              >
                <div>
                  <h1
                    className={`text-5xl font-bold mb-4 ${
                      banner.gradientText
                        ? 'bg-linear-to-r from-orange-500 via-cyan-500 to-green-500 bg-clip-text text-transparent'
                        : banner.textColor
                    }`}
                  >
                    {banner.title}
                  </h1>
                  <p className={`text-2xl mb-8 ${banner.textColor} opacity-70`}>
                    {banner.subtitle}
                  </p>
                  <button className="px-8 py-4 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-bold hover:from-cyan-500 hover:to-blue-600 transition shadow-lg">
                    Shop Now
                  </button>
                </div>
                <div>
                  <img
                    src="/favicon.png"
                    alt="IslandLink"
                    className="w-64 h-64 object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Banner Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBanner(index)}
                aria-label={`Go to banner ${index + 1}`}
                className={`h-2 rounded-full transition ${
                  index === currentBanner ? 'bg-cyan-500 w-8' : 'bg-gray-300 w-2'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="max-w-3xl mx-auto relative">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
                <input
                  type="text"
                  placeholder="Search in IslandLink..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full px-5 py-3 pl-12 pr-12 rounded-lg bg-gray-50 border border-gray-200 outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-gray-900"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('')
                      setShowSuggestions(false)
                    }}
                    aria-label="Clear search"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </form>

            {/* Search Suggestions Dropdown */}
            {showSuggestions && searchTerm && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSuggestionClick(product.name)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition text-left"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400"
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
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.category}</div>
                    </div>
                    <div className="text-sm font-semibold text-orange-600">
                      LKR {product.price.toLocaleString()}
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => handleSearch({ preventDefault: () => {} } as any)}
                  className="w-full p-3 text-sm font-medium text-cyan-600 hover:bg-gray-50 border-t border-gray-200 text-center"
                >
                  See all results for "{searchTerm}" →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Categories</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
            {categories.map((category) => (
              <a
                key={category.name}
                href={`/products?category=${category.name}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="w-16 h-16 bg-linear-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-3xl hover:scale-110 transition">
                  {category.icon}
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">
                  {category.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Just For You */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Just For You</h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {products.map((product) => {
                const inWishlist = isInWishlist(product.id)
                const isProcessing = addingToWishlist === product.id

                return (
                  <a
                    key={product.id}
                    href={`/product?id=${product.id}`}
                    className="group bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-all overflow-hidden"
                  >
                    <div className="relative aspect-square bg-gray-50">
                      <img
                        src={product.imageURL || 'https://via.placeholder.com/400'}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/400?text=No+Image'
                        }}
                      />
                      <button
                        onClick={(e) => toggleWishlist(e, product)}
                        disabled={isProcessing}
                        aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                        className={`absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md ${
                          isProcessing ? 'cursor-wait' : ''
                        }`}
                      >
                        {isProcessing ? (
                          <svg
                            className="w-4 h-4 text-gray-400 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        ) : (
                          <svg
                            className={`w-4 h-4 ${inWishlist ? 'text-red-500 fill-red-500' : 'text-gray-400'} hover:text-red-500`}
                            fill={inWishlist ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="p-3">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 min-h-10 mb-2 group-hover:text-cyan-600 transition">
                        {product.name}
                      </h3>
                      <div className="text-orange-600 font-bold text-lg">
                        LKR {product.price.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <svg
                            className="w-3 h-3 text-yellow-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs text-gray-500">
                            {product.rating ? product.rating.toFixed(1) : '0.0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
