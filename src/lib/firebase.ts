import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.BINI_FIREBASE_API_KEY,
  authDomain: import.meta.env.BINI_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.BINI_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.BINI_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.BINI_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.BINI_FIREBASE_APP_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const realtimeDb = getDatabase(app)
