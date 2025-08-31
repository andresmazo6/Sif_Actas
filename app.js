// URL del backend en Apps Script (reemplaza TU_URL cuando lo tengas)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxnFo7CPknrP4dP2URT82T83taMzv4pQ6XUReG0D8kW6DLR4PwC-8VAQGqRHApqTymfaw/exec";

// ROUTER DE PESTAÑAS
// =========================
function showTab(tab){
  const main = document.getElementById("main");
  if(tab==="nueva_acta"){ renderNuevaActa(main); return; }
  if(tab==="actividades"){ renderActividades(main); return; }
  if(tab==="ping"){ pingBackend(main); return; }
  main.innerHTML = "<p>Seleccione una pestaña</p>";
}

// =========================
// PING BACKEND
// =========================
async function pingBackend(main){
  main.innerHTML = "<p>Conectando...</p>";
  try{
    const resp = await fetch(`${GAS_URL}?fn=ping`);
    const j = await resp.json();
    main.innerHTML = `<pre>${JSON.stringify(j,null,2)}</pre>`;
  } catch(err){
    main.innerHTML = `<p style="color:red;">Error: ${err}</p>`;
  }
}

// =========================
// CONSULTA DE ACTIVIDADES
// =========================
async function renderActividades(main){
  main.innerHTML = "<h2>Consulta de Actividades</h2><p>Cargando...</p>";
  try{
    const resp = await fetch(`${GAS_URL}?fn=status`);
    const j = await resp.json();
    if(!j.ok){ main.innerHTML="<p>Error cargando actividades</p>"; return; }

    let html = `<table class="data sticky"><thead>
      <tr>
        <th>#</th><th>Contrato</th><th>Ítem</th><th>Descripción</th>
        <th>Unidad</th><th>Asignada</th><th>Valor Inicial</th>
        <th>Ejecutada</th><th>Valor Ejecutado</th>
        <th>Redistrib. Cant.</th><th>Redistrib. Valor</th>
        <th>Pendiente Cant.</th><th>Pendiente Valor</th>
        <th>Últ. Acta</th><th>Fecha Últ. Acta</th>
      </tr></thead><tbody>`;
    j.rows.forEach((r,i)=>{
      const asignada = Number(r.initial_qty) + Number(r.redistributed_qty);
      html += `<tr>
        <td>${i+1}</td>
        <td>${r.contract_id}</td>
        <td>${r.item_code}</td>
        <td>${r.description}</td>
        <td>${r.unit}</td>
        <td>${asignada}</td>
        <td>${r.initial_value}</td>
        <td>${r.executed_qty}</td>
        <td>${r.executed_value}</td>
        <td>${r.redistributed_qty}</td>
        <td>${r.redistributed_value}</td>
        <td>${r.remaining_qty}</td>
        <td>${r.remaining_value}</td>
        <td>${r.last_acta_no||""}</td>
        <td>${r.last_acta_date||""}</td>
      </tr>`;
    });
    html += "</tbody></table>";
    main.innerHTML = html;
  } catch(err){
    main.innerHTML = `<p style="color:red;">Error: ${err}</p>`;
  }
}

// =========================
// NUEVA ACTA DE PAGO
// =========================
async function renderNuevaActa(main){
  main.innerHTML = `<h2>Nueva Acta de Pago</h2>
    <div class="form">
      <label>Contrato: <input id="contrato" value="C-001"></label>
      <label>Fecha: <input id="fecha" type="date"></label>
      <label>Notas: <input id="notas" type="text"></label>
    </div>
    <button class="btn-primario" onclick="loadActividadesForm()">Cargar actividades</button>
    <div id="detalle"></div>
    <button class="btn-primario" onclick="guardarActa()">Guardar Acta</button>
  `;
}

// cargar actividades en el formulario de acta
async function loadActividadesForm(){
  const contrato = document.getElementById("contrato").value;
  const resp = await fetch(`${GAS_URL}?fn=status&contract_id=${contrato}`);
  const j = await resp.json();
  if(!j.ok){ alert("Error cargando actividades"); return; }

  const acts = j.rows;
  let html = `<table class="data sticky"><thead>
    <tr>
      <th>Ítem</th><th>Descripción</th><th>Unidad</th>
      <th>Asignada</th><th>Ejecutada</th><th>Pendiente</th>
      <th>Valor Unitario</th>
      <th>Cant. Ejecutada (nueva)</th><th>Valor Ejecutado</th>
      <th>Nuevo Acumulado</th>
    </tr></thead><tbody>`;

  acts.forEach(a=>{
    const asignada = (Number(a.initial_qty) + Number(a.redistributed_qty));
    const ejecutada = Number(a.executed_qty);
    const pendiente = Number(a.remaining_qty);

    html += `<tr data-activity="${a.activity_id}" data-unitprice="${a.unit_price}" data-ejecutada="${ejecutada}">
      <td>${a.item_code}</td>
      <td>${a.description}</td>
      <td>${a.unit}</td>
      <td>${asignada}</td>
      <td>${ejecutada}</td>
      <td>${pendiente}</td>
      <td>${a.unit_price}</td>
      <td><input type="number" min="0" max="${pendiente}" step="any" class="qty"></td>
      <td class="val">0</td>
      <td class="nuevo">${ejecutada}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("detalle").innerHTML = html;

  // recalcular valor y nuevo acumulado al digitar
  document.querySelectorAll(".qty").forEach(inp=>{
    inp.addEventListener("input",()=>{
      const tr = inp.closest("tr");
      const price = Number(tr.dataset.unitprice)||0;
      const ejecutadaPrev = Number(tr.dataset.ejecutada)||0;
      const q = Number(inp.value)||0;

      // valor ejecutado en esta acta
      tr.querySelector(".val").textContent = (q*price).toFixed(2);
      // nuevo acumulado = ejecutada previa + lo nuevo
      tr.querySelector(".nuevo").textContent = (ejecutadaPrev+q).toFixed(2);
    });
  });
}

// guardar acta
async function guardarActa(){
  const contrato = document.getElementById("contrato").value;
  const fecha = document.getElementById("fecha").value;
  const notas = document.getElementById("notas").value;

  const rows = [];
  document.querySelectorAll("#detalle tbody tr").forEach(tr=>{
    const q = Number(tr.querySelector(".qty").value)||0;
    if(q>0){
      rows.push({
        activity_id: tr.dataset.activity,
        qty_executed: q,
        unit_price: Number(tr.dataset.unitprice)
      });
    }
  });

  if(rows.length===0){
    alert("Debe ingresar al menos una actividad ejecutada");
    return;
  }

  const body = {
    fn: "create_acta",
    data: { contract_id: contrato, acta_date: fecha, notes: notas, executions: rows }
  };

  try{
    const resp = await fetch(GAS_URL,{
      method:"POST",
      body: JSON.stringify(body)
    });
    const j = await resp.json();
    if(j.ok){
      alert("✅ Acta creada: "+j.acta_id+" con "+j.saved_execs+" ejecuciones");
      showTab("actividades");
    } else {
      alert("Error: "+j.error);
    }
  } catch(err){
    alert("Error en conexión: "+err);
  }
}
