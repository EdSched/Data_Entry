/* ================== 基础配置 ================== */
const API_URL = 'https://script.google.com/macros/s/AKfycbxXGgiM5DRD5FxH8tVSJq9t0xJ7BCxwuJypZhyF34LqeqSqVvR213Attt9eEluX7s4/exec';

/* ================== 小工具 ================== */
const $ = (id) => document.getElementById(id);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

function setApiStatus({ok, text}) {
  const dotTop = $('apiDotTop'), txtTop = $('apiTextTop');
  const inline = $('apiStatusInline');
  if (dotTop) dotTop.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
  if (txtTop) txtTop.textContent = text || (ok ? 'API 正常' : (ok===false ? 'API 连接失败' : 'API 检测中'));
  if (inline) {
    let dot = inline.querySelector('.api-dot');
    if (!dot) { dot = document.createElement('span'); inline.prepend(dot); }
    dot.className = 'api-dot ' + (ok===true?'ok':ok===false?'err':'wait');
    dot.style.cssText = 'display:inline-block;border-radius:50%;width:8px;height:8px;margin-right:6px;';
    const tip = text ?? (ok ? 'API连接成功' : (ok===false ? 'API连接失败' : '正在检测 API 连接…'));
    if (!inline.querySelector('.api-inline-text')) {
      const span = document.createElement('span');
      span.className = 'api-inline-text';
      span.textContent = tip;
      inline.appendChild(span);
    } else {
      inline.querySelector('.api-inline-text').textContent = tip;
    }
  }
}

/* ================== 用户角色判断工具 ================== */
function getUserRole(userId) {
  if (!userId) return 'unknown';
  const id = String(userId).trim();
  if (id.startsWith('A')) return 'admin';
  if (id.startsWith('T')) return 'teacher'; 
  if (id.startsWith('S')) return 'student';
  return 'unknown';
}

function isAdmin(userId) {
  return getUserRole(userId) === 'admin';
}

function isTeacher(userId) {
  return getUserRole(userId) === 'teacher';
}

function isStudent(userId) {
  return getUserRole(userId) === 'student';
}

/* ================== 适配层（统一字段名） ================== */
// 1) 登录用户
function normalizeUser(u = {}, fallbackId = '') {
  return {
    userId: u.userId || u.username || u.id || fallbackId || '',
    name: u.name || u.realName || u.displayName || '',
    role: u.role || u.identity || '',
    department: u.department || u.affiliation || u.dept || '',
    major: u.major || u.subject || ''
  };
}

// 2) FullCalendar 事件
function adaptEvents(rows) {
  if (!Array.isArray(rows)) return [];
  const pad5 = v => {
    const s = String(v ?? '');
    return (s.length === 4) ? ('0' + s) : s; // 9:00 => 09:00
  };
  return rows.map(r => {
    const date = r.date || r.singleDate || r.day || '';
    const start = r.start || (date && r.startTime ? `${date}T${pad5(r.startTime)}` : null);
    const end   = r.end   || (date && r.endTime   ? `${date}T${pad5(r.endTime)}`   : null);
    
    // 根据课程属性设置颜色
    let backgroundColor = r.backgroundColor || r.bgColor;
    if (!backgroundColor) {
      const attr = r.attr || r.extendedProps?.attr || '';
      if (attr === '大课') backgroundColor = '#1976d2';
      else if (attr === 'VIP') backgroundColor = '#d32f2f';
      else if (attr === '面谈') backgroundColor = '#388e3c';
      else backgroundColor = '#9c27b0'; // 默认颜色
    }
    
    return {
      id: r.id || r.slotId || r.slotID || r._id || `${date}-${r.startTime || ''}-${r.title || r.courseName || ''}`,
      title: r.title || r.courseName || r.attr || '未命名',
      start,
      end,
      backgroundColor,
      borderColor: backgroundColor,
      textColor: '#fff',
      extendedProps: {
        type: r.extendedProps?.type || 'course',
        attr: r.attr || r.extendedProps?.attr || '',
        canBook: r.canBook === '是' || r.canBook === true || r.extendedProps?.canBook === true,
        status: r.status || r.scheduleStatus || r.extendedProps?.status || '',
        description: r.description || r.notes || r.note || '',
        teacherId: r.teacherId || r.extendedProps?.teacherId || '',
        readOnly: r.readOnly || r.extendedProps?.readOnly || false
      }
    };
  }).filter(e => e.start);
}

// 3) 学生行
function adaptStudent(row = {}) {
  return {
    id: row.id || row.studentId || row.userId || row.sid || '',
    name: row.name || row.studentName || row.realName || '',
    major: row.major || row.subject || ''
  };
}

/* ================== API 调用 ================== */
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
    let cleanText = text.trim();
    const s = cleanText.indexOf('{');
    const e = cleanText.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) cleanText = cleanText.substring(s, e + 1);
    return JSON.parse(cleanText);
  } catch (err) {
    return { success:false, message: '网络请求失败: ' + err.message };
  }
}

/* ================== 导航切换 ================== */
const navLinks = [];
function showPage(pageId) {
  document.querySelectorAll('.page-content').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
  const page = document.getElementById(pageId + 'Page');
  if (page) { page.style.display = 'block'; page.classList.add('active'); }
  navLinks.forEach(a => a.classList.remove('active'));
  const active = document.querySelector('.nav-link[data-page="'+pageId+'"]');
  if (active) active.classList.add('active');
  if (pageId === 'calendar' && window.calendar) setTimeout(() => window.calendar.updateSize(), 60);
}

/* ================== 用户界面权限控制 ================== */
function updateUIForUserRole(userId) {
  const role = getUserRole(userId);
  
  // 获取导航元素
  const outputNav = document.querySelector('.nav-link[data-page="output"]'); // 我的发布
  const dataManagementNav = document.querySelector('.nav-link[data-page="datamanagement"]'); // 数据管理
  const overviewSection = document.querySelector('.sidebar-section.overview'); // 今日提醒
  
  // 根据角色显示/隐藏功能
  switch(role) {
    case 'student':
      // 学生：只能看到日历、录入、任务，不能看到发布和数据管理
      if (outputNav) outputNav.style.display = 'none';
      if (dataManagementNav) dataManagementNav.style.display = 'none';
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('学生用户界面已设置');
      break;
      
    case 'teacher':
      // 老师：可以看到所有功能
      if (outputNav) outputNav.style.display = 'block';
      if (dataManagementNav) dataManagementNav.style.display = 'block';
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('老师用户界面已设置');
      break;
      
    case 'admin':
      // 管理员：可以看到所有功能
      if (outputNav) outputNav.style.display = 'block';
      if (dataManagementNav) dataManagementNav.style.display = 'block';
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('管理员用户界面已设置');
      break;
      
    default:
      // 未知角色：隐藏敏感功能
      if (outputNav) outputNav.style.display = 'none';
      if (dataManagementNav) dataManagementNav.style.display = 'none';
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('未知用户角色，限制访问权限');
  }
}

/* ================== 登录/注册/登出 ================== */
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
    currentUser = normalizeUser(result.user, username);

    $('loginContainer').style.display = 'none';
    $('mainApp').style.display = 'block';
    try { window.location.hash = '#app'; } catch {}

    updateUserInterface();
    updateUIForUserRole(currentUser.userId); // 新增：根据用户角色更新界面
    initCalendar();
    bindArrangePanel();
    bindAnalysisHandlers();
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
    err.style.color='green'; err.textContent='登记成功！请联系老师获取"用户ID"，之后使用用户ID登录。';
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
  
  // 重新检测API状态而不是设置为检测中
  checkApiStatusAfterLogout();
  
  try { window.location.hash = '#login'; } catch {}
}

// 新增函数：登出后重新检测API状态
async function checkApiStatusAfterLogout() {
  setApiStatus({ok:null, text:'API 检测中'});
  try {
    const result = await callAPI('testConnection');
    if (result && result.success) {
      setApiStatus({ok:true, text:'API 连接成功'});
    } else {
      setApiStatus({ok:false, text:'API 连接异常'});
    }
  } catch (e) {
    setApiStatus({ok:false, text:'API 连接失败'});
  }
}

/* 修复移动端 100vh：用 window.innerHeight 动态计算 --vh */
(function(){
  function setVh(){
    document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
  }
  setVh();
  window.addEventListener('resize', setVh, {passive:true});
  window.addEventListener('orientationchange', function(){
    setTimeout(setVh, 150);
    setTimeout(()=>{ try{ window.calendar && window.calendar.updateSize(); }catch(e){} }, 300);
  }, {passive:true});
})();

/* ================== 用户界面填充 ================== */
function updateUserInterface() {
  if (!currentUser) return;
  
  const role = getUserRole(currentUser.userId);
  const roleDisplayName = {
    'admin': '管理员',
    'teacher': '老师', 
    'student': '学生'
  }[role] || currentUser.role || '';
  
  $('userGreeting').textContent = '欢迎，' + (currentUser.name || currentUser.userId);
  $('userRole').textContent = '(' + roleDisplayName + ')';
  
  // 填充个人资料（如果有对应的输入框）
  if ($('profileName')) $('profileName').value = currentUser.name || '';
  if ($('profileId')) $('profileId').value = currentUser.userId || '';
  if ($('profileDept')) $('profileDept').value = currentUser.department || '';
  if ($('profileRole')) $('profileRole').value = currentUser.role || '';
}

/* ================== 日历 ================== */
let calendar = null;

function initCalendar() {
  const el = $('mainCalendar'); if (!el) return;
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  calendar = new FullCalendar.Calendar(el, {
    initialView, locale: 'zh-cn', firstDay: 1, height: 'auto',
    headerToolbar: false, allDaySlot: false,
    slotMinTime:'08:00:00', slotMaxTime:'22:00:00', slotDuration:'00:30:00', expandRows:true,
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
    $('calendarTitle').textContent = `${y}/${String(s.getMonth()+1).padStart(2,'0')}/${String(s.getDate()).padStart(2,'0')} — ${String(e.getMonth()+1).padStart(2,'0')}/${String(e.getDate()).padStart(2,'0')}`;
  } else $('calendarTitle').textContent = `${y}/${m}`;
}

async function loadCalendarEvents() {
  if (!currentUser || !calendar) return;
  try {
    console.log('正在加载日历事件...', currentUser.userId);
    const events = await callAPI('listVisibleSlots', { userId: currentUser.userId });
    
    calendar.removeAllEvents();
    
    if (Array.isArray(events)) {
      console.log('收到事件数据:', events.length, '条');
      
      // 检查事件格式并适配
      const fcEvents = (events[0] && (events[0].start || events[0].startStr))
        ? events  // 已经是FullCalendar格式
        : adaptEvents(events); // 需要适配
      
      console.log('适配后事件:', fcEvents.length, '条');
      
      fcEvents.forEach((ev, index) => {
        try {
          calendar.addEvent(ev);
          console.log(`添加事件 ${index + 1}:`, ev.title, ev.start);
        } catch (e) {
          console.error('添加事件失败:', e, ev);
        }
      });
      
      console.log('日历事件加载完成');
    } else {
      console.log('未收到有效事件数据:', events);
    }
    
    updateTodayStats();
  } catch (e) { 
    console.error('加载槽位失败:', e); 
  }
}

async function handleEventClick(info) {
  const ev = info.event, ext = ev.extendedProps || {};
  if (!currentUser) return;
  
  const userRole = getUserRole(currentUser.userId);
  
  // 学生可以预约，老师和管理员只查看详情
  if (userRole === 'student' && ext.canBook && ext.status === '可约') {
    const note = prompt(`预约备注（可填具体到达时间等）：\n${ev.title}  ${ev.start.toLocaleString('zh-CN')}`);
    const res = await callAPI('bookSlot', { slotId: ev.id, studentId: currentUser.userId, studentName: currentUser.name || '', note: note || '' });
    if (res && res.success) { alert('预约成功'); loadCalendarEvents(); } else { alert((res && res.message) || '预约失败'); }
  } else {
    const details = [`标题: ${ev.title}`, `时间: ${ev.start.toLocaleString('zh-CN')}`];
    if (ev.end) details.push(`结束: ${ev.end.toLocaleString('zh-CN')}`);
    if (ext && ext.description) details.push(`描述: ${ext.description}`);
    if (ext && ext.status) details.push(`状态: ${ext.status}`);
    
    // 老师和管理员可以看到更多详情
    if (userRole === 'teacher' || userRole === 'admin') {
      if (ext.teacherId) details.push(`任课老师: ${ext.teacherId}`);
      if (ext.attr) details.push(`课程属性: ${ext.attr}`);
    }
    
    alert(details.join('\n'));
  }
}

function refreshData(){ loadCalendarEvents(); }
function updateTodayStats(){
  $('todayCourses').textContent = $('todayCourses').textContent || '0';
  $('todayConsultations').textContent = $('todayConsultations').textContent || '0';
  $('todayReminders').textContent = $('todayReminders').textContent || '0';
  $('attendanceRate').textContent = $('attendanceRate').textContent || '—';
}
/* ================== 日历点击填写功能 ================== */

// 在initCalendar函数中添加dateClick事件
function initCalendar() {
  const el = $('mainCalendar'); if (!el) return;
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  calendar = new FullCalendar.Calendar(el, {
    initialView, locale: 'zh-cn', firstDay: 1, height: 'auto',
    headerToolbar: false, allDaySlot: false,
    slotMinTime:'08:00:00', slotMaxTime:'22:00:00', slotDuration:'00:30:00', expandRows:true,
    selectable: true, // 启用选择功能
    selectMirror: true,
    datesSet: updateCalendarTitle,
    eventClick: handleEventClick,
    dateClick: handleDateClick, // 新增：处理空白日期点击
    select: handleDateSelect // 新增：处理时间段选择
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

// 处理空白日期点击
function handleDateClick(info) {
  if (!currentUser) return;
  
  const userRole = getUserRole(currentUser.userId);
  const clickedDate = info.dateStr.split('T')[0]; // 获取日期部分
  const clickedTime = info.dateStr.includes('T') ? info.dateStr.split('T')[1].substring(0,5) : '09:00';
  
  // 根据用户角色显示不同的操作选项
  if (userRole === 'student') {
    showStudentQuickActions(clickedDate, clickedTime);
  } else if (userRole === 'teacher' || userRole === 'admin') {
    showTeacherQuickActions(clickedDate, clickedTime);
  }
}

// 处理时间段选择
function handleDateSelect(info) {
  if (!currentUser) return;
  
  const userRole = getUserRole(currentUser.userId);
  const startDate = info.startStr.split('T')[0];
  const startTime = info.startStr.includes('T') ? info.startStr.split('T')[1].substring(0,5) : '09:00';
  const endTime = info.endStr.includes('T') ? info.endStr.split('T')[1].substring(0,5) : '10:00';
  
  if (userRole === 'teacher' || userRole === 'admin') {
    showQuickPublishDialog(startDate, startTime, endTime);
  }
  
  // 清除选择
  calendar.unselect();
}

// 学生快速操作
function showStudentQuickActions(date, time) {
  const actions = [
    { text: '添加学习记录', action: () => showStudentRecordForm(date, time) },
    { text: '查看当日安排', action: () => showDaySchedule(date) },
    { text: '取消', action: () => {} }
  ];
  
  showActionMenu(actions, '学生操作');
}

// 老师快速操作
function showTeacherQuickActions(date, time) {
  const actions = [
    { text: '快速发布课程', action: () => showQuickPublishDialog(date, time, addMinutesToTime(time, 60)) },
    { text: '添加日程记录', action: () => showScheduleForm(date, time) },
    { text: '查看当日统计', action: () => showDayStatistics(date) },
    { text: '取消', action: () => {} }
  ];
  
  showActionMenu(actions, '老师操作');
}

// 显示操作菜单
function showActionMenu(actions, title) {
  const menu = document.createElement('div');
  menu.className = 'action-menu-overlay';
  menu.innerHTML = `
    <div class="action-menu">
      <div class="action-menu-header">${title}</div>
      <div class="action-menu-body">
        ${actions.map((action, index) => `
          <button class="action-menu-item ${index === actions.length - 1 ? 'cancel' : ''}" data-index="${index}">
            ${action.text}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  // 绑定点击事件
  menu.addEventListener('click', function(e) {
    if (e.target.classList.contains('action-menu-item')) {
      const index = parseInt(e.target.dataset.index);
      actions[index].action();
      document.body.removeChild(menu);
    } else if (e.target === menu) {
      document.body.removeChild(menu);
    }
  });
  
  document.body.appendChild(menu);
}

// 快速发布对话框
function showQuickPublishDialog(date, startTime, endTime) {
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay';
  dialog.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>快速发布课程</h3>
        <button class="modal-close" onclick="closeModal(this)">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>日期时间</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="date" id="quickDate" value="${date}">
            <input type="time" id="quickStartTime" value="${startTime}">
            <span>至</span>
            <input type="time" id="quickEndTime" value="${endTime}">
          </div>
        </div>
        <div class="form-row">
          <label>课程属性</label>
          <select id="quickAttr">
            <option value="VIP">VIP（可约）</option>
            <option value="面谈">面谈（可约）</option>
            <option value="大课">大课（只读）</option>
          </select>
        </div>
        <div class="form-row">
          <label>课程名称</label>
          <input type="text" id="quickCourseName" placeholder="课程名称（大课必填）">
        </div>
        <div class="form-row">
          <label>备注</label>
          <textarea id="quickNotes" rows="2" placeholder="课程备注..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="submitQuickPublish()">发布</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
}

// 学生记录表单
function showStudentRecordForm(date, time) {
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay';
  dialog.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>添加学习记录</h3>
        <button class="modal-close" onclick="closeModal(this)">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>日期时间</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="date" id="recordDate" value="${date}">
            <input type="time" id="recordTime" value="${time}">
          </div>
        </div>
        <div class="form-row">
          <label>记录类型</label>
          <select id="recordType">
            <option value="学习进度">学习进度</option>
            <option value="作业完成">作业完成</option>
            <option value="复习计划">复习计划</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="form-row">
          <label>标题</label>
          <input type="text" id="recordTitle" placeholder="记录标题">
        </div>
        <div class="form-row">
          <label>详细内容</label>
          <textarea id="recordContent" rows="4" placeholder="详细描述..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="submitStudentRecord()">保存</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
}

// 日程记录表单（老师用）
function showScheduleForm(date, time) {
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay';
  dialog.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>添加日程记录</h3>
        <button class="modal-close" onclick="closeModal(this)">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>日期时间</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="date" id="scheduleDate" value="${date}">
            <input type="time" id="scheduleStartTime" value="${time}">
            <span>至</span>
            <input type="time" id="scheduleEndTime" value="${addMinutesToTime(time, 60)}">
          </div>
        </div>
        <div class="form-row">
          <label>日程类型</label>
          <select id="scheduleType">
            <option value="会议">会议</option>
            <option value="准备工作">准备工作</option>
            <option value="个人事务">个人事务</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="form-row">
          <label>标题</label>
          <input type="text" id="scheduleTitle" placeholder="日程标题">
        </div>
        <div class="form-row">
          <label>备注</label>
          <textarea id="scheduleNotes" rows="3" placeholder="日程备注..."></textarea>
        </div>
        <div class="form-row">
          <label>可见性</label>
          <select id="scheduleVisibility">
            <option value="private">仅自己可见</option>
            <option value="department">部门可见</option>
            <option value="public">公开可见</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="submitScheduleRecord()">保存</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
}

// 工具函数：时间加减
function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMins = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

// 关闭模态框
function closeModal(button) {
  const modal = button.closest('.modal-overlay');
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }
}

// 提交快速发布
async function submitQuickPublish() {
  const date = $('quickDate').value;
  const startTime = $('quickStartTime').value;
  const endTime = $('quickEndTime').value;
  const attr = $('quickAttr').value;
  const courseName = $('quickCourseName').value.trim();
  
  if (!date || !startTime || !endTime) {
    alert('请填写完整的日期和时间');
    return;
  }
  
  if (attr === '大课' && !courseName) {
    alert('大课必须填写课程名称');
    return;
  }
  
  const params = {
    teacherId: currentUser.userId,
    attr,
    courseName,
    mode: 'single',
    date,
    startTime,
    endTime,
    majors: '', // 默认全专业
    visibleStudentIds: ''
  };
  
  try {
    const res = await callAPI('publishSlots', params);
    if (res && res.success) {
      alert('快速发布成功！');
      closeModal(document.querySelector('.modal-close'));
      loadCalendarEvents();
    } else {
      alert('发布失败：' + (res && res.message || '未知错误'));
    }
  } catch (error) {
    alert('发布失败：网络错误');
  }
}

// 提交学生记录
async function submitStudentRecord() {
  const date = $('recordDate').value;
  const time = $('recordTime').value;
  const type = $('recordType').value;
  const title = $('recordTitle').value.trim();
  const content = $('recordContent').value.trim();
  
  if (!date || !title) {
    alert('请填写日期和标题');
    return;
  }
  
  const params = {
    userId: currentUser.userId,
    type: 'schedule',
    title,
    date,
    starttime: time,
    endtime: addMinutesToTime(time, 30),
    creator: currentUser.userId,
    notes: content,
    schedulestatus: '个人记录',
    visiblegroups: 'private'
  };
  
  try {
    const res = await callAPI('addScheduleRecord', params);
    if (res && res.success) {
      alert('记录保存成功！');
      closeModal(document.querySelector('.modal-close'));
      loadCalendarEvents();
    } else {
      alert('保存失败：' + (res && res.message || '未知错误'));
    }
  } catch (error) {
    alert('保存失败：网络错误');
  }
}

// 提交日程记录
async function submitScheduleRecord() {
  const date = $('scheduleDate').value;
  const startTime = $('scheduleStartTime').value;
  const endTime = $('scheduleEndTime').value;
  const type = $('scheduleType').value;
  const title = $('scheduleTitle').value.trim();
  const notes = $('scheduleNotes').value.trim();
  const visibility = $('scheduleVisibility').value;
  
  if (!date || !startTime || !endTime || !title) {
    alert('请填写完整信息');
    return;
  }
  
  const params = {
    type: 'schedule',
    title,
    date,
    starttime: startTime,
    endtime: endTime,
    creator: currentUser.userId,
    notes,
    schedulestatus: type,
    visiblegroups: visibility
  };
  
  try {
    const res = await callAPI('addScheduleRecord', params);
    if (res && res.success) {
      alert('日程保存成功！');
      closeModal(document.querySelector('.modal-close'));
      loadCalendarEvents();
    } else {
      alert('保存失败：' + (res && res.message || '未知错误'));
    }
  } catch (error) {
    alert('保存失败：网络错误');
  }
}
/* ================== 课程发布 ================== */
/* ================== 课程发布相关变量 ================== */
let allStudentsForSearch = []; // 用于搜索的学生列表
let selectedStudentsForPublish = []; // 选中的特定学生

/* ================== 课程发布 ================== */
function bindArrangePanel() {
  const pubMode = $('pubMode'), singleDateRow = $('singleDateRow'), rangeRows = $('rangeRows');
  
  // 模式切换
  if (pubMode) pubMode.addEventListener('change', function(){
    const isRange = this.value === 'range';
    if (singleDateRow) singleDateRow.style.display = isRange ? 'none' : 'block';
    if (rangeRows) rangeRows.style.display = isRange ? 'block' : 'none';
  });

  // 专业选择逻辑
  setupMajorSelection();
  
  // 学生搜索逻辑
  setupStudentSearch();
  
  // 发布按钮
  const pubSubmitBtn = $('pubSubmitBtn');
  if (pubSubmitBtn) pubSubmitBtn.addEventListener('click', publishCourse);
}

function setupMajorSelection() {
  const allMajorsCheck = $('allMajorsCheck');
  const majorSelection = $('majorSelection');
  
  if (!allMajorsCheck || !majorSelection) return;
  
  // "全部专业"复选框逻辑
  allMajorsCheck.addEventListener('change', function() {
    if (this.checked) {
      majorSelection.style.display = 'none';
      // 清空所有专业选择
      document.querySelectorAll('.dept-check, .major-check').forEach(cb => cb.checked = false);
    } else {
      majorSelection.style.display = 'block';
    }
  });
  
  // 部门复选框逻辑
  document.querySelectorAll('.dept-check').forEach(deptCheck => {
    deptCheck.addEventListener('change', function() {
      const dept = this.dataset.dept;
      const majorChecks = document.querySelectorAll(`.major-check[data-dept="${dept}"]`);
      
      if (this.checked) {
        // 选中该部门下所有专业
        majorChecks.forEach(cb => cb.checked = true);
      } else {
        // 取消选中该部门下所有专业
        majorChecks.forEach(cb => cb.checked = false);
      }
      updateAllMajorsCheck();
    });
  });
  
  // 专业复选框逻辑
  document.querySelectorAll('.major-check').forEach(majorCheck => {
    majorCheck.addEventListener('change', function() {
      const dept = this.dataset.dept;
      const deptCheck = document.querySelector(`.dept-check[data-dept="${dept}"]`);
      const majorChecks = document.querySelectorAll(`.major-check[data-dept="${dept}"]`);
      const checkedMajors = document.querySelectorAll(`.major-check[data-dept="${dept}"]:checked`);
      
      // 更新部门复选框状态
      if (checkedMajors.length === majorChecks.length) {
        deptCheck.checked = true;
        deptCheck.indeterminate = false;
      } else if (checkedMajors.length > 0) {
        deptCheck.checked = false;
        deptCheck.indeterminate = true;
      } else {
        deptCheck.checked = false;
        deptCheck.indeterminate = false;
      }
      
      updateAllMajorsCheck();
    });
  });
}

function updateAllMajorsCheck() {
  const allMajorsCheck = $('allMajorsCheck');
  const checkedMajors = document.querySelectorAll('.major-check:checked');
  
  if (checkedMajors.length === 0) {
    allMajorsCheck.checked = true;
    allMajorsCheck.indeterminate = false;
    $('majorSelection').style.display = 'none';
  } else {
    allMajorsCheck.checked = false;
    allMajorsCheck.indeterminate = false;
  }
}

function setupStudentSearch() {
  const searchInput = $('studentSearch');
  const searchResults = $('searchResults');
  
  if (!searchInput || !searchResults) return;
  
  // 加载学生数据用于搜索
  loadStudentsForSearch();
  
  let searchTimeout;
  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (query.length >= 1) {
        showSearchResults(query);
      } else {
        searchResults.style.display = 'none';
      }
    }, 300);
  });
  
  // 点击外部隐藏搜索结果
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
}

async function loadStudentsForSearch() {
  if (!currentUser) return;
  const userRole = getUserRole(currentUser.userId);
  if (userRole !== 'teacher' && userRole !== 'admin') return;
  
  try {
    // 加载所有部门的学生
    const [scienceStudents, artsStudents] = await Promise.all([
      callAPI('getStudentsByClass', { department: '理科大学院' }),
      callAPI('getStudentsByClass', { department: '文科大学院' })
    ]);
    
    allStudentsForSearch = [
      ...(Array.isArray(scienceStudents) ? scienceStudents : []),
      ...(Array.isArray(artsStudents) ? artsStudents : [])
    ];
  } catch (e) {
    console.error('加载学生数据失败:', e);
  }
}

function showSearchResults(query) {
  const searchResults = $('searchResults');
  if (!searchResults) return;
  
  const filteredStudents = allStudentsForSearch.filter(student => {
    const name = (student.name || '').toLowerCase();
    const id = (student.id || student.userId || '').toLowerCase();
    return name.includes(query.toLowerCase()) || id.includes(query.toLowerCase());
  });
  
  if (filteredStudents.length === 0) {
    searchResults.innerHTML = '<div style="padding:8px;color:#666;text-align:center;">未找到学生</div>';
  } else {
    searchResults.innerHTML = filteredStudents.slice(0, 10).map(student => `
      <div class="search-result-item" data-student-id="${student.id || student.userId}" 
           style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee;"
           onmouseover="this.style.background='#f5f5f5'" 
           onmouseout="this.style.background='white'">
        <strong>${student.name}</strong> (${student.id || student.userId})
        <br><small style="color:#666;">${student.major} - ${student.department || ''}</small>
      </div>
    `).join('');
    
    // 绑定点击事件
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', function() {
        const studentId = this.dataset.studentId;
        const student = allStudentsForSearch.find(s => (s.id || s.userId) === studentId);
        if (student) {
          addSelectedStudent(student);
          $('studentSearch').value = '';
          searchResults.style.display = 'none';
        }
      });
    });
  }
  
  searchResults.style.display = 'block';
}

function addSelectedStudent(student) {
  const studentId = student.id || student.userId;
  
  // 避免重复添加
  if (selectedStudentsForPublish.find(s => (s.id || s.userId) === studentId)) {
    return;
  }
  
  selectedStudentsForPublish.push(student);
  updateSelectedStudentsDisplay();
  updateVisibleIds();
}

function removeSelectedStudent(studentId) {
  selectedStudentsForPublish = selectedStudentsForPublish.filter(s => (s.id || s.userId) !== studentId);
  updateSelectedStudentsDisplay();
  updateVisibleIds();
}

function updateSelectedStudentsDisplay() {
  const container = $('selectedStudents');
  if (!container) return;
  
  container.innerHTML = selectedStudentsForPublish.map(student => {
    const studentId = student.id || student.userId;
    return `
      <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#e3f2fd;border-radius:16px;font-size:12px;">
        ${student.name} (${studentId})
        <button type="button" onclick="removeSelectedStudent('${studentId}')" 
                style="background:none;border:none;color:#666;cursor:pointer;font-size:14px;line-height:1;">×</button>
      </span>
    `;
  }).join('');
}

function updateVisibleIds() {
  const visibleIds = selectedStudentsForPublish.map(s => s.id || s.userId).join(',');
  const hiddenInput = $('pubVisibleIds');
  if (hiddenInput) {
    hiddenInput.value = visibleIds;
  }
}

function getSelectedMajors() {
  const allMajorsCheck = $('allMajorsCheck');
  if (allMajorsCheck && allMajorsCheck.checked) {
    return ''; // 空字符串表示全部专业
  }
  
  const checkedMajors = document.querySelectorAll('.major-check:checked');
  return Array.from(checkedMajors).map(cb => cb.dataset.major).join(',');
}

function setPublishStatus(message, isLoading = false) {
  const statusDiv = $('publishStatus');
  const submitBtn = $('pubSubmitBtn');
  
  if (!statusDiv || !submitBtn) return;
  
  if (message) {
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    if (isLoading) {
      statusDiv.style.color = '#1976d2';
      submitBtn.disabled = true;
      submitBtn.textContent = '发布中...';
    }
  } else {
    statusDiv.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
  }
}

async function publishCourse() {
  if (!currentUser) return;
  
  const userRole = getUserRole(currentUser.userId);
  if (userRole !== 'teacher' && userRole !== 'admin') { 
    alert('只有老师和管理员可以发布课程'); 
    return; 
  }

  const attr = $('pubAttr').value;
  const courseName = ($('pubCourseName').value || '').trim();
  const mode = $('pubMode').value;
  const startTime = $('pubStartTime').value;
  const endTime = $('pubEndTime').value;

  if (attr === '大课' && !courseName) { 
    alert('大课需填写课程名'); 
    return; 
  }
  if (!startTime || !endTime) { 
    alert('请填写时间'); 
    return; 
  }

  // 获取选中的专业
  const majors = getSelectedMajors();
  
  // 获取选中的特定学生ID
  const visibleStudentIds = selectedStudentsForPublish.map(s => s.id || s.userId).join(',');

  const params = { 
    teacherId: currentUser.userId, 
    attr, 
    courseName, 
    mode, 
    startTime, 
    endTime, 
    majors, 
    visibleStudentIds 
  };

  if (mode === 'single') {
    const date = $('pubDate').value; 
    if (!date) { 
      alert('请选择日期'); 
      return; 
    }
    params.date = date;
  } else {
    const sd = $('pubStartDate').value, ed = $('pubEndDate').value;
    if (!sd || !ed) { 
      alert('请选择起止日期'); 
      return; 
    }
    const wds = Array.from(document.querySelectorAll('.wd:checked')).map(cb => Number(cb.value));
    if (wds.length === 0) { 
      alert('请选择周几'); 
      return; 
    }
    params.startDate = sd; 
    params.endDate = ed; 
    params.weekdays = wds;
    const c = $('pubCount').value; 
    if (c) params.count = Number(c);
  }

  // 显示发布中状态
  setPublishStatus('正在发布课程...', true);

  try {
    const res = await callAPI('publishSlots', params);
    
    if (res && res.success) {
      setPublishStatus('发布成功！');
      setTimeout(() => setPublishStatus(), 2000);
      loadCalendarEvents(); // 刷新日历
      
      // 清空表单（可选）
      // resetPublishForm();
    } else {
      setPublishStatus('发布失败：' + (res && res.message || '未知错误'));
      setTimeout(() => setPublishStatus(), 3000);
    }
  } catch (error) {
    setPublishStatus('发布失败：网络错误');
    setTimeout(() => setPublishStatus(), 3000);
  }
}
/* ================== 增强的日历事件处理 ================== */

// 更新 handleEventClick 函数以处理不同类型的事件
async function handleEventClick(info) {
  const ev = info.event, ext = ev.extendedProps || {};
  if (!currentUser) return;
  
  const userRole = getUserRole(currentUser.userId);
  const eventType = ext.type || 'course'; // 'course' 或 'schedule'
  
  if (eventType === 'schedule') {
    // 处理日程记录点击
    handleScheduleEventClick(ev, ext, userRole);
  } else {
    // 处理课程事件点击（原有逻辑）
    handleCourseEventClick(ev, ext, userRole);
  }
}

function handleScheduleEventClick(event, ext, userRole) {
  const isOwner = ext.creator === currentUser.userId;
  const canEdit = isOwner || userRole === 'admin';
  
  const details = [
    `标题: ${event.title}`,
    `时间: ${event.start.toLocaleString('zh-CN')}`,
  ];
  
  if (event.end) {
    details.push(`结束: ${event.end.toLocaleString('zh-CN')}`);
  }
  
  if (ext.notes) {
    details.push(`备注: ${ext.notes}`);
  }
  
  if (ext.status) {
    details.push(`状态: ${ext.status}`);
  }
  
  if (ext.creator && ext.creator !== currentUser.userId) {
    details.push(`创建者: ${ext.creator}`);
  }
  
  if (canEdit) {
    const actions = [
      { text: '查看详情', action: () => alert(details.join('\n')) },
      { text: '编辑', action: () => editScheduleRecord(event.id, ext) },
      { text: '删除', action: () => deleteScheduleRecord(event.id) },
      { text: '取消', action: () => {} }
    ];
    showActionMenu(actions, '日程操作');
  } else {
    alert(details.join('\n'));
  }
}

function handleCourseEventClick(event, ext, userRole) {
  // 学生可以预约，老师和管理员只查看详情
  if (userRole === 'student' && ext.canBook && ext.status === '可约') {
    const note = prompt(`预约备注（可填具体到达时间等）：\n${event.title}  ${event.start.toLocaleString('zh-CN')}`);
    if (note !== null) { // 用户点击了确定（包括空字符串）
      bookSlotFromCalendar(event.id, note);
    }
  } else {
    const details = [`标题: ${event.title}`, `时间: ${event.start.toLocaleString('zh-CN')}`];
    if (event.end) details.push(`结束: ${event.end.toLocaleString('zh-CN')}`);
    if (ext && ext.description) details.push(`描述: ${ext.description}`);
    if (ext && ext.status) details.push(`状态: ${ext.status}`);
    
    // 老师和管理员可以看到更多详情
    if (userRole === 'teacher' || userRole === 'admin') {
      if (ext.teacherId) details.push(`任课老师: ${ext.teacherId}`);
      if (ext.attr) details.push(`课程属性: ${ext.attr}`);
      
      // 如果是自己发布的课程，提供管理选项
      if (ext.teacherId === currentUser.userId || userRole === 'admin') {
        const actions = [
          { text: '查看详情', action: () => alert(details.join('\n')) },
          { text: '编辑课程', action: () => editCourseSlot(event.id) },
          { text: '取消课程', action: () => cancelCourseSlot(event.id) },
          { text: '关闭', action: () => {} }
        ];
        showActionMenu(actions, '课程管理');
        return;
      }
    }
    
    alert(details.join('\n'));
  }
}

// 从日历预约课程
async function bookSlotFromCalendar(slotId, note) {
  const res = await callAPI('bookSlot', { 
    slotId, 
    studentId: currentUser.userId, 
    studentName: currentUser.name || '', 
    note: note || '' 
  });
  
  if (res && res.success) { 
    alert('预约成功'); 
    loadCalendarEvents(); 
  } else { 
    alert((res && res.message) || '预约失败'); 
  }
}

// 编辑日程记录
function editScheduleRecord(recordId, ext) {
  // 这里可以打开编辑对话框，预填现有数据
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay';
  dialog.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>编辑日程记录</h3>
        <button class="modal-close" onclick="closeModal(this)">×</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>标题</label>
          <input type="text" id="editScheduleTitle" value="${ext.title || ''}" placeholder="日程标题">
        </div>
        <div class="form-row">
          <label>备注</label>
          <textarea id="editScheduleNotes" rows="3" placeholder="日程备注...">${ext.notes || ''}</textarea>
        </div>
        <div class="form-row">
          <label>状态</label>
          <select id="editScheduleStatus">
            <option value="已安排" ${ext.status === '已安排' ? 'selected' : ''}>已安排</option>
            <option value="进行中" ${ext.status === '进行中' ? 'selected' : ''}>进行中</option>
            <option value="已完成" ${ext.status === '已完成' ? 'selected' : ''}>已完成</option>
            <option value="已取消" ${ext.status === '已取消' ? 'selected' : ''}>已取消</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="updateScheduleRecord('${recordId}')">保存</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
}

// 更新日程记录
async function updateScheduleRecord(recordId) {
  const title = $('editScheduleTitle').value.trim();
  const notes = $('editScheduleNotes').value.trim();
  const status = $('editScheduleStatus').value;
  
  if (!title) {
    alert('请填写标题');
    return;
  }
  
  const params = {
    recordId,
    title,
    notes,
    status
  };
  
  try {
    const res = await callAPI('updateScheduleRecord', params);
    if (res && res.success) {
      alert('更新成功！');
      closeModal(document.querySelector('.modal-close'));
      loadCalendarEvents();
    } else {
      alert('更新失败：' + (res && res.message || '未知错误'));
    }
  } catch (error) {
    alert('更新失败：网络错误');
  }
}

// 删除日程记录
async function deleteScheduleRecord(recordId) {
  if (!confirm('确定要删除这个日程记录吗？')) {
    return;
  }
  
  try {
    const res = await callAPI('deleteScheduleRecord', { recordId });
    if (res && res.success) {
      alert('删除成功！');
      loadCalendarEvents();
    } else {
      alert('删除失败：' + (res && res.message || '未知错误'));
    }
  } catch (error) {
    alert('删除失败：网络错误');
  }
}

// 编辑课程槽位（简化版本）
function editCourseSlot(slotId) {
  alert('课程编辑功能开发中...\n槽位ID: ' + slotId);
}

// 取消课程槽位
async function cancelCourseSlot(slotId) {
  if (!confirm('确定要取消这个课程安排吗？')) {
    return;
  }
  
  try {
    const res = await callAPI('cancelBooking', { slotId, userId: currentUser.userId, force: true });
    if (res && res.success) {
      alert('课程已取消');
      loadCalendarEvents();
    } else {
      alert('取消失败：' + (res && res.message || '未知错误'));
    }
  } catch (error) {
    alert('取消失败：网络错误');
  }
}

// 显示当日统计
function showDayStatistics(date) {
  alert(`${date} 当日统计功能开发中...`);
}

// 显示当日安排
function showDaySchedule(date) {
  alert(`${date} 当日安排功能开发中...`);
}
/* ================== 数据分析 ================== */
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
  if ($('startMonth')) $('startMonth').value = now.toISOString().slice(0,7);
  if ($('endMonth')) $('endMonth').value = now.toISOString().slice(0,7);
}

function loadDepartmentsList() {
  // 只有老师和管理员可以加载部门列表
  if (!currentUser) return;
  const userRole = getUserRole(currentUser.userId);
  if (userRole !== 'teacher' && userRole !== 'admin') return;
  
  const departments = ['文科大学院', '理科大学院'];
  const sel = $('departmentSelect'); if (!sel) return;
  sel.innerHTML = '<option value="">请选择所属部门</option>';
  departments.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
}

async function loadDepartmentStudents() {
  if (!currentUser) return;
  const userRole = getUserRole(currentUser.userId);
  if (userRole !== 'teacher' && userRole !== 'admin') {
    alert('只有老师和管理员可以查看学生数据');
    return;
  }
  
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
    if ($('studentListArea')) $('studentListArea').style.display = 'block';
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
  (students || []).forEach(stuRaw => {
    const stu = adaptStudent(stuRaw);
    const isSelected = selectedStudents.some(s => s.id === stu.id);
    const div = document.createElement('div');
    div.className = 'student-item';
    div.innerHTML = `
      <input type="checkbox" id="student_${stu.id}" ${isSelected ? 'checked' : ''}>
      <label for="student_${stu.id}">${stu.name} (${stu.id}) - ${stu.major || '—'}</label>
    `;
    div.querySelector('input').addEventListener('change', () => toggleStudent(stu.id));
    box.appendChild(div);
  });
  updateSelectedCount();
}

function toggleStudent(studentId) {
  const found = allStudents.find(s => (s.id || s.studentId || s.userId) === studentId);
  const stu = adaptStudent(found || {});
  if (!stu.id) return;
  const idx = selectedStudents.findIndex(s => s.id === stu.id);
  if (idx === -1) selectedStudents.push(stu); else selectedStudents.splice(idx, 1);
  updateSelectedCount(); loadMajorStudents();
}
function selectAllStudents() {
  const major = $('majorSelect')?.value;
  const list = major ? allStudents.filter(s => s.major === major) : allStudents;
  list.forEach(stuRaw => {
    const stu = adaptStudent(stuRaw);
    if (stu.id && !selectedStudents.some(s => s.id === stu.id)) selectedStudents.push(stu);
  });
  updateSelectedCount(); displayStudentList(list);
}
function clearAllStudents() { selectedStudents=[]; updateSelectedCount(); loadMajorStudents(); }
function updateSelectedCount() { if ($('selectedCount')) $('selectedCount').textContent = selectedStudents.length; }

async function generateReport() {
  if (!currentUser) return;
  const userRole = getUserRole(currentUser.userId);
  if (userRole !== 'teacher' && userRole !== 'admin') {
    alert('只有老师和管理员可以生成报告');
    return;
  }
  
  if (selectedStudents.length === 0) { alert('请先选择学生'); return; }
  const startMonth = $('startMonth')?.value || '';
  const endMonth   = $('endMonth')?.value || '';
  const dataTypes = [];
  if ($('attendance')?.checked) dataTypes.push('出席');
  if ($('homework')?.checked) dataTypes.push('作业');
  if ($('consultation')?.checked) dataTypes.push('面谈');
  if ($('progress')?.checked) dataTypes.push('进度');

  if ($('resultsPanel')) $('resultsPanel').style.display = 'block';
  if ($('loadingIndicator')) $('loadingIndicator').style.display = 'flex';
  if ($('resultsData')) $('resultsData').style.display = 'none';

  const studentIds = selectedStudents.map(s => s.id);
  try {
    const data = await callAPI('generateStudentReport', { studentIds, startMonth, endMonth, dataTypes });
    displayReportResults(Array.isArray(data) ? data : []);
    if ($('loadingIndicator')) $('loadingIndicator').style.display = 'none';
    if ($('resultsData')) $('resultsData').style.display = 'block';
    if ($('exportBtn')) $('exportBtn').style.display = 'inline-block';
  } catch (e) {
    alert('生成报告失败：' + e.message);
    if ($('loadingIndicator')) $('loadingIndicator').style.display = 'none';
  }
}

function displayReportResults(data) {
  if ($('resultCount')) $('resultCount').textContent = '共 ' + data.length + ' 条记录';
  const tbody = $('tableBody'); 
  if (tbody) {
    tbody.innerHTML = '';
    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.student}</td><td>${item.type}</td><td>${item.value}</td><td>${item.note || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }
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
  if ($('copyArea')) $('copyArea').textContent = report;
}
function exportReport() {
  const text = $('copyArea')?.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('exportBtn'); const t = btn.textContent;
    btn.textContent = '已复制!'; setTimeout(() => { btn.textContent = t; }, 1500);
  }).catch(() => { alert('复制失败，请手动选择文本'); });
}
function resetFilters() {
  if ($('departmentSelect')) $('departmentSelect').value = '';
  if ($('majorSelect')) $('majorSelect').value = '';
  selectedStudents = []; allStudents = [];
  if ($('studentListArea')) $('studentListArea').style.display = 'none';
  const now = new Date();
  if ($('startMonth')) $('startMonth').value = now.toISOString().slice(0,7);
  if ($('endMonth')) $('endMonth').value = now.toISOString().slice(0,7);
  ['attendance','homework','consultation','progress'].forEach(id => { const cb=$(id); if(cb) cb.checked = true; });
  if ($('resultsPanel')) $('resultsPanel').style.display = 'none';
  if ($('exportBtn')) $('exportBtn').style.display = 'none';
}

/* ================== 用户数据加载（示例） ================== */
function loadUserData() {
  if (!currentUser) return;
  const userRole = getUserRole(currentUser.userId);
  if (userRole === 'teacher' || userRole === 'admin') {
    loadDepartmentsList();
  }
}

/* ================== 初始化 + API 连接状态检测 ================== */
document.addEventListener('DOMContentLoaded', async () => {
  // 导航绑定
  document.querySelectorAll('.nav-link').forEach(link => {
    navLinks.push(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.dataset.page;
      
      // 权限检查
      if (currentUser && pageId) {
        const userRole = getUserRole(currentUser.userId);
        
        // 学生不能访问发布和数据管理页面
        if (userRole === 'student' && (pageId === 'output' || pageId === 'datamanagement')) {
          alert('您没有权限访问此功能');
          return;
        }
        
        // 非老师和管理员不能访问数据管理
        if (pageId === 'datamanagement' && userRole !== 'teacher' && userRole !== 'admin') {
          alert('只有老师和管理员可以访问数据管理功能');
          return;
        }
        
        // 非老师和管理员不能访问发布功能
        if (pageId === 'output' && userRole !== 'teacher' && userRole !== 'admin') {
          alert('只有老师和管理员可以发布课程');
          return;
        }
      }
      
      if (pageId) showPage(pageId);
    });
  });

  // 登录注册退出
  $('loginBtn')?.addEventListener('click', login);
  $('registerBtn')?.addEventListener('click', registerUser);
  $('logoutBtn')?.addEventListener('click', logout);
  $('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  $('showLoginBtn')?.addEventListener('click', showLoginForm);
  $('loginUsername')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });

  // API 状态
  setApiStatus({ok:null, text:'API 检测中'});
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

  // 手机端抽屉（仅 ≤600px 生效）
  (function(){
    const strip = document.getElementById('menuStrip');
    const aside = document.querySelector('aside');
    const main  = document.querySelector('main');
    if (!strip || !aside || !main) return;

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

    strip.addEventListener('click', (e)=>{
      if (!isMobile()) return;
      e.stopPropagation();
      isOpen() ? close() : open();
    });

    main.addEventListener('click', (e)=>{
      if (!isMobile() || !isOpen()) return;
      const t = e.target;
      if (aside.contains(t) || strip.contains(t)) return;
      close();
    });

    const onChange = () => { if (!mq.matches) close(); };
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
  })();
});
