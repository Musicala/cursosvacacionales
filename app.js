const $ = (sel) => document.querySelector(sel);

const state = {
  catalogs: {},
  leads: [],
  selectedLeadId: null,
};

async function apiGet(action, params = {}) {
  const url = new URL(CRM_CONFIG.API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("key", CRM_CONFIG.API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error API");
  return data.data;
}

async function apiPost(action, payload = {}) {
  // Importante: text/plain para evitar CORS preflight
  const res = await fetch(CRM_CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      key: CRM_CONFIG.API_KEY,
      user: CRM_CONFIG.USER_NAME,
      action,
      ...payload
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error API");
  return data.data;
}

function fillSelect(sel, options, placeholder = "Todos") {
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  sel.appendChild(opt0);

  (options || []).forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
}

function fillSelectNoAll(sel, options, fallbackFirst = "") {
  sel.innerHTML = "";
  (options || []).forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
  if (!sel.value && fallbackFirst) sel.value = fallbackFirst;
}

function renderLeadsTable(leads) {
  const tbody = $("#leadsBody");
  tbody.innerHTML = "";

  $("#count").textContent = String(leads.length);

  leads.forEach(l => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(l.created_at || "")}</td>
      <td>${escapeHtml(l.temporada || "")}</td>
      <td><span class="pill">${escapeHtml(l.estado || "")}</span></td>
      <td><span class="link" data-id="${escapeHtml(l.lead_id)}">${escapeHtml(l.nombre_estudiante || "")}</span></td>
      <td>${escapeHtml(l.edad ?? "")}</td>
      <td>${escapeHtml(l.celular || "")}</td>
      <td>${escapeHtml(l.servicio || "")}</td>
      <td>${escapeHtml(l.modalidad || "")}</td>
      <td>${escapeHtml(l.sede || "")}</td>
      <td>${escapeHtml(l.asesor_asignado || "")}</td>
      <td><button class="btn ghost small" data-open="${escapeHtml(l.lead_id)}">Abrir</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-id],[data-open]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id") || el.getAttribute("data-open");
      openLead(id);
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}

async function loadCatalogs() {
  state.catalogs = await apiGet("catalogs");

  // filtros
  fillSelect($("#fTemporada"), state.catalogs.temporada || [], "Todas");
  fillSelect($("#fEstado"), state.catalogs.estado || [], "Todos");

  // modal + detalle
  fillSelectNoAll($("#m_temporada"), state.catalogs.temporada || []);
  fillSelectNoAll($("#m_estado"), state.catalogs.estado || []);
  fillSelectNoAll($("#m_servicio"), state.catalogs.servicio || []);
  fillSelectNoAll($("#m_modalidad"), state.catalogs.modalidad || []);
  fillSelectNoAll($("#m_sede"), state.catalogs.sede || []);

  fillSelectNoAll($("#d_temporada"), state.catalogs.temporada || []);
  fillSelectNoAll($("#d_estado"), state.catalogs.estado || []);
  fillSelectNoAll($("#d_servicio"), state.catalogs.servicio || []);
  fillSelectNoAll($("#d_modalidad"), state.catalogs.modalidad || []);
  fillSelectNoAll($("#d_sede"), state.catalogs.sede || []);

  fillSelectNoAll($("#en_temporada"), state.catalogs.temporada || []);
}

async function loadLeads() {
  const params = {
    temporada: $("#fTemporada").value,
    estado: $("#fEstado").value,
    q: $("#fQuery").value.trim(),
    limit: 300
  };
  state.leads = await apiGet("leads", params);
  renderLeadsTable(state.leads);
}

async function openLead(leadId) {
  state.selectedLeadId = leadId;

  const lead = await apiGet("lead", { lead_id: leadId });
  $("#detailEmpty").classList.add("hidden");
  $("#detail").classList.remove("hidden");

  // fill detail fields
  $("#d_lead_id").value = lead.lead_id || "";
  $("#d_temporada").value = lead.temporada || "";
  $("#d_estado").value = lead.estado || "";
  $("#d_asesor_asignado").value = lead.asesor_asignado || "";
  $("#d_nombre_estudiante").value = lead.nombre_estudiante || "";
  $("#d_edad").value = lead.edad ?? "";
  $("#d_acudiente").value = lead.acudiente || "";
  $("#d_celular").value = lead.celular || "";
  $("#d_correo").value = lead.correo || "";
  $("#d_servicio").value = lead.servicio || "";
  $("#d_modalidad").value = lead.modalidad || "";
  $("#d_sede").value = lead.sede || "";
  $("#d_notas").value = lead.notas || "";

  // followups
  const followups = await apiGet("followups", { lead_id: leadId });
  renderFollowups(followups);

  // default enroll temporada = lead temporada
  $("#en_temporada").value = lead.temporada || $("#en_temporada").value;
}

function renderFollowups(items) {
  const container = $("#followups");
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<div class="muted">Sin seguimientos aún.</div>`;
    return;
  }

  items.forEach(f => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="meta">
        <span>📅 ${escapeHtml(f.fecha || "")}</span>
        <span>📡 ${escapeHtml(f.canal || "")}</span>
        <span>✅ ${escapeHtml(f.resultado || "")}</span>
        <span>👤 ${escapeHtml(f.hecho_por || "")}</span>
      </div>
      <div class="note">${escapeHtml(f.nota || "")}</div>
    `;
    container.appendChild(div);
  });
}

function collectDetailPatch() {
  return {
    temporada: $("#d_temporada").value,
    estado: $("#d_estado").value,
    asesor_asignado: $("#d_asesor_asignado").value.trim(),
    nombre_estudiante: $("#d_nombre_estudiante").value.trim(),
    edad: $("#d_edad").value,
    acudiente: $("#d_acudiente").value.trim(),
    celular: $("#d_celular").value.trim(),
    correo: $("#d_correo").value.trim(),
    servicio: $("#d_servicio").value,
    modalidad: $("#d_modalidad").value,
    sede: $("#d_sede").value,
    notas: $("#d_notas").value.trim(),
  };
}

async function onSaveLead() {
  if (!state.selectedLeadId) return;

  const patch = collectDetailPatch();
  await apiPost("lead_update", { lead_id: state.selectedLeadId, patch });

  // refrescar lista y detalle
  await loadLeads();
  await openLead(state.selectedLeadId);
}

async function onCreateLead() {
  const lead = {
    temporada: $("#m_temporada").value,
    estado: $("#m_estado").value,
    asesor_asignado: $("#m_asesor_asignado").value.trim(),
    nombre_estudiante: $("#m_nombre_estudiante").value.trim(),
    edad: $("#m_edad").value,
    acudiente: $("#m_acudiente").value.trim(),
    celular: $("#m_celular").value.trim(),
    correo: $("#m_correo").value.trim(),
    servicio: $("#m_servicio").value,
    modalidad: $("#m_modalidad").value,
    sede: $("#m_sede").value,
    origen: "Manual",
    notas: $("#m_notas").value.trim(),
  };

  if (!lead.nombre_estudiante || !lead.celular) {
    alert("Nombre y celular son obligatorios.");
    return;
  }

  const created = await apiPost("lead_create", { lead });
  $("#modalLead").close();
  await loadLeads();
  await openLead(created.lead_id);
}

async function onAddFollowup() {
  if (!state.selectedLeadId) return;
  const nota = $("#fu_nota").value.trim();
  if (!nota) { alert("Escribe una nota."); return; }

  await apiPost("followup_add", {
    lead_id: state.selectedLeadId,
    followup: {
      canal: $("#fu_canal").value,
      resultado: $("#fu_resultado").value.trim(),
      nota
    }
  });

  $("#modalFollowup").close();
  $("#fu_resultado").value = "";
  $("#fu_nota").value = "";

  const followups = await apiGet("followups", { lead_id: state.selectedLeadId });
  renderFollowups(followups);
}

async function onEnroll() {
  if (!state.selectedLeadId) return;

  const enrollment = {
    temporada: $("#en_temporada").value,
    plan: $("#en_plan").value,
    valor: $("#en_valor").value.trim(),
    estado_pago: $("#en_estado_pago").value,
    medio_pago: $("#en_medio_pago").value.trim(),
    grupo_horario: $("#en_grupo").value.trim(),
    fecha_inicio: $("#en_inicio").value.trim(),
    observaciones: $("#en_obs").value.trim(),
  };

  await apiPost("enroll_create", { lead_id: state.selectedLeadId, enrollment });
  $("#modalEnroll").close();

  await loadLeads();
  await openLead(state.selectedLeadId);
}

function wireUI() {
  $("#btnReload").addEventListener("click", loadLeads);
  $("#btnApply").addEventListener("click", loadLeads);
  $("#btnClear").addEventListener("click", () => {
    $("#fTemporada").value = "";
    $("#fEstado").value = "";
    $("#fQuery").value = "";
    loadLeads();
  });

  $("#btnNewLead").addEventListener("click", () => $("#modalLead").showModal());
  $("#btnCreateLead").addEventListener("click", (ev) => { ev.preventDefault(); onCreateLead(); });

  $("#btnSaveLead").addEventListener("click", onSaveLead);

  $("#btnAddFollowup").addEventListener("click", () => $("#modalFollowup").showModal());
  $("#btnSaveFollowup").addEventListener("click", (ev) => { ev.preventDefault(); onAddFollowup(); });

  $("#btnEnroll").addEventListener("click", () => $("#modalEnroll").showModal());
  $("#btnSaveEnroll").addEventListener("click", (ev) => { ev.preventDefault(); onEnroll(); });
}

async function boot() {
  try {
    wireUI();
    await loadCatalogs();
    await loadLeads();
  } catch (err) {
    console.error(err);
    alert("Error: " + (err.message || err));
  }
}

boot();
