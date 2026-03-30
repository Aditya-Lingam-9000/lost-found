import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCJzw-Ckw6X2xkqxIKYgVVhkCUryJJxQV4",
  authDomain: "lost-found-ba268.firebaseapp.com",
  projectId: "lost-found-ba268",
  storageBucket: "lost-found-ba268.firebasestorage.app",
  messagingSenderId: "353057848015",
  appId: "1:353057848015:web:dacd7d288c2378afdb95ba",
  measurementId: "G-YBPYSYZQ9D"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export { signInWithPopup, signInWithRedirect };
