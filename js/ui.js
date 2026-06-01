// Pequeños ayudantes de interfaz (sin librerías).

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Crea un elemento con atributos e hijos. el("div",{class:"x"}, "hola")
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]
  ));
}

// Formato de moneda colombiana.
export function cop(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

let toastTimer;
export function toast(msg, tipo = "ok") {
  let t = $("#toast");
  if (!t) {
    t = el("div", { id: "toast", class: "toast" });
    document.body.append(t);
  }
  t.textContent = msg;
  t.className = "toast show " + tipo;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 3000);
}

// Modal genérico. Devuelve el <dialog>; cierra con .close().
export function modal(titulo, contenido, acciones = []) {
  const dlg = el("dialog", { class: "modal" });
  const card = el("div", { class: "modal-card" });
  const head = el("div", { class: "modal-head" },
    el("h3", {}, titulo),
    el("button", { class: "icon", onclick: () => dlg.close() }, "✕"),
  );
  const body = el("div", { class: "modal-body" });
  if (typeof contenido === "string") body.innerHTML = contenido;
  else body.append(contenido);

  const foot = el("div", { class: "modal-actions" });
  for (const a of acciones) {
    foot.append(el("button", {
      class: "btn " + (a.clase || ""),
      onclick: () => a.onClick ? a.onClick(dlg) : dlg.close(),
    }, a.texto));
  }
  card.append(head, body, foot);
  dlg.append(card);
  document.body.append(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  return dlg;
}

export function confirmar(msg, onSi) {
  modal("Confirmar", el("p", {}, msg), [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Sí, continuar", clase: "danger", onClick: (d) => { d.close(); onSi(); } },
  ]);
}
