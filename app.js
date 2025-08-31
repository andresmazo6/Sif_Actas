// URL del backend en Apps Script (reemplaza TU_URL cuando lo tengas)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxnFo7CPknrP4dP2URT82T83taMzv4pQ6XUReG0D8kW6DLR4PwC-8VAQGqRHApqTymfaw/exec";

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
 * HELPERS
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
function readAll_(sheetName){
  const headers = CONFIG.SHEETS[sheetName];
  const sh = ensureHeader_(sheetName, headers);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const data = sh.getRange(2,1,last-1,headers.length).getDisplayValues(); // ✅ texto plano
  return data.map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i]])));
}
function append_(sheetName, rec){
  const headers = CONFIG.SHEETS[sheetName];
  const sh = ensureHeader_(sheetName, headers);
  const row = headers.map(h => rec[h] !== undefined ? rec[h] : "");
  sh.appendRow(row);
  return rec;
}
function uuid_(){ return Utilities.getUuid(); }
function toNum(v){ if(!v) return 0; return Number(String(v).replace(/,/g,""))||0; }
function sum(a){ return a.reduce((x,y)=>x+y,0); }
function round2(x){ return Math.round((x+Number.EPSILON)*100)/100; }

/****************************************************
 * ROUTER
 ****************************************************/
function cors_(out){ return out.setMimeType(ContentService.MimeType.JSON); }
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
      case "status": res = statusByActivity_(p); break;
      case "actas_by_activity": res = actasByActivity_(p); break;
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
      case "create_acta": res = createActa_(body.data); break;
      default: res = { ok:false, error:"Función POST desconocida: "+fn };
    }
  } catch(err){ res = { ok:false, error:String(err) }; }
  return cors_(ContentService.createTextOutput(JSON.stringify(res)));
}

/****************************************************
 * CREAR ACTA NUEVA
 ****************************************************/
function createActa_(data){
  // 1. generar id y nro acta
  const actas = readAll_("actas");
  const nextNo = actas.length > 0 ? Math.max(...actas.map(a=>Number(a.acta_no)))+1 : 1;
  const actaId = "ACTA-" + String(nextNo).padStart(2,"0");

  const acta = {
    acta_id: actaId,
    contract_id: data.contract_id,
    acta_no: nextNo,
    acta_date: data.acta_date,
    notes: data.notes || ""
  };
  append_("actas", acta);

  // 2. registrar ejecuciones
  const execs = data.executions || [];
  execs.forEach(e=>{
    const exec = {
      execution_id: uuid_(),
      acta_id: actaId,
      activity_id: e.activity_id,
      qty_executed: e.qty_executed,
      value_executed: round2(toNum(e.qty_executed) * toNum(e.unit_price)),
      comments: e.comments || ""
    };
    append_("executions", exec);
  });

  return { ok:true, acta_id: actaId, acta_no: nextNo, saved_execs: execs.length };
}
