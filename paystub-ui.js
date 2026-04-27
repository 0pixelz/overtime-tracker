// paystub-ui.js
// Page Calendrier de paie hebdomadaire injectee sous le header.
(() => {
  const REGULAR_PAY_LIMIT = 40;
  const MAX_VALID_DEDUCTION_RATE = 0.75;
  const $ = (id) => document.getElementById(id);
  const money = (v) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  const hrs = (v) => Number(v || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
  const pct = (v) => v == null || Number.isNaN(Number(v)) ? '—' : (Number(v) * 100).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';

  function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
  function validRate(v) { const n = Number(v); return Number.isFinite(n) && n > 0 && n < MAX_VALID_DEDUCTION_RATE ? n : 0; }
  function entries() {
    for (const k of ['heuressup.v1', 'heuresData', 'entries', 'timeEntries']) {
      const v = readJson(k);
      if (v && typeof v === 'object' && Object.keys(v).length) return v;
    }
    return {};
  }
  function dkey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function weekStart(){ const d=new Date(); d.setHours(0,0,0,0); const day=d.getDay(); d.setDate(d.getDate()+(day===0?-6:1-day)); return d; }
  function fmt(d){ return d.toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric'}); }
  function entryHours(e){
    if (!e || e.type === 'leave') return 0;
    const direct = Number(e.hours || e.totalHours || e.total || e.duration || 0);
    if (direct > 0) return direct;
    const start = e.start || e.startTime || e.debut;
    const end = e.end || e.endTime || e.fin;
    if (!start || !end) return 0;
    const [sh,sm=0]=String(start).split(':').map(Number), [eh,em=0]=String(end).split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return 0;
    let a=sh*60+sm, b=eh*60+em; if (b<a) b+=1440;
    return Math.max(0,(b-a-Number(e.meal||e.mealMinutes||e.pause||0))/60);
  }
  function splitHours(totalHours){
    const worked = Math.max(0, Number(totalHours || 0));
    return { worked, regular: Math.min(worked, REGULAR_PAY_LIMIT), overtime: Math.max(0, worked - REGULAR_PAY_LIMIT), threshold: REGULAR_PAY_LIMIT };
  }
  function summary(){
    const e=entries(), start=weekStart(), end=addDays(start,6); let worked=0;
    for(let i=0;i<7;i++) worked += entryHours(e[dkey(addDays(start,i))]);
    return { start,end,...splitHours(worked) };
  }
  function profile(){ return readJson('paystubProfile'); }
  function rate(p){ const m=Number(localStorage.getItem('payrollHourlyRate')||0); if(m>0)return m; if(p.hourlyRate)return Number(p.hourlyRate); if(p.grossPay&&p.regularHours)return Number(p.grossPay)/Number(p.regularHours); if(p.grossPay)return Number(p.grossPay)/REGULAR_PAY_LIMIT; return 0; }
  function deductionRate(p){
    const saved = validRate(localStorage.getItem('payrollDeductionRate'));
    if (saved) return saved;
    return validRate(p.deductionRate);
  }
  function repairInvalidRates(){
    const saved = Number(localStorage.getItem('payrollDeductionRate') || 0);
    const p = profile();
    const profileRate = validRate(p.deductionRate);
    if (saved >= MAX_VALID_DEDUCTION_RATE && profileRate) localStorage.setItem('payrollDeductionRate', String(profileRate));
    if (saved >= MAX_VALID_DEDUCTION_RATE && !profileRate) localStorage.removeItem('payrollDeductionRate');
  }
  function estimateFromHours(totalHours){
    const p=profile(), r=rate(p), dr=deductionRate(p), s=splitHours(totalHours);
    const gross=r>0?s.regular*r+s.overtime*r*1.5:null;
    const ded=gross!=null&&dr>0?gross*dr:null;
    const net=gross!=null&&ded!=null?gross-ded:null;
    return {s,p,r,dr,gross,ded,net};
  }
  function estimate(){ const base=estimateFromHours(summary().worked); base.s={...summary(),...base.s}; return base; }
  function deleteImportedPaystub(){
    localStorage.removeItem('paystubProfile');
    localStorage.removeItem('payrollDeductionRate');
    localStorage.removeItem('payrollHourlyRate');
    const r=$('payHourlyRateInput'), d=$('payDeductionRateInput'), status=$('paystubImportStatus');
    if(r) r.value='';
    if(d) d.value='';
    if(status) status.textContent='PDF supprimé. Tu peux importer un nouveau talon de paie.';
    render();
  }

  function styles(){
    if ($('payrollStyles')) return;
    const s=document.createElement('style'); s.id='payrollStyles';
    s.textContent = `#payrollView{display:none}#payrollView.show{display:block}.payroll-hidden{display:none!important}.payroll-title{font-family:var(--font-display);font-style:italic;font-size:34px;line-height:1}.payroll-sub{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin:8px 0 18px}.payroll-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.payroll-card{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:16px}.payroll-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin-bottom:8px}.payroll-value{font-family:var(--font-display);font-style:italic;font-size:32px;color:var(--accent-text);line-height:1}.payroll-note{font-size:12px;color:var(--text-dim);margin-top:8px}.payroll-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px dashed var(--border)}.payroll-row:last-child{border-bottom:0}.payroll-row span{color:var(--text-dim);font-size:13px}.payroll-row strong{font-family:var(--font-mono);font-size:14px;text-align:right}.payroll-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.payroll-inputs input{width:100%;background:var(--bg-elev-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;color:var(--text);font-family:var(--font-mono)}.payroll-import{display:block;width:100%;padding:14px;border:1px dashed var(--border-strong);border-radius:var(--radius-sm);background:var(--bg-elev-2);color:var(--text);text-align:center;cursor:pointer}.payroll-link{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:12px;padding:13px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--accent-soft);color:var(--accent-text);text-decoration:none;font-size:13px;font-weight:600}.payroll-link:active{transform:scale(.99)}.manual-estimate-card{border-color:var(--accent);background:linear-gradient(180deg,var(--bg-elev),var(--bg-elev-2))}.manual-estimate-results{margin-top:14px}.payroll-profile-actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.payroll-delete-btn{border:1px solid rgba(229,107,107,.45);background:rgba(229,107,107,.08);color:var(--danger);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}.payroll-delete-btn:active{transform:scale(.97)}@media(max-width:430px){.payroll-grid,.payroll-inputs{grid-template-columns:1fr}.payroll-title{font-size:30px}.payroll-profile-actions{justify-content:flex-start}.payroll-delete-btn{width:100%;border-radius:var(--radius-sm);padding:10px}}`;
    document.head.appendChild(s);
  }
  function view(){
    if ($('payrollView')) return;
    const v=document.createElement('main'); v.id='payrollView';
    v.innerHTML = `<div class="payroll-title">Calendrier de paie</div><div class="payroll-sub">Paie hebdomadaire estimée</div><div class="card"><div class="card-label">Semaine de paie</div><div class="payroll-row"><span>Période actuelle</span><strong id="payWeekRange">—</strong></div><div class="payroll-row"><span>Heures travaillées</span><strong id="payWorkedHours">0,00 h</strong></div><div class="payroll-row"><span>Heures payées taux 1.0</span><strong id="payRegularHours">0,00 h</strong></div><div class="payroll-row"><span>Heures payées taux 1.5</span><strong id="payOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Seuil taux 1.5</span><strong>Après 40,00 h</strong></div></div><div class="payroll-grid"><div class="payroll-card"><div class="payroll-label">Brut estimé</div><div class="payroll-value" id="payGross">—</div><div class="payroll-note">40 h max à 1.0, surplus à 1.5</div></div><div class="payroll-card"><div class="payroll-label">Net estimé</div><div class="payroll-value" id="payNet">—</div><div class="payroll-note">après retenues</div></div></div><div class="card manual-estimate-card"><div class="card-label">Estimation manuelle</div><div class="payroll-inputs"><div><label class="payroll-label">Nombre d'heures</label><input id="manualHoursInput" type="number" step="0.25" placeholder="ex. 42.50"></div><div><label class="payroll-label">Net estimé</label><input id="manualNetDisplay" type="text" readonly placeholder="—"></div></div><div class="manual-estimate-results"><div class="payroll-row"><span>Heures taux 1.0</span><strong id="manualRegularHours">0,00 h</strong></div><div class="payroll-row"><span>Heures taux 1.5</span><strong id="manualOvertimeHours">0,00 h</strong></div><div class="payroll-row"><span>Brut estimé</span><strong id="manualGross">—</strong></div><div class="payroll-row"><span>Retenues estimées</span><strong id="manualDeductions">—</strong></div><div class="payroll-row"><span>Net estimé</span><strong id="manualNet">—</strong></div></div><div class="payroll-note">Utilise ton taux horaire et ton taux moyen de retenues importés du PDF ou saisis manuellement.</div></div><div class="card"><div class="card-label">Profil de paie</div><div class="payroll-row"><span>Taux horaire</span><strong id="payHourlyRateValue">À configurer</strong></div><div class="payroll-row"><span>Taux moyen de retenues</span><strong id="payDeductionRateValue">À configurer</strong></div><div class="payroll-row"><span>Retenues estimées</span><strong id="payDeductions">—</strong></div><div class="payroll-row"><span>Net PDF importé</span><strong id="payImportedNet">—</strong></div><div class="payroll-row"><span>Profil PDF</span><div class="payroll-profile-actions"><strong id="payImportedProfile">Aucun PDF importé</strong><button id="deletePaystubBtn" class="payroll-delete-btn" type="button">Supprimer</button></div></div><div class="payroll-inputs"><div><label class="payroll-label">Taux horaire</label><input id="payHourlyRateInput" type="number" step="0.01" placeholder="ex. 39.743"></div><div><label class="payroll-label">Retenues %</label><input id="payDeductionRateInput" type="number" step="0.01" placeholder="ex. 33.55"></div></div></div><div class="card"><div class="card-label">Importer une paie PDF</div><label class="payroll-import" for="paystubPdfInput">Importer un talon de paie PDF</label><input id="paystubPdfInput" type="file" accept="application/pdf" hidden><div class="payroll-note" id="paystubImportStatus">Le PDF est analysé localement dans ton navigateur.</div><a class="payroll-link" href="https://relevedepaie.metro.ca/" target="_blank" rel="noopener noreferrer">Ouvrir le site des relevés de paie Metro ↗</a></div>`;
    const header=document.querySelector('header'); if(header) header.insertAdjacentElement('afterend',v); else document.body.prepend(v);
  }
  function contentNodes(){
    const header=document.querySelector('header'); if(!header)return[]; const out=[]; let n=header.nextElementSibling;
    while(n){ const next=n.nextElementSibling; if(!['SCRIPT','STYLE'].includes(n.tagName)&&n.id!=='payrollView'&&!n.classList.contains('sheet')&&!n.classList.contains('sheet-backdrop')&&n.id!=='sideMenu'&&n.id!=='sideBackdrop') out.push(n); n=next; }
    return out;
  }
  function renderManualEstimate(){
    const input=$('manualHoursInput'); if(!input) return;
    const value=Number(input.value || 0);
    const d=estimateFromHours(value);
    $('manualRegularHours').textContent=hrs(d.s.regular);
    $('manualOvertimeHours').textContent=hrs(d.s.overtime);
    $('manualGross').textContent=money(d.gross);
    $('manualDeductions').textContent=money(d.ded);
    $('manualNet').textContent=money(d.net);
    $('manualNetDisplay').value=d.net==null?'':money(d.net);
  }
  function render(){
    repairInvalidRates();
    const d=estimate(); if(!$('payWeekRange'))return;
    $('payWeekRange').textContent=`${fmt(d.s.start)} au ${fmt(d.s.end)}`; $('payWorkedHours').textContent=hrs(d.s.worked); $('payRegularHours').textContent=hrs(d.s.regular); $('payOvertimeHours').textContent=hrs(d.s.overtime); $('payGross').textContent=money(d.gross); $('payNet').textContent=money(d.net); $('payDeductions').textContent=money(d.ded); $('payHourlyRateValue').textContent=d.r?money(d.r)+' / h':'À configurer'; $('payDeductionRateValue').textContent=d.dr?pct(d.dr):'À configurer'; $('payImportedNet').textContent=money(d.p.netPay); $('payImportedProfile').textContent=d.p.importedAt?`PDF importé le ${new Date(d.p.importedAt).toLocaleString('fr-CA')}`:'Aucun PDF importé';
    const del=$('deletePaystubBtn'); if(del) del.style.display=d.p.importedAt?'inline-flex':'none';
    renderManualEstimate();
  }
  function showPayroll(){ view(); contentNodes().forEach(n=>n.classList.add('payroll-hidden')); $('payrollView').classList.add('show'); $('sideMenu')?.classList.remove('open'); $('sideBackdrop')?.classList.remove('open'); bind(); render(); scrollTo({top:0,behavior:'smooth'}); }
  function showHome(){ $('payrollView')?.classList.remove('show'); document.querySelectorAll('.payroll-hidden').forEach(n=>n.classList.remove('payroll-hidden')); }
  function nav(){
    if($('navPayrollBtn'))return; const menu=$('sideMenu')||document.querySelector('.side-menu,.drawer,.menu-panel'); const b=document.createElement('button'); b.id='navPayrollBtn'; b.type='button'; b.className=menu?'side-nav-btn':'icon-btn'; b.innerHTML=menu?'<span class="side-nav-icon">$</span><span>Calendrier de paie</span>':'$'; b.title='Calendrier de paie'; b.onclick=showPayroll; if(menu){ const stats=$('navStatsBtn'); stats?stats.insertAdjacentElement('afterend',b):menu.appendChild(b); } else { (document.querySelector('.header-actions')||document.querySelector('header')||document.body).prepend(b); }
    document.addEventListener('click',(e)=>{ const t=e.target.closest('button'); if(t&&(t.id==='navHomeBtn'||(t.textContent||'').toLowerCase().includes('accueil'))) showHome(); });
  }
  function bind(){
    const r=$('payHourlyRateInput'), d=$('payDeductionRateInput'), pdf=$('paystubPdfInput'), mh=$('manualHoursInput'), del=$('deletePaystubBtn');
    if(del&&!del.dataset.bound){ del.dataset.bound=1; del.onclick=deleteImportedPaystub; }
    if(mh&&!mh.dataset.bound){ mh.dataset.bound=1; mh.value=localStorage.getItem('manualEstimateHours')||''; mh.oninput=()=>{ localStorage.setItem('manualEstimateHours', mh.value || ''); renderManualEstimate(); }; }
    if(r&&!r.dataset.bound){ r.dataset.bound=1; r.value=localStorage.getItem('payrollHourlyRate')||''; r.oninput=()=>{ if(Number(r.value)>0)localStorage.setItem('payrollHourlyRate',r.value); render(); }; }
    if(d&&!d.dataset.bound){ d.dataset.bound=1; const sv=validRate(localStorage.getItem('payrollDeductionRate')); d.value=sv?String(sv*100):''; d.oninput=()=>{ const val=Number(d.value || 0); if(val>0 && val<75)localStorage.setItem('payrollDeductionRate',String(val/100)); render(); }; }
    if(pdf&&!pdf.dataset.bound){ pdf.dataset.bound=1; pdf.onchange=async(e)=>{ const file=e.target.files?.[0]; if(!file)return; const status=$('paystubImportStatus'); try{ status.textContent='Analyse du PDF en cours…'; if(!window.PaystubPDF)throw new Error('PDF module absent'); const a=await window.PaystubPDF.analyzeFile(file); window.PaystubPDF.saveProfileFromAnalysis(a); if(validRate(a.deductionRate))localStorage.setItem('payrollDeductionRate',String(a.deductionRate)); if(a.hourlyRate)localStorage.setItem('payrollHourlyRate',String(a.hourlyRate)); else if(a.grossPay&&a.regularHours)localStorage.setItem('payrollHourlyRate',String(a.grossPay/a.regularHours)); status.textContent=`PDF analysé. Brut: ${money(a.grossPay)} | Net: ${money(a.netPay)} | Retenues: ${pct(a.deductionRate)}`; if(r) r.value=localStorage.getItem('payrollHourlyRate')||''; if(d){ const sv=validRate(localStorage.getItem('payrollDeductionRate')); d.value=sv?String(sv*100):''; } render(); }catch(err){ status.textContent='Impossible de lire ce PDF. Vérifie qu’il contient du texte sélectionnable.'; console.error(err); } finally { pdf.value=''; } }; }
  }
  function init(){ if(window.__payrollFixed)return; window.__payrollFixed=true; styles(); view(); nav(); bind(); render(); }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
