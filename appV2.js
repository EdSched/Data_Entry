/************* 配置 *************/
const API_URL = 'https://script.google.com/macros/s/AKfycbwJYf3jeNAF37vgVXTiWnEgYS5dlh9l9UChkiEhThh4OwV3TVEvP3ZtIS8bpm5G3HLf/exec';
const BREAKPOINT = 768; // <=768: 手机视图=当天；>768: 周视图

/************* 全局状态 *************/
let currentUser = null;
let mainCalendar = null;

/************* 通用 API *************/
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
    // Apps Script 可能混入日志，这里剥出 JSON
    let clean = text.trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) clean = clean.substring(s, e + 1);
    return JSON.parse(clean);
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

/************* 登录 / 注册 / 退出 *************/
async function login() {
  const $u = document.getElementById('loginUsername');
  const $err = document.getElementById('loginError');
  const username = ($u?.value || '').trim();

  if (!username) { if ($err) $err.textContent = '请输入用户ID'; return; }
  if ($err) { $err.style.color = '#6b7280'; $err.textContent = '正在登录…'; }

  const r = await callAPI('loginByUsername', { username });
  if (r && r.success) {
    currentUser = r.user || {};
    currentUser.userId = currentUser.username || username;

    // 切主界面
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    // 顶部欢迎文案
    const greet = document.getElementById('userGreeting');
    const role = document.getElementById('userRole');
    if (greet) greet.textContent = `欢迎，${currentUser.name || currentUser.userId}`;
    if (role)  role.textContent  = `(${currentUser.role || ''})`;

    // 老师/管理员显示“老师登记”
    const isTeacher = (currentUser.role === '老师' || String(currentUser.userId).startsWith('T'));
    const isAdmin   = String(currentUser.userId).startsWith('A');
    const publishPanel = document.getElementById('publishPanel');
    if (publishPanel) publishPanel.style.display = (isTeacher || isAdmin) ? 'block' : 'none';

    // 初始化极简主页：只一个日历，下面用原有按钮当“子页面入口”
    initCalendar();
    wireSubpageButtons();

    // 个人信息懒加载（避免阻塞）
    loadUserProfile();
  } else {
    if ($err) { $err.style.color = 'red'; $err.textContent = (r && r.message) ? String(r.message) : '登录失败'; }
  }
}

async function register() {
  const name = (document.getElementById('registerName')?.value || '').trim();
  const email = (document.getElementById('registerEmail')?.value || '').trim();
  const department = document.getElementById('registerDepartment')?.value || '';
  const major = (document.getElementById('registerMajor')?.value || '').trim();
  const role = document.getElementById('registerRole')?.value || '';
  const $err = document.getElementById('registerError');

  if (!name || !email || !department || !major || !role) {
    if ($err) $err.textContent = '请填写姓名、邮箱、所属、专业、身份'; 
    return;
  }
  if ($err) { $err.style.color = '#6b7280'; $err.textContent = '正在登记…'; }

  const r = await callAPI('registerByProfile', { name, email, department, major, role });
  if (r && r.success) {
    if ($err) { $err.style.color = 'green'; $err.textContent = '登记成功！请向老师索取“用户ID”登录。'; }
    setTimeout(showLoginForm, 1200);
  } else {
    if ($err) { $err.style.color = 'red'; $err.textContent = r?.message || '登记失败'; }
  }
}

function logout() {
  currentUser = null;
  try { mainCalendar?.destroy(); } catch(_) {}
  mainCalendar = null;

  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginContainer').style.display = 'flex';
  const $err = document.getElementById('loginError');
  if ($err) { $err.style.color = '#6b7280'; $err.textContent = ''; }
  document.getElementById('loginUsername').value = '';
}

/************* 视图切换（保持你HTML结构不变） *************/
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

/************* 极简主页：单实例 FullCalendar *************/
function initialView() {
  return (window.innerWidth <= BREAKPOINT) ? 'timeGridDay' : 'timeGridWeek';
}

function initCalendar() {
  const el = document.getElementById('mainCalendar');
  if (!el) return;

  // 只保留一个日历实例
  try { mainCalendar?.destroy(); } catch(_) {}
  mainCalendar = new FullCalendar.Calendar(el, {
    locale: 'zh-cn',
    initialView: initialView(),
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' },
    buttonText: { today: '今天', day: '日', week: '周', month: '月' },
    allDaySlot: false,
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    scrollTime: '09:00:00',
    height: 'auto',
    expandRows: true,
    events: async (_info, success, failure) => {
      try {
        if (!currentUser) { success([]); return; }
        const evs = await callAPI('listVisibleSlots', { userId: currentUser.userId });
        success(Array.isArray(evs) ? evs : []);
      } catch (e) { failure(e); }
    },
    eventClick: (info) => {
      const ev = info.event, ext = ev.extendedProps || {};
      alert(`标题：${ev.title}\n时间：${ev.start.toLocaleString('zh-CN')}${ev.end ? ' - ' + ev.end.toLocaleString('zh-CN') : ''}\n类型：${ext.attr || ''}\n状态：${ext.status || ''}`);
    }
  });
  mainCalendar.render();

  // 跨断点自动切换（手机↔桌面）
  let lastMobile = window.innerWidth <= BREAKPOINT;
  window.addEventListener('resize', () => {
    if (!mainCalendar) return;
    const isMobile = window.innerWidth <= BREAKPOINT;
    if (isMobile !== lastMobile) {
      mainCalendar.changeView(isMobile ? 'timeGridDay' : 'timeGridWeek');
      lastMobile = isMobile;
    }
  });

  // —— 关键：把其它面板“淡出”为子页面入口 —— //
  // 左侧“小日历 / 今日概览 / 老师登记”保持原位；你可以挂子页面链接到下面这些按钮：
  wireSubpageButtons();
}

/************* 把侧栏按钮当“子页面入口” *************/
function wireSubpageButtons() {
  // 你可以改成真实的子页面 URL
  const to = (url) => () => { window.location.href = url; };

  document.getElementById('analysisBtn')?.addEventListener('click', to('analysis.html'));
  document.getElementById('profileBtn') ?.addEventListener('click', to('profile.html'));
  // 老师登记 → publish.html（仅老师/管理员可见，显示控制已在 login() 里）
  // 刷新数据仍保留当前页行为
  document.getElementById('refreshDataBtn')?.addEventListener('click', () => {
    try { mainCalendar?.refetchEvents(); } catch(_) {}
  });
}

/************* 个人信息（保持你原逻辑） *************/
async function loadUserProfile() {
  try {
    document.getElementById('profileLoading')?.setAttribute('style','display:block');
    document.getElementById('profileContent')?.setAttribute('style','display:none');
    const info = await callAPI('getCurrentUserInfo', { userId: currentUser.userId });
    const data = info || currentUser || {};
    const basic = document.getElementById('basicInfo');
    if (basic) {
      basic.innerHTML = `
        <div class="profile-item"><label>用户ID:</label><span>${data.username || data.userId || ''}</span></div>
        <div class="profile-item"><label>姓名:</label><span>${data.name || ''}</span></div>
        <div class="profile-item"><label>所属:</label><span>${data.department || ''}</span></div>
        <div class="profile-item"><label>专业:</label><span>${data.major || ''}</span></div>
        <div class="profile-item"><label>身份:</label><span>${data.role || ''}</span></div>
      `;
    }
  } catch (e) {
    // 静默失败，不影响主页
    console.warn('loadUserProfile error:', e);
  } finally {
    document.getElementById('profileLoading')?.setAttribute('style','display:none');
    document.getElementById('profileContent')?.setAttribute('style','display:block');
  }
}

/************* API 自检：直接显示在登录框下面 *************/
async function testAPIConnection() {
  const $err = document.getElementById('loginError');
  if (!$err) return;
  try {
    $err.style.color = '#6b7280';
    $err.textContent = '正在检测服务器连接…';
    const t0 = Date.now();
    const r = await callAPI('testConnection');
    if (r && r.success) {
      const ms = Date.now() - t0;
      $err.style.color = 'green';
      $err.textContent = `API连接成功 · ${r.spreadsheetName || ''} · 响应 ${ms}ms · 用户表 ${r.userCount ?? '-'} 条`;
    } else {
      $err.style.color = 'red';
      $err.textContent = r?.message || '服务器无响应';
    }
  } catch (e) {
    $err.style.color = 'red';
    $err.textContent = '连接失败：' + e;
  }
}

/************* 入口绑定（不改你的 HTML） *************/
document.addEventListener('DOMContentLoaded', () => {
  // 登录与注册
  document.getElementById('loginBtn')?.addEventListener('click', login);
  document.getElementById('loginUsername')?.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
  document.getElementById('registerBtn')?.addEventListener('click', register);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  // 登录/注册切换
  document.getElementById('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  document.getElementById('showLoginBtn')?.addEventListener('click', showLoginForm);

  // 默认选中“日历视图”页（你的 HTML 已是 active）
  // 这里不动 nav-tab 的逻辑，保持你现状

  // 自检 API，方便你立刻看到“能不能连上”
  testAPIConnection();

  // 初始化“分析页”的默认月份，以防用到（不影响主页）
  const now = new Date(); const ym = now.toISOString().slice(0,7);
  const $start = document.getElementById('startMonth');
  const $end   = document.getElementById('endMonth');
  if ($start) $start.value = ym;
  if ($end)   $end.value = ym;
});