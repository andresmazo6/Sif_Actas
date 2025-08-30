/****************************************************
 * CONFIGURACIÓN GENERAL
 ****************************************************/
const CONFIG = {
  SHEETS: {
    contracts: ["contract_id","name","description","start_date","end_date","currency","status"],
    activities: ["activity_id","contract_id","item_code","group_name","description","unit","initial_qty","unit_price","active"],
    actas: ["acta_id","contract_id","acta_no","acta_date","notes"],
    executions: ["execution_id","acta_id","activity_id","qty_executed","value_executed","comments"],
    redistributions: ["redist_id","contract_id","activity_id","date","type","qty_delta","value_delta","notes"],
    roles: ["user_email","role","display_name","active"],
    v_activity_status: [
      "contract_id","activity_id","item_code","description","unit","unit_price",
      "initial_qty","initial_value","executed_qty","executed_value",
      "redistributed_qty","redistributed_value","remaining_qty","remaining_value",
      "last_acta_no","last_acta_date","group_name"
    ]
  }
};

/****************************************************
 * HELPERS BÁSICOS
 ****************************************************/
function getSS(){ return SpreadsheetApp.getActive(); }

function getSheet(name){
  const ss = getSS();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureHeader_(sheetName, headers){
  const sh = getSheet(sheetName);
  const current = sh.getRange(1,1,1,headers.length).getValues()[0];
  if (JSON.stringify(current) !== JSON.stringify(headers)){
    sh.clear();
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function bootstrap(){
  Object.entries(CONFIG.SHEETS).forEach(([n,h]) => ensureHeader_(n,h));
  return { ok:true, msg:"Bootstrap listo" };
}

function readAll_(sheetName){
  const headers = CONFIG.SHEETS[sheetName];
  const sh = ensureHeader_(sheetName, headers);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const data = sh.getRange(2,1,last-1,headers.length).getValues();
  return data.map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i]])));
}

function append_(sheetName, rec){
  const headers = CONFIG.SHEETS[sheetName];
  const sh = ensureHeader_(sheetName, headers);
  const row = headers.map(h => rec[h] ?? "");
  sh.appendRow(row);
  return rec;
}

function update_(sheetName, keyField, rec){
  const headers = CONFIG.SHEETS[sheetName];
  const sh = ensureHeader_(sheetName, headers);
  const colIdx = headers.indexOf(keyField)+1;
  const vals = sh.getRange(2,colIdx,sh.getLastRow()-1,1).getValues().flat();
  const pos = vals.findIndex(v => String(v)===String(rec[keyField]));
  if (pos===-1) throw new Error("No se encontró "+keyField+"="+rec[keyField]);
  const row = pos+2;
  const values = headers.map(h => rec[h] ?? "");
  sh.getRange(row,1,1,headers.length).setValues([values]);
  return rec;
}

function remove_(sheetName, keyField, keyValue){
  const headers = CONFIG.SHEETS[sheetName];
  const sh = ensureHeader_(sheetName, headers);
  const colIdx = headers.indexOf(keyField)+1;
  const vals = sh.getRange(2,colIdx,sh.getLastRow()-1,1).getValues().flat();
  const pos = vals.findIndex(v => String(v)===String(keyValue));
  if (pos===-1) throw new Error("No existe "+keyField+"="+keyValue);
  sh.deleteRow(pos+2);
  return { ok:true };
}

function uuid_(){ return Utilities.getUuid(); }
function toNum(v){ if(!v) return 0; return Number(String(v).replace(/,/g,""))||0; }
function sum(a){ return a.reduce((x,y)=>x+y,0); }
function round2(x){ return Math.round((x+Number.EPSILON)*100)/100; }

/****************************************************
 * SEGURIDAD BÁSICA CON ROLES
 ****************************************************/
function getUserEmail_(){
  try { return Session.getActiveUser().getEmail() || ""; }
  catch(e){ return ""; }
}
function hasRole_(email, roles){
  const rows = readAll_("roles");
  const reg = rows.find(r => 
    String(r.user_email).toLowerCase() === String(email).toLowerCase() &&
    String(r.active).toLowerCase() !== "false"
  );
  if (!reg) return false;
  return roles.includes(String(reg.role).toLowerCase());
}
function requireRoleOrThrow_(roles){
  const email = getUserEmail_();
  if (!hasRole_(email, roles)) throw new Error("No autorizado");
  return email;
}

/****************************************************
 * ROUTER WEBAPP
 ****************************************************/
function cors_(out){
  return out.setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin","*")
    .setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers","Content-Type");
}
function doOptions(e){ return cors_(ContentService.createTextOutput("")); }

function doGet(e){
  const p = e.parameter||{};
  const fn = (p.fn||"ping").toLowerCase();
  let res;
  try{
    switch(fn){
      case "ping": res = { ok:true, now:new Date().toISOString() }; break;
      case "list_activities": res = { ok:true, rows: readAll_("activities") }; break;
      case "list_actas": res = { ok:true, rows: readAll_("actas") }; break;
      case "list_executions": res = { ok:true, rows: readAll_("executions") }; break;
      case "list_redistributions": res = { ok:true, rows: readAll_("redistributions") }; break;
      case "status": res = statusByActivity_(p); break;
      case "contract_status": res = contractStatus_(p); break;
      case "whoami": res = { ok:true, email:getUserEmail_() }; break;
      default: res = { ok:false, error:"Función desconocida: "+fn };
    }
  } catch(err){ res = { ok:false, error:String(err) }; }
  return cors_(ContentService.createTextOutput(JSON.stringify(res)));
}

function doPost(e){
  const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  const fn = (body.fn||"").toLowerCase();
  let res;
  try{
    switch(fn){
      case "create_execution": res = createExecution_(body); break;
      case "update_execution": res = updateExecution_(body); break;
      case "delete_execution": res = deleteExecution_(body); break;
      case "create_redist": res = createRedist_(body); break;
      case "update_redist": res = updateRedist_(body); break;
      case "delete_redist": res = deleteRedist_(body); break;
      default: res = { ok:false, error:"Función POST desconocida: "+fn };
    }
  } catch(err){ res = { ok:false, error:String(err) }; }
  return cors_(ContentService.createTextOutput(JSON.stringify(res)));
}

/****************************************************
 * CÁLCULOS DE ESTADO
 ****************************************************/
function statusByActivity_(p){
  const cid = p.contract_id || "";
  const acts = readAll_("activities").filter(a => !cid || a.contract_id===cid);
  const execs = readAll_("executions");
  const reds  = readAll_("redistributions");

  const execByAct = {};
  execs.forEach(e => {
    if (!execByAct[e.activity_id]) execByAct[e.activity_id] = [];
    execByAct[e.activity_id].push(e);
  });

  const redByAct = {};
  reds.forEach(r => {
    if (!redByAct[r.activity_id]) redByAct[r.activity_id] = [];
    redByAct[r.activity_id].push(r);
  });

  const out = acts.map(a=>{
    const unit_price = toNum(a.unit_price);
    const init_qty = toNum(a.initial_qty);
    const init_val = init_qty*unit_price;

    const E = execByAct[a.activity_id]||[];
    const R = redByAct[a.activity_id]||[];

    const exec_qty = sum(E.map(x=>toNum(x.qty_executed)));
    const exec_val = sum(E.map(x=>toNum(x.value_executed)));

    const red_qty = sum(R.map(x=>toNum(x.qty_delta)));
    const red_val = sum(R.map(x=>toNum(x.value_delta)));

    return {
      contract_id:a.contract_id,
      activity_id:a.activity_id,
      item_code:a.item_code,
      description:a.description,
      unit:a.unit,
      unit_price:unit_price,
      initial_qty:init_qty,
      initial_value:round2(init_val),
      executed_qty:round2(exec_qty),
      executed_value:round2(exec_val),
      redistributed_qty:round2(red_qty),
      redistributed_value:round2(red_val),
      remaining_qty:round2((init_qty+red_qty)-exec_qty),
      remaining_value:round2((init_val+red_val)-exec_val)
    };
  });

  return { ok:true, rows:out };
}

function contractStatus_(p){
  const st = statusByActivity_(p);
  if (!st.ok) return st;
  const totInit = sum(st.rows.map(r=>toNum(r.initial_value)));
  const totExec = sum(st.rows.map(r=>toNum(r.executed_value)));
  const totRedV = sum(st.rows.map(r=>toNum(r.redistributed_value)));
  return {
    ok:true,
    contract_id:p.contract_id||"",
    initial_value:round2(totInit),
    executed_value:round2(totExec),
    redistributed_value:round2(totRedV),
    remaining_value:round2((totInit+totRedV)-totExec)
  };
}

/****************************************************
 * MUTACIONES (con roles)
 ****************************************************/
function createExecution_(pay){
  requireRoleOrThrow_(["admin","editor"]);
  const rec = pay.data||{};
  if (!rec.execution_id) rec.execution_id = uuid_();
  return { ok:true, data: append_("executions", rec) };
}
function updateExecution_(pay){
  requireRoleOrThrow_(["admin","editor"]);
  const rec = pay.data||{};
  if (!rec.execution_id) throw new Error("execution_id requerido");
  return { ok:true, data: update_("executions","execution_id",rec) };
}
function deleteExecution_(pay){
  requireRoleOrThrow_(["admin"]);
  const id = pay.execution_id;
  if (!id) throw new Error("execution_id requerido");
  return remove_("executions","execution_id",id);
}

function createRedist_(pay){
  requireRoleOrThrow_(["admin"]);
  const rec = pay.data||{};
  if (!rec.redist_id) rec.redist_id = uuid_();
  return { ok:true, data: append_("redistributions", rec) };
}
function updateRedist_(pay){
  requireRoleOrThrow_(["admin"]);
  const rec = pay.data||{};
  if (!rec.redist_id) throw new Error("redist_id requerido");
  return { ok:true, data: update_("redistributions","redist_id",rec) };
}
function deleteRedist_(pay){
  requireRoleOrThrow_(["admin"]);
  const id = pay.redist_id;
  if (!id) throw new Error("redist_id requerido");
  return remove_("redistributions","redist_id",id);
}
