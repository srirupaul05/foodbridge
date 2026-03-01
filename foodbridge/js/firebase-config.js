// ============================================
//  Nourishh — Firebase Configuration
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBr29hZVPyPYk4CQqzkDeF2Mkf4_UTl-QQ",
  authDomain: "foodbridge-app-ce6c2.firebaseapp.com",
  projectId: "foodbridge-app-ce6c2",
  storageBucket: "foodbridge-app-ce6c2.firebasestorage.app",
  messagingSenderId: "288090663643",
  appId: "1:288090663643:web:1a2b3daf424cee11ec3afe"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("✅ Firebase connected successfully!");