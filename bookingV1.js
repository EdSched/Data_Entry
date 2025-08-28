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
  // 显示预约弹窗
  function showBookingDialog(eventInfo) {
    const { slotId, title, date, attr, slotStart, slotEnd } = eventInfo;
    
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
    
    // 创建预约弹窗
    createBookingModal(eventInfo, me);
  }
  
  // 创建预约弹窗界面
  function createBookingModal(eventInfo, user) {
    const { slotId, title, date, attr, slotStart, slotEnd } = eventInfo;
    
    // 移除已存在的弹窗
    const existingModal = document.getElementById('bookingModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // 创建弹窗HTML
    const modalHTML = `
      <div id="bookingModal" style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.5); z-index: 9999; 
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background: white; border-radius: 12px; padding: 24px; 
          width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 600;">课程预约</h2>
            <button id="closeBookingModal" style="
              background: none; border: none; font-size: 24px; 
              cursor: pointer; color: #666; padding: 0; width: 32px; height: 32px;
            ">&times;</button>
          </div>
          
          <div style="margin-bottom: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">课程信息</h3>
            <p style="margin: 4px 0; color: #666;"><strong>课程名称：</strong>${title.replace(' [可预约]', '')}</p>
            <p style="margin: 4px 0; color: #666;"><strong>课程类型：</strong>${attr}</p>
            <p style="margin: 4px 0; color: #666;"><strong>日期：</strong>${date}</p>
            ${slotStart && slotEnd ? `<p style="margin: 4px 0; color: #666;"><strong>时间段：</strong>${slotStart} - ${slotEnd}</p>` : ''}
          </div>
          
          <form id="bookingForm">
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #333;">
                预约开始时间 <span style="color: #e74c3c;">*</span>
              </label>
              <input type="time" id="bookingStartTime" required style="
                width: 100%; padding: 8px 12px; border: 1px solid #ddd; 
                border-radius: 6px; font-size: 14px; box-sizing: border-box;
              " ${slotStart ? `value="${slotStart}"` : ''}>
              <small style="color: #666; font-size: 12px;">建议时间：${slotStart || '请选择合适的时间'}</small>
            </div>
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #333;">
                预约结束时间
              </label>
              <input type="time" id="bookingEndTime" style="
                width: 100%; padding: 8px 12px; border: 1px solid #ddd; 
                border-radius: 6px; font-size: 14px; box-sizing: border-box;
              " ${slotEnd ? `value="${slotEnd}"` : ''}>
              <small style="color: #666; font-size: 12px;">不填写则默认1小时</small>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #333;">
                预约备注
              </label>
              <textarea id="bookingNote" rows="3" placeholder="请填写预约原因、希望讨论的内容等..." style="
                width: 100%; padding: 8px 12px; border: 1px solid #ddd; 
                border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box;
              "></textarea>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button type="button" id="cancelBooking" style="
                padding: 10px 20px; border: 1px solid #ddd; background: white; 
                border-radius: 6px; cursor: pointer; color: #666;
              ">取消</button>
              <button type="submit" id="confirmBooking" style="
                padding: 10px 20px; border: none; background: #22c55e; 
                color: white; border-radius: 6px; cursor: pointer; font-weight: 500;
              ">确认预约</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // 插入到页面
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 绑定事件
    bindBookingModalEvents(eventInfo, user);
  }
  
  // 绑定预约弹窗事件
  function bindBookingModalEvents(eventInfo, user) {
    const modal = document.getElementById('bookingModal');
    const form = document.getElementById('bookingForm');
    const closeBtn = document.getElementById('closeBookingModal');
    const cancelBtn = document.getElementById('cancelBooking');
    
    // 关闭弹窗
    const closeModal = () => {
      modal && modal.remove();
    };
    
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // 点击背景关闭
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // ESC键关闭
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    // 表单提交
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const startTime = document.getElementById('bookingStartTime')?.value;
      const endTime = document.getElementById('bookingEndTime')?.value;
      const note = document.getElementById('bookingNote')?.value;
      
      if (!startTime) {
        alert('请选择预约开始时间');
        return;
      }
      
      // 提交预约
      const confirmBtn = document.getElementById('confirmBooking');
      const originalText = confirmBtn?.textContent;
      if (confirmBtn) {
        confirmBtn.textContent = '预约中...';
        confirmBtn.disabled = true;
      }
      
      try {
        await submitBooking({
          ...eventInfo,
          startTime,
          endTime,
          note,
          user
        });
        closeModal();
      } catch (error) {
        console.error('预约失败:', error);
        if (confirmBtn) {
          confirmBtn.textContent = originalText;
          confirmBtn.disabled = false;
        }
      }
    });
  }
  
  // 提交预约
  async function submitBooking(bookingData) {
    const { slotId, date, startTime, endTime, note, user } = bookingData;
    
    try {
      const res = await callAPI('bookSlot', {
        slotId,
        date,
        startTime,
        endTime,
        note,
        studentId: user.userId,
        studentName: user.name
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
