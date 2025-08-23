
// ================== 配置 ==================
const API_URL = 'https://script.google.com/macros/s/AKfycbwJYf3jeNAF37vgVXTiWnEgYS5dlh9l9UChkiEhThh4OwV3TVEvP3ZtIS8bpm5G3HLf/exec';

// ================== 工具 ==================
const $ = (id) => document.getElementById(id);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
function setApiStatus({ok, text}) {
  const dotTop = $('apiDotTop'), txtTop = $('apiTextTop');
  const inline = $('apiStatusInline');
  if (dotTop) dotTop.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
  if (txtTop) txtTop.textContent = text || (ok ? 'API 正常' : (ok===false ? 'API 连接失败' : 'API 检测中'));
  if (inline) {
    const dot = inline.querySelector('.api-dot') || document.createElement('span');
    dot.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
    dot.style.cssText = 'display:inline-block;border-radius:50%;width:8px;height:8px;margin-right:6px;';
    if (!inline.querySelector('.api-dot')) inline.prepend(dot);
    inline.lastChild && (inline.lastChild.nodeType===3 ? inline.lastChild.textContent=' ' : null);
    inline.append(text ? (' ' + text) : (ok ? ' API连接成功' : (ok===false ? ' API连接失败' : ' 正在检测 API 连接…')));
  }
}

// ================== API 调用 ==================
async function callAPI(action, params = {}) {
  try {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('params', JSON.stringify(params));

    // 加一个 8 秒超时，避免长时间无响应
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
    let cleanText = text.trim();
    const s = cleanText.indexOf('{');
    const e = cleanText.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) cleanText = cleanText.substring(s, e + 1);
    return JSON.parse(cleanText);
  } catch (err) {
    return { success:false, message: '网络请求失败: ' + err.message };
  }
}

// ================== 侧边导航与页面切换 ==================
const navLinks = [];
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-link').forEach(link => {
    navLinks.push(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.dataset.page;
      if (pageId) showPage(pageId);
    });
  });
});
function showPage(pageId) {
  document.querySelectorAll('.page-content').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
  const page = document.getElementById(pageId + 'Page');
  if (page) { page.style.display = 'block'; page.classList.add('active'); }
  navLinks.forEach(a => a.classList.remove('active'));
  const active = document.querySelector('.nav-link[data-page="'+pageId+'"]');
  if (active) active.classList.add('active');
  if (pageId === 'calendar' && window.calendar) setTimeout(() => window.calendar.updateSize(), 50);
}

// ================== 登录/注册/登出 ==================
let currentUser = null;

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
  err.style.color = ''; err.textContent = '正在登录…';
  const result = await callAPI('loginByUsername', { username });
  if (result && result.success) {
    currentUser = result.user || {};
    currentUser.userId = currentUser.username || username;

    // 显示主应用
    $('loginContainer').style.display = 'none';
    $('mainApp').style.display = 'block';
    try { window.location.hash = '#app'; } catch {}

    updateUserInterface();
    initCalendar();         // 创建日历
    bindArrangePanel();     // 课程发布
    bindAnalysisHandlers(); // 数据分析
    loadUserData();
  } else {
    err.style.color = '#c00';
    err.textContent = (result && result.message) || '登录失败：用户ID不存在';
  }
}

async function registerUser() {
  const name = ($('registerName').value || '').trim();
  const email = ($('registerEmail').value || '').trim();
  const department = $('registerDepartment').value;
  const major = ($('registerMajor').value || '').trim();
  const role = $('registerRole').value;
  const err = $('registerError');
  if (!name || !email || !department || !major || !role) { err.textContent = '请填写姓名、邮箱、所属、专业、身份'; return; }
  err.style.color=''; err.textContent = '正在登记…';
  const result = await callAPI('registerByProfile', { name, email, department, major, role });
  if (result && result.success) {
    err.style.color='green'; err.textContent='登记成功！请联系老师获取“用户ID”，之后使用用户ID登录。';
    $('registerName').value=''; $('registerEmail').value=''; $('registerDepartment').value=''; $('registerMajor').value=''; $('registerRole').value='';
    setTimeout(showLoginForm, 1200);
  } else {
    err.style.color='#c00'; err.textContent=(result && result.message) || '登记失败';
  }
}

function logout() {
  currentUser = null;
  $('mainApp').style.display = 'none';
  $('loginContainer').style.display = 'flex';
  $('loginUsername').value = '';
  $('loginError').textContent = '';
  setApiStatus({ok:null, text:'API 检测中'}); // 回到检测中
  try { window.location.hash = '#login'; } catch {}
}

// 修复移动端 100vh：用 window.innerHeight 动态计算 --vh
(function(){
  function setVh(){
    document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
  }
  setVh();
  window.addEventListener('resize', setVh, {passive:true});
  window.addEventListener('orientationchange', function(){
    setTimeout(setVh, 150);
    // FullCalendar 在尺寸变化后需要刷新
    setTimeout(()=>{ try{ window.calendar && window.calendar.updateSize(); }catch(e){} }, 300);
  }, {passive:true});
})();

// ================== 用户界面填充 ==================
function updateUserInterface() {
  if (!currentUser) return;
  $('userGreeting').textContent = '欢迎，' + (currentUser.name || currentUser.userId);
  $('userRole').textContent = '(' + (currentUser.role || '') + ')';
  $('profileName').value = currentUser.name || '';
  $('profileId').value   = currentUser.userId || '';
  $('profileDept').value = currentUser.department || '';
  $('profileRole').value = currentUser.role || '';

  const isTeacher = (String(currentUser.role) === '老师' || String(currentUser.userId || '').startsWith('T'));
  const isAdmin   = String(currentUser.userId || '').startsWith('A');
  const analysisNav = document.querySelector('.nav-link[data-page="analysis"]');
  if (analysisNav) analysisNav.style.display = (isTeacher || isAdmin) ? '' : 'none';
}

// ================== 日历 ==================
let calendar = null;

function initCalendar() {
  const el = $('mainCalendar'); if (!el) return;
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  calendar = new FullCalendar.Calendar(el, {
    initialView, locale: 'zh-cn', firstDay: 1, height: 'auto',
    headerToolbar: false, allDaySlot: false, slotMinTime:'08:00:00', slotMaxTime:'22:00:00', slotDuration:'00:30:00', expandRows:true,
    datesSet: updateCalendarTitle,
    eventClick: handleEventClick
  });
  $('prevBtn').onclick = () => calendar.prev();
  $('nextBtn').onclick = () => calendar.next();
  $('todayBtn').onclick = () => calendar.today();
  $('dayBtn').onclick = () => changeView('timeGridDay', $('dayBtn'));
  $('weekBtn').onclick = () => changeView('timeGridWeek', $('weekBtn'));
  $('monthBtn').onclick = () => changeView('dayGridMonth', $('monthBtn'));
  $('refreshDataBtn').onclick = refreshData;

  calendar.render();
  updateCalendarTitle();
  loadCalendarEvents();
}

function changeView(viewName, activeBtn) {
  if (!calendar) return;
  calendar.changeView(viewName);
  ['dayBtn','weekBtn','monthBtn'].forEach(id => { const b=$(id); if(b) b.classList.remove('active'); });
  if (activeBtn) activeBtn.classList.add('active');
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
  try {
    const events = await callAPI('listVisibleSlots', { userId: currentUser.userId });
    calendar.removeAllEvents();
    if (Array.isArray(events)) events.forEach(ev => calendar.addEvent(ev));
    updateTodayStats();
  } catch (e) { console.error('加载槽位失败:', e); }
}

async function handleEventClick(info) {
  const ev = info.event, ext = ev.extendedProps || {};
  if (!currentUser) return;
  const isStudent = (String(currentUser.role) === '学生' || String(currentUser.userId || '').startsWith('S'));
  if (isStudent && ext.canBook && ext.status === '可约') {
    const note = prompt(`预约备注（可填具体到达时间等）：\n${ev.title}  ${ev.start.toLocaleString('zh-CN')}`);
    const res = await callAPI('bookSlot', { slotId: ev.id, studentId: currentUser.userId, studentName: currentUser.name || '', note: note || '' });
    if (res && res.success) { alert('预约成功'); loadCalendarEvents(); } else { alert((res && res.message) || '预约失败'); }
  } else {
    const details = [`标题: ${ev.title}`, `时间: ${ev.start.toLocaleString('zh-CN')}`];
    if (ev.end) details.push(`结束: ${ev.end.toLocaleString('zh-CN')}`);
    if (ext && ext.description) details.push(`描述: ${ext.description}`);
    alert(details.join('\n'));
  }
}

function refreshData(){ loadCalendarEvents(); }
function updateTodayStats(){
  // 如需从后端聚合统计，这里写入；当前占位
  $('todayCourses').textContent = $('todayCourses').textContent || '0';
  $('todayConsultations').textContent = $('todayConsultations').textContent || '0';
  $('todayReminders').textContent = $('todayReminders').textContent || '0';
  $('attendanceRate').textContent = $('attendanceRate').textContent || '—';
}

// ================== 课程发布 ==================
function bindArrangePanel() {
  const pubMode = $('pubMode'), singleDateRow = $('singleDateRow'), rangeRows = $('rangeRows');
  if (pubMode) pubMode.addEventListener('change', function(){
    const isRange = this.value === 'range'; singleDateRow.style.display = isRange ? 'none' : 'block'; rangeRows.style.display = isRange ? 'block' : 'none';
  });
  const pubSubmitBtn = $('pubSubmitBtn');
  if (pubSubmitBtn) pubSubmitBtn.addEventListener('click', async function(){
    if (!currentUser) return;
    const isTeacher = (String(currentUser.role) === '老师' || String(currentUser.userId || '').startsWith('T'));
    const isAdmin   = String(currentUser.userId || '').startsWith('A');
    if (!isTeacher && !isAdmin) { alert('只有老师/管理员可以发布'); return; }

    const attr = $('pubAttr').value;
    const courseName = ($('pubCourseName').value || '').trim();
    const mode = $('pubMode').value;
    const startTime = $('pubStartTime').value;
    const endTime = $('pubEndTime').value;
    const majors = ($('pubMajors').value || '').trim();
    const visibleStudentIds = ($('pubVisibleIds').value || '').trim();

    if (attr === '大课' && !courseName) { alert('大课需填写课程名'); return; }
    if (!startTime || !endTime) { alert('请填写时间'); return; }

    const params = { teacherId: currentUser.userId, attr, courseName, mode, startTime, endTime, majors, visibleStudentIds };

    if (mode === 'single') {
      const date = $('pubDate').value; if (!date) { alert('请选择日期'); return; }
      params.date = date;
    } else {
      const sd = $('pubStartDate').value, ed = $('pubEndDate').value;
      if (!sd || !ed) { alert('请选择起止日期'); return; }
      const wds = Array.from(document.querySelectorAll('.wd:checked')).map(cb => Number(cb.value));
      if (wds.length === 0) { alert('请选择周几'); return; }
      params.startDate = sd; params.endDate = ed; params.weekdays = wds;
      const c = $('pubCount').value; if (c) params.count = Number(c);
    }

    const res = await callAPI('publishSlots', params);
    if (res && res.success) { alert(res.message || '发布成功'); loadCalendarEvents(); } else { alert((res && res.message) || '发布失败'); }
  });
}

// ================== 数据分析 ==================
let allStudents = []; let selectedStudents = [];

function bindAnalysisHandlers() {
  $('departmentSelect')?.addEventListener('change', loadDepartmentStudents);
  $('majorSelect')?.addEventListener('change', loadMajorStudents);
  $('selectAllBtn')?.addEventListener('click', selectAllStudents);
  $('clearAllBtn')?.addEventListener('click', clearAllStudents);
  $('generateReportBtn')?.addEventListener('click', generateReport);
  $('exportBtn')?.addEventListener('click', exportReport);
  $('resetFiltersBtn')?.addEventListener('click', resetFilters);

  const now = new Date();
  $('startMonth').value = now.toISOString().slice(0,7);
  $('endMonth').value = now.toISOString().slice(0,7);
}

function loadDepartmentsList() {
  const departments = ['文科大学院', '理科大学院'];
  const sel = $('departmentSelect'); if (!sel) return;
  sel.innerHTML = '<option value="">请选择所属部门</option>';
  departments.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
}

async function loadDepartmentStudents() {
  const department = $('departmentSelect')?.value; if (!department) return;
  try {
    const students = await callAPI('getStudentsByClass', { department });
    allStudents = Array.isArray(students) ? students : [];
    displayStudentList(allStudents);
    const majors = [...new Set(allStudents.map(s => s.major))];
    const majorSelect = $('majorSelect');
    if (majorSelect) {
      majorSelect.innerHTML = '<option value="">所有专业</option>';
      majors.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; majorSelect.appendChild(o); });
    }
    $('studentListArea').style.display = 'block';
  } catch (e) { console.error('加载学生失败:', e); }
}

function loadMajorStudents() {
  const major = $('majorSelect')?.value;
  const list = major ? allStudents.filter(s => s.major === major) : allStudents;
  displayStudentList(list);
}

function displayStudentList(students) {
  const box = $('studentList'); if (!box) return;
  box.innerHTML='';
  (students || []).forEach(stu => {
    const isSelected = selectedStudents.some(s => s.id === stu.id);
    const div = document.createElement('div');
    div.className = 'student-item';
    div.innerHTML = `
      <input type="checkbox" id="student_${stu.id}" ${isSelected ? 'checked' : ''}>
      <label for="student_${stu.id}">${stu.name} (${stu.id}) - ${stu.major}</label>
    `;
    div.querySelector('input').addEventListener('change', () => toggleStudent(stu.id));
    box.appendChild(div);
  });
  updateSelectedCount();
}

function toggleStudent(studentId) {
  const stu = allStudents.find(s => s.id === studentId); if (!stu) return;
  const idx = selectedStudents.findIndex(s => s.id === studentId);
  if (idx === -1) selectedStudents.push(stu); else selectedStudents.splice(idx, 1);
  updateSelectedCount(); loadMajorStudents();
}
function selectAllStudents() {
  const major = $('majorSelect')?.value;
  const list = major ? allStudents.filter(s => s.major === major) : allStudents;
  list.forEach(stu => { if (!selectedStudents.some(s => s.id === stu.id)) selectedStudents.push(stu); });
  updateSelectedCount(); displayStudentList(list);
}
function clearAllStudents() { selectedStudents=[]; updateSelectedCount(); loadMajorStudents(); }
function updateSelectedCount() { $('selectedCount').textContent = selectedStudents.length; }

async function generateReport() {
  if (selectedStudents.length === 0) { alert('请先选择学生'); return; }
  const startMonth = $('startMonth').value || '';
  const endMonth   = $('endMonth').value || '';
  const dataTypes = [];
  if ($('attendance').checked) dataTypes.push('出席');
  if ($('homework').checked) dataTypes.push('作业');
  if ($('consultation').checked) dataTypes.push('面谈');
  if ($('progress').checked) dataTypes.push('进度');

  $('resultsPanel').style.display = 'block';
  $('loadingIndicator').style.display = 'flex';
  $('resultsData').style.display = 'none';

  const studentIds = selectedStudents.map(s => s.id);
  try {
    const data = await callAPI('generateStudentReport', { studentIds, startMonth, endMonth, dataTypes });
    displayReportResults(Array.isArray(data) ? data : []);
    $('loadingIndicator').style.display = 'none';
    $('resultsData').style.display = 'block';
    $('exportBtn').style.display = 'inline-block';
  } catch (e) {
    alert('生成报告失败：' + e.message);
    $('loadingIndicator').style.display = 'none';
  }
}

function displayReportResults(data) {
  $('resultCount').textContent = '共 ' + data.length + ' 条记录';
  const tbody = $('tableBody'); tbody.innerHTML = '';
  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.student}</td><td>${item.type}</td><td>${item.value}</td><td>${item.note || ''}</td>
    `;
    tbody.appendChild(tr);
  });
  generateCopyableReport(data);
}

function generateCopyableReport(data) {
  let report = '学生数据分析报告\n\n';
  const names = [...new Set(data.map(i => i.student))];
  names.forEach(n => {
    const rows = data.filter(i => i.student === n);
    report += n + ':\n';
    rows.forEach(r => { report += '- ' + r.type + ': ' + r.value + ' (' + (r.note || '') + ')\n'; });
    report += '\n';
  });
  report += '请基于以上数据分析学生表现。';
  $('copyArea').textContent = report;
}
function exportReport() {
  const text = $('copyArea').textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('exportBtn'); const t = btn.textContent;
    btn.textContent = '已复制!'; setTimeout(() => { btn.textContent = t; }, 1500);
  }).catch(() => { alert('复制失败，请手动选择文本'); });
}
function resetFilters() {
  $('departmentSelect').value = ''; $('majorSelect').value = '';
  selectedStudents = []; allStudents = []; $('studentListArea').style.display = 'none';
  const now = new Date(); $('startMonth').value = now.toISOString().slice(0,7); $('endMonth').value = now.toISOString().slice(0,7);
  ['attendance','homework','consultation','progress'].forEach(id => { const cb=$(id); if(cb) cb.checked = true; });
  $('resultsPanel').style.display = 'none'; $('exportBtn').style.display = 'none';
}

// ================== 用户数据加载（示例） ==================
function loadUserData() {
  const roleLower = String(currentUser?.role || '').toLowerCase();
  if (roleLower === '老师' || roleLower === 'teacher') loadDepartmentsList();
}

// ================== 初始化 + API 连接状态检测 ==================
document.addEventListener('DOMContentLoaded', async () => {
  $('loginBtn')?.addEventListener('click', login);
  $('registerBtn')?.addEventListener('click', registerUser);
  $('logoutBtn')?.addEventListener('click', logout);
  $('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  $('showLoginBtn')?.addEventListener('click', showLoginForm);
  $('loginUsername')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });

  // 立即显示“检测中”
  setApiStatus({ok:null, text:'API 检测中'});

  // 并发两次轻探测：testConnection 和一次空动作
  try {
    const [r1, r2] = await Promise.allSettled([
      callAPI('testConnection'),
      callAPI('ping', {t: Date.now()})
    ]);
    const ok = (r1.value && r1.value.success) || (r2.value && r2.value.success);
    setApiStatus({ok, text: ok ? 'API 连接成功' : 'API 连接异常'});
    if (!ok) {
      const d = $('loginError'); if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
    }
  } catch (e) {
    setApiStatus({ok:false, text:'API 连接失败'});
    const d = $('loginError'); if (d){ d.style.color='#c00'; d.textContent='服务器连接失败，请稍后重试'; }
  }
});

(function(){
  const strip = document.getElementById('menuStrip');
  const aside = document.querySelector('aside');
  const main  = document.querySelector('main');
  if (!strip || !aside || !main) return;

  // 只把“手机断点”定义在这里：≤600px
  const mq = window.matchMedia('(max-width:600px)');
  const isMobile = () => mq.matches;

  const isOpen = () => document.body.classList.contains('mobile-menu-open');
  const refreshCal = () => {
    try {
      const cal = window.calendar || window.mainCalendar;
      if (cal && typeof cal.updateSize === 'function') setTimeout(()=> cal.updateSize(), 80);
    } catch(_) {}
  };
  const open  = ()=>{ document.body.classList.add('mobile-menu-open'); strip.setAttribute('aria-expanded','true');  strip.querySelector('.label').textContent='收起菜单'; refreshCal(); };
  const close = ()=>{ document.body.classList.remove('mobile-menu-open'); strip.setAttribute('aria-expanded','false'); strip.querySelector('.label').textContent='展开菜单'; refreshCal(); };

  // 仅在“手机断点”下响应点击
  strip.addEventListener('click', (e)=>{
    if (!isMobile()) return;
    e.stopPropagation();                 // 避免冒泡被 main 的关闭逻辑马上盖掉
    isOpen() ? close() : open();
  });

  // 点击 main 空白处收起（在手机断点且已展开时）
  main.addEventListener('click', (e)=>{
    if (!isMobile() || !isOpen()) return;
    const t = e.target;
    if (aside.contains(t) || strip.contains(t)) return;
    close();
  });

  // 断点变化：一旦离开手机断点（>600px），强制收起，避免桌面/iPad 残留状态
  const onChange = () => { if (!mq.matches) close(); };
  mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
})();

    // 点击页面其它区域：若已展开则收起（点侧栏或横条本身不收）
    main.addEventListener('click', (e)=>{
      if (!isOpen()) return;
      const t = e.target;
      if (aside.contains(t) || strip.contains(t)) return;
      close();
    });
  })();
