// URL del backend en Apps Script (reemplaza TU_URL cuando lo tengas)
const GAS_URL = "https://script.google.com/macros/s/AKfycbyMqxg4HLB4DMpInjop4ruu2Kr5jBtIuTzVjpcURfQayWAoFHwMivNBHCHhvt2YbzH82w/exec";
// ========================================
// CONFIGURACIÓN DEL BACKEND
// ========================================
const GAS_URL = "https://script.google.com/macros/s/TU_URL/exec";
let activitiesData = []; // Data completa
let contractsList = [];  // Lista de contratos para filtros

// ========================================
// NAVEGACIÓN ENTRE PESTAÑAS
// ========================================
function showTab(tab) {
  if (tab === "consulta") {
    loadActivities();
  } else {
    document.getElementById("content").innerHTML = "<p>Selecciona una opción del menú.</p>";
  }
}

// ========================================
// CARGA DE ACTIVIDADES
// ========================================
async function loadActivities() {
  const container = document.getElementById("content");
  container.innerHTML = "<p>Cargando actividades...</p>";

  try {
    const r = await fetch(`${GAS_URL}?fn=status`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);

    activitiesData = j.rows;
    contractsList = [...new Set(activitiesData.map(a => a.contract_id))]; // contratos únicos

    // Pintamos filtros + tabla vacía
    container.innerHTML = `
      <h2>Consulta de Actividades</h2>
      <div id="filterBar">
        <label>Contrato: 
          <select id="filterContract">
            <option value="">Todos</option>
            ${contractsList.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </label>
        <label>Ítem desde: <input type="text" id="filterItemFrom" size="5"></label>
        <label>Ítem hasta: <input type="text" id="filterItemTo" size="5"></label>
        <button onclick="applyFilters()">Aplicar</button>
        <button onclick="clearFilters()">Limpiar</button>
      </div>
      <div id="tableWrapper">
        <div id="tableContainer"></div>
      </div>
    `;

    // Render inicial con todos
    renderActivities(activitiesData);

  } catch (e) {
    container.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

// ========================================
// RENDER TABLA PRINCIPAL
// ========================================
function renderActivities(data) {
  const container = document.getElementById("tableContainer");

  let html = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Contrato</th>
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

  data.forEach((a, i) => {
    html += `
      <tr>
        <td>${i + 1}</td>
        <td>${a.contract_id || ""}</td>
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
}

// ========================================
// FILTROS AVANZADOS
// ========================================
function applyFilters() {
  const cId = document.getElementById("filterContract").value;
  const from = document.getElementById("filterItemFrom").value;
  const to = document.getElementById("filterItemTo").value;

  let filtered = [...activitiesData];

  if (cId) filtered = filtered.filter(a => a.contract_id === cId);

  if (from) filtered = filtered.filter(a => a.item_code >= from);
  if (to)   filtered = filtered.filter(a => a.item_code <= to);

  renderActivities(filtered);
}

function clearFilters() {
  document.getElementById("filterContract").value = "";
  document.getElementById("filterItemFrom").value = "";
  document.getElementById("filterItemTo").value = "";
  renderActivities(activitiesData);
}

// ========================================
// MODAL DE ACTAS
// ========================================
async function showActas(activityId) {
  const modal = document.getElementById("modal");
  const summary = document.getElementById("modal-summary");
  const body = document.getElementById("modal-body");

  const act = activitiesData.find(a => a.activity_id === activityId);
  if (!act) return;

  summary.innerHTML = `
    <p><b>Contrato:</b> ${act.contract_id} | <b>Ítem:</b> ${act.item_code} | <b>Descripción:</b> ${act.description}</p>
    <p>
      <b>Inicial:</b> ${act.initial_qty} (${act.initial_value}) |
      <b>Ejecutado:</b> ${act.executed_qty} (${act.executed_value}) |
      <b>Redistribuido:</b> ${act.redistributed_qty} (${act.redistributed_value}) |
      <b>Pendiente:</b> ${act.remaining_qty} (${act.remaining_value})
    </p>
  `;

  body.innerHTML = "<p>Cargando actas...</p>";
  modal.style.display = "block";

  try {
    const r = await fetch(`${GAS_URL}?fn=actas_by_activity&activity_id=${activityId}`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);

    if (j.rows.length === 0) {
      body.innerHTML = "<p>No hay actas registradas para esta actividad.</p>";
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>N° Acta</th>
            <th>Fecha</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
    `;

    j.rows.forEach(ac => {
      html += `
        <tr>
          <td>${ac.acta_no || ""}</td>
          <td>${ac.acta_date || ""}</td>
          <td style="text-align:left">${ac.notes || ""}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    body.innerHTML = html;

  } catch (e) {
    body.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

// ========================================
// TEST PING
// ========================================
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
