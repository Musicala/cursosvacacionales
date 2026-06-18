// Inicialización de Firebase (Auth + Firestore) usando el SDK modular vía CDN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
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
// Usamos popup en todos lados (incluido móvil): signInWithRedirect entre dominios
// distintos (app en github.io, authDomain en firebaseapp.com) no completa la sesión
// en navegadores móviles por el aislamiento de almacenamiento. El popup no depende
// de ese redirect. Solo caemos a redirect si el popup falla de verdad.
export async function login() {
  try {
    const result = await signInWithPopup(auth, provider);
    return GoogleAuthProvider.credentialFromResult(result);
  } catch (e) {
    // Si el usuario cerró/canceló el popup, no insistimos con redirect.
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(e.code)) throw e;
    // Popup bloqueado o no soportado (algunos WebView): intentamos redirect.
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
