// Módulo Contactos: interesados, antiguos (re-contacto), seguimiento.
import { el, esc, toast, modal, confirmar } from "../ui.js";
import { listar, crear, actualizar, eliminar } from "../db.js";
import { ESTADOS_CONTACTO, CANALES, grupoPorEdad, GRUPOS } from "../catalogos.js";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "📇 Contactos"),
    el("div", { class: "right" },
      el("button", { class: "btn primary", onclick: () => editar(ctx, null) }, "+ Nuevo contacto"),
    ),
  ));

  const filtros = el("div", { class: "filters" });
  const fEstado = el("select", {});
  fEstado.append(el("option", { value: "" }, "Todos los estados"));
  ESTADOS_CONTACTO.forEach((s) => fEstado.append(el("option", { value: s }, s)));
  const fQ = el("input", { type: "text", placeholder: "Buscar nombre, acudiente, celular…" });
  filtros.append(
    el("label", {}, "Estado", fEstado),
    el("label", { class: "grow" }, "Búsqueda", fQ),
  );
  root.append(el("div", { class: "panel" }, filtros));

  const cont = el("div", { class: "panel" });
  root.append(cont);
  cont.append(el("div", { class: "muted" }, "Cargando…"));

  let datos = [];
  async function cargar() {
    datos = await listar(ctx.temporadaId, "contactos");
    pintar();
  }
  function pintar() {
    const q = fQ.value.trim().toLowerCase();
    const est = fEstado.value;
    const filas = datos.filter((d) => {
      if (est && d.estado !== est) return false;
      if (q) {
        const blob = [d.estudiante, d.acudiente, d.celular, d.correo].join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    cont.innerHTML = "";
    cont.append(el("div", { class: "muted small" }, `${filas.length} contacto(s)`));
    if (!filas.length) {
      cont.append(el("div", { class: "empty" }, "Sin contactos. Crea el primero con “+ Nuevo contacto”."));
      return;
    }
    const tabla = el("table", { class: "table" },
      el("thead", {}, el("tr", {},
        ...["Estudiante", "Edad", "Acudiente", "Celular", "Estado", "Semana(s)", "Origen", ""].map((h) => el("th", {}, h)))),
    );
    const tb = el("tbody", {});
    filas.forEach((d) => {
      tb.append(el("tr", {},
        el("td", {}, el("strong", {}, d.estudiante || "—")),
        el("td", {}, d.edad ?? ""),
        el("td", {}, d.acudiente || ""),
        el("td", {}, d.celular || ""),
        el("td", {}, el("span", { class: "pill estado-" + slug(d.estado) }, d.estado || "—")),
        el("td", {}, (d.semanas || []).join(", ")),
        el("td", {}, d.origen || ""),
        el("td", { class: "row-actions" },
          el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
          el("button", { class: "btn ghost small", onclick: () => eliminarC(ctx, d, cargar) }, "🗑"),
        ),
      ));
    });
    tabla.append(tb);
    cont.append(el("div", { class: "table-wrap" }, tabla));
  }
  fEstado.onchange = pintar;
  fQ.oninput = pintar;
  await cargar();
}

function slug(s) { return (s || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, ""); }

function editar(ctx, dato, onSave) {
  const d = dato || {};
  const f = {};
  const campo = (k, label, attrs = {}) => {
    const input = attrs.tag === "select"
      ? el("select", {}, ...(attrs.opciones || []).map((o) => {
          const op = el("option", { value: o }, o); if (d[k] === o) op.selected = true; return op;
        }))
      : el("input", { type: attrs.type || "text", value: d[k] ?? "", placeholder: attrs.ph || "" });
    if (attrs.tag !== "select" && d[k] != null) input.value = d[k];
    f[k] = input;
    return el("label", { class: attrs.full ? "full" : "" }, label, input);
  };

  const semanas = el("div", { class: "chips-input" });
  const semSel = (d.semanas || []);
  ["Semana 1", "Semana 2", "Semana 3", "Semana 4"].forEach((s) => {
    const chk = el("input", { type: "checkbox", value: s });
    if (semSel.includes(s)) chk.checked = true;
    semanas.append(el("label", { class: "chk" }, chk, s));
  });

  const grid = el("div", { class: "form-grid" },
    campo("estudiante", "Estudiante", { ph: "Nombre del niño/a" }),
    campo("edad", "Edad", { type: "number" }),
    campo("acudiente", "Acudiente", {}),
    campo("celular", "Celular", { ph: "+57…" }),
    campo("correo", "Correo", {}),
    campo("grupo", "Grupo", { tag: "select", opciones: ["", ...GRUPOS.map((g) => g.nombre)] }),
    campo("estado", "Estado", { tag: "select", opciones: ESTADOS_CONTACTO }),
    campo("origen", "Origen", { tag: "select", opciones: ["", "WhatsApp", "Instagram", "Facebook", "Referido", "Antiguo", "Otro"] }),
    el("label", { class: "full" }, "Semanas de interés", semanas),
    campo("comentario", "Comentario", { full: true, ph: "Qué pidió, disponibilidad, objeciones…" }),
  );

  // Autosugerir grupo por edad
  f.edad.addEventListener("change", () => {
    const g = grupoPorEdad(f.edad.value);
    const nombre = (GRUPOS.find((x) => x.id === g) || {}).nombre;
    if (nombre && !f.grupo.value) f.grupo.value = nombre;
  });

  modal(dato ? "Editar contacto" : "Nuevo contacto", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const payload = {
        estudiante: f.estudiante.value.trim(),
        edad: f.edad.value ? Number(f.edad.value) : null,
        acudiente: f.acudiente.value.trim(),
        celular: f.celular.value.trim(),
        correo: f.correo.value.trim(),
        grupo: f.grupo.value,
        estado: f.estado.value,
        origen: f.origen.value,
        comentario: f.comentario.value.trim(),
        semanas: [...semanas.querySelectorAll("input:checked")].map((c) => c.value),
      };
      if (!payload.estudiante && !payload.acudiente) { toast("Pon al menos un nombre", "error"); return; }
      try {
        if (dato) await actualizar(ctx.temporadaId, "contactos", dato.id, payload);
        else await crear(ctx.temporadaId, "contactos", payload);
        dlg.close();
        toast("Guardado");
        onSave && onSave();
      } catch (e) { toast("Error: " + e.message, "error"); }
    } },
  ]);
}

function eliminarC(ctx, dato, onSave) {
  confirmar(`¿Eliminar a ${dato.estudiante || "este contacto"}?`, async () => {
    await eliminar(ctx.temporadaId, "contactos", dato.id);
    toast("Eliminado");
    onSave && onSave();
  });
}
