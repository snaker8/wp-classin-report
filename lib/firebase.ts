import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBIprMCSvn4vks4wHUoJcD9khJPQIq9i84",
    authDomain: "wp-classin-report.firebaseapp.com",
    projectId: "wp-classin-report",
    storageBucket: "wp-classin-report.firebasestorage.app",
    messagingSenderId: "614085553479",
    appId: "1:614085553479:web:6777007985ba34e86cb062",
    measurementId: "G-838HTG3WKR"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
