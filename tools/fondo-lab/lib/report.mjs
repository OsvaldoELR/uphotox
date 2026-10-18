import { writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local HTML report (never published: client photos). Blind comparison:
 * options A/B/C in a different order per photo, vote per photo, reveal at
 * the end. Votes stay in this browser (localStorage) and can be copied.
 * Each voting round has its own vote key and option order.
 */

const ROUND = 2;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Deterministic shuffle per photo so the order survives regenerating
// (Park–Miller generator seeded with the photo id).
const MODULUS = 2_147_483_647;

const seededOrder = (items, seed) => {
  let state =
    [...seed].reduce(
      (hash, char) => (hash * 31 + char.charCodeAt(0)) % MODULUS,
      7
    ) || 1;
  const random = () => {
    state = (state * 48_271) % MODULUS;
    return state / MODULUS;
  };
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

const money = (value) => `$${value.toFixed(3)}`;

const summary = (photos, variants) =>
  Object.entries(variants).map(([id, label]) => {
    // Rejected (reframed) outputs count as failures, not as a 0 score.
    const done = photos
      .map((photo) => photo.results[id])
      .filter((r) => r?.edit.ok && !r.final?.rejected);
    const avg = (pick) =>
      done.length ? done.reduce((sum, r) => sum + pick(r), 0) / done.length : 0;

    return {
      id,
      label,
      done: done.length,
      failed: photos.length - done.length,
      cost: avg((r) => r.edit.cost + (r.review?.cost ?? 0)),
      seconds: avg((r) => r.edit.seconds + (r.final?.seconds ?? 0)),
      score: avg((r) => r.review?.score ?? 0),
    };
  });

const card = (photo, variants) => {
  const order = seededOrder(Object.keys(variants), `${photo.id}:${ROUND}`);
  const letters = ["A", "B", "C", "D", "E"];
  const fixes = photo.analysis.fixes
    .map((fix) => `<li>${escapeHtml(fix)}</li>`)
    .join("");
  const options = order
    .map((variant, index) => {
      const r = photo.results[variant];
      const letter = letters[index];
      const files = `${photo.id}/${r?.base ?? variant}`;

      if (r?.final?.rejected) {
        return `<figure class="option failed" data-variant="${variant}">
          <img alt="Opción ${letter} (rechazada)" loading="lazy" src="${files}-web.jpg">
          <figcaption><b>${letter}</b><span class="muted">Rechazada automáticamente: la IA cambió el encuadre.</span><span class="reveal">${escapeHtml(variants[variant])} · ${money(r.edit.cost)}</span></figcaption>
        </figure>`;
      }

      if (!r?.edit.ok) {
        return `<figure class="option failed" data-variant="${variant}">
          <div class="placeholder">No devolvió imagen</div>
          <figcaption><b>${letter}</b><span class="reveal">${escapeHtml(variants[variant])} · ${escapeHtml(r?.edit.error ?? "")}</span></figcaption>
        </figure>`;
      }

      return `<figure class="option" data-variant="${variant}">
        <img alt="Opción ${letter}" data-final="${files}-web.jpg" data-zones="${files}-zonas.jpg" data-original="${photo.id}/original-web.jpg" loading="lazy" src="${files}-web.jpg">
        <figcaption>
          <b>${letter}</b>
          <button class="vote" data-photo="${photo.id}" data-variant="${variant}" type="button">Me quedo con esta</button>
          <button class="zones" type="button">Ver zonas</button>
          <a href="${files}-final.jpg" target="_blank">Tamaño real</a>
          <span class="reveal"><b>${escapeHtml(variants[variant])}</b> · ${money(r.edit.cost)} · ${r.edit.seconds.toFixed(0)} s · IA en el ${(r.final.changedShare * 100).toFixed(0)} % de la foto<br>
          Revisor IA: <b>${r.review.score}/10</b> · ${escapeHtml(r.review.comment)}</span>
        </figcaption>
      </figure>`;
    })
    .join("");

  return `<section class="photo" id="${photo.id}">
    <header><h2>${escapeHtml(photo.name)}</h2><span>${escapeHtml(photo.analysis.scene)} · dificultad ${escapeHtml(photo.analysis.risk)}</span></header>
    <details><summary>Qué detectó el analista (${photo.analysis.fixes.length})</summary><ul>${fixes}</ul></details>
    <div class="row">
      <figure><img alt="Original" loading="lazy" src="${photo.id}/original-web.jpg"><figcaption><b>Original</b><a href="../sin editar/${escapeHtml(photo.name)}" target="_blank">Tamaño real</a></figcaption></figure>
      <figure><img alt="Tu editor" loading="lazy" src="${photo.id}/editor-web.jpg"><figcaption><b>Tu editor</b><span class="muted">recorte, color y fondo</span></figcaption></figure>
      ${options}
    </div>
  </section>`;
};

export const writeReport = async ({ outDir, photos, variants }) => {
  const rows = summary(photos, variants)
    .map(
      (row) =>
        `<tr data-variant="${row.id}"><td class="reveal-cell">${escapeHtml(row.label)}</td><td>${row.done}/${row.done + row.failed}</td><td>${money(row.cost)}</td><td>${row.seconds.toFixed(0)} s</td><td>${row.score.toFixed(1)}</td><td class="votes">0</td></tr>`
    )
    .join("");
  const total = photos.reduce(
    (sum, photo) =>
      sum +
      (photo.analysis.cost ?? 0) +
      (photo.zones?.cost ?? 0) +
      Object.values(photo.results).reduce(
        (inner, r) =>
          inner + (r.edit.ok ? r.edit.cost + (r.review?.cost ?? 0) : 0),
        0
      ),
    0
  );

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Limpieza de fondos con IA · prueba</title>
<style>
:root { --bg:#f3f7fa; --card:#fff; --ink:#141c2e; --muted:#5b6577; --line:#dfe6ee; --signal:#22d3ee; --signal-ink:#0b6f8a; --flare:#7c5cff; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1680px; margin: 0 auto; padding: 24px 16px 80px; }
h1 { font: 800 28px/1.1 ui-monospace, Consolas, monospace; text-transform: uppercase; letter-spacing: -.01em; margin: 0 0 8px; }
h2 { font: 700 15px ui-monospace, Consolas, monospace; margin: 0; }
.lead { color: var(--muted); max-width: 70ch; }
table { border-collapse: collapse; background: var(--card); border: 1px solid var(--line); margin: 16px 0; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--line); text-align: left; }
th { font: 600 11px ui-monospace, Consolas, monospace; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
.toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin: 8px 0 24px; position: sticky; top: 0; background: var(--bg); padding: 8px 0; z-index: 2; }
button, .toolbar a, figcaption a { font: 700 11px ui-monospace, Consolas, monospace; text-transform: uppercase; letter-spacing: .1em; border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 7px 10px; border-radius: 4px; cursor: pointer; text-decoration: none; }
button.primary { background: var(--signal); border-color: var(--signal); }
.photo { background: var(--card); border: 1px solid var(--line); padding: 16px; margin-bottom: 20px; }
.photo header { display:flex; flex-wrap:wrap; gap: 12px; align-items: baseline; justify-content: space-between; }
.photo header span { color: var(--muted); font-size: 13px; }
details { margin: 8px 0 12px; color: var(--muted); font-size: 13px; }
.row { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
figure { margin: 0; display:flex; flex-direction: column; gap: 8px; }
figure img { width: 100%; height: auto; display:block; border: 1px solid var(--line); background: #e9eef3; cursor: zoom-in; }
figcaption { display:flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; }
figcaption > b { font: 800 14px ui-monospace, Consolas, monospace; margin-right: 4px; }
.muted { color: var(--muted); }
.option.chosen img { outline: 3px solid var(--signal); outline-offset: 2px; }
.option.chosen .vote { background: var(--signal); border-color: var(--signal); }
.reveal, .reveal-cell { display: none; }
body.revealed .reveal { display: block; width: 100%; color: var(--muted); }
body.revealed .reveal-cell { display: table-cell; }
body:not(.revealed) td.hidden-label::before { content: "?"; }
.placeholder { aspect-ratio: 2/3; display:grid; place-items:center; border: 1px dashed var(--line); color: var(--muted); }
#export { width: 100%; min-height: 120px; font: 12px ui-monospace, Consolas, monospace; display: none; margin-top: 8px; }
body.revealed #export { display: block; }
</style></head>
<body><main>
<h1>Limpieza de fondos con IA · ronda ${ROUND}</h1>
<p class="lead">${photos.length} fotos del estudio · ${Object.keys(variants).length} modelos. En cada foto hay tres opciones (A, B, C) en un orden distinto cada vez; no sabes qué modelo es cada una. Pulsa <b>«Me quedo con esta»</b> en la mejor. <b>Mantén pulsada una imagen</b> para ver la original en el mismo sitio, <b>«Ver zonas»</b> marca en azul dónde actuó la IA y <b>«Tamaño real»</b> abre la foto completa (40 MP) para mirar detalles. La cara y el cuerpo de las personas nunca vienen de la IA; ahora el resto del fondo viene entero de la IA (salvo los decorados), sin parches por zonas. Cuando termines, pulsa <b>«Revelar modelos»</b>.</p>
<table><thead><tr><th class="reveal-cell">Modelo</th><th>Fotos</th><th>Coste por foto</th><th>Tiempo por foto</th><th>Nota revisor IA</th><th>Tus votos</th></tr></thead><tbody>${rows}</tbody></table>
<p class="lead">Coste total de esta prueba (análisis, zonas, edición y revisión): <b>${money(total)}</b>.</p>
<div class="toolbar"><button class="primary" id="reveal" type="button">Revelar modelos</button><button id="reset" type="button">Borrar mis votos</button><span class="muted" id="count"></span></div>
<textarea id="export" readonly></textarea>
${photos.map((photo) => card(photo, variants)).join("\n")}
</main>
<script>
const KEY = "fondo-lab-votos-${ROUND}";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const save = (votes) => { try { localStorage.setItem(KEY, JSON.stringify(votes)); } catch {} };
const render = () => {
  const votes = load();
  document.querySelectorAll(".option").forEach((el) => {
    const photo = el.closest(".photo").id;
    el.classList.toggle("chosen", votes[photo] === el.dataset.variant);
  });
  const tally = {};
  Object.values(votes).forEach((v) => { tally[v] = (tally[v] || 0) + 1; });
  document.querySelectorAll("tr[data-variant]").forEach((tr) => { tr.querySelector(".votes").textContent = tally[tr.dataset.variant] || 0; });
  document.getElementById("count").textContent = Object.keys(votes).length + " de ${photos.length} fotos votadas";
  document.getElementById("export").value = "Votos: " + JSON.stringify(votes);
};
document.addEventListener("click", (event) => {
  const vote = event.target.closest(".vote");
  if (vote) { const votes = load(); votes[vote.dataset.photo] = vote.dataset.variant; save(votes); render(); }
  const zones = event.target.closest(".zones");
  if (zones) { const img = zones.closest("figure").querySelector("img"); const on = img.src.endsWith(img.dataset.zones); img.src = on ? img.dataset.final : img.dataset.zones; zones.textContent = on ? "Ver zonas" : "Ocultar zonas"; }
  if (event.target.id === "reveal") { document.body.classList.toggle("revealed"); event.target.textContent = document.body.classList.contains("revealed") ? "Ocultar modelos" : "Revelar modelos"; }
  if (event.target.id === "reset") { save({}); render(); }
  if (event.target.matches("img[data-final]") && !event.target.dataset.held) { window.open(event.target.dataset.final.replace("-web.jpg", "-final.jpg"), "_blank"); }
});
// Hold to compare with the original.
document.querySelectorAll("img[data-original]").forEach((img) => {
  let timer;
  const show = () => { img.dataset.held = "1"; img.dataset.back = img.src; img.src = img.dataset.original; };
  const hide = () => { clearTimeout(timer); if (img.dataset.back) { img.src = img.dataset.back; delete img.dataset.back; setTimeout(() => delete img.dataset.held, 50); } };
  img.addEventListener("pointerdown", () => { timer = setTimeout(show, 250); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((e) => img.addEventListener(e, hide));
  img.addEventListener("contextmenu", (e) => e.preventDefault());
});
render();
</script>
</body></html>`;

  const file = path.join(outDir, "informe.html");
  await writeFile(file, html);
  return file;
};
