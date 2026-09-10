// ============================================================
// Quillora — Firebase Configuration & Core Exports
// Project: articlenest-001 | GitHub: pradeetech/quillora
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, getDoc, doc, addDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, where, limit, startAfter,
  serverTimestamp, increment, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile,
  sendEmailVerification,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAemWn2O-rbc5wptLMh8MpIykKex041Y5M",
  authDomain: "articlenest-001.firebaseapp.com",
  projectId: "articlenest-001",
  storageBucket: "articlenest-001.firebasestorage.app",
  messagingSenderId: "136201009485",
  appId: "1:136201009485:web:e66bf907bec99f432f5f04",
  measurementId: "G-HHG4Q8ZVSN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export {
  collection, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, limit, startAfter, serverTimestamp, increment,
  arrayUnion, arrayRemove,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, sendEmailVerification,
  GoogleAuthProvider, signInWithPopup
};

// ============================================================
// 🔒 SITE CONFIG — Non-changeable core
// ============================================================
export const SITE_CONFIG = {
  brand: "Quillora",
  tagline: "Where Every Story Takes Flight",
  url: "https://pradeetech.github.io/quillora",
  categories: ["Technology", "Education", "Business", "Lifestyle"],
  // 🔐 SECRET ADMIN EMAILS — මේ email එකෙන් register කරොත් silent admin!
  adminEmails: ["siriyalathaaththanayaka22@gmail.com"]
};

export function isAdminEmail(email) {
  return !!email && SITE_CONFIG.adminEmails.includes(email.toLowerCase());
}
