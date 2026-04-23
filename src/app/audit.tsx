'use client'

import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import AdminNavbar from '../components/Adminnavbar'
import { db, auth } from '../lib/firebase'

interface AuditLog {
  id: string
  action: string
  details: string
  performedBy: string
  timestamp: any
  userId?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  status?: string
}

interface AuditFilters {
  action: string
  user: string
  dateRange: string
  search: string
}

export default function AuditLogs() {
  const [loading, setLoading] = useState(true)
  const [currentAdminUser, setCurrentAdminUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([])
  const [filters, setFilters] = useState<AuditFilters>({
    action: 'all',
    user: 'all',
    dateRange: 'all',
    search: '',
  })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [users, setUsers] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    uniqueUsers: 0,
  })

  // New state for confirmation and feedback modals
  const [showClearModal, setShowClearModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [modalTitle, setModalTitle] = useState('')
  const [clearingLogs, setClearingLogs] = useState(false)

  // Check authentication and user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setCurrentAdminUser(currentUser)

      // Check if user is admin by checking their role in Firestore
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const isUserAdmin = userData.role === 'admin'
          setIsAdmin(isUserAdmin)

          if (!isUserAdmin) {
            window.location.href = '/'
            return
          }
        } else {
          window.location.href = '/'
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        window.location.href = '/'
      }
    })

    return () => unsubscribe()
  }, [])

  // Setup real-time listener for audit logs when admin is confirmed
  useEffect(() => {
    if (isAdmin) {
      const unsubscribe = setupAuditLogsListener()
      return () => {
        if (unsubscribe) unsubscribe()
      }
    }
  }, [isAdmin])

  // Setup real-time listener for audit logs
  const setupAuditLogsListener = () => {
    try {
      const auditLogsQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'))

      const unsubscribe = onSnapshot(
        auditLogsQuery,
        (snapshot) => {
          const logsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as AuditLog[]

          setAuditLogs(logsData)
          extractFiltersData(logsData)
          calculateStats(logsData)
          applyFilters(logsData)

          setLoading(false)
        },
        (error) => {
          console.error('Error listening to audit logs:', error)
          setLoading(false)
          showInfoMessage('Error', 'Failed to load audit logs. Please refresh the page.')
        }
      )

      return unsubscribe
    } catch (error) {
      console.error('Error setting up audit logs listener:', error)
      setLoading(false)
      showInfoMessage('Error', 'Failed to set up audit log listener.')
      return () => {}
    }
  }

  // Show information modal
  const showInfoMessage = (title: string, message: string) => {
    setModalTitle(title)
    setModalMessage(message)
    setShowInfoModal(true)
  }

  // Extract unique users and actions for filters
  const extractFiltersData = (logsData: AuditLog[]) => {
    const uniqueUsers = new Set<string>()
    const uniqueActions = new Set<string>()

    logsData.forEach((log) => {
      if (log.performedBy) uniqueUsers.add(log.performedBy)
      if (log.action) uniqueActions.add(log.action)
    })

    setUsers(Array.from(uniqueUsers).sort())
    setActions(Array.from(uniqueActions).sort())
  }

  // Calculate statistics
  const calculateStats = (logsData: AuditLog[]) => {
    const totalLogs = logsData.length

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayLogs = logsData.filter((log) => {
      const logDate = log.timestamp?.seconds
        ? new Date(log.timestamp.seconds * 1000)
        : log.timestamp?.toDate
          ? log.timestamp.toDate()
          : new Date(log.timestamp)
      return logDate >= today
    }).length

    const uniqueUsers = new Set(logsData.map((log) => log.performedBy)).size

    setStats({
      totalLogs,
      todayLogs,
      uniqueUsers,
    })
  }

  // Apply filters whenever logs or filters change
  useEffect(() => {
    applyFilters(auditLogs)
  }, [auditLogs, filters])

  const applyFilters = (logsData: AuditLog[]) => {
    let result = [...logsData]

    // Apply action filter
    if (filters.action !== 'all') {
      result = result.filter((log) => log.action === filters.action)
    }

    // Apply user filter
    if (filters.user !== 'all') {
      result = result.filter((log) => log.performedBy === filters.user)
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      let startDate = new Date()

      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1)
          break
      }

      result = result.filter((log) => {
        const logDate = log.timestamp?.seconds
          ? new Date(log.timestamp.seconds * 1000)
          : log.timestamp?.toDate
            ? log.timestamp.toDate()
            : new Date(log.timestamp)
        return logDate >= startDate
      })
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      result = result.filter((log) => {
        const action = log.action?.toLowerCase() || ''
        const details = log.details?.toLowerCase() || ''
        const performedBy = log.performedBy?.toLowerCase() || ''
        const userId = log.userId?.toLowerCase() || ''
        const userEmail = log.userEmail?.toLowerCase() || ''

        return (
          action.includes(searchTerm) ||
          details.includes(searchTerm) ||
          performedBy.includes(searchTerm) ||
          userId.includes(searchTerm) ||
          userEmail.includes(searchTerm)
        )
      })
    }

    setFilteredLogs(result)
  }

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleViewLog = (log: AuditLog) => {
    setSelectedLog(log)
    setShowLogModal(true)
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
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch (error) {
      return 'N/A'
    }
  }

  // Format relative time
  const formatRelativeTime = (timestamp: any) => {
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

      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

      if (diffInSeconds < 60) {
        return 'Just now'
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60)
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600)
        return `${hours} hour${hours > 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400)
        return `${days} day${days > 1 ? 's' : ''} ago`
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      }
    } catch (error) {
      return 'N/A'
    }
  }

  // Get action badge color
  const getActionColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'create':
      case 'add':
      case 'register':
        return 'bg-green-100 text-green-800'
      case 'update':
      case 'edit':
      case 'modify':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
      case 'remove':
        return 'bg-red-100 text-red-800'
      case 'login':
      case 'signin':
        return 'bg-purple-100 text-purple-800'
      case 'logout':
      case 'signout':
        return 'bg-gray-100 text-gray-800'
      case 'purchase':
      case 'order':
        return 'bg-amber-100 text-amber-800'
      case 'view':
      case 'read':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Extract user from email
  const getUserFromEmail = (email: string) => {
    if (!email) return 'Unknown'
    return email.split('@')[0]
  }

  // Get user ID for display
  const getDisplayUserId = (userId?: string) => {
    if (!userId || userId.trim() === '') return 'N/A'
    if (userId.length > 20) {
      return `${userId.substring(0, 8)}...${userId.substring(userId.length - 4)}`
    }
    return userId
  }

  // Export logs to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      showInfoMessage('No Data', 'There are no logs to export.')
      return
    }

    try {
      const headers = [
        'ID',
        'Action',
        'Details',
        'Performed By',
        'User ID',
        'User Email',
        'Timestamp',
        'Status',
        'IP Address',
      ]
      const csvRows = [
        headers.join(','),
        ...filteredLogs.map((log) =>
          [
            log.id,
            `"${log.action || ''}"`,
            `"${log.details?.replace(/"/g, '""') || ''}"`,
            `"${log.performedBy || ''}"`,
            `"${log.userId || ''}"`,
            `"${log.userEmail || ''}"`,
            `"${formatTimestamp(log.timestamp)}"`,
            `"${log.status || ''}"`,
            `"${log.ipAddress || ''}"`,
          ].join(',')
        ),
      ]

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      showInfoMessage('Export Successful', `Exported ${filteredLogs.length} audit logs to CSV.`)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      showInfoMessage('Export Failed', 'Failed to export audit logs. Please try again.')
    }
  }

  // Clear all logs - Open confirmation modal
  const openClearConfirmation = () => {
    if (stats.totalLogs === 0) {
      showInfoMessage('No Logs', 'There are no audit logs to clear.')
      return
    }
    setShowClearModal(true)
  }

  // Actually clear all logs from Firestore
  const clearAllLogs = async () => {
    setClearingLogs(true)
    setShowClearModal(false)

    try {
      // Get all audit log documents
      const auditLogsRef = collection(db, 'auditLogs')
      const auditLogsSnapshot = await getDocs(auditLogsRef)

      if (auditLogsSnapshot.empty) {
        showInfoMessage('No Logs', 'There are no audit logs to clear.')
        setClearingLogs(false)
        return
      }

      // Create a batch to delete all documents
      const batch = writeBatch(db)
      auditLogsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })

      // Commit the batch
      await batch.commit()

      // Log the clear action
      try {
        const auditLogRef = doc(collection(db, 'auditLogs'))
        await writeBatch(db)
          .set(auditLogRef, {
            action: 'clear_all_logs',
            details: `Cleared all audit logs (${stats.totalLogs} records)`,
            performedBy: currentAdminUser?.email || 'Admin',
            userId: currentAdminUser?.uid,
            userEmail: currentAdminUser?.email,
            timestamp: new Date(),
            status: 'success',
            ipAddress: 'System',
          })
          .commit()
      } catch (logError) {
        console.error('Failed to log clear action:', logError)
      }

      showInfoMessage('Success', `Successfully cleared all ${stats.totalLogs} audit logs.`)
    } catch (error) {
      console.error('Error clearing audit logs:', error)
      showInfoMessage('Error', 'Failed to clear audit logs. Please try again.')
    } finally {
      setClearingLogs(false)
    }
  }

  // If not admin, show loading or redirect
  if (!isAdmin && loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <AdminNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-gray-600 mt-2">Track all system activities and user actions</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export CSV
              </button>
              <button
                onClick={openClearConfirmation}
                className="px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 hover:bg-red-100 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={clearingLogs}
              >
                {clearingLogs ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-700"></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Clear All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalLogs}</p>
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">All time audit logs</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Logs</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.todayLogs}</p>
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Activities in last 24 hours</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.uniqueUsers}</p>
              </div>
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13 0h-6"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Users who performed actions</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Logs</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
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
                </div>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                  placeholder="Search by action, details, user..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                aria-label="Filter by action type"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
              >
                <option value="all">All Actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User</label>
              <select
                value={filters.user}
                onChange={(e) => handleFilterChange('user', e.target.value)}
                aria-label="Filter by user"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
              >
                <option value="all">All Users</option>
                {users.map((user) => (
                  <option key={user} value={user}>
                    {getUserFromEmail(user)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                aria-label="Filter by date range"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last Year</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() =>
                setFilters({
                  action: 'all',
                  user: 'all',
                  dateRange: 'all',
                  search: '',
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

        {/* Audit Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Audit Logs ({filteredLogs.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-gray-500 mt-2">No audit logs found</p>
              <p className="text-gray-400 text-sm mt-1">Try changing your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}
                          >
                            {log.action}
                          </span>
                          {log.status && (
                            <span
                              className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}
                            >
                              {log.status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {log.details}
                          </div>
                          {log.userId && (
                            <div className="text-xs text-gray-500 mt-1">
                              User ID: {getDisplayUserId(log.userId)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getUserFromEmail(log.performedBy)}
                          </div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {log.performedBy}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm text-gray-900">
                            {formatRelativeTime(log.timestamp)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTimestamp(log.timestamp)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewLog(log)}
                          className="text-cyan-600 hover:text-cyan-900 transition flex items-center gap-1"
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination (Optional - for large datasets) */}
        {filteredLogs.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to{' '}
              <span className="font-medium">{Math.min(50, filteredLogs.length)}</span> of{' '}
              <span className="font-medium">{filteredLogs.length}</span> logs
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                Next
              </button>
            </div>
          </div>
        )}

        {/* Log Details Modal */}
        {showLogModal && selectedLog && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={() => setShowLogModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Audit Log Details</h3>
                      <p className="text-sm text-gray-600 mt-1">ID: {selectedLog.id}</p>
                    </div>
                    <button
                      onClick={() => setShowLogModal(false)}
                      aria-label="Close log details"
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

                  <div className="space-y-6">
                    {/* Action Info */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Action Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Action Type</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getActionColor(selectedLog.action)}`}
                            >
                              {selectedLog.action}
                            </span>
                            {selectedLog.status && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium ${getStatusColor(selectedLog.status)}`}
                              >
                                {selectedLog.status}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Timestamp</p>
                          <p className="font-medium text-gray-900 mt-1">
                            {formatTimestamp(selectedLog.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Details</h4>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-gray-900 whitespace-pre-wrap">{selectedLog.details}</p>
                      </div>
                    </div>

                    {/* User Information */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">User Information</h4>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Performed By</p>
                            <p className="font-medium text-gray-900 mt-1">
                              {selectedLog.performedBy || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">User ID</p>
                            <p className="font-medium text-gray-900 mt-1 text-sm truncate">
                              {getDisplayUserId(selectedLog.userId)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">User Email</p>
                            <p className="font-medium text-gray-900 mt-1">
                              {selectedLog.userEmail || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Additional Information
                      </h4>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedLog.ipAddress && (
                            <div>
                              <p className="text-xs text-gray-500">IP Address</p>
                              <p className="font-medium text-gray-900 mt-1">
                                {selectedLog.ipAddress}
                              </p>
                            </div>
                          )}
                          {selectedLog.userAgent && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500">User Agent</p>
                              <p className="font-medium text-gray-900 mt-1 text-sm truncate">
                                {selectedLog.userAgent}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Raw Data (for debugging) */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Raw Data</h4>
                      <div className="bg-gray-900 rounded-xl p-4">
                        <pre className="text-xs text-gray-300 overflow-auto">
                          {JSON.stringify(selectedLog, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Clear Confirmation Modal */}
        {showClearModal && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={() => setShowClearModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Clear Audit Logs</h3>
                    <button
                      onClick={() => setShowClearModal(false)}
                      aria-label="Close clear confirmation"
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

                  <div className="mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.342 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                    <p className="text-center text-gray-700 mb-2">
                      Are you sure you want to clear all audit logs?
                    </p>
                    <p className="text-center text-sm text-gray-500">
                      This action will delete all {stats.totalLogs} audit logs and cannot be undone.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowClearModal(false)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                      disabled={clearingLogs}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={clearAllLogs}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={clearingLogs}
                    >
                      {clearingLogs ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          Clearing...
                        </div>
                      ) : (
                        'Clear All Logs'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Information Modal */}
        {showInfoModal && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={() => setShowInfoModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">{modalTitle}</h3>
                    <button
                      onClick={() => setShowInfoModal(false)}
                      aria-label="Close information modal"
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

                  <div className="mb-6">
                    <p className="text-gray-700">{modalMessage}</p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowInfoModal(false)}
                      className="px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
