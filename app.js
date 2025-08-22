// ========== 全局变量 ==========
const API_URL = 'https://script.google.com/macros/s/AKfycbwJYf3jeNAF37vgVXTiWnEgYS5dlh9l9UChkiEhThh4OwV3TVEvP3ZtIS8bpm5G3HLf/exec';
let currentUser = null;
let allStudents = [];
let selectedStudents = [];
let mainCalendar, miniCalendar;

// ========== API调用函数 ==========
async function callAPI(action, params = {}) {
  try {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('params', JSON.stringify(params));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      mode: 'cors'
    });

    const text = await response.text();
    let cleanText = text.trim();
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd = cleanText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
    }
    return JSON.parse(cleanText);
  } catch (error) {
    return { success: false, message: '网络请求失败: ' + error.message };
  }
}

// ========== 界面切换 ==========
function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  clearMessages();
}
function showLoginForm() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  clearMessages();
}
function clearMessages() {
  const le = document.getElementById('loginError');
  const re = document.getElementById('registerError');
  if (le) { le.textContent = ''; le.style.color = ''; }
  if (re) { re.textContent = ''; }
}

// ========== 登录（用户ID唯一通道） ==========
async function login() {
  const username = (document.getElementById('loginUsername').value || '').trim();
  const errorDiv = document.getElementById('loginError');

  if (!username) {
    errorDiv.textContent = '请输入用户ID';
    return;
  }
  errorDiv.textContent = '正在登录...';

  const result = await callAPI('loginByUsername', { username });

  if (result && result.success) {
    currentUser = result.user || {};
    currentUser.userId = currentUser.username || username;

    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    updateUserInterface();
    initializeCalendars();
    loadUserData();
  } else {
    errorDiv.textContent = (result && result.message) || '登录失败：用户ID不存在';
  }
}

// ========== 注册 ==========
async function register() {
  const name = (document.getElementById('registerName').value || '').trim();
  const email = (document.getElementById('registerEmail').value || '').trim();
  const department = document.getElementById('registerDepartment').value;
  const major = (document.getElementById('registerMajor').value || '').trim();
  const role = document.getElementById('registerRole').value;
  const errorDiv = document.getElementById('registerError');

  if (!name || !email || !department || !major || !role) {
    errorDiv.textContent = '请填写姓名、邮箱、所属、专业、身份';
    return;
  }

  errorDiv.textContent = '正在登记...';

  const result = await callAPI('registerByProfile', { name, email, department, major, role });

  if (result && result.success) {
    errorDiv.style.color = 'green';
    errorDiv.textContent = '登记成功！请联系老师获取您的“用户ID”，之后使用用户ID登录。';

    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerDepartment').value = '';
    document.getElementById('registerMajor').value = '';
    document.getElementById('registerRole').value = '';

    setTimeout(showLoginForm, 2000);
  } else {
    errorDiv.style.color = 'red';
    errorDiv.textContent = (result && result.message) || '登记失败';
  }
}

// ========== 退出登录 ==========
function logout() {
  currentUser = null;
  document.getElementById('loginContainer').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginError').textContent = '';
}

// ========== 用户界面更新 ==========
function updateUserInterface() {
  if (!currentUser) return;
  document.getElementById('userGreeting').textContent = `欢迎，${currentUser.name}`;
  document.getElementById('userRole').textContent = `(${currentUser.role})`;

  const analysisTab = document.getElementById('analysisTab');
  const analysisBtn = document.getElementById('analysisBtn');
  const isTeacher = (currentUser.role === '老师' || String(currentUser.userId).startsWith('T'));
  const isAdmin = String(currentUser.userId).startsWith('A');

  if (isTeacher || isAdmin) {
    analysisTab.style.display = 'block';
    analysisBtn.style.display = 'block';
    document.getElementById('publishPanel').style.display = 'block'; // 显示登记面板
  } else {
    analysisTab.style.display = 'none';
    analysisBtn.style.display = 'none';
    document.getElementById('publishPanel').style.display = 'none';
  }
}

// 发布面板行为
document.addEventListener('DOMContentLoaded', () => {
  const pubMode = document.getElementById('pubMode');
  if (pubMode) {
    pubMode.addEventListener('change', function () {
      const isRange = this.value === 'range';
      document.getElementById('singleDateRow').style.display = isRange ? 'none' : 'block';
      document.getElementById('rangeRows').style.display = isRange ? 'block' : 'none';
    });
  }

  const pubSubmitBtn = document.getElementById('pubSubmitBtn');
  if (pubSubmitBtn) {
    pubSubmitBtn.addEventListener('click', async function () {
      if (!currentUser) return;
      const isTeacher = (currentUser.role === '老师' || String(currentUser.userId).startsWith('T'));
      const isAdmin = String(currentUser.userId).startsWith('A');
      if (!isTeacher && !isAdmin) { alert('只有老师/管理员可以发布'); return; }

      const attr = document.getElementById('pubAttr').value;
      const courseName = document.getElementById('pubCourseName').value.trim();
      const mode = document.getElementById('pubMode').value;
      const startTime = document.getElementById('pubStartTime').value;
      const endTime = document.getElementById('pubEndTime').value;
      const majors = document.getElementById('pubMajors').value.trim();
      const visibleStudentIds = document.getElementById('pubVisibleIds').value.trim();

      if (attr === '大课' && !courseName) { alert('大课需填写课程名'); return; }
      if (!startTime || !endTime) { alert('请填写时间'); return; }

      const params = {
        teacherId: currentUser.userId,
        attr, courseName, mode,
        startTime, endTime,
        majors, visibleStudentIds
      };

      if (mode === 'single') {
        const date = document.getElementById('pubDate').value;
        if (!date) { alert('请选择日期'); return; }
        params.date = date;
      } else {
        const sd = document.getElementById('pubStartDate').value;
        const ed = document.getElementById('pubEndDate').value;
        if (!sd || !ed) { alert('请选择起止日期'); return; }
        const wds = Array.from(document.querySelectorAll('.wd:checked')).map(cb => Number(cb.value));
        if (wds.length === 0) { alert('请选择周几'); return; }
        params.startDate = sd;
        params.endDate = ed;
        params.weekdays = wds;
        const c = document.getElementById('pubCount').value;
        if (c) params.count = Number(c);
      }

      const res = await callAPI('publishSlots', params);
      if (res && res.success) {
        alert(res.message || '发布成功');
        loadCalendarEvents();
      } else {
        alert(res.message || '发布失败');
      }
    });
  }
});

// ========== 日历相关 ==========
function initializeCalendars() {
  const miniCalendarEl = document.getElementById('miniCalendar');
  miniCalendar = new FullCalendar.Calendar(miniCalendarEl, {
    initialView: 'dayGridMonth',
    locale: 'zh-cn',
    headerToolbar: { left: 'prev', center: 'title', right: 'next' },
    height: 'auto',
    events: [],
    slotMinTime: '09:00:00', slotMaxTime: '21:00:00', expandRows: true,
    dateClick: function (info) { if (mainCalendar) mainCalendar.gotoDate(info.dateStr); }
  });

  const mainCalendarEl = document.getElementById('mainCalendar');
  mainCalendar = new FullCalendar.Calendar(mainCalendarEl, {
    initialView: 'timeGridWeek',
    locale: 'zh-cn',
    headerToolbar: { left: 'prev,next', center: 'title', right: 'today,timeGridWeek,timeGridDay' },
    buttonText: { today: '今天', week: '周', day: '日' },
    height: 'auto',
    events: [],
    allDaySlot: false,
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    scrollTime: '09:00:00',
    expandRows: true,
    // 修复：此处缺逗号
    eventClick: async function (info) {
      const ev = info.event;
      const ext = ev.extendedProps || {};
      if (!currentUser) return;
      const isStudent = (currentUser.role === '学生' || String(currentUser.userId).startsWith('S'));
      if (isStudent && ext.canBook && ext.status === '可约') {
        const note = prompt(`预约备注（可填具体到达时间等）：\n${ev.title}  ${ev.start.toLocaleString('zh-CN')}`);
        const res = await callAPI('bookSlot', {
          slotId: ev.id,
          studentId: currentUser.userId,
          studentName: currentUser.name,
          note: note || ''
        });
        if (res && res.success) {
          alert('预约成功');
          loadCalendarEvents();
        } else {
          alert(res.message || '预约失败');
        }
      } else {
        showEventDetails(info.event);
      }
    }
  });

  mainCalendar.render();
  miniCalendar.render();

  const toolbar = mainCalendarEl.querySelector('.fc-toolbar');
  if (toolbar) toolbar.classList.add('show');

  loadCalendarEvents();
}

async function loadCalendarEvents() {
  if (!currentUser) return;
  try {
    const events = await callAPI('listVisibleSlots', { userId: currentUser.userId });
    if (mainCalendar) {
      mainCalendar.removeAllEvents();
      if (Array.isArray(events)) events.forEach(ev => mainCalendar.addEvent(ev));
    }
    if (miniCalendar) {
      miniCalendar.removeAllEvents();
      if (Array.isArray(events)) events.forEach(ev => miniCalendar.addEvent(ev));
    }
    updateTodayStats();
  } catch (e) {
    console.error('加载槽位失败:', e);
  }
}

// ========== 数据加载 ==========
function loadUserData() {
  if (!currentUser) return;
  if ((currentUser.role || '').toLowerCase() === '老师' || (currentUser.role || '').toLowerCase() === 'teacher') {
    loadDepartmentsList();
  }
  loadUserProfile();
}

function loadDepartmentsList() {
  const departments = ['文科大学院', '理科大学院'];
  const departmentSelect = document.getElementById('departmentSelect');
  departmentSelect.innerHTML = '<option value="">请选择所属部门</option>';
  departments.forEach(dept => {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    departmentSelect.appendChild(option);
  });
}

async function loadUserProfile() {
  document.getElementById('profileLoading').style.display = 'block';
  document.getElementById('profileContent').style.display = 'none';
  try {
    const userInfo = await callAPI('getCurrentUserInfo', { userId: currentUser.userId });
    displayUserProfile(userInfo || currentUser || {});
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileContent').style.display = 'block';
  } catch (error) {
    console.error('加载用户信息失败:', error);
    document.getElementById('profileLoading').style.display = 'none';
  }
}

// ========== 学生选择相关 ==========
async function loadDepartmentStudents() {
  const department = document.getElementById('departmentSelect').value;
  if (!department) return;
  try {
    const students = await callAPI('getStudentsByClass', { department });
    allStudents = students;
    displayStudentList(students);
    document.getElementById('studentListArea').style.display = 'block';

    const majors = [...new Set((students || []).map(s => s.major))];
    const majorSelect = document.getElementById('majorSelect');
    majorSelect.innerHTML = '<option value="">所有专业</option>';
    majors.forEach(major => {
      const option = document.createElement('option');
      option.value = major;
      option.textContent = major;
      majorSelect.appendChild(option);
    });
  } catch (error) {
    console.error('加载学生失败:', error);
  }
}

function loadMajorStudents() {
  const major = document.getElementById('majorSelect').value;
  if (!major) {
    displayStudentList(allStudents);
  } else {
    const filtered = (allStudents || []).filter(s => s.major === major);
    displayStudentList(filtered);
  }
}

function displayStudentList(students) {
  const studentList = document.getElementById('studentList');
  studentList.innerHTML = '';
  (students || []).forEach(student => {
    const isSelected = selectedStudents.some(s => s.id === student.id);
    const div = document.createElement('div');
    div.className = `student-item ${isSelected ? 'selected' : ''}`;
    div.innerHTML = `
      <input type="checkbox" id="student_${student.id}" ${isSelected ? 'checked' : ''} onchange="toggleStudent('${student.id}')">
      <label for="student_${student.id}">${student.name} (${student.id}) - ${student.major}</label>
    `;
    studentList.appendChild(div);
  });
  updateSelectedCount();
}

function toggleStudent(studentId) {
  const student = allStudents.find(s => s.id === studentId);
  if (!student) return;
  const idx = selectedStudents.findIndex(s => s.id === studentId);
  if (idx === -1) selectedStudents.push(student);
  else selectedStudents.splice(idx, 1);
  updateSelectedCount();
  displayStudentList(allStudents.filter(s => {
    const major = document.getElementById('majorSelect').value;
    return !major || s.major === major;
  }));
}

function selectAllStudents() {
  const major = document.getElementById('majorSelect').value;
  const list = major ? allStudents.filter(s => s.major === major) : allStudents;
  list.forEach(stu => { if (!selectedStudents.some(s => s.id === stu.id)) selectedStudents.push(stu); });
  updateSelectedCount();
  displayStudentList(list);
}

function clearAllStudents() {
  selectedStudents = [];
  updateSelectedCount();
  displayStudentList(allStudents.filter(s => {
    const major = document.getElementById('majorSelect').value;
    return !major || s.major === major;
  }));
}

function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = selectedStudents.length;
}

// ========== 数据分析 ==========
async function generateReport() {
  if (selectedStudents.length === 0) { alert('请先选择学生'); return; }
  const startMonth = document.getElementById('startMonth').value;
  const endMonth = document.getElementById('endMonth').value;
  const dataTypes = [];
  if (document.getElementById('attendance').checked) dataTypes.push('出席');
  if (document.getElementById('homework').checked) dataTypes.push('作业');
  if (document.getElementById('consultation').checked) dataTypes.push('面谈');
  if (document.getElementById('progress').checked) dataTypes.push('进度');

  document.getElementById('resultsPanel').style.display = 'block';
  document.getElementById('loadingIndicator').style.display = 'block';
  document.getElementById('resultsData').style.display = 'none';

  const studentIds = selectedStudents.map(s => s.id);
  try {
    const reportData = await callAPI('generateStudentReport', { studentIds, startMonth, endMonth, dataTypes });
    displayReportResults(reportData || []);
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('resultsData').style.display = 'block';
    document.getElementById('exportBtn').style.display = 'inline-block';
  } catch (error) {
    alert('生成报告失败：' + error.message);
    document.getElementById('loadingIndicator').style.display = 'none';
  }
}

function displayReportResults(data) {
  document.getElementById('resultCount').textContent = `共 ${data.length} 条记录`;
  const tableBody = document.getElementById('tableBody');
  tableBody.innerHTML = '';
  (data || []).forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.student}</td>
      <td>${item.type}</td>
      <td>${item.value}</td>
      <td>${item.note}</td>
    `;
    tableBody.appendChild(row);
  });
  generateCopyableReport(data || []);
}

function generateCopyableReport(data) {
  const copyArea = document.getElementById('copyArea');
  let report = '学生数据分析报告\n\n';
  const students = [...new Set((data || []).map(item => item.student))];
  students.forEach(stu => {
    const sd = data.filter(i => i.student === stu);
    report += `${stu}:\n`;
    sd.forEach(i => { report += `- ${i.type}: ${i.value} (${i.note})\n`; });
    report += '\n';
  });
  report += '请基于以上数据分析学生表现。';
  copyArea.textContent = report;
}

function exportReport() {
  const copyArea = document.getElementById('copyArea');
  const text = copyArea.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('exportBtn');
    const t = btn.textContent;
    btn.textContent = '已复制!';
    setTimeout(() => { btn.textContent = t; }, 2000);
  }).catch(() => {
    alert('复制失败，请手动选择文本');
    copyArea.select();
  });
}

function resetFilters() {
  document.getElementById('departmentSelect').value = '';
  document.getElementById('majorSelect').value = '';
  selectedStudents = [];
  allStudents = [];
  document.getElementById('studentListArea').style.display = 'none';
  const now = new Date();
  document.getElementById('startMonth').value = now.toISOString().slice(0, 7);
  document.getElementById('endMonth').value = now.toISOString().slice(0, 7);
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
  document.getElementById('resultsPanel').style.display = 'none';
  document.getElementById('exportBtn').style.display = 'none';
}

// ========== 用户信息显示 ==========
function displayUserProfile(info) {
  info = info || {};
  const basicInfo = document.getElementById('basicInfo');
  basicInfo.innerHTML = `
    <div class="profile-item"><label>用户ID:</label><span>${info.username || info.userId || ''}</span></div>
    <div class="profile-item"><label>姓名:</label><span>${info.name || ''}</span></div>
    <div class="profile-item"><label>所属:</label><span>${info.department || ''}</span></div>
    <div class="profile-item"><label>专业:</label><span>${info.major || ''}</span></div>
    <div class="profile-item"><label>身份:</label><span>${info.role || ''}</span></div>
  `;

  if ((info.role || '').toLowerCase() === '学生' || (info.role || '').toLowerCase() === 'student') {
    if (info.status) {
      document.getElementById('studyInfo').style.display = 'block';
      document.getElementById('studyDetails').innerHTML = `
        <div class="profile-item"><label>当前状态:</label><span>${info.status}</span></div>
        <div class="profile-item"><label>希望入学时间:</label><span>${info.entryTime || '未设置'}</span></div>
        <div class="profile-item"><label>担当老师:</label><span>${info.teacher || '未分配'}</span></div>
        <div class="profile-item"><label>志望大学:</label><span>${info.targetUniversity || '未设置'}</span></div>
      `;
    }
    loadStudentAttendance(info.userId || currentUser.userId);
    loadStudentConsultations(info.userId || currentUser.userId);
  }
}

async function loadStudentAttendance(userId) {
  try {
    const d = await callAPI('getStudentAttendanceStats', { userId });
    if (d) {
      document.getElementById('attendanceInfo').style.display = 'block';
      document.getElementById('attendanceDetails').innerHTML = `
        <div class="profile-item"><label>总出勤率:</label><span>${d.totalAttendance}</span></div>
        <div class="profile-item"><label>作业完成率:</label><span>${d.totalHomework}</span></div>
      `;
    }
  } catch (e) { console.error('加载出勤信息失败:', e); }
}

async function loadStudentConsultations(userId) {
  try {
    const cs = await callAPI('getConsultationRecords', { userId });
    if (cs && cs.length > 0) {
      document.getElementById('consultationInfo').style.display = 'block';
      const latest = cs[0];
      document.getElementById('consultationDetails').innerHTML = `
        <div class="profile-item"><label>最近面谈:</label><span>${latest.month}</span></div>
        <div class="profile-item"><label>面谈次数:</label><span>${latest.consultationCount}次</span></div>
        <div class="profile-item"><label>当前问题:</label><span>${latest.currentIssues || '无'}</span></div>
      `;
    }
  } catch (e) { console.error('加载面谈记录失败:', e); }
}

// ========== 通用功能 ==========
function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
  const panelMap = { 'calendar': 'calendarPanel', 'analysis': 'analysisPanel', 'profile': 'profilePanel' };
  document.getElementById(panelMap[tabName]).classList.add('active');
  if (tabName === 'profile') loadUserProfile();
}

function refreshData() {
  if (currentUser) {
    loadCalendarEvents();
    updateTodayStats();
  }
}

function updateTodayStats() {
  document.getElementById('todayCourses').textContent = '2';
  document.getElementById('todayConsultations').textContent = '1';
  document.getElementById('todayReminders').textContent = '3';
  document.getElementById('attendanceRate').textContent = '95%';
}

function showEventDetails(event) {
  const details = [];
  details.push(`标题: ${event.title}`);
  details.push(`时间: ${event.start.toLocaleString('zh-CN')}`);
  if (event.end) details.push(`结束: ${event.end.toLocaleString('zh-CN')}`);
  if (event.extendedProps && event.extendedProps.description) details.push(`描述: ${event.extendedProps.description}`);
  alert(details.join('\n'));
}

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', function () {
  try {
    const now = new Date();
    document.getElementById('startMonth').value = now.toISOString().slice(0, 7);
    document.getElementById('endMonth').value = now.toISOString().slice(0, 7);

    // 绑定按钮
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('showRegisterBtn').addEventListener('click', showRegisterForm);
    document.getElementById('showLoginBtn').addEventListener('click', showLoginForm);

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', function () { switchTab(this.dataset.tab); });
    });

    document.getElementById('refreshDataBtn').addEventListener('click', refreshData);
    document.getElementById('analysisBtn').addEventListener('click', () => switchTab('analysis'));
    document.getElementById('profileBtn').addEventListener('click', () => switchTab('profile'));
    document.getElementById('helpBtn').addEventListener('click', () => {
      alert('使用帮助：\n\n1. 登录后可查看个人课程安排\n2. 数据分析功能需要老师权限\n3. 点击日历事件可查看详情\n4. 个人信息页面显示详细资料');
    });

    document.getElementById('loginUsername').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') login();
    });

    testAPIConnection();
  } catch (error) {
    console.error('初始化失败:', error);
    alert('页面初始化失败: ' + error.message);
  }
});

// ========== API连接测试 ==========
async function testAPIConnection() {
  try {
    const result = await callAPI('testConnection');
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.style.color = 'green';
      errorDiv.textContent = 'API连接成功';
    }
  } catch (error) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.textContent = '服务器连接失败，请稍后重试';
      errorDiv.style.color = 'red';
    }
  }
}