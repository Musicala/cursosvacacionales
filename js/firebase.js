// Inicialización de Firebase (Auth + Firestore) usando el SDK modular vía CDN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
  browserLocalPersistence, setPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, CORREOS_PERMITIDOS } from "../firebase-config.js?v=3";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("No se pudo fijar persistencia de sesión", e));

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Inicia sesión y devuelve la credencial de Google (sirve para entrar también
// al otro proyecto sin pedir un segundo popup).
// En móvil usamos redirect (el popup se cierra solo en Chrome móvil →
// auth/popup-closed-by-user). El redirect lo completa resultadoRedirect()
// con getRedirectResult al volver de Google. En escritorio usamos popup,
// que devuelve la credencial directo y evita recargar la página.
export async function login() {
  const ua = navigator.userAgent || "";
  const esMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (esMovil) {
    await signInWithRedirect(auth, provider);
    return null;
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return GoogleAuthProvider.credentialFromResult(result);
  } catch (e) {
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(e.code)) throw e;
    // Popup bloqueado o no soportado: caemos a redirect.
    await signInWithRedirect(auth, provider);
    return null;
  }
}

// Respaldo al arrancar: si la sesión vino por redirect, recupera la credencial.
// Devuelve null si no había redirect pendiente.
export async function resultadoRedirect() {
  try {
    const result = await getRedirectResult(auth);
    return result ? GoogleAuthProvider.credentialFromResult(result) : null;
  } catch (e) {
    console.warn("getRedirectResult falló", e);
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
