/* =============== 基础配置 =============== */
const API_URL = 'https://script.google.com/macros/s/AKfycbwew2T6Scwk5HGbNcf4wh-gmcXyJW6YULKGHEvyNQLA5SQ-fjB_epdNbSxdbb0Se2w/exec';

// 所属 → 专业
const MAJOR_OPTIONS = {
  '理科大学院': ['机械','电子电器','生物化学','情报学'],
  '文科大学院': ['文学','历史学','社会学','社会福祉学','新闻传播学','表象文化','经营学','经济学','日本语教育']
};

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
    userId: u.userid || u.userId || u.username || u.id || fallbackId || '',
    name: u.name || u.realName || u.displayName || '',
    role: u.role || u.identity || '',
    department: u.affiliation || u.department || u.dept || '',
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
const navLinks = [];

/* =============== 登录 / 注册 / 登出 =============== */
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
  const userid = ($('loginUsername').value || '').trim();
  const err = $('loginError');
  if (!userid) { err.textContent = '请输入用户ID'; return; }
  err.style.color=''; err.textContent='正在登录…';
  const r = await callAPI('loginByUserid', { userid });
  if (r && (r.success || r.ok)) {
    currentUser = normalizeUser(r.user, userid);
    $('loginContainer').style.display = 'none';
    $('mainApp').style.display = 'block';
    try{ window.location.hash = '#app'; }catch{}
    updateUserUI();
  } else {
    err.style.color='#c00';
    err.textContent = (r && (r.message || r.msg)) || '登录失败：用户ID不存在';
  }
}

async function registerUser(evt){
  evt?.preventDefault?.();
  const $ = id => document.getElementById(id);
  const err        = $('registerError');
  const name       = $('registerName').value.trim();
  const email      = $('registerEmail').value.trim();
  const department = $('registerDepartment').value.trim();
  const role       = $('registerRole').value.trim();
  const majorSel   = $('registerMajorSelect')?.value?.trim() || '';
  const majorFree  = $('registerMajorFree')?.value?.trim() || '';
  const major      = (department === '其他') ? majorFree : majorSel;

  if (!name || !email || !department || !role) {
    err.style.color = '#c00';
    err.textContent = '请填写姓名、邮箱、所属、身份';
    return;
  }
  if (department === '其他' && !major) {
    err.style.color = '#c00';
    err.textContent = '所属为"其他"时，请填写专业';
    return;
  }
  if (department !== '其他' && !major) {
    err.style.color = '#c00';
    err.textContent = '请选择一个专业';
    return;
  }

  err.style.color = '';
  err.textContent = '正在登记…';

  try {
    const r = await callAPI('registerByProfile', { name, email, department, major, role });
    if (r && r.success) {
      err.style.color = 'green';
      err.textContent = (role.indexOf('老师') > -1)
        ? '已完成注册，等待管理员分配用户ID'
        : '已完成注册，等待老师分配ID';
    } else {
      err.style.color = '#c00';
      err.textContent = (r && r.message) ? r.message : '登记失败（无返回信息）';
    }
  } catch (error) {
    err.style.color = '#c00';
    err.textContent = '网络错误: ' + error.message;
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

/* =============== 角色导航与页面切换 =============== */
function resolvePageIdForRole(pageId) {
  return pageId;
}

function showPage(pageIdRaw) {
  const pageId = resolvePageIdForRole(pageIdRaw);
  document.querySelectorAll('.page-content').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const panel = document.getElementById(pageId + 'Page');
  if (panel) { panel.style.display = 'block'; panel.classList.add('active'); }
  navLinks.forEach(a => a.classList.remove('active'));
  const active = document.querySelector(`.nav-link[data-page="${pageIdRaw}"]`);
  if (active) active.classList.add('active');

  // 预约功能调用
  if (pageId === 'mycourses' && window.bookingModule) {
    setTimeout(() => window.bookingModule.loadMyConfirmations(), 100);
  }
}

function updateUserUI() {
  if (!currentUser) return;
  currentUser.roleNorm = normalizeRole(currentUser);
  $('userGreeting').textContent = '欢迎，' + (currentUser.name || currentUser.userId);
  $('userRole').textContent = '(' + (currentUser.role || '') + ')';

  const ns = $('nav-student'), nt = $('nav-teacher'), na = $('nav-admin');
  ns && (ns.style.display = currentUser.roleNorm === 'student' ? '' : 'none');
  nt && (nt.style.display = currentUser.roleNorm === 'teacher' ? '' : 'none');
  na && (na.style.display = currentUser.roleNorm === 'admin'   ? '' : 'none');

  // 登录后默认跳到各角色的首要确认页
  const dashMap = { student: 'dashboardStudent', teacher: 'dashboardTeacher', admin: 'dashboardAdmin' };
  const defaultPage = dashMap[currentUser.roleNorm] || 'dashboardTeacher';
  showPage(defaultPage);

  // 高亮对应导航链接
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-page="${defaultPage}"]`);
  if (activeLink) activeLink.classList.add('active');
}

/* =============== 首要确认：勾选交互 =============== */
function updateDashBadge_(list) {
  if (!list) return;
  const panel = list.closest('.dash-panel');
  if (!panel) return;
  const badge = panel.querySelector('.dash-badge');
  if (!badge) return;
  const undone = list.querySelectorAll('.task-item[data-done="false"]').length;
  badge.textContent = undone > 0 ? undone : '';
}

/* =============== 初始化 =============== */
document.addEventListener('DOMContentLoaded', async () => {

  // 导航点击
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

  // 首要确认：勾选交互
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.task-check');
    if (!btn) return;
    const item = btn.closest('.task-item');
    if (!item) return;
    const done = item.dataset.done === 'true';
    item.dataset.done = done ? 'false' : 'true';
    const list = item.closest('.task-list');
    if (list) {
      if (!done) list.appendChild(item);
      else list.prepend(item);
    }
    updateDashBadge_(list);
  });

  // 手机端：面板折叠/展开
  document.addEventListener('click', (e) => {
    const header = e.target.closest('.dash-panel-header');
    if (!header) return;
    if (window.matchMedia('(min-width:601px)').matches) return;
    const panel = header.closest('.dash-panel');
    if (panel) panel.classList.toggle('collapsed');
  });

  // 注册表单：所属 → 专业联动
  (function () {
    const depSel    = document.getElementById('registerDepartment');
    const majorSel  = document.getElementById('registerMajorSelect');
    const majorFree = document.getElementById('registerMajorFree');
    if (!depSel || !majorSel || !majorFree) return;

    const fill = (arr) => {
      majorSel.innerHTML =
        '<option value="">选择专业</option>' +
        (arr || []).map(v => `<option value="${v}">${v}</option>`).join('');
    };
    const apply = () => {
      const dep = depSel.value || '';
      const list = MAJOR_OPTIONS[dep];
      if (Array.isArray(list) && list.length) {
        majorFree.style.display = 'none';
        majorSel.style.display  = '';
        fill(list);
        majorSel.value = '';
        majorFree.value = '';
      } else {
        majorSel.style.display  = 'none';
        majorFree.style.display = '';
        majorSel.innerHTML = '<option value="">选择专业</option>';
        majorSel.value = '';
        majorFree.value = '';
      }
    };
    apply();
    depSel.addEventListener('change', apply);
  })();

  // 发布对象：所属 → 专业联动（多选）
  (function () {
    const depSel   = document.getElementById('pubDepartment');
    const majorSel = document.getElementById('pubMajor');
    if (!depSel || !majorSel) return;

    const fill = (arr) => {
      majorSel.innerHTML =
        '<option value="" disabled>（可不选，可多选）</option>' +
        (arr || []).map(v => `<option value="${v}">${v}</option>`).join('');
    };
    const disableMajor = (flag) => {
      majorSel.disabled = !!flag;
      if (flag) Array.from(majorSel.options).forEach(o => o.selected = false);
    };
    const apply = () => {
      const dep = depSel.value || '';
      if (!dep || dep === '全部') { fill([]); disableMajor(true); return; }
      const list = MAJOR_OPTIONS[dep];
      fill(Array.isArray(list) ? list : []);
      disableMajor(false);
    };
    majorSel.addEventListener('mousedown', (e) => {
      const opt = e.target;
      if (opt && opt.tagName === 'OPTION' && !opt.disabled) {
        e.preventDefault();
        opt.selected = !opt.selected;
      }
    });
    apply();
    depSel.addEventListener('change', apply);
  })();

  // API 健康检查
  setApiStatus({ok:null, text:'API 检测中'});
  try {
    const [r1, r2] = await Promise.allSettled([callAPI('testConnection'), callAPI('ping', {t: Date.now()})]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ok, text: ok ? 'API 连接成功' : 'API 连接异常'});
    if (!ok) {
      const d = $('loginError');
      if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
    }
  } catch {
    setApiStatus({ok:false, text:'API 连接失败'});
    const d = $('loginError');
    if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
  }

  // 移动端抽屉
  (function(){
    const strip = document.getElementById('menuStrip');
    const aside = document.querySelector('aside');
    const main  = document.querySelector('main');
    if (!strip || !aside || !main) return;

    const mq = window.matchMedia('(max-width:600px)');
    const isOpen = () => document.body.classList.contains('mobile-menu-open');

    const open  = ()=>{ document.body.classList.add('mobile-menu-open'); strip.setAttribute('aria-expanded','true');  strip.querySelector('.label').textContent='收起菜单'; };
    const close = ()=>{ document.body.classList.remove('mobile-menu-open'); strip.setAttribute('aria-expanded','false'); strip.querySelector('.label').textContent='展开菜单'; };

    strip.addEventListener('click', (e)=>{ if (!mq.matches) return; e.stopPropagation(); isOpen() ? close() : open(); });
    main.addEventListener('click', (e)=>{ if (!mq.matches || !isOpen()) return; if (aside.contains(e.target) || strip.contains(e.target)) return; close(); });
    const onChange = () => { if (!mq.matches) close(); };
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
  })();
});
