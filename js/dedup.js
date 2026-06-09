// Utilidades para detectar contactos duplicados (Pepito Pérez x1000 no, gracias).

// Texto normalizado: minúsculas, sin tildes, sin signos, espacios colapsados.
export function normTexto(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Teléfono: solo dígitos; compara por los últimos 10 (ignora +57, etc.).
export function normCel(cel) {
  const d = String(cel || "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export function normCorreo(c) {
  return String(c || "").trim().toLowerCase();
}

// Conjunto de palabras del nombre (para comparar "Pepito Perez" ≈ "Perez Pepito").
function tokensNombre(nombre) {
  return new Set(normTexto(nombre).split(" ").filter((t) => t.length > 1));
}
function mismosTokens(a, b) {
  if (a.size === 0 || b.size === 0) return false;
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

// Busca un duplicado de `nuevo` dentro de `existentes`. Devuelve el existente o null.
// Coincide si: mismo teléfono, o mismo correo, o mismo nombre (igual o mismos apellidos/nombres).
export function buscarDuplicado(nuevo, existentes) {
  const celN = normCel(nuevo.celular);
  const corrN = normCorreo(nuevo.correo);
  const nomN = normTexto(nuevo.estudiante);
  const tokN = tokensNombre(nuevo.estudiante);

  for (const e of existentes) {
    // Mismo origen exacto (id en base general)
    if (nuevo.sourceId && e.sourceId && nuevo.sourceId === e.sourceId) return e;
    // Teléfono (al menos 7 dígitos para evitar falsos positivos)
    if (celN && celN.length >= 7 && normCel(e.celular) === celN) return e;
    // Correo
    if (corrN && normCorreo(e.correo) === corrN) return e;
    // Nombre idéntico o con los mismos nombres/apellidos en otro orden
    if (nomN && (normTexto(e.estudiante) === nomN || mismosTokens(tokN, tokensNombre(e.estudiante)))) return e;
  }
  return null;
}
