'use client'

import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import L from 'leaflet'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

import 'leaflet/dist/leaflet.css'
import { db } from '../lib/firebase'

// Fix for Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
  iconUrl: '/leaflet/images/marker-icon.png',
  shadowUrl: '/leaflet/images/marker-shadow.png',
})

interface Order {
  id: string
  orderNumber?: string
  customerName?: string
  totalAmount: number
  status: string
  items: any[]
  createdAt: any
  shippingInfo?: {
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
  shipping?: number
  subtotal?: number
  total?: number
  userEmail?: string
  updatedBy?: string
  updatedAt?: any
  pay?: string
  statusUpdates?: Array<{
    status: string
    timestamp: any
    updatedBy: string
    updatedByRDC?: string
    updatedByRole: string
  }>
  driverTracking?: {
    deliveryStartedAt: any
    driverEmail: string
    driverId: string
    routeCreatedAt: any
    selectedOrderIds: string[]
    vehicleStatus: string
    estimatedDelivery: any
    lastCoordinates?: {
      accuracy: number
      latitude: number
      longitude: number
      timestamp: any
    }
    deliveryCompletedAt?: any
    deliveryStatus?: string
  }
  deliveryStartedAt?: any
  estimatedDelivery?: any
  deliveredAt?: any
  rejectedAt?: any
}

interface DriverInfo {
  email: string
  name: string
  phone: string | null
  vehicleType?: string
  vehicleNumber?: string
}

interface RouteInfo {
  distance: number // in meters
  duration: number // in seconds
  geometry: [number, number][] // [lat, lng] coordinates for Leaflet
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', text: 'PENDING' }
      case 'paid':
        return { color: 'bg-blue-100 text-blue-800', text: 'PAID' }
      case 'confirmed':
        return { color: 'bg-teal-100 text-teal-800', text: 'CONFIRMED' }
      case 'processing':
        return { color: 'bg-indigo-100 text-indigo-800', text: 'PROCESSING' }
      case 'out for delivery':
      case 'out_for_delivery':
        return { color: 'bg-orange-100 text-orange-800', text: 'OUT FOR DELIVERY' }
      case 'delivered':
        return { color: 'bg-green-100 text-green-800', text: 'DELIVERED' }
      case 'rejected':
        return { color: 'bg-red-100 text-red-800', text: 'REJECTED' }
      default:
        return { color: 'bg-gray-100 text-gray-800', text: status.toUpperCase() }
    }
  }

  const config = getStatusConfig(status)
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}
    >
      {config.text}
    </span>
  )
}

const Timeline = ({ order }: { order: Order }) => {
  const statuses = [
    { key: 'pending', label: 'Order Placed' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'processing', label: 'Processing' },
    { key: 'out for delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' },
  ]

  const getCurrentStatusIndex = () => {
    const status = order.status.toLowerCase()
    return statuses.findIndex((s) => s.key === status)
  }

  const currentIndex = getCurrentStatusIndex()

  return (
    <div className="relative">
      {/* Progress bar */}
      <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200 -translate-y-1/2">
        <div
          className={`h-full bg-green-500 transition-all duration-500 w-[${
            (currentIndex / (statuses.length - 1)) * 100
          }%]`}
        />
      </div>

      {/* Status points */}
      <div className="flex justify-between relative">
        {statuses.map((status, index) => {
          const isCompleted = index <= currentIndex
          const isCurrent = index === currentIndex

          return (
            <div key={status.key} className="flex flex-col items-center relative">
              <div
                className={`h-8 w-8 rounded-full border-2 flex items-center justify-center z-10 ${
                  isCompleted ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <span
                    className={`text-xs ${isCurrent ? 'text-green-600 font-bold' : 'text-gray-400'}`}
                  >
                    {index + 1}
                  </span>
                )}
              </div>
              <div className="mt-2 text-center">
                <div
                  className={`text-xs font-medium ${isCurrent ? 'text-green-600' : 'text-gray-600'}`}
                >
                  {status.label}
                </div>
                {isCurrent && order.updatedAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(order.updatedAt?.toDate?.() || order.updatedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Helper function to get OSRM route
const getOSRMRoute = async (
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<RouteInfo | null> => {
  try {
    const coordinates = `${startLng},${startLat};${endLng},${endLat}`
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`

    const response = await fetch(url)
    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM routing failed, using straight line')
      return null
    }

    const route = data.routes[0]

    // Extract geometry from GeoJSON and convert to [lat, lng] for Leaflet
    const geometry = route.geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]] as [number, number] // Convert [lng, lat] to [lat, lng]
    )

    return {
      distance: route.distance,
      duration: route.duration,
      geometry,
    }
  } catch (error) {
    console.error('OSRM routing error:', error)
    return null
  }
}

// Helper function to calculate straight-line route as fallback
const getStraightLineRoute = (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): RouteInfo => {
  // Calculate straight line distance using Haversine formula
  const R = 6371000 // Earth's radius in meters
  const φ1 = (startLat * Math.PI) / 180
  const φ2 = (endLat * Math.PI) / 180
  const Δφ = ((endLat - startLat) * Math.PI) / 180
  const Δλ = ((endLng - startLng) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  // Estimate duration assuming 40 km/h average speed
  const duration = distance / (40000 / 3600) // seconds

  return {
    distance,
    duration,
    geometry: [
      [startLat, startLng],
      [endLat, endLng],
    ],
  }
}

const DeliveryMap = ({
  order,
  driverLocation,
}: {
  order: Order
  driverLocation: [number, number] | null
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<any[]>([])
  const routeLineRef = useRef<L.Polyline | null>(null)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  // Load route when driver location or order changes
  useEffect(() => {
    if (driverLocation && order.shippingInfo?.latitude && order.shippingInfo?.longitude) {
      loadRoute()
    }
  }, [driverLocation, order])

  const loadRoute = async () => {
    if (!driverLocation || !order.shippingInfo?.latitude || !order.shippingInfo?.longitude) return

    setLoadingRoute(true)
    try {
      // Try to get OSRM route first
      const osrmRoute = await getOSRMRoute(
        driverLocation[1], // longitude
        driverLocation[0], // latitude
        order.shippingInfo.longitude!,
        order.shippingInfo.latitude!
      )

      if (osrmRoute) {
        setRouteInfo(osrmRoute)
      } else {
        // Fallback to straight line
        const straightRoute = getStraightLineRoute(
          driverLocation[0],
          driverLocation[1],
          order.shippingInfo.latitude!,
          order.shippingInfo.longitude!
        )
        setRouteInfo(straightRoute)
      }
    } catch (error) {
      console.error('Error loading route:', error)
      // Use straight line as last resort
      const straightRoute = getStraightLineRoute(
        driverLocation[0],
        driverLocation[1],
        order.shippingInfo.latitude!,
        order.shippingInfo.longitude!
      )
      setRouteInfo(straightRoute)
    } finally {
      setLoadingRoute(false)
    }
  }

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map
    const map = L.map(mapRef.current).setView([7.8731, 80.7718], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    // Cleanup
    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersRef.current = []
      routeLineRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear existing markers and route
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    if (routeLineRef.current) {
      routeLineRef.current.remove()
      routeLineRef.current = null
    }

    // Add customer location marker
    if (order.shippingInfo?.latitude && order.shippingInfo?.longitude) {
      const customerIcon = L.divIcon({
        html: `<div class="relative">
          <div class="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded text-xs font-semibold text-gray-700 shadow whitespace-nowrap">
            Delivery Point
          </div>
        </div>`,
        iconSize: [32, 48],
        iconAnchor: [16, 32],
        className: 'customer-marker',
      })

      const customerMarker = L.marker([order.shippingInfo.latitude, order.shippingInfo.longitude], {
        icon: customerIcon,
      }).addTo(map)

      customerMarker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold text-gray-900">Delivery Address</h3>
          <p class="text-sm text-gray-600 mt-1">${order.shippingInfo.address}</p>
          <p class="text-sm text-gray-600">${order.shippingInfo.city} ${order.shippingInfo.postalCode}</p>
        </div>
      `)

      markersRef.current.push(customerMarker)
    }

    // Add driver location marker if available
    if (driverLocation) {
      const driverIcon = L.divIcon({
        html: `<div class="relative">
          <div class="w-10 h-10 bg-blue-500 rounded-full border-4 border-white shadow-lg animate-pulse">
            <div class="w-full h-full flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h4v1a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1V5a1 1 0 00-1-1H3z" />
              </svg>
            </div>
          </div>
          <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded text-xs font-semibold text-blue-600 shadow whitespace-nowrap">
            Delivery Vehicle
          </div>
        </div>`,
        iconSize: [40, 56],
        iconAnchor: [20, 40],
        className: 'driver-marker',
      })

      const driverMarker = L.marker(driverLocation, { icon: driverIcon }).addTo(map)

      // Add popup with driver info
      const lastUpdate = order.driverTracking?.lastCoordinates?.timestamp
      const popupContent = order.driverTracking?.driverEmail
        ? `<div class="p-2">
            <h3 class="font-bold text-gray-900">Delivery Driver</h3>
            <p class="text-sm text-gray-600 mt-1">${order.driverTracking.driverEmail}</p>
            <p class="text-xs text-gray-500">Last updated: ${lastUpdate ? new Date(lastUpdate.toDate ? lastUpdate.toDate() : lastUpdate).toLocaleTimeString() : 'N/A'}</p>
          </div>`
        : `<div class="p-2"><p class="text-sm text-gray-600">Delivery vehicle location</p></div>`

      driverMarker.bindPopup(popupContent)
      markersRef.current.push(driverMarker)
    }

    // Draw route if we have route information
    if (routeInfo && routeInfo.geometry.length > 0) {
      // Create route line
      const routeLine = L.polyline(routeInfo.geometry, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)

      routeLineRef.current = routeLine
      markersRef.current.push(routeLine)

      // Fit map to show route with padding
      if (routeInfo.geometry.length > 0) {
        const bounds = L.latLngBounds(routeInfo.geometry)
        map.fitBounds(bounds.pad(0.1))
      }
    } else if (driverLocation && order.shippingInfo?.latitude && order.shippingInfo?.longitude) {
      // Fallback: draw straight line if no route
      const line = L.polyline(
        [driverLocation, [order.shippingInfo.latitude, order.shippingInfo.longitude]],
        {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.6,
        }
      ).addTo(map)

      markersRef.current.push(line)
      routeLineRef.current = line

      // Fit map to show both points
      const bounds = L.latLngBounds([
        driverLocation,
        [order.shippingInfo.latitude, order.shippingInfo.longitude],
      ])
      map.fitBounds(bounds.pad(0.2))
    } else if (order.shippingInfo?.latitude && order.shippingInfo?.longitude) {
      // If no driver location, just center on delivery point
      map.setView([order.shippingInfo.latitude, order.shippingInfo.longitude], 15)
    }

    // Add real-time tracking info - use lastCoordinates accuracy
    if (order.driverTracking?.lastCoordinates && driverLocation) {
      const accuracy = order.driverTracking.lastCoordinates.accuracy || 0
      if (accuracy > 0) {
        const accuracyCircle = L.circle(driverLocation, {
          radius: accuracy,
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          color: '#3b82f6',
          weight: 1,
        }).addTo(map)

        markersRef.current.push(accuracyCircle)
      }
    }
  }, [order, driverLocation, routeInfo])

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full h-64 md:h-96 rounded-xl overflow-hidden border border-gray-200"
      />
      {loadingRoute && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Loading route...</span>
          </div>
        </div>
      )}
      {routeInfo && (
        <div className="absolute bottom-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md border border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {(routeInfo.distance / 1000).toFixed(1)} km
            </span>
            <span className="mx-2">•</span>
            <span className="font-semibold text-gray-900">
              {Math.round(routeInfo.duration / 60)} min
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const DeliveryDetails = ({
  order,
  driverLocation,
  driverInfo,
  routeInfo,
}: {
  order: Order
  driverLocation: [number, number] | null
  driverInfo: DriverInfo | null
  routeInfo: RouteInfo | null
}) => {
  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Not available'
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      return 'Invalid date'
    }
  }

  const getEstimatedTimeOfArrival = () => {
    if (!order.estimatedDelivery) return 'Not available'

    const now = new Date()
    const eta = order.estimatedDelivery.toDate
      ? order.estimatedDelivery.toDate()
      : new Date(order.estimatedDelivery)
    const diffMinutes = Math.round((eta.getTime() - now.getTime()) / (1000 * 60))

    if (diffMinutes <= 0) return 'Arriving soon'
    if (diffMinutes < 60) return `${diffMinutes} minutes`
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}h ${minutes}m`
  }

  const getVehicleStatus = () => {
    const status = order.driverTracking?.vehicleStatus
    switch (status) {
      case 'starting_delivery':
        return { text: 'Starting Delivery', color: 'text-blue-600', icon: '🚚' }
      case 'on_delivery':
        return { text: 'On Delivery', color: 'text-orange-600', icon: '🏃' }
      case 'arriving_soon':
        return { text: 'Arriving Soon', color: 'text-green-600', icon: '📍' }
      case 'delivered':
        return { text: 'Delivered', color: 'text-green-600', icon: '✓' }
      case 'stopped':
        return { text: 'Stopped', color: 'text-red-600', icon: '⏸️' }
      default:
        return { text: 'On the way', color: 'text-gray-600', icon: '🚗' }
    }
  }

  const vehicleStatus = getVehicleStatus()

  return (
    <div className="space-y-6">
      {/* Driver Information */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
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
          Delivery Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Driver Details */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Driver Details</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
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
                </div>
                <div>
                  <p className="text-sm text-gray-600">Driver</p>
                  <p className="font-medium text-gray-900">
                    {driverInfo?.name || order.driverTracking?.driverEmail || 'Not assigned'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
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
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contact</p>
                  <p className="font-medium text-gray-900">{driverInfo?.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Status */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Vehicle Status</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">{vehicleStatus.icon}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className={`font-medium ${vehicleStatus.color}`}>{vehicleStatus.text}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-purple-600"
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
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Route Distance</p>
                  <p className="font-medium text-gray-900">
                    {routeInfo ? `${(routeInfo.distance / 1000).toFixed(1)} km` : 'Calculating...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Timeline */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-orange-600"
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
          Delivery Timeline
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Delivery Started</p>
              <p className="font-medium text-gray-900 mt-1">
                {formatTime(order.deliveryStartedAt || order.driverTracking?.deliveryStartedAt)}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Estimated Arrival</p>
              <p className="font-medium text-gray-900 mt-1">{getEstimatedTimeOfArrival()}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Last Updated</p>
              <p className="font-medium text-gray-900 mt-1">
                {formatTime(order.driverTracking?.lastCoordinates?.timestamp || order.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Instructions */}
      {order.shippingInfo?.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Delivery Instructions
          </h3>
          <p className="text-gray-700">{order.shippingInfo.notes}</p>
        </div>
      )}
    </div>
  )
}

const OrderStatusUpdates = ({ order }: { order: Order }) => {
  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      return 'N/A'
    }
  }

  const statusUpdates = order.statusUpdates || []

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Status Updates</h3>

      {statusUpdates.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No status updates available</p>
      ) : (
        <div className="space-y-4">
          {statusUpdates
            .slice()
            .reverse()
            .map((update, index) => (
              <div
                key={index}
                className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    update.status === 'delivered'
                      ? 'bg-green-100 text-green-600'
                      : update.status === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : update.status.includes('delivery')
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {update.status === 'delivered' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : update.status === 'rejected' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">
                      {update.status.replace('_', ' ').toUpperCase()}
                    </h4>
                    <span className="text-sm text-gray-500">{formatTime(update.timestamp)}</span>
                  </div>

                  <div className="mt-1 text-sm text-gray-600">
                    <p>Updated by: {update.updatedBy}</p>
                    {update.updatedByRDC && (
                      <p className="text-xs text-gray-500 mt-1">
                        RDC: {update.updatedByRDC} • Role: {update.updatedByRole}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default function OrderTrackingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderId = searchParams.get('id')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null)
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null)
  const [refreshInterval, setRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(
    null
  )
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [showLiveRouteInfo, setShowLiveRouteInfo] = useState(true)

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Get order number display
  const getOrderNumber = (order: Order) => {
    return order.orderNumber
      ? `#${order.orderNumber}`
      : `ORD-${order.id.toUpperCase().substring(0, 8)}`
  }

  // Get customer name
  const getCustomerName = (order: Order) => {
    return (
      order.shippingInfo?.fullName ||
      order.customerName ||
      order.userEmail?.split('@')[0] ||
      'Customer'
    )
  }

  // Load route when driver location changes
  useEffect(() => {
    if (driverLocation && order?.shippingInfo?.latitude && order?.shippingInfo?.longitude) {
      const loadRoute = async () => {
        try {
          const osrmRoute = await getOSRMRoute(
            driverLocation[1], // longitude
            driverLocation[0], // latitude
            order.shippingInfo!.longitude!,
            order.shippingInfo!.latitude!
          )

          if (osrmRoute) {
            setRouteInfo(osrmRoute)
          } else {
            const straightRoute = getStraightLineRoute(
              driverLocation[0],
              driverLocation[1],
              order.shippingInfo!.latitude!,
              order.shippingInfo!.longitude!
            )
            setRouteInfo(straightRoute)
          }
        } catch (error) {
          console.error('Error loading route:', error)
        }
      }

      loadRoute()
    }
  }, [driverLocation, order])

  // Load order data
  useEffect(() => {
    if (!orderId) {
      setError('Order ID is required')
      setLoading(false)
      return
    }

    const unsubscribe = onSnapshot(
      doc(db, 'orders', orderId),
      async (docSnapshot) => {
        if (!docSnapshot.exists()) {
          setError('Order not found')
          setLoading(false)
          return
        }

        const orderData = { id: docSnapshot.id, ...docSnapshot.data() } as Order
        setOrder(orderData)

        // Get driver location from lastCoordinates
        if (orderData.driverTracking?.lastCoordinates) {
          const loc = orderData.driverTracking.lastCoordinates
          setDriverLocation([loc.latitude, loc.longitude])
        }

        // Get driver info including phone number from users collection
        if (orderData.driverTracking?.driverId) {
          try {
            const driverDocRef = doc(db, 'users', orderData.driverTracking.driverId)
            const driverDoc = await getDoc(driverDocRef)

            if (driverDoc.exists()) {
              const driverData = driverDoc.data()

              setDriverInfo({
                email: driverData.email || orderData.driverTracking.driverEmail || '',
                name: driverData.fullName || driverData.email?.split('@')[0] || 'Driver',
                phone: driverData.phone || null,
                vehicleType: driverData.vehicleType,
                vehicleNumber: driverData.vehicleNumber,
              })
            } else {
              // Fallback to driver email if user document not found
              setDriverInfo({
                email: orderData.driverTracking.driverEmail || '',
                name: orderData.driverTracking.driverEmail?.split('@')[0] || 'Driver',
                phone: null,
                vehicleType: undefined,
                vehicleNumber: undefined,
              })
            }
          } catch (error) {
            console.error('Error loading driver info:', error)
            // Fallback to driver email on error
            setDriverInfo({
              email: orderData.driverTracking.driverEmail || '',
              name: orderData.driverTracking.driverEmail?.split('@')[0] || 'Driver',
              phone: null,
              vehicleType: undefined,
              vehicleNumber: undefined,
            })
          }
        } else if (orderData.driverTracking?.driverEmail) {
          // If no driverId but has driverEmail, try to find user by email
          // For now, just use the email
          setDriverInfo({
            email: orderData.driverTracking.driverEmail,
            name: orderData.driverTracking.driverEmail.split('@')[0],
            phone: null,
            vehicleType: undefined,
            vehicleNumber: undefined,
          })
        }

        setLoading(false)
        setError(null)
      },
      (error) => {
        console.error('Error loading order:', error)
        setError('Failed to load order data')
        setLoading(false)
      }
    )

    // Set up refresh interval for real-time updates
    const interval = setInterval(() => {
      console.log('Checking for location updates...')
    }, 5000)

    setRefreshInterval(interval)

    return () => {
      unsubscribe()
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order tracking...</p>
          <p className="text-sm text-gray-400 mt-1">Getting real-time delivery information</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Order not found'}</h2>
          <p className="text-gray-600 mb-6">
            {error === 'Order not found'
              ? 'The order you are looking for does not exist or has been removed.'
              : 'There was an error loading the order information.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Track Your Order</h1>
              <p className="text-gray-600 mt-1">
                Real-time tracking for order {getOrderNumber(order)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {driverLocation && (
                <span className="px-3 py-1 bg-linear-to-r from-green-500 to-blue-600 text-white text-sm font-semibold rounded-full flex items-center gap-2">
                  <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
                  Live Tracking
                </span>
              )}
              <StatusBadge status={order.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Order Number</p>
                  <p className="font-semibold text-gray-900">{getOrderNumber(order)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold text-gray-900">{getCustomerName(order)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Order Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(order.createdAt?.toDate?.() || order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Delivery Address</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Recipient</p>
                  <p className="font-semibold text-gray-900">
                    {order.shippingInfo?.fullName || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-semibold text-gray-900">
                    {order.shippingInfo?.address || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contact</p>
                  <p className="font-semibold text-gray-900">
                    {order.shippingInfo?.phone || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(order.subtotal || order.totalAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-semibold text-gray-900">
                    {order.shipping === 0 ? 'FREE' : formatCurrency(order.shipping || 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(order.total || order.totalAmount || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      order.pay === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {order.pay === 'paid' ? 'PAID' : 'PENDING'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Delivery Progress</h3>
          <Timeline order={order} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Live Tracking Map */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  Live Route Tracking
                </h3>
                {driverLocation && (
                  <span className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    LIVE
                  </span>
                )}
              </div>
              <DeliveryMap order={order} driverLocation={driverLocation} />
              <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span>Delivery Point</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>Delivery Vehicle</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-8 bg-blue-500 opacity-80"></div>
                  <span>Route</span>
                </div>
              </div>
            </div>

            {/* Delivery Details */}
            <DeliveryDetails
              order={order}
              driverLocation={driverLocation}
              driverInfo={driverInfo}
              routeInfo={routeInfo}
            />
          </div>

          <div className="space-y-6">
            {/* Order Items */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Items</h3>
              <div className="space-y-3">
                {order.items?.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    {item.imageURL && (
                      <img
                        src={item.imageURL}
                        alt={item.productName || item.name}
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.productName || item.name}</h4>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatCurrency((item.price || 0) * (item.quantity || 1))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Updates */}
            <OrderStatusUpdates order={order} />
          </div>
        </div>
      </div>

      {/* Auto-refresh notice */}
      {showLiveRouteInfo && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <svg
                className="w-3 h-3 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Live Route Tracking</p>
              <p className="text-xs text-gray-600 mt-1">
                Showing optimized route from driver to destination. Updates every 5 seconds.
              </p>
            </div>
            <button
              onClick={() => setShowLiveRouteInfo(false)}
              aria-label="Close info"
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      )}
    </div>
  )
}
