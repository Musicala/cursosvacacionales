// Módulo Contactos: interesados, antiguos (re-contacto), seguimiento.
import { el, esc, toast, modal, confirmar, fmtCorta } from "../ui.js?v=1";
import { listar, crear, actualizar, eliminar } from "../db.js?v=1";
import { ESTADOS_CONTACTO, CANALES, grupoPorEdad, GRUPOS, semanasDetalle } from "../catalogos.js?v=1";
import { estaConfigurada, onAuthBG, loginBG, usuarioBG, traerVacacionales } from "../base-general.js?v=1";
import { buscarDuplicado } from "../dedup.js?v=1";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "📇 Contactos"),
    el("div", { class: "right" },
      el("button", { class: "btn primary", onclick: () => editar(ctx, null, cargar) }, "+ Nuevo contacto"),
    ),
  ));

  // Aviso/estado de la sincronización con la base general.
  const bgAviso = el("div", { class: "panel bg-aviso", style: "display:none" });
  root.append(bgAviso);

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

  // ---- Sincronización con la base general (Listado = Vacacionales) ----
  async function sincronizarBG() {
    if (!estaConfigurada()) return; // todavía no han pegado la config del otro proyecto
    try {
      const remotos = await traerVacacionales();
      // Evitar duplicados: por sourceId, teléfono, correo o nombre (con/ sin tildes).
      const yaExisten = [...datos];   // se va actualizando para no duplicar dentro del mismo lote
      const nuevos = [];
      for (const r of remotos) {
        if (buscarDuplicado(r, yaExisten)) continue;
        nuevos.push(r);
        yaExisten.push(r);
      }
      for (const n of nuevos) await crear(ctx.temporadaId, "contactos", n);
      if (nuevos.length) { toast(`${nuevos.length} contacto(s) traídos de la base general`); await cargar(); }
      bgAviso.style.display = "block";
      bgAviso.innerHTML = "";
      bgAviso.append(el("div", { class: "muted small" },
        `✅ Base general conectada (${usuarioBG()?.email || ""}). ${remotos.length} con etiqueta Vacacionales · ${nuevos.length} nuevos.`));
    } catch (e) {
      bgAviso.style.display = "block";
      bgAviso.innerHTML = "";
      bgAviso.append(el("div", { class: "muted small" }, "No se pudo leer la base general: " + e.message));
    }
  }

  if (estaConfigurada()) {
    // Si ya hay sesión guardada del otro proyecto, sincroniza solo; si no, ofrece conectar.
    let primera = true;
    onAuthBG((u) => {
      if (u) { sincronizarBG(); }
      else if (primera) {
        bgAviso.style.display = "block";
        bgAviso.innerHTML = "";
        bgAviso.append(
          el("span", {}, "🔗 Conecta la base general para traer automáticamente los de etiqueta Vacacionales. "),
          el("button", { class: "btn small", onclick: async () => {
            try { await loginBG(); } catch (e) { toast("No se pudo conectar: " + e.message, "error"); }
          } }, "Conectar base general"),
        );
      }
      primera = false;
    });
  }
  function pintar() {
    const q = fQ.value.trim().toLowerCase();
    const est = fEstado.value;
    const filas = datos.filter((d) => {
      if (est && d.estado !== est) return false;
      if (q) {
        const blob = [d.estudiante, d.acudiente, d.celular, d.correo, d.direccion].join(" ").toLowerCase();
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
        ...["Estudiante", "Edad", "Acudiente", "Celular", "Estado", "Semana(s)", "Ruta", "Dirección", "Origen", ""].map((h) => el("th", {}, h)))),
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
        el("td", {}, d.ruta ? el("span", { class: "pill", title: "Requiere ruta" }, "🚌 Sí") : ""),
        el("td", {}, d.direccion || ""),
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
  // Las semanas salen de la configuración de la temporada (número y fechas).
  semanasDetalle(ctx.temporada).forEach((s) => {
    const chk = el("input", { type: "checkbox", value: s.nombre });
    if (semSel.includes(s.nombre)) chk.checked = true;
    const rango = s.desde ? ` (${fmtCorta(s.desde)}${s.hasta ? "–" + fmtCorta(s.hasta) : ""})` : "";
    semanas.append(el("label", { class: "chk" }, chk, s.nombre + rango));
  });

  // ¿Requiere ruta? (queda visible en el listado y suma en el módulo Ruta).
  const ruta = el("input", { type: "checkbox" });
  if (d.ruta) ruta.checked = true;

  const descuentosDisponibles = Array.isArray(ctx.temporada?.descuentosLista) ? ctx.temporada.descuentosLista : [];
  const descSel = Array.isArray(d.descuentoIds) ? d.descuentoIds : [];
  const descuentosWrap = el("div", { class: "chips-input" });
  descuentosDisponibles.forEach((desc) => {
    const id = desc.nombre || "";
    const chk = el("input", { type: "checkbox", value: id });
    if (descSel.includes(id)) chk.checked = true;
    const valor = desc.tipo === "valor" ? `$${Number(desc.valor || 0).toLocaleString("es-CO")}` : `${Number(desc.valor) || 0}%`;
    descuentosWrap.append(el("label", { class: "chk" }, chk, `${id} (${valor})`));
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
    el("label", { class: "chk full" }, ruta, " Requiere ruta"),
    campo("direccion", "Dirección / barrio para ruta", { full: true, ph: "Dirección, barrio o punto de recogida" }),
    descuentosDisponibles.length ? el("label", { class: "full" }, "Descuentos posibles", descuentosWrap) : null,
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
        ruta: ruta.checked,
        direccion: f.direccion.value.trim(),
        descuentoIds: [...descuentosWrap.querySelectorAll("input:checked")].map((c) => c.value),
        semanas: [...semanas.querySelectorAll("input:checked")].map((c) => c.value),
      };
      if (!payload.estudiante && !payload.acudiente) { toast("Pon al menos un nombre", "error"); return; }
      try {
        if (dato) {
          await actualizar(ctx.temporadaId, "contactos", dato.id, payload);
          dlg.close(); toast("Guardado"); onSave && onSave();
          return;
        }
        // Crear: revisar duplicados (nombre, correo o teléfono).
        const existentes = await listar(ctx.temporadaId, "contactos");
        const dup = buscarDuplicado(payload, existentes);
        if (dup) {
          confirmar(
            `⚠️ Parece que ya existe: "${dup.estudiante || dup.acudiente}"` +
            (dup.celular ? ` (cel ${dup.celular})` : "") + ". ¿Crear de todas formas?",
            async () => {
              await crear(ctx.temporadaId, "contactos", payload);
              dlg.close(); toast("Creado"); onSave && onSave();
            });
          return;
        }
        await crear(ctx.temporadaId, "contactos", payload);
        dlg.close(); toast("Guardado"); onSave && onSave();
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
