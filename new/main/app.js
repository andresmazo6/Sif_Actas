// URL del backend en Apps Script (reemplaza TU_URL cuando lo tengas)
const GAS_URL = "https://script.google.com/macros/s/TU_URL/exec";

async function testPing() {
  try {
    const r = await fetch(`${GAS_URL}?fn=ping`);
    const j = await r.json();
    document.getElementById("output").textContent = JSON.stringify(j, null, 2);
  } catch (e) {
    document.getElementById("output").textContent = "Error: " + e;
  }
}
