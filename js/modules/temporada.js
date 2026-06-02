// Módulo Info temporada: fechas, precios, descuentos y valor de ruta.
// Guarda todo en el documento de la temporada -> queda como histórico por temporada.
import { el, cop, toast, modal, fmtFecha, fmtCorta } from "../ui.js";
import { obtenerTemporada, actualizarTemporada } from "../db.js";
import { PAQUETES, RUTA_MINIMO } from "../catalogos.js";

// Precios por defecto (concepto + valor) para una temporada nueva.
function preciosPorDefecto() {
  return PAQUETES.map((p) => ({ concepto: p.nombre, valor: 0 }));
}

export default async function render(root, ctx) {
  const t = (await obtenerTemporada(ctx.temporadaId)) || ctx.temporada || { id: ctx.temporadaId };

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "📅 Info de la temporada"),
    el("div", { class: "right" },
      el("button", { class: "btn primary", onclick: () => editar(ctx, t) }, "✏️ Editar info"),
    ),
  ));

  // ----- Resumen de fechas -----
  root.append(el("div", { class: "cards-row" },
    tarjeta("Temporada", t.nombre || t.id),
    tarjeta("Inicio", t.fechaInicio ? fmtFecha(t.fechaInicio) : "—"),
    tarjeta("Fin", t.fechaFin ? fmtFecha(t.fechaFin) : "—"),
    tarjeta("Valor ruta", t.valorRuta ? cop(t.valorRuta) : "—"),
  ));

  // ----- Tabla de precios -----
  const precios = (t.precios && t.precios.length) ? t.precios : preciosPorDefecto();
  const pPrecios = el("div", { class: "panel" });
  pPrecios.append(el("h3", {}, "💲 Precios de los paquetes"));
  const tb = el("tbody", {});
  precios.forEach((p) => tb.append(el("tr", {},
    el("td", {}, p.concepto),
    el("td", {}, p.valor ? cop(p.valor) : el("span", { class: "muted" }, "sin definir")))));
  pPrecios.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
    el("thead", {}, el("tr", {}, el("th", {}, "Paquete"), el("th", {}, "Valor"))), tb)));
  root.append(pPrecios);

  // ----- Descuentos -----
  const pDesc = el("div", { class: "panel" });
  pDesc.append(el("h3", {}, "🏷️ Descuentos y promociones"));
  pDesc.append(t.descuentos
    ? el("div", { class: "nota-texto" }, t.descuentos)
    : el("div", { class: "empty" }, "Sin descuentos registrados. Edita la info para agregarlos."));
  root.append(pDesc);

  // ----- Ruta / notas -----
  const pNotas = el("div", { class: "panel" });
  pNotas.append(el("h3", {}, "🚌 Ruta y notas"));
  pNotas.append(el("p", { class: "muted" },
    `La ruta es viable con mínimo ${RUTA_MINIMO} estudiantes. Valor de la ruta: `,
    el("strong", {}, t.valorRuta ? cop(t.valorRuta) : "sin definir")));
  if (t.notas) pNotas.append(el("div", { class: "nota-texto" }, t.notas));
  root.append(pNotas);
}

function tarjeta(lbl, val) {
  return el("div", { class: "stat" }, el("div", { class: "stat-val" }, String(val)), el("div", { class: "stat-lbl" }, lbl));
}

function editar(ctx, t) {
  formularioTemporada(t, async (datos) => {
    await actualizarTemporada(ctx.temporadaId, datos);
    toast("Información guardada");
    location.reload();
    return true;
  });
}

// Formulario reutilizable (lo usa también app.js para CREAR temporada).
// onSave(datos) debe devolver true si se guardó (para cerrar el modal).
export function formularioTemporada(t, onSave) {
  const d = t || {};
  const f = {};
  const inp = (k, attrs = {}) => { const i = el("input", { type: attrs.type || "text", placeholder: attrs.ph || "" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };

  // Tabla editable de precios
  const precios = (d.precios && d.precios.length) ? d.precios.map((x) => ({ ...x })) : preciosPorDefecto();
  const filasPrecios = el("div", { class: "precio-edit" });
  function pintarPrecios() {
    filasPrecios.innerHTML = "";
    precios.forEach((p, i) => {
      const cn = el("input", { type: "text", value: p.concepto, placeholder: "Concepto" });
      cn.oninput = () => (precios[i].concepto = cn.value);
      const vl = el("input", { type: "number", value: p.valor || "", placeholder: "0" });
      vl.oninput = () => (precios[i].valor = Number(vl.value) || 0);
      filasPrecios.append(el("div", { class: "precio-row" }, cn, vl,
        el("button", { class: "btn ghost small", onclick: () => { precios.splice(i, 1); pintarPrecios(); } }, "🗑")));
    });
  }
  pintarPrecios();
  const addPrecio = el("button", { class: "btn ghost small", onclick: () => { precios.push({ concepto: "", valor: 0 }); pintarPrecios(); } }, "+ Agregar precio");

  const descuentos = el("textarea", { rows: "3", placeholder: "Ej: 10% por hermano, 5% pago anticipado, descuento por semana completa…" });
  descuentos.value = d.descuentos || "";
  const notas = el("textarea", { rows: "2", placeholder: "Notas internas de la temporada…" });
  notas.value = d.notas || "";

  const nombreInput = inp("nombre", { ph: "Se arma solo con las fechas (ej: 9 jun – 6 ago 2026)" });

  // El nombre se genera a partir del rango de fechas (estilo elegido por Musicala).
  function nombreDesdeFechas() {
    const i = f.fechaInicio.value, fin = f.fechaFin.value;
    if (i && fin) return `${fmtCorta(i)} – ${fmtFecha(fin)}`;
    if (i) return fmtFecha(i);
    return "";
  }
  // Marca si el usuario escribió el nombre a mano (para no sobreescribirlo).
  let nombreManual = !!(d.nombre && d.fechaInicio && d.nombre !== `${fmtCorta(d.fechaInicio)} – ${fmtFecha(d.fechaFin || d.fechaInicio)}`);
  nombreInput.addEventListener("input", () => { nombreManual = true; });
  function autoNombre() { if (!nombreManual) { const n = nombreDesdeFechas(); if (n) nombreInput.value = n; } }

  const body = el("div", {},
    el("div", { class: "form-grid" },
      el("label", {}, "Nombre de la temporada", nombreInput),
      el("label", {}, "Valor de la ruta", inp("valorRuta", { type: "number", ph: "0" })),
      el("label", {}, "Fecha de inicio", inp("fechaInicio", { type: "date" })),
      el("label", {}, "Fecha de finalización", inp("fechaFin", { type: "date" })),
    ),
    el("h4", {}, "💲 Precios de los paquetes"),
    filasPrecios, addPrecio,
    el("label", { class: "block-label" }, "🏷️ Descuentos y promociones", descuentos),
    el("label", { class: "block-label" }, "Notas", notas),
  );

  // Al elegir las fechas, arma el nombre automáticamente (si no lo escribieron a mano).
  f.fechaInicio.addEventListener("change", autoNombre);
  f.fechaFin.addEventListener("change", autoNombre);

  modal(t ? "Editar info de la temporada" : "Nueva temporada", body, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const datos = {
        nombre: f.nombre.value.trim(),
        fechaInicio: f.fechaInicio.value || "",
        fechaFin: f.fechaFin.value || "",
        valorRuta: f.valorRuta.value ? Number(f.valorRuta.value) : 0,
        precios: precios.filter((p) => p.concepto.trim()),
        descuentos: descuentos.value.trim(),
        notas: notas.value.trim(),
      };
      const ok = await onSave(datos);
      if (ok) dlg.close();
    } },
  ]);
}
