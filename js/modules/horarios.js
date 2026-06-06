// Módulo Horarios y docentes: asignación de clases por semana/día con docente, taller y salón.
import { el, toast, modal, confirmar } from "../ui.js";
import { listar, crear, actualizar, eliminar, leerConfig, guardarConfig } from "../db.js";
import { GRUPOS, AREAS, DOCENTES, semanasDe, diasDe } from "../catalogos.js";

let DOCS = DOCENTES;

export default async function render(root, ctx) {
  const cfg = await leerConfig();
  if (cfg && Array.isArray(cfg.docentes) && cfg.docentes.length) DOCS = cfg.docentes;

  // Semanas y días configurados para esta temporada (ver "Info temporada").
  const SEMANAS = semanasDe(ctx.temporada);
  const DIAS = diasDe(ctx.temporada);

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "🗓️ Horarios y docentes"),
    el("div", { class: "right" },
      el("button", { class: "btn ghost", onclick: () => verDocentes() }, "Ver docentes"),
      el("button", { class: "btn primary", onclick: () => editar(ctx, null, cargar) }, "+ Asignar clase"),
    ),
  ));

  let vista = "horario"; // "horario" | "lista"

  const fSemana = el("select", {}, ...["", ...SEMANAS].map((s) => el("option", { value: s }, s || "Todas las semanas")));
  const btnHorario = el("button", { class: "btn small", onclick: () => setVista("horario") }, "🗓️ Horario");
  const btnLista = el("button", { class: "btn small", onclick: () => setVista("lista") }, "☰ Lista");
  function setVista(v) { vista = v; btnHorario.className = "btn small" + (v === "horario" ? " primary" : ""); btnLista.className = "btn small" + (v === "lista" ? " primary" : ""); pintar(); }
  root.append(el("div", { class: "panel" }, el("div", { class: "filters" },
    el("label", {}, "Semana", fSemana),
    el("div", { class: "btn-group" }, btnHorario, btnLista),
  )));

  const cont = el("div", { class: "panel" });
  root.append(cont);

  let datos = [];
  async function cargar() { datos = await listar(ctx.temporadaId, "grupos"); pintar(); }
  function pintar() {
    const sem = fSemana.value;
    const filas = datos.filter((d) => !sem || d.semana === sem);
    cont.innerHTML = "";
    if (!filas.length) { cont.append(el("div", { class: "empty" }, "Sin clases asignadas. Usa “+ Asignar clase”.")); return; }
    if (vista === "horario") pintarHorario(filas, sem);
    else pintarLista(filas);
  }

  function pintarLista(filas) {
    const tb = el("tbody", {});
    filas.sort((a, b) => (a.semana + a.dia).localeCompare(b.semana + b.dia));
    filas.forEach((d) => tb.append(el("tr", {},
      el("td", {}, d.semana), el("td", {}, d.dia), el("td", {}, d.grupo),
      el("td", {}, d.area), el("td", {}, d.taller || ""),
      el("td", {}, el("strong", {}, d.docente || "—")), el("td", {}, d.salon || ""),
      el("td", { class: "row-actions" },
        el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
        el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "🗑")),
    )));
    cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...["Semana", "Día", "Grupo", "Área", "Taller/Temática", "Docente", "Salón", ""].map((h) => el("th", {}, h)))), tb)));
  }

  // Vista tipo horario escolar: filas = grupos, columnas = días (Lun-Vie).
  function pintarHorario(filas, sem) {
    // Si no hay semana fija, una rejilla por cada semana con datos.
    const semanas = sem ? [sem] : SEMANAS.filter((s) => filas.some((d) => d.semana === s));
    semanas.forEach((s) => {
      const deSemana = filas.filter((d) => d.semana === s);
      cont.append(el("h4", { class: "horario-titulo" }, s));
      const grupos = GRUPOS.map((g) => g.nombre).filter((g) => deSemana.some((d) => d.grupo === g));
      const head = el("tr", {}, el("th", {}, "Grupo"), ...DIAS.map((dia) => el("th", {}, dia)));
      const body = el("tbody", {}, ...grupos.map((g) => el("tr", {},
        el("td", {}, el("strong", {}, g)),
        ...DIAS.map((dia) => {
          const celdas = deSemana.filter((d) => d.grupo === g && d.dia === dia);
          if (!celdas.length) return el("td", { class: "h-vacia" }, "");
          return el("td", { class: "h-celda" }, ...celdas.map((d) => el("div", {
            class: "h-clase", title: "Clic para editar", onclick: () => editar(ctx, d, cargar),
          },
            el("div", { class: "h-area" }, d.area || "—"),
            d.taller ? el("div", { class: "h-taller" }, d.taller) : null,
            el("div", { class: "h-doc" }, d.docente || "—"),
            d.salon ? el("div", { class: "h-salon" }, "📍 " + d.salon) : null,
          )));
        }),
      )));
      cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table horario" }, el("thead", {}, head), body)));
    });
  }

  fSemana.onchange = pintar;
  setVista("horario");
  await cargar();
}

function editar(ctx, dato, onSave) {
  const SEMANAS = semanasDe(ctx.temporada);
  const DIAS = diasDe(ctx.temporada);
  const d = dato || {};
  const f = {};
  const sel = (k, ops) => { const s = el("select", {}, ...ops.map((o) => { const op = el("option", { value: o }, o || "—"); if (d[k] === o) op.selected = true; return op; })); f[k] = s; return s; };
  const inp = (k, ph) => { const i = el("input", { type: "text", placeholder: ph || "" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };

  // Refresca el selector de docentes mostrando solo quienes dictan el área elegida.
  function refrescarDocentes() {
    const area = f.area.value;
    const prev = f.docente.value;
    const aptos = DOCS.filter((x) => !area || (x.areas || []).includes(area));
    f.docente.innerHTML = "";
    ["", ...aptos.map((x) => x.nombre)].forEach((o) => {
      const op = el("option", { value: o }, o || "—");
      if (o === prev) op.selected = true;
      f.docente.append(op);
    });
  }

  const grid = el("div", { class: "form-grid" },
    el("label", {}, "Semana", sel("semana", SEMANAS)),
    el("label", {}, "Día", sel("dia", DIAS)),
    el("label", {}, "Grupo", sel("grupo", GRUPOS.map((g) => g.nombre))),
    el("label", {}, "Área", sel("area", AREAS)),
    el("label", {}, "Docente", sel("docente", ["", ...DOCS.map((x) => x.nombre)])),
    el("label", {}, "Salón", inp("salon", "Ej: Salón 2")),
    el("label", { class: "full" }, "Taller / Temática", inp("taller", "Ej: Navidad, Películas, Disney…")),
  );
  f.area.addEventListener("change", refrescarDocentes);
  refrescarDocentes();
  modal(dato ? "Editar clase" : "Asignar clase", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const payload = { semana: f.semana.value, dia: f.dia.value, grupo: f.grupo.value, area: f.area.value, docente: f.docente.value, salon: f.salon.value.trim(), taller: f.taller.value.trim() };
      try {
        if (dato) await actualizar(ctx.temporadaId, "grupos", dato.id, payload);
        else await crear(ctx.temporadaId, "grupos", payload);
        dlg.close(); toast("Guardado"); onSave && onSave();
      } catch (e) { toast("Error: " + e.message, "error"); }
    } },
  ]);
}

async function persistirDocentes() {
  try {
    await guardarConfig({ docentes: DOCS });
    toast("Docentes guardados");
  } catch (e) {
    toast("Error al guardar: " + e.message, "error");
  }
}

function verDocentes() {
  const body = el("div", {});

  const tabla = (lista) => {
    if (!lista.length) return el("div", { class: "muted" }, "—");
    const tb = el("tbody", {}, ...lista.map((x) => {
      const idx = DOCS.indexOf(x);
      return el("tr", {},
        el("td", {}, x.nombre),
        el("td", {}, (x.areas || []).join(", ")),
        el("td", { class: "row-actions" },
          el("button", { class: "btn ghost small", onclick: () => editarDocente(idx, repintar) }, "Editar"),
          el("button", { class: "btn ghost small", onclick: () => borrarDocente(idx, repintar) }, "🗑")));
    }));
    return el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Docente"), el("th", {}, "Áreas"), el("th", {}, ""))), tb));
  };

  function repintar() {
    const titulares = DOCS.filter((d) => !d.reemplazo);
    const reemplazos = DOCS.filter((d) => d.reemplazo);
    body.innerHTML = "";
    body.append(
      el("div", { class: "right", style: "margin-bottom:.5rem" },
        el("button", { class: "btn primary small", onclick: () => editarDocente(null, repintar) }, "+ Agregar docente")),
      el("h4", {}, "Docentes"), tabla(titulares),
      el("h4", {}, "Reemplazos (emergencias)"), tabla(reemplazos));
  }

  repintar();
  modal("Docentes", body, [{ texto: "Cerrar", clase: "primary" }]);
}

// idx = índice en DOCS, o null para crear uno nuevo.
function editarDocente(idx, onSave) {
  const d = idx == null ? { nombre: "", areas: [], reemplazo: false } : DOCS[idx];
  const nombre = el("input", { type: "text", placeholder: "Nombre del docente", value: d.nombre || "" });

  const checks = AREAS.map((a) => {
    const c = el("input", { type: "checkbox", value: a });
    if ((d.areas || []).includes(a)) c.checked = true;
    return el("label", { class: "check" }, c, " " + a);
  });

  const reemplazo = el("input", { type: "checkbox" });
  if (d.reemplazo) reemplazo.checked = true;

  const grid = el("div", { class: "form-grid" },
    el("label", { class: "full" }, "Nombre", nombre),
    el("label", { class: "full" }, "Áreas", el("div", { class: "checks" }, ...checks)),
    el("label", { class: "full check" }, reemplazo, " Es reemplazo (emergencias)"));

  modal(idx == null ? "Agregar docente" : "Editar docente", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const nom = nombre.value.trim();
      if (!nom) { toast("Escribe el nombre", "error"); return; }
      const areas = checks.map((l) => l.querySelector("input")).filter((c) => c.checked).map((c) => c.value);
      const nuevo = { nombre: nom, areas, reemplazo: reemplazo.checked };
      DOCS = idx == null ? [...DOCS, nuevo] : DOCS.map((x, i) => (i === idx ? nuevo : x));
      await persistirDocentes();
      dlg.close();
      onSave && onSave();
    } },
  ]);
}

function borrarDocente(idx, onSave) {
  const nom = DOCS[idx]?.nombre || "este docente";
  confirmar(`¿Eliminar a ${nom}?`, async () => {
    DOCS = DOCS.filter((_, i) => i !== idx);
    await persistirDocentes();
    onSave && onSave();
  });
}

function del(ctx, dato, onSave) {
  confirmar("¿Eliminar esta clase?", async () => { await eliminar(ctx.temporadaId, "grupos", dato.id); toast("Eliminado"); onSave && onSave(); });
}
