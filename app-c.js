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
function normalizeUser(u = {}, fallbackId = '') {
  return {
    userId: u.userId || u.username || u.id || fallbackId || '',
    name: u.name || u.realName || u.displayName || '',
    role: u.role || u.identity || '',
    department: u.department || u.affiliation || u.dept || '',
    major: u.major || u.subject || ''
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

/* ================== 用户界面权限控制 ================== */
function updateUIForUserRole(userId) {
  const role = getUserRole(userId);
  
  // 获取三套导航
  const navStudent = document.getElementById('nav-student');
  const navTeacher = document.getElementById('nav-teacher'); 
  const navAdmin = document.getElementById('nav-admin');
  const overviewSection = document.querySelector('.sidebar-section'); // 今日提醒
  
  // 先隐藏所有导航
  if (navStudent) navStudent.style.display = 'none';
  if (navTeacher) navTeacher.style.display = 'none';
  if (navAdmin) navAdmin.style.display = 'none';
  
  // 根据角色显示对应导航
  switch(role) {
    case 'student':
      if (navStudent) navStudent.style.display = 'block';
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('学生用户界面已设置');
      break;
      
    case 'teacher':
      if (navTeacher) navTeacher.style.display = 'block';
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('老师用户界面已设置');
      break;
      
    case 'admin':
      if (navAdmin) navAdmin.style.display = 'block';
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('管理员用户界面已设置');
      break;
      
    default:
      // 未知角色：隐藏敏感功能
      if (overviewSection) overviewSection.style.display = 'block';
      console.log('未知用户角色，限制访问权限');
  }
}

/* ================== 导航切换 ================== */
const navLinks = [];
function showPage(pageId) {
  // 隐藏所有页面
  document.querySelectorAll('.page-content').forEach(p => { 
    p.classList.remove('active'); 
    p.style.display = 'none'; 
  });
  
  // 显示目标页面
  let targetPage = null;
  
  // 处理页面ID映射
  switch(pageId) {
    case 'calendar':
      targetPage = document.getElementById('calendarPage');
      break;
    case 'mycourses':
      targetPage = document.getElementById('mycoursesPage');
      break;
    case 'myprogress':
      targetPage = document.getElementById('myprogressPage');
      break;
    case 'myprofile':
      targetPage = document.getElementById('myprofilePage');
      break;
    case 'output':
      targetPage = document.getElementById('outputPage');
      break;
    case 'input':
      targetPage = document.getElementById('inputPage');
      break;
    case 'datamanagement':
      targetPage = document.getElementById('datamanagementPage');
      break;
    case 'task':
      targetPage = document.getElementById('taskPage');
      break;
    default:
      console.warn('未知页面ID:', pageId);
      targetPage = document.getElementById('calendarPage'); // 默认显示日历
  }
  
  if (targetPage) { 
    targetPage.style.display = 'block'; 
    targetPage.classList.add('active'); 
  }
  
  // 更新导航激活状态
  navLinks.forEach(a => a.classList.remove('active'));
  const activeLink = document.querySelector('.nav-link[data-page="'+pageId+'"]');
  if (activeLink) activeLink.classList.add('active');
  
  // 如果是日历页面，更新尺寸
  if (pageId === 'calendar' && window.calendar) {
    setTimeout(() => window.calendar.updateSize(), 60);
  }
}

/* ================== 初始化导航绑定 ================== */
function initNavigation() {
  // 清空之前的绑定
  navLinks.length = 0;
  
  // 绑定所有导航链接（三套导航中的所有链接）
  document.querySelectorAll('.nav-link').forEach(link => {
    navLinks.push(link);
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageId = link.dataset.page;
      
      // 权限检查
      if (currentUser && pageId) {
        const userRole = getUserRole(currentUser.userId);
        
        // 学生权限检查
        if (userRole === 'student') {
          const allowedPages = ['calendar', 'mycourses', 'myprogress', 'myprofile'];
          if (!allowedPages.includes(pageId)) {
            alert('您没有权限访问此功能');
            return;
          }
        }
        
        // 老师权限检查
        if (userRole === 'teacher') {
          const allowedPages = ['calendar', 'output', 'input', 'datamanagement'];
          if (!allowedPages.includes(pageId)) {
            alert('您没有权限访问此功能');
            return;
          }
        }
        
        // 管理员权限检查
        if (userRole === 'admin') {
          const allowedPages = ['calendar', 'output', 'datamanagement', 'task'];
          if (!allowedPages.includes(pageId)) {
            alert('您没有权限访问此功能');
            return;
          }
        }
      }
      
      if (pageId) showPage(pageId);
    });
  });
}

/* ================== 日历功能（简化版） ================== */
let calendar = null;

function initCalendar() {
  const el = $('mainCalendar'); 
  if (!el) return;
  
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  calendar = new FullCalendar.Calendar(el, {
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
    eventClick: handleEventClick
  });
  
  // 绑定日历控制按钮
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const todayBtn = $('todayBtn');
  const dayBtn = $('dayBtn');
  const weekBtn = $('weekBtn');
  const monthBtn = $('monthBtn');
  const refreshBtn = $('refreshDataBtn');
  
  if (prevBtn) prevBtn.onclick = () => calendar.prev();
  if (nextBtn) nextBtn.onclick = () => calendar.next();
  if (todayBtn) todayBtn.onclick = () => calendar.today();
  if (dayBtn) dayBtn.onclick = () => changeView('timeGridDay', dayBtn);
  if (weekBtn) weekBtn.onclick = () => changeView('timeGridWeek', weekBtn);
  if (monthBtn) monthBtn.onclick = () => changeView('dayGridMonth', monthBtn);
  if (refreshBtn) refreshBtn.onclick = refreshData;

  calendar.render();
  updateCalendarTitle();
  loadCalendarEvents();
}


function updateCalendarTitle() {
  if (!calendar) return;
  const view = calendar.view, date = calendar.getDate();
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  const titleEl = $('calendarTitle');
  if (!titleEl) return;
  
  if (view.type === 'timeGridDay') {
    titleEl.textContent = `${y}/${m}/${d}`;
  } else if (view.type === 'timeGridWeek') {
    const s = new Date(view.currentStart), e = new Date(view.currentEnd); 
    e.setDate(e.getDate()-1);
    titleEl.textContent = `${y}/${String(s.getMonth()+1).padStart(2,'0')}/${String(s.getDate()).padStart(2,'0')} — ${String(e.getMonth()+1).padStart(2,'0')}/${String(e.getDate()).padStart(2,'0')}`;
  } else {
    titleEl.textContent = `${y}/${m}`;
  }
}

/* ================== 更新的日历功能 ================== */

// 更新日历数据加载函数
async function loadCalendarEvents() {
  if (!currentUser || !calendar) return;
  
  try {
    // 获取当前日历视图的日期范围
    const view = calendar.view;
    const startDate = formatDateForAPI(view.currentStart);
    const endDate = formatDateForAPI(view.currentEnd);
    
    // 调用新的课程日历API
    const events = await callAPI('getCourseCalendarEvents', { 
      userId: currentUser.userId,
      startDate: startDate,
      endDate: endDate
    });
    
    // 清除现有事件
    calendar.removeAllEvents();
    
    // 添加新事件
    if (Array.isArray(events)) {
      events.forEach(event => {
        calendar.addEvent(event);
      });
    }
    
    updateTodayStats();
    
  } catch (e) { 
    console.error('加载课程日历失败:', e); 
  }
}

// 格式化日期用于API调用
function formatDateForAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 更新事件点击处理
function handleEventClick(info) {
  const event = info.event;
  const props = event.extendedProps || {};
  
  // 构建弹窗内容
  const details = [];
  details.push(`课程名: ${event.title}`);
  
  // 格式化时间显示
  const startTime = event.start;
  if (startTime) {
    const timeStr = startTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const endTime = event.end ? event.end.toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) : '';
    
    details.push(`时间: ${timeStr}${endTime ? '–' + endTime : ''}`);
  }
  
  // 任课老师（有才显示）
  if (props.teacher) {
    details.push(`任课老师: ${props.teacher}`);
  }
  
  // 槽位ID（便于回表定位）
  if (props.slotId) {
    details.push(`槽位ID: ${props.slotId}`);
  }
  
  alert(details.join('\n'));
}


// 在日历初始化后绑定视图变化监听
function initCalendar() {
  const el = $('mainCalendar'); 
  if (!el) return;
  
  const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
  calendar = new FullCalendar.Calendar(el, {
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
    datesSet: function(info) {
      // 当日历视图日期范围改变时，重新加载数据
      updateCalendarTitle();
      if (currentUser) {
        setTimeout(() => {
          loadCalendarEvents();
        }, 50);
      }
    },
    eventClick: handleEventClick
  });
  
  // 绑定日历控制按钮
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const todayBtn = $('todayBtn');
  const dayBtn = $('dayBtn');
  const weekBtn = $('weekBtn');
  const monthBtn = $('monthBtn');
  const refreshBtn = $('refreshDataBtn');
  
  if (prevBtn) prevBtn.onclick = () => calendar.prev();
  if (nextBtn) nextBtn.onclick = () => calendar.next();
  if (todayBtn) todayBtn.onclick = () => calendar.today();
  if (dayBtn) dayBtn.onclick = () => changeView('timeGridDay', dayBtn);
  if (weekBtn) weekBtn.onclick = () => changeView('timeGridWeek', weekBtn);
  if (monthBtn) monthBtn.onclick = () => changeView('dayGridMonth', monthBtn);
  if (refreshBtn) refreshBtn.onclick = refreshData;

  calendar.render();
  updateCalendarTitle();
  
  // 初次加载数据
  if (currentUser) {
    loadCalendarEvents();
  }
}

// 刷新数据函数
function refreshData() { 
  loadCalendarEvents(); 
}
// 更新日历视图变化时的数据重新加载
function changeView(viewName, activeBtn) {
  if (!calendar) return;
  
  calendar.changeView(viewName);
  
  // 更新按钮状态
  ['dayBtn','weekBtn','monthBtn'].forEach(id => { 
    const b = $(id); 
    if(b) b.classList.remove('active'); 
  });
  if (activeBtn) activeBtn.classList.add('active');
  
  // 更新标题
  updateCalendarTitle();
  
  // 重新加载数据（因为视图范围改变了）
  setTimeout(() => {
    loadCalendarEvents();
  }, 100);
}

// 更新今日统计（简化版）
function updateTodayStats(){
  // 这里可以根据加载的事件数据统计今日课程数量
  // 暂时保持原有的占位数据
  $('todayCourses').textContent = $('todayCourses').textContent || '0';
  $('todayConsultations').textContent = $('todayConsultations').textContent || '0';
  $('todayReminders').textContent = $('todayReminders').textContent || '0';
  $('attendanceRate').textContent = $('attendanceRate').textContent || '—';
}


/* ================== 登录成功后的初始化流程 ================== */
async function initializeAfterLogin() {
  if (!currentUser) return;
  
  // 更新用户界面显示
  updateUserInterface();
  
  // 根据用户角色设置界面权限
  updateUIForUserRole(currentUser.userId);
  
  // 重新绑定导航（确保权限正确应用）
  initNavigation();
  
  // 初始化日历
  initCalendar();
  
  // 根据角色加载不同的数据和功能
  const userRole = getUserRole(currentUser.userId);
  
  switch(userRole) {
    case 'student':
      // 学生：加载课程数据、进度数据等
      loadStudentData();
      break;
      
    case 'teacher':
      // 老师：加载老师相关数据
      loadTeacherData();
      break;
      
    case 'admin':
      // 管理员：加载管理数据
      loadAdminData();
      break;
  }
}

/* ================== 各角色数据加载函数（占位） ================== */
function loadStudentData() {
  // 占位：加载学生相关数据
  console.log('加载学生数据...');
}

function loadTeacherData() {
  // 占位：加载老师相关数据
  console.log('加载老师数据...');
}

function loadAdminData() {
  // 占位：加载管理员相关数据
  console.log('加载管理员数据...');
}

// 占位函数：部门列表加载
function loadDepartmentsList() {
  console.log('加载部门列表...');
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

    // 切换到主应用界面
    $('loginContainer').style.display = 'none';
    $('mainApp').style.display = 'block';
    try { window.location.hash = '#app'; } catch {}

    // 执行登录后的统一初始化流程
    await initializeAfterLogin();
    
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
/* ================== 注册相关逻辑更新 ================== */

// 在 DOMContentLoaded 中添加专业联动逻辑
document.addEventListener('DOMContentLoaded', async () => {
  // 原有的初始化代码...
  
  // 添加专业联动功能
  setupMajorDropdown();
  
  // 其他原有代码...
});

// 设置专业下拉联动
function setupMajorDropdown() {
  const departmentSelect = document.getElementById('registerDepartment');
  const majorSelect = document.getElementById('registerMajor');
  
  if (!departmentSelect || !majorSelect) return;
  
  // 专业选项配置
  const majorOptions = {
    '理科大学院': ['情报学', '电子电器', '生物化学', '机械'],
    '文科大学院': ['文学', '历史学', '社会学', '新闻传播学', '社会福祉学', '表象文化', '经营学', '经济学', '日本语教育'],
    '其他': [] // 其他部门允许自由填写
  };
  
  // 监听部门选择变化
  departmentSelect.addEventListener('change', function() {
    const selectedDept = this.value;
    updateMajorOptions(selectedDept, majorSelect, majorOptions);
  });
}

// 更新专业选项
function updateMajorOptions(department, majorSelect, majorOptions) {
  // 清空现有选项
  majorSelect.innerHTML = '<option value="">选择专业</option>';
  
  if (!department) {
    // 没选择部门时，专业也为空
    majorSelect.disabled = true;
    return;
  }
  
  if (department === '其他') {
    // 其他部门：变回输入框
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.id = 'registerMajor';
    newInput.placeholder = '请输入专业';
    newInput.style.cssText = majorSelect.style.cssText;
    
    majorSelect.parentNode.replaceChild(newInput, majorSelect);
  } else {
    // 理科/文科大学院：使用下拉选项
    majorSelect.disabled = false;
    const majors = majorOptions[department] || [];
    
    majors.forEach(major => {
      const option = document.createElement('option');
      option.value = major;
      option.textContent = major;
      majorSelect.appendChild(option);
    });
  }
}

// 更新注册函数
async function registerUser() {
  const name = ($('registerName').value || '').trim();
  const email = ($('registerEmail').value || '').trim();
  const department = $('registerDepartment').value;
  const role = $('registerRole').value;
  const err = $('registerError');
  
  // 获取专业值（可能是下拉框或输入框）
  let major = '';
  const majorElement = $('registerMajor');
  if (majorElement) {
    major = (majorElement.value || '').trim();
  }
  
  // 基础验证
  if (!name || !email || !department || !major || !role) { 
    err.textContent = '请填写姓名、邮箱、所属、专业、身份'; 
    return; 
  }
  
  err.style.color = ''; 
  err.textContent = '正在登记…';
  
  const result = await callAPI('registerByProfile', { name, email, department, major, role });
  
  if (result && result.success) {
    err.style.color = 'green';
    
    // 根据身份显示不同提示
    if (role === '老师') {
      err.textContent = '老师注册成功！请联系管理员分配"用户ID"，之后使用用户ID登录。';
    } else {
      err.textContent = '学生注册成功！请联系老师获取"用户ID"，之后使用用户ID登录。';
    }
    
    // 清空表单
    $('registerName').value = '';
    $('registerEmail').value = '';
    $('registerDepartment').value = '';
    $('registerRole').value = '';
    
    // 重置专业选择
    const majorElement = $('registerMajor');
    if (majorElement) {
      if (majorElement.tagName === 'SELECT') {
        majorElement.value = '';
        majorElement.disabled = true;
      } else {
        majorElement.value = '';
      }
    }
    
    setTimeout(showLoginForm, 2000); // 稍微延长显示时间
  } else {
    err.style.color = '#c00'; 
    err.textContent = (result && result.message) || '登记失败';
  }
}
function logout() {
  currentUser = null;
  $('mainApp').style.display = 'none';
  $('loginContainer').style.display = 'flex';
  $('loginUsername').value = '';
  $('loginError').textContent = '';
  setApiStatus({ok:null, text:'API 检测中'});
  try { window.location.hash = '#login'; } catch {}
  
  // 清理界面状态
  document.querySelectorAll('.page-content').forEach(p => { 
    p.classList.remove('active'); 
    p.style.display = 'none'; 
  });
  
  // 重置导航状态
  navLinks.forEach(a => a.classList.remove('active'));
}

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

/* ================== 手机端抽屉菜单 ================== */
function setupMobileMenu() {
  const strip = document.getElementById('menuStrip');
  const aside = document.querySelector('aside');
  const main = document.querySelector('main');
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
  const open = () => { 
    document.body.classList.add('mobile-menu-open'); 
    strip.setAttribute('aria-expanded','true');  
    strip.querySelector('.label').textContent='收起菜单'; 
    refreshCal(); 
  };
  const close = () => { 
    document.body.classList.remove('mobile-menu-open'); 
    strip.setAttribute('aria-expanded','false'); 
    strip.querySelector('.label').textContent='展开菜单'; 
    refreshCal(); 
  };

  strip.addEventListener('click', (e) => {
    if (!isMobile()) return;
    e.stopPropagation();
    isOpen() ? close() : open();
  });

  main.addEventListener('click', (e) => {
    if (!isMobile() || !isOpen()) return;
    const t = e.target;
    if (aside.contains(t) || strip.contains(t)) return;
    close();
  });

  const onChange = () => { if (!mq.matches) close(); };
  mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
}

/* ================== 初始化 + API 连接状态检测 ================== */
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化导航系统
  initNavigation();

  // 登录注册退出按钮绑定
  $('loginBtn')?.addEventListener('click', login);
  $('registerBtn')?.addEventListener('click', registerUser);
  $('logoutBtn')?.addEventListener('click', logout);
  $('showRegisterBtn')?.addEventListener('click', showRegisterForm);
  $('showLoginBtn')?.addEventListener('click', showLoginForm);
  $('loginUsername')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });

  // API 状态检测
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

  // 手机端抽屉功能
  setupMobileMenu();
});
