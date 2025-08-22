/* ================= 基础配置 ================= */
const API_URL = 'https://script.google.com/macros/s/AKfycbwJYf3jeNAF37vgVXTiWnEgYS5dlh9l9UChkiEhThh4OwV3TVEvP3ZtIS8bpm5G3HLf/exec';
const BREAKPOINT = 768; // <=768 视为手机：日视图；否则周视图

/* ================= 全局状态 ================= */
let currentUser = null;
let mainCalendar = null;
let miniCalendar = null;

/* ================= 通用 API 封装 ================= */
async function callAPI(action, params = {}) {
  try {
    const form = new URLSearchParams();
    form.append('action', action);
    form.append('params', JSON.stringify(params));

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      mode: 'cors'
    });

    const text = await res.text();
    // Apps Script 可能会混入日志，这里清洗出 JSON
    let clean = text.trim();
    const s = clean.indexOf('{');
    const e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) clean = clean.substring(s, e + 1);
    return JSON.parse(clean);
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

/* ================= 登录 / 注册 ================= */
async function login() {
  const $u = document.getElementById('loginUsername');
  const $msg = document.getElementById('loginError');
  const username = ($u.value || '').trim();

  if (!username) { $msg.textContent = '请输入用户ID'; return; }
  $msg.style.color = '#6b7280';
  $msg.textContent = '正在登录…';

  const r = await callAPI('loginByUsername', { username });
  if (r && r.success) {
    currentUser = r.user || {};
    currentUser.userId = currentUser.username || username;

    // 进主应用
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    updateUserInterface();
    initializeCalendars();
    loadUserProfile();
  } else {
    $msg.style.color = 'red';
    $msg.textContent = (r && r.message) ? String(r.message) : '登录失败：用户ID不存在';
  }
}

async function register() {
  const name = (document.getElementById('registerName').value || '').trim();
  const email = (document.getElementById('registerEmail').value || '').trim();
  const department = document.getElementById('registerDepartment').value;
  const major = (document.getElementById('registerMajor').value || '').trim();
  const role = document.getElementById('registerRole').value;
  const $err = document.getElementById('registerError');

  if (!name || !email || !department || !major || !role) {
    $err.textContent = '请填写姓名、邮箱、所属、专业、身份';
    return;
  }
  $err.style.color = '#6b7280';
  $err.textContent = '正在登记…';

  const r = await callAPI('registerByProfile', { name, email, department, major, role });
  if (r && r.success) {
    $err.style.color = 'green';
    $err.textContent = '登记成功！请联系老师获取“用户ID”，用用户ID登录。';
    // 清空并返回登录
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerDepartment').value = '';
    document.getElementById('registerMajor').value = '';
    document.getElementById('registerRole').value = '';
    setTimeout(showLoginForm, 1200);
  } else {
    $err.style.color = 'red';
    $err.textContent = (r && r.message) ? String(r.message) : '登记失败';
  }
}

function logout() {
  currentUser = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginContainer').style.display = 'flex';
  // 清空状态
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginError').textContent = '';
  destroyCalendars();
}

/* ================= 界面切换/权限 ================= */
function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
}
function showLoginForm() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
}

function updateUserInterface() {
  if (!currentUser) return;
  document.getElementById('userGreeting').textContent = `欢迎，${currentUser.name || currentUser.userId}`;
  document.getElementById('userRole').textContent = `(${currentUser.role || ''})`;

  const isTeacher = (currentUser.role === '老师' || String(currentUser.userId).startsWith('T'));
  const isAdmin   = String(currentUser.userId).startsWith('A');

  const $analysisTab = document.getElementById('analysisTab');
  const $analysisBtn = document.getElementById('analysisBtn');
  const $publishPanel = document.getElementById('publishPanel');

  if ($analysisTab)  $analysisTab.style.display = (isTeacher || isAdmin) ? 'block' : 'none';
  if ($analysisBtn)  $analysisBtn.style.display = (isTeacher || isAdmin) ? 'block' : 'none';
  if ($publishPanel) $publishPanel.style.display = (isTeacher || isAdmin) ? 'block' : 'none';
}

/* ================= FullCalendar ================= */
function initialView() {
  return (window.innerWidth <= BREAKPOINT) ? 'timeGridDay' : 'timeGridWeek';
}

function destroyCalendars() {
  try { mainCalendar?.destroy(); } catch(_) {}
  try { miniCalendar?.destroy(); } catch(_) {}
  mainCalendar = null; miniCalendar = null;
}

function initializeCalendars() {
  // 小日历
  const miniEl = document.getElementById('miniCalendar');
  if (miniEl) {
    miniCalendar = new FullCalendar.Calendar(miniEl, {
      initialView: 'dayGridMonth',
      locale: 'zh-cn',
      headerToolbar: { left: 'prev', center: 'title', right: 'next' },
      height: 'auto',
      events: [],
      dateClick: (info) => {
        if (mainCalendar) mainCalendar.gotoDate(info.dateStr);
      }
    });
    miniCalendar.render();
  }

  // 主日历
  const mainEl = document.getElementById('mainCalendar');
  if (!mainEl) return;

  mainCalendar = new FullCalendar.Calendar(mainEl, {
    locale: 'zh-cn',
    initialView: initialView(),
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridDay,timeGridWeek,dayGridMonth'
    },
    buttonText: { today: '今天', day: '日', week: '周', month: '月' },
    allDaySlot: false,
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    scrollTime: '09:00:00',
    height: 'auto',
    expandRows: true,
    events: async (info, success, failure) => {
      try {
        if (!currentUser) { success([]); return; }
        const evs = await callAPI('listVisibleSlots', { userId: currentUser.userId });
        success(Array.isArray(evs) ? evs : []);
        // 同步给小日历
        if (miniCalendar) {
          miniCalendar.removeAllEvents();
          (Array.isArray(evs) ? evs : []).forEach(ev => miniCalendar.addEvent(ev));
        }
        updateTodayStats();
      } catch (e) {
        console.error('加载事件失败:', e);
        failure(e);
      }
    },
    eventClick: async (info) => {
      const ev = info.event;
      const ext = ev.extendedProps || {};

      if (!currentUser) return;
      const isStudent = (currentUser.role === '学生' || String(currentUser.userId).startsWith('S'));

      if (isStudent && ext.canBook && ext.status === '可约') {
        const note = prompt(`预约备注（可填到达时间等）：\n${ev.title}  ${ev.start.toLocaleString('zh-CN')}`);
        const r = await callAPI('bookSlot', {
          slotId: ev.id,
          studentId: currentUser.userId,
          studentName: currentUser.name || '',
          note: note || ''
        });
        if (r && r.success) {
          alert('预约成功'); mainCalendar.refetchEvents();
        } else {
          alert(r?.message || '预约失败');
        }
      } else {
        showEventDetails(info.event);
      }
    }
  });

  mainCalendar.render();

  // 跨断点时自动切视图
  let lastMobile = window.innerWidth <= BREAKPOINT;
  window.addEventListener('resize', () => {
    if (!mainCalendar) return;
    const isMobile = window.innerWidth <= BREAKPOINT;
    if (isMobile !== lastMobile) {
      mainCalendar.changeView(isMobile ? 'timeGridDay' : 'timeGridWeek');
      lastMobile = isMobile;
    }
  });

  // 初次加载事件
  if (currentUser) {
    mainCalendar.refetchEvents();
  }
}

/* ================= 数据与个人信息 ================= */
function updateTodayStats() {
  // 先放静态占位，确认渲染通路
  const byId = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  byId('todayCourses', '2');
  byId('todayConsultations', '1');
  byId('todayReminders', '3');
  byId('attendanceRate', '95%');
}

async function loadUserProfile() {
  const loading = document.getElementById('profileLoading');
  const content = document.getElementById('profileContent');
  try {
    if (loading) loading.style.display = 'block';
    if (content) content.style.display = 'none';
    const info = await callAPI('getCurrentUserInfo', { userId: currentUser.userId });
    displayUserProfile(info || currentUser || {});
  } catch (e) {
    console.error('加载个人信息失败', e);
  } finally {
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
  }
}

function displayUserProfile(info) {
  const basic = document.getElementById('basicInfo');
  if (!basic) return;
  basic.innerHTML = `
    <div class="profile-item"><label>用户ID:</label><span>${info.username || info.userId || ''}</span></div>
    <div class="profile-item"><label>姓名:</label><span>${info.name || ''}</span></div>
    <div class="profile-item"><label>所属:</label><span>${info.department || ''}</span></div>
    <div class="profile-item"><label>专业:</label><span>${info.major || ''}</span></div>
    <div class="profile-item"><label>身份:</label><span>${info.role || ''}</span></div>
  `;
}

/* ================= 标签页切换 ================= */
function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const targetBtn = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
  if (targetBtn) targetBtn.classList.add('active');

  document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
  const panelMap = { calendar: 'calendarPanel', analysis: 'analysisPanel', profile: 'profilePanel' };
  const panelId = panelMap[tabName];
  if (panelId) document.getElementById(panelId)?.classList.add('active');

  if (tabName === 'calendar' && mainCalendar) {
    // 重新布局，避免隐藏后尺寸异常
    setTimeout(() => mainCalendar.updateSize(), 0);
  }
}

/* ================= 辅助：事件详情 ================= */
function showEventDetails(event) {
  const lines = [];
  lines.push(`标题: ${event.title}`);
  lines.push(`时间: ${event.start.toLocaleString('zh-CN')}`);
  if (event.end) lines.push(`结束: ${event.end.toLocaleString('zh-CN')}`);
  const ext = event.extendedProps || {};
  if (ext.attr) lines.push(`类型: ${ext.attr}`);
  if (ext.status) lines.push(`状态: ${ext.status}`);
  alert(lines.join('\n'));
}

/* ================= API 连接自检（显示在登录框下） ================= */
async function testAPIConnection() {
  const errDiv = document.getElementById('loginError');
  try {
    errDiv.style.color = '#6b7280';
    errDiv.textContent = '正在检测服务器连接…';
    const t0 = Date.now();
    const r = await callAPI('testConnection');
    if (r && r.success) {
      const ms = Date.now() - t0;
      errDiv.style.color = 'green';
      errDiv.textContent = `API连接成功 · ${r.spreadsheetName || ''} · 响应 ${ms}ms · 用户表 ${r.userCount ?? '-'} 条`;
    } else {
      errDiv.style.color = 'red';
      errDiv.textContent = r?.message || '服务器无响应';
    }
  } catch (e) {
    errDiv.style.color = 'red';
    errDiv.textContent = '连接失败：' + e;
  }
}

/* ================= 入口绑定 ================= */
document.addEventListener('DOMContentLoaded', () => {
  // 登录/注册/退出
  document.getElementById('loginBtn')?.addEventListener('click', login);
  document.getElementById('loginUsername')?.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
  document.getElementById('registerBtn')?.addEventListener('click', register);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  // 登录与注册切换
  document.getElementById('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  document.getElementById('showLoginBtn')?.addEventListener('click', showLoginForm);

  // 顶部功能按钮
  document.getElementById('refreshDataBtn')?.addEventListener('click', () => {
    if (currentUser) mainCalendar?.refetchEvents();
    updateTodayStats();
  });
  document.getElementById('analysisBtn')?.addEventListener('click', () => switchTab('analysis'));
  document.getElementById('profileBtn')?.addEventListener('click', () => switchTab('profile'));
  document.getElementById('helpBtn')?.addEventListener('click', () => {
    alert('使用帮助：\n1) 登录后查看个人/课程安排\n2) 老师可使用“老师登记”面板发布时段\n3) 学生点击日历时段可预约（可约状态）');
  });

  // 标签页
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // API自检
  testAPIConnection();

  // 初始化“分析页”的默认月份（不阻塞登录）
  const now = new Date();
  const ym = now.toISOString().slice(0,7);
  const $start = document.getElementById('startMonth');
  const $end = document.getElementById('endMonth');
  if ($start) $start.value = ym;
  if ($end) $end.value = ym;
});