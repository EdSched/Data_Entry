(() => {
  // 取 DOM
  const $ = (s) => document.querySelector(s);
  const loginContainer = $('#loginContainer');
  const appContainer   = $('#appContainer');
  const userBadge      = $('#userBadge');
  const logoutBtn      = $('#logoutBtn');
  const hamburger      = $('#hamburger');
  const sidebar        = $('#sidebar');
  const backdrop       = $('#backdrop');

  // 日历实例
  let calendar;

  // ============ 抽屉开关 ============
  function toggleSidebar(show){
    const willShow = (typeof show === 'boolean') ? show : !sidebar.classList.contains('open');
    if (willShow){ sidebar.classList.add('open'); backdrop.classList.add('show'); }
    else { sidebar.classList.remove('open'); backdrop.classList.remove('show'); }
  }
  hamburger.addEventListener('click', () => toggleSidebar());
  backdrop.addEventListener('click', () => toggleSidebar(false));

  // ============ 登录成功：统一入口 ============
  function onLoginSuccess(user){
    // 显示主界面
    loginContainer.style.display = 'none';
    appContainer.style.display   = '';
    userBadge.style.display      = '';
    hamburger.style.display      = '';   // 登录后才显示汉堡

    // 欢迎词
    const name = user?.name || user?.id || '用户';
    $('#greeting').textContent = `欢迎，${name}`;

    // 初始化日历
    initCalendar();

    // 退出
    logoutBtn.onclick = () => {
      try { localStorage.removeItem('eds:user'); } catch(_){}
      toggleSidebar(false);
      hamburger.style.display = 'none';
      userBadge.style.display = 'none';
      appContainer.style.display = 'none';
      loginContainer.style.display = '';
    };
  }
  // 暴露给外部（如果你有真实登录流程，成功后直接调用）
  window.onLoginSuccess = onLoginSuccess;

  // ============ 最简登录（占位，可替换为你的 API） ============
  $('#loginBtn').addEventListener('click', async () => {
    const id = $('#loginUsername').value.trim();
    if (!id){ return showError('#loginError', '请先输入用户ID'); }

    // TODO: 替换为你的校验逻辑；成功后调用 onLoginSuccess
    const user = { id, name: id, role: id.startsWith('T') ? '老师' : (id.startsWith('S') ? '学生' : '用户') };
    try { localStorage.setItem('eds:user', JSON.stringify(user)); } catch(_){}
    onLoginSuccess(user);
  });

  // 回车提交
  $('#loginUsername').addEventListener('keydown', (e)=>{ if(e.key==='Enter') $('#loginBtn').click(); });

  // 自动登录（如果有）
  try{
    const saved = localStorage.getItem('eds:user');
    if (saved){ onLoginSuccess(JSON.parse(saved)); }
  }catch(_){}

  function showError(sel,msg){
    const el = $(sel); el.textContent = msg; el.style.color = '#d00';
    setTimeout(()=>{ el.textContent=''; }, 2000);
  }

  // ============ 日历 ============
  function initCalendar(){
    if (calendar){ calendar.destroy(); }

    const initialView = window.matchMedia('(max-width: 768px)').matches ? 'timeGridDay' : 'timeGridWeek';
    calendar = new FullCalendar.Calendar($('#mainCalendar'), {
      initialView,
      locale: 'zh-cn',
      firstDay: 1,
      height: 'auto',
      slotMinTime: '09:00:00',
      slotMaxTime: '21:00:00',
      slotDuration: '00:30:00',
      expandRows: true,
      headerToolbar: false,
      events: [], // 先空着，你的逻辑里再 setEvents
      datesSet: updateTitle
    });
    calendar.render();

    // 顶部控制
    $('#prevBtn').onclick  = ()=>calendar.prev();
    $('#nextBtn').onclick  = ()=>calendar.next();
    $('#todayBtn').onclick = ()=>calendar.today();

    bindViewSwitch('dayBtn',   'timeGridDay');
    bindViewSwitch('weekBtn',  'timeGridWeek');
    bindViewSwitch('monthBtn', 'dayGridMonth');

    updateTitle();
  }

  function bindViewSwitch(btnId, viewName){
    const btn = $('#'+btnId);
    btn.onclick = ()=>{
      calendar.changeView(viewName);
      for(const b of document.querySelectorAll('.seg-btn')) b.classList.remove('active');
      btn.classList.add('active');
      updateTitle();
    };
  }

  function updateTitle(){
    const view = calendar.view;
    const titleEl = $('#calendarTitle');
    const d = calendar.getDate();

    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');

    if (view.type === 'timeGridDay'){
      titleEl.textContent = `${y}/${m}/${day}`;
      setActive('dayBtn');
    } else if (view.type === 'timeGridWeek'){
      // 显示“YYYY/MM/DD – MM/DD”
      const start = new Date(view.currentStart);
      const end   = new Date(view.currentEnd); end.setDate(end.getDate()-1);
      const mm1 = String(start.getMonth()+1).padStart(2,'0');
      const dd1 = String(start.getDate()).padStart(2,'0');
      const mm2 = String(end.getMonth()+1).padStart(2,'0');
      const dd2 = String(end.getDate()).padStart(2,'0');
      titleEl.textContent = `${y}/${mm1}/${dd1} – ${mm2}/${dd2}`;
      setActive('weekBtn');
    } else {
      titleEl.textContent = `${y}/${m}`;
      setActive('monthBtn');
    }
  }
  function setActive(id){
    for(const b of document.querySelectorAll('.seg-btn')) b.classList.remove('active');
    $('#'+id).classList.add('active');
  }

})();