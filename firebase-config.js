// ============================================================
//  CONFIGURACIÓN DE FIREBASE
//  Reemplaza estos valores por los de TU proyecto.
//  Los encuentras en: console.firebase.google.com
//    → ⚙️ Configuración del proyecto → Tus apps → Configuración del SDK
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBwDjPJxlLfMys-koZPDxde6mmE7ShxRSk",
  authDomain: "vacacionales-fb909.firebaseapp.com",
  projectId: "vacacionales-fb909",
  storageBucket: "vacacionales-fb909.firebasestorage.app",
  messagingSenderId: "627854916940",
  appId: "1:627854916940:web:579d81821f4fed394ee3e9",
};

// ============================================================
//  ROLES
//  - Admin      → ve todo, incluidas Estadísticas (ingresos, rentabilidad…).
//  - Asistente  → todo el trabajo del día a día (contactos, inscripciones,
//                 pagos pendientes, horarios…) pero NO ve Estadísticas.
//  - Docente    → no se lista aquí: se registra en el módulo
//                 "Horarios y docentes" y solo ve lo suyo.
// ============================================================

// Correos con rol Admin.
export const CORREOS_ADMIN = [
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com",
];

// Correos con rol Asistente.
export const CORREOS_ASISTENTE = [
  "adminmusicala@gmail.com",
  "musicalaasesor@gmail.com",
];

// Todos los correos de coordinación (admin + asistente) que pueden entrar.
export const CORREOS_PERMITIDOS = [...CORREOS_ADMIN, ...CORREOS_ASISTENTE];

// Devuelve "admin" | "asistente" | null para un correo de coordinación.
export function rolDeCorreo(correo) {
  const c = (correo || "").toLowerCase().trim();
  if (CORREOS_ADMIN.map((x) => x.toLowerCase()).includes(c)) return "admin";
  if (CORREOS_ASISTENTE.map((x) => x.toLowerCase()).includes(c)) return "asistente";
  return null;
}
