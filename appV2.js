/* ========== 全局 ========== */
:root{
  --bg:#fff; --ink:#111; --ink-2:#333; --muted:#666;
  --line:#ddd; --line-2:#eee;
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink-2);font:14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}

/* ========== 顶栏 ========== */
.topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;
  padding:10px 14px;border-bottom:1px solid var(--line);background:#fff}
#hamburger{border:1px solid var(--ink);background:#fff;padding:4px 8px;cursor:pointer}
.brand{font-weight:700;color:var(--ink)}
.spacer{flex:1}
.user-badge{display:flex;align-items:center;gap:10px}

/* ========== 抽屉侧栏 ========== */
.sidebar{position:fixed;left:0;top:48px;bottom:0;width:260px;overflow:auto;
  border-right:1px solid var(--line);background:#fff;transform:translateX(-100%);
  transition:transform .2s ease;z-index:25}
.sidebar.open{transform:translateX(0)}
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.15);display:none;z-index:20}
.backdrop.show{display:block}
.sidebar-header{padding:12px 14px;border-bottom:1px solid var(--line);color:var(--ink)}
.nav{display:flex;flex-direction:column;padding:8px}
.nav-link{padding:8px 10px;border:1px solid var(--line);color:var(--ink-2);text-decoration:none;margin-bottom:8px;border-radius:4px}
.nav-link.active,.nav-link:hover{border-color:var(--ink);color:var(--ink)}
.sidebar-footer{margin-top:auto;padding:12px;border-top:1px solid var(--line)}
.btn-full{width:100%}
.muted{color:var(--muted)} .small{font-size:12px}

/* 桌面保持常驻侧栏 */
@media(min-width:1024px){
  .sidebar{transform:none}
  .backdrop{display:none !important}
  .app{margin-left:260px}
}

/* ========== 容器/卡片 ========== */
.center-wrap{min-height:calc(100dvh - 48px);display:flex;align-items:center;justify-content:center;padding:16px}
.app{padding:16px}
.card{border:1px solid var(--line);border-radius:6px;background:#fff;padding:16px}
.card-narrow{max-width:420px;width:100%}
.title{margin:0 0 12px;color:var(--ink);font-weight:700}

/* ========== 表单/按钮 ========== */
.label{display:block;margin-bottom:4px;color:var(--ink)}
.input{width:100%;padding:8px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink)}
.form-row{margin-bottom:10px}
.btn{padding:6px 10px;border-radius:4px;cursor:pointer}
.btn-solid{background:#111;color:#fff;border:1px solid #111}
.btn-outline{background:#fff;color:#111;border:1px solid #111}
.btn:active{transform:translateY(1px)}
.mt-8{margin-top:8px}.mt-12{margin-top:12px}.mt-16{margin-top:16px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.error{color:#c00;margin-top:8px}

/* ========== 日历头 ========== */
.calendar-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:10px}
.calendar-title{flex:1;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.calendar-ctrl{display:flex;align-items:center;gap:6px}
.seg{display:flex;border:1px solid #111;border-radius:4px;overflow:hidden}
.seg-btn{border:none;background:#fff;padding:6px 10px;cursor:pointer}
.seg-btn.active{background:#111;color:#fff}

/* ========== FullCalendar 极简黑白 ========== */
.fc .fc-toolbar{display:none} /* 隐默认工具栏，改用自定义头部 */
.fc-theme-standard td, .fc-theme-standard th{border-color:var(--line)}
.fc .fc-timegrid-axis-cushion, .fc .fc-col-header-cell-cushion{color:var(--muted)}
.fc .fc-daygrid-day-number{color:var(--ink-2)}
.fc .fc-timegrid-slot{height:2.5em}
.fc .fc-timegrid-slot-lane{background:#fff}
.fc .fc-timegrid-now-indicator-line{border-color:#111}
.fc .fc-event{border:1px solid #111;background:#fff;color:#111}
.fc .fc-day-today{background: #fafafa}