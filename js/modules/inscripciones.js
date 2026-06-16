// Módulo Inscripciones: estudiantes formalizados con paquete, semana, valor y pago.
import { el, cop, toast, modal, confirmar, fmtFecha, hoyISO } from "../ui.js";
import { listar, crear, actualizar, eliminar, obtenerTemporada, listarTemporadas } from "../db.js";
import { PAQUETES, ESTADOS_PAGO, GRUPOS, grupoPorEdad, semanasDe, semanasDetalle, HORARIO_ESTANDAR, HORARIO_INTENSIVO } from "../catalogos.js";

export default async function render(root, ctx) {
  // Precios de la temporada (para autocompletar el valor según el paquete).
  const temp = (await obtenerTemporada(ctx.temporadaId)) || {};
  ctx._precios = temp.precios || [];
  // Semanas configuradas para esta temporada (ver "Info temporada").
  ctx._semanas = semanasDe(temp);
  ctx._semanasDetalle = semanasDetalle(temp);
  ctx._descuentosLista = Array.isArray(temp.descuentosLista) ? temp.descuentosLista : [];
  // Lista de temporadas (para poder asignar/mover cada inscrito).
  ctx._temporadas = await listarTemporadas();
  // Contactos de la temporada: para inscribir eligiendo de la lista (sin reescribir datos).
  ctx._contactos = await listar(ctx.temporadaId, "contactos");

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "✅ Inscripciones"),
    el("div", { class: "right" },
      el("button", { class: "btn primary", onclick: () => editar(ctx, null, cargar) }, "+ Inscribir estudiante"),
    ),
  ));

  const resumen = el("div", { class: "cards-row" });
  root.append(resumen);
  const cont = el("div", { class: "panel" });
  root.append(cont);

  let datos = [];
  async function cargar() {
    datos = await listar(ctx.temporadaId, "inscripciones");
    pintar();
  }
  function pintar() {
    const total = datos.length;
    const ingresos = datos.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const pagado = datos.filter((d) => d.estadoPago === "Pagado").reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const pendiente = ingresos - pagado;
    resumen.innerHTML = "";
    resumen.append(
      tarjeta("Inscritos", total),
      tarjeta("Ingresos esperados", cop(ingresos)),
      tarjeta("Recaudado", cop(pagado), "ok"),
      tarjeta("Por cobrar", cop(pendiente), pendiente > 0 ? "warn" : "ok"),
    );

    cont.innerHTML = "";
    if (!total) {
      cont.append(el("div", { class: "empty" }, "Aún no hay inscritos en esta temporada."));
      return;
    }
    const tabla = el("table", { class: "table" },
      el("thead", {}, el("tr", {},
        ...["Inscrito el", "Estudiante", "Edad", "Grupo", "Paquete", "Semana(s)", "Horario", "Valor", "Descuento", "Pago", "Ruta", "Dirección", ""].map((h) => el("th", {}, h)))));
    const tb = el("tbody", {});
    datos.forEach((d) => {
      tb.append(el("tr", {},
        el("td", {}, d.fechaInscripcion ? fmtFecha(d.fechaInscripcion) : el("span", { class: "muted" }, "—")),
        el("td", {}, el("strong", {}, d.estudiante || "—")),
        el("td", {}, d.edad ?? ""),
        el("td", {}, d.grupo || ""),
        el("td", {}, d.paquete || ""),
        el("td", {}, (d.semanas || []).join(", ")),
        el("td", {}, d.horario || ""),
        el("td", {}, cop(d.valor)),
        el("td", {}, (d.descuentoIds || []).join(", ") || (d.totalDescuento ? cop(d.totalDescuento) : "")),
        el("td", {}, el("span", { class: "pill pago-" + (d.estadoPago || "").toLowerCase() }, d.estadoPago || "—")),
        el("td", {}, d.ruta ? "🚌" : ""),
        el("td", {}, d.direccion || ""),
        el("td", { class: "row-actions" },
          el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
          el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "🗑"),
        ),
      ));
    });
    tabla.append(tb);
    cont.append(el("div", { class: "table-wrap" }, tabla));
  }
  await cargar();
}

function tarjeta(t, v, tono = "") {
  return el("div", { class: "stat " + tono }, el("div", { class: "stat-val" }, String(v)), el("div", { class: "stat-lbl" }, t));
}

function horasDesdeConcepto(concepto) {
  const m = String(concepto || "").match(/(\d+)\s*horas?/i);
  return m ? Number(m[1]) : 0;
}

function calcularPrecio({ semanas, detalleSemanas, precios, descuentosLista, descuentoIds }) {
  const seleccion = new Set(semanas || []);
  const dias = (detalleSemanas || []).reduce((sum, s) => {
    if (!seleccion.has(s.nombre)) return sum;
    return sum + (Number(s.dias) || 5);
  }, 0);
  const horas = dias * 4;
  const preciosConHoras = (precios || []).map((p) => ({ ...p, horas: horasDesdeConcepto(p.concepto) })).filter((p) => p.horas && p.valor);
  const exacto = preciosConHoras.find((p) => p.horas === horas);
  const base20 = preciosConHoras.find((p) => p.horas === 20) || preciosConHoras[0];
  const valorBase = exacto
    ? Number(exacto.valor) || 0
    : Math.round(((Number(base20?.valor) || 0) / (Number(base20?.horas) || 20)) * horas);
  const paquete = exacto ? exacto.concepto : (horas ? `${horas} horas (${dias} día(s))` : "");
  const seleccionados = (descuentosLista || []).filter((d) => (descuentoIds || []).includes(d.nombre));
  const totalDescuento = seleccionados.reduce((sum, d) => {
    const v = Number(d.valor) || 0;
    return sum + (d.tipo === "valor" ? v : Math.round(valorBase * (v / 100)));
  }, 0);
  const valorFinal = Math.max(0, valorBase - totalDescuento);
  return { dias, horas, paquete, valorBase, totalDescuento, valorFinal };
}

function editar(ctx, dato, onSave) {
  const d = dato || {};
  const f = {};
  const inp = (k, attrs = {}) => { const i = el("input", { type: attrs.type || "text", placeholder: attrs.ph || "" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };
  const sel = (k, ops) => { const s = el("select", {}, ...ops.map((o) => { const op = el("option", { value: o }, o || "—"); if (d[k] === o) op.selected = true; return op; })); f[k] = s; return s; };

  const semWrap = el("div", { class: "chips-input" });
  (ctx._semanas || []).forEach((s) => { const c = el("input", { type: "checkbox", value: s }); if ((d.semanas || []).includes(s)) c.checked = true; semWrap.append(el("label", { class: "chk" }, c, s)); });

  const ruta = el("input", { type: "checkbox" }); if (d.ruta) ruta.checked = true;

  const descuentosDisponibles = ctx._descuentosLista || [];
  const descuentoIdsIniciales = Array.isArray(d.descuentoIds) ? d.descuentoIds : [];
  const descuentosWrap = el("div", { class: "chips-input" });
  descuentosDisponibles.forEach((desc) => {
    const id = desc.nombre || "";
    const chk = el("input", { type: "checkbox", value: id });
    if (descuentoIdsIniciales.includes(id)) chk.checked = true;
    const valor = desc.tipo === "valor" ? cop(desc.valor) : `${Number(desc.valor) || 0}%`;
    descuentosWrap.append(el("label", { class: "chk" }, chk, `${id} (${valor})`));
  });
  const resumenPrecio = el("div", { class: "muted small full" });

  // Horario: estándar (9 a 1) o "Vacacionales Intensivos" con horario personalizado.
  const horarioPredef = d.horario && d.horario !== HORARIO_ESTANDAR ? HORARIO_INTENSIVO : HORARIO_ESTANDAR;
  const selHorario = el("select", {}, ...[HORARIO_ESTANDAR, HORARIO_INTENSIVO].map((o) => {
    const op = el("option", { value: o }, o); if (o === horarioPredef) op.selected = true; return op;
  }));
  const horarioCustom = el("input", { type: "text", placeholder: "Ej: 2:00 p.m. a 5:00 p.m." });
  if (horarioPredef === HORARIO_INTENSIVO) horarioCustom.value = d.horario || "";
  const wrapHorario = el("div", { class: "horario-sel" }, selHorario, horarioCustom);
  function refrescarHorario() {
    horarioCustom.style.display = selHorario.value === HORARIO_INTENSIVO ? "" : "none";
  }
  selHorario.onchange = refrescarHorario;
  refrescarHorario();

  // Selector de temporada: a cuál pertenece este inscrito (permite mover).
  const temporadas = ctx._temporadas || [];
  const selTemporada = el("select", {}, ...temporadas.map((t) => {
    const o = el("option", { value: t.id }, t.nombre || t.id);
    if (t.id === ctx.temporadaId) o.selected = true;
    return o;
  }));

  // Fecha de inscripción: por defecto hoy en las nuevas.
  const fecha = el("input", { type: "date", value: d.fechaInscripcion || hoyISO() });

  // Lista de paquetes: usa los precios de la temporada si existen, si no el catálogo.
  const precios = (ctx._precios && ctx._precios.length) ? ctx._precios : PAQUETES.map((p) => ({ concepto: p.nombre, valor: 0 }));
  const nombresPaquete = precios.map((p) => p.concepto);

  // Buscador para inscribir eligiendo de la lista de Contactos (evita reescribir datos).
  const contactos = ctx._contactos || [];
  function aplicarContacto(c) {
    if (!c) return;
    f.estudiante.value = c.estudiante || "";
    f.edad.value = c.edad ?? "";
    if (c.grupo) f.grupo.value = c.grupo;
    f.acudiente.value = c.acudiente || "";
    f.celular.value = c.celular || "";
    f.direccion.value = c.direccion || "";
    if (c.ruta) ruta.checked = true;
    const contactoDescuentos = new Set(Array.isArray(c.descuentoIds) ? c.descuentoIds : []);
    descuentosWrap.querySelectorAll("input").forEach((chk) => { chk.checked = contactoDescuentos.has(chk.value); });
    // Marcar las semanas de interés del contacto.
    semWrap.querySelectorAll("input").forEach((chk) => { chk.checked = (c.semanas || []).includes(chk.value); });
    recalcularValor();
  }
  const etiquetaC = (c) => `${c.estudiante || "(sin nombre)"}${c.acudiente ? " · " + c.acudiente : ""}${c.celular ? " · " + c.celular : ""}`;

  const buscador = el("input", { type: "text",
    placeholder: contactos.length ? "Escribe un nombre, acudiente o celular…" : "No hay contactos cargados",
    autocomplete: "off" });
  if (!contactos.length) buscador.disabled = true;
  const lista = el("div", { class: "combo-list", style: "display:none" });
  const selContacto = el("div", { class: "combo" }, buscador, lista);

  function pintarLista(q) {
    const term = (q || "").trim().toLowerCase();
    const res = contactos
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !term || etiquetaC(c).toLowerCase().includes(term))
      .slice(0, 30);
    lista.innerHTML = "";
    if (!res.length) { lista.style.display = "none"; return; }
    res.forEach(({ c }) => {
      const item = el("div", { class: "combo-item", onmousedown: (e) => {
        e.preventDefault();
        buscador.value = etiquetaC(c);
        lista.style.display = "none";
        aplicarContacto(c);
      } }, etiquetaC(c));
      lista.append(item);
    });
    lista.style.display = "";
  }
  buscador.addEventListener("focus", () => pintarLista(buscador.value));
  buscador.addEventListener("input", () => pintarLista(buscador.value));
  buscador.addEventListener("blur", () => setTimeout(() => (lista.style.display = "none"), 150));

  const grid = el("div", { class: "form-grid" },
    el("label", { class: "full" }, "Temporada", selTemporada),
    dato ? null : el("label", { class: "full" }, "Inscribir desde contacto", selContacto),
    el("label", {}, "Fecha de inscripción", fecha),
    el("label", {}, "Estudiante", inp("estudiante", { ph: "Nombre" })),
    el("label", {}, "Edad", inp("edad", { type: "number" })),
    el("label", {}, "Grupo", sel("grupo", ["", ...GRUPOS.map((g) => g.nombre)])),
    el("label", {}, "Paquete", sel("paquete", ["", ...nombresPaquete])),
    el("label", {}, "Horario", wrapHorario),
    el("label", {}, "Valor", inp("valor", { type: "number", ph: "0" })),
    resumenPrecio,
    el("label", {}, "Estado de pago", sel("estadoPago", ESTADOS_PAGO)),
    el("label", {}, "Medio de pago", inp("medioPago", { ph: "Nequi / Transferencia…" })),
    el("label", {}, "Acudiente", inp("acudiente")),
    el("label", {}, "Celular", inp("celular", { ph: "+57…" })),
    el("label", { class: "full" }, "Semanas inscritas", semWrap),
    el("label", { class: "chk full" }, ruta, " Necesita ruta"),
    el("label", { class: "full" }, "Dirección / barrio para ruta", inp("direccion", { ph: "Dirección, barrio o punto de recogida" })),
    descuentosDisponibles.length ? el("label", { class: "full" }, "Descuentos aplicados", descuentosWrap) : null,
    el("label", { class: "full" }, "Observaciones", inp("observaciones", { ph: "Notas del pago, acuerdos…" })),
  );

  function descuentosSeleccionados() {
    return [...descuentosWrap.querySelectorAll("input:checked")].map((c) => c.value);
  }

  function semanasSeleccionadas() {
    return [...semWrap.querySelectorAll("input:checked")].map((c) => c.value);
  }

  function calcularPrecioActual() {
    return calcularPrecio({
      semanas: semanasSeleccionadas(),
      detalleSemanas: ctx._semanasDetalle,
      precios,
      descuentosLista: descuentosDisponibles,
      descuentoIds: descuentosSeleccionados(),
    });
  }

  function recalcularValor() {
    const calc = calcularPrecioActual();
    if (calc.valorFinal || calc.valorBase) f.valor.value = calc.valorFinal;
    f.paquete.value = calc.paquete && nombresPaquete.includes(calc.paquete) ? calc.paquete : f.paquete.value;
    resumenPrecio.textContent = calc.horas
      ? `Base ${cop(calc.valorBase)} · ${calc.dias} día(s), ${calc.horas} hora(s) · Descuentos ${cop(calc.totalDescuento)} · Final ${cop(calc.valorFinal)}`
      : "Marca semanas para calcular el valor.";
    return calc;
  }

  semWrap.querySelectorAll("input").forEach((chk) => chk.addEventListener("change", recalcularValor));
  descuentosWrap.querySelectorAll("input").forEach((chk) => chk.addEventListener("change", recalcularValor));
  recalcularValor();

  f.edad.addEventListener("change", () => {
    const g = (GRUPOS.find((x) => x.id === grupoPorEdad(f.edad.value)) || {}).nombre;
    if (g && !f.grupo.value) f.grupo.value = g;
  });
  // Autocompletar el valor según el paquete elegido (precio de la temporada).
  f.paquete.addEventListener("change", () => {
    const p = precios.find((x) => x.concepto === f.paquete.value);
    if (p && p.valor) {
      const descuentoIds = descuentosSeleccionados();
      const totalDescuento = descuentosDisponibles
        .filter((d) => descuentoIds.includes(d.nombre))
        .reduce((sum, d) => sum + (d.tipo === "valor" ? Number(d.valor || 0) : Math.round((Number(p.valor) || 0) * ((Number(d.valor) || 0) / 100))), 0);
      f.valor.value = Math.max(0, Number(p.valor) - totalDescuento);
    }
  });

  modal(dato ? "Editar inscripción" : "Inscribir estudiante", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const calc = calcularPrecioActual();
      const payload = {
        fechaInscripcion: fecha.value || hoyISO(),
        estudiante: f.estudiante.value.trim(), edad: f.edad.value ? Number(f.edad.value) : null,
        grupo: f.grupo.value, paquete: f.paquete.value || calc.paquete,
        horario: selHorario.value === HORARIO_INTENSIVO ? (horarioCustom.value.trim() || HORARIO_INTENSIVO) : HORARIO_ESTANDAR,
        valor: f.valor.value ? Number(f.valor.value) : 0, estadoPago: f.estadoPago.value,
        medioPago: f.medioPago.value.trim(), acudiente: f.acudiente.value.trim(), celular: f.celular.value.trim(),
        ruta: ruta.checked, direccion: f.direccion.value.trim(), observaciones: f.observaciones.value.trim(),
        descuentoIds: descuentosSeleccionados(),
        valorBase: calc.valorBase,
        totalDescuento: calc.totalDescuento,
        diasContratados: calc.dias,
        horasContratadas: calc.horas,
        paqueteCalculado: calc.paquete,
        semanas: semanasSeleccionadas(),
      };
      if (!payload.estudiante) { toast("Falta el nombre del estudiante", "error"); return; }
      const destino = selTemporada.value || ctx.temporadaId;
      try {
        if (destino !== ctx.temporadaId) {
          // Mover/crear en otra temporada.
          await crear(destino, "inscripciones", payload);
          if (dato) await eliminar(ctx.temporadaId, "inscripciones", dato.id);
          dlg.close();
          toast(dato ? "Inscrito movido a otra temporada" : "Inscrito en la temporada elegida");
        } else if (dato) {
          await actualizar(ctx.temporadaId, "inscripciones", dato.id, payload);
          dlg.close(); toast("Guardado");
        } else {
          await crear(ctx.temporadaId, "inscripciones", payload);
          dlg.close(); toast("Guardado");
        }
        onSave && onSave();
      } catch (e) { toast("Error: " + e.message, "error"); }
    } },
  ]);
}

function del(ctx, dato, onSave) {
  confirmar(`¿Eliminar inscripción de ${dato.estudiante}?`, async () => {
    await eliminar(ctx.temporadaId, "inscripciones", dato.id); toast("Eliminado"); onSave && onSave();
  });
}
