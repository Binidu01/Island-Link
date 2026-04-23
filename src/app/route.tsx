import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, onSnapshot, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore'
import L from 'leaflet'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import LogisticsNavbar from '../components/LogisticsNavbar'

import 'leaflet/dist/leaflet.css'
import { db, auth } from '../lib/firebase'

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
  shippingInfo?: any
  shipping?: number
  subtotal?: number
  total?: number
  userEmail?: string
  updatedBy?: string
  pay?: string
  statusUpdates?: StatusUpdate[]
  driverTracking?: DriverTracking
}

interface StatusUpdate {
  status: string
  timestamp: any
  updatedBy: string
  updatedByRDC: string
  updatedByRole: string
}

interface DriverTracking {
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
  currentLocation?: {
    latitude: number
    longitude: number
    accuracy: number
    timestamp: any
  }
  locationHistory?: Array<{
    latitude: number
    longitude: number
    accuracy: number
    timestamp: any
    speed?: number
  }>
}

interface RoutePoint {
  id: string
  name: string
  address: string
  type: 'start' | 'delivery' | 'end'
  orderId?: string
  orderNumber?: string
  position: [number, number]
  sequence: number
  displayNumber?: number
}

interface NavigationInstruction {
  instruction: string
  distance: number
  duration: number
  type: string
  location: [number, number]
}

interface RouteOptimization {
  totalDistance: number
  totalTime: number
  routePoints: RoutePoint[]
  polyline: [number, number][]
  instructions: NavigationInstruction[]
}

declare global {
  interface Window {
    vehicleMarker: any
    routeLine: any
  }
}

// Helper Components
const SuccessModal = ({ isOpen, onClose, title, message }: any) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-9999 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full z-10000 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
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
        <div className="text-center mb-6">
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-gray-700">{message}</p>
        </div>
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-linear-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

const NavigationPanel = ({
  navigationInstructions,
  currentStep,
  isDelivering,
  currentOrderNumber,
  isReturningToStart,
}: any) => {
  if (!isDelivering || navigationInstructions.length === 0) return null

  const currentInstruction = navigationInstructions[currentStep]
  const remainingDistance = navigationInstructions
    .slice(currentStep)
    .reduce((t: number, i: any) => t + i.distance, 0)
  const remainingTime = navigationInstructions
    .slice(currentStep)
    .reduce((t: number, i: any) => t + i.duration, 0)

  const getSimpleInstruction = (type: string) => {
    const lowerType = type.toLowerCase()
    if (lowerType.includes('left'))
      return lowerType.includes('slight') ? 'Turn slightly left' : 'Turn left'
    if (lowerType.includes('right'))
      return lowerType.includes('slight') ? 'Turn slightly right' : 'Turn right'
    if (lowerType.includes('arrive')) return 'Arrived at destination'
    if (lowerType.includes('continue')) return 'Continue straight'
    return 'Continue on route'
  }

  return (
    <div className="absolute top-4 left-16 right-16 z-1000">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-white p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isReturningToStart ? 'Returning to Start' : 'Navigating to Delivery'}
              </h2>
              {currentOrderNumber && !isReturningToStart && (
                <p className="text-sm text-gray-600">Current: {currentOrderNumber}</p>
              )}
              {isReturningToStart && (
                <p className="text-sm text-green-600">All deliveries completed!</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-900">
                {remainingDistance < 1000
                  ? `${Math.round(remainingDistance)} m`
                  : `${(remainingDistance / 1000).toFixed(1)} km`}
              </div>
              <div className="text-sm text-gray-600">
                {Math.floor(remainingTime / 3600) > 0
                  ? `${Math.floor(remainingTime / 3600)}h ${Math.floor((remainingTime % 3600) / 60)}m`
                  : `${Math.floor(remainingTime / 60)} min`}
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1 text-black">→</div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg">
                {getSimpleInstruction(currentInstruction.type)}
              </h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  {currentInstruction.distance < 1000
                    ? `${Math.round(currentInstruction.distance)} m`
                    : `${(currentInstruction.distance / 1000).toFixed(1)} km`}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {Math.round(currentInstruction.duration)} sec
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const DeliveryOrdersPanel = ({
  selectedOrders,
  orders,
  currentOrderId,
  onMarkDelivered,
  onRejectOrder,
  onReturnToStart,
  getOrderNumber,
  getCustomerName,
  formatCurrency,
  isDelivering,
  isReturningToStart,
  optimizedRoute,
}: any) => {
  if (!isDelivering) return null

  const selectedOrderDetails = orders.filter((order: Order) => selectedOrders.includes(order.id))

  if (selectedOrderDetails.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="text-center py-8">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-green-600"
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
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {isReturningToStart ? 'Returning to Start Point' : 'All Deliveries Complete!'}
          </h3>
          <p className="text-gray-600 mb-6">
            {isReturningToStart
              ? 'All deliveries completed! Click "Complete Route" to finish.'
              : 'Great job! All orders have been processed.'}
          </p>
          <button
            onClick={onReturnToStart}
            className="w-full px-6 py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white text-lg font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {isReturningToStart ? 'Complete Route' : 'Complete & Exit'}
          </button>
        </div>
      </div>
    )
  }

  const getDisplayNumber = (orderId: string) => {
    if (!optimizedRoute?.routePoints) return null
    const point = optimizedRoute.routePoints.find(
      (p: RoutePoint) => p.orderId === orderId && p.type === 'delivery'
    )
    return point?.displayNumber
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        Delivery Orders ({selectedOrderDetails.length})
      </h3>
      <div className="space-y-3 max-h-125 overflow-y-auto">
        {selectedOrderDetails.map((order: Order) => {
          const displayNum = getDisplayNumber(order.id)
          return (
            <div
              key={order.id}
              className={`p-4 rounded-lg border ${currentOrderId === order.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {displayNum && (
                      <span className="shrink-0 h-7 w-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {displayNum}
                      </span>
                    )}
                    <h4 className="font-semibold text-gray-900 text-lg">{getOrderNumber(order)}</h4>
                  </div>
                  <p className="text-sm text-gray-700 font-medium mt-1">{getCustomerName(order)}</p>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {order.shippingInfo?.address || 'No address'}
                  </p>
                  <p className="text-base font-bold text-gray-900 mt-2">
                    {formatCurrency(order.total || order.totalAmount || 0)}
                  </p>
                  <p
                    className={`text-xs font-medium ${order.pay === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}
                  >
                    Payment: {order.pay === 'paid' ? 'Paid' : 'Pending'}
                  </p>
                </div>
                {currentOrderId === order.id && (
                  <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                    Current
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onMarkDelivered(order.id)}
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-green-500 to-green-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Delivered
                </button>
                <button
                  onClick={() => onRejectOrder(order.id)}
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-lg hover:from-red-600 hover:to-red-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Reject
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const MapLoading = () => (
  <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p className="text-gray-600">Loading map...</p>
    </div>
  </div>
)

const SimpleMap = (props: any) => {
  const {
    mapCenter,
    mapZoom,
    optimizedRoute,
    routePoints,
    orders,
    selectedOrders,
    toggleOrderSelection,
    getOrderNumber,
    getCustomerName,
    formatCurrency,
    userLocation,
    onMapReady,
    isDelivering,
    vehiclePosition,
  } = props
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const style = document.createElement('style')
    style.textContent = `
      .leaflet-div-icon {
        background: transparent !important;
        border: none !important;
      }
      .leaflet-marker-icon {
        background: transparent !important;
      }
    `
    document.head.appendChild(style)

    const map = L.map(mapRef.current!).setView(mapCenter, mapZoom)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    setMapInstance(map)
    onMapReady?.(map)
    return () => {
      map.remove()
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    if (!mapInstance) return
    mapInstance.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) mapInstance.removeLayer(layer)
    })

    const createCustomIcon = (color: string, label?: string) =>
      L.divIcon({
        html: `<div style="background-color:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${label || ''}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        className: '',
      })

    if (userLocation) {
      L.marker(userLocation, { icon: createCustomIcon('#10B981', 'S') })
        .bindPopup(
          '<div class="p-2"><h3 class="font-bold text-gray-900">Your Location</h3><p class="text-sm text-gray-600">Start Point</p></div>'
        )
        .addTo(mapInstance)
    }

    if (optimizedRoute?.polyline?.length > 0) {
      L.polyline(optimizedRoute.polyline as any, {
        color: '#4285F4',
        weight: 4,
        opacity: 0.8,
      }).addTo(mapInstance)
      optimizedRoute.routePoints.forEach((point: RoutePoint) => {
        const iconColor =
          point.type === 'start' ? '#10B981' : point.type === 'end' ? '#EA4335' : '#4285F4'
        const label =
          point.type === 'start'
            ? 'S'
            : point.type === 'end'
              ? 'E'
              : point.displayNumber?.toString() || ''

        L.marker(point.position, { icon: createCustomIcon(iconColor, label) })
          .bindPopup(
            `<div class="p-2"><h3 class="font-bold text-gray-900">${point.name}</h3><p class="text-sm text-gray-600">${point.address}</p>${point.orderNumber ? `<p class="text-sm text-gray-700 mt-1">Order: ${point.orderNumber}</p>` : ''}</div>`
          )
          .addTo(mapInstance)
      })
    } else if (routePoints.length > 0) {
      const points = routePoints.map((p: any) => p.position)
      if (points.length > 1)
        L.polyline(points as any, {
          color: '#6B7280',
          weight: 2,
          dashArray: '5,5',
          opacity: 0.6,
        }).addTo(mapInstance)
      routePoints.forEach((point: any) => {
        const iconColor =
          point.type === 'start' ? '#10B981' : point.type === 'end' ? '#EA4335' : '#4285F4'
        const label =
          point.type === 'start'
            ? 'S'
            : point.type === 'end'
              ? 'E'
              : point.displayNumber?.toString() || ''

        L.marker(point.position, { icon: createCustomIcon(iconColor, label) })
          .bindPopup(
            `<div class="p-2"><h3 class="font-bold text-gray-900">${point.name}</h3><p class="text-sm text-gray-600">${point.address}</p>${point.orderNumber ? `<p class="text-sm text-gray-700 mt-1">Order: ${point.orderNumber}</p>` : ''}</div>`
          )
          .addTo(mapInstance)
      })
    }

    if (!optimizedRoute) {
      orders
        .filter(
          (order: Order) =>
            order.shippingInfo?.latitude &&
            order.shippingInfo?.longitude &&
            selectedOrders.includes(order.id)
        )
        .forEach((order: Order) => {
          const isSelected = selectedOrders.includes(order.id)
          const circle = L.circleMarker(
            [order.shippingInfo.latitude, order.shippingInfo.longitude],
            {
              radius: 8,
              fillColor: isSelected ? '#FBBC04' : '#9CA3AF',
              color: '#ffffff',
              weight: 2,
              fillOpacity: 0.8,
            }
          ).addTo(mapInstance)

          circle
            .bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-gray-900">${getOrderNumber(order)}</h3>
              <p class="text-sm text-gray-600">${getCustomerName(order)}</p>
              <p class="text-sm text-gray-700 mt-1">${order.shippingInfo?.address || 'No address'}</p>
              <p class="text-xs text-gray-500">Amount: ${formatCurrency(order.total || order.totalAmount || 0)}</p>
              <button onclick="window.dispatchEvent(new CustomEvent('selectOrder', { detail: '${order.id}' }))" class="${isSelected ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} px-2 py-1 text-xs rounded mt-2">
                ${isSelected ? 'Deselect' : 'Select'}
              </button>
            </div>
          `)
            .on('click', () => toggleOrderSelection(order.id))
        })
    }

    if (!isDelivering) {
      const allPoints: [number, number][] = []
      if (userLocation) allPoints.push(userLocation)
      orders
        .filter(
          (o: Order) =>
            o.shippingInfo?.latitude && o.shippingInfo?.longitude && selectedOrders.includes(o.id)
        )
        .forEach((o: Order) => allPoints.push([o.shippingInfo.latitude, o.shippingInfo.longitude]))
      if (allPoints.length > 0)
        mapInstance.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50], maxZoom: 15 })
    }
  }, [mapInstance, optimizedRoute, routePoints, orders, selectedOrders, userLocation])

  useEffect(() => {
    if (!mapInstance || !vehiclePosition) return
    if (window.vehicleMarker) mapInstance.removeLayer(window.vehicleMarker)

    const vehicleIcon = L.divIcon({
      html: `<div style="position:relative;width:48px;height:48px;"><div style="position:absolute;top:4px;left:4px;width:40px;height:40px;background-color:#4285F4;border-radius:50%;border:4px solid white;box-shadow:0 4px 12px rgba(66,133,244,0.6);display:flex;align-items:center;justify-content:center;"><div style="width:16px;height:16px;background-color:white;border-radius:50%;"></div></div></div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      className: '',
    })

    window.vehicleMarker = L.marker(vehiclePosition, {
      icon: vehicleIcon,
      zIndexOffset: 1000,
    }).addTo(mapInstance)
    if (isDelivering) mapInstance.flyTo(vehiclePosition, 18, { duration: 1.5 })

    return () => {
      if (window.vehicleMarker) {
        mapInstance.removeLayer(window.vehicleMarker)
        delete window.vehicleMarker
      }
    }
  }, [mapInstance, vehiclePosition, isDelivering])

  useEffect(() => {
    const handleSelectOrder = (event: CustomEvent) => toggleOrderSelection(event.detail)
    window.addEventListener('selectOrder' as any, handleSelectOrder as EventListener)
    return () =>
      window.removeEventListener('selectOrder' as any, handleSelectOrder as EventListener)
  }, [toggleOrderSelection])

  return <div ref={mapRef} className="h-full w-full" />
}

export default function RoutePlanner() {
  const [searchParams] = useSearchParams()
  const [initialLoading, setInitialLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [logisticsStaff, setLogisticsStaff] = useState(false)
  const [userRdcLocation, setUserRdcLocation] = useState('South RDC')

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([7.8731, 80.7718])
  const [optimizedRoute, setOptimizedRoute] = useState<RouteOptimization | null>(null)
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])

  const [isDelivering, setIsDelivering] = useState(false)
  const [vehiclePosition, setVehiclePosition] = useState<[number, number] | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [navigationInstructions, setNavigationInstructions] = useState<NavigationInstruction[]>([])
  const [watchId, setWatchId] = useState<number | null>(null)

  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)
  const [currentOrderNumber, setCurrentOrderNumber] = useState<string | null>(null)
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '' })
  const [gettingLocation, setGettingLocation] = useState(true)
  const [isReturningToStart, setIsReturningToStart] = useState(false)

  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const saveAuditLog = async (
    action: string,
    details: string,
    orderId?: string,
    orderNumber?: string
  ) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        details,
        userId: user?.uid || '',
        userEmail: user?.email || '',
        performedBy: user?.email || '',
        userRole: 'Logistics Team',
        status: 'success',
        timestamp: new Date(),
        ...(orderId && { orderId }),
        ...(orderNumber && { orderNumber }),
        ...(userRdcLocation && { userRDC: userRdcLocation }),
      })
    } catch (error) {
      console.error('Error saving audit log:', error)
    }
  }

  const sendOrderStatusUpdateEmail = async (
    order: Order,
    newStatus: string,
    updateData: any,
    rdcStaffMember?: any,
    logisticsMember?: any
  ) => {
    try {
      let statusMessage = ''
      let statusColor = '#3b82f6'
      let statusIcon = '📦'
      let additionalInfo = ''

      switch (newStatus.toLowerCase()) {
        case 'confirmed':
          statusMessage = 'Your order has been confirmed and is being prepared.'
          statusColor = '#14b8a6'
          statusIcon = '✅'
          if (rdcStaffMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Your order is being processed at <strong>${rdcStaffMember.rdc || 'our warehouse'}</strong>.</p>`
          }
          break

        case 'processing':
          statusMessage = 'Your order is now being processed at our warehouse.'
          statusColor = '#6366f1'
          statusIcon = '⚙️'
          if (rdcStaffMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Processing at: <strong>${rdcStaffMember.rdc || 'Warehouse'}</strong></p>`
          }
          break

        case 'out_for_delivery':
        case 'out for delivery':
          statusMessage = 'Great news! Your order is out for delivery.'
          statusColor = '#f97316'
          statusIcon = '🚚'
          if (logisticsMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Delivery team: <strong>${logisticsMember.fullName}</strong></p>`
          }
          if (updateData?.estimatedDelivery) {
            const estimatedDate = new Date(updateData.estimatedDelivery)
            additionalInfo += `<p style="color: #6b7280; margin: 10px 0;">Estimated delivery: <strong>${estimatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>`
          }
          break

        case 'delivered':
          statusMessage = 'Your order has been successfully delivered!'
          statusColor = '#10b981'
          statusIcon = '✓'
          if (logisticsMember) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Delivered by: <strong>${logisticsMember.fullName}</strong></p>`
          }
          if (updateData?.deliveredAt) {
            const deliveredDate = new Date(updateData.deliveredAt)
            additionalInfo += `<p style="color: #6b7280; margin: 10px 0;">Delivered at: <strong>${deliveredDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${deliveredDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong></p>`
          }
          break

        case 'rejected':
        case 'cancelled':
          statusMessage = 'Your order has been cancelled.'
          statusColor = '#ef4444'
          statusIcon = '❌'
          if (updateData?.rejectionReason) {
            additionalInfo = `<p style="color: #6b7280; margin: 10px 0;">Reason: <strong>${updateData.rejectionReason}</strong></p>`
          }
          if (updateData?.cancelledAt) {
            const cancelledDate = new Date(updateData.cancelledAt)
            additionalInfo += `<p style="color: #6b7280; margin: 10px 0;">Cancelled on: <strong>${cancelledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>`
          }
          if (updateData?.refundStatus) {
            additionalInfo += `<p style="color: #6b7280; margin: 10px 0;">Refund status: <strong>${updateData.refundStatus}</strong></p>`
          }
          break

        default:
          statusMessage = `Your order status has been updated to: ${newStatus.replace('_', ' ').toUpperCase()}`
          statusIcon = '📋'
      }

      const fetchProductSKUs = async (items: any[]) => {
        const itemsWithSKU = []

        for (const item of items) {
          try {
            const productRef = doc(db, 'products', item.productId)
            const productDoc = await getDoc(productRef)

            if (productDoc.exists()) {
              const productData = productDoc.data()
              const skuValue = productData.sku || 'N/A'
              const itemName = item.productName || item.name || productData.name || 'Product'

              itemsWithSKU.push({
                ...item,
                sku: skuValue,
                productName: itemName,
                price: item.price || productData.price || 0,
                quantity: item.quantity || 1,
              })
            } else {
              itemsWithSKU.push({
                ...item,
                sku: 'N/A',
                productName: item.productName || item.name || 'Product',
                price: item.price || 0,
                quantity: item.quantity || 1,
              })
            }
          } catch (error) {
            itemsWithSKU.push({
              ...item,
              sku: 'N/A',
              productName: item.productName || item.name || 'Product',
              price: item.price || 0,
              quantity: item.quantity || 1,
            })
          }
        }

        return itemsWithSKU
      }

      const itemsWithSKU = await fetchProductSKUs(order.items)

      const orderItemsHtml = itemsWithSKU
        .map((item: any) => {
          return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 4px;">${item.productName}</div>
          <div style="color: #6b7280; font-size: 12px;">SKU: ${item.sku}</div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280; vertical-align: top;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #f97316; white-space: nowrap; vertical-align: top;">
          LKR ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}
        </td>
      </tr>
    `
        })
        .join('')

      const deliveredNote =
        newStatus.toLowerCase() === 'delivered'
          ? `
      <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #065f46; font-size: 14px;">
          <strong>🎉 Delivery Successful!</strong> Your order has been delivered. Please check your items and let us know if everything is as expected.
        </p>
      </div>
    `
          : ''

      const rejectedNote =
        newStatus.toLowerCase() === 'rejected' || newStatus.toLowerCase() === 'cancelled'
          ? `
      <div style="background: #fee2e2; border: 1px solid #ef4444; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
          <strong>⚠️ Order Cancelled</strong> ${updateData?.refundStatus === 'initiated' || updateData?.refundStatus === 'processing' ? 'Your refund has been initiated and will be processed within 5-7 business days.' : 'If you have any questions about this cancellation, please contact our support team.'}
        </p>
      </div>
    `
          : ''

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
          .cancelled-button { background: linear-gradient(135deg, #6b7280, #9ca3af); }
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
            <p style="font-size: 16px; color: #4b5563;">Dear <strong>${order.shippingInfo.fullName}</strong>,</p>
            <div class="order-id">
              <strong>Order ID: #${order.id}</strong>
            </div>
            <div class="status-box">
              <h2>${statusIcon} ${newStatus.replace('_', ' ').toUpperCase()}</h2>
              <p>${statusMessage}</p>
              ${additionalInfo}
            </div>
            ${deliveredNote}
            ${rejectedNote}
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
                  <td style="text-align: right; font-weight: 600;">LKR ${(order.subtotal ?? 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280;">Shipping Fee</td>
                  <td style="text-align: right; font-weight: 600; color: ${(order.shipping ?? 0) === 0 ? '#10b981' : '#1f2937'};">
                    ${(order.shipping ?? 0) === 0 ? 'FREE' : `LKR ${(order.shipping ?? 0).toLocaleString()}`}
                  </td>
                </tr>
                <tr class="total-row">
                  <td>Total Amount</td>
                  <td style="text-align: right;">LKR ${(order.total ?? 0).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            ${
              newStatus.toLowerCase() !== 'rejected' && newStatus.toLowerCase() !== 'cancelled'
                ? `
            <div class="section">
              <div class="section-title">🚚 Delivery Information</div>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                <p style="margin: 5px 0; color: #4b5563;"><strong>Name:</strong> ${order.shippingInfo.fullName}</p>
                <p style="margin: 5px 0; color: #4b5563;"><strong>Phone:</strong> ${order.shippingInfo.phone}</p>
                <p style="margin: 5px 0; color: #4b5563;"><strong>Address:</strong> ${order.shippingInfo.address}</p>
                <p style="margin: 5px 0; color: #4b5563;"><strong>City:</strong> ${order.shippingInfo.city}</p>
              </div>
            </div>
            `
                : ''
            }
            <div style="text-align: center; margin: 30px 0;">
              ${
                newStatus.toLowerCase() === 'rejected' || newStatus.toLowerCase() === 'cancelled'
                  ? `
                <a href="https://your-domain.com/support" class="button cancelled-button" style="color: white; text-decoration: none;">
                  Contact Support
                </a>
              `
                  : `
                <a href="https://your-domain.com/orders/${order.id}" class="button" style="color: white; text-decoration: none;">
                  ${newStatus.toLowerCase() === 'delivered' ? 'Leave a Review' : 'Track Your Order'}
                </a>
              `
              }
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

Dear ${order.shippingInfo.fullName},

${statusMessage}

ORDER DETAILS
Order ID: #${order.id}
Status: ${newStatus.replace('_', ' ').toUpperCase()}

${rdcStaffMember ? `Processing at: ${rdcStaffMember.rdc || 'Warehouse'}` : ''}
${logisticsMember ? `Delivery team: ${logisticsMember.fullName}` : ''}
${updateData?.estimatedDelivery ? `Estimated delivery: ${new Date(updateData.estimatedDelivery).toLocaleDateString()}` : ''}
${updateData?.deliveredAt ? `Delivered at: ${new Date(updateData.deliveredAt).toLocaleDateString()} ${new Date(updateData.deliveredAt).toLocaleTimeString()}` : ''}
${updateData?.rejectionReason ? `Cancellation reason: ${updateData.rejectionReason}` : ''}
${updateData?.refundStatus ? `Refund status: ${updateData.refundStatus}` : ''}

ORDER ITEMS
${itemsWithSKU
  .map((item: any) => {
    return `- ${item.productName}
  SKU: ${item.sku}
  Quantity: ${item.quantity}
  Total: LKR ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`
  })
  .join('\n\n')}

ORDER SUMMARY
Subtotal: LKR ${(order.subtotal ?? 0).toLocaleString()}
Shipping: ${(order.shipping ?? 0) === 0 ? 'FREE' : `LKR ${(order.shipping ?? 0).toLocaleString()}`}
Total: LKR ${(order.total ?? 0).toLocaleString()}

${
  newStatus.toLowerCase() !== 'rejected' && newStatus.toLowerCase() !== 'cancelled'
    ? `
DELIVERY ADDRESS
${order.shippingInfo.fullName}
${order.shippingInfo.phone}
${order.shippingInfo.address}
${order.shippingInfo.city}
`
    : ''
}

${
  newStatus.toLowerCase() === 'delivered'
    ? 'Your order has been delivered! Please check your items and let us know if everything is as expected.\n\nView order: https://your-domain.com/orders/' +
      order.id
    : newStatus.toLowerCase() === 'rejected' || newStatus.toLowerCase() === 'cancelled'
      ? 'Your order has been cancelled. If you have questions, please contact our support team.\n\nContact support: https://your-domain.com/support'
      : 'Track your order: https://your-domain.com/orders/' + order.id
}

Need help? Contact us at support@islandlink.com or call +94 77 123 4567

© ${new Date().getFullYear()} IslandLink Smart Distribution. All rights reserved.
    `

      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: order.shippingInfo.email,
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
      throw error
    }
  }

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return setUserLocation([7.8731, 80.7718])
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(loc)
        setMapCenter(loc)
        if (!routePoints.some((p) => p.type === 'start')) {
          setRoutePoints((prev) => [
            {
              id: 'user-location',
              name: 'My Location',
              address: 'Current Location',
              type: 'start',
              position: loc,
              sequence: 0,
            },
            ...prev.filter((p) => p.type !== 'start'),
          ])
        }
        setGettingLocation(false)
      },
      () => {
        const defaultLoc: [number, number] = [7.8731, 80.7718]
        setUserLocation(defaultLoc)
        setMapCenter(defaultLoc)
        if (!routePoints.some((p) => p.type === 'start')) {
          setRoutePoints((prev) => [
            {
              id: 'default-location',
              name: 'Sri Lanka Center',
              address: 'Center of Sri Lanka',
              type: 'start',
              position: defaultLoc,
              sequence: 0,
            },
            ...prev.filter((p) => p.type !== 'start'),
          ])
        }
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [routePoints])

  const updateDriverTrackingLocation = async (
    orderId: string,
    coordinates: { latitude: number; longitude: number; accuracy: number; speed?: number }
  ) => {
    try {
      console.log(`Updating driver tracking for order ${orderId}:`, coordinates)

      const orderRef = doc(db, 'orders', orderId)
      const orderDoc = await getDoc(orderRef)

      if (!orderDoc.exists()) {
        console.error('Order not found:', orderId)
        return
      }

      const timestamp = new Date()

      const lastCoordinates = {
        accuracy: coordinates.accuracy,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        timestamp: timestamp,
      }

      console.log(`Saving lastCoordinates for order ${orderId}:`, lastCoordinates)

      await updateDoc(orderRef, {
        'driverTracking.lastCoordinates': lastCoordinates,
        'driverTracking.vehicleStatus': 'on_delivery',
        updatedAt: timestamp,
      })

      console.log(`✓ Successfully updated driver tracking for order ${orderId}`)
    } catch (error) {
      console.error(`✗ Error updating driver tracking for order ${orderId}:`, error)
    }
  }

  const storeCoordinatesForAllOrders = async (coordinates: {
    latitude: number
    longitude: number
    accuracy: number
    speed?: number
  }) => {
    try {
      console.log('Storing coordinates for all orders:', {
        selectedOrders,
        coordinates,
        timestamp: new Date().toISOString(),
      })

      for (const orderId of selectedOrders) {
        await updateDriverTrackingLocation(orderId, coordinates)
      }

      console.log('Successfully stored coordinates for', selectedOrders.length, 'orders')
    } catch (error) {
      console.error('Error storing coordinates for all orders:', error)
    }
  }

  const optimizeRouteWithOSRM = async (routePoints: RoutePoint[]): Promise<RouteOptimization> => {
    if (routePoints.length < 2) throw new Error('Need at least 2 points for routing')

    console.log('Optimizing route with points:', routePoints.length)
    const coordinates = routePoints.map((p) => `${p.position[1]},${p.position[0]}`).join(';')

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`
      )
      const data = await response.json()

      if (data.code !== 'Ok') throw new Error('Routing failed')

      const route = data.routes[0]
      const polyline: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [
        c[1],
        c[0],
      ])

      const steps = route.legs.flatMap((leg: any) => leg.steps)
      const instructions: NavigationInstruction[] = steps.map((step: any) => ({
        instruction: step.maneuver.instruction,
        distance: step.distance,
        duration: step.duration,
        type: step.maneuver.type,
        location: [step.maneuver.location[1], step.maneuver.location[0]],
      }))

      const endPoint: RoutePoint = {
        id: 'end-point',
        name: 'Return to Start',
        address: routePoints[0].address,
        type: 'end',
        position: routePoints[0].position,
        sequence: routePoints.length,
      }

      const routePointsWithDisplayNumbers = routePoints.map((p, idx) => ({
        ...p,
        sequence: idx,
        displayNumber: p.type === 'delivery' ? idx : undefined,
      }))

      return {
        totalDistance: route.distance / 1000,
        totalTime: route.duration / 60,
        routePoints: [...routePointsWithDisplayNumbers, endPoint],
        polyline,
        instructions,
      }
    } catch (error) {
      console.error('OSRM routing error:', error)
      let totalDistance = 0
      for (let i = 0; i < routePoints.length - 1; i++) {
        totalDistance += calculateDistance(
          routePoints[i].position[0],
          routePoints[i].position[1],
          routePoints[i + 1].position[0],
          routePoints[i + 1].position[1]
        )
      }
      const polyline = routePoints.map((p) => p.position)

      const routePointsWithDisplayNumbers = routePoints.map((p, idx) => ({
        ...p,
        sequence: idx,
        displayNumber: p.type === 'delivery' ? idx : undefined,
      }))

      return {
        totalDistance,
        totalTime: (totalDistance / 40) * 60,
        routePoints: [
          ...routePointsWithDisplayNumbers,
          {
            id: 'end-point',
            name: 'Return to Start',
            address: routePoints[0].address,
            type: 'end',
            position: routePoints[0].position,
            sequence: routePoints.length,
          },
        ],
        polyline,
        instructions: [],
      }
    }
  }

  const loadRouteSession = async (sessionId: string) => {
    try {
      const sessionDoc = await getDoc(doc(db, 'routeSessions', sessionId))
      if (!sessionDoc.exists())
        return setSuccessModal({
          isOpen: true,
          title: 'Session Not Found',
          message: 'Session not found or deleted.',
        })

      const sessionData = sessionDoc.data() as any
      if (sessionData.userId !== user?.uid)
        return setSuccessModal({
          isOpen: true,
          title: 'Session Error',
          message: 'This session belongs to another user.',
        })

      setSelectedOrders(sessionData.selectedOrderIds)
      setSuccessModal({
        isOpen: true,
        title: 'Orders Loaded',
        message: `Loaded ${sessionData.selectedOrderIds.length} order(s).`,
      })
      await updateDoc(doc(db, 'routeSessions', sessionId), { isActive: false, usedAt: new Date() })
      saveAuditLog(
        'Load Route Session',
        `Loaded route planning session with ${sessionData.selectedOrderIds.length} orders`
      )
    } catch (error) {
      console.error('Error loading route session:', error)
      setSuccessModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load route planning session.',
      })
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount || 0)
  const getCustomerName = (order: Order) =>
    order.shippingInfo?.fullName ||
    order.customerName ||
    order.userEmail?.split('@')[0] ||
    'Customer'
  const getOrderNumber = (order: Order) =>
    order.orderNumber
      ? `#${order.orderNumber}`
      : `ORD-${order.id?.slice(-6).toUpperCase()}` || 'Order'

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins} min`
  }

  const autoRouteCreatedRef = useRef(false)

  useEffect(() => {
    if (user?.email && !isDelivering && userLocation && orders.length > 0) {
      const outForDeliveryOrders = orders
        .filter(
          (o) =>
            o.status === 'out for delivery' &&
            o.shippingInfo?.latitude &&
            o.updatedBy === user.email
        )
        .map((o) => o.id)

      if (
        outForDeliveryOrders.length > 0 &&
        selectedOrders.length === 0 &&
        !autoRouteCreatedRef.current
      ) {
        autoRouteCreatedRef.current = true
        setSelectedOrders(outForDeliveryOrders)
        setTimeout(() => {
          if (outForDeliveryOrders.length > 0) {
            addSelectedOrdersToRoute()
          }
        }, 1500)
      } else if (
        selectedOrders.length > 0 &&
        !optimizedRoute &&
        !processing &&
        !autoRouteCreatedRef.current
      ) {
        const validSelectedOrders = selectedOrders.filter((id) =>
          orders.some((o) => o.id === id && o.shippingInfo?.latitude)
        )
        if (validSelectedOrders.length > 0) {
          autoRouteCreatedRef.current = true
          setTimeout(() => {
            addSelectedOrdersToRoute()
          }, 1000)
        }
      }
    }
  }, [orders, user?.email, selectedOrders.length, optimizedRoute, isDelivering, userLocation])

  useEffect(() => {
    if (isDelivering && optimizedRoute && optimizedRoute.routePoints.length > currentStep) {
      const currentPoint = optimizedRoute.routePoints[currentStep]

      if (currentPoint.type === 'end') {
        setIsReturningToStart(true)
        setCurrentOrderId(null)
        setCurrentOrderNumber(null)
      } else {
        if (!isReturningToStart) {
          setCurrentOrderId(currentPoint?.orderId || null)
          setCurrentOrderNumber(currentPoint?.orderNumber || null)
        }
      }
    }
  }, [isDelivering, optimizedRoute, currentStep])

  const addSelectedOrdersToRoute = async () => {
    if (selectedOrders.length === 0) {
      console.log('No orders selected')
      return
    }

    setProcessing(true)
    try {
      const newRoutePoints: RoutePoint[] = selectedOrders
        .map((orderId) => orders.find((o) => o.id === orderId))
        .filter((order): order is Order => !!order && !!order.shippingInfo?.latitude)
        .map((order, idx) => ({
          id: order.id,
          name: getCustomerName(order),
          address: order.shippingInfo?.address || '',
          type: 'delivery' as const,
          orderId: order.id,
          orderNumber: getOrderNumber(order),
          position: [order.shippingInfo.latitude, order.shippingInfo.longitude] as [number, number],
          sequence: idx,
          displayNumber: idx + 1,
        }))

      if (newRoutePoints.length === 0) {
        console.log('No valid route points found')
        setSuccessModal({
          isOpen: true,
          title: 'No Valid Orders',
          message: "Selected orders don't have valid location coordinates.",
        })
        setProcessing(false)
        return
      }

      let startPoint = routePoints.find((p) => p.type === 'start')
      if (!startPoint && userLocation) {
        startPoint = {
          id: 'user-location',
          name: 'My Location',
          address: 'Current Location',
          type: 'start',
          position: userLocation,
          sequence: 0,
        }
      }

      const allRoutePoints = startPoint ? [startPoint, ...newRoutePoints] : newRoutePoints

      if (allRoutePoints.length < 2) {
        console.log('Insufficient route points:', allRoutePoints.length)
        setSuccessModal({
          isOpen: true,
          title: 'Insufficient Data',
          message: 'Need at least 2 locations (start point and 1 delivery) to create a route.',
        })
        setProcessing(false)
        return
      }

      const optimized = await optimizeRouteWithOSRM(allRoutePoints)

      setRoutePoints(allRoutePoints)
      setOptimizedRoute(optimized)
      setNavigationInstructions(optimized.instructions)

      setSuccessModal({
        isOpen: true,
        title: 'Route Created & Optimized',
        message: `Successfully created optimized route for ${newRoutePoints.length} order(s). Total distance: ${optimized.totalDistance.toFixed(2)} km`,
      })
      saveAuditLog(
        'Add and Optimize Route',
        `Added and optimized ${newRoutePoints.length} orders to delivery route`
      )
    } catch (error) {
      console.error('Error adding orders to route:', error)
      setSuccessModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to create optimized route. Please try again.',
      })
    } finally {
      setProcessing(false)
    }
  }

  const startRealTimeTracking = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser')
      return
    }

    console.log('Starting real-time tracking...')

    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current)
    }

    const trackingInterval = setInterval(async () => {
      console.log('Tracking interval fired - getting current position...')
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const coordinates = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 0,
              speed: pos.coords.speed || undefined,
            }

            console.log('Got position from geolocation:', coordinates)

            await storeCoordinatesForAllOrders(coordinates)

            setVehiclePosition([pos.coords.latitude, pos.coords.longitude])

            if (navigationInstructions.length > 0) {
              let closestIndex = 0
              let minDistance = Infinity
              navigationInstructions.forEach((inst, idx) => {
                const dist = calculateDistance(
                  pos.coords.latitude,
                  pos.coords.longitude,
                  inst.location[0],
                  inst.location[1]
                )
                if (dist < minDistance) {
                  minDistance = dist
                  closestIndex = idx
                }
              })
              if (minDistance < 0.1 && closestIndex !== currentStep) {
                setCurrentStep(closestIndex)
              }
            }
          },
          (error) => console.error('Error getting position in interval:', error),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }
    }, 5000)

    trackingIntervalRef.current = trackingInterval
    console.log('Tracking interval set up, ID:', trackingInterval)

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setVehiclePosition(newPos)

        if (navigationInstructions.length > 0) {
          let closestIndex = 0
          let minDistance = Infinity
          navigationInstructions.forEach((inst, idx) => {
            const dist = calculateDistance(newPos[0], newPos[1], inst.location[0], inst.location[1])
            if (dist < minDistance) {
              minDistance = dist
              closestIndex = idx
            }
          })
          if (minDistance < 0.1 && closestIndex !== currentStep) {
            setCurrentStep(closestIndex)
          }
        }
      },
      (error) => console.error('Error watching position:', error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )

    setWatchId(id)
    setIsDelivering(true)
    console.log('Watch position started, ID:', id)
  }

  const stopRealTimeTracking = async () => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current)
      trackingIntervalRef.current = null
    }

    if (watchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
    }

    for (const orderId of selectedOrders) {
      try {
        const orderRef = doc(db, 'orders', orderId)
        await updateDoc(orderRef, {
          'driverTracking.vehicleStatus': 'stopped',
          updatedAt: new Date(),
        })
      } catch (error) {
        console.error(`Error updating vehicle status for order ${orderId}:`, error)
      }
    }

    setWatchId(null)
    setIsDelivering(false)
    setVehiclePosition(null)
    setCurrentStep(0)
    setCurrentOrderId(null)
    setCurrentOrderNumber(null)
    setIsReturningToStart(false)
    autoRouteCreatedRef.current = false
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    setProcessing(true)
    try {
      const orderRef = doc(db, 'orders', orderId)
      const order = orders.find((o) => o.id === orderId)

      const orderDoc = await getDoc(orderRef)
      const currentOrder = orderDoc.data()
      const currentStatusUpdates = currentOrder?.statusUpdates || []
      const currentPayStatus = currentOrder?.pay || 'pending'

      const newStatusUpdate = {
        status: status,
        timestamp: new Date(),
        updatedBy: user?.email,
        updatedByRDC: userRdcLocation,
        updatedByRole: 'Logistics Team',
      }

      const updatedStatusUpdates = [...currentStatusUpdates, newStatusUpdate]

      const updateData: any = {
        status: status,
        statusUpdates: updatedStatusUpdates,
        updatedAt: new Date(),
        updatedBy: user?.email,
      }

      if (status === 'delivered') {
        updateData.deliveredAt = new Date()
        updateData['driverTracking.vehicleStatus'] = 'delivered'
        if (currentPayStatus === 'pending') {
          updateData.pay = 'paid'
          updateData.paidAt = new Date()
          updateData.paymentMethod = 'cod'
        }
      } else if (status === 'rejected') {
        updateData.rejectedAt = new Date()
        updateData.rejectionReason = 'Rejected during delivery'
        updateData['driverTracking.vehicleStatus'] = 'rejected'
      }

      await updateDoc(orderRef, updateData)

      if (order) await sendOrderStatusUpdateEmail(order, status, updateData)

      if (status === 'delivered' || status === 'rejected') {
        setSelectedOrders((prev) => prev.filter((id) => id !== orderId))
        const remainingRoutePoints = routePoints.filter((p) => p.orderId !== orderId)
        setRoutePoints(remainingRoutePoints)

        const remainingDeliveries = remainingRoutePoints.filter((p) => p.type === 'delivery')

        if (remainingDeliveries.length > 0) {
          const optimized = await optimizeRouteWithOSRM(remainingRoutePoints)
          setOptimizedRoute(optimized)
          setNavigationInstructions(optimized.instructions)
          setCurrentStep(0)
        } else {
          console.log('All deliveries complete!')
          setIsReturningToStart(true)

          if (vehiclePosition && userLocation) {
            try {
              const returnRoute = await createReturnToStartRoute()
              setOptimizedRoute(returnRoute)
              setNavigationInstructions(returnRoute.instructions)
              setCurrentStep(0)

              setSuccessModal({
                isOpen: true,
                title: 'All Deliveries Complete!',
                message: "Click 'Complete Route' to finish and return to start point.",
              })
            } catch (error) {
              console.error('Error creating return route:', error)
              setSuccessModal({
                isOpen: true,
                title: 'Deliveries Complete',
                message: "All orders delivered! Click 'Complete Route' to finish.",
              })
            }
          } else {
            setOptimizedRoute(null)
            setNavigationInstructions([])
            setSuccessModal({
              isOpen: true,
              title: 'All Deliveries Complete!',
              message: "Click 'Complete Route' to finish and return to dashboard.",
            })
          }
        }

        setSuccessModal({
          isOpen: true,
          title: `Order ${status === 'delivered' ? 'Delivered' : 'Rejected'}`,
          message: `Order has been marked as ${status} successfully.${
            status === 'delivered' && currentPayStatus === 'pending'
              ? ' Payment status changed to Paid.'
              : ''
          }${remainingDeliveries.length === 0 ? ' All deliveries complete!' : ''}`,
        })
        saveAuditLog(
          status === 'delivered' ? 'Mark Order as Delivered' : 'Reject Order',
          `${status === 'delivered' ? 'Marked' : 'Rejected'} order${status === 'delivered' && currentPayStatus === 'pending' ? ' and updated payment status to paid' : ''}`,
          orderId,
          getOrderNumber(order || ({} as Order))
        )
      }
    } catch (error) {
      console.error(
        `Error ${status === 'delivered' ? 'marking order as delivered' : 'rejecting order'}:`,
        error
      )
      setSuccessModal({ isOpen: true, title: 'Error', message: `Failed to ${status} order.` })
    } finally {
      setProcessing(false)
    }
  }

  const createReturnToStartRoute = async (): Promise<RouteOptimization> => {
    if (!vehiclePosition || !userLocation) throw new Error('Missing location data')

    const currentPos: RoutePoint = {
      id: 'current-position',
      name: 'Current Location',
      address: 'Your current position',
      type: 'delivery',
      position: vehiclePosition,
      sequence: 0,
    }

    const startPos: RoutePoint = {
      id: 'start-location',
      name: 'Start Location',
      address: 'Return to starting point',
      type: 'end',
      position: userLocation,
      sequence: 1,
    }

    return await optimizeRouteWithOSRM([currentPos, startPos])
  }

  const returnToStart = async () => {
    await stopRealTimeTracking()
    setRoutePoints([])
    setOptimizedRoute(null)
    setNavigationInstructions([])
    setSelectedOrders([])
    setIsReturningToStart(false)
    autoRouteCreatedRef.current = false
    setSuccessModal({
      isOpen: true,
      title: 'Route Completed',
      message: 'All deliveries completed successfully. You have returned to the starting point.',
    })
    saveAuditLog('Complete Route', 'Driver completed delivery route and returned to start')
  }

  const startDelivery = async () => {
    if (!optimizedRoute)
      return setSuccessModal({
        isOpen: true,
        title: 'Route Not Created',
        message: 'Please wait for the route to be created.',
      })
    setProcessing(true)
    try {
      const deliveryPoints = optimizedRoute.routePoints.filter((p) => p.type === 'delivery')

      const getInitialLocation = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
          if (userLocation) {
            resolve({
              coords: {
                latitude: userLocation[0],
                longitude: userLocation[1],
                accuracy: 0,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            } as GeolocationPosition)
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            })
          }
        })
      }

      let initialPosition: GeolocationPosition
      try {
        initialPosition = await getInitialLocation()
      } catch (error) {
        console.error('Error getting initial location:', error)
        setSuccessModal({
          isOpen: true,
          title: 'Location Error',
          message: 'Failed to get your location. Please enable location services.',
        })
        setProcessing(false)
        return
      }

      const initialCoordinates = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
        accuracy: initialPosition.coords.accuracy || 0,
        timestamp: new Date(),
      }

      for (const point of deliveryPoints) {
        if (point.orderId) {
          const orderRef = doc(db, 'orders', point.orderId)
          const orderDoc = await getDoc(orderRef)
          const currentOrder = orderDoc.data()
          const currentStatusUpdates = currentOrder?.statusUpdates || []

          const newStatusUpdate = {
            status: 'out for delivery',
            timestamp: new Date(),
            updatedBy: user?.email,
            updatedByRDC: userRdcLocation,
            updatedByRole: 'Logistics Team',
          }

          const updatedStatusUpdates = [...currentStatusUpdates, newStatusUpdate]

          const driverTracking: DriverTracking = {
            deliveryStartedAt: new Date(),
            driverEmail: user?.email || '',
            driverId: user?.uid || '',
            routeCreatedAt: new Date(),
            selectedOrderIds: selectedOrders,
            vehicleStatus: 'on_delivery',
            estimatedDelivery: new Date(Date.now() + optimizedRoute.totalTime * 60 * 1000),
            lastCoordinates: initialCoordinates,
          }

          await updateDoc(orderRef, {
            status: 'out for delivery',
            statusUpdates: updatedStatusUpdates,
            deliveryStartedAt: new Date(),
            estimatedDelivery: new Date(Date.now() + optimizedRoute.totalTime * 60 * 1000),
            driverTracking: driverTracking,
            updatedAt: new Date(),
            updatedBy: user?.email,
          })

          const order = orders.find((o) => o.id === point.orderId)
          if (order) await sendOrderStatusUpdateEmail(order, 'out for delivery', {})
          saveAuditLog(
            'Start Delivery',
            `Started delivery for order ${point.orderNumber}`,
            point.orderId,
            point.orderNumber
          )
        }
      }

      setVehiclePosition([initialCoordinates.latitude, initialCoordinates.longitude])
      startRealTimeTracking()

      setSuccessModal({
        isOpen: true,
        title: 'Delivery Started',
        message: `Started delivery for ${deliveryPoints.length} orders with real-time tracking.`,
      })
      saveAuditLog(
        'Delivery Started',
        `Started delivery for ${deliveryPoints.length} orders. Route distance: ${optimizedRoute.totalDistance.toFixed(2)} km`
      )
    } catch (error) {
      console.error('Error starting delivery:', error)
      setSuccessModal({ isOpen: true, title: 'Error', message: 'Failed to start delivery.' })
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) return (window.location.href = '/login')
      setUser(currentUser)
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        if (!userDoc.exists()) return (window.location.href = '/')
        const userData = userDoc.data()
        const isLogisticsStaff = [
          'logistics team',
          'logistics manager',
          'admin',
          'rdc staff',
        ].includes(userData.role?.toLowerCase())
        setLogisticsStaff(isLogisticsStaff)
        if (!isLogisticsStaff) return (window.location.href = '/')
        setUserRdcLocation(userData.rdc || 'South RDC')
        getUserLocation()

        const ordersUnsubscribe = onSnapshot(
          collection(db, 'orders'),
          (snapshot) => {
            const allOrders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Order[]
            const readyOrders = allOrders
              .filter(
                (o) =>
                  ['processing', 'route_optimized', 'out for delivery'].includes(o.status) &&
                  o.shippingInfo?.latitude &&
                  o.shippingInfo?.longitude
              )
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            setOrders(readyOrders)
            setLoading(false)
          },
          (error) => {
            console.error('Error listening to orders:', error)
            setLoading(false)
          }
        )

        setInitialLoading(false)
        saveAuditLog(
          'Route Planner Access',
          `User ${currentUser.email} accessed route planning page`
        )
        return ordersUnsubscribe
      } catch (error) {
        console.error('Error checking logistics staff status:', error)
        window.location.href = '/'
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const sessionId = searchParams.get('session')
    if (sessionId && user) loadRouteSession(sessionId)
  }, [searchParams, user])

  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current)
      }
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  const selectedOrdersData = orders.filter((order) => selectedOrders.includes(order.id))
  const selectedOrdersWithCoordinates = selectedOrdersData.filter(
    (order) => order.shippingInfo?.latitude
  ).length

  if (initialLoading || gettingLocation) {
    return (
      <div className="min-h-screen bg-linear-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading route planner...</p>
          <p className="text-sm text-gray-400 mt-1">Getting your location</p>
        </div>
      </div>
    )
  }

  if (!logisticsStaff) {
    return (
      <div className="min-h-screen bg-linear-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-blue-50 to-purple-50 relative">
      <LogisticsNavbar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Route Planner</h1>
              <p className="text-gray-600 mt-2">
                Automated route optimization with real-time delivery tracking
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-linear-to-r from-green-500 to-blue-600 text-white text-sm font-semibold rounded-full">
                Live Tracking
              </span>
              <button
                onClick={getUserLocation}
                className="px-4 py-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                Refresh Location
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <p className="text-sm text-gray-600">Selected Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{selectedOrders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <p className="text-sm text-gray-600">With Coordinates</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {selectedOrdersWithCoordinates}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <p className="text-sm text-gray-600">Route Points</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{routePoints.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <p className="text-sm text-gray-600">Delivery Status</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">
              {isReturningToStart ? 'Returning' : isDelivering ? 'Active' : 'Ready'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Current Location</h3>
              {userLocation ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">Your location is set</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Latitude: {userLocation[0].toFixed(6)}</p>
                    <p>Longitude: {userLocation[1].toFixed(6)}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">Location not set</p>
                  <button
                    onClick={getUserLocation}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    Get My Location
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Route Controls</h3>
              <div className="space-y-4">
                {processing && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-blue-700 font-medium">
                        Creating optimized route...
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={startDelivery}
                  disabled={!optimizedRoute || processing || isDelivering}
                  className={`w-full px-4 py-3 font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                    optimizedRoute && !processing && !isDelivering
                      ? 'bg-linear-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {processing ? <>Starting...</> : <>Start Delivery</>}
                </button>
                {isDelivering && (
                  <button
                    onClick={stopRealTimeTracking}
                    className="w-full px-4 py-3 bg-linear-to-r from-yellow-500 to-yellow-600 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition flex items-center justify-center gap-2"
                  >
                    Stop Delivery
                  </button>
                )}
              </div>
              {optimizedRoute && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Route Information</h4>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Distance:</span>
                      <span className="font-bold text-gray-900">
                        {optimizedRoute.totalDistance.toFixed(2)} km
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimated Time:</span>
                      <span className="font-bold text-gray-900">
                        {formatTime(optimizedRoute.totalTime)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stops:</span>
                      <span className="font-bold text-gray-900">
                        {optimizedRoute.routePoints.filter((p) => p.type === 'delivery').length}{' '}
                        locations
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DeliveryOrdersPanel
              selectedOrders={selectedOrders}
              orders={orders}
              currentOrderId={currentOrderId || undefined}
              onMarkDelivered={(id: string) => updateOrderStatus(id, 'delivered')}
              onRejectOrder={(id: string) => updateOrderStatus(id, 'rejected')}
              onReturnToStart={returnToStart}
              getOrderNumber={getOrderNumber}
              getCustomerName={getCustomerName}
              formatCurrency={formatCurrency}
              isDelivering={isDelivering}
              isReturningToStart={isReturningToStart}
              optimizedRoute={optimizedRoute}
            />
          </div>

          <div className="lg:col-span-2 relative">
            <NavigationPanel
              navigationInstructions={navigationInstructions}
              currentStep={currentStep}
              isDelivering={isDelivering}
              currentOrderNumber={currentOrderNumber || undefined}
              isReturningToStart={isReturningToStart}
            />
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden h-150">
              {loading ? (
                <MapLoading />
              ) : (
                <SimpleMap
                  mapCenter={mapCenter}
                  mapZoom={13}
                  optimizedRoute={optimizedRoute}
                  routePoints={routePoints}
                  orders={orders}
                  selectedOrders={selectedOrders}
                  toggleOrderSelection={(id: string) =>
                    setSelectedOrders((prev) =>
                      prev.includes(id) ? prev.filter((orderId) => orderId !== id) : [...prev, id]
                    )
                  }
                  getOrderNumber={getOrderNumber}
                  getCustomerName={getCustomerName}
                  formatCurrency={formatCurrency}
                  userLocation={userLocation}
                  onMapReady={(map: L.Map) =>
                    setTimeout(
                      () =>
                        map.fitBounds(
                          L.latLngBounds([
                            ...orders
                              .filter(
                                (o) => selectedOrders.includes(o.id) && o.shippingInfo?.latitude
                              )
                              .map(
                                (o) =>
                                  [o.shippingInfo.latitude, o.shippingInfo.longitude] as [
                                    number,
                                    number,
                                  ]
                              ),
                            ...(userLocation ? [userLocation] : []),
                          ]),
                          { padding: [50, 50] }
                        ),
                      500
                    )
                  }
                  isDelivering={isDelivering}
                  vehiclePosition={vehiclePosition}
                  currentStep={currentStep}
                />
              )}
            </div>
            <div className="mt-4 bg-white rounded-xl shadow p-4 border border-gray-100">
              <h4 className="font-semibold text-gray-900 mb-3">Map Legend</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-700">Start Point</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                  <span className="text-xs text-gray-700">Delivery Point</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-700">End Point</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-700">Delivery Vehicle</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
      />
    </div>
  )
}
