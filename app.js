// URL del backend en Apps Script (reemplaza TU_URL cuando lo tengas)
const GAS_URL = "https://script.google.com/macros/s/AKfycbw8fJbOEeW7nt4gPsuaUa3cX2fSIx0f7m6L10EIbyLNd2PGRgW-9pvCFQB6bM_gJLC1Hw/exec";


// ==========================================
// RENDER PRINCIPAL
// ==========================================
async function renderMain(tab){
  const main = document.getElementById("main");
  if(tab==="actividades") return renderActividades(main);
  if(tab==="nueva_acta") return renderNuevaActa(main);
  if(tab==="ping") return renderPing(main);
  main.innerHTML = "<p>Seleccione una pestaña.</p>";
}

// ==========================================
// CONSULTA DE ACTIVIDADES
// ==========================================
async function renderActividades(main){
  main.innerHTML = "<h2>Consulta de Actividades</h2><p>Cargando...</p>";
  try{
    const resp = await fetch(`${GAS_URL}?fn=status`);
    const j = await resp.json();
    if(!j.ok){ main.innerHTML="<p>Error cargando actividades</p>"; return; }

    let html = `<table class="data"><thead>
      <tr>
        <th>#</th><th>Contrato</th><th>Ítem</th><th>Descripción</th>
        <th>Unidad</th><th>Cant. Inicial</th><th>Valor Inicial</th>
        <th>Cant. Ejecutada</th><th>Valor Ejecutado</th>
        <th>Redistrib. Cant.</th><th>Redistrib. Valor</th>
        <th>Pendiente Cant.</th><th>Pendiente Valor</th>
        <th>Últ. Acta</th><th>Fecha Últ. Acta</th>
      </tr></thead><tbody>`;
    j.rows.forEach((r,i)=>{
      html += `<tr>
        <td>${i+1}</td>
        <td>${r.contract_id}</td>
        <td>${r.item_code}</td>
        <td>${r.description}</td>
        <td>${r.unit}</td>
        <td>${r.initial_qty}</td>
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

// ==========================================
// NUEVA ACTA DE PAGO
// ==========================================
async function renderNuevaActa(main){
  main.innerHTML = `
    <h2>Nueva Acta de Pago</h2>
    <div>
      Contrato: <input id="acta-contract" value="C-001" />
      Consecutivo: <span id="acta-next">?</span>
      Fecha: <input id="acta-date" type="date" />
    </div>
    <button onclick="cargarActividadesNuevaActa()">Cargar actividades</button>
    <button onclick="guardarNuevaActa()">Guardar Acta</button>
    <table class="data" id="tabla-acta">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Asignada</th>
          <th>Ejecutada</th>
          <th>Pendiente</th>
          <th>Cant. a ejecutar</th>
          <th>Nuevo Pendiente</th>
          <th>Nota</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  // obtener número de la próxima acta
  try {
    const resp = await fetch(`${GAS_URL}?fn=list_actas`);
    const j = await resp.json();
    if(j.ok){
      const next = j.rows.length+1;
      document.getElementById("acta-next").textContent = next;
    }
  } catch(e){
    document.getElementById("acta-next").textContent = "?";
  }
}

async function cargarActividadesNuevaActa(){
  const cid = document.getElementById("acta-contract").value.trim();
  const tbody = document.querySelector("#tabla-acta tbody");
  tbody.innerHTML = "<tr><td colspan='9'>Cargando...</td></tr>";

  try {
    const resp = await fetch(`${GAS_URL}?fn=status&contract_id=${cid}`);
    const j = await resp.json();
    if(!j.ok){ alert("Error cargando actividades"); return; }

    let html = "";
    j.rows.forEach(r=>{
      const asignada = (Number(r.initial_qty)||0) + (Number(r.redistributed_qty)||0);
      const ejecutada = Number(r.executed_qty)||0;
      const pendiente = asignada - ejecutada;

      html += `<tr>
        <td>${r.item_code}</td>
        <td>${r.description}</td>
        <td>${r.unit}</td>
        <td>${asignada}</td>
        <td>${ejecutada}</td>
        <td>${pendiente}</td>
        <td><input type="number" class="qty-input" 
              data-act="${r.activity_id}" data-pend="${pendiente}" value="0" /></td>
        <td class="nuevo-pendiente">${pendiente}</td>
        <td><input type="text" class="nota-input" data-act="${r.activity_id}" placeholder="Nota" /></td>
      </tr>`;
    });
    tbody.innerHTML = html;

    // eventos para recalcular pendiente
    document.querySelectorAll(".qty-input").forEach(inp=>{
      inp.addEventListener("input", e=>{
        const qty = Number(e.target.value)||0;
        const pend = Number(e.target.dataset.pend)||0;
        const nuevo = pend - qty;
        const td = e.target.closest("tr").querySelector(".nuevo-pendiente");
        td.textContent = nuevo;
        if(nuevo<0){
          td.style.color="red";
        } else {
          td.style.color="black";
        }
      });
    });

  } catch(err){
    alert("Error cargando actividades\n"+err);
  }
}

async function guardarNuevaActa(){
  const cid = document.getElementById("acta-contract").value.trim();
  const fecha = document.getElementById("acta-date").value;
  const next = document.getElementById("acta-next").textContent;
  const rows = [];

  let error=false;
  document.querySelectorAll("#tabla-acta tbody tr").forEach(tr=>{
    const qty = Number(tr.querySelector(".qty-input").value)||0;
    const pend = Number(tr.querySelector(".qty-input").dataset.pend)||0;
    const nota = tr.querySelector(".nota-input").value||"";
    const actId = tr.querySelector(".qty-input").dataset.act;
    if(qty>0){
      if(qty>pend){ error=true; tr.style.background="#fdd"; }
      rows.push({ activity_id: actId, qty_executed: qty, comments: nota });
    }
  });
  if(error){ alert("Hay cantidades mayores a lo pendiente. Corrige antes de guardar."); return; }

  const payload = {
    fn:"create_execution",
    contract_id:cid,
    acta_no: next,
    acta_date: fecha,
    data: rows
  };

  try{
    const resp = await fetch(GAS_URL,{
      method:"POST",
      body: JSON.stringify(payload)
    });
    const j = await resp.json();
    if(j.ok){ alert("Acta guardada correctamente"); }
    else{ alert("Error al guardar: "+j.error); }
  }catch(err){
    alert("Error guardando\n"+err);
  }
}

// ==========================================
// PING BACKEND
// ==========================================
async function renderPing(main){
  try{
    const resp = await fetch(`${GAS_URL}?fn=ping`);
    const j = await resp.json();
    main.innerHTML = `<pre>${JSON.stringify(j,null,2)}</pre>`;
  } catch(err){
    main.innerHTML = `<p style="color:red;">Error: ${err}</p>`;
  }
}
