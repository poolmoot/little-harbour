export const CSS = `
:root { --ink:#3b2f25; --paper:#fdf6e3; --paper2:#f3e8cb; --edge:#8c6a4a; --accent:#2f6f8f; --good:#4f8a52; --warn:#c0572d; --gold:#e0a82e; }
#ui, #ui * { box-sizing: border-box; }
#ui { font-family: "Trebuchet MS", system-ui, sans-serif; color: var(--ink); user-select: none; -webkit-user-select: none; }
.card { background: rgba(253,246,227,.94); border: 2px solid var(--edge); border-radius: 12px; box-shadow: 0 3px 0 rgba(60,40,20,.35); padding: 8px 12px; }
.hud-money { position:absolute; top:12px; left:12px; min-width:130px; }
.hud-money .big { font-size:26px; font-weight:700; color:#8a5a00; }
.hud-money .sub { font-size:12px; opacity:.8; }
.hud-clock { position:absolute; top:12px; left:50%; transform:translateX(-50%); text-align:center; padding:6px 18px; }
.hud-clock .t { font-size:24px; font-weight:700; letter-spacing:1px; }
.hud-clock .p { font-size:12px; text-transform:uppercase; letter-spacing:2px; opacity:.75; }
.hud-right { position:absolute; top:12px; right:12px; width:250px; max-height:calc(100vh - 24px); overflow:hidden; display:flex; flex-direction:column; gap:8px; }
.hud-money.tick .big { animation: tickpop .3s ease-out infinite alternate; }
@keyframes tickpop { from { transform:scale(1); color:#8a5a00; } to { transform:scale(1.1); color:#3f8a2a; } }
.hud-money .big { transform-origin:left center; }
.floaty { position:absolute; transform:translate(-50%,-50%); font-size:28px; font-weight:800; color:#fff6c8; -webkit-text-stroke:2px #8a5a00; paint-order:stroke fill; text-shadow:0 3px 0 rgba(60,40,20,.5); pointer-events:none; animation: floaty 1.4s ease-out forwards; z-index:20; }
@keyframes floaty { 0% { opacity:0; transform:translate(-50%,-30%) scale(.5); } 15% { opacity:1; transform:translate(-50%,-60%) scale(1.25); } 30% { transform:translate(-50%,-80%) scale(1); } 100% { opacity:0; transform:translate(-50%,-260%) scale(1); } }
.hud-right h4 { margin:0 0 4px; font-size:12px; text-transform:uppercase; letter-spacing:1.5px; opacity:.7; }
.chips { display:flex; flex-wrap:wrap; gap:5px; }
.chip { display:flex; align-items:center; gap:4px; background:var(--paper2); border:1px solid var(--edge); border-radius:8px; padding:2px 6px; font-size:12px; }
.chip.empty { opacity:.45; border-style:dashed; }
.line { font-size:13px; margin:3px 0; }
.line small { opacity:.7; }
.line.urgent { color: var(--warn); font-weight:700; }
.prompt { position:absolute; bottom:44px; left:50%; transform:translateX(-50%); padding:8px 18px; font-size:17px; font-weight:700; white-space:nowrap; }
.prompt.dim { opacity:.7; font-weight:400; }
.prompt.hot { background:#ffe27a; border-color:#b8860b; animation: pulse .35s infinite alternate; }
.prompt kbd { display:inline-block; background:var(--ink); color:var(--paper); border-radius:5px; padding:1px 8px; margin-right:8px; font-family:inherit; }
@keyframes pulse { from { transform:translateX(-50%) scale(1); } to { transform:translateX(-50%) scale(1.06); } }
.hints { position:absolute; bottom:10px; left:12px; font-size:12px; padding:4px 10px; opacity:.85; }
.toasts { position:absolute; top:78px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:6px; width:520px; max-width:90vw; }
.toast { padding:6px 14px; font-size:14px; animation: tin .28s cubic-bezier(.2,.9,.3,1.25); text-align:center; transition:opacity .35s ease, transform .35s ease; }
.toast.out { opacity:0; transform:translateY(-8px) scale(.96); }
@media (max-width: 1060px) { .toasts { left:12px; transform:none; align-items:flex-start; width:calc(100vw - 292px); max-width:520px; } .toast { text-align:left; } }
@media (max-width: 640px) { .toasts { top:auto; bottom:92px; width:calc(100vw - 24px); max-width:none; } .hud-clock { display:none; } }
.toast.good { border-color: var(--good); } .toast.warn { border-color: var(--warn); background: rgba(255,236,220,.96); }
@keyframes tin { from { opacity:0; transform:translateY(-12px) scale(.92); } to { opacity:1; transform:none; } }
.bubble { position:absolute; display:none; transform:translate(-50%,-100%); background:#fff; border:2px solid var(--edge); border-radius:12px; padding:5px 10px; max-width:230px; font-size:13px; line-height:1.3; box-shadow:0 2px 0 rgba(60,40,20,.3); }
.bubble b { display:block; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--accent); }
.overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(15,25,35,.35); pointer-events:auto; opacity:0; visibility:hidden; transition:opacity .18s ease, visibility 0s linear .18s; backdrop-filter:blur(0px); }
.overlay.open { opacity:1; visibility:visible; transition:opacity .18s ease, visibility 0s; backdrop-filter:blur(2px); }
.panel { width:min(640px, 94vw); max-height:88vh; overflow:auto; padding:16px 20px 18px; transform:translateY(14px) scale(.94); opacity:0; transition:transform .24s cubic-bezier(.2,.9,.3,1.15), opacity .18s ease; }
.overlay.open .panel { transform:none; opacity:1; }
.panel h2 { margin:0 0 2px; font-size:22px; }
.panel .sub { margin:0 0 12px; font-size:13px; opacity:.75; }
.panel h3 { margin:14px 0 6px; font-size:13px; text-transform:uppercase; letter-spacing:1.5px; opacity:.7; }
.xbtn { float:right; }
.btn { font:inherit; font-weight:700; color:#fff; background:var(--accent); border:0; border-bottom:3px solid #1d4a60; border-radius:8px; padding:6px 14px; cursor:pointer; }
.btn:hover { filter:brightness(1.1); } .btn:active { transform:translateY(2px); border-bottom-width:1px; }
.btn.good { background:var(--good); border-bottom-color:#35603a; } .btn.warn { background:var(--warn); border-bottom-color:#7f3a1c; }
.btn.ghost { background:var(--paper2); color:var(--ink); border-bottom-color:var(--edge); }
.btn[disabled], .btn.off { background:#b9b2a0; border-bottom-color:#8d8776; color:#f3efe3; cursor:not-allowed; filter:none; }
.row { display:flex; align-items:center; gap:10px; padding:7px 8px; border-radius:8px; background:var(--paper2); margin-bottom:6px; }
.row .grow { flex:1; min-width:0; } .row small { opacity:.7; display:block; }
.row.locked { opacity:.6; }
.bar { height:7px; background:#d8cdb0; border-radius:4px; overflow:hidden; margin-top:3px; width:120px; }
.bar i { display:block; height:100%; }
.badge { font-size:11px; font-weight:700; background:var(--gold); color:#4a3200; border-radius:6px; padding:1px 6px; }
.price { font-weight:700; min-width:48px; text-align:right; }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.fcard { background:var(--paper2); border-radius:10px; padding:8px; text-align:center; font-size:13px; }
.fcard.unknown { opacity:.8; }
.stat { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed #cdbf9d; font-size:15px; }
.center { text-align:center; margin-top:14px; }
table.board { width:100%; border-collapse:collapse; font-size:13px; } table.board td, table.board th { padding:3px 6px; text-align:left; } table.board th { opacity:.65; font-weight:400; }
`;

export function injectStyles(): void {
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}
