// Inicialización de Firebase (Auth + Firestore) usando el SDK modular vía CDN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
  browserLocalPersistence, setPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, CORREOS_PERMITIDOS } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("No se pudo fijar persistencia de sesión", e));

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Inicia sesión y devuelve la credencial de Google (sirve para entrar también
// al otro proyecto sin pedir un segundo popup).
export async function login() {
  const ua = navigator.userAgent || "";
  const esMovil = /Android|iPhone|iPad|iPod/i.test(ua);
  const esWebView = /FBAN|FBAV|Instagram|Line|wv|WhatsApp/i.test(ua);
  if (esMovil || esWebView) {
    await signInWithRedirect(auth, provider);
    return null;
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return GoogleAuthProvider.credentialFromResult(result);
  } catch (e) {
    if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(e.code)) throw e;
    await signInWithRedirect(auth, provider);
    return null;
  }
}
export function logout() {
  return signOut(auth);
}
export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}
export function correoPermitido(email) {
  return CORREOS_PERMITIDOS.includes((email || "").toLowerCase());
}
