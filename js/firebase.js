// Inicialización de Firebase (Auth + Firestore) usando el SDK modular vía CDN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, CORREOS_PERMITIDOS } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Inicia sesión y devuelve la credencial de Google (sirve para entrar también
// al otro proyecto sin pedir un segundo popup).
export async function login() {
  const result = await signInWithPopup(auth, provider);
  return GoogleAuthProvider.credentialFromResult(result);
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
