// URL del backend en Apps Script (reemplaza TU_URL cuando lo tengas)
const GAS_URL = "https://script.google.com/macros/s/AKfycby750kQIInqa87YPAXXDlnVXtG_1wfdBaSpAMXdQCePt-3gkupBUCg7HlW4xi_AfwP9sw/exec";
// ========================================
// ========================================
// NAVEGACIÓN ENTRE PESTAÑAS
// ========================================
function showTab(tab) {
  const container = document.getElementById("content");

  if (tab === "consulta") {
    loadActivities();
  } else {
    container.innerHTML = "<p>Selecciona una opción del menú.</p>";
  }
}

// ========================================
// CONSULTA DE ACTIVIDADES
// ========================================
async function loadActivities() {
  const container = document.getElementById("content");
  container.innerHTML = "<p>Cargando actividades...</p>";

  try {
    const r = await fetch(`${GAS_URL}?fn=status`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);

    // Construir tabla HTML
    let html = `
      <h2>Consulta de Actividades</h2>
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
          </tr>
        </thead>
        <tbody>
    `;

    j.rows.forEach(a => {
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
        </tr>
      `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;

  } catch (e) {
    container.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

// ========================================
// TEST DE CONEXIÓN
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
