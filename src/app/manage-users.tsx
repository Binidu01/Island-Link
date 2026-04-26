'use client'

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { collection, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

import AdminNavbar from '../components/Adminnavbar'
import { db, auth } from '../lib/firebase'

interface User {
  id: string
  fullName: string
  email: string
  role: string
  phone: string
  photoURL: string
  createdAt: any
  uid: string
  address?: string
  city?: string
  postalCode?: string
  rdc?: string
}

interface UserFilters {
  role: string
  search: string
  rdc: string
}

export default function ManageUsers() {
  const [loading, setLoading] = useState(true)
  const [currentAdminUser, setCurrentAdminUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [filters, setFilters] = useState<UserFilters>({
    role: 'all',
    search: '',
    rdc: '',
  })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    role: 'customer',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    rdc: '',
  })
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    role: 'customer',
    phone: '',
    password: '',
    confirmPassword: '',
    rdc: '',
  })
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [pendingUserData, setPendingUserData] = useState<any>(null)

  const roles = ['customer', 'admin', 'RDC Staff', 'HO Manager', 'Logistics Team']

  const rdcLocations = ['North RDC', 'South RDC', 'East RDC', 'West RDC', 'Central RDC']

  const logAuditAction = async (action: string, details: string, userId?: string) => {
    try {
      const auditLogData = {
        action,
        details,
        performedBy: currentAdminUser?.email || 'system',
        timestamp: new Date(),
        userId: userId || null,
        userEmail: currentAdminUser?.email || 'system',
        status: 'success',
      }
      await setDoc(doc(collection(db, 'auditLogs')), auditLogData)
    } catch (error) {
      console.error('Error creating audit log:', error)
    }
  }

  const showSuccess = (message: string) => {
    setModalMessage(message)
    setShowSuccessModal(true)
  }

  const showError = (message: string) => {
    setModalMessage(message)
    setShowErrorModal(true)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setCurrentAdminUser(currentUser)

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

          loadUsers()
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

  useEffect(() => {
    applyFilters()
  }, [users, filters])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const userDoc = await getDocs(collection(db, 'users'))
      const usersData = userDoc.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]

      const sortedUsers = usersData.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0
        const bTime = b.createdAt?.seconds || 0
        return bTime - aTime
      })

      setUsers(sortedUsers)
      setFilteredUsers(sortedUsers)
    } catch (error) {
      console.error('Error loading users:', error)
      showError('Failed to load users. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let result = [...users]

    if (filters.role !== 'all') {
      result = result.filter((user) => user.role?.toLowerCase() === filters.role.toLowerCase())
    }

    if (filters.rdc) {
      result = result.filter((user) => user.rdc === filters.rdc)
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      result = result.filter(
        (user) =>
          user.fullName?.toLowerCase().includes(searchTerm) ||
          user.email?.toLowerCase().includes(searchTerm) ||
          user.phone?.toLowerCase().includes(searchTerm) ||
          user.role?.toLowerCase().includes(searchTerm) ||
          user.rdc?.toLowerCase().includes(searchTerm)
      )
    }

    setFilteredUsers(result)
  }

  const handleFilterChange = (key: keyof UserFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return

    if (userToDelete.uid === currentAdminUser?.uid) {
      showError('You cannot delete your own account while logged in.')
      setShowDeleteModal(false)
      setUserToDelete(null)
      return
    }

    try {
      setDeleting(true)
      await deleteDoc(doc(db, 'users', userToDelete.id))

      await logAuditAction(
        'Delete User',
        `User ID: ${userToDelete.uid} (${userToDelete.email}) deleted by ${currentAdminUser?.email}`,
        userToDelete.uid
      )

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
      setShowDeleteModal(false)
      setUserToDelete(null)
      showSuccess(`User "${userToDelete.fullName}" deleted successfully!`)
    } catch (error: any) {
      console.error('Error deleting user:', error)
      showError(error.message || 'Failed to delete user. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditClick = (user: User) => {
    setUserToEdit(user)
    setEditForm({
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role || 'customer',
      phone: user.phone || '',
      address: user.address || '',
      city: user.city || '',
      postalCode: user.postalCode || '',
      rdc: user.rdc || '',
    })
    setShowEditModal(true)
    setError('')
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userToEdit) return

    try {
      setEditing(true)
      setError('')

      const userRef = doc(db, 'users', userToEdit.id)
      await updateDoc(userRef, {
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
        phone: editForm.phone,
        address: editForm.address,
        city: editForm.city,
        postalCode: editForm.postalCode,
        rdc: editForm.rdc,
        updatedAt: new Date(),
      })

      const changedFields = []
      if (editForm.fullName !== userToEdit.fullName) changedFields.push('name')
      if (editForm.email !== userToEdit.email) changedFields.push('email')
      if (editForm.role !== userToEdit.role) changedFields.push('role')
      if (editForm.phone !== userToEdit.phone) changedFields.push('phone')
      if (editForm.rdc !== userToEdit.rdc) changedFields.push('rdc')

      await logAuditAction(
        'Update User',
        `User ID: ${userToEdit.uid} updated. Changes: ${changedFields.join(', ')}. Performed by ${currentAdminUser?.email}`,
        userToEdit.uid
      )

      setUsers((prev) => prev.map((u) => (u.id === userToEdit.id ? { ...u, ...editForm } : u)))

      setShowEditModal(false)
      setUserToEdit(null)
      setEditForm({
        fullName: '',
        email: '',
        role: 'customer',
        phone: '',
        address: '',
        city: '',
        postalCode: '',
        rdc: '',
      })
      showSuccess(`User "${editForm.fullName}" updated successfully!`)
    } catch (error) {
      console.error('Error updating user:', error)
      setError('Failed to update user. Please try again.')
    } finally {
      setEditing(false)
    }
  }

  const handleAddClick = () => {
    setShowAddModal(true)
    setError('')
    setAddForm({
      fullName: '',
      email: '',
      role: 'customer',
      phone: '',
      password: '',
      confirmPassword: '',
      rdc: '',
    })
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (addForm.password !== addForm.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (addForm.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (['RDC Staff', 'Logistics Team'].includes(addForm.role) && !addForm.rdc) {
      setError('RDC Location is required for RDC Staff and Logistics Team roles')
      return
    }

    const adminEmail = currentAdminUser?.email
    if (!adminEmail) {
      setError('Cannot determine admin email')
      return
    }

    setPendingUserData({ adminEmail, ...addForm })
    setAdminPassword('')
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = async () => {
    if (!adminPassword) {
      showError('Admin password is required')
      return
    }

    if (!pendingUserData) return

    try {
      setAdding(true)
      setShowPasswordModal(false)

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        pendingUserData.email,
        pendingUserData.password
      )
      const newAuthUser = userCredential.user

      const userData: any = {
        uid: newAuthUser.uid,
        fullName: pendingUserData.fullName,
        email: pendingUserData.email,
        role: pendingUserData.role,
        phone: pendingUserData.phone,
        photoURL: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      if (pendingUserData.rdc && ['RDC Staff', 'Logistics Team'].includes(pendingUserData.role)) {
        userData.rdc = pendingUserData.rdc
      }

      await setDoc(doc(db, 'users', newAuthUser.uid), userData)

      await logAuditAction(
        'Create User',
        `User ID: ${newAuthUser.uid} (${pendingUserData.email}) created with role: ${pendingUserData.role}${pendingUserData.rdc ? ` at ${pendingUserData.rdc}` : ''}. Performed by ${pendingUserData.adminEmail}`,
        newAuthUser.uid
      )

      await signOut(auth)

      try {
        await signInWithEmailAndPassword(auth, pendingUserData.adminEmail, adminPassword)
      } catch (loginError: any) {
        if (loginError.code === 'auth/wrong-password') {
          showError(
            'User was created successfully, but the admin password you entered was incorrect.\n\nPlease log in again with your correct admin password.'
          )
          setTimeout(() => {
            window.location.href = '/login'
          }, 3000)
          return
        }
        throw loginError
      }

      const newUser: User = {
        id: newAuthUser.uid,
        uid: newAuthUser.uid,
        fullName: pendingUserData.fullName,
        email: pendingUserData.email,
        role: pendingUserData.role,
        phone: pendingUserData.phone,
        photoURL: '',
        createdAt: new Date(),
        rdc: pendingUserData.rdc || undefined,
      }

      setUsers((prev) => [newUser, ...prev])
      setShowAddModal(false)
      setAddForm({
        fullName: '',
        email: '',
        role: 'customer',
        phone: '',
        password: '',
        confirmPassword: '',
        rdc: '',
      })
      setPendingUserData(null)
      setAdminPassword('')
      showSuccess(`User "${pendingUserData.fullName}" created successfully!`)
    } catch (error: any) {
      console.error('Error creating user:', error)

      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please use a different email.')
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address format.')
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak. Please use a stronger password.')
      } else {
        showError(error.message || 'Failed to create user. Please try again.')
      }

      setShowAddModal(true)
    } finally {
      setAdding(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'rdc staff':
        return 'bg-blue-100 text-blue-800'
      case 'ho manager':
        return 'bg-purple-100 text-purple-800'
      case 'logistics team':
        return 'bg-cyan-100 text-cyan-800'
      case 'customer':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getProfilePicture = (user: User) => {
    if (user.photoURL) return user.photoURL
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.email || 'User')}&background=random`
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
      if (isNaN(date.getTime())) return 'Invalid date'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'N/A'
    }
  }

  const getStats = () => {
    const total = users.length
    const customers = users.filter((u) => u.role?.toLowerCase() === 'customer').length
    const staff = users.filter((u) =>
      ['admin', 'rdc staff', 'ho manager', 'logistics team'].includes(u.role?.toLowerCase())
    ).length
    return { total, customers, staff }
  }

  const stats = getStats()

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

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <AdminNavbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
              <p className="text-gray-600 mt-2">View and manage all user accounts in the system</p>
            </div>
            <button
              onClick={handleAddClick}
              className="px-5 py-2.5 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold hover:from-cyan-600 hover:to-blue-700 transition shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add New User
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Total Users */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">All registered users</span>
            </div>
          </div>

          {/* Customers */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Customers</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.customers}</p>
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Shopping customers</span>
            </div>
          </div>

          {/* Staff & Admin */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Staff & Admin</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.staff}</p>
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
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs text-gray-500">Administrative users</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="search-users"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Search Users
              </label>
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
                  id="search-users"
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                  placeholder="Search by name, email, phone..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-role" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Role
              </label>
              <select
                id="filter-role"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                aria-label="Filter by role"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
              >
                <option value="all">All Roles</option>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="RDC Staff">RDC Staff</option>
                <option value="HO Manager">HO Manager</option>
                <option value="Logistics Team">Logistics Team</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-rdc" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by RDC
              </label>
              <select
                id="filter-rdc"
                value={filters.rdc}
                onChange={(e) => handleFilterChange('rdc', e.target.value)}
                aria-label="Filter by RDC location"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
              >
                <option value="">All RDCs</option>
                {rdcLocations.map((rdc) => (
                  <option key={rdc} value={rdc}>
                    {rdc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({ role: 'all', search: '', rdc: '' })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2"
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
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Users ({filteredUsers.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p className="text-gray-500 mt-2">No users found</p>
              <p className="text-gray-400 text-sm mt-1">
                Try changing your filters or add a new user
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RDC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 shrink-0">
                            <img
                              src={getProfilePicture(user)}
                              alt={user.fullName}
                              className="h-10 w-10 rounded-full object-cover object-top"
                              onError={(e) => {
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.email || 'User')}&background=random`
                              }}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.fullName || 'Unknown User'}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user.uid?.slice(-8) || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email || 'No email'}</div>
                        <div className="text-sm text-gray-500">{user.phone || 'No phone'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role || 'customer')}`}
                        >
                          {user.role?.toUpperCase() || 'CUSTOMER'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {['RDC Staff', 'Logistics Team'].includes(user.role || '') && user.rdc ? (
                            user.rdc
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimestamp(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(user)}
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleDeleteClick(user)}
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
        {showDeleteModal && userToDelete && (
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
                    <img
                      src={getProfilePicture(userToDelete)}
                      alt={userToDelete.fullName}
                      className="h-12 w-12 rounded-full object-cover object-top"
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userToDelete.fullName || userToDelete.email || 'User')}&background=random`
                      }}
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{userToDelete.fullName}</p>
                      <p className="text-sm text-gray-600">{userToDelete.email}</p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getRoleColor(userToDelete.role || 'customer')}`}
                      >
                        {userToDelete.role?.toUpperCase() || 'CUSTOMER'}
                      </span>
                      {userToDelete.rdc && (
                        <p className="text-sm text-gray-500 mt-1">RDC: {userToDelete.rdc}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-600">
                    Are you sure you want to delete this user? This action cannot be undone.
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
                      'Delete User'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit User Modal with Blur */}
        {showEditModal && userToEdit && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowEditModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Edit User</h3>
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

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleEditSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="edit-fullName"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Full Name
                        </label>
                        <input
                          id="edit-fullName"
                          type="text"
                          value={editForm.fullName}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, fullName: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          required
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-email"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Email
                        </label>
                        <input
                          id="edit-email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          required
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-phone"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Phone
                        </label>
                        <input
                          id="edit-phone"
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-role"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Role
                        </label>
                        <select
                          id="edit-role"
                          value={editForm.role}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, role: e.target.value }))
                          }
                          aria-label="Select user role"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(editForm.role === 'RDC Staff' || editForm.role === 'Logistics Team') && (
                        <div>
                          <label
                            htmlFor="edit-rdc"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            RDC Location *
                          </label>
                          <select
                            id="edit-rdc"
                            value={editForm.rdc}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, rdc: e.target.value }))
                            }
                            aria-label="Select RDC location"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                            required
                          >
                            <option value="">Select RDC Location</option>
                            {rdcLocations.map((rdc) => (
                              <option key={rdc} value={rdc}>
                                {rdc}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-2">
                            Required for {editForm.role} roles
                          </p>
                        </div>
                      )}
                      <div>
                        <label
                          htmlFor="edit-address"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Address
                        </label>
                        <input
                          id="edit-address"
                          type="text"
                          value={editForm.address}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, address: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="edit-city"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            City
                          </label>
                          <input
                            id="edit-city"
                            type="text"
                            value={editForm.city}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, city: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="edit-postalCode"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Postal Code
                          </label>
                          <input
                            id="edit-postalCode"
                            type="text"
                            value={editForm.postalCode}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, postalCode: e.target.value }))
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          />
                        </div>
                      </div>
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
                        disabled={editing}
                        className="px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

        {/* Add User Modal with Blur */}
        {showAddModal && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowAddModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Add New User</h3>
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

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleAddSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="add-fullName"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Full Name *
                        </label>
                        <input
                          id="add-fullName"
                          type="text"
                          value={addForm.fullName}
                          onChange={(e) =>
                            setAddForm((prev) => ({ ...prev, fullName: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          required
                          placeholder="Enter full name"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="add-email"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Email *
                        </label>
                        <input
                          id="add-email"
                          type="email"
                          value={addForm.email}
                          onChange={(e) =>
                            setAddForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          required
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="add-password"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Password *
                        </label>
                        <input
                          id="add-password"
                          type="password"
                          value={addForm.password}
                          onChange={(e) =>
                            setAddForm((prev) => ({ ...prev, password: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          required
                          placeholder="Enter password (min 6 characters)"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="add-confirmPassword"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Confirm Password *
                        </label>
                        <input
                          id="add-confirmPassword"
                          type="password"
                          value={addForm.confirmPassword}
                          onChange={(e) =>
                            setAddForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          required
                          placeholder="Confirm password"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="add-phone"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Phone
                        </label>
                        <input
                          id="add-phone"
                          type="tel"
                          value={addForm.phone}
                          onChange={(e) =>
                            setAddForm((prev) => ({ ...prev, phone: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="add-role"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Role
                        </label>
                        <select
                          id="add-role"
                          value={addForm.role}
                          onChange={(e) =>
                            setAddForm((prev) => ({
                              ...prev,
                              role: e.target.value,
                              rdc: ['RDC Staff', 'Logistics Team'].includes(e.target.value)
                                ? prev.rdc
                                : '',
                            }))
                          }
                          aria-label="Select user role"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(addForm.role === 'RDC Staff' || addForm.role === 'Logistics Team') && (
                        <div>
                          <label
                            htmlFor="add-rdc"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            RDC Location *
                          </label>
                          <select
                            id="add-rdc"
                            value={addForm.rdc}
                            onChange={(e) =>
                              setAddForm((prev) => ({ ...prev, rdc: e.target.value }))
                            }
                            aria-label="Select RDC location"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                            required
                          >
                            <option value="">Select RDC Location</option>
                            {rdcLocations.map((rdc) => (
                              <option key={rdc} value={rdc}>
                                {rdc}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-2">
                            Required for {addForm.role} roles
                          </p>
                        </div>
                      )}
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
                        disabled={adding}
                        className="px-4 py-2 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {adding ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Creating...
                          </>
                        ) : (
                          'Create User'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Password Prompt Modal with Blur */}
        {showPasswordModal && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => {
                setShowPasswordModal(false)
                setAdminPassword('')
                setPendingUserData(null)
              }}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Confirm Admin Password</h3>
                  <button
                    onClick={() => {
                      setShowPasswordModal(false)
                      setAdminPassword('')
                      setPendingUserData(null)
                    }}
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
                  <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <svg
                      className="w-6 h-6 text-amber-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-800">Authentication Required</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Creating a new user will temporarily log you out. You'll be automatically
                        logged back in.
                      </p>
                    </div>
                  </div>

                  <label
                    htmlFor="admin-password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Enter YOUR Admin Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePasswordSubmit()
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-gray-900"
                    placeholder="Enter your password"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    This is required to re-authenticate you after creating the new user.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowPasswordModal(false)
                      setAdminPassword('')
                      setPendingUserData(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordSubmit}
                    disabled={!adminPassword || adding}
                    className="px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {adding ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Creating User...
                      </>
                    ) : (
                      <>
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Confirm & Create User
                      </>
                    )}
                  </button>
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