// ========================== 配置区 ==========================
const API_URL = 'https://script.google.com/macros/s/AKfycbwJYf3jeNAF37vgVXTiWnEgYS5dlh9l9UChkiEhThh4OwV3TVEvP3ZtIS8bpm5G3HLf/exec';

// ========================== 工具函数 ==========================
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

async function callAPI(action, params = {}, timeout = 15000) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeout);
  try {
    const body = new URLSearchParams();
    body.append('action', action);
    body.append('params', JSON.stringify(params || {}));
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      mode: 'cors',
      signal: controller.signal
    });
    const text = await res.text();
    let raw = text.trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) raw = raw.slice(s, e + 1);
    return JSON.parse(raw);
  } catch (err) {
    return { success:false, message:String(err && err.message || err) };
  } finally {
    clearTimeout(to);
  }
}

// ========================== DOM 引用 ==========================
const loginContainer = $('#loginContainer');
const appContainer   = $('#appContainer');

const greetingEl = $('#greeting');
const userBadge  = $('#userBadge');
const logoutBtn  = $('#logoutBtn');

const hamburger  = $('#hamburger');
const sidebar    = $('#sidebar');
const backdrop   = $('#backdrop');

const apiStatusTip = $('#apiStatusTip');

const loginBtn   = $('#loginBtn');
const loginInput = $('#loginUsername');
const loginErr   = $('#loginError');

const regBtn     = $('#registerBtn');
const regErr     = $('#registerError');

const prevBtn    = $('#prevBtn');
const nextBtn    = $('#nextBtn');
const todayBtn   = $('#todayBtn');
const dayBtn     = $('#dayBtn');
const weekBtn    = $('#weekBtn');
const monthBtn   = $('#monthBtn');
const titleEl    = $('#calendarTitle');

const refreshBtn = $('#refreshBtn');

let calendar = null;
let currentUser = null;

// ========================== 侧栏抽屉（仅移动端会看到） ==========================
function toggleSidebar(show) {
  if (!sidebar || !backdrop) return;
  const willShow = (typeof show === 'boolean') ? show : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', willShow);
  backdrop.classList.toggle('show', willShow);
}
hamburger?.addEventListener('click', () => toggleSidebar());
backdrop?.addEventListener('click', () => toggleSidebar(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleSidebar(false); });

// 当前页链接：只收起抽屉不刷新
function bindSidebarLinksForCurrentPage(){
  $$('#sidebar .nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href && location.pathname.endsWith(href)) {
      a.classList.add('active');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar(false);
      });
    }
  });
}

// ========================== 日历 ==========================
function initCalendar() {
  if (calendar) calendar.destroy();

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const initialView = isMobile ? 'timeGridDay' : 'timeGridWeek';

  calendar = new FullCalendar.Calendar($('#mainCalendar'), {
    initialView,
    locale: 'zh-cn',
    firstDay: 1,
    height: 'auto',
    headerToolbar: false,
    allDaySlot: false,
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    slotDuration: '00:30:00',
    expandRows: true,
    events: [],
    datesSet: updateCalendarTitle,
    eventClick: (info) => {
      const ev = info.event;
      const ext = ev.extendedProps || {};
      const isStudent = currentUser && (currentUser.role === '学生' || String(currentUser.id||'').startsWith('S'));
      if (isStudent && ext.canBook && ext.status === '可约') {
        const note = prompt(`预约备注：\n${ev.title}  ${ev.start.toLocaleString('zh-CN')}`) || '';
        bookSlot(ev.id, note);
      } else {
        const lines = [
          `标题：${ev.title}`,
          `时间：${ev.start.toLocaleString('zh-CN')}${ev.end ? ' - ' + ev.end.toLocaleString('zh-CN') : ''}`,
          ext.attr ? `类型：${ext.attr}` : '',
          ext.status ? `状态：${ext.status}` : ''
        ].filter(Boolean);
        alert(lines.join('\n'));
      }
    }
  });

  // 顶部控制
  prevBtn.onclick  = () => calendar.prev();
  nextBtn.onclick  = () => calendar.next();
  todayBtn.onclick = () => calendar.today();

  bindViewSwitch(dayBtn,   'timeGridDay');
  bindViewSwitch(weekBtn,  'timeGridWeek');
  bindViewSwitch(monthBtn, 'dayGridMonth');

  calendar.render();
  updateCalendarTitle();
}

function bindViewSwitch(btn, viewName) {
  btn.onclick = () => {
    calendar.changeView(viewName);
    $$('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateCalendarTitle();
  };
}

function updateCalendarTitle() {
  if (!calendar) return;
  const view = calendar.view;
  const d = calendar.getDate();
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');

  if (view.type === 'timeGridDay') {
    titleEl.textContent = `${Y}/${M}/${D}`;
    dayBtn.classList.add('active'); weekBtn.classList.remove('active'); monthBtn.classList.remove('active');
  } else if (view.type === 'timeGridWeek') {
    const start = new Date(view.currentStart);
    const end   = new Date(view.currentEnd); end.setDate(end.getDate() - 1);
    const sM = String(start.getMonth() + 1).padStart(2, '0');
    const sD = String(start.getDate()).padStart(2, '0');
    const eM = String(end.getMonth() + 1).padStart(2, '0');
    const eD = String(end.getDate()).padStart(2, '0');
    // 样式：2025/08/17 – 08/23
    titleEl.textContent = `${Y}/${sM}/${sD} – ${eM}/${eD}`;
    weekBtn.classList.add('active'); dayBtn.classList.remove('active'); monthBtn.classList.remove('active');
  } else {
    titleEl.textContent = `${Y}/${M}`;
    monthBtn.classList.add('active'); dayBtn.classList.remove('active'); weekBtn.classList.remove('active');
  }
}

async function loadCalendarEvents() {
  if (!currentUser) return;
  const res = await callAPI('listVisibleSlots', { userId: currentUser.id });
  const events = (res && Array.isArray(res)) ? res : (res && res.events) || [];
  if (calendar) {
    calendar.removeAllEvents();
    events.forEach(ev => calendar.addEvent(ev));
  }
}

async function bookSlot(slotId, note) {
  if (!currentUser) return;
  const payload = {
    slotId,
    studentId: currentUser.id,
    studentName: currentUser.name || currentUser.id,
    note: note || ''
  };
  const res = await callAPI('bookSlot', payload);
  alert(res && res.success ? '预约成功' : (res && res.message) || '预约失败');
  if (res && res.success) loadCalendarEvents();
}

// ========================== 登录流 ==========================
window.onLoginSuccess = function(user) {
  currentUser = user || {};

  // 显示主应用，隐藏登录
  loginContainer.style.display = 'none';
  appContainer.style.display   = '';
  userBadge.style.display      = '';
  hamburger.style.display      = '';   // 移动端需要，桌面被 CSS 隐藏

  greetingEl.textContent = `欢迎，${currentUser.name || currentUser.id || '用户'}`;

  // 初始化
  initCalendar();
  loadCalendarEvents();
  bindSidebarLinksForCurrentPage();

  // 持久化
  try { localStorage.setItem('eds:user', JSON.stringify(currentUser)); } catch(_) {}
};

// 退出
logoutBtn.addEventListener('click', () => {
  toggleSidebar(false);
  hamburger.style.display = 'none';
  userBadge.style.display = 'none';
  appContainer.style.display = 'none';
  loginContainer.style.display = '';
  try { localStorage.removeItem('eds:user'); } catch(_) {}
  currentUser = null;
});

// 登录
loginBtn.addEventListener('click', async () => {
  const userId = (loginInput.value || '').trim();
  if (!userId) { loginErr.textContent = '请输入用户ID'; return; }
  loginErr.textContent = '';

  // 先走真实后端
  const apiRes = await callAPI('loginByUsername', { username: userId });
  if (apiRes && apiRes.success && apiRes.user) {
    const u = apiRes.user;
    window.onLoginSuccess({
      id: u.username || userId,
      name: u.name || u.username || userId,
      role: u.role || (String(userId).startsWith('T') ? '老师'
            : String(userId).startsWith('S') ? '学生'
            : String(userId).startsWith('A') ? '管理员' : '用户')
    });
    return;
  }

  // 后端不可用：本地假登录（便于你先调样式）
  const role = String(userId).startsWith('T') ? '老师'
             : String(userId).startsWith('S') ? '学生'
             : String(userId).startsWith('A') ? '管理员'
             : '用户';
  window.onLoginSuccess({ id:userId, name:userId, role });
});

loginInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });

// 登记
regBtn.addEventListener('click', async () => {
  const name = ($('#registerName').value || '').trim();
  const email = ($('#registerEmail').value || '').trim();
  const department = $('#registerDepartment').value;
  const major = ($('#registerMajor').value || '').trim();
  const role = $('#registerRole').value;
  regErr.textContent = '';

  if (!name || !email || !department || !major || !role) {
    regErr.textContent = '请填写完整信息'; return;
  }

  const res = await callAPI('registerByProfile', { name, email, department, major, role });
  if (res && res.success) {
    regErr.style.color = 'green';
    regErr.textContent = '登记成功！请联系老师获取用户ID后登录。';
  } else {
    regErr.style.color = 'red';
    regErr.textContent = (res && res.message) || '登记失败';
  }
});

// 刷新日历
refreshBtn?.addEventListener('click', () => loadCalendarEvents());

// ========================== 启动：API自检 + 自动登录 ==========================
(async function boot() {
  // API 自检
  if (apiStatusTip) {
    apiStatusTip.textContent = '正在检测 API…';
    const ping = await callAPI('testConnection', {});
    apiStatusTip.textContent = (ping && ping.success) ? 'API 已连接' : 'API 不可用，已启用本地登录（可先调样式）';
  }

  // 自动登录（如果有缓存）
  try {
    const saved = localStorage.getItem('eds:user');
    if (saved) {
      const u = JSON.parse(saved);
      if (u && u.id) window.onLoginSuccess(u);
    }
  } catch (_) {}
})();
/* ========== 抽屉：手机可开合，Esc/遮罩均可关闭 ========== */
(function () {
  const ham = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');

  function toggleSidebar(show) {
    const on = (typeof show === 'boolean') ? show : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', on);
    backdrop.classList.toggle('show', on);
  }
  // 覆盖全局引用（供其他地方调用）
  window.toggleSidebar = toggleSidebar;

  ham && ham.addEventListener('click', () => toggleSidebar());
  backdrop && backdrop.addEventListener('click', () => toggleSidebar(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleSidebar(false);
  });
})();