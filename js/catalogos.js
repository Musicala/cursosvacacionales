// Catálogos / valores por defecto del negocio.
// Estos se usan como base; más adelante se pueden editar desde Firestore (config).

export const GRUPOS = [
  { id: "musicalitos", nombre: "Musicalitos", edadMin: 3, edadMax: 5 },
  { id: "musikids",    nombre: "Musikids",    edadMin: 6, edadMax: 9 },
  { id: "musiteens",   nombre: "Musiteens",   edadMin: 10, edadMax: 16 },
];

// Sugerencia de grupo según la edad del estudiante.
export function grupoPorEdad(edad) {
  const e = Number(edad);
  const g = GRUPOS.find((x) => e >= x.edadMin && e <= x.edadMax);
  return g ? g.id : "";
}

export const AREAS = ["Música", "Expresión Corporal", "Artes", "Lúdica"];

export const PAQUETES = [
  { id: "h16", nombre: "16 horas", horas: 16 },
  { id: "h20", nombre: "20 horas (1 semana)", horas: 20 },
  { id: "h40", nombre: "40 horas (2 semanas)", horas: 40 },
  { id: "h60", nombre: "60 horas (3 semanas)", horas: 60 },
  { id: "h80", nombre: "80 horas (4 semanas)", horas: 80 },
];

export const ESTADOS_CONTACTO = [
  "Interesado",      // escribió, aún no se inscribe
  "Contactado",      // ya le enviamos info / llamamos
  "En seguimiento",
  "Confirmado",      // dijo que sí
  "Inscrito",        // ya pagó / formalizó
  "Antiguo",         // participó en temporadas anteriores (re-contacto)
  "No interesado",
];

export const ESTADOS_PAGO = ["Pendiente", "Abono", "Pagado"];

export const CANALES = ["WhatsApp", "Llamada", "Instagram", "Facebook", "Presencial", "Correo"];

// Categorías del Musicafé.
export const MUSICAFE_CATEGORIAS = ["Snacks, galletas y pasabocas", "Bebidas"];

// Catálogo Musicafé (onces) — valores por defecto. Editables desde la app (se guardan en config).
export const MUSICAFE_PRODUCTOS = [
  { nombre: "Galletas Tosh Cracker", precio: 1200, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Cremadas Tosh", precio: 1500, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Galletas Waffer Tosh", precio: 2000, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Rosquillas integrales", precio: 4000, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Barra Tosh", precio: 2200, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Papas fritas Khytos", precio: 1500, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Plátanos Khytos", precio: 1500, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Galletas Club Social", precio: 1200, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Submarino", precio: 1500, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Ponquecitos", precio: 1600, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Galletas Minichips", precio: 1800, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Galletas Oreo", precio: 2000, categoria: "Snacks, galletas y pasabocas" },
  { nombre: "Leche saborizada", precio: 2400, categoria: "Bebidas" },
  { nombre: "Avena", precio: 2400, categoria: "Bebidas" },
  { nombre: "Agua Amese 600ml", precio: 2200, categoria: "Bebidas" },
  { nombre: "Agua Amese 335ml", precio: 1800, categoria: "Bebidas" },
  { nombre: "Jugo en caja", precio: 2200, categoria: "Bebidas" },
  { nombre: "Crokan Crokan", precio: 1500, categoria: "Bebidas" },
  { nombre: "Maní Nuthos", precio: 2700, categoria: "Bebidas" },
  { nombre: "Maní La especial", precio: 1800, categoria: "Bebidas" },
];

// Docentes (con su área principal). Editable luego.
export const DOCENTES = [
  { nombre: "Natalia Alarcón", areas: ["Música", "Lúdica"], reemplazo: false },
  { nombre: "Thalia Sarmiento", areas: ["Música", "Expresión Corporal", "Lúdica"], reemplazo: false },
  { nombre: "Brenda Giraldo", areas: ["Expresión Corporal", "Lúdica"], reemplazo: false },
  { nombre: "María Camila Pirajón", areas: ["Expresión Corporal", "Lúdica"], reemplazo: false },
  { nombre: "Angie Nitola", areas: ["Expresión Corporal", "Artes", "Lúdica"], reemplazo: false },
  { nombre: "Yusting Cortes", areas: ["Expresión Corporal", "Artes", "Lúdica"], reemplazo: false },
  { nombre: "Santiago Gutiérrez", areas: ["Artes", "Lúdica"], reemplazo: false },
  { nombre: "Leydy Diaz", areas: ["Artes", "Lúdica"], reemplazo: false },
  { nombre: "Alek Caballero", areas: ["Lúdica"], reemplazo: true },
  { nombre: "Catalina Medina", areas: ["Lúdica"], reemplazo: true },
];

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// Mínimo de estudiantes para que la ruta sea viable.
export const RUTA_MINIMO = 12;

// Estado de asistencia por día.
export const ASISTENCIA = ["Completa", "Parcial", "No asistió", "—"];
