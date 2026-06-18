// Módulo Musicafé (onces): registro de consumo diario por estudiante y cuenta acumulada.
import { el, cop, toast, modal, confirmar, hoyISO } from "../ui.js";
import { listar, crear, eliminar, leerConfig, guardarConfig } from "../db.js";
import { MUSICAFE_PRODUCTOS, MUSICAFE_CATEGORIAS } from "../catalogos.js";

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
        el("td", {}, d.estudiante),
        el("td", {}, (d.productos || []).map((p) => p.nombre).join(", ")),
        el("td", {}, cop(d.total)),
        el("td", { class: "row-actions" }, el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "🗑")),
      )));
      diaCont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
        el("thead", {}, el("tr", {}, ...["Estudiante", "Productos", "Total", ""].map((h) => el("th", {}, h)))), tb)));
    }
    // ---- Cuenta acumulada por estudiante (toda la temporada) ----
    semCont.innerHTML = "";
    semCont.append(el("h3", {}, "Cuenta acumulada por estudiante"));
    const porEst = {};
    datos.forEach((d) => {
      const k = (d.estudiante || "—").trim();
      porEst[k] = porEst[k] || { total: 0, dias: new Set() };
      porEst[k].total += Number(d.total) || 0;
      porEst[k].dias.add(d.fecha);
    });
    const nombres = Object.keys(porEst).sort();
    if (!nombres.length) { semCont.append(el("div", { class: "empty" }, "Sin consumos aún.")); return; }
    const tb = el("tbody", {});
    let granTotal = 0;
    nombres.forEach((n) => {
      granTotal += porEst[n].total;
      tb.append(el("tr", {},
        el("td", {}, el("strong", {}, n)),
        el("td", {}, porEst[n].dias.size + " día(s)"),
        el("td", {}, el("strong", {}, cop(porEst[n].total))),
      ));
    });
    tb.append(el("tr", { class: "total-row" }, el("td", { colspan: "2" }, "TOTAL GENERAL"), el("td", {}, el("strong", {}, cop(granTotal)))));
    semCont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...["Estudiante", "Días", "Total a pagar"].map((h) => el("th", {}, h)))), tb)));
  }
  fFecha.onchange = pintar;
  await cargar();
}

async function registrar(ctx, onSave) {
  const fecha = el("input", { type: "date", value: hoyISO() });
  const inscritos = (await listar(ctx.temporadaId, "inscripciones"))
    .map((i) => (i.estudiante || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  const nombres = [...new Set(inscritos)];
  const est = nombres.length
    ? el("select", {},
      el("option", { value: "" }, "Selecciona un estudiante"),
      ...nombres.map((nombre) => el("option", { value: nombre }, nombre)))
    : el("input", { type: "text", placeholder: "Nombre del estudiante" });
  const lista = el("div", { class: "prod-list" });
  porCategoria(PRECIOS).forEach((g) => {
    lista.append(el("div", { class: "prod-cat" }, g.categoria));
    g.items.forEach((p) => {
      const qty = el("input", { type: "number", min: "0", value: "0", class: "qty" });
      qty.dataset.nombre = p.nombre; qty.dataset.precio = p.precio;
      qty.oninput = recalc;
      lista.append(el("div", { class: "prod-row" },
        el("span", {}, p.nombre), el("span", { class: "muted" }, cop(p.precio)), qty));
    });
  });
  const totalLbl = el("strong", {}, cop(0));
  function recalc() {
    let t = 0;
    lista.querySelectorAll(".qty").forEach((q) => t += (Number(q.value) || 0) * Number(q.dataset.precio));
    totalLbl.textContent = cop(t);
  }
  const body = el("div", {},
    el("div", { class: "form-grid" },
      el("label", {}, "Fecha", fecha),
      el("label", {}, "Estudiante", est)),
    el("h4", {}, "Productos"), lista,
    el("div", { class: "total-line" }, "Total del día: ", totalLbl),
  );
  modal("Registrar consumo", body, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      if (!est.value.trim()) { toast("Falta el estudiante", "error"); return; }
      const productos = []; let total = 0;
      lista.querySelectorAll(".qty").forEach((q) => {
        const c = Number(q.value) || 0;
        if (c > 0) { productos.push({ nombre: q.dataset.nombre, cantidad: c, precio: Number(q.dataset.precio) }); total += c * Number(q.dataset.precio); }
      });
      if (!productos.length) { toast("Marca al menos un producto", "error"); return; }
      await crear(ctx.temporadaId, "musicafe", { fecha: fecha.value, estudiante: est.value.trim(), productos, total });
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

function del(ctx, dato, onSave) {
  confirmar("¿Eliminar este consumo?", async () => { await eliminar(ctx.temporadaId, "musicafe", dato.id); toast("Eliminado"); onSave && onSave(); });
}
