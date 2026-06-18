// Conexión secundaria al proyecto "base general".
// Lee sheetCache/{hoja}/rows/{fila} y trae los marcados como Vacacionales.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { baseGeneralConfig, BG, MAPEO_CAMPOS } from "../firebase-base-general.js?v=3";
import { normTexto } from "./dedup.js?v=3";

const APP_NAME = "baseGeneral";

export function estaConfigurada() {
  return baseGeneralConfig.apiKey && baseGeneralConfig.apiKey !== "PEGA_AQUI";
}

function appBG() {
  if (!estaConfigurada()) throw new Error("La base general aún no está configurada (firebase-base-general.js).");
  return getApps().some((a) => a.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(baseGeneralConfig, APP_NAME);
}
function authBG() { return getAuth(appBG()); }
function dbBG() { return getFirestore(appBG()); }

export function usuarioBG() { return authBG().currentUser; }
export function onAuthBG(cb) { return onAuthStateChanged(authBG(), cb); }
export function loginBG() {
  const prov = new GoogleAuthProvider();
  prov.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(authBG(), prov);
}

// Entra a la base general reutilizando la credencial de Google del login principal
// (no abre un segundo popup). Si ya hay sesión, no hace nada.
export async function conectarConCredencial(cred) {
  if (!estaConfigurada() || !cred) return;
  if (usuarioBG()) return;
  try {
    await signInWithCredential(authBG(), cred);
  } catch (e) {
    console.warn("No se pudo conectar la base general con la credencial:", e.message);
  }
}

// Devuelve los IDs de las hojas a revisar (las configuradas, o todas).
async function idsDeHojas() {
  if (BG.HOJAS && BG.HOJAS.length) return BG.HOJAS;
  const snap = await getDocs(collection(dbBG(), "sheetCache"));
  return snap.docs.map((d) => d.id);
}

// ¿La fila tiene la etiqueta Vacacionales en alguno de los campos configurados?
function tieneEtiqueta(data) {
  if (!BG.CAMPOS_ETIQUETA || !BG.CAMPOS_ETIQUETA.length) return true; // sin filtro: trae todas
  const objetivo = normTexto(BG.VALOR_VACACIONALES);
  return BG.CAMPOS_ETIQUETA.some((campo) => {
    const v = data ? data[campo] : undefined;
    if (Array.isArray(v)) return v.some((x) => normTexto(x) === objetivo);
    return normTexto(v) === objetivo;
  });
}

// Trae todas las filas marcadas como Vacacionales, normalizadas al formato de Contactos.
export async function traerVacacionales() {
  const hojas = await idsDeHojas();
  const resultado = [];
  for (const hojaId of hojas) {
    let snap;
    try {
      snap = await getDocs(collection(dbBG(), "sheetCache", hojaId, "rows"));
    } catch (e) {
      console.warn("No se pudo leer la hoja", hojaId, e.message);
      continue;
    }
    snap.docs.forEach((d) => {
      const fila = d.data() || {};
      const data = fila.data || {};
      if (tieneEtiqueta(data)) resultado.push(normalizar(hojaId + "/" + d.id, data));
    });
  }
  return resultado;
}

function normalizar(sourceId, data) {
  const get = (campo) => (campo && data[campo] != null ? String(data[campo]).trim() : "");
  const edadRaw = get(MAPEO_CAMPOS.edad);
  const c = {
    sourceId,                       // "hojaId/filaId" para no duplicar
    estudiante: get(MAPEO_CAMPOS.estudiante),
    acudiente: get(MAPEO_CAMPOS.acudiente),
    celular: get(MAPEO_CAMPOS.celular),
    correo: get(MAPEO_CAMPOS.correo),
    grupo: get(MAPEO_CAMPOS.grupo),
    estado: "Interesado",
    origen: "Base general",
  };
  if (edadRaw && !isNaN(Number(edadRaw))) c.edad = Number(edadRaw);
  if (!c.estudiante && c.acudiente) c.estudiante = c.acudiente;
  return c;
}
