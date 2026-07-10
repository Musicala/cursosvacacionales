// Módulo Inscripciones: estudiantes formalizados con paquete, semana, valor y pago.
import { el, cop, toast, modal, confirmar, fmtFecha, hoyISO } from "../ui.js?v=3";
import { listar, crear, actualizar, eliminar, obtenerTemporada, listarTemporadas, listarPagos, crearPago, eliminarPago } from "../db.js?v=5";
import { PAQUETES, ESTADOS_PAGO, GRUPOS, grupoPorEdad, nombreGrupo, semanasDe, semanasDetalle, diasDe, HORARIO_ESTANDAR, HORARIO_INTENSIVO } from "../catalogos.js?v=5";
import { totalPagado, saldoInscripcion, estadoPagoCalculado, valoresPorSemana, pagosPorSemana } from "../pagos.js?v=1";

const MEDIOS_PAGO_DEFAULT = ["Efectivo", "Transferencia bancaria", "Nequi", "Daviplata", "Tarjeta"];

export default async function render(root, ctx) {
  // Precios de la temporada (para autocompletar el valor según el paquete).
  const temp = (await obtenerTemporada(ctx.temporadaId)) || {};
  ctx._precios = temp.precios || [];
  // Semanas configuradas para esta temporada (ver "Info temporada").
  ctx._semanas = semanasDe(temp);
  ctx._semanasDetalle = semanasDetalle(temp);
  ctx._descuentosLista = Array.isArray(temp.descuentosLista) ? temp.descuentosLista : [];
  ctx._mediosPago = Array.isArray(temp.mediosPago) && temp.mediosPago.length
    ? temp.mediosPago.filter(Boolean)
    : MEDIOS_PAGO_DEFAULT;
  ctx._diasTemporada = diasDe(temp);
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
  const filtros = { q: "", semana: "", dia: "", grupo: "", pago: "", vista: "tabla", orden: "semana" };
  async function cargar() {
    datos = (await listar(ctx.temporadaId, "inscripciones")).map((d) => ({ ...d, grupo: nombreGrupo(d.grupo) }));
    await Promise.all(datos.map(async (d) => {
      d.pagos = await listarPagos(ctx.temporadaId, d.id);
      d.pagosCargados = true;
    }));
    pintar();
  }
  function pintar() {
    const total = datos.length;
    const ingresos = datos.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const pagado = datos.reduce((s, d) => s + totalPagado(d), 0);
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
    const filtrados = ordenarInscripciones(filtrarInscripciones(datos, filtros, ctx), filtros.orden, ctx);
    cont.append(crearControlesInscripciones(datos, filtros, ctx, pintar));
    cont.append(el("div", { class: "insc-count" }, `${filtrados.length} de ${total} inscritos visibles`));
    if (!filtrados.length) {
      cont.append(el("div", { class: "empty" }, "No hay inscritos con esos filtros."));
      return;
    }
    if (filtros.vista === "tarjetas") {
      cont.append(vistaTarjetas(filtrados, ctx, cargar));
      return;
    }
    if (filtros.vista === "semanas") {
      cont.append(vistaSemanas(filtrados, ctx, cargar));
      return;
    }
    cont.append(vistaTabla(filtrados, ctx, cargar));
    return;
    const tabla = el("table", { class: "table" },
      el("thead", {}, el("tr", {},
        ...["Inscrito el", "Estudiante", "Edad", "Grupo", "Paquete", "Semana(s)", "Horario", "Valor", "Descuento", "Pago", "Ruta", "Dirección", ""].map((h) => el("th", {}, h)))));
    const tb = el("tbody", {});
    filtrados.forEach((d) => {
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

function crearControlesInscripciones(datos, filtros, ctx, onChange) {
  const semanas = ctx._semanas || [];
  const dias = ctx._diasTemporada || [];
  const grupos = [...new Set(datos.map((d) => d.grupo).filter(Boolean))].sort();
  const pagos = [...new Set(datos.map((d) => d.estadoPago).filter(Boolean))].sort();
  const set = (k, v) => { filtros[k] = v; onChange(); };
  const opt = (value, label) => el("option", { value }, label);
  const selected = (select, value) => { select.value = value; return select; };
  const vistaBtn = (value, label) => el("button", {
    class: "btn small " + (filtros.vista === value ? "primary" : "ghost"),
    onclick: () => set("vista", value),
  }, label);

  const buscar = el("input", { type: "search", placeholder: "Buscar estudiante, acudiente, celular o direccion" });
  buscar.value = filtros.q;
  buscar.addEventListener("input", () => { filtros.q = buscar.value; filtros._focusBuscar = true; onChange(); });
  if (filtros._focusBuscar) {
    filtros._focusBuscar = false;
    setTimeout(() => {
      buscar.focus();
      const n = buscar.value.length;
      try { buscar.setSelectionRange(n, n); } catch (_) {}
    }, 0);
  }

  const semanaSel = selected(el("select", { onchange: (e) => set("semana", e.target.value) },
    opt("", "Todas las semanas"),
    ...semanas.map((s) => opt(s, s)),
  ), filtros.semana);
  const diaSel = selected(el("select", { onchange: (e) => set("dia", e.target.value) },
    opt("", "Todos los dias"),
    ...dias.map((d) => opt(d, d)),
  ), filtros.dia);
  const grupoSel = selected(el("select", { onchange: (e) => set("grupo", e.target.value) },
    opt("", "Todos los grupos"),
    ...grupos.map((g) => opt(g, g)),
  ), filtros.grupo);
  const pagoSel = selected(el("select", { onchange: (e) => set("pago", e.target.value) },
    opt("", "Todos los pagos"),
    ...pagos.map((p) => opt(p, p)),
  ), filtros.pago);
  const ordenSel = selected(el("select", { onchange: (e) => set("orden", e.target.value) },
    opt("semana", "Orden: semana"),
    opt("nombre", "Orden: nombre"),
    opt("grupo", "Orden: grupo"),
    opt("edad", "Orden: edad"),
    opt("pago", "Orden: pago"),
    opt("fecha", "Orden: inscritos recientes"),
  ), filtros.orden);

  return el("div", { class: "insc-tools" },
    el("div", { class: "insc-search" }, buscar),
    el("div", { class: "filters insc-filters" },
      el("label", {}, "Semana", semanaSel),
      el("label", {}, "Dia", diaSel),
      el("label", {}, "Grupo", grupoSel),
      el("label", {}, "Pago", pagoSel),
      el("label", {}, "Ordenar", ordenSel),
    ),
    el("div", { class: "insc-viewbar" },
      vistaBtn("tabla", "Tabla"),
      vistaBtn("tarjetas", "Tarjetas"),
      vistaBtn("semanas", "Por semana"),
      el("button", { class: "btn small ghost", onclick: () => {
        filtros.q = ""; filtros.semana = ""; filtros.dia = ""; filtros.grupo = ""; filtros.pago = ""; filtros.orden = "semana"; onChange();
      } }, "Limpiar"),
    ),
  );
}

function textoBusqueda(d) {
  return [d.estudiante, d.acudiente, d.celular, d.grupo, d.direccion, d.observaciones].filter(Boolean).join(" ").toLowerCase();
}

function diasDeInscrito(d, semana, ctx) {
  const todos = ctx._diasTemporada || [];
  const porSemana = d.diasPorSemana || {};
  const dias = Array.isArray(porSemana[semana]) ? porSemana[semana] : todos;
  return dias.filter((dia) => todos.includes(dia));
}

function tieneDia(d, dia, ctx) {
  if (!dia) return true;
  return (d.semanas || []).some((semana) => diasDeInscrito(d, semana, ctx).includes(dia));
}

function filtrarInscripciones(datos, filtros, ctx) {
  const q = filtros.q.trim().toLowerCase();
  return datos.filter((d) => {
    if (q && !textoBusqueda(d).includes(q)) return false;
    if (filtros.semana && !(d.semanas || []).includes(filtros.semana)) return false;
    if (filtros.dia && !tieneDia(d, filtros.dia, ctx)) return false;
    if (filtros.grupo && d.grupo !== filtros.grupo) return false;
    if (filtros.pago && d.estadoPago !== filtros.pago) return false;
    return true;
  });
}

function primeraSemanaIndex(d, ctx) {
  const semanas = ctx._semanas || [];
  const indexes = (d.semanas || []).map((s) => semanas.indexOf(s)).filter((i) => i >= 0);
  return indexes.length ? Math.min(...indexes) : 999;
}

function ordenarInscripciones(datos, orden, ctx) {
  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  const copia = [...datos];
  return copia.sort((a, b) => {
    if (orden === "nombre") return collator.compare(a.estudiante || "", b.estudiante || "");
    if (orden === "grupo") return collator.compare(a.grupo || "", b.grupo || "") || collator.compare(a.estudiante || "", b.estudiante || "");
    if (orden === "edad") return (Number(a.edad) || 99) - (Number(b.edad) || 99) || collator.compare(a.estudiante || "", b.estudiante || "");
    if (orden === "pago") return collator.compare(a.estadoPago || "", b.estadoPago || "") || collator.compare(a.estudiante || "", b.estudiante || "");
    if (orden === "fecha") return String(b.fechaInscripcion || "").localeCompare(String(a.fechaInscripcion || ""));
    return primeraSemanaIndex(a, ctx) - primeraSemanaIndex(b, ctx) || collator.compare(a.estudiante || "", b.estudiante || "");
  });
}

function resumenDias(d, ctx) {
  const semanas = d.semanas || [];
  if (!semanas.length) return el("span", { class: "muted" }, "Sin semanas");
  return el("div", { class: "day-summary" }, semanas.map((semana) => {
    const dias = diasDeInscrito(d, semana, ctx);
    const todos = dias.length === (ctx._diasTemporada || []).length;
    return el("div", { class: "day-line" },
      el("strong", {}, semana),
      el("span", {}, todos ? "Todos los dias" : dias.join(", ")),
    );
  }));
}

function accionesInscripcion(d, ctx, onSave) {
  return el("div", { class: "row-actions" },
    el("button", { class: "btn primary small", onclick: () => gestionarPagos(ctx, d, onSave) }, "Pagos"),
    el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, onSave) }, "Editar"),
    el("button", { class: "btn ghost small", onclick: () => del(ctx, d, onSave) }, "Eliminar"),
  );
}

function vistaTabla(datos, ctx, onSave) {
  const tabla = el("table", { class: "table insc-table" },
    el("thead", {}, el("tr", {},
      ...["Estudiante", "Edad", "Grupo", "Semana(s)", "Dias", "Horario", "Pago", "Ruta", "Direccion", "Observaciones", ""].map((h) => el("th", {}, h)))));
  const tb = el("tbody", {});
  datos.forEach((d) => {
    tb.append(el("tr", {},
      el("td", {}, el("strong", {}, d.estudiante || "-"), d.acudiente ? el("div", { class: "muted small" }, d.acudiente) : null),
      el("td", {}, d.edad ?? ""),
      el("td", {}, d.grupo || ""),
      el("td", {}, (d.semanas || []).join(", ")),
      el("td", {}, resumenDias(d, ctx)),
      el("td", {}, d.horario || ""),
      el("td", {}, resumenPago(d)),
      el("td", {}, d.ruta ? "Si" : ""),
      el("td", {}, d.direccion || ""),
      el("td", {}, textoObservaciones(d, ctx) ? el("div", { class: "insc-note" }, textoObservaciones(d, ctx)) : ""),
      el("td", {}, accionesInscripcion(d, ctx, onSave)),
    ));
  });
  tabla.append(tb);
  return el("div", { class: "table-wrap" }, tabla);
}

function vistaTarjetas(datos, ctx, onSave) {
  return el("div", { class: "insc-card-grid" }, datos.map((d) => el("article", { class: "insc-card" },
    el("div", { class: "insc-card-head" },
      el("div", {}, el("h3", {}, d.estudiante || "-"), el("div", { class: "muted small" }, [d.edad ? `${d.edad} anos` : "", d.grupo || ""].filter(Boolean).join(" · "))),
      resumenPago(d),
    ),
    resumenDias(d, ctx),
    el("div", { class: "insc-card-meta" }, d.horario || "", d.ruta ? "Ruta: si" : "Sin ruta"),
    d.acudiente || d.celular ? el("div", { class: "muted small" }, [d.acudiente, d.celular].filter(Boolean).join(" · ")) : null,
    textoObservaciones(d, ctx) ? el("div", { class: "insc-note card-note" }, textoObservaciones(d, ctx)) : null,
    accionesInscripcion(d, ctx, onSave),
  )));
}

function textoObservaciones(d, ctx) {
  const propia = (d.observaciones || "").trim();
  if (propia) return propia;
  const contactos = ctx._contactos || [];
  const estudiante = normalizarTexto(d.estudiante);
  const celular = normalizarTexto(d.celular);
  const contacto = contactos.find((c) =>
    (celular && normalizarTexto(c.celular) === celular) ||
    (estudiante && normalizarTexto(c.estudiante) === estudiante)
  );
  return (contacto?.observaciones || "").trim();
}

function normalizarTexto(v) {
  return String(v || "").trim().toLowerCase();
}

function vistaSemanas(datos, ctx, onSave) {
  const semanas = ctx._semanas || [];
  return el("div", { class: "week-view" }, semanas.map((semana) => {
    const inscritos = datos.filter((d) => (d.semanas || []).includes(semana));
    return el("section", { class: "week-block" },
      el("div", { class: "week-title" }, el("h3", {}, semana), el("span", { class: "pill" }, `${inscritos.length} ninos`)),
      inscritos.length ? el("div", { class: "week-list" }, inscritos.map((d) => el("div", { class: "week-student" },
        el("div", {}, el("strong", {}, d.estudiante || "-"), el("div", { class: "muted small" }, [d.edad ? `${d.edad} anos` : "", d.grupo || ""].filter(Boolean).join(" · "))),
        el("div", { class: "week-days" }, diasDeInscrito(d, semana, ctx).map((dia) => el("span", { class: "day-chip" }, dia.slice(0, 3)))),
        el("div", {}, estadoSemana(d, semana)),
        accionesInscripcion(d, ctx, onSave),
      ))) : el("div", { class: "empty compact" }, "Sin inscritos"),
    );
  }));
}

function resumenPago(d) {
  const estado = estadoPagoCalculado(d);
  return el("div", { class: "payment-summary" },
    el("span", { class: "pill pago-" + estado.toLowerCase() }, estado),
    el("span", { class: "small" }, `${cop(totalPagado(d))} de ${cop(d.valor)}`),
    saldoInscripcion(d) ? el("span", { class: "muted small" }, `Debe ${cop(saldoInscripcion(d))}`) : null,
  );
}

function estadoSemana(d, semana) {
  const esperado = valoresPorSemana(d)[semana] || 0;
  const abonado = pagosPorSemana(d)[semana] || 0;
  const estado = esperado > 0 && abonado >= esperado ? "Pagada" : abonado > 0 ? "Pago parcial" : "Pendiente";
  return el("div", { class: "week-payment" },
    el("span", { class: "pill pago-" + (estado === "Pagada" ? "pagado" : estado === "Pago parcial" ? "abono" : "pendiente") }, estado),
    el("span", { class: "muted small" }, `${cop(abonado)} de ${cop(esperado)}`),
  );
}

function gestionarPagos(ctx, d, onSave) {
  const pagos = (d.pagos || []).slice().sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
  const body = el("div", { class: "payments-manager" });
  const refrescarCabecera = () => body.append(el("div", { class: "payment-balance" },
    el("div", {}, el("span", { class: "muted small" }, "Valor total"), el("strong", {}, cop(d.valor))),
    el("div", {}, el("span", { class: "muted small" }, "Abonado"), el("strong", {}, cop(totalPagado(d)))),
    el("div", {}, el("span", { class: "muted small" }, "Saldo"), el("strong", {}, cop(saldoInscripcion(d)))),
  ));
  refrescarCabecera();

  const semanasValor = valoresPorSemana(d);
  const semanasPagado = pagosPorSemana(d);
  body.append(el("h4", {}, "Estado por semana"));
  body.append(el("div", { class: "payment-weeks" }, ...(d.semanas || []).map((semana) =>
    el("div", { class: "payment-week-row" },
      el("div", {}, el("strong", {}, semana), el("div", { class: "muted small" }, `Valor ${cop(semanasValor[semana])}`)),
      estadoSemana(d, semana),
    )
  )));

  body.append(el("h4", {}, "Historial de movimientos"));
  const historial = el("div", { class: "payment-history" });
  if (!pagos.length) historial.append(el("div", { class: "empty compact" }, d.estadoPago === "Pagado"
    ? "Registro anterior marcado como pagado. Los próximos movimientos quedarán detallados aquí."
    : "Aún no hay abonos registrados."));
  pagos.forEach((p) => historial.append(el("div", { class: "payment-history-row" },
    el("div", {},
      el("strong", {}, `${fmtFecha(p.fecha)} · ${cop(p.valor)}`),
      el("div", { class: "muted small" }, [p.medio, p.nota].filter(Boolean).join(" · ")),
      el("div", { class: "muted small" }, Object.entries(p.distribucion || {}).map(([s, v]) => `${s}: ${cop(v)}`).join(" · ")),
    ),
    el("button", { class: "btn ghost small", onclick: () => confirmar(`¿Eliminar el pago de ${cop(p.valor)}?`, async () => {
      await eliminarPago(ctx.temporadaId, d.id, p.id);
      const restante = (d.pagos || []).filter((x) => x.id !== p.id).reduce((s, x) => s + (Number(x.valor) || 0), 0);
      const estado = restante >= (Number(d.valor) || 0) && restante > 0 ? "Pagado" : restante > 0 ? "Abono" : "Pendiente";
      await actualizar(ctx.temporadaId, "inscripciones", d.id, { estadoPago: estado });
      toast("Pago eliminado");
      onSave && onSave();
    }) }, "Eliminar"),
  )));
  body.append(historial);

  modal(`Pagos · ${d.estudiante}`, body, [
    { texto: "Cerrar", clase: "ghost" },
    { texto: "+ Registrar abono", clase: "primary", onClick: (dlg) => { dlg.close(); registrarAbono(ctx, d, onSave); } },
  ]);
}

function registrarAbono(ctx, d, onSave) {
  const saldo = saldoInscripcion(d);
  if (saldo <= 0) { toast("Esta inscripción ya está pagada", "error"); return; }
  const fecha = el("input", { type: "date", value: hoyISO() });
  const valor = el("input", { type: "number", min: "1", max: String(saldo), value: String(saldo) });
  const medio = el("select", {},
    el("option", { value: "" }, "—"),
    ...(ctx._mediosPago || MEDIOS_PAGO_DEFAULT).map((opcion) => el("option", { value: opcion }, opcion)));
  const nota = el("input", { placeholder: "Acuerdo o referencia (opcional)" });
  const distribucionWrap = el("div", { class: "payment-allocation full" });
  const valores = valoresPorSemana(d);
  const pagado = pagosPorSemana(d);
  const campos = {};

  (d.semanas || []).forEach((semana) => {
    const pendiente = Math.max(0, (valores[semana] || 0) - (pagado[semana] || 0));
    const input = el("input", { type: "number", min: "0", max: String(pendiente), value: "0", "data-semana": semana });
    campos[semana] = { input, pendiente };
    distribucionWrap.append(el("label", { class: "payment-allocation-row" },
      el("span", {}, el("strong", {}, semana), el("small", { class: "muted" }, ` Pendiente ${cop(pendiente)}`)),
      input,
    ));
  });

  function distribuirAutomatico() {
    let restante = Math.max(0, Number(valor.value) || 0);
    Object.values(campos).forEach(({ input, pendiente }) => {
      const asignado = Math.min(restante, pendiente);
      input.value = String(asignado);
      restante -= asignado;
    });
  }
  valor.addEventListener("input", distribuirAutomatico);
  distribuirAutomatico();

  const grid = el("div", { class: "form-grid" },
    el("label", {}, "Fecha", fecha),
    el("label", {}, "Valor del abono", valor),
    el("label", {}, "Medio de pago", medio),
    el("label", {}, "Nota", nota),
    el("div", { class: "full payment-allocation-head" },
      el("div", {}, el("strong", {}, "Aplicar a semanas"), el("div", { class: "muted small" }, "Se aplica primero a la semana pendiente más antigua. Puedes ajustar los valores.")),
      el("button", { class: "btn ghost small", onclick: distribuirAutomatico }, "Distribuir automáticamente"),
    ),
    distribucionWrap,
  );
  modal(`Registrar abono · ${d.estudiante}`, grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar abono", clase: "primary", onClick: async (dlg) => {
      const monto = Number(valor.value) || 0;
      const distribucion = Object.fromEntries(Object.entries(campos)
        .map(([semana, { input }]) => [semana, Number(input.value) || 0])
        .filter(([, v]) => v > 0));
      const asignado = Object.values(distribucion).reduce((s, v) => s + v, 0);
      if (monto <= 0 || monto > saldo) { toast(`El abono debe estar entre $1 y ${cop(saldo)}`, "error"); return; }
      if (asignado !== monto) { toast("La distribución por semanas debe sumar exactamente el valor del abono", "error"); return; }
      if (Object.entries(distribucion).some(([semana, v]) => v > campos[semana].pendiente)) {
        toast("Una semana tiene asignado más de lo que debe", "error"); return;
      }
      try {
        await crearPago(ctx.temporadaId, d.id, { fecha: fecha.value || hoyISO(), valor: monto, medio: medio.value.trim(), nota: nota.value.trim(), distribucion });
        const nuevoTotal = totalPagado(d) + monto;
        const nuevoEstado = nuevoTotal >= (Number(d.valor) || 0) ? "Pagado" : "Abono";
        await actualizar(ctx.temporadaId, "inscripciones", d.id, { estadoPago: nuevoEstado, medioPago: medio.value.trim() || d.medioPago || "" });
        dlg.close();
        toast("Abono registrado");
        onSave && onSave();
      } catch (e) { toast("Error: " + e.message, "error"); }
    } },
  ]);
}

function tarjeta(t, v, tono = "") {
  return el("div", { class: "stat " + tono }, el("div", { class: "stat-val" }, String(v)), el("div", { class: "stat-lbl" }, t));
}

function horasDesdeConcepto(concepto) {
  const m = String(concepto || "").match(/(\d+)\s*horas?/i);
  return m ? Number(m[1]) : 0;
}

export function calcularPrecio({ semanas, detalleSemanas, precios, descuentosLista, descuentoIds }) {
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
  const diasWrap = el("div", { class: "week-days-editor" });
  const diasTemporada = ctx._diasTemporada || [];
  function semanasMarcadas() {
    return [...semWrap.querySelectorAll("input:checked")].map((c) => c.value);
  }
  function diasGuardados(semana) {
    const guardados = d.diasPorSemana && Array.isArray(d.diasPorSemana[semana]) ? d.diasPorSemana[semana] : diasTemporada;
    return guardados.filter((dia) => diasTemporada.includes(dia));
  }
  function pintarDiasInscritos() {
    const seleccionadas = semanasMarcadas();
    diasWrap.innerHTML = "";
    if (!seleccionadas.length) {
      diasWrap.append(el("div", { class: "muted small" }, "Marca una semana para elegir los dias de asistencia."));
      return;
    }
    seleccionadas.forEach((semana) => {
      const seleccionInicial = new Set(diasGuardados(semana));
      const checks = diasTemporada.map((dia) => {
        const chk = el("input", { type: "checkbox", value: dia, "data-semana": semana });
        chk.checked = seleccionInicial.has(dia);
        return el("label", { class: "chk day-check" }, chk, dia);
      });
      const todos = el("button", { class: "btn ghost small", onclick: () => {
        const cajas = [...diasWrap.querySelectorAll(`input[data-semana="${semana}"]`)];
        const marcar = cajas.some((c) => !c.checked);
        cajas.forEach((c) => { c.checked = marcar; });
      } }, "Todos");
      diasWrap.append(el("div", { class: "week-day-row" },
        el("div", { class: "week-day-title" }, el("strong", {}, semana), todos),
        el("div", { class: "chips-input" }, checks),
      ));
    });
  }
  function diasPorSemanaSeleccionados() {
    const res = {};
    semanasMarcadas().forEach((semana) => {
      res[semana] = [...diasWrap.querySelectorAll(`input[data-semana="${semana}"]:checked`)].map((c) => c.value);
    });
    return res;
  }

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
    f.observaciones.value = c.observaciones || "";
    if (c.ruta) ruta.checked = true;
    const contactoDescuentos = new Set(Array.isArray(c.descuentoIds) ? c.descuentoIds : []);
    descuentosWrap.querySelectorAll("input").forEach((chk) => { chk.checked = contactoDescuentos.has(chk.value); });
    // Marcar las semanas de interés del contacto.
    semWrap.querySelectorAll("input").forEach((chk) => { chk.checked = (c.semanas || []).includes(chk.value); });
    pintarDiasInscritos();
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
    if (!res.length) {
      lista.append(el("div", { class: "combo-empty" }, "No se encontraron contactos"));
      lista.style.display = "";
      return;
    }
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
    el("label", {}, "Medio de pago", sel("medioPago", [
      "",
      ...new Set([...(ctx._mediosPago || []), d.medioPago].filter(Boolean)),
    ])),
    el("label", {}, "Acudiente", inp("acudiente")),
    el("label", {}, "Celular", inp("celular", { ph: "+57…" })),
    el("label", { class: "full" }, "Semanas inscritas", semWrap),
    el("label", { class: "full" }, "Dias que viene", diasWrap),
    el("label", { class: "chk full" }, ruta, " Necesita ruta"),
    el("label", { class: "full" }, "Dirección / barrio para ruta", inp("direccion", { ph: "Dirección, barrio o punto de recogida" })),
    descuentosDisponibles.length ? el("label", { class: "full" }, "Descuentos aplicados", descuentosWrap) : null,
    el("label", { class: "full" }, "Observaciones", inp("observaciones", { ph: "Notas del pago, acuerdos…" })),
  );
  f.estadoPago.disabled = Boolean(dato);
  if (dato) f.estadoPago.title = "Se calcula automáticamente según los abonos registrados";

  function descuentosSeleccionados() {
    return [...descuentosWrap.querySelectorAll("input:checked")].map((c) => c.value);
  }

  function semanasSeleccionadas() {
    return semanasMarcadas();
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

  function recalcularValor(actualizarCampos = true) {
    const calc = calcularPrecioActual();
    if (actualizarCampos && (calc.valorFinal || calc.valorBase)) f.valor.value = calc.valorFinal;
    if (actualizarCampos) f.paquete.value = calc.paquete && nombresPaquete.includes(calc.paquete) ? calc.paquete : f.paquete.value;
    resumenPrecio.textContent = calc.horas
      ? `Base ${cop(calc.valorBase)} · ${calc.dias} día(s), ${calc.horas} hora(s) · Descuentos ${cop(calc.totalDescuento)} · Final ${cop(calc.valorFinal)}`
      : "Marca semanas para calcular el valor.";
    return calc;
  }

  semWrap.querySelectorAll("input").forEach((chk) => chk.addEventListener("change", () => {
    pintarDiasInscritos();
    recalcularValor();
  }));
  descuentosWrap.querySelectorAll("input").forEach((chk) => chk.addEventListener("change", recalcularValor));
  pintarDiasInscritos();
  recalcularValor(!dato);

  f.edad.addEventListener("input", () => {
    const g = (GRUPOS.find((x) => x.id === grupoPorEdad(f.edad.value)) || {}).nombre;
    if (g) f.grupo.value = g;
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
        diasPorSemana: diasPorSemanaSeleccionados(),
      };
      if (!payload.estudiante) { toast("Falta el nombre del estudiante", "error"); return; }
      const destino = selTemporada.value || ctx.temporadaId;
      if (destino !== ctx.temporadaId && (d.pagos || []).length) {
        toast("No se puede mover una inscripción con pagos registrados. Elimina o traslada primero sus movimientos.", "error");
        return;
      }
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
