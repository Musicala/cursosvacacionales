// Permiso de cada estudiante para consumir en el Musicafé.
// Vive en la inscripción y se aplica al registrar el consumo.
import { el } from "./ui.js?v=3";

export const LIBRE = "libre";
export const RESTRINGIDO = "restringido";
export const VETADO = "vetado";

export const NIVELES = [
  { id: LIBRE, etiqueta: "Libre — puede comprar de todo" },
  { id: RESTRINGIDO, etiqueta: "Restringido — solo algunas categorías" },
  { id: VETADO, etiqueta: "Vetado — no puede comprar nada" },
];

// Lee los campos de permiso de una inscripción (con valores por defecto sanos).
export function permisoDe(insc) {
  const d = insc || {};
  const nivel = [LIBRE, RESTRINGIDO, VETADO].includes(d.musicafePermiso) ? d.musicafePermiso : LIBRE;
  return {
    nivel,
    categorias: Array.isArray(d.musicafeCategorias) ? d.musicafeCategorias : [],
    nota: (d.musicafeNota || "").trim(),
  };
}

export function puedeCategoria(permiso, categoria) {
  if (permiso.nivel === VETADO) return false;
  if (permiso.nivel !== RESTRINGIDO) return true;
  return permiso.categorias.includes(categoria);
}

// Badge para las listas (null cuando el permiso es libre, para no ensuciar la vista).
export function badgePermiso(permiso) {
  if (permiso.nivel === VETADO) {
    return el("span", { class: "badge veto", title: permiso.nota || "No puede comprar en el Musicafé" }, "🚫 Sin Musicafé");
  }
  if (permiso.nivel === RESTRINGIDO) {
    const detalle = permiso.categorias.length ? "Solo: " + permiso.categorias.join(", ") : "Con restricciones";
    return el("span", { class: "badge warn", title: [detalle, permiso.nota].filter(Boolean).join(" · ") }, "⚠️ Musicafé restringido");
  }
  return null;
}
