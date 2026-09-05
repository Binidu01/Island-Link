import { onAuthStateChanged, User } from 'firebase/auth'
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import CustomerNavbar from '../components/customernavbar'
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
  sku?: string
}

interface Review {
  id: string
  productId: string
  userId: string
  userEmail: string
  rating: number
  review: string
  createdAt: any
  helpful: number
  productName?: string
  orderId?: string
  updatedAt?: any
  userName?: string
}

interface Question {
  id: string
  productId: string
  question: string
  answer?: string
  askedBy: string
  answeredBy?: string
  createdAt: any
  answeredAt?: any
  userId?: string
  answeredByUserId?: string
}

interface UserProfile {
  id: string
  photoURL?: string
  fullName?: string
  email?: string
  displayName?: string
  phone?: string
  address?: string
  city?: string
  postalCode?: string
  rdc?: string
  role?: string
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

export default function ProductDetailsPage() {
  const [productId, setProductId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    setProductId(id)
  }, [])

  const [user, setUser] = useState<User | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)

  const [reviews, setReviews] = useState<Review[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map())
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [loadingUserProfiles, setLoadingUserProfiles] = useState<Set<string>>(new Set())

  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [modalType, setModalType] = useState<'success' | 'error' | 'info'>('info')
  const [isInWishlist, setIsInWishlist] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  const [helpfulVotes, setHelpfulVotes] = useState<Set<string>>(new Set())

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (productId) {
      fetchProduct(productId)
      fetchReviews(productId)
      fetchQuestions(productId)
      checkWishlist()
    }
  }, [productId, user])

  async function checkWishlist() {
    if (!user || !productId) {
      setIsInWishlist(false)
      return
    }

    try {
      const q = query(
        collection(db, 'wishlists'),
        where('userId', '==', user.uid),
        where('productId', '==', productId)
      )
      const querySnapshot = await getDocs(q)
      setIsInWishlist(!querySnapshot.empty)
    } catch (error) {
      console.error('Error checking wishlist:', error)
    }
  }

  async function fetchProduct(id: string) {
    try {
      setLoading(true)
      const docRef = doc(db, 'products', id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const productData = { id: docSnap.id, ...docSnap.data() } as Product
        setProduct(productData)
      } else {
        setProduct(null)
      }
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserProfile(userId: string) {
    if (loadingUserProfiles.has(userId) || userProfiles.has(userId)) {
      return
    }

    try {
      loadingUserProfiles.add(userId)

      const userRef = doc(db, 'users', userId)
      const userSnap = await getDoc(userRef)

      if (userSnap.exists()) {
        const userData = userSnap.data()

        const profile: UserProfile = {
          id: userId,
          photoURL: userData.photoURL,
          fullName: userData.fullName || userData.displayName || userData.name,
          displayName: userData.displayName || userData.name,
          email: userData.email,
          phone: userData.phone,
          address: userData.address,
          city: userData.city,
          postalCode: userData.postalCode,
          rdc: userData.rdc,
          role: userData.role,
        }

        setUserProfiles((prev) => {
          const newMap = new Map(prev)
          newMap.set(userId, profile)
          return newMap
        })
      } else {
        const profile: UserProfile = {
          id: userId,
          fullName: userId.substring(0, 8) + '...',
          email: userId,
        }

        setUserProfiles((prev) => {
          const newMap = new Map(prev)
          newMap.set(userId, profile)
          return newMap
        })
      }
    } catch (error) {
      console.error(`Error fetching user profile for ${userId}:`, error)
      const profile: UserProfile = {
        id: userId,
        fullName: userId.substring(0, 8) + '...',
        email: userId,
      }

      setUserProfiles((prev) => {
        const newMap = new Map(prev)
        newMap.set(userId, profile)
        return newMap
      })
    } finally {
      loadingUserProfiles.delete(userId)
    }
  }

  async function fetchReviews(productId: string) {
    try {
      setLoadingReviews(true)

      const q = query(collection(db, 'reviews'), where('productId', '==', productId))

      const querySnapshot = await getDocs(q)

      const reviewsData: Review[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()

        const review: Review = {
          id: doc.id,
          productId: data.productId,
          userId: data.userId,
          userEmail: data.userEmail,
          rating: data.rating,
          review: data.review,
          createdAt: data.createdAt,
          helpful: data.helpful || 0,
          productName: data.productName,
          orderId: data.orderId,
          updatedAt: data.updatedAt,
          userName: data.userEmail?.split('@')[0],
        }

        reviewsData.push(review)
      })

      const userIds = new Set<string>()
      reviewsData.forEach((review) => {
        if (review.userId && !userProfiles.has(review.userId)) {
          userIds.add(review.userId)
        }
      })

      if (userIds.size > 0) {
        await Promise.all(Array.from(userIds).map((userId) => fetchUserProfile(userId)))
      }

      const sortedReviews = reviewsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt).getTime()
        const dateB = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt).getTime()
        return dateB - dateA
      })

      setReviews(sortedReviews)
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoadingReviews(false)
    }
  }

  async function fetchQuestions(productId: string) {
    try {
      setLoadingQuestions(true)
      const q = query(collection(db, 'productQuestions'), where('productId', '==', productId))
      const querySnapshot = await getDocs(q)

      const questionsData: Question[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const question: Question = {
          id: doc.id,
          productId: data.productId,
          question: data.question,
          answer: data.answer,
          askedBy: data.askedBy,
          answeredBy: data.answeredBy,
          createdAt: data.createdAt,
          answeredAt: data.answeredAt,
          userId: data.userId,
          answeredByUserId: data.answeredByUserId || data.answeredByUid || data.answeredUserId,
        }
        questionsData.push(question)
      })

      const userIds = new Set<string>()
      questionsData.forEach((question) => {
        if (question.userId && !userProfiles.has(question.userId)) {
          userIds.add(question.userId)
        }
        if (question.answeredByUserId && !userProfiles.has(question.answeredByUserId)) {
          userIds.add(question.answeredByUserId)
        }
      })

      if (userIds.size > 0) {
        await Promise.all(Array.from(userIds).map((userId) => fetchUserProfile(userId)))
      }

      for (const question of questionsData) {
        if (
          question.answeredBy &&
          question.answeredBy.includes('@') &&
          !question.answeredByUserId
        ) {
          const q = query(collection(db, 'users'), where('email', '==', question.answeredBy))
          const querySnapshot = await getDocs(q)
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0]
            question.answeredByUserId = userDoc.id
            if (!userProfiles.has(userDoc.id)) {
              await fetchUserProfile(userDoc.id)
            }
          }
        }
      }

      const sortedQuestions = questionsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt).getTime()
        const dateB = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt).getTime()
        return dateB - dateA
      })

      setQuestions(sortedQuestions)
    } catch (error) {
      console.error('Error fetching questions:', error)
    } finally {
      setLoadingQuestions(false)
    }
  }

  async function handleHelpfulVote(reviewId: string) {
    if (!user) {
      setModalMessage('Please login to vote')
      setModalType('info')
      setShowModal(true)
      setTimeout(() => {
        window.location.href =
          '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
      }, 2000)
      return
    }

    if (helpfulVotes.has(reviewId)) {
      setModalMessage("You've already voted for this review")
      setModalType('info')
      setShowModal(true)
      return
    }

    try {
      const reviewRef = doc(db, 'reviews', reviewId)
      const reviewDoc = await getDoc(reviewRef)

      if (reviewDoc.exists()) {
        const currentHelpful = reviewDoc.data().helpful || 0
        await updateDoc(reviewRef, {
          helpful: currentHelpful + 1,
          updatedAt: serverTimestamp(),
        })

        setReviews((prev) =>
          prev.map((review) =>
            review.id === reviewId ? { ...review, helpful: (review.helpful || 0) + 1 } : review
          )
        )

        setHelpfulVotes((prev) => new Set(prev).add(reviewId))
      }
    } catch (error) {
      console.error('Error updating helpful vote:', error)
      setModalMessage('Failed to register vote')
      setModalType('error')
      setShowModal(true)
    }
  }

  async function submitQuestion() {
    if (!user) {
      setModalMessage('Please login to ask a question')
      setModalType('info')
      setShowModal(true)
      setTimeout(() => {
        window.location.href =
          '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
      }, 2000)
      return
    }

    if (!newQuestion.trim() || !productId) {
      setModalMessage('Please enter a question')
      setModalType('error')
      setShowModal(true)
      return
    }

    try {
      setSubmitting(true)
      await addDoc(collection(db, 'productQuestions'), {
        productId,
        question: newQuestion.trim(),
        askedBy: user.displayName || user.email,
        userId: user.uid,
        createdAt: serverTimestamp(),
      })

      setNewQuestion('')
      setShowQuestionForm(false)
      fetchQuestions(productId)
      setModalMessage('Question submitted successfully!')
      setModalType('success')
      setShowModal(true)
    } catch (error) {
      console.error('Error submitting question:', error)
      setModalMessage('Failed to submit question. Please try again.')
      setModalType('error')
      setShowModal(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function addToCart() {
    if (!user) {
      setModalMessage('Please login to add items to cart')
      setModalType('info')
      setShowModal(true)
      setTimeout(() => {
        window.location.href =
          '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
      }, 2000)
      return
    }

    if (!product) return

    try {
      const q = query(
        collection(db, 'carts'),
        where('userId', '==', user.uid),
        where('productId', '==', product.id)
      )
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const cartDoc = querySnapshot.docs[0]
        const existingQuantity = cartDoc.data().quantity || 0
        const cartDocRef = doc(db, 'carts', cartDoc.id)

        await updateDoc(cartDocRef, {
          quantity: existingQuantity + quantity,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'carts'), {
          userId: user.uid,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          imageURL: product.imageURL,
          stock: product.stock,
          createdAt: serverTimestamp(),
        })
      }

      try {
        const localCartKey = 'isdp_cart'
        const existingLocalCart = localStorage.getItem(localCartKey)
        let localCartItems = existingLocalCart ? JSON.parse(existingLocalCart) : []

        const existingLocalItemIndex = localCartItems.findIndex(
          (item: any) => item.productId === product.id
        )

        if (existingLocalItemIndex !== -1) {
          localCartItems[existingLocalItemIndex].quantity += quantity
        } else {
          localCartItems.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            imageURL: product.imageURL,
            stock: product.stock,
          })
        }

        localStorage.setItem(localCartKey, JSON.stringify(localCartItems))
      } catch (localError) {
        console.error('Error updating local cart:', localError)
      }

      window.dispatchEvent(new Event('cartUpdated'))

      setModalMessage(`Added ${quantity} item(s) to cart! 🛒`)
      setModalType('success')
      setShowModal(true)
    } catch (error) {
      console.error('Error adding to cart:', error)
      setModalMessage('Failed to add to cart. Please try again.')
      setModalType('error')
      setShowModal(true)
    }
  }

  async function buyNow() {
    if (!user) {
      setModalMessage('Please login to continue')
      setModalType('info')
      setShowModal(true)
      setTimeout(() => {
        window.location.href =
          '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
      }, 2000)
      return
    }

    if (!product) return

    try {
      const buyNowItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        imageURL: product.imageURL,
        stock: product.stock,
      }

      localStorage.setItem('isdp_buynow_cart', JSON.stringify([buyNowItem]))
      window.location.href = '/checkout?buynow=true'
    } catch (error) {
      console.error('Error processing buy now:', error)
      setModalMessage('Failed to process. Please try again.')
      setModalType('error')
      setShowModal(true)
    }
  }

  async function toggleWishlist() {
    if (!user) {
      setModalMessage('Please login to add items to wishlist')
      setModalType('info')
      setShowModal(true)
      setTimeout(() => {
        window.location.href =
          '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
      }, 2000)
      return
    }

    if (!product) return

    try {
      if (isInWishlist) {
        const q = query(
          collection(db, 'wishlists'),
          where('userId', '==', user.uid),
          where('productId', '==', product.id)
        )
        const querySnapshot = await getDocs(q)

        for (const docSnapshot of querySnapshot.docs) {
          await deleteDoc(doc(db, 'wishlists', docSnapshot.id))
        }

        setIsInWishlist(false)
        setModalMessage('Removed from wishlist')
        setModalType('success')
        setShowModal(true)
      } else {
        await addDoc(collection(db, 'wishlists'), {
          userId: user.uid,
          productId: product.id,
          productName: product.name,
          productImage: product.imageURL,
          productPrice: product.price,
          createdAt: serverTimestamp(),
        })

        setIsInWishlist(true)
        setModalMessage('Added to wishlist! ❤️')
        setModalType('success')
        setShowModal(true)
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error)
      setModalMessage('Failed to update wishlist. Please try again.')
      setModalType('error')
      setShowModal(true)
    }
  }

  function renderStars(rating: number) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  function formatDate(timestamp: any) {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      })
    } catch (error) {
      return ''
    }
  }

  const getAvatarUrl = (name: string) => {
    const encodedName = encodeURIComponent(name)
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = [
      'f97316',
      '3b82f6',
      '8b5cf6',
      '10b981',
      'ef4444',
      'ec4899',
      '6366f1',
      '14b8a6',
      'f59e0b',
      '84cc16',
    ]
    const colorIndex = hash % colors.length
    return `https://ui-avatars.com/api/?name=${encodedName}&background=${colors[colorIndex]}&color=ffffff&bold=true`
  }

  function getUserProfileDisplay(userId: string, displayName?: string) {
    const userProfile = userProfiles.get(userId)
    const name =
      displayName ||
      userProfile?.fullName ||
      userProfile?.displayName ||
      userProfile?.email?.split('@')[0] ||
      'Anonymous'

    if (userProfile?.photoURL && userProfile.photoURL.trim() !== '') {
      return (
        <img
          src={userProfile.photoURL}
          alt={name}
          className="h-10 w-10 rounded-full object-cover object-top border-2 border-white shadow-sm"
          onError={(e) => {
            e.currentTarget.src = getAvatarUrl(name)
          }}
        />
      )
    }

    return (
      <img
        src={getAvatarUrl(name)}
        alt={name}
        className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
      />
    )
  }

  function getDisplayName(userId: string, fallbackName?: string) {
    const userProfile = userProfiles.get(userId)
    return (
      userProfile?.fullName ||
      userProfile?.displayName ||
      userProfile?.email?.split('@')[0] ||
      fallbackName ||
      'Anonymous'
    )
  }

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0

  const ratingDistribution = {
    5: reviews.filter((r) => r.rating === 5).length,
    4: reviews.filter((r) => r.rating === 4).length,
    3: reviews.filter((r) => r.rating === 3).length,
    2: reviews.filter((r) => r.rating === 2).length,
    1: reviews.filter((r) => r.rating === 1).length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <CustomerNavbar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <CustomerNavbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Product Not Found</h1>
          <a href="/products" className="text-cyan-500 hover:text-cyan-600">
            ← Back to Products
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 text-gray-900">
      <CustomerNavbar />

      {/* Share Modal */}
      {showShareModal && <ShareModal product={product} onClose={() => setShowShareModal(false)} />}

      <div className="relative mx-auto max-w-7xl px-4 py-4">
        {/* Main Product Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Image */}
            <div>
              <div className="sticky top-4">
                <div className="aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
                  <img
                    src={product.imageURL || 'https://via.placeholder.com/600x600?text=Product'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/600x600?text=No+Image'
                    }}
                  />
                </div>

                {/* Share & Wishlist */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="flex-1 py-2 border border-gray-300 rounded text-sm hover:border-cyan-600 hover:text-cyan-600 transition flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    Share
                  </button>
                  <button
                    onClick={toggleWishlist}
                    className={`flex-1 py-2 border rounded text-sm transition ${
                      isInWishlist
                        ? 'border-red-500 text-red-500 bg-red-50'
                        : 'border-gray-300 hover:border-cyan-600 hover:text-cyan-600'
                    }`}
                  >
                    {isInWishlist ? '❤️' : '🤍'} Wishlist
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Details */}
            <div>
              <h1 className="text-2xl font-normal mb-3 text-gray-900">{product.name}</h1>

              {/* Rating & Brand */}
              {reviews.length > 0 ? (
                <div className="flex items-center gap-6 mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500 text-sm">
                      {renderStars(Math.round(averageRating))}
                    </span>
                    <span className="text-sm text-gray-600">{averageRating.toFixed(1)}</span>
                  </div>
                  <div className="h-4 w-px bg-gray-300"></div>
                  <div className="text-sm text-gray-600">
                    {reviews.length} Rating{reviews.length !== 1 ? 's' : ''}
                  </div>
                </div>
              ) : (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <span className="text-sm text-gray-500">No ratings yet</span>
                </div>
              )}

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="text-3xl font-normal bg-linear-to-r from-orange-500 via-cyan-500 to-green-500 bg-clip-text text-transparent mb-2">
                  LKR {product.price.toLocaleString()}
                </div>
              </div>

              {/* Delivery Options */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="flex items-start gap-3 mb-3">
                  <svg
                    className="w-5 h-5 text-cyan-500 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium mb-1">Delivery Options</div>
                    <div className="text-sm text-gray-600">
                      {product.rdcLocation} • Standard Delivery
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Cash on Delivery Available</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium mb-1">Return & Warranty</div>
                    <div className="text-sm text-gray-600">7 Days Returns</div>
                    <div className="text-xs text-gray-500 mt-1">Change of mind applicable</div>
                  </div>
                </div>
              </div>

              {/* Quantity */}
              <div className="mb-6">
                <label
                  htmlFor="quantity-input"
                  className="text-sm font-medium mb-2 text-gray-600 block"
                >
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 border border-gray-300 rounded hover:border-gray-400"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <input
                    id="quantity-input"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-8 text-center border border-gray-300 rounded outline-none"
                    min="1"
                    max={product.stock}
                    aria-label="Quantity"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-8 h-8 border border-gray-300 rounded hover:border-gray-400"
                    disabled={quantity >= product.stock}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-600">{product.stock} pieces available</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={addToCart}
                  disabled={product.stock === 0}
                  className="flex-1 px-6 py-3 bg-linear-to-r from-cyan-400 to-cyan-500 text-white font-medium rounded hover:from-cyan-500 hover:to-cyan-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add to Cart
                </button>
                <button
                  onClick={buyNow}
                  disabled={product.stock === 0}
                  className="flex-1 px-6 py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white font-medium rounded hover:from-orange-600 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Description & Specs (2 columns) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
              <h2 className="text-lg font-medium mb-4 bg-linear-to-r from-orange-500 via-cyan-500 to-green-500 bg-clip-text text-transparent">
                Product Details
              </h2>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3">
                  <span className="text-gray-600">Category</span>
                  <span className="col-span-2 text-gray-900">{product.category}</span>
                </div>
                {product.sku && (
                  <div className="grid grid-cols-3">
                    <span className="text-gray-600">SKU</span>
                    <span className="col-span-2 text-gray-900">{product.sku}</span>
                  </div>
                )}
                <div className="grid grid-cols-3">
                  <span className="text-gray-600">Stock</span>
                  <span className="col-span-2 text-gray-900">{product.stock} pieces</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
              <h2 className="text-lg font-medium mb-4">Product Description</h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {product.description || 'No description available for this product.'}
              </div>
            </div>

            {/* Ratings & Reviews */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
              <h2 className="text-lg font-medium mb-4">Ratings & Reviews</h2>

              {loadingReviews ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No reviews available yet</p>
                  <p className="text-sm text-gray-400 mt-2">Be the first to review this product!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-8 mb-6 pb-6 border-b border-gray-200">
                    <div className="text-center">
                      <div className="text-4xl font-medium text-gray-900 mb-1">
                        {averageRating.toFixed(1)}
                        <span className="text-2xl text-gray-400">/5</span>
                      </div>
                      <div className="text-yellow-500 text-xl mb-1">
                        {renderStars(Math.round(averageRating))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {reviews.length} Rating{reviews.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="flex-1">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingDistribution[star as keyof typeof ratingDistribution]
                        const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                        return (
                          <div key={star} className="flex items-center gap-2 mb-1">
                            <span className="text-yellow-500 text-sm">★</span>
                            <span className="text-xs text-gray-600 w-4">{star}</span>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-linear-to-r from-orange-400 via-cyan-400 to-green-400 w-[${percentage}%]`}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="pb-4 border-b border-gray-200 last:border-0">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="shrink-0">
                            {getUserProfileDisplay(review.userId, review.userEmail?.split('@')[0])}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {getDisplayName(review.userId, review.userEmail?.split('@')[0])}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-yellow-500 text-xs">
                                {renderStars(review.rating)}
                              </div>
                              <span className="text-xs text-gray-500">
                                {formatDate(review.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{review.review}</p>
                        <button
                          onClick={() => handleHelpfulVote(review.id)}
                          className="text-xs text-gray-500 hover:text-cyan-600 transition"
                        >
                          👍 Helpful ({review.helpful || 0})
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Questions & Answers */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium mb-4">Questions & Answers</h2>

              {loadingQuestions ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mx-auto"></div>
                </div>
              ) : (
                <>
                  {questions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No questions yet</p>
                      <p className="text-sm text-gray-400 mt-2">Be the first to ask a question!</p>
                    </div>
                  ) : (
                    <div className="space-y-4 mb-6">
                      {questions.map((qa) => (
                        <div
                          key={qa.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="mb-3">
                            <div className="flex items-start gap-3 mb-2">
                              {qa.userId && (
                                <div className="shrink-0">
                                  {getUserProfileDisplay(qa.userId, qa.askedBy)}
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="font-semibold mb-1">Q: {qa.question}</div>
                                <div className="text-xs text-gray-500">
                                  Asked by {getDisplayName(qa.userId!, qa.askedBy)} •{' '}
                                  {formatDate(qa.createdAt)}
                                </div>
                              </div>
                            </div>
                          </div>
                          {qa.answer ? (
                            <div className="pl-4 border-l-2 border-cyan-400 ml-4">
                              <div className="flex items-start gap-3 mb-2">
                                <div className="shrink-0">
                                  {qa.answeredByUserId ? (
                                    getUserProfileDisplay(qa.answeredByUserId, qa.answeredBy)
                                  ) : (
                                    <img
                                      src={getAvatarUrl(qa.answeredBy || 'Admin')}
                                      alt={qa.answeredBy || 'Admin'}
                                      className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                                    />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="text-gray-700 mb-1">A: {qa.answer}</div>
                                  <div className="text-xs text-gray-500">
                                    Answered by{' '}
                                    {qa.answeredByUserId
                                      ? getDisplayName(qa.answeredByUserId, qa.answeredBy)
                                      : qa.answeredBy || 'Admin'}{' '}
                                    • {formatDate(qa.answeredAt)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="pl-4 text-sm text-gray-400 italic ml-4">
                              Awaiting answer...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {showQuestionForm ? (
                    <div className="border border-gray-200 rounded-xl p-4">
                      <textarea
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Type your question here..."
                        className="w-full border border-gray-300 rounded p-3 text-sm outline-none focus:border-cyan-500 mb-3"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={submitQuestion}
                          disabled={submitting || !newQuestion.trim()}
                          className="px-4 py-2 bg-linear-to-r from-cyan-400 to-cyan-500 text-white rounded text-sm font-medium hover:from-cyan-500 hover:to-cyan-600 disabled:opacity-50"
                        >
                          {submitting ? 'Submitting...' : 'Submit Question'}
                        </button>
                        <button
                          onClick={() => {
                            setShowQuestionForm(false)
                            setNewQuestion('')
                          }}
                          className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowQuestionForm(true)}
                      className="w-full px-6 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-semibold text-sm"
                    >
                      Ask a Question
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Seller Info */}
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h3 className="text-sm font-medium mb-4">Sold By</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-200">
                  <img
                    src="/favicon.png"
                    alt="IslandLink"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent) {
                        parent.innerHTML =
                          '<div class="w-12 h-12 bg-linear-to-br from-orange-500 via-cyan-500 to-green-500 rounded-full flex items-center justify-center text-lg font-bold text-white">IL</div>'
                      }
                    }}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium">IslandLink Store</div>
                  <div className="text-xs text-gray-500">Official Store</div>
                </div>
              </div>

              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-cyan-500 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Ships From</div>
                    <div className="text-sm font-medium text-gray-900">{product.rdcLocation}</div>
                    <div className="text-xs text-gray-500 mt-1">Regional Distribution Center</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Positive Ratings</span>
                  <span className="text-green-600 font-medium">98%</span>
                </div>
                <div className="flex justify-between">
                  <span>Ship on Time</span>
                  <span className="text-cyan-600 font-medium">95%</span>
                </div>
                <div className="flex justify-between">
                  <span>In Stock</span>
                  <span className="text-gray-900 font-medium">{product.stock} units</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full text-center animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                modalType === 'success'
                  ? 'bg-green-100'
                  : modalType === 'error'
                    ? 'bg-red-100'
                    : 'bg-cyan-100'
              }`}
            >
              {modalType === 'success' ? (
                <svg
                  className="w-8 h-8 text-green-600"
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
              ) : modalType === 'error' ? (
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8 text-cyan-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <p className="text-gray-900 font-medium mb-4">{modalMessage}</p>
            <button
              onClick={() => setShowModal(false)}
              className="px-6 py-2 bg-linear-to-r from-cyan-400 to-cyan-500 text-white rounded-xl font-medium hover:from-cyan-500 hover:to-cyan-600 transition"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
