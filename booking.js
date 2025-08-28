// booking.js —— 预约相关功能模块

document.addEventListener('DOMContentLoaded', () => {
  
  // ================================================================
  // 工具函数
  // ================================================================
  
  // 极简表格渲染工具（只读）
  function renderSimpleTable_(rows, cols) {
    const th = cols.map(c => '<th>' + c + '</th>').join('');
    const tr = rows.map(r => 
      '<tr>' + cols.map(c => '<td>' + (r[c] ?? '') + '</td>').join('') + '</tr>'
    ).join('');
    return '<table class="table demo" style="width:100%;border-collapse:collapse;"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table>';
  }

  // ================================================================
  // 数据加载函数
  // ================================================================
  
  // 学生端：加载"我的预约/确认"
  async function loadMyConfirmations() {
    try {
      const me = window.currentUser || {};
      if (!me.userId) return;
      
      const res = await callAPI('listConfirmationsForUser', { userId: me.userId });
      const wrap = document.getElementById('myConfirmationsWrap');
      if (!wrap) return;
      
      if (!res || !res.success) { 
        wrap.textContent = '加载失败'; 
        return; 
      }
      
      const list = res.data || [];
      if (list.length === 0) { 
        wrap.textContent = '暂无预约/确认记录'; 
        return; 
      }
      
      wrap.innerHTML = renderSimpleTable_(list, [
        '课程名称', '单回课程名', '上课日期', '开始时间', '结束时间', '课程属性', '状态'
      ]);
    } catch(e) {
      console.error('加载预约记录失败:', e);
    }
  }

  // 老师端：加载"课程管理"→确认记录
  async function loadTeacherConfirmations() {
    try {
      const me = window.currentUser || {};
      const s = document.getElementById('dmCourseStart')?.value || '';
      const e = document.getElementById('dmCourseEnd')?.value || '';
      
      const res = await callAPI('listConfirmationsForTeacher', { 
        userId: me.userId || '', 
        viewStart: s, 
        viewEnd: e 
      });
      
      const wrap = document.getElementById('dmCourseTableWrap');
      if (!wrap) return;
      
      if (!res || !res.success) { 
        wrap.textContent = '加载失败'; 
        return; 
      }
      
      const list = res.data || [];
      if (list.length === 0) { 
        wrap.textContent = '暂无记录'; 
        return; 
      }
      
      wrap.innerHTML = renderSimpleTable_(list, [
        '上课日期', '开始时间', '结束时间', '课程名称', '单回课程名', 
        '课程属性', '课程回数', '可见ID', '状态', '操作ID', '槽位ID', '批次ID'
      ]);
    } catch(e) {
      console.error('加载确认记录失败:', e);
    }
  }

  // ================================================================
  // 预约弹窗（简单版本）
  // ================================================================
  
  // 显示预约弹窗
  function showBookingDialog(eventInfo) {
    const { slotId, title, date, attr } = eventInfo;
    
    // 检查是否支持预约
    if (attr !== 'VIP' && attr !== '面谈') {
      alert('该课程不支持预约功能');
      return;
    }
    
    // 获取当前用户信息
    const me = window.currentUser || {};
    if (!me.userId) {
      alert('请先登录');
      return;
    }
    
    // 简单弹窗询问预约时间
    const startTime = prompt(`预约 ${title}\n日期：${date}\n\n请输入开始时间 (格式: HH:MM，如 14:30)：`);
    if (!startTime) return;
    
    // 验证时间格式
    if (!/^\d{1,2}:\d{2}$/.test(startTime)) {
      alert('时间格式不正确，请使用 HH:MM 格式');
      return;
    }
    
    // 调用预约接口
    bookSlotAPI(slotId, date, startTime, me.userId, me.name);
  }
  
  // 调用预约API
  async function bookSlotAPI(slotId, date, startTime, studentId, studentName) {
    try {
      const res = await callAPI('bookSlot', {
        slotId,
        date,
        startTime,
        studentId,
        studentName
      });
      
      if (res && res.success) {
        alert('预约成功！');
        // 刷新相关数据
        if (window.calendar) {
          window.calendar.refetchEvents();
        }
        loadMyConfirmations();
      } else {
        alert('预约失败：' + (res.message || '未知错误'));
      }
    } catch (e) {
      alert('预约失败：网络错误');
      console.error('预约失败:', e);
    }
  }

  // ================================================================
  // 事件绑定
  // ================================================================
  
  // 数据管理→课程管理：点击"加载"
  document.getElementById('dmCourseReload')?.addEventListener('click', loadTeacherConfirmations);
  
  // 暴露给全局，供页面切换时调用
  window.bookingModule = {
    loadMyConfirmations,
    loadTeacherConfirmations,
    showBookingDialog
  };
  
});
