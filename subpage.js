(function(){
  const $ = s => document.querySelector(s);

  const sidebar  = $('#sidebar');
  const backdrop = $('#backdrop');
  const ham      = $('#hamburger');

  // ========== 抽屉开关 ==========
  function toggle(open){
    const v = (typeof open === 'boolean') ? open : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', v);
    backdrop.classList.toggle('show', v);
  }
  ham?.addEventListener('click', () => toggle());
  backdrop?.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => { if(e.key === 'Escape') toggle(false); });

  // ========== 登录态：从 localStorage 读取 ==========
  const raw = localStorage.getItem('eds:user');
  if (!raw) { location.href = 'index.html'; return; }
  const user = JSON.parse(raw || '{}');

  const badge = $('#userBadge');
  const greet = $('#greeting');
  if (badge) badge.style.display = '';
  if (greet) greet.textContent = `欢迎，${user.name || user.id || '用户'}`;
  $('#logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('eds:user');
    location.href = 'index.html';
  });

  // ========== 当前页高亮 + 防刷新 ==========
  const cur = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav a.nav-link').forEach(a => {
    const target = (a.getAttribute('href') || '').toLowerCase() || 'index.html';
    if (target === cur) {
      a.classList.add('active');
      a.addEventListener('click', e => { 
        e.preventDefault(); 
        toggle(false); 
      });
    }
  });
})();