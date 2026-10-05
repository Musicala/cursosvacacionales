// Administración Wix: solo lectura en Wix; las claves viven en Cloud Functions.
import { el, toast, modal } from "../ui.js?v=4";
import { auth } from "../firebase.js?v=4";
import { listarTalleresVacacionales, guardarTallerVacacional } from "../db.js?v=6";
import { semanasDetalle } from "../catalogos.js?v=5";
import { WIX_SESSIONS_URL, WIX_SERVICES_URL } from "../../firebase-config.js?v=7";

const BASE = [
  { id: "musica", name: "Música", wixServiceId: "9d77dd01-50c9-4955-9fde-a8c8330c4a3d", active: true, orden: 1 },
  { id: "ludico", name: "Lúdico", wixServiceId: "601068d4-a42f-404d-ae59-8c1d23b84de3", active: true, orden: 2 },
  { id: "arte", name: "Arte", wixServiceId: "deaf3557-1318-4d61-8fe4-f5be32692ecb", active: true, orden: 3 },
  { id: "corporal", name: "Exploración Corporal", wixServiceId: "8a015cbc-bf41-44ab-b955-d82ef4407cc4", active: true, orden: 4 },
];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

async function requestJson(url) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  if (!contentType.includes("application/json")) throw new Error(`HTTP ${response.status}: el backend devolvió ${contentType || "contenido desconocido"}, no JSON.`);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error(`HTTP ${response.status}: JSON inválido.`); }
  if (!response.ok || !data.ok) throw new Error(`HTTP ${response.status}: ${data.error || "Error consultando Wix."}`);
  return data;
}

export default async function render(root, ctx) {
  if (ctx.rol === "docente") return;
  root.append(el("div", { class: "panel-head" }, el("h2", {}, "🔗 Configuración Wix")));
  const catalogo = el("section", { class: "panel" });
  const verificacion = el("section", { class: "panel" });
  root.append(catalogo, verificacion);
  let workshops = await listarTalleresVacacionales();
  let services = [];

  async function pintarCatalogo() {
    workshops = await listarTalleresVacacionales();
    catalogo.innerHTML = "";
    catalogo.append(el("div", { class: "panel-head" },
      el("div", {}, el("h3", {}, "Talleres centrales"), el("p", { class: "muted small" }, "Selecciona servicios por nombre; los UUID se guardan internamente.")),
      el("button", { class: "btn primary", onclick: sincronizar }, "🔄 SINCRONIZAR SERVICIOS WIX")));
    if (!services.length) catalogo.append(el("p", { class: "muted small" }, "Sincroniza los servicios CLASS de Wix para habilitar los selectores y comprobar el estado."));
    if (!workshops.length) {
      catalogo.append(el("div", { class: "empty" }, el("p", {}, "Aún no existe el catálogo central."), el("button", { class: "btn primary", onclick: crearBase }, "Crear catálogo Musikids")));
      return;
    }
    workshops.forEach((workshop) => catalogo.append(tarjeta(workshop)));
  }

  function tarjeta(workshop) {
    const selected = services.find((service) => service.id === workshop.wixServiceId);
    const selector = el("select", {});
    selector.append(el("option", { value: "" }, "Selecciona un servicio CLASS…"));
    services.forEach((service) => {
      const option = el("option", { value: service.id }, service.name);
      if (service.id === workshop.wixServiceId) option.selected = true;
      selector.append(option);
    });
    if (workshop.wixServiceId && !selected) selector.append(el("option", { value: workshop.wixServiceId, selected: true }, "Servicio no encontrado en la última sincronización"));
    const active = el("input", { type: "checkbox" }); active.checked = workshop.active !== false;
    const state = !workshop.wixServiceId ? "🔴 Sin configurar" : selected ? "🟢 Conectado con Wix" : services.length ? "🟡 Servicio no encontrado" : "⚪ Sincroniza para comprobar";
    return el("article", { class: "wix-workshop" },
      el("div", {}, el("strong", {}, workshop.name || workshop.id), el("div", { class: "muted small" }, `ID interno: ${workshop.id}`)),
      el("label", {}, "Servicio Wix", selector),
      el("div", { class: "wix-service-state" }, state, workshop.wixServiceId ? el("div", { class: "muted small" }, `ID Wix: ${corto(workshop.wixServiceId)}`) : null),
      el("button", { class: "btn ghost small", onclick: () => verificarServicio(selector.value) }, "Verificar servicio"),
      el("label", { class: "check" }, active, " Activo"),
      el("button", { class: "btn ghost small", onclick: async () => {
        const service = services.find((item) => item.id === selector.value);
        await guardarTallerVacacional(workshop.id, { name: workshop.name || workshop.id, wixServiceId: selector.value, wixServiceName: service?.name || "", active: active.checked, orden: workshop.orden || 0 });
        toast("Taller guardado"); await pintarCatalogo();
      } }, "Guardar"));
  }

  async function crearBase() {
    try { for (const workshop of BASE) await guardarTallerVacacional(workshop.id, workshop); toast("Catálogo central creado"); await pintarCatalogo(); }
    catch (error) { toast("No se pudo crear el catálogo: " + error.message, "error"); }
  }
  async function sincronizar() {
    try {
      const listado = (await requestJson(WIX_SERVICES_URL)).services || [];
      const verificados = await Promise.all(workshops.filter((w) => w.wixServiceId).map(async (workshop) => {
        const result = await requestJson(`${WIX_SERVICES_URL}?${new URLSearchParams({ serviceId: workshop.wixServiceId })}`);
        const service = result.checkedService;
        return service?.found && service.type === "CLASS"
          ? { id: service.id, name: service.name, type: service.type, hidden: service.hidden, onlineBooking: service.onlineBookingEnabled }
          : null;
      }));
      services = [...new Map([...listado, ...verificados.filter(Boolean)].map((service) => [service.id, service])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      toast(`${services.length} servicio(s) CLASS sincronizados desde Wix`); await pintarCatalogo();
    }
    catch (error) { toast("No se pudieron sincronizar servicios: " + error.message, "error"); }
  }
  async function verificarServicio(serviceId) {
    if (!serviceId) { toast("Selecciona un servicio Wix primero.", "error"); return; }
    try {
      const data = await requestJson(`${WIX_SERVICES_URL}?${new URLSearchParams({ serviceId })}`);
      const service = data.checkedService;
      const body = service?.found && service.type === "CLASS"
        ? el("div", {}, el("p", {}, "✅ Servicio encontrado en Wix"), el("p", {}, `Nombre: ${service.name}`), el("p", {}, `Tipo: ${service.type}`), el("p", {}, `Online booking: ${service.onlineBookingEnabled ? "Activo" : "Inactivo"}`), el("p", {}, `Service ID: ${service.id}`))
        : el("p", {}, "🟡 No se encontró un servicio CLASS con este ID.");
      modal("Verificar servicio Wix", body, [{ texto: "Cerrar", clase: "primary" }]);
    } catch (error) { toast("No se pudo verificar: " + error.message, "error"); }
  }

  const weeks = semanasDetalle(ctx.temporada);
  const weekSelect = el("select", {}, ...weeks.map((week) => el("option", { value: week.nombre }, week.nombre)));
  const output = el("div", { class: "wix-results" });
  verificacion.append(el("h3", {}, "Verificar semana con Wix"), el("p", { class: "muted small" }, "Solo lectura: Wix define las horas reales; no se crean reservas."),
    el("div", { class: "filters" }, el("label", {}, "Semana", weekSelect), el("button", { class: "btn primary", onclick: verificarSemana }, "VERIFICAR CON WIX")), output);
  async function verificarSemana() {
    const week = weeks.find((item) => item.nombre === weekSelect.value);
    if (!week?.desde || !week?.hasta) { toast("Configura las fechas de esta semana en Info temporada.", "error"); return; }
    output.innerHTML = ""; output.append(el("p", { class: "muted" }, "Consultando sesiones reales de Wix…"));
    try { pintarResultado(output, await requestJson(`${WIX_SESSIONS_URL}?${new URLSearchParams({ temporadaId: ctx.temporadaId, semana: week.nombre })}`), week); }
    catch (error) { output.innerHTML = ""; output.append(el("div", { class: "wix-status error" }, "🔴 Error consultando Wix: " + error.message)); }
  }
  await pintarCatalogo();
}

function pintarResultado(root, data, week) {
  root.innerHTML = "";
  const byWorkshop = new Map(data.workshops.map((item) => [item.id, item]));
  const seen = new Set();
  const scheduled = data.scheduled.filter((item) => { const key = `${item.dia}|${item.workshopId || item.area}|${item.taller}`; if (seen.has(key)) return false; seen.add(key); return true; });
  const days = new Map(); scheduled.forEach((item) => { if (!days.has(item.dia)) days.set(item.dia, []); days.get(item.dia).push(item); });
  let found = 0; let bookable = 0; let missing = 0;
  [...days.entries()].forEach(([day, items]) => {
    const iso = isoDia(week.desde, day);
    const card = el("section", { class: "wix-day" }, el("h4", {}, `${day} ${iso ? iso.slice(8) : ""}`));
    const rows = items.map((item) => {
      const workshop = byWorkshop.get(item.workshopId); const slots = workshop?.wixServiceId ? data.slots.filter((slot) => slot.serviceId === workshop.wixServiceId && slot.localStartDate.slice(0, 10) === iso) : [];
      return { item, slot: slots[0] };
    }).sort((a, b) => (a.slot?.localStartDate || "99").localeCompare(b.slot?.localStartDate || "99"));
    rows.forEach(({ item, slot }) => {
      if (!slot) { missing++; card.append(fila(item, "🟡 Servicio enlazado, sin sesión Wix para este día")); return; }
      found++; if (slot.bookable) bookable++;
      card.append(fila(item, `${slot.bookable ? "🟢" : "🟠"} ${horas(slot)} · ${slot.bookable ? "Wix OK" : "No reservable"} · ${cupos(slot)} cupos`));
    }); root.append(card);
  });
  root.prepend(el("div", { class: "wix-summary" }, `VERIFICACIÓN WIX · ✅ ${found} sesiones encontradas · ✅ ${bookable} reservables · ⚠️ ${missing} inconsistencias`));
  if (!scheduled.length) root.append(el("div", { class: "empty" }, "No hay talleres programados para esta semana."));
}
function fila(item, status) { return el("div", { class: "wix-session" }, el("strong", {}, item.taller || item.area || item.workshopId || "Taller"), el("span", {}, status)); }
function horas(slot) { return `${slot.localStartDate.slice(11, 16)}–${slot.localEndDate.slice(11, 16)}`; }
function cupos(slot) { return slot.remainingCapacity ?? slot.bookableCapacity ?? "—"; }
function corto(id) { return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-5)}` : id; }
function isoDia(desde, dia) { const date = new Date(`${desde}T12:00:00`); const target = DIAS.indexOf(dia); if (target < 0) return ""; date.setDate(date.getDate() + ((target - date.getDay() + 7) % 7)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
