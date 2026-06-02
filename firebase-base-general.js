// ============================================================
//  CONEXIÓN A LA "BASE GENERAL" (tu otro proyecto de Firebase)
//  Estructura real:  sheetCache/{hoja}/rows/{fila}
//  Cada fila tiene un mapa `data` con las columnas de tu Google Sheet.
//  De aquí se traen los que tengan "Vacacionales" en Listado, Arte I o Curso/Plan.
// ============================================================

// 1) Pega el firebaseConfig del OTRO proyecto (la base general de Musicala).
export const baseGeneralConfig = {
  apiKey: "AIzaSyD5cHVQiZzYACLYoWEfOrTO37hDoMfpsDg",
  authDomain: "db-musicala.firebaseapp.com",
  projectId: "db-musicala",
  storageBucket: "db-musicala.firebasestorage.app",
  messagingSenderId: "511593925043",
  appId: "1:511593925043:web:326e4fb5afa5a8c0a563c6",
};

export const BG = {
  // Valor de la etiqueta a buscar (no distingue mayúsculas ni tildes).
  VALOR_VACACIONALES: "Vacacionales",

  // Hojas (documentos de sheetCache) donde buscar.
  //  - [] (vacío)  -> revisa TODAS las hojas.
  //  - ["idHoja1"] -> revisa solo esas hojas (más rápido si sabes en cuál están).
  HOJAS: [],

  // Columnas (claves dentro del mapa `data`) donde puede estar la etiqueta.
  // Si en CUALQUIERA de estas dice "Vacacionales", se trae el contacto.
  // Si lo dejas en [] NO filtra y trae TODAS las filas de las HOJAS indicadas.
  CAMPOS_ETIQUETA: ["Listado", "Arte I", "Curso/Plan"],
};

// 2) Mapeo: izquierda = campo en Vacacionales, derecha = clave EXACTA dentro de `data`
//    (el nombre de la columna en tu Google Sheet). Ajusta si tus columnas se llaman distinto.
export const MAPEO_CAMPOS = {
  estudiante: "Nombre de Estudiante",
  acudiente:  "Nombre",
  celular:    "Celular/Teléfono",
  correo:     "Correo Electrónico",
  edad:       "Edad",
  grupo:      "Grupo",
};
