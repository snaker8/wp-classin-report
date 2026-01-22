import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyB2lG5_HmZDieJlxI3MzPZBHryVH9dw8wc",
    authDomain: "chamath-report.firebaseapp.com",
    projectId: "chamath-report",
    storageBucket: "chamath-report.firebasestorage.app",
    messagingSenderId: "908399791069",
    appId: "1:908399791069:web:bc296bcb67a757a66a0434",
    measurementId: "G-VH4RNDN114"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
