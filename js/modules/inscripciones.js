// Módulo Inscripciones: estudiantes formalizados con paquete, semana, valor y pago.
import { el, cop, toast, modal, confirmar, fmtFecha, hoyISO } from "../ui.js";
import { listar, crear, actualizar, eliminar, obtenerTemporada, listarTemporadas } from "../db.js";
import { PAQUETES, ESTADOS_PAGO, GRUPOS, grupoPorEdad, semanasDe } from "../catalogos.js";

export default async function render(root, ctx) {
  // Precios de la temporada (para autocompletar el valor según el paquete).
  const temp = (await obtenerTemporada(ctx.temporadaId)) || {};
  ctx._precios = temp.precios || [];
  // Semanas configuradas para esta temporada (ver "Info temporada").
  ctx._semanas = semanasDe(temp);
  // Lista de temporadas (para poder asignar/mover cada inscrito).
  ctx._temporadas = await listarTemporadas();

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
        ...["Inscrito el", "Estudiante", "Edad", "Grupo", "Paquete", "Semana(s)", "Horario", "Valor", "Pago", "Ruta", ""].map((h) => el("th", {}, h)))));
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
        el("td", {}, el("span", { class: "pill pago-" + (d.estadoPago || "").toLowerCase() }, d.estadoPago || "—")),
        el("td", {}, d.ruta ? "🚌" : ""),
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

function editar(ctx, dato, onSave) {
  const d = dato || {};
  const f = {};
  const inp = (k, attrs = {}) => { const i = el("input", { type: attrs.type || "text", placeholder: attrs.ph || "" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };
  const sel = (k, ops) => { const s = el("select", {}, ...ops.map((o) => { const op = el("option", { value: o }, o || "—"); if (d[k] === o) op.selected = true; return op; })); f[k] = s; return s; };

  const semWrap = el("div", { class: "chips-input" });
  (ctx._semanas || []).forEach((s) => { const c = el("input", { type: "checkbox", value: s }); if ((d.semanas || []).includes(s)) c.checked = true; semWrap.append(el("label", { class: "chk" }, c, s)); });

  const ruta = el("input", { type: "checkbox" }); if (d.ruta) ruta.checked = true;

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

  const grid = el("div", { class: "form-grid" },
    el("label", { class: "full" }, "Temporada", selTemporada),
    el("label", {}, "Fecha de inscripción", fecha),
    el("label", {}, "Estudiante", inp("estudiante", { ph: "Nombre" })),
    el("label", {}, "Edad", inp("edad", { type: "number" })),
    el("label", {}, "Grupo", sel("grupo", ["", ...GRUPOS.map((g) => g.nombre)])),
    el("label", {}, "Paquete", sel("paquete", ["", ...nombresPaquete])),
    el("label", {}, "Horario", inp("horario", { ph: "9:00 a.m. a 1:00 p.m." })),
    el("label", {}, "Valor", inp("valor", { type: "number", ph: "0" })),
    el("label", {}, "Estado de pago", sel("estadoPago", ESTADOS_PAGO)),
    el("label", {}, "Medio de pago", inp("medioPago", { ph: "Nequi / Transferencia…" })),
    el("label", {}, "Acudiente", inp("acudiente")),
    el("label", {}, "Celular", inp("celular", { ph: "+57…" })),
    el("label", { class: "full" }, "Semanas inscritas", semWrap),
    el("label", { class: "chk full" }, ruta, " Necesita ruta"),
    el("label", { class: "full" }, "Observaciones", inp("observaciones", { ph: "Notas del pago, acuerdos…" })),
  );
  f.edad.addEventListener("change", () => {
    const g = (GRUPOS.find((x) => x.id === grupoPorEdad(f.edad.value)) || {}).nombre;
    if (g && !f.grupo.value) f.grupo.value = g;
  });
  // Autocompletar el valor según el paquete elegido (precio de la temporada).
  f.paquete.addEventListener("change", () => {
    const p = precios.find((x) => x.concepto === f.paquete.value);
    if (p && p.valor) f.valor.value = p.valor;
  });

  modal(dato ? "Editar inscripción" : "Inscribir estudiante", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const payload = {
        fechaInscripcion: fecha.value || hoyISO(),
        estudiante: f.estudiante.value.trim(), edad: f.edad.value ? Number(f.edad.value) : null,
        grupo: f.grupo.value, paquete: f.paquete.value, horario: f.horario.value.trim(),
        valor: f.valor.value ? Number(f.valor.value) : 0, estadoPago: f.estadoPago.value,
        medioPago: f.medioPago.value.trim(), acudiente: f.acudiente.value.trim(), celular: f.celular.value.trim(),
        ruta: ruta.checked, observaciones: f.observaciones.value.trim(),
        semanas: [...semWrap.querySelectorAll("input:checked")].map((c) => c.value),
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
