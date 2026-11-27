// Başlanğıc, klik və əsas dövr.
import { THREE, renderer, labelRenderer, scene, camera, controls } from './kit.js';
import { screenMeshes } from './office.js';
import { AGENTS, timers, hitboxes } from './agents.js';
import { flush, loadAll } from './monitors.js';
import { drawDash, drawKanban, tickKPI, callMeeting, meeting, camp, followCampaign, resumeLink } from './scenarios.js';
import { select, deselect, log, refreshPanels, updateNear, simSpeed, stepCamera, openComputer, stopFollow } from './ui.js';
import { rand, pick, esc, clock } from './util.js';
import { WORLD } from '../team.js';
import { live } from '../live.js';
import { openBook, bookSeen } from '../book.js';

/* ---------------- klik: personaj və ya monitor ---------------- */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function pick3d(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects([...hitboxes, ...screenMeshes], false)[0];
  if (!hit) return null;
  if (hit.object.userData.agent) return { agent: hit.object.userData.agent };
  return { agent: AGENTS.find(a => a.id === hit.object.userData.agentId), screen: true };
}
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const h = pick3d(e);
  if (!h) { deselect(); return; }
  select(h.agent, true);
  if (h.screen) openComputer(h.agent);
});
let hoverT = 0;
renderer.domElement.addEventListener('pointermove', e => {
  const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
  renderer.domElement.style.cursor = pick3d(e) ? 'pointer' : 'grab';
});

/* ---------------- başlanğıc ---------------- */
drawDash(); drawKanban(true);
for (const a of AGENTS) {
  a.run(async () => {
    a.task = pick(a.def.tasks); a.status = 'work'; a.anim = 'type'; a.say(a.task);
    await a.sleep(rand(2, 14), true);
  }, 'free');
}
log(null, `Saat 09:00. ${esc(WORLD.company)} açıldı, komanda masalarına keçir.`);
live.sub('campaign', ({ phase, campaignId, name, from }) => {
  if (phase !== 'rejoin' || camp.cur) return;
  log(null, `<b>«${esc(name)}»</b> kampaniyası gedir, ${from + 1}-ci addımdan izləyirik`);
  followCampaign(campaignId, name, from);
});
live.init().then(async () => {
  if (live.mode === 'live') log(null, 'Canlı rejim: tapşırıqlar personajların kompüterində real agentlə gedir.');
  else if (live.mode === 'mock') log(null, 'Demo rejim: server işləyir, model çağırılmır.');
  if (!live.on) return;
  loadAll();
  const last = (await live.campaigns().catch(() => []))[0];
  if (last && ['interrupted', 'error'].includes(last.status))
    log(null, `<b>«${esc(last.name)}»</b> ${last.steps.length}/${last.total} addımda yarımçıq qalıb. ${resumeLink(last.id, last.name)}`);
});
if (!bookSeen()) setTimeout(() => openBook('xos'), 900);

/* ---------------- dövr ---------------- */
const clk = new THREE.Clock();
let uiT = 0, kpiT = 0, kanT = 0, nextMeet = 55, simT = 0, nearT = 0;
setTimeout(() => { const l = document.getElementById('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 400); }, 150);

function animate() {
  requestAnimationFrame(animate);
  const rdt = Math.min(clk.getDelta(), 0.1), dt = rdt * simSpeed;
  simT += dt; clock.min += dt;
  if (clock.min >= 19 * 60) { clock.min = 9 * 60; log(null, 'Saat 19:00, iş günü bitdi. Növbəti səhər hamı yenidən masasındadır.'); }
  for (const tm of timers) {
    tm.t -= dt;
    if (tm.t <= 0) { timers.delete(tm); if (tm.agent && tm.agent.progTimer === tm) tm.agent.progTimer = null; tm.res(); }
  }
  for (const a of AGENTS) a.update(dt);
  if (simT > nextMeet) { nextMeet = simT + rand(140, 200); if (!meeting && !camp.cur) callMeeting(); }
  stepCamera(rdt);
  nearT += rdt; if (nearT > 0.25) { nearT = 0; updateNear(); }
  uiT += rdt; if (uiT > 0.4) { uiT = 0; refreshPanels(); document.body.classList.toggle('far', camera.position.distanceTo(controls.target) > 44); }
  kpiT += dt; if (kpiT > 2) { kpiT = 0; tickKPI(); }
  kanT += rdt; if (kanT > 1.5) { kanT = 0; drawKanban(); }
  flush();
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();
