// ========== 配置 ==========
const API_URL = 'https://script.google.com/macros/s/AKfycbwJYf3jeNAF37vgVXTiWnEgYS5dlh9l9UChkiEhThh4OwV3TVEvP3ZtIS8bpm5G3HLf/exec';

let currentUser = null;
let calendar;

// ========== 工具 ==========
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
    const raw = (await res.text()).trim();
    const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
    const clean = (s !== -1 && e !== -1 && e > s) ? raw.substring(s, e+1) : raw;
    return JSON.parse(clean);
  } catch (err) {
    return { success:false, message:'网络错误：' + err.message };
  }
}

function $(id){ return document.getElementById(id); }
function setTitle(txt){ $('calendarTitle').textContent = txt || '—'; }

// ========== 登录 / 登出 ==========
async function login() {
  const username = ($('loginUsername').value || '').trim();
  if (!username) { $('loginError').textContent = '请输入用户ID'; return; }
  $('loginError').textContent = '';

  const r = await callAPI('loginByUsername', { username });
  if (!r || !r.success) {
    $('loginError').textContent = (r && r.message) || '登录失败';
    return;
  }

  currentUser = r.user || { username };
  currentUser.userId = currentUser.username || username;
  localStorage.setItem('eds_user', JSON.stringify(currentUser));

  $('loginContainer').style.display = 'none';
  $('appContainer').style.display = 'block';
  $('userBadge').style.display = 'flex';
  $('greeting').textContent = `欢迎，${currentUser.name}（${currentUser.role}）`;

  // 老师/管理员显示“课程安排”入口
  const isTeacher = (currentUser.role === '老师' || String(currentUser.userId).startsWith('T'));
  const isAdmin = String(currentUser.userId).startsWith('A');
  $('linkArrange').style.display = (isTeacher || isAdmin) ? 'block' : 'none';

  initCalendar();
  loadEvents();
}

function logout() {
  localStorage.removeItem('eds_user');
  currentUser = null;
  if (calendar) { calendar.destroy(); calendar = null; }
  $('userBadge').style.display = 'none';
  $('appContainer').style.display = 'none';
  $('loginContainer').style.display = 'flex';
}

// ========== 日历 ==========
function initCalendar(){
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const initialView = isMobile ? 'timeGridDay' : 'timeGridWeek';

  calendar = new FullCalendar.Calendar($('mainCalendar'), {
    initialView,
    locale: 'zh-cn',
    height: 'auto',
    allDaySlot: false,
    slotMinTime: '09:00:00',
    slotMaxTime: '21:00:00',
    slotDuration: '00:30:00',
    expandRows: true,
    eventClick: onEventClick,
    datesSet: (arg) => {
      // 自定义标题（避免换行）
      const start = arg.startStr.slice(0,10);
      const end = new Date(arg.end.getTime() - 86400000).toISOString().slice(0,10);
      const fmt = (s) => s.replace(/-/g,'/'); // 2025/08/17
      if (calendar.view.type === 'timeGridDay') {
        setTitle(fmt(start));
      } else if (calendar.view.type === 'timeGridWeek') {
        setTitle(`${fmt(start)} - ${fmt(end)}`);
      } else {
        setTitle(`${arg.start.getFullYear()} / ${arg.start.getMonth()+1}`);
      }
    }
  });
  calendar.render();

  // 自定义控制
  $('prevBtn').onclick = ()=>calendar.prev();
  $('nextBtn').onclick = ()=>calendar.next();
  $('todayBtn').onclick = ()=>calendar.today();

  const setSeg = (t)=>{
    ['dayBtn','weekBtn','monthBtn'].forEach(id=>$ (id).classList.remove('active'));
    if (t==='timeGridDay') $('dayBtn').classList.add('active');
    if (t==='timeGridWeek') $('weekBtn').classList.add('active');
    if (t==='dayGridMonth') $('monthBtn').classList.add('active');
  };
  $('dayBtn').onclick = ()=>{ calendar.changeView('timeGridDay'); setSeg('timeGridDay'); };
  $('weekBtn').onclick = ()=>{ calendar.changeView('timeGridWeek'); setSeg('timeGridWeek'); };
  $('monthBtn').onclick = ()=>{ calendar.changeView('dayGridMonth'); setSeg('dayGridMonth'); };
}

async function loadEvents(){
  if (!currentUser) return;
  const events = await callAPI('listVisibleSlots', { userId: currentUser.userId });
  if (!Array.isArray(events)) return;
  calendar.removeAllEvents();
  events.forEach(ev => calendar.addEvent(ev));
}

async function onEventClick(info){
  const ev = info.event;
  const ext = ev.extendedProps || {};
  if (!currentUser) return;
  const isStudent = (currentUser.role === '学生' || String(currentUser.userId).startsWith('S'));

  if (isStudent && ext.canBook && ext.status === '可约') {
    const note = prompt(`预约备注：\n${ev.title}\n${ev.start.toLocaleString('zh-CN')}`);
    if (note === null) return;
    const res = await callAPI('bookSlot', {
      slotId: ev.id,
      studentId: currentUser.userId,
      studentName: currentUser.name || currentUser.userId,
      note: note || ''
    });
    alert(res.success ? '预约成功' : (res.message || '预约失败'));
    if (res.success) loadEvents();
  } else {
    alert([
      `标题：${ev.title}`,
      `时间：${ev.start.toLocaleString('zh-CN')}`,
      ev.end ? `结束：${ev.end.toLocaleString('zh-CN')}` : '',
      ext.attr ? `类型：${ext.attr}` : '',
      ext.status ? `状态：${ext.status}` : ''
    ].filter(Boolean).join('\n'));
  }
}

// ========== 侧栏 ==========
function openSidebar(open){
  const sb = $('sidebar'), bd = $('backdrop');
  if (open){ sb.classList.add('open'); bd.classList.add('show'); }
  else { sb.classList.remove('open'); bd.classList.remove('show'); }
}

// ========== 注册 ========== 
async function register(){
  const name = ($('registerName').value||'').trim();
  const email = ($('registerEmail').value||'').trim();
  const department = $('registerDepartment').value;
  const major = ($('registerMajor').value||'').trim();
  const role = $('registerRole').value;
  if (!name || !email || !department || !major || !role){
    $('registerError').textContent = '请完整填写登记信息'; return;
  }
  $('registerError').textContent = '正在提交…';
  const r = await callAPI('registerByProfile', { name,email,department,major,role });
  $('registerError').textContent = r.success ? '登记成功，请找老师分配用户ID' : (r.message || '登记失败');
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  // 侧栏
  $('hamburger').onclick = ()=>openSidebar(true);
  $('backdrop').onclick = ()=>openSidebar(false);

  // 登录/注册/退出/刷新
  $('loginBtn').onclick = login;
  $('registerBtn').onclick = register;
  $('logoutBtn').onclick = logout;
  $('refreshBtn').onclick = loadEvents;

  // 回车登录
  $('loginUsername').addEventListener('keypress', e=>{
    if (e.key === 'Enter') login();
  });

  // API 自检
  try{
    const r = await callAPI('testConnection');
    $('apiStatusTip').textContent = r && r.success ? 'API 连接正常' : 'API 连接异常';
    $('apiPing').textContent = r && r.success ? 'API: 在线' : 'API: 离线';
  }catch(e){
    $('apiStatusTip').textContent = 'API 检测失败';
  }

  // 自动登录
  try{
    const cache = localStorage.getItem('eds_user');
    if (cache){
      currentUser = JSON.parse(cache);
      $('loginContainer').style.display = 'none';
      $('appContainer').style.display = 'block';
      $('userBadge').style.display = 'flex';
      $('greeting').textContent = `欢迎，${currentUser.name}（${currentUser.role}）`;

      const isTeacher = (currentUser.role === '老师' || String(currentUser.userId).startsWith('T'));
      const isAdmin = String(currentUser.userId).startsWith('A');
      $('linkArrange').style.display = (isTeacher || isAdmin) ? 'block' : 'none';

      initCalendar();
      loadEvents();
    }
  }catch{}
});
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('backdrop');

hamburger.addEventListener('click', () => {
  sidebar.classList.add('open');
  backdrop.classList.add('show');
});

backdrop.addEventListener('click', () => {
  sidebar.classList.remove('open');
  backdrop.classList.remove('show');
});

