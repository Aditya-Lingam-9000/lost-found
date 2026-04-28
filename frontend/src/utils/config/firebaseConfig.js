import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDLbr3-P6aXhhY-UaqhdpTQeUlQBP01IOg",
  authDomain: "campusfinder-11cbe.firebaseapp.com",
  projectId: "campusfinder-11cbe",
  storageBucket: "campusfinder-11cbe.firebasestorage.app",
  messagingSenderId: "836073386273",
  appId: "1:836073386273:android:d457283bbca2fc2ff0ce60"
};

const app = initializeApp(firebaseConfig);

export const auth = Capacitor.isNativePlatform()
  ? (() => {
      try {
        return initializeAuth(app, {
          persistence: indexedDBLocalPersistence,
        });
      } catch (error) {
        return getAuth(app);
      }
    })()
  : getAuth(app);

export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export { signInWithPopup, signInWithRedirect, getRedirectResult };
