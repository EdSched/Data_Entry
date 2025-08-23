// ========================== 配置区 ==========================
/** 你的 Apps Script 部署地址（可沿用你之前的那个） */
const API_URL = 'https://script.google.com/macros/s/AKfycbwJYf3jeNAF37vgVXTiWnEgYS5dlh9l9UChkiEhThh4OwV3TVEvP3ZtIS8bpm5G3HLf/exec';

// ========================== 工具函数 ==========================
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

async function callAPI(action, params = {}, timeout = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);

  try {
    const fd = new URLSearchParams();
    fd.append('action', action);
    fd.append('params', JSON.stringify(params));

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fd,
      mode: 'cors',
      signal: controller.signal
    });

    const text = await res.text();
    let clean = text.trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) clean = clean.slice(s, e + 1);
    return JSON.parse(clean);
  } catch (err) {
    return { success: false, message: String(err && err.message || err) };
  } finally {
    clearTimeout(t);
  }
}

// ========================== 页面元素 ==========================
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

// ========================== 抽屉开关 ==========================
function toggleSidebar(show) {
  const willShow = (typeof show === 'boolean') ? show : !sidebar.classList.contains('open');
  if (willShow) {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
  } else {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  }
}
hamburger.addEventListener('click', () => toggleSidebar());
backdrop.addEventListener('click', () => toggleSidebar(false));

// ========================== 日历初始化与更新 ==========================
function initCalendar() {
  if (calendar) calendar.destroy();

  const initialView = window.matchMedia('(max-width: 768px)').matches
    ? 'timeGridDay'
    : 'timeGridWeek';

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
      // 学生且可约时才弹预约
      const isStudent = currentUser && (currentUser.role === '学生' || String(currentUser.id).startsWith('S'));
      if (isStudent && ext.canBook && ext.status === '可约') {
        const note = prompt(`预约备注：\n${ev.title}  ${ev.start.toLocaleString('zh-CN')}`) || '';
        bookSlot(ev.id, note);
      } else {
        // 只读详情
        const arr = [
          `标题：${ev.title}`,
          `时间：${ev.start.toLocaleString('zh-CN')}${ev.end ? ' - ' + ev.end.toLocaleString('zh-CN') : ''}`,
          ext.attr ? `类型：${ext.attr}` : '',
          ext.status ? `状态：${ext.status}` : ''
        ].filter(Boolean);
        alert(arr.join('\n'));
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
    titleEl.textContent = `${Y}/${sM}/${sD} – ${eM}/${eD}`;
    weekBtn.classList.add('active'); dayBtn.classList.remove('active'); monthBtn.classList.remove('active');
  } else {
    titleEl.textContent = `${Y}/${M}`;
    monthBtn.classList.add('active'); dayBtn.classList.remove('active'); weekBtn.classList.remove('active');
  }
}

async function loadCalendarEvents() {
  if (!currentUser) return;
  // 调用后端：listVisibleSlots(userId)
  const res = await callAPI('listVisibleSlots', { userId: currentUser.id });
  const events = (res && Array.isArray(res)) ? res : (res && res.events) || [];
  if (calendar) {
    calendar.removeAllEvents();
    events.forEach(ev => calendar.addEvent(ev));
  }
}

// 学生预约
async function bookSlot(slotId, note) {
  if (!currentUser) return;
  const payload = {
    slotId,
    studentId: currentUser.id,
    studentName: currentUser.name || currentUser.id,
    note: note || ''
  };
  const res = await callAPI('bookSlot', payload);
  if (res && res.success) {
    alert('预约成功');
    loadCalendarEvents();
  } else {
    alert(res && res.message ? res.message : '预约失败');
  }
}

// ========================== 登录成功统一入口 ==========================
window.onLoginSuccess = function(user) {
  currentUser = user || {};

  // 切换可见性
  loginContainer.style.display = 'none';
  appContainer.style.display   = '';
  userBadge.style.display      = '';
  hamburger.style.display      = '';   // 只在登录后显示

  // 欢迎词
  greetingEl.textContent = `欢迎，${currentUser.name || currentUser.id || '用户'}`;

  // 初始化/加载
  initCalendar();
  loadCalendarEvents();

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

// ========================== 登录/登记 ==========================
loginBtn.addEventListener('click', async () => {
  const userId = loginInput.value.trim();
  if (!userId) { loginErr.textContent = '请输入用户ID'; return; }
  loginErr.textContent = '';

  // 1) 先尝试真实后端
  const apiRes = await callAPI('loginByUsername', { username: userId });
  if (apiRes && apiRes.success && apiRes.user) {
    const u = apiRes.user;
    window.onLoginSuccess({
      id: u.username || userId,
      name: u.name || u.username || userId,
      role: u.role || (String(userId).startsWith('T') ? '老师' : (String(userId).startsWith('S') ? '学生' : (String(userId).startsWith('A') ? '管理员' : '用户')))
    });
    return;
  }

  // 2) 后端不可用时，退回到本地假登录（为了让你能继续改样式）
  const role = String(userId).startsWith('T') ? '老师'
           : String(userId).startsWith('S') ? '学生'
           : String(userId).startsWith('A') ? '管理员'
           : '用户';
  window.onLoginSuccess({ id: userId, name: userId, role });
});

loginInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

regBtn.addEventListener('click', async () => {
  const name = $('#registerName').value.trim();
  const email = $('#registerEmail').value.trim();
  const department = $('#registerDepartment').value;
  const major = $('#registerMajor').value.trim();
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
if (refreshBtn) refreshBtn.addEventListener('click', () => loadCalendarEvents());

// ========================== 启动：API自检 + 自动登录 ==========================
(async function boot() {
  // API自检
  if (apiStatusTip) {
    apiStatusTip.textContent = '正在检测 API…';
    const ping = await callAPI('testConnection', {});
    if (ping && ping.success) {
      apiStatusTip.textContent = 'API 已连接';
    } else {
      apiStatusTip.textContent = 'API 不可用，已启用本地登录（可先调样式）';
    }
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
