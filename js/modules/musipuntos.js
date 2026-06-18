// Módulo Musipuntos: incrusta la app de Musipuntos dentro del panel.
import { el } from "../ui.js?v=1";

const URL_MUSIPUNTOS = "https://musicalaescuela.github.io/musipuntos/";

export default function render(root) {
  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "⭐ Musipuntos"),
    el("div", { class: "right" },
      el("a", { class: "btn ghost", href: URL_MUSIPUNTOS, target: "_blank", rel: "noopener" }, "Abrir en pestaña nueva ↗")),
  ));

  const marco = el("iframe", {
    class: "musipuntos-frame",
    src: URL_MUSIPUNTOS,
    title: "Musipuntos",
    loading: "lazy",
    allow: "clipboard-write",
  });

  root.append(el("div", { class: "panel musipuntos-panel" },
    marco,
    el("p", { class: "muted small" },
      "Si la página no carga aquí, usa el botón “Abrir en pestaña nueva”."),
  ));
}
