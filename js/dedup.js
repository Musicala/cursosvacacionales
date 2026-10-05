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
// Coincide si: mismo identificador de origen o mismo estudiante. El teléfono y
// el correo por sí solos no bastan cuando hay menores: hermanos pueden compartirlos.
export function buscarDuplicado(nuevo, existentes) {
  const celN = normCel(nuevo.celular);
  const corrN = normCorreo(nuevo.correo);
  const nomN = normTexto(nuevo.estudiante);
  const tokN = tokensNombre(nuevo.estudiante);

  for (const e of existentes) {
    // Mismo origen exacto (id en base general)
    if (nuevo.sourceId && e.sourceId && nuevo.sourceId === e.sourceId) return e;
    // Nombre idéntico o con los mismos nombres/apellidos en otro orden
    if (nomN && (normTexto(e.estudiante) === nomN || mismosTokens(tokN, tokensNombre(e.estudiante)))) return e;
    // Cuando no hay estudiante sí se usa teléfono/correo para no multiplicar
    // registros incompletos sin una identidad individual que los distinga.
    if (!nomN && celN && celN.length >= 7 && normCel(e.celular) === celN) return e;
    if (!nomN && corrN && normCorreo(e.correo) === corrN) return e;
  }
  return null;
}
