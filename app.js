/* =============== 基础配置（按你现有 API） =============== */
const API_URL = 'https://script.google.com/macros/s/AKfycbybAvJ1PChJbu2WofPrj2-IrZ4Ro07mBlQQ7TymJRtadT0UiXfL1jQbcc3yYuXHaXw/exec';

/* =============== 小工具 =============== */
const $ = (id) => document.getElementById(id);
function setApiStatus({ok, text}) {
  const dotTop = $('apiDotTop'), txtTop = $('apiTextTop');
  const inline = $('apiStatusInline');
  if (dotTop) dotTop.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
  if (txtTop) txtTop.textContent = text || (ok ? 'API 正常' : (ok===false ? 'API 连接失败' : 'API 检测中'));
  if (inline) {
    let dot = inline.querySelector('.api-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'api-dot wait';
      dot.style.cssText = 'display:inline-block;border-radius:50%;width:8px;height:8px;margin-right:6px;';
      inline.prepend(dot);
    }
    dot.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
    inline.lastChild && inline.lastChild.nodeType===3 && (inline.lastChild.textContent=' ');
    inline.append(text ? (' ' + text) : (ok ? ' API连接成功' : (ok===false ? ' API连接失败' : ' 正在检测 API 连接…')));
  }
}

/* =============== 统一/适配 =============== */
function normalizeUser(u = {}, fallbackId = '') {
  return {
    userId: u.userId || u.username || u.id || fallbackId || '',
    name: u.name || u.realName || u.displayName || '',
    role: u.role || u.identity || '',
    department: u.department || u.affiliation || u.dept || '',
    major: u.major || u.subject || ''
  };
}
function normalizeRole(user){
  const id = String(user.userId||'');
  const r0 = String(user.role||'').toLowerCase();
  if (r0.includes('admin') || r0.includes('管') || id.startsWith('A')) return 'admin';
  if (r0.includes('teacher') || r0.includes('师') || id.startsWith('T')) return 'teacher';
  return 'student';
}
function adaptEvents(rows) {
  if (!Array.isArray(rows)) return [];
  const pad = v => {
    const s = String(v ?? '');
    return /^\d:\d{2}$/.test(s) ? ('0' + s) : s; // 9:00 -> 09:00
  };
  return rows.map(r => {
    const date = r.date || r.singleDate || r.day || '';
    const start = r.start || (date && r.startTime ? `${date}T${pad(r.startTime)}` : null);
    const end   = r.end   || (date && r.endTime   ? `${date}T${pad(r.endTime)}`   : null);
    return {
      id: r.id || r.slotId || r.slotID || `${date}-${r.startTime||''}-${r.title||r.courseName||''}`,
      title: r.title || r.courseName || r.attr || '未命名',
      start, end,
      backgroundColor: r.backgroundColor || r.bgColor || undefined,
      borderColor: r.borderColor || undefined,
      extendedProps: {
        canBook: r.canBook === true || r.canBook === '是',
        status: r.status || r.scheduleStatus || '',
        description: r.description || r.notes || r.note || '',
      }
    };
  }).filter(e => e.start);
}

/* =============== API =============== */
async function callAPI(action, params = {}) {
  try {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('params', JSON.stringify(params));
    const controller = new AbortController();
    const t = setTimeout(()=>controller.abort(), 8000);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      mode: 'cors',
      signal: controller.signal
    });
    clearTimeout(t);
    const text = await res.text();
    let clean = text.trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) clean = clean.slice(s, e+1);
    return JSON.parse(clean);
  } catch (err) {
    return { success:false, message:'网络请求失败: ' + err.message };
  }
}
async function checkApiHealth() {
  setApiStatus({ok:null, text:'API 检测中'});
  try {
    const [r1, r2] = await Promise.allSettled([
      callAPI('testConnection'),
      callAPI('ping', { t: Date.now() })
    ]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ ok, text: ok ? 'API 连接成功' : 'API 连接异常' });
    return ok;
  } catch (e) {
    setApiStatus({ ok:false, text:'API 连接失败' });
    return false;
  }
}

/* =============== 全局状态 =============== */
let currentUser = null;
let calendar = null;
const navLinks = [];

/* =============== 登录 / 注册 / 登出（极简） =============== */
function showRegisterForm() {
  $('loginForm').style.display = 'none';
  $('registerForm').style.display = 'block';
  $('loginError').textContent = '';
  $('registerError').textContent = '';
}
function showLoginForm() {
  $('registerForm').style.display = 'none';
  $('loginForm').style.display = 'block';
  $('loginError').textContent = '';
  $('registerError').textContent = '';
}
async function login() {
  const username = ($('loginUsername').value || '').trim();
  const err = $('loginError');
  if (!username) { err.textContent = '请输入用户ID'; return; }
  err.style.color=''; err.textContent='正在登录…';
  const r = await callAPI('loginByUsername', { username });
  if (r && r.success) {
    currentUser = normalizeUser(r.user, username);
    $('loginContainer').style.display = 'none';
    $('mainApp').style.display = 'block';
    try{ window.location.hash = '#app'; }catch{}
    updateUserUI();
    initCalendar();
    bindTopBarButtons();
    loadCalendarEvents();
  } else {
    err.style.color='#c00';
    err.textContent = (r && r.message) || '登录失败：用户ID不存在';
  }
}
async function registerUser() {
  const name = ($('registerName').value||'').trim();
  const email = ($('registerEmail').value||'').trim();
  const department = $('registerDepartment').value;
  const major = ($('registerMajor').value||'').trim();
  const role = $('registerRole').value;
  const err = $('registerError');
  if (!name || !email || !department || !major || !role) { err.textContent='请填写姓名、邮箱、所属、专业、身份'; return; }
  err.style.color=''; err.textContent='正在登记…';
  const r = await callAPI('registerByProfile', { name, email, department, major, role });
  if (r && r.success) {
    err.style.color='green'; err.textContent='登记成功！联系老师获取“用户ID”后用用户ID登录。';
    $('registerName').value=''; $('registerEmail').value=''; $('registerDepartment').value='';
    $('registerMajor').value=''; $('registerRole').value='';
    setTimeout(showLoginForm, 1000);
  } else {
    err.style.color='#c00'; err.textContent=(r && r.message) || '登记失败';
  }
}
function logout() {
  currentUser = null;
  $('mainApp').style.display = 'none';
  $('loginContainer').style.display = 'flex';
  $('loginUsername').value = '';
  $('loginError').textContent = '';
  setApiStatus({ok:null, text:'API 检测中'});
  try{ window.location.hash = '#login'; }catch{}
  checkApiHealth();  
}

// 所属 → 专业（独立列表；已按学科逻辑顺序排列）
const MAJOR_OPTIONS = {
  '理科大学院': [
    '机械',          // 工学基础
    '电子电器',      // 电气/信息硬件
    '生物化学',      // 生命理学
    '情报学'         // 信息学（软件/数据）
  ],
  '文科大学院': [
    '文学',
    '历史学',
    '社会学',
    '社会福祉学',
    '新闻传播学',
    '表象文化',
    '经营学',
    '经济学',
    '日本语教育'
  ]
};

/* =============== 角色导航与页面切换 =============== */
/** 管理员别名：侧栏 data-page -> 实际页面ID */
function resolvePageIdForRole(pageId) {
  if (!currentUser) return pageId;
  const rn = currentUser.roleNorm;
  // 管理员点击“我的安排/我的查看/我的任务”时，HTML 的 data-page 分别是：output / datamanagement / task
  if (rn === 'admin') {
    if (pageId === 'output') return 'arrange';          // 显示 #arrangePage
    if (pageId === 'datamanagement') return 'review';   // 显示 #reviewPage
  }
  // 学生、老师都按 data-page + 'Page' 寻找
  return pageId;
}
function showPage(pageIdRaw) {
  const pageId = resolvePageIdForRole(pageIdRaw);
  document.querySelectorAll('.page-content').forEach(p => { p.classList.remove('active'); p.style.display='none'; });
  const panel = document.getElementById(pageId + 'Page');
  if (panel) { panel.style.display='block'; panel.classList.add('active'); }
  navLinks.forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`.nav-link[data-page="${pageIdRaw}"]`);
  if (active) active.classList.add('active');
  if (pageId === 'calendar' && window.calendar) setTimeout(()=>window.calendar.updateSize(), 60);
}
function updateUserUI() {
  if (!currentUser) return;
  currentUser.roleNorm = normalizeRole(currentUser);
  $('userGreeting').textContent = '欢迎，' + (currentUser.name || currentUser.userId);
  $('userRole').textContent = '(' + (currentUser.role || '') + ')';

  // 三套导航容器互斥显示（按你新的 HTML 结构）
  const ns = $('nav-student'), nt = $('nav-teacher'), na = $('nav-admin');
  ns && (ns.style.display = currentUser.roleNorm === 'student' ? '' : 'none');
  nt && (nt.style.display = currentUser.roleNorm === 'teacher' ? '' : 'none');
  na && (na.style.display = currentUser.roleNorm === 'admin'   ? '' : 'none');

  // 让当前角色导航的第一个链接高亮并显示对应页面
  const navRoot = currentUser.roleNorm === 'student' ? ns : (currentUser.roleNorm === 'teacher' ? nt : na);
  let firstLink = navRoot ? navRoot.querySelector('.nav-link') : null;
  if (firstLink) {
    document.querySelectorAll('.nav-link').forEach(a=>a.classList.remove('active'));
    firstLink.classList.add('active');
    const pid = resolvePageIdForRole(firstLink.dataset.page);
    showPage(pid);
  } else {
    // 兜底到日历
    showPage('calendar');
  }
}

/* =============== 日历 =============== */
function initCalendar() {
  const el = $('mainCalendar'); if (!el) return;
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  const cal = new FullCalendar.Calendar(el, {
    initialView,
    locale: 'zh-cn',
    firstDay: 1,
    height: 'auto',
    headerToolbar: false,
    allDaySlot: false,
    slotMinTime:'08:00:00',
    slotMaxTime:'22:00:00',
    slotDuration:'00:30:00',
    expandRows:true,
    datesSet: updateCalendarTitle,
  });
  cal.render();
  window.calendar = cal;
  calendar = cal;
  setTimeout(()=>{ try{ cal.updateSize(); }catch{} }, 60);
  updateCalendarTitle();
}
function updateCalendarTitle() {
  if (!calendar) return;
  const view = calendar.view, date = calendar.getDate();
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  if (view.type === 'timeGridDay') $('calendarTitle').textContent = `${y}/${m}/${d}`;
  else if (view.type === 'timeGridWeek') {
    const s = new Date(view.currentStart), e = new Date(view.currentEnd); e.setDate(e.getDate()-1);
    $('calendarTitle').textContent = `${y}/${String(s.getMonth()+1).padStart(2,'0')}/${String(s.getDate()).padStart(2,'0')} – ${String(e.getMonth()+1).padStart(2,'0')}/${String(e.getDate()).padStart(2,'0')}`;
  } else $('calendarTitle').textContent = `${y}/${m}`;
}
async function loadCalendarEvents() {
  if (!currentUser || !calendar) return;
  const res = await callAPI('listVisibleSlots', { userId: currentUser.userId });
  const rows = Array.isArray(res) ? res : (res?.data || res?.events || []);
  const events = adaptEvents(rows);
  calendar.removeAllEvents();
  events.forEach(ev => calendar.addEvent(ev));
  updateTodayStats();
}

function updateTodayStats(){
  // 占位（不连后台统计）
  $('todayCourses').textContent = $('todayCourses').textContent || '0';
  $('todayConsultations').textContent = $('todayConsultations').textContent || '0';
  $('todayReminders').textContent = $('todayReminders').textContent || '0';
  $('attendanceRate').textContent = $('attendanceRate').textContent || '—';
}

/* =============== 顶部按钮与视图切换（极简） =============== */
function bindTopBarButtons() {
  $('prevBtn')?.addEventListener('click', ()=>{ calendar?.prev(); updateCalendarTitle(); });
  $('todayBtn')?.addEventListener('click', ()=>{ calendar?.today(); updateCalendarTitle(); });
  $('nextBtn')?.addEventListener('click', ()=>{ calendar?.next(); updateCalendarTitle(); });

  $('dayBtn')?.addEventListener('click', (e)=>{ calendar?.changeView('timeGridDay'); setSegActive(e.target); updateCalendarTitle(); });
  $('weekBtn')?.addEventListener('click', (e)=>{ calendar?.changeView('timeGridWeek'); setSegActive(e.target); updateCalendarTitle(); });
  $('monthBtn')?.addEventListener('click', (e)=>{ calendar?.changeView('dayGridMonth'); setSegActive(e.target); updateCalendarTitle(); });

  $('refreshDataBtn')?.addEventListener('click', ()=> loadCalendarEvents());
}
function setSegActive(btn){
  ['dayBtn','weekBtn','monthBtn'].forEach(id=>{ const b=$(id); b && b.classList.remove('active'); });
  btn && btn.classList.add('active');
}

/* =============== 初始化 =============== */
document.addEventListener('DOMContentLoaded', async () => {
  // 导航点击：统一用 data-page
  document.querySelectorAll('.nav-link').forEach(link => {
    navLinks.push(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pid = link.dataset.page;
      if (pid) showPage(pid);
    });
  });

  // 登录/注册/退出
  $('loginBtn')?.addEventListener('click', login);
  $('registerBtn')?.addEventListener('click', registerUser);
  $('logoutBtn')?.addEventListener('click', logout);
  $('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  $('showLoginBtn')?.addEventListener('click', showLoginForm);
  $('loginUsername')?.addEventListener('keypress', (e)=>{ if (e.key==='Enter') login(); });

  // API 健康检查
  setApiStatus({ok:null, text:'API 检测中'});
  try {
    const [r1, r2] = await Promise.allSettled([callAPI('testConnection'), callAPI('ping', {t: Date.now()})]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ok, text: ok ? 'API 连接成功' : 'API 连接异常'});
    if (!ok) {
      const d = $('loginError'); if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
    }
  } catch {
    setApiStatus({ok:false, text:'API 连接失败'});
    const d = $('loginError'); if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
  }

  // 移动端抽屉（≤600px 生效）
  (function(){
    const strip = document.getElementById('menuStrip');
    const aside = document.querySelector('aside');
    const main  = document.querySelector('main');
    if (!strip || !aside || !main) return;

    const mq = window.matchMedia('(max-width:600px)');
    const isOpen = () => document.body.classList.contains('mobile-menu-open');
    const refreshCal = () => { try{ const cal = window.calendar; if (cal) setTimeout(()=>cal.updateSize(), 80); }catch{}; };

    const open  = ()=>{ document.body.classList.add('mobile-menu-open'); strip.setAttribute('aria-expanded','true');  strip.querySelector('.label').textContent='收起菜单'; refreshCal(); };
    const close = ()=>{ document.body.classList.remove('mobile-menu-open'); strip.setAttribute('aria-expanded','false'); strip.querySelector('.label').textContent='展开菜单'; refreshCal(); };

    strip.addEventListener('click', (e)=>{ if (!mq.matches) return; e.stopPropagation(); isOpen() ? close() : open(); });
    main.addEventListener('click', (e)=>{ if (!mq.matches || !isOpen()) return; if (aside.contains(e.target) || strip.contains(e.target)) return; close(); });
    const onChange = () => { if (!mq.matches) close(); };
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
  })();
});
