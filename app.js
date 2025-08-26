
/* =============== 基础配置（按你现有 API） =============== */
const API_URL = 'https://script.google.com/macros/s/AKfycbybAvJ1PChJbu2WofPrj2-IrZ4Ro07mBlQQ7TymJRtadT0UiXfL1jQbcc3yYuXHaXw/exec';

// 所属 → 专业（学科逻辑顺序，互不混合）
const MAJOR_OPTIONS = {
  '理科大学院': [
    '机械',        // 工学基础
    '电子电器',    // 电气/信息硬件
    '生物化学',    // 生命理学
    '情报学'       // 信息学（软件/数据）
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
  // —— 采集“专业”：文/理 → 下拉；其他 → 自由填写 —— //
  const majorSel  = document.getElementById('registerMajorSelect');
  const majorFree = document.getElementById('registerMajorFree');
  const major = (department === '其他')
    ? (majorFree ? majorFree.value.trim() : '')
    : (majorSel  ? majorSel.value.trim()  : '');

  // —— 校验 —— //
  if (!name || !email || !department || !role) {
    err.textContent = '请填写姓名、邮箱、所属、身份';
    return;
  }
  if (department === '其他' && !major) {
    err.textContent = '所属为“其他”时，请填写专业'; return;
  }
  if (department !== '其他' && !major) {
    err.textContent = '请选择一个专业'; return;
  }
  const role = $('registerRole').value;
  const err = $('registerError');
  if (!name || !email || !department || !major || !role) { err.textContent='请填写姓名、邮箱、所属、专业、身份'; return; }
  err.style.color=''; err.textContent='正在登记…';
  const r = await callAPI('registerByProfile', { name, email, department, major, role });
  if (r && r.success) {
    err.style.color = 'green';
    // —— 成功提示：老师/学生分开 —— //
    if ((role || '').indexOf('老师') > -1) {
      err.textContent = '已完成注册，等待管理员分配用户ID';
    } else {
      err.textContent = '已完成注册，等待老师分配ID';
    }
    // （是否清空表单、是否跳回登录，按你原有代码保留）
  } else {
    err.style.color = '#c00';
    err.textContent = (r && r.message) ? r.message : '登记失败（无返回信息）';
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

function recordClickLog(ev) {
  try {
    var key = 'edsched_clickLogs';
    var ext = ev.extendedProps || {};
    var item = {
      slotId: ext.slotId || ev.id || '',
      title: ev.title || '',
      start: ev.start ? ev.start.toISOString() : '',
      end:   ev.end   ? ev.end.toISOString()   : '',
      userId: (window.currentUser && window.currentUser.userId) || '',
      ts: new Date().toISOString()
    };
    var dayKey = item.start ? item.start.slice(0,10) : new Date().toISOString().slice(0,10);
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch(_) {}
    var dup = arr.some(function(x){
      return (x.slotId === item.slotId) && (x.userId === item.userId) && (String(x.start).slice(0,10) === dayKey);
    });
    if (!dup) {
      arr.push(item);
      localStorage.setItem(key, JSON.stringify(arr));
      alert('已记录本次预约意向。');
    } else {
      alert('今天已记录过该课程。');
    }
    return true;
  } catch (e) {
    alert('记录失败：' + e.message);
    return false;
  }
}


/* =============== 日历 =============== */
function initCalendar() {
  const el = $('mainCalendar'); if (!el) return;
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  const cal = new FullCalendar.Calendar(el, {
    eventClick: function(info) {
    // 如果点的是“预约”按钮，就不触发弹层
    var t = info.jsEvent && info.jsEvent.target;
    if (t && t.closest && t.closest('.fc-book-btn')) return;

    // 点事件其他区域 → 打开详情弹层（如果你已定义了 openCourseDetail）
    if (typeof openCourseDetail === 'function') {
      openCourseDetail(info.event);
    } else {
      // 兜底：还没接入弹层时，维持原先的 alert 行为
      var ev = info.event, ext = ev.extendedProps || {};
      var s = ev.start ? ev.start.toLocaleString('zh-CN') : '';
      var e = ev.end   ? ev.end.toLocaleString('zh-CN')   : '';
      alert('课程：' + (ev.title || '') + '\n时间：' + s + ' ~ ' + e);
    }
  },

  // 新增：为每个事件渲染一个“预约”按钮（右上角）
  eventContent: function(arg) {
  var root = document.createElement('div');
  root.style.position = 'relative';

  // 月视图给按钮预留空间，避免与标题重叠
  if (arg.view && arg.view.type === 'dayGridMonth') {
    root.style.paddingRight = '40px';
  }

  var title = document.createElement('div');
  title.textContent = arg.event.title || '';
  title.style.pointerEvents = 'none';
  root.appendChild(title);

  // 仅对「面谈 / VIP」显示按钮（不再使用 status === '可预约'）
  var ext = arg.event.extendedProps || {};
  var attr = String(ext.attr || '');
  var bookable = (attr.indexOf('面谈') > -1) || (attr.toUpperCase().indexOf('VIP') > -1);

  if (!bookable) {
    return { domNodes: [root] };  // 非面谈/VIP，无按钮，只显示标题
  }

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fc-book-btn';
  btn.textContent = (String(ext.status || '') === '已预约') ? '已预约' : '预约';
  if (ext.status === '已预约') {
    btn.disabled = true;
    btn.classList.add('fc-book-btn--done');
  }

  btn.style.cssText = 'position:absolute;top:2px;right:2px;padding:2px 6px;font-size:' +
                      ((arg.view && arg.view.type === 'dayGridMonth') ? '11px' : '12px') +
                      ';line-height:1;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;';

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();

    // 1) 本地记录
    var ok = recordClickLog(arg.event);

    // 2) 回写表：把课程状态设为“已预约”，失败不影响本地记录
    (async function(){
      try {
        var payload = {
          slotId: (ext.slotId || arg.event.id || ''),
          status: '已预约'
        };
        var res = await callAPI('updateCourseStatus', payload);
        // 兼容 {ok:true} 或直接返回对象/数组
        var okServer = res && (res.ok === true || res.status === 'ok');
        if (okServer) {
          // 更新本地事件状态
          try { arg.event.setExtendedProp('status', '已预约'); } catch(_) {
            (arg.event.extendedProps || {}).status = '已预约';
          }
        }
      } catch(_) { /* 忽略网络/权限异常 */ }
      // 无论成功失败，按钮置为已预约态（与本地记录一致）
      btn.disabled = true;
      btn.textContent = '已预约';
      btn.classList.add('fc-book-btn--done');
    })();
  });

  root.appendChild(btn);
  return { domNodes: [root] };
},

  // —— 下面继续保留你其余既有配置 —— 
  initialView,
  locale: 'zh-cn',
  firstDay: 1,
  height: 'auto',
  headerToolbar: false,
  allDaySlot: false,
  slotMinTime: '08:00:00',
  slotMaxTime: '22:00:00',
  slotDuration: '00:30:00',
  expandRows: true,
  datesSet: updateCalendarTitle,

    // ★ 新增：由 FullCalendar 主动拉取你的 API
    events: async function(info, success, failure) {
      try {
        const viewStart = info.startStr ? info.startStr.slice(0,10) : '';
        const viewEnd   = info.endStr   ? info.endStr.slice(0,10)   : '';
        const params = {
          userId: (currentUser && currentUser.userId) ? currentUser.userId : '',
          viewStart, viewEnd,
          debugNoAuth: !currentUser   // 允许未登录自测
        };
        const res  = await callAPI('listVisibleSlots', params);
        const rows = Array.isArray(res) ? res : (res && res.data) ? res.data : [];
        // 你的后端已按 FullCalendar 事件结构返回，可直接给 success
        success(rows);
      } catch (err) {
        failure && failure(err);
      }
      
    }
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
  if (!calendar) return;
  // 新：统一交给 FullCalendar 触发拉取逻辑
  try { calendar.refetchEvents(); } catch {}

  // 旧逻辑（保留以备回退）
  /*
  const view = calendar.view;
  const viewStart = view.currentStart ? view.currentStart.toISOString().slice(0,10) : '';
  const viewEnd   = view.currentEnd   ? view.currentEnd.toISOString().slice(0,10)   : '';
  const params = {
    userId: (currentUser && currentUser.userId) ? currentUser.userId : '',
    viewStart, viewEnd,
    debugNoAuth: !currentUser
  };
  const res = await callAPI('listVisibleSlots', params);
  const rows = Array.isArray(res) ? res : (res?.data || []);
  calendar.removeAllEvents();
  rows.forEach(ev => calendar.addEvent(ev));
  updateTodayStats();
  */
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

  $('refreshDataBtn')?.addEventListener('click', ()=> { calendar?.refetchEvents(); });
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

  // —— 注册表单：所属部门 → 专业 联动（极简，不记历史）——
  (function () {
    const depSel    = document.getElementById('registerDepartment');
    const majorSel  = document.getElementById('registerMajorSelect'); // 下拉
    const majorFree = document.getElementById('registerMajorFree');   // 自由填写
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
        // 文/理：使用下拉
        majorFree.style.display = 'none';
        majorSel.style.display  = '';
        fill(list);
        majorSel.value = '';      // 每次切换都要求重新选择
        majorFree.value = '';     // 清空自由输入的残留
      } else {
        // 其他：只允许自由填写
        majorSel.style.display  = 'none';
        majorFree.style.display = '';
        majorSel.innerHTML = '<option value="">选择专业</option>'; // 清空下拉
        majorSel.value = '';
        majorFree.value = '';     // 切换到“其他”时也清空
      }
    };

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
