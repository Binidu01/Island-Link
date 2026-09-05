'use client'

import { onAuthStateChanged, updateProfile, updatePassword, User } from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

import AdminNavbar from '../components/Adminnavbar' // Fixed casing
import CustomerNavbar from '../components/customernavbar' // Fixed casing
import HOManagerNavbar from '../components/HOManagerNavbar'
import LogisticsNavbar from '../components/LogisticsNavbar'
import RDCNavbar from '../components/RDCNavbar'
import { auth, db } from '../lib/firebase'

interface UserProfile {
  displayName: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  photoURL: string
}

interface OrderStats {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  totalSpent: number
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'addresses'>('profile')
  const [userRole, setUserRole] = useState<string>('')

  // Profile data
  const [profile, setProfile] = useState<UserProfile>({
    displayName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    photoURL: '',
  })

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile)

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Order stats (only for customers)
  const [orderStats, setOrderStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSpent: 0,
  })

  // Modals
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Image upload
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        loadProfile(currentUser)
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  async function loadProfile(currentUser: User) {
    try {
      setLoading(true)

      // Load from users collection
      const docRef = doc(db, 'users', currentUser.uid)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        const profileData: UserProfile = {
          displayName: data.fullName || data.displayName || currentUser.displayName || '',
          email: data.email || currentUser.email || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          postalCode: data.postalCode || '',
          photoURL: data.photoURL || currentUser.photoURL || '',
        }
        setProfile(profileData)
        setEditedProfile(profileData)
        setUserRole(data.role || 'customer')

        // Load order stats only for customers
        if (data.role === 'customer') {
          loadOrderStats(currentUser.uid)
        }
      } else {
        // Create initial profile from auth data
        const initialProfile: UserProfile = {
          displayName: currentUser.displayName || '',
          email: currentUser.email || '',
          phone: '',
          address: '',
          city: '',
          postalCode: '',
          photoURL: currentUser.photoURL || '',
        }
        setProfile(initialProfile)
        setEditedProfile(initialProfile)
        setUserRole('customer')

        // Save to users collection
        await setDoc(docRef, {
          uid: currentUser.uid,
          fullName: currentUser.displayName || '',
          email: currentUser.email || '',
          phone: '',
          address: '',
          city: '',
          postalCode: '',
          photoURL: currentUser.photoURL || '',
          role: 'customer',
          provider: currentUser.providerData[0]?.providerId || 'email',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadOrderStats(userId: string) {
    try {
      const ordersQuery = query(collection(db, 'orders'), where('userId', '==', userId))

      const querySnapshot = await getDocs(ordersQuery)
      let total = 0
      let pending = 0
      let completed = 0
      let totalSpent = 0

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        total++

        if (data.status === 'pending') pending++
        if (data.status === 'delivered' || data.status === 'completed') {
          completed++
          totalSpent += data.total || 0
        }
      })

      setOrderStats({
        totalOrders: total,
        pendingOrders: pending,
        completedOrders: completed,
        totalSpent: totalSpent,
      })
    } catch (error) {
      console.error('Error loading order stats:', error)
    }
  }

  async function handleSaveProfile() {
    if (!user) return

    setSaving(true)

    try {
      await updateProfile(user, {
        displayName: editedProfile.displayName,
        ...(editedProfile.photoURL && !editedProfile.photoURL.startsWith('data:')
          ? { photoURL: editedProfile.photoURL }
          : {}),
      })

      const docRef = doc(db, 'users', user.uid)
      await updateDoc(docRef, {
        fullName: editedProfile.displayName,
        phone: editedProfile.phone,
        address: editedProfile.address,
        city: editedProfile.city,
        postalCode: editedProfile.postalCode,
        photoURL: editedProfile.photoURL,
        updatedAt: new Date(),
      })

      setProfile(editedProfile)
      setIsEditing(false)
      setSuccessMessage('Profile updated successfully! ✓')
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error saving profile:', error)
      setErrorMessage('Failed to update profile. Please try again.')
      setShowErrorModal(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!user) return

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long')
      setShowErrorModal(true)
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match')
      setShowErrorModal(true)
      return
    }

    setSaving(true)

    try {
      await updatePassword(user, newPassword)

      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordChange(false)
      setSuccessMessage('Password updated successfully! ✓')
      setShowSuccessModal(true)
    } catch (error: any) {
      console.error('Error changing password:', error)

      if (error.code === 'auth/requires-recent-login') {
        setErrorMessage('Please log out and log back in before changing your password.')
      } else {
        setErrorMessage('Failed to update password. Please try again.')
      }
      setShowErrorModal(true)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditedProfile(profile)
    setIsEditing(false)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)

    try {
      const { fileToWebpBase64 } = await import('avatar64')

      const result = await fileToWebpBase64(file, {
        maxSize: 256,
        quality: 0.85,
        maxInputBytes: 5 * 1024 * 1024,
      })

      const base64String = result.dataUrl

      const updatedProfile = { ...profile, photoURL: base64String }
      setProfile(updatedProfile)
      setEditedProfile(updatedProfile)

      if (user) {
        const docRef = doc(db, 'users', user.uid)
        await updateDoc(docRef, {
          photoURL: base64String,
          updatedAt: new Date(),
        })

        window.dispatchEvent(new Event('profileUpdated'))

        setSuccessMessage(`Profile picture updated! (${result.width}x${result.height}) ✓`)
        setShowSuccessModal(true)
      }

      setUploadingImage(false)
    } catch (error: any) {
      console.error('Error uploading image:', error)
      setErrorMessage(error.message || 'Failed to upload image. Please try again.')
      setShowErrorModal(true)
      setUploadingImage(false)
    }
  }

  // Get role-based gradient for avatar
  function getAvatarGradient() {
    switch (userRole) {
      case 'admin':
        return 'from-orange-500 via-cyan-500 to-green-500' // Admin gradient
      case 'HO Manager':
        return 'from-blue-500 via-purple-500 to-pink-500' // HO Manager gradient
      case 'RDC Staff':
        return 'from-green-500 via-blue-500 to-purple-500' // RDC gradient
      case 'Logistics Team':
        return 'from-green-500 via-blue-500 to-purple-500' // Logistics gradient
      default:
        return 'from-cyan-400 to-blue-500' // Customer gradient
    }
  }

  // Get role-based button gradient
  function getButtonGradient() {
    switch (userRole) {
      case 'admin':
        return 'from-orange-500 to-orange-600'
      case 'HO Manager':
        return 'from-blue-500 to-purple-600'
      case 'RDC Staff':
        return 'from-green-500 to-blue-600'
      case 'Logistics Team':
        return 'from-green-500 to-blue-600'
      default:
        return 'from-cyan-400 to-blue-500'
    }
  }

  // Get the correct navbar based on role
  function getNavbar() {
    switch (userRole) {
      case 'admin':
        return <AdminNavbar />
      case 'HO Manager':
        return <HOManagerNavbar />
      case 'RDC Staff':
        return <RDCNavbar />
      case 'Logistics Team':
        return <LogisticsNavbar />
      default:
        return <CustomerNavbar />
    }
  }

  // Success Modal
  function SuccessModal() {
    if (!showSuccessModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scale-up">
          <div className="flex items-center justify-center w-16 h-16 bg-linear-to-br from-green-400 to-green-500 rounded-full mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
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
          <p className="text-gray-900 font-medium text-center mb-4">{successMessage}</p>
          <button
            onClick={() => setShowSuccessModal(false)}
            className={`w-full px-4 py-3 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg font-semibold hover:opacity-90 transition`}
          >
            OK
          </button>
        </div>
      </div>
    )
  }

  // Error Modal
  function ErrorModal() {
    if (!showErrorModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scale-up">
          <div className="flex items-center justify-center w-16 h-16 bg-linear-to-br from-red-400 to-red-500 rounded-full mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
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
          </div>
          <p className="text-gray-900 font-medium text-center mb-4">{errorMessage}</p>
          <button
            onClick={() => setShowErrorModal(false)}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            OK
          </button>
        </div>
      </div>
    )
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
            <p className="text-gray-500 mb-6">Please login to view your profile</p>
            <a
              href="/login?redirect=/profile"
              className={`inline-block px-8 py-3 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg font-semibold hover:opacity-90 transition`}
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
      {getNavbar()}

      {/* Modals */}
      <SuccessModal />
      <ErrorModal />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading your profile...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Profile Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
                {/* Profile Picture */}
                <div className="text-center mb-6">
                  <div className="relative inline-block">
                    <img
                      src={
                        profile.photoURL ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || 'User')}&background=gradient&size=128`
                      }
                      alt={profile.displayName}
                      className="w-32 h-32 rounded-full object-cover object-top border-4 border-gray-200 mx-auto"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          parent.innerHTML = `<div class="w-32 h-32 rounded-full bg-linear-to-br ${getAvatarGradient()} flex items-center justify-center text-white text-4xl font-bold border-4 border-gray-200">${(profile.displayName || 'U').charAt(0).toUpperCase()}</div>`
                        }
                      }}
                    />
                    <label
                      htmlFor="profile-image-upload"
                      className={`absolute bottom-0 right-0 w-10 h-10 bg-linear-to-r ${getButtonGradient()} rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition shadow-lg border-4 border-white`}
                    >
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      ) : (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      )}
                    </label>
                    <input
                      id="profile-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mt-4">
                    {profile.displayName || 'User'}
                  </h2>
                  <p className="text-sm text-gray-500">{profile.email}</p>
                  <p className="text-xs text-gray-400 mt-2">Click camera icon to change picture</p>
                </div>

                {/* Stats - Only for customers */}
                {userRole === 'customer' && (
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Orders</span>
                      <span className="font-semibold text-gray-900">{orderStats.totalOrders}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Pending Orders</span>
                      <span className="font-semibold text-orange-600">
                        {orderStats.pendingOrders}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Completed Orders</span>
                      <span className="font-semibold text-green-600">
                        {orderStats.completedOrders}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Total Spent</span>
                      <span className="font-semibold text-cyan-600">
                        LKR {orderStats.totalSpent.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Links - Role-based */}
                <div className="space-y-2 mt-6 pt-6 border-t border-gray-200">
                  {userRole === 'admin' ? (
                    <>
                      <a
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Dashboard</span>
                      </a>
                      <a
                        href="/admin/reports"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Reports</span>
                      </a>
                      <a
                        href="/audit"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Audit Logs</span>
                      </a>
                      <a
                        href="/manage-users"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Manage Users</span>
                      </a>
                    </>
                  ) : userRole === 'HO Manager' ? (
                    <>
                      <a
                        href="/manager"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Dashboard</span>
                      </a>
                      <a
                        href="/manage-orders"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
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
                        <span className="text-sm font-medium">Manage Orders</span>
                      </a>
                      <a
                        href="/rdc-tracking"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <span className="text-sm font-medium">RDC Tracking</span>
                      </a>
                      <a
                        href="/reports"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Reports</span>
                      </a>
                    </>
                  ) : userRole === 'RDC Staff' ? (
                    <>
                      <a
                        href="/rdc"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Dashboard</span>
                      </a>
                      <a
                        href="/rdc-orders"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
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
                        <span className="text-sm font-medium">RDC Orders</span>
                      </a>
                      <a
                        href="/manage-products"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
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
                        <span className="text-sm font-medium">Products</span>
                      </a>
                      <a
                        href="/q&a"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Q&A</span>
                      </a>
                    </>
                  ) : userRole === 'Logistics Team' ? (
                    <>
                      <a
                        href="/logistics"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                        <span className="text-sm font-medium">Dashboard</span>
                      </a>
                      <a
                        href="/logistic-orders"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
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
                        <span className="text-sm font-medium">Orders</span>
                      </a>
                      <a
                        href="/deliveries"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                          />
                        </svg>
                        <span className="text-sm font-medium">Deliveries</span>
                      </a>
                      <a
                        href="/route"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
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
                        <span className="text-sm font-medium">Routes</span>
                      </a>
                    </>
                  ) : (
                    <>
                      {/* Customer Quick Links */}
                      <a
                        href="/orders"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
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
                        <span className="text-sm font-medium">My Orders</span>
                      </a>
                      <a
                        href="/wishlist"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-gray-700"
                      >
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
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
                        <span className="text-sm font-medium">Wishlist</span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Content - Tabs */}
            <div className="lg:col-span-2">
              {/* Tabs */}
              <div className="bg-white rounded-xl shadow-sm mb-6">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
                      activeTab === 'profile'
                        ? 'text-cyan-600 border-b-2 border-cyan-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Profile Information
                  </button>
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
                      activeTab === 'security'
                        ? 'text-cyan-600 border-b-2 border-cyan-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Security
                  </button>
                  {/* Only show Addresses tab for customers */}
                  {userRole === 'customer' && (
                    <button
                      onClick={() => setActiveTab('addresses')}
                      className={`flex-1 px-6 py-4 text-sm font-semibold transition ${
                        activeTab === 'addresses'
                          ? 'text-cyan-600 border-b-2 border-cyan-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Addresses
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                {activeTab === 'profile' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                      {!isEditing && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className={`px-4 py-2 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg text-sm font-semibold hover:opacity-90 transition`}
                        >
                          Edit Profile
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Display Name */}
                      <div>
                        <label
                          htmlFor="display-name"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Full Name
                        </label>
                        {isEditing ? (
                          <input
                            id="display-name"
                            type="text"
                            value={editedProfile.displayName}
                            onChange={(e) =>
                              setEditedProfile({ ...editedProfile, displayName: e.target.value })
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                            placeholder="Enter your full name"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">
                            {profile.displayName || 'Not set'}
                          </p>
                        )}
                      </div>

                      {/* Email (Read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                        </label>
                        <p className="text-gray-900 font-medium">{profile.email}</p>
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                      </div>

                      {/* Phone */}
                      <div>
                        <label
                          htmlFor="phone"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Phone Number
                        </label>
                        {isEditing ? (
                          <input
                            id="phone"
                            type="tel"
                            value={editedProfile.phone}
                            onChange={(e) =>
                              setEditedProfile({ ...editedProfile, phone: e.target.value })
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                            placeholder="+94 77 123 4567"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">{profile.phone || 'Not set'}</p>
                        )}
                      </div>

                      {isEditing && (
                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className={`px-6 py-2.5 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50`}
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Security Settings</h3>

                    <div className="space-y-6">
                      {/* Password Section */}
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-gray-900">Password</h4>
                            <p className="text-sm text-gray-500">Change your account password</p>
                          </div>
                          {!showPasswordChange && (
                            <button
                              onClick={() => setShowPasswordChange(true)}
                              className={`px-4 py-2 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg text-sm font-semibold hover:opacity-90 transition`}
                            >
                              Change Password
                            </button>
                          )}
                        </div>

                        {showPasswordChange && (
                          <div className="space-y-4 pt-4 border-t border-gray-200">
                            <div>
                              <label
                                htmlFor="new-password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                              >
                                New Password
                              </label>
                              <input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                                placeholder="Enter new password"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="confirm-password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                              >
                                Confirm New Password
                              </label>
                              <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                                placeholder="Confirm new password"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={handleChangePassword}
                                disabled={saving}
                                className={`px-6 py-2.5 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50`}
                              >
                                {saving ? 'Updating...' : 'Update Password'}
                              </button>
                              <button
                                onClick={() => {
                                  setShowPasswordChange(false)
                                  setNewPassword('')
                                  setConfirmPassword('')
                                }}
                                disabled={saving}
                                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Account Info */}
                      <div className="border border-gray-200 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Account Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">User ID</span>
                            <span className="text-gray-900 font-mono text-xs">
                              {user.uid.substring(0, 16)}...
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Account Created</span>
                            <span className="text-gray-900">
                              {user.metadata.creationTime
                                ? new Date(user.metadata.creationTime).toLocaleDateString()
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Last Sign In</span>
                            <span className="text-gray-900">
                              {user.metadata.lastSignInTime
                                ? new Date(user.metadata.lastSignInTime).toLocaleDateString()
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'addresses' && userRole === 'customer' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Saved Addresses</h3>
                      {!isEditing && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className={`px-4 py-2 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg text-sm font-semibold hover:opacity-90 transition`}
                        >
                          Edit Address
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Address */}
                      <div>
                        <label
                          htmlFor="address"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Street Address
                        </label>
                        {isEditing ? (
                          <input
                            id="address"
                            type="text"
                            value={editedProfile.address}
                            onChange={(e) =>
                              setEditedProfile({ ...editedProfile, address: e.target.value })
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                            placeholder="123 Main Street"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">
                            {profile.address || 'Not set'}
                          </p>
                        )}
                      </div>

                      {/* City */}
                      <div>
                        <label
                          htmlFor="city"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          City
                        </label>
                        {isEditing ? (
                          <input
                            id="city"
                            type="text"
                            value={editedProfile.city}
                            onChange={(e) =>
                              setEditedProfile({ ...editedProfile, city: e.target.value })
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                            placeholder="Colombo"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">{profile.city || 'Not set'}</p>
                        )}
                      </div>

                      {/* Postal Code */}
                      <div>
                        <label
                          htmlFor="postal-code"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Postal Code
                        </label>
                        {isEditing ? (
                          <input
                            id="postal-code"
                            type="text"
                            value={editedProfile.postalCode}
                            onChange={(e) =>
                              setEditedProfile({ ...editedProfile, postalCode: e.target.value })
                            }
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none text-gray-900 bg-white"
                            placeholder="00100"
                          />
                        ) : (
                          <p className="text-gray-900 font-medium">
                            {profile.postalCode || 'Not set'}
                          </p>
                        )}
                      </div>

                      {isEditing && (
                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className={`px-6 py-2.5 bg-linear-to-r ${getButtonGradient()} text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50`}
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add animation styles */}
      <style>{`
        @keyframes scale-up {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
