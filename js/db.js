// Capa de datos sobre Firestore.
// Estructura:
//   temporadas/{temporadaId}                         -> doc con metadatos de la temporada
//   temporadas/{temporadaId}/contactos/{id}          -> pipeline (interesados, antiguos, inscritos)
//   temporadas/{temporadaId}/inscripciones/{id}      -> inscritos formalizados
//   temporadas/{temporadaId}/grupos/{id}             -> grupos/horarios con docente y taller
//   temporadas/{temporadaId}/asistencia/{id}         -> registros de asistencia
//   temporadas/{temporadaId}/musicafe/{id}           -> consumos de onces
//   config/global                                    -> catálogos editables (precios, docentes...)
import { db } from "./firebase.js?v=3";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ----- Temporadas -----
export async function listarTemporadas() {
  const snap = await getDocs(query(collection(db, "temporadas"), orderBy("orden", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function crearTemporada(id, data) {
  await setDoc(doc(db, "temporadas", id), { ...data, creada: serverTimestamp() }, { merge: true });
}
export async function actualizarTemporada(id, patch) {
  await setDoc(doc(db, "temporadas", id), { ...patch, actualizada: serverTimestamp() }, { merge: true });
}
export async function obtenerTemporada(id) {
  const d = await getDoc(doc(db, "temporadas", id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

// ----- Helpers genéricos por subcolección dentro de una temporada -----
function col(temporadaId, sub) {
  return collection(db, "temporadas", temporadaId, sub);
}

export async function listar(temporadaId, sub, orden = "creado") {
  try {
    const snap = await getDocs(query(col(temporadaId, sub), orderBy(orden, "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // si aún no existe el índice/campo de orden, traer sin ordenar
    const snap = await getDocs(col(temporadaId, sub));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export function escuchar(temporadaId, sub, cb) {
  return onSnapshot(col(temporadaId, sub), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function crear(temporadaId, sub, data) {
  const ref = await addDoc(col(temporadaId, sub), { ...data, creado: serverTimestamp() });
  return ref.id;
}
export async function actualizar(temporadaId, sub, id, patch) {
  await updateDoc(doc(db, "temporadas", temporadaId, sub, id), { ...patch, actualizado: serverTimestamp() });
}
export async function eliminar(temporadaId, sub, id) {
  await deleteDoc(doc(db, "temporadas", temporadaId, sub, id));
}
export async function obtener(temporadaId, sub, id) {
  const d = await getDoc(doc(db, "temporadas", temporadaId, sub, id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

// ----- Pagos de una inscripción -----
function pagosCol(temporadaId, inscripcionId) {
  return collection(db, "temporadas", temporadaId, "inscripciones", inscripcionId, "pagos");
}

export async function listarPagos(temporadaId, inscripcionId) {
  try {
    const snap = await getDocs(query(pagosCol(temporadaId, inscripcionId), orderBy("fecha", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(pagosCol(temporadaId, inscripcionId));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export async function crearPago(temporadaId, inscripcionId, data) {
  const ref = await addDoc(pagosCol(temporadaId, inscripcionId), { ...data, creado: serverTimestamp() });
  return ref.id;
}

export async function eliminarPago(temporadaId, inscripcionId, pagoId) {
  await deleteDoc(doc(db, "temporadas", temporadaId, "inscripciones", inscripcionId, "pagos", pagoId));
}

// ----- Config global (catálogos editables) -----
export async function leerConfig() {
  const d = await getDoc(doc(db, "config", "global"));
  return d.exists() ? d.data() : null;
}
export async function guardarConfig(data) {
  await setDoc(doc(db, "config", "global"), data, { merge: true });
}

export { where, query };
