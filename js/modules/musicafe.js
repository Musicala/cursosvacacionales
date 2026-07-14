// Módulo Musicafé (onces): registro de consumo diario por estudiante y cuenta acumulada.
import { el, cop, toast, modal, confirmar, hoyISO } from "../ui.js?v=3";
import { listar, crear, actualizar, eliminar, leerConfig, guardarConfig } from "../db.js?v=3";
import { MUSICAFE_PRODUCTOS, MUSICAFE_CATEGORIAS } from "../catalogos.js?v=3";
import { LIBRE, VETADO, permisoDe, puedeCategoria } from "../musicafe-permisos.js?v=1";

let PRECIOS = MUSICAFE_PRODUCTOS;

// Agrupa la lista de precios por categoría, respetando el orden de categorías.
function porCategoria(lista) {
  const grupos = {};
  lista.forEach((p) => { const c = p.categoria || "Otros"; (grupos[c] = grupos[c] || []).push(p); });
  const orden = [...MUSICAFE_CATEGORIAS, ...Object.keys(grupos).filter((c) => !MUSICAFE_CATEGORIAS.includes(c))];
  return orden.filter((c) => grupos[c]).map((c) => ({ categoria: c, items: grupos[c] }));
}

export default async function render(root, ctx) {
  const cfg = await leerConfig();
  if (cfg && Array.isArray(cfg.musicafeProductos) && cfg.musicafeProductos.length) PRECIOS = cfg.musicafeProductos;

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "🍪 Musicafé (onces)"),
    el("div", { class: "right" },
      ctx.rol === "docente" ? null : el("button", { class: "btn ghost", onclick: () => editarPrecios(() => render((root.innerHTML = "", root), ctx)) }, "✏️ Editar precios"),
      el("button", { class: "btn ghost", onclick: () => verPrecios() }, "Ver precios"),
      el("button", { class: "btn primary", onclick: async () => {
        try { await registrar(ctx, cargar); }
        catch (e) { toast("No se pudo cargar la lista de inscritos: " + e.message, "error"); }
      } }, "+ Registrar consumo"),
    ),
  ));

  const fFecha = el("input", { type: "date", value: hoyISO() });
  root.append(el("div", { class: "panel" }, el("div", { class: "filters" },
    el("label", {}, "Ver día", fFecha),
    el("div", { class: "muted small" }, "El total por estudiante suma TODA la semana (lo que pagan al final)."),
  )));

  const diaCont = el("div", { class: "panel" });
  const semCont = el("div", { class: "panel" });
  root.append(diaCont, semCont);

  let datos = [];
  async function cargar() {
    datos = await listar(ctx.temporadaId, "musicafe");
    pintar();
  }
  function pintar() {
    const dia = fFecha.value;
    // ---- Consumos del día ----
    diaCont.innerHTML = "";
    diaCont.append(el("h3", {}, "Consumos del día " + dia));
    const delDia = datos.filter((d) => d.fecha === dia);
    if (!delDia.length) diaCont.append(el("div", { class: "empty" }, "Sin consumos registrados ese día."));
    else {
      const tb = el("tbody", {});
      delDia.forEach((d) => tb.append(el("tr", {},
        el("td", {}, d.estudiante, d.excepcion
          ? el("div", { class: "badge warn", title: `Autorizó: ${d.excepcion.autorizadoPor} · ${d.excepcion.motivo}` }, "⚠️ Con excepción")
          : null),
        el("td", {}, (d.productos || []).map((p) => p.nombre).join(", ")),
        el("td", {}, cop(d.total)),
        el("td", {}, d.pagado
          ? el("span", { class: "badge ok" }, "Pagado")
          : el("span", { class: "badge pend" }, "Pendiente")),
        el("td", { class: "row-actions" }, el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "🗑")),
      )));
      diaCont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
        el("thead", {}, el("tr", {}, ...["Estudiante", "Productos", "Total", "Estado", ""].map((h) => el("th", {}, h)))), tb)));
    }
    // ---- Cuenta acumulada por estudiante (toda la temporada) ----
    semCont.innerHTML = "";
    semCont.append(el("h3", {}, "Cuenta acumulada por estudiante"));
    const porEst = {};
    datos.forEach((d) => {
      const k = (d.estudiante || "—").trim();
      porEst[k] = porEst[k] || { total: 0, pendiente: 0, dias: new Set(), regs: [] };
      const monto = Number(d.total) || 0;
      porEst[k].total += monto;
      if (!d.pagado) porEst[k].pendiente += monto;
      porEst[k].dias.add(d.fecha);
      porEst[k].regs.push(d);
    });
    const nombres = Object.keys(porEst).sort();
    if (!nombres.length) { semCont.append(el("div", { class: "empty" }, "Sin consumos aún.")); return; }
    const tb = el("tbody", {});
    let granTotal = 0, granPend = 0;
    nombres.forEach((n) => {
      const e = porEst[n];
      granTotal += e.total; granPend += e.pendiente;
      const saldado = e.pendiente === 0;
      tb.append(el("tr", { class: saldado ? "saldada" : "" },
        el("td", {}, el("strong", {}, n)),
        el("td", {}, e.dias.size + " día(s)"),
        el("td", {}, cop(e.total)),
        el("td", {}, saldado
          ? el("span", { class: "badge ok" }, "Saldado")
          : el("strong", {}, cop(e.pendiente))),
        el("td", { class: "row-actions" }, saldado
          ? el("button", { class: "btn ghost small", onclick: () => marcarPagado(ctx, e.regs, false, cargar) }, "Reabrir")
          : el("button", { class: "btn primary small", onclick: () => saldarCuenta(ctx, n, e, cargar) }, "💵 Saldar")),
      ));
    });
    tb.append(el("tr", { class: "total-row" },
      el("td", { colspan: "2" }, "TOTAL GENERAL"),
      el("td", {}, el("strong", {}, cop(granTotal))),
      el("td", {}, el("strong", {}, cop(granPend))),
      el("td", {}, "")));
    semCont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...["Estudiante", "Días", "Consumido", "Pendiente", ""].map((h) => el("th", {}, h)))), tb)));
  }
  fFecha.onchange = pintar;
  await cargar();
}

async function registrar(ctx, onSave) {
  const fecha = el("input", { type: "date", value: hoyISO() });
  const inscripciones = await listar(ctx.temporadaId, "inscripciones");
  // Un permiso por nombre de estudiante (es la llave con la que se registran los consumos).
  const porNombre = new Map();
  inscripciones.forEach((i) => {
    const n = (i.estudiante || "").trim();
    if (n && !porNombre.has(n)) porNombre.set(n, i);
  });
  const nombres = [...porNombre.keys()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  const est = nombres.length
    ? el("select", {},
      el("option", { value: "" }, "Selecciona un estudiante"),
      ...nombres.map((nombre) => el("option", { value: nombre }, nombre)))
    : el("input", { type: "text", placeholder: "Nombre del estudiante" });

  // Excepción puntual: solo se activa si coordinación autoriza y queda registrada en el consumo.
  let excepcion = null;
  const aviso = el("div", { class: "permiso-aviso" });

  const lista = el("div", { class: "prod-list" });
  porCategoria(PRECIOS).forEach((g) => {
    lista.append(el("div", { class: "prod-cat" }, g.categoria));
    g.items.forEach((p) => {
      const qty = el("input", { type: "number", min: "0", value: "0", class: "qty" });
      qty.dataset.nombre = p.nombre; qty.dataset.precio = p.precio; qty.dataset.categoria = g.categoria;
      qty.oninput = recalc;
      const fila = el("div", { class: "prod-row" },
        el("span", {}, p.nombre), el("span", { class: "muted" }, cop(p.precio)), qty);
      fila.dataset.categoria = g.categoria;
      lista.append(fila);
    });
  });
  const totalLbl = el("strong", {}, cop(0));
  function recalc() {
    let t = 0;
    lista.querySelectorAll(".qty").forEach((q) => t += (Number(q.value) || 0) * Number(q.dataset.precio));
    totalLbl.textContent = cop(t);
  }

  function permisoActual() {
    return permisoDe(porNombre.get(est.value));
  }

  // Pinta el aviso y bloquea los productos que el estudiante no puede llevar.
  function refrescarPermiso() {
    const p = permisoActual();
    aviso.innerHTML = "";
    aviso.className = "permiso-aviso";
    lista.querySelectorAll(".prod-row").forEach((fila) => {
      const permitido = excepcion ? true : puedeCategoria(p, fila.dataset.categoria);
      fila.classList.toggle("bloqueado", !permitido);
      const qty = fila.querySelector(".qty");
      qty.disabled = !permitido;
      if (!permitido) { qty.value = "0"; }
    });
    recalc();

    if (!est.value || (p.nivel === LIBRE && !excepcion)) { aviso.style.display = "none"; return; }
    aviso.style.display = "";

    if (excepcion) {
      aviso.classList.add("ok");
      aviso.append(
        el("strong", {}, "✔️ Excepción autorizada por hoy"),
        el("div", { class: "small" }, `Autoriza: ${excepcion.autorizadoPor} · ${excepcion.motivo}`),
        el("button", { class: "btn ghost small", onclick: () => { excepcion = null; refrescarPermiso(); } }, "Quitar excepción"),
      );
      return;
    }
    if (p.nivel === VETADO) {
      aviso.classList.add("veto");
      aviso.append(
        el("strong", {}, "🚫 Este estudiante NO puede comprar en el Musicafé"),
        p.nota ? el("div", { class: "small" }, p.nota) : null,
        el("div", { class: "small" }, "Si el niño dice que le dieron permiso, confírmalo con coordinación o con el acudiente antes de venderle."),
        el("button", { class: "btn ghost small", onclick: () => pedirExcepcion() }, "Autorizar solo por hoy…"),
      );
      return;
    }
    aviso.classList.add("warn");
    aviso.append(
      el("strong", {}, "⚠️ Compra restringida"),
      el("div", { class: "small" }, p.categorias.length
        ? "Solo puede llevar: " + p.categorias.join(", ")
        : "No tiene ninguna categoría autorizada."),
      p.nota ? el("div", { class: "small" }, p.nota) : null,
      el("button", { class: "btn ghost small", onclick: () => pedirExcepcion() }, "Autorizar solo por hoy…"),
    );
  }

  // Levanta la restricción para este consumo, dejando constancia de quién autorizó y por qué.
  function pedirExcepcion() {
    const quien = el("input", { type: "text", placeholder: "Nombre de quien autoriza" });
    const motivo = el("input", { type: "text", placeholder: "Ej: la mamá llamó y autorizó" });
    modal("Autorizar excepción por hoy", el("div", { class: "form-grid" },
      el("div", { class: "muted small full" }, "Queda guardado en el consumo. No basta con que el niño diga que le dieron permiso: confírmalo con el acudiente o con coordinación."),
      el("label", { class: "full" }, "¿Quién autoriza?", quien),
      el("label", { class: "full" }, "Motivo", motivo),
    ), [
      { texto: "Cancelar", clase: "ghost" },
      { texto: "Autorizar", clase: "primary", onClick: (dlg) => {
        if (!quien.value.trim() || !motivo.value.trim()) { toast("Escribe quién autoriza y el motivo", "error"); return; }
        excepcion = { autorizadoPor: quien.value.trim(), motivo: motivo.value.trim() };
        dlg.close(); refrescarPermiso();
      } },
    ]);
  }

  est.onchange = () => { excepcion = null; refrescarPermiso(); };
  refrescarPermiso();

  const body = el("div", {},
    el("div", { class: "form-grid" },
      el("label", {}, "Fecha", fecha),
      el("label", {}, "Estudiante", est)),
    aviso,
    el("h4", {}, "Productos"), lista,
    el("div", { class: "total-line" }, "Total del día: ", totalLbl),
  );
  modal("Registrar consumo", body, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      if (!est.value.trim()) { toast("Falta el estudiante", "error"); return; }
      const p = permisoActual();
      if (p.nivel === VETADO && !excepcion) {
        toast("Este estudiante no está autorizado a comprar en el Musicafé", "error"); return;
      }
      const productos = []; let total = 0;
      lista.querySelectorAll(".qty").forEach((q) => {
        const c = Number(q.value) || 0;
        if (c > 0) { productos.push({ nombre: q.dataset.nombre, cantidad: c, precio: Number(q.dataset.precio), categoria: q.dataset.categoria }); total += c * Number(q.dataset.precio); }
      });
      if (!productos.length) { toast("Marca al menos un producto", "error"); return; }
      // Segunda barrera: aunque alguien reactive el campo desde el navegador, aquí no pasa.
      if (!excepcion) {
        const prohibido = productos.find((x) => !puedeCategoria(p, x.categoria));
        if (prohibido) { toast(`No está autorizado a llevar "${prohibido.nombre}"`, "error"); return; }
      }
      await crear(ctx.temporadaId, "musicafe", {
        fecha: fecha.value, estudiante: est.value.trim(), productos, total,
        permisoNivel: p.nivel,
        excepcion: excepcion ? { ...excepcion, fecha: hoyISO() } : null,
      });
      dlg.close(); toast("Consumo registrado"); onSave && onSave();
    } },
  ]);
}

function verPrecios() {
  const body = el("div", {});
  porCategoria(PRECIOS).forEach((g) => {
    body.append(el("h4", {}, g.categoria));
    body.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("tbody", {}, ...g.items.map((p) => el("tr", {}, el("td", {}, p.nombre), el("td", {}, cop(p.precio))))))));
  });
  modal("Precios Musicafé", body, [{ texto: "Cerrar", clase: "primary" }]);
}

// Editor de la lista de precios (se guarda en config/global → vale para toda la app).
function editarPrecios(onSave) {
  const items = PRECIOS.map((p) => ({ ...p }));
  const cont = el("div", { class: "precio-edit" });

  function pintar() {
    cont.innerHTML = "";
    items.forEach((p, i) => {
      const nombre = el("input", { type: "text", value: p.nombre || "", placeholder: "Producto" });
      nombre.oninput = () => (items[i].nombre = nombre.value);
      const cat = el("select", {}, ...MUSICAFE_CATEGORIAS.map((c) => {
        const o = el("option", { value: c }, c); if ((p.categoria || MUSICAFE_CATEGORIAS[0]) === c) o.selected = true; return o;
      }));
      cat.onchange = () => (items[i].categoria = cat.value);
      if (!items[i].categoria) items[i].categoria = cat.value;
      const precio = el("input", { type: "number", value: p.precio || "", placeholder: "0", class: "precio-num" });
      precio.oninput = () => (items[i].precio = Number(precio.value) || 0);
      cont.append(el("div", { class: "precio-row4" }, nombre, cat, precio,
        el("button", { class: "btn ghost small", onclick: () => { items.splice(i, 1); pintar(); } }, "🗑")));
    });
  }
  pintar();
  const add = el("button", { class: "btn ghost small", onclick: () => { items.push({ nombre: "", precio: 0, categoria: MUSICAFE_CATEGORIAS[0] }); pintar(); } }, "+ Agregar producto");

  modal("Editar precios del Musicafé", el("div", {}, cont, add), [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const limpios = items.filter((p) => (p.nombre || "").trim());
      try {
        await guardarConfig({ musicafeProductos: limpios });
        PRECIOS = limpios;
        dlg.close(); toast("Precios actualizados"); onSave && onSave();
      } catch (e) { toast("Error: " + e.message, "error"); }
    } },
  ]);
}

// Marca como pagados (o reabre) un conjunto de consumos del estudiante.
async function marcarPagado(ctx, regs, pagado, onSave) {
  const objetivo = regs.filter((d) => !!d.pagado !== pagado);
  await Promise.all(objetivo.map((d) =>
    actualizar(ctx.temporadaId, "musicafe", d.id, { pagado, pagadoFecha: pagado ? hoyISO() : null })));
  toast(pagado ? "Cuenta saldada" : "Cuenta reabierta");
  onSave && onSave();
}

function saldarCuenta(ctx, nombre, e, onSave) {
  confirmar(`¿Marcar como pagada la cuenta de ${nombre} por ${cop(e.pendiente)}?`,
    () => marcarPagado(ctx, e.regs, true, onSave));
}

function del(ctx, dato, onSave) {
  confirmar("¿Eliminar este consumo?", async () => { await eliminar(ctx.temporadaId, "musicafe", dato.id); toast("Eliminado"); onSave && onSave(); });
}
