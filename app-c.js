/* =============== 基础配置 =============== */
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
  const role = $('registerRole').value;
  const err = $('registerError');
  
  // 采集专业：文/理 → 下拉；其他 → 自由填写
  const majorSel  = document.getElementById('registerMajorSelect');
  const majorFree = document.getElementById('registerMajorFree');
  const major = (department === '其他')
    ? (majorFree ? majorFree.value.trim() : '')
    : (majorSel  ? majorSel.value.trim()  : '');

  // 校验
  if (!name || !email || !department || !role) {
    err.textContent = '请填写姓名、邮箱、所属、身份';
    return;
  }
  if (department === '其他' && !major) {
    err.textContent = '所属为"其他"时，请填写专业'; return;
  }
  if (department !== '其他' && !major) {
    err.textContent = '请选择一个专业'; return;
  }
  
  err.style.color=''; err.textContent='正在登记…';
  const r = await callAPI('registerByProfile', { name, email, department, major, role });
  if (r && r.success) {
    err.style.color = 'green';
    if ((role || '').indexOf('老师') > -1) {
      err.textContent = '已完成注册，等待管理员分配用户ID';
    } else {
      err.textContent = '已完成注册，等待老师分配ID';
    }
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
function resolvePageIdForRole(pageId) {
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

  // 三套导航容器互斥显示
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
    showPage('calendar');
  }
}

/* =============== 日历 =============== */
function initCalendar() {
  const el = $('mainCalendar'); if (!el) return;
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  const cal = new FullCalendar.Calendar(el, {
    eventClick: function(info) {
      const ev = info.event;
      const ext = ev.extendedProps || {};
      const t = ev.title || '';
      const s = ev.start ? ev.start.toLocaleString('zh-CN') : '';
      const e = ev.end   ? ev.end.toLocaleString('zh-CN')   : '';
      const teacher = ext.teacher ? `\n任课老师：${ext.teacher}` : '';
      const sid = ext.slotId ? `\n槽位ID：${ext.slotId}` : '';
      alert(`课程：${t}\n时间：${s} ~ ${e}${teacher}${sid}`);
    },
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

    // FullCalendar 主动拉取 API 数据
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
  try { calendar.refetchEvents(); } catch {}
}

function updateTodayStats(){
  // 占位（不连后台统计）
  $('todayCourses').textContent = $('todayCourses').textContent || '0';
  $('todayConsultations').textContent = $('todayConsultations').textContent || '0';
  $('todayReminders').textContent = $('todayReminders').textContent || '0';
  $('attendanceRate').textContent = $('attendanceRate').textContent || '—';
}

/* =============== 顶部按钮与视图切换 =============== */
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

/* =============== 课程发布功能 =============== */
async function publishCourse() {
  const rootSel = '#pub-course [data-module="publish-course"]';
  const root = document.querySelector(rootSel);
  if (!root) return alert('未找到发布表单');

  // fieldset 顺序：0=基本信息，1=时间与重复，2=上课形式与地点，3=讲义/备注
  const sets = root.querySelectorAll('fieldset');
  const fs1 = sets[0], fs2 = sets[1], fs3 = sets[2], fs4 = sets[3];

  // 基本信息
  const courseName = fs1.querySelector('input[placeholder="例如：社会学专业课"]')?.value.trim() || '';
  const teacher    = fs1.querySelector('input[placeholder="老师姓名或ID"]')?.value.trim() || '';
  const selects1   = fs1.querySelectorAll('select');
  const courseAttr = selects1[0]?.value || '';
  const dep        = document.getElementById('pubDepartment')?.value || '';
  const scheduleStatus = fs1.querySelector('select:last-of-type')?.value || '';

  // 发布对象专业（多选）
  const majorSel = document.getElementById('pubMajor');
  const selectedMajors = majorSel && !majorSel.disabled
    ? Array.from(majorSel.selectedOptions).map(o => o.value).filter(Boolean)
    : [];

  // 生成要提交的 majors：
  let majorsOut;
  if (!dep || dep === '全部') {
    majorsOut = ['全部'];
  } else if (selectedMajors.length > 0) {
    majorsOut = selectedMajors;
  } else {
    majorsOut = [dep];
  }

  // 可见学生IDs：优先用"学生姓名"输入；为空则默认=所属/专业
  const studentRaw = fs1.querySelector('input[placeholder="学生姓名或ID"]')?.value.trim() || '';
  let visibleIds = studentRaw ? studentRaw.split(/[,\s，、]+/).filter(Boolean) : [];
  if (visibleIds.length === 0) visibleIds = majorsOut;

  // 时间与重复
  const dates      = fs2.querySelectorAll('input[type="date"]');
  const singleDate = dates[0]?.value || '';
  const rangeStart = dates[1]?.value || '';
  const rangeEnd   = dates[2]?.value || '';
  const dateRange  = (rangeStart && rangeEnd) ? `${rangeStart}~${rangeEnd}` : '';

  const weekdays   = fs2.querySelector('input[placeholder="如：一,三,五"]')?.value.trim() || '';
  const countStr   = fs2.querySelector('input[type="number"]')?.value || '';
  const count      = countStr ? Number(countStr) : '';

  const times      = fs2.querySelectorAll('input[type="time"]');
  const startTime  = times[0]?.value || '';
  const endTime    = times[1]?.value || '';
  const breakMins  = fs2.querySelector('input[placeholder="如：10分钟（可选）"]')?.value.trim() || '';

  // 上课形式与地点
  const selects3   = fs3.querySelectorAll('select');
  const classMode  = selects3[0]?.value || '';
  const campus     = selects3[1]?.value || '';
  const classroom  = fs3.querySelector('input[placeholder="如：A-301"]')?.value.trim() || '';
  const onlineLink = fs3.querySelector('input[placeholder="https://..."]')?.value.trim() || '';

  // 讲义/备注
  const handoutUrl = fs4.querySelector('input[placeholder="可填链接或简单备注"]')?.value.trim() || '';

  // 最小校验
  const err = (m)=>alert(m);
  const hasRange  = !!(rangeStart && rangeEnd);
  const hasSingle = !!singleDate;
  if (!courseAttr)            return err('请选择课程属性');
  if (!courseName)            return err('请填写课程名');
  if (!teacher)               return err('请填写任课老师');
  if (!(hasSingle || hasRange)) return err('请选择单回日期或填写复数区间');
  if (!startTime || !endTime) return err('请填写开始/结束时间');
  if (!scheduleStatus)        return err('请选择课程状态');
  if (!visibleIds.length)     return err('可见学生IDs缺失');

  // 构造 payload
  const payload = {
    coursename: courseName,
    attr:       courseAttr,
    teacher,
    singledate: singleDate,
    daterange:  dateRange,
    weekdays,
    count,
    starttime:  startTime,
    endtime:    endTime,
    breakmins:  breakMins,
    majors: majorsOut,
    visiblestudentids: visibleIds,
    campus,
    classmode:  classMode,
    classroom,
    onlinelink: onlineLink,
    handouturl: handoutUrl,
    schedulestatus: scheduleStatus
  };

  // 调用后端
  try {
    const res = await callAPI('publishSlots', payload);
    alert(res && res.success ? '发布成功' : ('发布失败：' + (res && res.message ? res.message : '未知错误')));
    if (res && res.success) {
      // 发布成功后刷新日历
      calendar?.refetchEvents();
    }
  } catch (e) {
    alert('网络异常：' + e.message);
  }
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

  // 注册表单：所属部门 → 专业 联动
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
        // 文/理：使用下拉
        majorFree.style.display = 'none';
        majorSel.style.display  = '';
        fill(list);
        majorSel.value = '';
        majorFree.value = '';
      } else {
        // 其他：只允许自由填写
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

  // 发布对象：所属 → 专业（多选；所属=全部/未选时禁用专业）
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
      if (flag) {
        Array.from(majorSel.options).forEach(o => o.selected = false);
      }
    };

    const apply = () => {
      const dep  = depSel.value || '';
      if (!dep || dep === '全部') {
        fill([]);
        disableMajor(true);
        return;
      }
      const list = MAJOR_OPTIONS[dep];
      fill(Array.isArray(list) ? list : []);
      disableMajor(false);
    };

    // 关键：让多选无需按 Ctrl，点一下就切换选中
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

  // 绑定课程发布按钮
  const pubBtn = document.querySelector('#pub-course [data-module="publish-course"] .btn.btn-primary');
  if (pubBtn) {
    pubBtn.addEventListener('click', publishCourse);
  }

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
