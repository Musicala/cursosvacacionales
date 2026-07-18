// Módulo Horarios y docentes: asignación de clases por semana/día con docente, taller y salón.
import { el, toast, modal, confirmar } from "../ui.js?v=3";
import { listar, crear, actualizar, eliminar, leerConfig, guardarConfig } from "../db.js?v=3";
import { GRUPOS, AREAS, DOCENTES, nombreGrupo, semanasDe, diasDe, formatoRangoSemana, semanaActualInfo } from "../catalogos.js?v=5";

let DOCS = DOCENTES;

export default async function render(root, ctx) {
  const cfg = await leerConfig();
  if (cfg && Array.isArray(cfg.docentes) && cfg.docentes.length) DOCS = cfg.docentes;
  if (ctx.rol !== "docente") await asegurarCorreosDocentes();

  // El docente solo ve (no edita) y únicamente su propio horario.
  const soloLectura = ctx.rol === "docente";
  const docenteNombre = ctx.docente?.nombre || "";

  // Semanas y días configurados para esta temporada (ver "Info temporada").
  const SEMANAS = semanasDe(ctx.temporada);
  const DIAS = diasDe(ctx.temporada);
  const semanaInfo = semanaActualInfo(ctx.temporada);

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, soloLectura ? "🗓️ Mi horario" : "🗓️ Horarios y docentes"),
    el("div", { class: "right" },
      soloLectura ? null : el("button", { class: "btn ghost", onclick: () => verDocentes() }, "Ver docentes"),
      soloLectura ? null : el("button", { class: "btn ghost", onclick: () => duplicarSemana() }, "⧉ Duplicar semana"),
      soloLectura ? null : el("button", { class: "btn primary", onclick: () => editar(ctx, null, cargar) }, "+ Asignar clase"),
    ),
  ));

  let vista = "horario"; // "horario" | "lista" | "acudientes"

  const fSemana = el("select", {}, ...["", ...SEMANAS].map((s) => el("option", { value: s }, s || "Todas las semanas")));
  if (soloLectura && semanaInfo.estado === "actual" && semanaInfo.semana?.nombre) fSemana.value = semanaInfo.semana.nombre;
  const btnHorario = el("button", { class: "btn small", onclick: () => setVista("horario") }, "🗓️ Horario");
  const btnLista = el("button", { class: "btn small", onclick: () => setVista("lista") }, "☰ Lista");
  const btnAcudientes = el("button", { class: "btn small", onclick: () => setVista("acudientes") }, "Para acudientes");
  function setVista(v) {
    vista = v;
    btnHorario.className = "btn small" + (v === "horario" ? " primary" : "");
    btnLista.className = "btn small" + (v === "lista" ? " primary" : "");
    btnAcudientes.className = "btn small" + (v === "acudientes" ? " primary" : "");
    pintar();
  }
  root.append(el("div", { class: "panel" }, el("div", { class: "filters" },
    el("label", {}, "Semana", fSemana),
    el("div", { class: "btn-group" }, btnHorario, btnLista, btnAcudientes),
  )));
  root.append(tarjetaSemanaVacacional(semanaInfo, soloLectura));

  const cont = el("div", { class: "panel" });
  root.append(cont);

  let datos = [];
  async function cargar() {
    datos = (await listar(ctx.temporadaId, "grupos")).map((d) => ({ ...d, grupo: nombreGrupo(d.grupo) }));
    if (!soloLectura) await sincronizarCorreosDocentes(ctx, datos);
    if (soloLectura) datos = datos.filter((d) => (d.docente || "") === docenteNombre);
    pintar();
  }
  function pintar() {
    const sem = fSemana.value;
    const filas = datos.filter((d) => !sem || d.semana === sem);
    cont.innerHTML = "";
    if (!filas.length) { cont.append(el("div", { class: "empty" }, soloLectura ? "No tienes clases asignadas en esta temporada." : "Sin clases asignadas. Usa “+ Asignar clase”.")); return; }
    if (vista === "horario") pintarHorario(filas, sem);
    else if (vista === "acudientes") pintarVistaAcudientes(filas);
    else pintarListaPlaneacionLimpia(filas);
  }

  function pintarLista(filas) {
    const tb = el("tbody", {});
    filas.sort((a, b) => (a.semana + a.dia).localeCompare(b.semana + b.dia));
    filas.forEach((d) => tb.append(el("tr", {},
      el("td", {}, d.semana), el("td", {}, d.dia), el("td", {}, rangoHoras(d) || "—"), el("td", {}, d.grupo),
      el("td", {}, d.area), el("td", {}, d.taller || ""),
      el("td", {}, el("strong", {}, d.docente || "—")), el("td", {}, d.salon || ""),
      soloLectura ? null : el("td", { class: "row-actions" },
        el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
        el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "🗑")),
    )));
    const cols = ["Semana", "Día", "Hora", "Grupo", "Área", "Taller/Temática", "Docente", "Salón"];
    if (!soloLectura) cols.push("");
    cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...cols.map((h) => el("th", {}, h)))), tb)));
  }

  function pintarListaPlaneacion(filas) {
    const tb = el("tbody", {});
    filas.sort((a, b) => (a.semana + a.dia + (a.horaInicio || "")).localeCompare(b.semana + b.dia + (b.horaInicio || "")));
    filas.forEach((d) => tb.append(el("tr", {},
      el("td", {}, d.semana),
      el("td", {}, d.dia),
      el("td", {}, rangoHoras(d) || "â€”"),
      el("td", {}, d.grupo),
      el("td", {}, d.area),
      el("td", {}, d.taller || ""),
      el("td", {}, el("strong", {}, d.docente || "â€”")),
      el("td", {}, d.salon || ""),
      el("td", {}, estadoPlaneacion(d)),
      el("td", { class: "row-actions" },
        el("button", { class: "btn ghost small", onclick: () => editarPlaneacion(ctx, d, cargar) }, "Planeacion"),
        soloLectura ? null : [
          el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
          el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "ðŸ—‘"),
        ],
      ),
    )));
    const cols = ["Semana", "Dia", "Hora", "Grupo", "Area", "Taller/Tematica", "Docente", "Salon", "Planeacion", ""];
    cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...cols.map((h) => el("th", {}, h)))), tb)));
  }

  function pintarListaPlaneacionLimpia(filas) {
    const tb = el("tbody", {});
    filas.sort((a, b) => (a.semana + a.dia + (a.horaInicio || "")).localeCompare(b.semana + b.dia + (b.horaInicio || "")));
    filas.forEach((d) => tb.append(el("tr", {},
      el("td", {}, d.semana),
      el("td", {}, d.dia),
      el("td", {}, rangoHoras(d) || "-"),
      el("td", {}, d.grupo),
      el("td", {}, d.area),
      el("td", {}, d.taller || ""),
      el("td", {}, el("strong", {}, d.docente || "-")),
      el("td", {}, d.salon || ""),
      el("td", {}, estadoPlaneacion(d)),
      el("td", { class: "row-actions" },
        el("button", { class: "btn ghost small", onclick: () => editarPlaneacion(ctx, d, cargar) }, "Planeación"),
        soloLectura ? null : [
          el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
          el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "Eliminar"),
        ],
      ),
    )));
    const cols = ["Semana", "Día", "Hora", "Grupo", "Área", "Taller/Temática", "Docente", "Salón", "Planeación", ""];
    cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...cols.map((h) => el("th", {}, h)))), tb)));
  }

  function pintarVistaAcudientes(filas) {
    const ordenadas = [...filas].sort((a, b) => (
      (a.semana + a.dia + (a.horaInicio || "") + a.grupo).localeCompare(b.semana + b.dia + (b.horaInicio || "") + b.grupo)
    ));
    const tituloSemana = fSemana.value || "Todas las semanas";
    const resumen = textoAcudientes(ordenadas, tituloSemana);
    cont.append(el("div", { class: "guardian-toolbar" },
      el("div", {},
        el("h3", {}, "Planeación para compartir"),
        el("p", { class: "muted small" }, "Descarga el paquete para IA: pégalo en tu IA favorita y te redacta el informe para acudientes.")),
      el("div", { class: "row-actions guardian-actions" },
        el("button", { class: "btn ghost small", onclick: () => copiarPlaneacion(resumen) }, "Copiar texto"),
        el("button", { class: "btn primary small", onclick: () => descargarParaIA(ordenadas, tituloSemana) }, "🤖 Descargar para IA"))));

    Object.entries(agruparPor(ordenadas, (d) => d.dia || "Sin día")).forEach(([dia, clases]) => {
      cont.append(el("section", { class: "guardian-day" },
        el("div", { class: "guardian-day-head" },
          el("h4", {}, dia),
          el("span", { class: "pill" }, `${clases.length} clase${clases.length === 1 ? "" : "s"}`)),
        el("div", { class: "guardian-grid" }, ...clases.map(tarjetaAcudiente))));
    });
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
          const celdas = deSemana.filter((d) => d.grupo === g && d.dia === dia)
            .sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));
          if (!celdas.length) return el("td", { class: "h-vacia" }, "");
          return el("td", { class: "h-celda" }, ...celdas.map((d) => el("div", {
            class: "h-clase", title: soloLectura ? "Clic para agregar planeación" : "Clic para editar",
            onclick: soloLectura ? () => editarPlaneacion(ctx, d, cargar) : () => editar(ctx, d, cargar),
          },
            rangoHoras(d) ? el("div", { class: "h-hora" }, "🕘 " + rangoHoras(d)) : null,
            el("div", { class: "h-area" }, d.area || "—"),
            d.taller ? el("div", { class: "h-taller" }, d.taller) : null,
            el("div", { class: "h-doc" }, d.docente || "—"),
            d.salon ? el("div", { class: "h-salon" }, "📍 " + d.salon) : null,
            estadoPlaneacion(d, true),
          )));
        }),
      )));
      cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table horario" }, el("thead", {}, head), body)));
    });
  }

  // Copia todas las clases de una semana hacia otra(s) semana(s).
  function duplicarSemana() {
    if (!SEMANAS.length) { toast("Configura las semanas en “Info temporada”.", "error"); return; }
    const origen = el("select", {}, ...SEMANAS.map((s) => {
      const o = el("option", { value: s }, s); if (s === fSemana.value) o.selected = true; return o;
    }));
    const destinos = el("div", { class: "checks" });
    function pintarDestinos() {
      destinos.innerHTML = "";
      SEMANAS.filter((s) => s !== origen.value).forEach((s) => {
        const c = el("input", { type: "checkbox", value: s });
        destinos.append(el("label", { class: "check" }, c, " " + s));
      });
    }
    pintarDestinos();
    origen.onchange = pintarDestinos;

    const body = el("div", {},
      el("label", { class: "block-label" }, "Copiar clases de", origen),
      el("h4", {}, "Pegar en estas semanas"),
      el("p", { class: "muted small" }, "Se agregarán copias de todas las clases de la semana de origen."),
      destinos,
    );
    modal("Duplicar semana", body, [
      { texto: "Cancelar", clase: "ghost" },
      { texto: "Duplicar", clase: "primary", onClick: async (dlg) => {
        const sem = origen.value;
        const objetivos = [...destinos.querySelectorAll("input:checked")].map((c) => c.value);
        if (!objetivos.length) { toast("Elige al menos una semana destino", "error"); return; }
        const clases = datos.filter((d) => d.semana === sem);
        if (!clases.length) { toast("Esa semana no tiene clases para copiar", "error"); return; }
        try {
          let total = 0;
          for (const destino of objetivos) {
            for (const c of clases) {
              const { id, creado, actualizado, ...resto } = c;
              await crear(ctx.temporadaId, "grupos", { ...resto, semana: destino, docenteCorreo: resto.docenteCorreo || correoDocente(resto.docente) });
              total++;
            }
          }
          dlg.close();
          toast(`${total} clase(s) copiadas a ${objetivos.length} semana(s)`);
          cargar();
        } catch (e) { toast("Error: " + e.message, "error"); }
      } },
    ]);
  }

  fSemana.onchange = pintar;
  setVista("horario");
  await cargar();
}

// "09:00"–"10:00" -> "9:00–10:00". Devuelve "" si no hay horas.
function rangoHoras(d) {
  const a = d.horaInicio || "", b = d.horaFin || "";
  if (!a && !b) return "";
  return [a, b].filter(Boolean).join("–");
}

function agruparPor(lista, fn) {
  return lista.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

function valorPlano(v, fallback = "Por definir") {
  return (v || "").trim() || fallback;
}

function tarjetaAcudiente(d) {
  return el("article", { class: "guardian-card" },
    el("div", { class: "guardian-card-head" },
      el("div", {},
        el("strong", {}, d.taller || d.area || "Clase"),
        el("div", { class: "muted small" }, [d.grupo, rangoHoras(d)].filter(Boolean).join(" · "))),
      estadoPlaneacion(d)),
    el("dl", { class: "guardian-details" },
      el("div", {}, el("dt", {}, "Objetivo"), el("dd", {}, valorPlano(d.planeacion))),
      el("div", {}, el("dt", {}, "Actividades"), el("dd", {}, valorPlano(d.actividades))),
      el("div", {}, el("dt", {}, "Recursos"), el("dd", {}, valorPlano(d.recursos))),
      d.docente ? el("div", {}, el("dt", {}, "Docente"), el("dd", {}, d.docente)) : null,
      d.salon ? el("div", {}, el("dt", {}, "Salón"), el("dd", {}, d.salon)) : null));
}

function textoAcudientes(filas, tituloSemana) {
  const partes = [`Planeación Musicala - ${tituloSemana}`];
  Object.entries(agruparPor(filas, (d) => d.dia || "Sin día")).forEach(([dia, clases]) => {
    partes.push("", dia);
    clases.forEach((d) => {
      partes.push(`- ${[rangoHoras(d), d.grupo, d.taller || d.area].filter(Boolean).join(" | ")}`);
      if ((d.planeacion || "").trim()) partes.push(`  Objetivo: ${d.planeacion.trim()}`);
      if ((d.actividades || "").trim()) partes.push(`  Actividades: ${d.actividades.trim()}`);
      if ((d.recursos || "").trim()) partes.push(`  Recursos: ${d.recursos.trim()}`);
    });
  });
  return partes.join("\n");
}

async function copiarPlaneacion(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast("Planeación copiada para compartir");
  } catch (e) {
    toast("No se pudo copiar automáticamente", "error");
  }
}

// Descarga un .txt con instrucciones + datos de planeación para pegar en una IA
// (ChatGPT, Claude, Gemini...) y obtener el informe redactado para acudientes.
function descargarParaIA(filas, tituloSemana) {
  const datos = [];
  Object.entries(agruparPor(filas, (d) => d.dia || "Sin día")).forEach(([dia, clases]) => {
    datos.push("", `## ${dia}`);
    clases.forEach((d) => {
      datos.push(`### ${d.taller || d.area || "Clase"}`);
      datos.push(`- Grupo: ${d.grupo || "—"}`);
      if (rangoHoras(d)) datos.push(`- Horario: ${rangoHoras(d)}`);
      if (d.docente) datos.push(`- Docente: ${d.docente}`);
      if (d.salon) datos.push(`- Salón: ${d.salon}`);
      datos.push(`- Objetivo / planeación: ${valorPlano(d.planeacion, "(sin registrar)")}`);
      datos.push(`- Actividades: ${valorPlano(d.actividades, "(sin registrar)")}`);
      datos.push(`- Recursos: ${valorPlano(d.recursos, "(sin registrar)")}`);
    });
  });

  const prompt = [
    "Eres el asistente de comunicaciones de Musicala, una academia de música y artes.",
    "Con la información de planeación de clases que aparece abajo, redacta un informe cálido y claro dirigido a los acudientes (padres y madres) de los cursos vacacionales.",
    "",
    "Indicaciones:",
    "- Escribe en español, con tono cercano, profesional y entusiasta.",
    "- Organiza el informe por día y por clase, con títulos claros.",
    "- Redacta en prosa fluida: convierte los objetivos y actividades en párrafos que expliquen qué aprenderán y vivirán los niños, sin copiar el texto tal cual.",
    "- Si un dato dice \"(sin registrar)\" o \"Por definir\", omítelo con elegancia; no digas que falta información.",
    "- No inventes contenidos, fechas ni actividades que no estén en los datos.",
    "- Cierra con un párrafo breve de agradecimiento por la confianza en Musicala.",
    "",
    "Entrega:",
    "1. El texto completo del informe aquí en el chat, listo para copiar.",
    "2. Además, genera el mismo informe como archivo PDF descargable, con diseño limpio y profesional (títulos destacados, buena tipografía y espaciado). Si tu plataforma no permite crear archivos PDF, indícalo y entrega el informe en un formato descargable equivalente.",
    "",
    `# Datos de planeación — ${tituloSemana}`,
    ...datos,
  ].join("\n");

  const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `Planeacion para IA - ${tituloSemana}.txt` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Archivo descargado: pégalo en tu IA para generar el informe");
}

function tarjetaSemanaVacacional(info, soloLectura) {
  if (info.estado === "sin-fechas") {
    return el("div", { class: "panel week-status warn" },
      el("div", { class: "week-status-icon" }, "📅"),
      el("div", {},
        el("div", { class: "stat-val" }, "Semana del Vacacional"),
        el("div", { class: "stat-lbl" }, "Aún no hay fechas configuradas para las semanas.")));
  }
  const rango = formatoRangoSemana(info.semana);
  const texto = info.estado === "actual"
    ? (soloLectura ? "Esta es la semana que debes revisar hoy" : "Estamos en esta semana")
    : info.estado === "proxima"
      ? "La temporada aún no llega a esta semana"
      : "La temporada ya terminó";
  return el("div", { class: "panel week-status " + (info.estado === "actual" ? "ok" : "warn") },
    el("div", { class: "week-status-icon" }, "📅"),
    el("div", {},
      el("div", { class: "stat-val" }, info.semana.nombre),
      el("div", { class: "stat-lbl" }, `${texto}${rango ? " · " + rango : ""}`)));
}

function correoDocente(nombre) {
  return (DOCS.find((x) => x.nombre === nombre)?.correo || "").trim().toLowerCase();
}

async function sincronizarCorreosDocentes(ctx, clases) {
  const pendientes = clases.filter((c) => {
    const correo = correoDocente(c.docente);
    return c.id && correo && c.docenteCorreo !== correo;
  });
  for (const clase of pendientes) {
    const correo = correoDocente(clase.docente);
    await actualizar(ctx.temporadaId, "grupos", clase.id, { docenteCorreo: correo });
    clase.docenteCorreo = correo;
  }
}

function estadoPlaneacion(d, compacto = false) {
  const tiene = Boolean((d.planeacion || "").trim() || (d.actividades || "").trim());
  if (compacto) return el("div", { class: "h-plan " + (tiene ? "ok" : "") }, tiene ? "Planeada" : "Sin planeación");
  return el("span", { class: "pill " + (tiene ? "plan-ok" : "plan-pending") }, tiene ? "Planeada" : "Pendiente");
}

function editarPlaneacion(ctx, dato, onSave) {
  const d = dato || {};
  const planeacion = el("textarea", { rows: "5", placeholder: "Objetivo, enfoque o planeación de la clase" });
  planeacion.value = d.planeacion || "";
  const actividades = el("textarea", { rows: "5", placeholder: "Actividades paso a paso que se realizaran" });
  actividades.value = d.actividades || "";
  const recursos = el("textarea", { rows: "3", placeholder: "Materiales, canciones, instrumentos o recursos" });
  recursos.value = d.recursos || "";
  const observacionesPlaneacion = el("textarea", { rows: "3", placeholder: "Notas para coordinación o seguimiento" });
  observacionesPlaneacion.value = d.observacionesPlaneacion || "";
  const encabezado = [d.semana, d.dia, rangoHoras(d), d.grupo, d.area].filter(Boolean).join(" · ");

  const grid = el("div", { class: "form-grid planning-form" },
    el("div", { class: "full planning-class-summary" },
      el("strong", {}, d.taller || d.area || "Clase"),
      el("span", { class: "muted small" }, encabezado),
      el("span", { class: "muted small" }, d.docente || "")),
    el("label", { class: "full" }, "Planeación", planeacion),
    el("label", { class: "full" }, "Actividades de clase", actividades),
    el("label", { class: "full" }, "Recursos / materiales", recursos),
    el("label", { class: "full" }, "Observaciones", observacionesPlaneacion),
  );

  modal("Planeación de clase", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const payload = {
        planeacion: planeacion.value.trim(),
        actividades: actividades.value.trim(),
        recursos: recursos.value.trim(),
        observacionesPlaneacion: observacionesPlaneacion.value.trim(),
        // El docente siempre guarda con su propio correo: si la clase quedó
        // con un correo viejo o vacío, así la "reclama" y las reglas lo aceptan.
        docenteCorreo: ctx.rol === "docente"
          ? (ctx.usuario?.email || "").trim().toLowerCase()
          : (d.docenteCorreo || correoDocente(d.docente)),
      };
      try {
        await actualizar(ctx.temporadaId, "grupos", d.id, payload);
        dlg.close();
        toast("Planeación guardada");
        onSave && onSave();
      } catch (e) {
        // Si Firestore niega el permiso, mostramos los correos en conflicto
        // para que coordinación pueda corregirlos sin adivinar.
        const esPermiso = (e.code || "").includes("permission") || /permis/i.test(e.message || "");
        if (esPermiso) {
          const sesion = (ctx.usuario?.email || "").toLowerCase();
          toast(
            `Sin permisos: la clase está asignada al correo "${d.docenteCorreo || "(sin correo)"}" ` +
            `y tu sesión es "${sesion}". Coordinación debe corregir el correo en Docentes u Horarios.`,
            "error"
          );
        } else {
          toast("Error: " + e.message, "error");
        }
      }
    } },
  ]);
}

function editar(ctx, dato, onSave) {
  const SEMANAS = semanasDe(ctx.temporada);
  const DIAS = diasDe(ctx.temporada);
  const d = dato || {};
  const f = {};
  const sel = (k, ops) => { const s = el("select", {}, ...ops.map((o) => { const op = el("option", { value: o }, o || "—"); if (d[k] === o) op.selected = true; return op; })); f[k] = s; return s; };
  const inp = (k, ph) => { const i = el("input", { type: "text", placeholder: ph || "" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };
  const hora = (k) => { const i = el("input", { type: "time" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };

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
    el("label", {}, "Área", sel("area", [...AREAS, "Onces"])),
    el("label", {}, "Docente", sel("docente", ["", ...DOCS.map((x) => x.nombre)])),
    el("label", {}, "Hora inicio", hora("horaInicio")),
    el("label", {}, "Hora fin", hora("horaFin")),
    el("label", {}, "Salón", inp("salon", "Ej: Salón 2")),
    el("label", { class: "full" }, "Taller / Temática", inp("taller", "Ej: Navidad, Películas, Disney…")),
  );
  f.area.addEventListener("change", refrescarDocentes);
  refrescarDocentes();
  modal(dato ? "Editar clase" : "Asignar clase", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const payload = { semana: f.semana.value, dia: f.dia.value, grupo: f.grupo.value, area: f.area.value, docente: f.docente.value, docenteCorreo: correoDocente(f.docente.value), salon: f.salon.value.trim(), taller: f.taller.value.trim(), horaInicio: f.horaInicio.value, horaFin: f.horaFin.value };
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
    // Lista plana de correos (en minúscula) para que las reglas de seguridad
    // y el control de acceso por rol puedan validar a los docentes.
    const docentesCorreos = DOCS
      .map((d) => (d.correo || "").trim().toLowerCase())
      .filter(Boolean);
    await guardarConfig({ docentes: DOCS, docentesCorreos });
    toast("Docentes guardados");
  } catch (e) {
    toast("Error al guardar: " + e.message, "error");
  }
}

async function asegurarCorreosDocentes() {
  const docentesCorreos = DOCS
    .map((d) => (d.correo || "").trim().toLowerCase())
    .filter(Boolean);
  if (docentesCorreos.length) await guardarConfig({ docentesCorreos });
}

function verDocentes() {
  const body = el("div", {});

  const tabla = (lista) => {
    if (!lista.length) return el("div", { class: "muted" }, "—");
    const tb = el("tbody", {}, ...lista.map((x) => {
      const idx = DOCS.indexOf(x);
      return el("tr", {},
        el("td", {}, x.nombre),
        el("td", {}, x.correo || el("span", { class: "muted" }, "sin acceso")),
        el("td", {}, (x.areas || []).join(", ")),
        el("td", { class: "row-actions" },
          el("button", { class: "btn ghost small", onclick: () => editarDocente(idx, repintar) }, "Editar"),
          el("button", { class: "btn ghost small", onclick: () => borrarDocente(idx, repintar) }, "🗑")));
    }));
    return el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Docente"), el("th", {}, "Correo"), el("th", {}, "Áreas"), el("th", {}, ""))), tb));
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
  const d = idx == null ? { nombre: "", areas: [], reemplazo: false, correo: "" } : DOCS[idx];
  const nombre = el("input", { type: "text", placeholder: "Nombre del docente", value: d.nombre || "" });
  const correo = el("input", { type: "email", placeholder: "correo@gmail.com (para darle acceso)", value: d.correo || "" });

  const checks = AREAS.map((a) => {
    const c = el("input", { type: "checkbox", value: a });
    if ((d.areas || []).includes(a)) c.checked = true;
    return el("label", { class: "check" }, c, " " + a);
  });

  const reemplazo = el("input", { type: "checkbox" });
  if (d.reemplazo) reemplazo.checked = true;

  const grid = el("div", { class: "form-grid" },
    el("label", { class: "full" }, "Nombre", nombre),
    el("label", { class: "full" }, "Correo (Google) para acceso", correo),
    el("label", { class: "full" }, "Áreas", el("div", { class: "checks" }, ...checks)),
    el("label", { class: "full check" }, reemplazo, " Es reemplazo (emergencias)"));

  modal(idx == null ? "Agregar docente" : "Editar docente", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const nom = nombre.value.trim();
      if (!nom) { toast("Escribe el nombre", "error"); return; }
      const areas = checks.map((l) => l.querySelector("input")).filter((c) => c.checked).map((c) => c.value);
      const nuevo = { nombre: nom, areas, reemplazo: reemplazo.checked, correo: correo.value.trim().toLowerCase() };
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
