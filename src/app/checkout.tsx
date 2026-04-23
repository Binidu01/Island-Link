'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs,
  deleteDoc,
} from 'firebase/firestore'
import L from 'leaflet'
import { useEffect, useState, useRef } from 'react'

import CustomerNavbar from '../components/customernavbar'
import { auth, db } from '../lib/firebase'

import 'leaflet/dist/leaflet.css'

interface CartItem {
  id?: string
  productId: string
  name: string
  price: number
  quantity: number
  imageURL: string
  stock: number
  createdAt?: any
  userId?: string
}

interface ShippingInfo {
  fullName: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  notes: string
  latitude?: number
  longitude?: number
}

interface CardDetails {
  cardNumber: string
  cardName: string
  expiryDate: string
  cvv: string
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [processing, setProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [showMap, setShowMap] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.9271, 79.8612])
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null)

  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  })

  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    notes: '',
    latitude: undefined,
    longitude: undefined,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            // Set email from user profile if exists, otherwise use Firebase Auth email
            const userEmail = userData.email || currentUser.email || ''

            setShippingInfo((prev) => ({
              ...prev,
              fullName: userData.fullName || currentUser.displayName || '',
              email: userEmail,
              phone: userData.phone || '',
              address: userData.address || '',
              city: userData.city || '',
              postalCode: userData.postalCode || '',
              latitude: userData.latitude,
              longitude: userData.longitude,
            }))

            if (userData.latitude && userData.longitude) {
              setMapCenter([userData.latitude, userData.longitude])
              setSelectedLocation([userData.latitude, userData.longitude])
            }
          } else {
            // No user profile exists, use Firebase Auth data
            setShippingInfo((prev) => ({
              ...prev,
              fullName: currentUser.displayName || '',
              email: currentUser.email || '', // Firebase Auth email
            }))
          }
        } catch (error) {
          console.error('Error loading user profile:', error)
          // Fallback to Firebase Auth data
          setShippingInfo((prev) => ({
            ...prev,
            fullName: currentUser.displayName || '',
            email: currentUser.email || '', // Firebase Auth email
          }))
        }

        await loadCartFromFirestore(currentUser.uid)
      } else {
        setLoading(false)
        setCart([])
      }
    })

    return () => unsubscribe()
  }, [])

  async function loadCartFromFirestore(userId: string) {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const isBuyNow = urlParams.get('buynow') === 'true'

      if (isBuyNow) {
        const cartData = localStorage.getItem('isdp_buynow_cart')
        if (cartData) {
          setCart(JSON.parse(cartData))
        }
        setLoading(false)
        return
      }

      const cartsRef = collection(db, 'carts')
      const q = query(cartsRef, where('userId', '==', userId))
      const querySnapshot = await getDocs(q)

      const cartItems: CartItem[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        cartItems.push({
          id: doc.id,
          productId: data.productId,
          name: data.name,
          price: data.price,
          quantity: data.quantity,
          imageURL: data.imageURL,
          stock: data.stock,
          createdAt: data.createdAt,
          userId: data.userId,
        })
      })

      setCart(cartItems)
    } catch (error) {
      console.error('Error loading cart from Firestore:', error)
      try {
        const cartData = localStorage.getItem('isdp_cart')
        if (cartData) {
          setCart(JSON.parse(cartData))
        }
      } catch (localStorageError) {
        console.error('Error loading cart from localStorage:', localStorageError)
      }
    } finally {
      setLoading(false)
    }
  }

  const subtotal = cart.reduce((sum, item) => {
    const price = Number(item.price) || 0
    const quantity = Number(item.quantity) || 0
    return sum + price * quantity
  }, 0)
  const shipping = subtotal >= 10000 ? 0 : 300
  const total = subtotal + shipping

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setShippingInfo((prev) => ({ ...prev, [name]: value }))
  }

  function handleCardInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target

    let formattedValue = value

    if (name === 'cardNumber') {
      // Remove non-digits and format with spaces
      const digits = value.replace(/\D/g, '')
      formattedValue = digits.match(/.{1,4}/g)?.join(' ') || digits
      if (digits.length > 16) return
    } else if (name === 'expiryDate') {
      // Format as MM/YY
      const digits = value.replace(/\D/g, '')
      if (digits.length >= 2) {
        formattedValue = digits.slice(0, 2) + '/' + digits.slice(2, 4)
      } else {
        formattedValue = digits
      }
      if (digits.length > 4) return
    } else if (name === 'cvv') {
      // Only digits, max 4
      formattedValue = value.replace(/\D/g, '')
      if (formattedValue.length > 4) return
    } else if (name === 'cardName') {
      // Only letters and spaces
      formattedValue = value.replace(/[^a-zA-Z\s]/g, '').toUpperCase()
    }

    setCardDetails((prev) => ({ ...prev, [name]: formattedValue }))
  }

  useEffect(() => {
    if (!showMap) return
    if (!mapDivRef.current) return
    if (mapRef.current) return

    const initial = L.latLng(mapCenter[0], mapCenter[1])

    const map = L.map(mapDivRef.current, {
      center: initial,
      zoom: 13,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    markerRef.current = L.marker(initial, { draggable: true }).addTo(map)

    map.on('click', async (e) => {
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng)
        setSelectedLocation([e.latlng.lat, e.latlng.lng])

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`
          )
          const data = await response.json()

          if (data.address) {
            setShippingInfo((prev) => ({
              ...prev,
              address: data.display_name || prev.address,
              city: data.address.city || data.address.town || data.address.village || prev.city,
              postalCode: data.address.postcode || prev.postalCode,
              latitude: e.latlng.lat,
              longitude: e.latlng.lng,
            }))
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error)
        }
      }
    })

    if (markerRef.current) {
      markerRef.current.on('dragend', async (e) => {
        const pos = e.target.getLatLng()
        setSelectedLocation([pos.lat, pos.lng])

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`
          )
          const data = await response.json()

          if (data.address) {
            setShippingInfo((prev) => ({
              ...prev,
              address: data.display_name || prev.address,
              city: data.address.city || data.address.town || data.address.village || prev.city,
              postalCode: data.address.postcode || prev.postalCode,
              latitude: pos.lat,
              longitude: pos.lng,
            }))
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error)
        }
      })
    }

    mapRef.current = map

    return () => {
      if (mapRef.current) {
        mapRef.current.off()
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [showMap])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return

    const ll = L.latLng(mapCenter[0], mapCenter[1])
    marker.setLatLng(ll)
    map.panTo(ll)
  }, [mapCenter])

  function getCurrentLocation() {
    setShowMap(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setMapCenter([lat, lng])
          setSelectedLocation([lat, lng])

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            )
            const data = await response.json()

            if (data.address) {
              setShippingInfo((prev) => ({
                ...prev,
                address: data.display_name || prev.address,
                city: data.address.city || data.address.town || data.address.village || prev.city,
                postalCode: data.address.postcode || prev.postalCode,
                latitude: lat,
                longitude: lng,
              }))
            }
          } catch (error) {
            console.error('Error reverse geocoding:', error)
          }
        },
        (error) => {
          console.error('Error getting location:', error)
          alert('Could not get your location. Please select manually on the map.')
        }
      )
    } else {
      alert('Geolocation is not supported by your browser')
    }
  }

  async function processOnlinePayment() {
    // Validate card details
    if (
      !cardDetails.cardNumber ||
      !cardDetails.cardName ||
      !cardDetails.expiryDate ||
      !cardDetails.cvv
    ) {
      alert('Please fill in all card details')
      return
    }

    const cardDigits = cardDetails.cardNumber.replace(/\s/g, '')
    if (cardDigits.length !== 16) {
      alert('Card number must be 16 digits')
      return
    }

    if (cardDetails.cvv.length < 3) {
      alert('CVV must be at least 3 digits')
      return
    }

    const expiryParts = cardDetails.expiryDate.split('/')
    if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
      alert('Expiry date must be in MM/YY format')
      return
    }

    setPaymentProcessing(true)

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Process the order
    await completeOrder('online')
  }

  async function completeOrder(paymentType: string) {
    try {
      // Validate email is provided
      if (!shippingInfo.email || shippingInfo.email.trim() === '') {
        alert('Please provide your email address')
        setProcessing(false)
        setPaymentProcessing(false)
        return
      }

      // Update user profile
      const userRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userRef)

      const profileUpdateData: any = {
        fullName: shippingInfo.fullName,
        email: shippingInfo.email, // Use email from form
        phone: shippingInfo.phone,
        address: shippingInfo.address,
        city: shippingInfo.city,
        postalCode: shippingInfo.postalCode,
        updatedAt: serverTimestamp(),
      }

      if (shippingInfo.latitude && shippingInfo.longitude) {
        profileUpdateData.latitude = shippingInfo.latitude
        profileUpdateData.longitude = shippingInfo.longitude
      }

      if (userDoc.exists()) {
        await updateDoc(userRef, profileUpdateData)
      } else {
        await updateDoc(userRef, {
          ...profileUpdateData,
          createdAt: serverTimestamp(),
        })
      }

      // Create order - Use email from shipping form
      const orderData: any = {
        userId: user.uid,
        userEmail: shippingInfo.email, // Use email from shipping form
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageURL: item.imageURL,
          stock: item.stock,
        })),
        shippingInfo,
        paymentMethod: paymentType,
        subtotal,
        shipping,
        total,
        status: 'pending', // Always "pending" for all orders
        pay: paymentType === 'online' ? 'paid' : 'pending', // Separate pay field
        createdAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, 'orders'), orderData)

      // Send order confirmation email
      try {
        await sendOrderConfirmationEmail(docRef.id, paymentType)
      } catch (emailError) {
        console.error('Failed to send email, but order was placed:', emailError)
        // Don't block the order process if email fails
      }

      // Clear cart
      const urlParams = new URLSearchParams(window.location.search)
      const isBuyNow = urlParams.get('buynow') === 'true'

      if (isBuyNow) {
        localStorage.removeItem('isdp_buynow_cart')
      } else {
        for (const item of cart) {
          if (item.id) {
            await deleteDoc(doc(db, 'carts', item.id))
          }
        }
        localStorage.removeItem('isdp_cart')
      }

      window.dispatchEvent(new Event('cartUpdated'))

      // Redirect to success page
      window.location.href = `/order-success?orderId=${docRef.id}`
    } catch (error) {
      console.error('Error completing order:', error)
      alert('Failed to complete order. Please try again.')
      setPaymentProcessing(false)
      setProcessing(false)
    }
  }

  // Convert base64 WebP to PNG for email compatibility
  async function convertWebpToPng(base64WebP: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Create an image element
        const img = new Image()

        img.onload = () => {
          try {
            // Create canvas
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('Could not get canvas context'))
              return
            }

            // Draw image to canvas
            ctx.drawImage(img, 0, 0)

            // Convert to PNG data URL
            const pngDataUrl = canvas.toDataURL('image/png', 1.0)

            // Clean up
            canvas.remove()

            resolve(pngDataUrl)
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => {
          reject(new Error('Failed to load image'))
        }

        // Set source
        img.src = base64WebP
      } catch (error) {
        reject(error)
      }
    })
  }

  async function sendOrderConfirmationEmail(orderId: string, paymentType: string) {
    try {
      // Fetch the complete order data from Firestore
      const orderRef = doc(db, 'orders', orderId)
      const orderSnap = await getDoc(orderRef)

      if (!orderSnap.exists()) {
        throw new Error(`Order ${orderId} not found in Firestore`)
      }

      const orderData = orderSnap.data()
      console.log('Order data from Firestore:', orderData)

      // Use the order data from Firestore
      const orderItems = orderData.items || []
      const orderSubtotal = orderData.subtotal || 0
      const orderShipping = orderData.shipping || 0
      const orderTotal = orderData.total || 0
      const userEmail = orderData.userEmail || shippingInfo.email
      const shippingInfoFromDB = orderData.shippingInfo || shippingInfo

      console.log('Order items:', orderItems)

      // Fetch product SKUs for each item
      const itemsWithSKU = await Promise.all(
        orderItems.map(async (item: any) => {
          try {
            // Fetch product details to get SKU
            const productRef = doc(db, 'products', item.productId)
            const productSnap = await getDoc(productRef)

            if (productSnap.exists()) {
              const productData = productSnap.data()
              return {
                ...item,
                sku: productData.sku || 'N/A',
              }
            }
            return {
              ...item,
              sku: 'N/A',
            }
          } catch (error) {
            console.error(`Error fetching product ${item.productId}:`, error)
            return {
              ...item,
              sku: item.sku || 'N/A',
            }
          }
        })
      )

      console.log('Items with SKU:', itemsWithSKU)

      const paymentStatusText =
        paymentType === 'online'
          ? '✅ <strong>Paid Successfully</strong> - Your payment has been processed'
          : '💵 <strong>Cash on Delivery</strong> - Pay when you receive your order'

      const transactionInfo =
        paymentType === 'online'
          ? `
        <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; border-radius: 6px;">
          <p style="margin: 0; color: #065f46; font-size: 14px;">
            <strong>Payment Status:</strong> ✅ Paid
          </p>
          <p style="margin: 5px 0 0 0; color: #065f46; font-size: 14px;">
            <strong>Payment Method:</strong> Online Payment (Card)
          </p>
        </div>
      `
          : `
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 6px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Payment Status:</strong> ⏳ Pending
          </p>
          <p style="margin: 5px 0 0 0; color: #92400e; font-size: 14px;">
            <strong>Payment Method:</strong> Cash on Delivery
          </p>
          <p style="margin: 5px 0 0 0; color: #92400e; font-size: 12px;">
            Please prepare exact cash for the delivery person.
          </p>
        </div>
      `

      // Generate order items HTML WITHOUT images
      const orderItemsHtml = itemsWithSKU
        .map((item: any) => {
          const itemName = item.name || 'Product'
          const itemPrice = item.price || 0
          const itemQuantity = item.quantity || 1
          const sku = item.sku || item.productId || 'N/A'

          return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 4px;">${itemName}</div>
          <div style="color: #6b7280; font-size: 12px; margin-bottom: 2px;">SKU: ${sku}</div>
          <div style="color: #6b7280; font-size: 12px; margin-bottom: 2px;">Quantity: ${itemQuantity}</div>
          <div style="color: #6b7280; font-size: 12px;">Unit Price: LKR ${itemPrice.toLocaleString()}</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #f97316; white-space: nowrap; vertical-align: top;">
          LKR ${(itemPrice * itemQuantity).toLocaleString()}
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
          .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { background: #1f2937; color: #9ca3af; padding: 30px 20px; text-align: center; }
          .footer a { color: #06b6d4; text-decoration: none; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6;">
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>🎉 Order Placed Successfully!</h1>
            <p>Thank you for shopping with IslandLink</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            <p style="font-size: 16px; color: #4b5563;">Dear <strong>${shippingInfoFromDB.fullName}</strong>,</p>
            <p style="font-size: 16px; color: #4b5563;">
              Thank you for placing your order with IslandLink! We have received your order and it is currently being processed. Our team is checking product availability and stock levels. You will receive another confirmation email once your order has been verified and is ready for shipment.
            </p>
            
            <!-- Important Note -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 6px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>📋 Important:</strong> Your order is currently in <strong>"Pending Verification"</strong> status. We are:
              </p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #92400e; font-size: 13px;">
                <li>Checking stock availability for all items</li>
                <li>Verifying product details</li>
                <li>Confirming shipping arrangements</li>
              </ul>
              <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">
                Once verified, your order status will change to "Processing" and you'll receive another update.
              </p>
            </div>
            
            <!-- Order ID -->
            <div class="order-id">
              <strong>Order ID: #${orderId}</strong>
            </div>
            
            <!-- Payment Information -->
            ${transactionInfo}
            
            <!-- Order Items -->
            <div class="section">
              <div class="section-title">📦 Order Items (${itemsWithSKU.length} items)</div>
              <table style="width: 100%; border-collapse: collapse;" cellpadding="0" cellspacing="0">
                ${orderItemsHtml}
              </table>
            </div>
            
            <!-- Order Summary -->
            <div class="section">
              <div class="section-title">💰 Order Summary</div>
              <table class="summary-table" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #6b7280;">Subtotal</td>
                  <td style="text-align: right; font-weight: 600;">LKR ${orderSubtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280;">Shipping Fee</td>
                  <td style="text-align: right; font-weight: 600; color: ${orderShipping === 0 ? '#10b981' : '#1f2937'};">
                    ${orderShipping === 0 ? 'FREE' : `LKR ${orderShipping.toLocaleString()}`}
                  </td>
                </tr>
                <tr class="total-row">
                  <td>Total Amount</td>
                  <td style="text-align: right;">LKR ${orderTotal.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <!-- Delivery Information -->
            <div class="section">
              <div class="section-title">🚚 Delivery Information</div>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                <p style="margin: 5px 0; color: #4b5563;"><strong>Name:</strong> ${shippingInfoFromDB.fullName}</p>
                <p style="margin: 5px 0; color: #4b5563;"><strong>Phone:</strong> ${shippingInfoFromDB.phone}</p>
                <p style="margin: 5px 0; color: #4b5563;"><strong>Email:</strong> ${userEmail}</p>
                <p style="margin: 5px 0; color: #4b5563;"><strong>Address:</strong> ${shippingInfoFromDB.address}</p>
                <p style="margin: 5px 0; color: #4b5563;"><strong>City:</strong> ${shippingInfoFromDB.city}</p>
                ${shippingInfoFromDB.postalCode ? `<p style="margin: 5px 0; color: #4b5563;"><strong>Postal Code:</strong> ${shippingInfoFromDB.postalCode}</p>` : ''}
                ${shippingInfoFromDB.notes ? `<p style="margin: 10px 0 5px 0; color: #4b5563;"><strong>Notes:</strong> ${shippingInfoFromDB.notes}</p>` : ''}
              </div>
              <p style="margin-top: 15px; color: #6b7280; font-size: 14px;">
                ⏱️ <strong>Estimated Delivery:</strong> 3-5 business days (after verification)
              </p>
            </div>
            
            <!-- Next Steps -->
            <div class="section">
              <div class="section-title">📝 What Happens Next?</div>
              <div style="background: #f0f9ff; padding: 15px; border-radius: 8px;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                  <div style="width: 24px; height: 24px; background: #06b6d4; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px; flex-shrink: 0;">1</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1f2937; font-size: 14px;">Stock Verification</div>
                    <div style="color: #6b7280; font-size: 13px;">We're checking product availability (within 24 hours)</div>
                  </div>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                  <div style="width: 24px; height: 24px; background: #06b6d4; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px; flex-shrink: 0;">2</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1f2937; font-size: 14px;">Order Processing</div>
                    <div style="color: #6b7280; font-size: 13px;">Preparing your items for shipment</div>
                  </div>
                </div>
                <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                  <div style="width: 24px; height: 24px; background: #06b6d4; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px; flex-shrink: 0;">3</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1f2937; font-size: 14px;">Shipment</div>
                    <div style="color: #6b7280; font-size: 13px;">Your order will be dispatched for delivery</div>
                  </div>
                </div>
                <div style="display: flex; align-items: flex-start;">
                  <div style="width: 24px; height: 24px; background: #06b6d4; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px; flex-shrink: 0;">4</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1f2937; font-size: 14px;">Delivery</div>
                    <div style="color: #6b7280; font-size: 13px;">Your order arrives at your doorstep</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Track Order Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://your-domain.com/orders/${orderId}" class="button" style="color: white; text-decoration: none;">
                Track Your Order Status
              </a>
            </div>
            
            <!-- Support Info -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin-top: 30px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Need Help?</strong> If you have any questions about your order, please contact our support team at 
                <a href="mailto:support@islandlink.com" style="color: #d97706;">support@islandlink.com</a> or call +94 77 123 4567
              </p>
              <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">
                <strong>Order Modification:</strong> If you need to modify or cancel your order, please contact us within 1 hour of placing the order.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0 0 10px 0; font-size: 16px; color: #ffffff;">
              <strong>IslandLink Smart Distribution</strong>
            </p>
            <p style="margin: 10px 0; font-size: 14px;">
              Your trusted e-commerce platform for quality products
            </p>
            <p style="margin: 15px 0 10px 0; font-size: 13px;">
              <a href="https://your-domain.com" style="color: #06b6d4;">Visit our website</a> | 
              <a href="https://your-domain.com/contact" style="color: #06b6d4;">Contact Us</a> | 
              <a href="https://your-domain.com/help" style="color: #06b6d4;">Help Center</a>
            </p>
            <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280;">
              © ${new Date().getFullYear()} IslandLink Smart Distribution. All rights reserved.
            </p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #6b7280;">
              This email was sent to ${userEmail} regarding your order #${orderId}
            </p>
          </div>
        </div>
      </body>
      </html>
    `

      const emailText = `
Order Placed Successfully - IslandLink

Dear ${shippingInfoFromDB.fullName},

Thank you for placing your order with IslandLink! We have received your order and it is currently being processed. Our team is checking product availability and stock levels. You will receive another confirmation email once your order has been verified and is ready for shipment.

📋 IMPORTANT: Your order is currently in "Pending Verification" status. We are:
1. Checking stock availability for all items
2. Verifying product details
3. Confirming shipping arrangements

Once verified, your order status will change to "Processing" and you'll receive another update.

ORDER DETAILS
Order ID: #${orderId}
Order Status: Pending Verification

PAYMENT INFORMATION
Payment Method: ${paymentType === 'online' ? 'Online Payment (Card)' : 'Cash on Delivery'}
Payment Status: ${paymentType === 'online' ? '✅ Paid' : '⏳ Pending'}

${paymentType === 'cod' ? 'NOTE: Please prepare exact cash for the delivery person.' : ''}

ORDER ITEMS
${itemsWithSKU.map((item: any) => `- ${item.name} (SKU: ${item.sku}, Qty: ${item.quantity}, Unit Price: LKR ${item.price.toLocaleString()}) - LKR ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`).join('\n')}

ORDER SUMMARY
Subtotal: LKR ${orderSubtotal.toLocaleString()}
Shipping Fee: ${orderShipping === 0 ? 'FREE' : `LKR ${orderShipping.toLocaleString()}`}
Total Amount: LKR ${orderTotal.toLocaleString()}

DELIVERY INFORMATION
Name: ${shippingInfoFromDB.fullName}
Phone: ${shippingInfoFromDB.phone}
Email: ${userEmail}
Address: ${shippingInfoFromDB.address}
City: ${shippingInfoFromDB.city}
${shippingInfoFromDB.postalCode ? `Postal Code: ${shippingInfoFromDB.postalCode}` : ''}
${shippingInfoFromDB.notes ? `Notes: ${shippingInfoFromDB.notes}` : ''}

Estimated Delivery: 3-5 business days (after verification)

WHAT HAPPENS NEXT?
1. Stock Verification: We're checking product availability (within 24 hours)
2. Order Processing: Preparing your items for shipment
3. Shipment: Your order will be dispatched for delivery
4. Delivery: Your order arrives at your doorstep

Track your order: https://your-domain.com/orders/${orderId}

Need help? Contact us at support@islandlink.com or call +94 77 123 4567

Order Modification: If you need to modify or cancel your order, please contact us within 1 hour of placing the order.

© ${new Date().getFullYear()} IslandLink Smart Distribution. All rights reserved.
    `

      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userEmail,
          subject: `Order Placed Successfully - IslandLink`,
          html: emailHtml,
          text: emailText,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send email')
      }

      console.log('Order confirmation email sent successfully')
    } catch (error) {
      console.error('Email sending error:', error)
      throw error
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()

    if (!user) {
      alert('Please login to place an order')
      window.location.href = '/login?redirect=/checkout'
      return
    }

    if (cart.length === 0) {
      alert('Your cart is empty')
      return
    }

    if (
      !shippingInfo.fullName ||
      !shippingInfo.phone ||
      !shippingInfo.address ||
      !shippingInfo.city
    ) {
      alert('Please fill in all required fields')
      return
    }

    // Validate email
    if (!shippingInfo.email || shippingInfo.email.trim() === '') {
      alert('Please provide your email address')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(shippingInfo.email)) {
      alert('Please enter a valid email address')
      return
    }

    // If online payment selected, show payment modal
    if (paymentMethod === 'online') {
      setShowPaymentModal(true)
      return
    }

    // Process COD order
    setProcessing(true)
    await completeOrder('cod')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <CustomerNavbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="bg-white rounded-xl shadow-sm p-12">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
            <p className="text-gray-500 mb-6">Please login to continue with checkout</p>
            <a
              href="/login?redirect=/checkout"
              className="inline-block px-8 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition"
            >
              Login to Continue
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <CustomerNavbar />

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-9999 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-blue-600 to-cyan-500 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Secure Payment</h3>
                    <p className="text-blue-100 text-sm">256-bit SSL Encrypted</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentProcessing}
                  aria-label="Close payment modal"
                  className="text-white/80 hover:text-white transition disabled:opacity-50"
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
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Amount Display */}
              <div className="bg-linear-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Amount to Pay</p>
                  <p className="text-3xl font-bold text-gray-900">LKR {total.toLocaleString()}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-gray-600">Secure Payment Gateway</span>
                  </div>
                </div>
              </div>

              {/* Card Form */}
              <form className="space-y-4">
                {/* Card Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="cardNumber"
                      value={cardDetails.cardNumber}
                      onChange={handleCardInputChange}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white font-mono text-lg"
                      disabled={paymentProcessing}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {cardDetails.cardNumber.startsWith('4') && (
                        <div className="text-blue-600 font-bold text-sm">VISA</div>
                      )}
                      {cardDetails.cardNumber.startsWith('5') && (
                        <div className="text-orange-600 font-bold text-sm">MC</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cardholder Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cardName"
                    value={cardDetails.cardName}
                    onChange={handleCardInputChange}
                    placeholder="JOHN DOE"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white font-mono uppercase"
                    disabled={paymentProcessing}
                  />
                </div>

                {/* Expiry and CVV */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="expiryDate"
                      value={cardDetails.expiryDate}
                      onChange={handleCardInputChange}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white font-mono text-lg"
                      disabled={paymentProcessing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CVV <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="cvv"
                      value={cardDetails.cvv}
                      onChange={handleCardInputChange}
                      placeholder="123"
                      maxLength={4}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white font-mono text-lg"
                      disabled={paymentProcessing}
                    />
                  </div>
                </div>

                {/* Security Features */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-blue-600 mt-0.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Your payment is secure</p>
                      <p className="text-blue-700">
                        We use industry-standard encryption to protect your card details. Your
                        information is never stored on our servers.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={paymentProcessing}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={processOnlinePayment}
                    disabled={paymentProcessing}
                    className="flex-1 px-4 py-3 bg-linear-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {paymentProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>Pay Now</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Accepted Cards */}
                <div className="text-center pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-2">We accept</p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="px-3 py-1 bg-gray-100 rounded font-bold text-blue-600 text-xs">
                      VISA
                    </div>
                    <div className="px-3 py-1 bg-gray-100 rounded font-bold text-orange-600 text-xs">
                      MASTERCARD
                    </div>
                    <div className="px-3 py-1 bg-gray-100 rounded font-bold text-cyan-600 text-xs">
                      AMEX
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-500 mt-1">Complete your order</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : cart.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto text-gray-300 mb-4"
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some products before checkout</p>
            <a
              href="/products"
              className="inline-block px-8 py-3 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-600 transition"
            >
              Continue Shopping
            </a>
          </div>
        ) : (
          <form onSubmit={handlePlaceOrder}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Shipping Information */}
              <div className="lg:col-span-2 space-y-6">
                {/* Contact Information */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={shippingInfo.fullName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={shippingInfo.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                        placeholder="john@example.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {user.email && shippingInfo.email === user.email
                          ? 'This is your registered email. You can change it if needed.'
                          : 'Email for order confirmation'}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={shippingInfo.phone}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                        placeholder="+94 77 123 4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Shipping Address</h2>
                    {!showMap && (
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-cyan-400 to-blue-500 text-white rounded-lg hover:from-cyan-500 hover:to-blue-600 transition text-sm font-medium"
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
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Use My Location
                      </button>
                    )}
                  </div>

                  {showMap && (
                    <div className="mb-4">
                      <div>
                        <div
                          ref={mapDivRef}
                          className="h-100 w-full rounded-lg border-2 border-gray-200"
                        ></div>
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setShowMap(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                          >
                            Close Map
                          </button>
                          {selectedLocation && (
                            <div className="text-sm text-gray-600 flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
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
                              <span className="font-medium text-green-700">Location selected</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          💡 Click anywhere on the map or drag the marker to select your location
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={shippingInfo.address}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                        placeholder="123 Main Street, Apartment 4B"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={shippingInfo.city}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                          placeholder="Colombo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          name="postalCode"
                          value={shippingInfo.postalCode}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                          placeholder="00100"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Order Notes (Optional)
                      </label>
                      <textarea
                        name="notes"
                        value={shippingInfo.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none resize-none text-gray-900 bg-white"
                        placeholder="Any special instructions for delivery..."
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Method</h2>
                  <div className="space-y-3">
                    <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-cyan-400 transition">
                      <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-4 h-4 text-cyan-600"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900">Cash on Delivery</div>
                        <div className="text-sm text-gray-500">Pay when you receive</div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Available
                      </span>
                    </label>

                    <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-cyan-400 transition">
                      <input
                        type="radio"
                        name="payment"
                        value="online"
                        checked={paymentMethod === 'online'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-4 h-4 text-cyan-600"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900">Online Payment</div>
                        <div className="text-sm text-gray-500">Pay securely with card</div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-8 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[8px] font-bold">
                          VISA
                        </div>
                        <div className="w-8 h-6 bg-orange-600 rounded flex items-center justify-center text-white text-[8px] font-bold">
                          MC
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>

                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.productId} className="flex gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={item.imageURL}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                            {item.name}
                          </h3>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">
                              Qty: {Number(item.quantity) || 1}
                            </span>
                            <span className="text-sm font-semibold text-orange-600">
                              LKR{' '}
                              {(
                                (Number(item.price) || 0) * (Number(item.quantity) || 1)
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({cart.length} items)</span>
                      <span>LKR {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      <span className={shipping === 0 ? 'text-green-600 font-medium' : ''}>
                        {shipping === 0 ? 'FREE' : `LKR ${shipping.toLocaleString()}`}
                      </span>
                    </div>
                    {subtotal > 0 && subtotal < 10000 && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        Add LKR {Math.ceil(10000 - subtotal).toLocaleString()} more for free
                        shipping!
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-3 flex justify-between text-xl font-bold text-gray-900">
                      <span>Total</span>
                      <span className="text-orange-600">LKR {total.toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full mt-6 py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing
                      ? 'Processing...'
                      : paymentMethod === 'online'
                        ? 'Proceed to Payment'
                        : 'Place Order'}
                  </button>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Secure Checkout
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
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
                      Easy Returns
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
