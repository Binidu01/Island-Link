'use client'

import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore'
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

// ─── Share Modal ─────────────────────────────────────────────────────────────
function ShareModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/product?id=${product.id}`
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(
    `Check out ${product.name} for LKR ${product.price.toLocaleString()}! ${url}`
  )

  function copyLink() {
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
      document.execCommand('copy')
    } catch {}
    document.body.removeChild(textarea)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const socials = [
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedText}`,
      bg: 'bg-green-500',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      bg: 'bg-blue-600',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
    },
    {
      label: 'Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
      bg: 'bg-black',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.848L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`Check out ${product.name} for LKR ${product.price.toLocaleString()}!`)}`,
      bg: 'bg-sky-500',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent(product.name)}&body=${encodedText}`,
      bg: 'bg-gray-500',
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-white stroke-2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Share this product</h3>
          <button
            onClick={onClose}
            aria-label="Close share modal"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
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

        {/* Product preview */}
        <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
          <img
            src={product.imageURL || 'https://via.placeholder.com/64x64?text=Product'}
            alt={product.name}
            className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
            onError={(e) => {
              e.currentTarget.src = 'https://via.placeholder.com/64x64?text=No+Image'
            }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
            <p className="text-sm text-orange-500 font-semibold">
              LKR {product.price.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Social icons */}
        <div className="px-5 py-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-4">
            Share via
          </p>
          <div className="flex gap-3 justify-around">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-12 h-12 rounded-full ${s.bg} flex items-center justify-center shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-150`}
                >
                  {s.icon}
                </div>
                <span className="text-xs text-gray-500 group-hover:text-gray-800 transition">
                  {s.label}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Copy link */}
        <div className="px-5 pb-7">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">
            Or copy link
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <svg
              className="w-4 h-4 text-gray-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span className="flex-1 text-sm text-gray-600 truncate">{url}</span>
            <button
              onClick={copyLink}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-linear-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
              }`}
            >
              {copied ? (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                'Copy'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [addingToWishlist, setAddingToWishlist] = useState<string | null>(null)
  const [shareProduct, setShareProduct] = useState<Product | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user ? user.uid : null)
    })

    fetchProducts()

    const urlParams = new URLSearchParams(window.location.search)
    const searchParam = urlParams.get('search')
    const categoryParam = urlParams.get('category')
    if (searchParam) setSearchTerm(searchParam)
    if (categoryParam) setSelectedCategory(categoryParam)

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (currentUserId) fetchWishlist()
  }, [currentUserId])

  async function fetchProducts() {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'))
      const productsData = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => p.stock > 0) as Product[]

      const productsWithRatings = await Promise.all(
        productsData.map(async (product) => {
          const reviewsQuery = query(
            collection(db, 'reviews'),
            where('productId', '==', product.id)
          )
          const reviewsSnapshot = await getDocs(reviewsQuery)
          if (reviewsSnapshot.empty) return { ...product, rating: 0, reviewCount: 0 }
          let totalRating = 0
          reviewsSnapshot.forEach((doc) => {
            totalRating += (doc.data() as Review).rating
          })
          return {
            ...product,
            rating: Math.round((totalRating / reviewsSnapshot.size) * 10) / 10,
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
        wishlistData.push({ id: doc.id, ...doc.data() } as WishlistItem)
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
      window.location.href = '/login?redirect=/products'
      return
    }
    setAddingToWishlist(product.id)
    try {
      const existingItem = wishlist.find((item) => item.productId === product.id)
      if (existingItem) {
        await deleteDoc(doc(db, 'wishlists', existingItem.id))
        setWishlist((prev) => prev.filter((item) => item.id !== existingItem.id))
      } else {
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
          { id: docRef.id, productId: product.id, userId: currentUserId },
        ])
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error)
      alert('Failed to update wishlist. Please try again.')
    } finally {
      setAddingToWishlist(null)
    }
  }

  function openShare(e: React.MouseEvent, product: Product) {
    e.preventDefault()
    e.stopPropagation()
    setShareProduct(product)
  }

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))]

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

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

  function handleSuggestionClick(productName: string) {
    setSearchTerm(productName)
    setShowSuggestions(false)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      {/* Share Modal */}
      {shareProduct && <ShareModal product={shareProduct} onClose={() => setShareProduct(null)} />}

      <div className="relative mx-auto max-w-7xl px-4 py-6">
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
              <input
                type="text"
                placeholder="Search for products..."
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
                  onClick={() => {
                    setSearchTerm('')
                    setShowSuggestions(false)
                  }}
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
              )}
            </div>

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
              </div>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                  selectedCategory === category
                    ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {searchTerm
              ? `Search Results for "${searchTerm}"`
              : selectedCategory !== 'All'
                ? `${selectedCategory} Products`
                : 'All Products'}
          </h2>
          <p className="text-sm text-gray-500">
            {loading
              ? 'Loading...'
              : `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <svg
              className="w-20 h-20 mx-auto text-gray-300 mb-4"
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
            <p className="text-gray-500 text-lg mb-2 font-medium">No products found</p>
            <p className="text-sm text-gray-400">
              Try adjusting your search or browse all categories
            </p>
            <div className="flex gap-3 justify-center mt-4">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-6 py-2 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-500 hover:to-blue-600 transition"
                >
                  Clear Search
                </button>
              )}
              {selectedCategory !== 'All' && (
                <button
                  onClick={() => setSelectedCategory('All')}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  View All Categories
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredProducts.map((product) => {
              const inWishlist = isInWishlist(product.id)
              const isProcessing = addingToWishlist === product.id

              return (
                <a
                  key={product.id}
                  href={`/product?id=${product.id}`}
                  className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-100"
                >
                  <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
                    <img
                      src={product.imageURL || 'https://via.placeholder.com/400x400?text=Product'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/400x400?text=No+Image'
                      }}
                    />

                    {/* Action buttons — wishlist + share */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {/* Wishlist */}
                      <button
                        onClick={(e) => toggleWishlist(e, product)}
                        disabled={isProcessing}
                        title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                        className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                      >
                        {isProcessing ? (
                          <svg
                            className="w-4 h-4 text-gray-400 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className={`w-4 h-4 ${inWishlist ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-500'}`}
                            fill={inWishlist ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
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

                      {/* Share */}
                      <button
                        onClick={(e) => openShare(e, product)}
                        title="Share product"
                        className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                      >
                        <svg
                          className="w-4 h-4 text-gray-400 hover:text-cyan-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      {product.category}
                    </div>

                    <h3 className="font-medium text-sm text-gray-900 line-clamp-2 min-h-10 leading-tight group-hover:text-cyan-600 transition">
                      {product.name}
                    </h3>

                    <div className="pt-1 border-t border-gray-100">
                      <div className="text-orange-500 font-bold text-lg">
                        LKR {product.price.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <svg
                            className="w-3 h-3 text-yellow-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs text-gray-500">
                            {product.rating ? product.rating.toFixed(1) : '0.0'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{product.stock} left</span>
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
  )
}
