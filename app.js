// URL del backend en Apps Script (reemplaza TU_URL cuando lo tengas)
const GAS_URL = "https://script.google.com/macros/s/AKfycby750kQIInqa87YPAXXDlnVXtG_1wfdBaSpAMXdQCePt-3gkupBUCg7HlW4xi_AfwP9sw/exec";
// ========================================

let activitiesData = []; // Guardamos la data para filtrar

// Navegación
function showTab(tab) {
  if (tab === "consulta") {
    loadActivities();
  } else {
    document.getElementById("content").innerHTML = "<p>Selecciona una opción del menú.</p>";
  }
}

// Cargar actividades
async function loadActivities() {
  const container = document.getElementById("content");
  container.innerHTML = "<p>Cargando actividades...</p>";

  try {
    const r = await fetch(`${GAS_URL}?fn=status`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);

    activitiesData = j.rows; // Guardamos todas

    renderActivities(activitiesData); // Dibujar tabla inicial

  } catch (e) {
    container.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

// Renderizar tabla con filtro
function renderActivities(data) {
  const container = document.getElementById("content");

  let html = `
    <h2>Consulta de Actividades</h2>
    <div id="filterBar">
      <input type="text" id="filterInput" placeholder="Filtrar por palabra clave...">
    </div>
    <table>
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cant. Inicial</th>
          <th>Valor Inicial</th>
          <th>Cant. Ejecutada</th>
          <th>Valor Ejecutado</th>
          <th>Redistrib. Cant.</th>
          <th>Redistrib. Valor</th>
          <th>Pendiente Cant.</th>
          <th>Pendiente Valor</th>
          <th>Últ. Acta</th>
          <th>Fecha Últ. Acta</th>
          <th>Detalle</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach(a => {
    html += `
      <tr>
        <td>${a.item_code || ""}</td>
        <td style="text-align:left">${a.description || ""}</td>
        <td>${a.unit || ""}</td>
        <td>${a.initial_qty ?? ""}</td>
        <td>${a.initial_value ?? ""}</td>
        <td>${a.executed_qty ?? ""}</td>
        <td>${a.executed_value ?? ""}</td>
        <td>${a.redistributed_qty ?? ""}</td>
        <td>${a.redistributed_value ?? ""}</td>
        <td>${a.remaining_qty ?? ""}</td>
        <td>${a.remaining_value ?? ""}</td>
        <td>${a.last_acta_no ?? ""}</td>
        <td>${a.last_acta_date ?? ""}</td>
        <td><button onclick="showActas('${a.activity_id}')">Ver</button></td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  container.innerHTML = html;

  // Activar filtro
  document.getElementById("filterInput").addEventListener("input", e => {
    const term = e.target.value.toLowerCase();
    const filtered = activitiesData.filter(a =>
      (a.item_code || "").toLowerCase().includes(term) ||
      (a.description || "").toLowerCase().includes(term) ||
      (a.unit || "").toLowerCase().includes(term)
    );
    renderActivities(filtered);
  });
}

// Mostrar actas + resumen en modal
async function showActas(activityId) {
  const modal = document.getElementById("modal");
  const summary = document.getElementById("modal-summary");
  const body = document.getElementById("modal-body");

  // Buscar la actividad seleccionada
  const act = activitiesData.find(a => a.activity_id === activityId);
  if (!act) return;

  // Resumen numérico
  summary.innerHTML = `
    <p><b>Ítem:</b> ${act.item_code} | <b>Descripción:</b> ${act.description}</p>
    <p>
      <b>Inicial:</b> ${act.initial_qty} (${act.initial_value}) |
      <b>Ejecutado:</b> ${act.executed_qty} (${act.executed_value}) |
      <b>Redistribuido:</b> ${act.redistributed_qty} (${act.redistributed_value}) |
      <b>Pendiente:</b> ${act.remaining_qty} (${act.remaining_value})
    </p>
  `;

  // Actas relacionadas
  body.innerHTML = "<p>Cargando actas...</p>";
  modal.style.display = "block";

  try {
    const r = await fetch(`${GAS_URL}?fn=list_actas`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);

    const actas = j.rows.filter(a => a.contract_id === act.contract_id);

    if (actas.length === 0) {
      body.innerHTML = "<p>No hay actas registradas para esta actividad.</p>";
      return;
    }

    let html = "<ul>";
    actas.forEach(ac => {
      html += `<li><b>Acta ${ac.acta_no}</b> - ${ac.acta_date} - ${ac.notes || ""}</li>`;
    });
    html += "</ul>";

    body.innerHTML = html;

  } catch (e) {
    body.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

// Cerrar modal
function closeModal() {
  document.getElementById("modal").style.display = "none";
}

// Test ping
async function testPing() {
  const container = document.getElementById("content");
  container.innerHTML = "<p>Probando conexión...</p>";

  try {
    const r = await fetch(`${GAS_URL}?fn=ping`);
    const j = await r.json();
    container.innerHTML = `
      <h2>Ping al backend</h2>
      <pre>${JSON.stringify(j, null, 2)}</pre>
    `;
  } catch (e) {
    container.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}
