/**
 * firebase/config.js
 * Replace these placeholder values with your actual Firebase project config.
 * The app runs fully on mock data without a live Firebase project.
 */
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'subsense-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'subsense-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:demo',
}

let app, db, auth

try {
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
  auth = getAuth(app)
} catch (e) {
  // Running without Firebase — all data served from mockData.js
  console.info('[SubSense] Firebase not configured — using mock data.')
}

export { db, auth }
export default app
