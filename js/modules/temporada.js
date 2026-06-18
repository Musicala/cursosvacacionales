// Módulo Info temporada: fechas, precios, descuentos y valor de ruta.
// Guarda todo en el documento de la temporada -> queda como histórico por temporada.
import { el, cop, toast, modal, fmtFecha, fmtCorta } from "../ui.js?v=3";
import { obtenerTemporada, actualizarTemporada } from "../db.js?v=3";
import { PAQUETES, RUTA_MINIMO, DIAS, DIAS_POSIBLES, NUM_SEMANAS_DEFAULT, semanasDetalle } from "../catalogos.js?v=3";

// Precios por defecto (concepto + valor) para una temporada nueva.
function preciosPorDefecto() {
  return PAQUETES.map((p) => ({ concepto: p.nombre, valor: 0 }));
}

function descuentosPorDefecto() {
  return [
    { nombre: "Referido", tipo: "porcentaje", valor: 0 },
    { nombre: "Hermano", tipo: "porcentaje", valor: 0 },
    { nombre: "Pago anticipado", tipo: "porcentaje", valor: 0 },
  ];
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

  // ----- Semanas y sus fechas -----
  const detalle = semanasDetalle(t);
  const pSemanas = el("div", { class: "panel" });
  pSemanas.append(el("h3", {}, "🗓️ Semanas de la temporada"));
  const tbS = el("tbody", {});
  detalle.forEach((s) => tbS.append(el("tr", {},
    el("td", {}, s.nombre),
    el("td", {}, s.desde ? fmtFecha(s.desde) : el("span", { class: "muted" }, "sin definir")),
    el("td", {}, s.hasta ? fmtFecha(s.hasta) : el("span", { class: "muted" }, "sin definir")),
    el("td", {}, s.dias ? `${s.dias} día(s)` : el("span", { class: "muted" }, "sin definir")))));
  pSemanas.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
    el("thead", {}, el("tr", {}, el("th", {}, "Semana"), el("th", {}, "Desde"), el("th", {}, "Hasta"), el("th", {}, "Días"))), tbS)));
  root.append(pSemanas);

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
  const descuentosLista = Array.isArray(t.descuentosLista) ? t.descuentosLista : [];
  if (descuentosLista.length) {
    const tbD = el("tbody", {});
    descuentosLista.forEach((d) => tbD.append(el("tr", {},
      el("td", {}, d.nombre || "—"),
      el("td", {}, d.tipo === "valor" ? "Valor fijo" : "Porcentaje"),
      el("td", {}, d.tipo === "valor" ? cop(d.valor) : `${Number(d.valor) || 0}%`))));
    pDesc.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Descuento"), el("th", {}, "Tipo"), el("th", {}, "Valor"))), tbD)));
  }
  pDesc.append(t.descuentos
    ? el("div", { class: "nota-texto" }, t.descuentos)
    : (descuentosLista.length ? null : el("div", { class: "empty" }, "Sin descuentos registrados. Edita la info para agregarlos.")));
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

  const descuentosLista = Array.isArray(d.descuentosLista) && d.descuentosLista.length
    ? d.descuentosLista.map((x) => ({ ...x }))
    : descuentosPorDefecto();
  const filasDescuentos = el("div", { class: "precio-edit" });
  function pintarDescuentos() {
    filasDescuentos.innerHTML = "";
    descuentosLista.forEach((desc, i) => {
      const nombre = el("input", { type: "text", value: desc.nombre || "", placeholder: "Ej: Referido" });
      nombre.oninput = () => (descuentosLista[i].nombre = nombre.value);
      const tipo = el("select", {},
        el("option", { value: "porcentaje" }, "Porcentaje"),
        el("option", { value: "valor" }, "Valor fijo"));
      tipo.value = desc.tipo || "porcentaje";
      tipo.oninput = () => (descuentosLista[i].tipo = tipo.value);
      const valor = el("input", { type: "number", value: desc.valor || "", placeholder: "0" });
      valor.oninput = () => (descuentosLista[i].valor = Number(valor.value) || 0);
      filasDescuentos.append(el("div", { class: "precio-row" }, nombre, tipo, valor,
        el("button", { class: "btn ghost small", onclick: () => { descuentosLista.splice(i, 1); pintarDescuentos(); } }, "🗑")));
    });
  }
  pintarDescuentos();
  const addDescuento = el("button", { class: "btn ghost small", onclick: () => { descuentosLista.push({ nombre: "", tipo: "porcentaje", valor: 0 }); pintarDescuentos(); } }, "+ Agregar descuento");

  const descuentos = el("textarea", { rows: "3", placeholder: "Ej: 10% por hermano, 5% pago anticipado, descuento por semana completa…" });
  descuentos.value = d.descuentos || "";
  const notas = el("textarea", { rows: "2", placeholder: "Notas internas de la temporada…" });
  notas.value = d.notas || "";

  const nombreInput = inp("nombre", { ph: "Se arma solo con las fechas (ej: 9 jun – 6 ago 2026)" });

  // ----- Configuración de calendario: número de semanas y días de clase -----
  const numSemanas = el("input", { type: "number", min: "1", max: "12", placeholder: String(NUM_SEMANAS_DEFAULT) });
  numSemanas.value = d.numSemanas || NUM_SEMANAS_DEFAULT;

  // ----- Fechas de cada semana (se regeneran según el número de semanas) -----
  let semanasFechas = (Array.isArray(d.semanasFechas) ? d.semanasFechas.map((x) => ({ ...x })) : []);
  const filasSemanas = el("div", { class: "precio-edit" });
  function pintarSemanas() {
    const n = Number(numSemanas.value) > 0 ? Number(numSemanas.value) : NUM_SEMANAS_DEFAULT;
    // Ajustar el arreglo al número de semanas, conservando lo ya escrito.
    while (semanasFechas.length < n) semanasFechas.push({ desde: "", hasta: "" });
    semanasFechas = semanasFechas.slice(0, n);
    filasSemanas.innerHTML = "";
    semanasFechas.forEach((s, i) => {
      const desde = el("input", { type: "date", value: s.desde || "" });
      desde.oninput = () => (semanasFechas[i].desde = desde.value);
      const hasta = el("input", { type: "date", value: s.hasta || "" });
      hasta.oninput = () => (semanasFechas[i].hasta = hasta.value);
      const dias = el("input", { type: "number", min: "1", max: "7", value: s.dias || "", placeholder: "Días" });
      dias.oninput = () => (semanasFechas[i].dias = Number(dias.value) || 0);
      filasSemanas.append(el("div", { class: "precio-row" },
        el("span", { class: "sem-label" }, `Semana ${i + 1}`), desde, hasta, dias));
    });
  }

  const diasActuales = (Array.isArray(d.dias) && d.dias.length) ? d.dias : DIAS;
  const diasChecks = DIAS_POSIBLES.map((dia) => {
    const c = el("input", { type: "checkbox", value: dia });
    if (diasActuales.includes(dia)) c.checked = true;
    return el("label", { class: "check" }, c, " " + dia);
  });

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
      el("label", {}, "Número de semanas", numSemanas),
    ),
    el("h4", {}, "🗓️ Fechas de cada semana"),
    el("p", { class: "muted small" }, "Indica de qué fecha a qué fecha va cada semana."),
    filasSemanas,
    el("h4", {}, "🗓️ Días de clase"),
    el("p", { class: "muted small" }, "Determina las columnas del horario y las opciones de día."),
    el("div", { class: "checks" }, ...diasChecks),
    el("h4", {}, "💲 Precios de los paquetes"),
    filasPrecios, addPrecio,
    el("h4", {}, "Descuentos configurables"),
    el("p", { class: "muted small" }, "Estos descuentos se pueden marcar en Contactos o al hacer la inscripción. Si marcas varios, se acumulan."),
    filasDescuentos, addDescuento,
    el("label", { class: "block-label" }, "🏷️ Descuentos y promociones", descuentos),
    el("label", { class: "block-label" }, "Notas", notas),
  );

  // Al elegir las fechas, arma el nombre automáticamente (si no lo escribieron a mano).
  f.fechaInicio.addEventListener("change", autoNombre);
  f.fechaFin.addEventListener("change", autoNombre);

  // Generar las filas de fechas por semana y regenerarlas si cambia el número.
  pintarSemanas();
  numSemanas.addEventListener("input", pintarSemanas);

  modal(t ? "Editar info de la temporada" : "Nueva temporada", body, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const datos = {
        nombre: f.nombre.value.trim(),
        fechaInicio: f.fechaInicio.value || "",
        fechaFin: f.fechaFin.value || "",
        valorRuta: f.valorRuta.value ? Number(f.valorRuta.value) : 0,
        numSemanas: Number(numSemanas.value) > 0 ? Number(numSemanas.value) : NUM_SEMANAS_DEFAULT,
        dias: (() => {
          const sel = diasChecks.map((l) => l.querySelector("input")).filter((c) => c.checked).map((c) => c.value);
          return sel.length ? sel : DIAS;
        })(),
        semanasFechas: semanasFechas.map((s) => ({ desde: s.desde || "", hasta: s.hasta || "", dias: Number(s.dias) || 0 })),
        precios: precios.filter((p) => p.concepto.trim()),
        descuentosLista: descuentosLista.filter((d) => d.nombre.trim()).map((d) => ({
          nombre: d.nombre.trim(),
          tipo: d.tipo === "valor" ? "valor" : "porcentaje",
          valor: Number(d.valor) || 0,
        })),
        descuentos: descuentos.value.trim(),
        notas: notas.value.trim(),
      };
      const ok = await onSave(datos);
      if (ok) dlg.close();
    } },
  ]);
}
