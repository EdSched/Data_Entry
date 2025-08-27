// pub-course.js —— 课程安排发布（稳健版：事件委托 + 多选 + 兜底）
document.addEventListener('DOMContentLoaded', () => {
  const rootSel = '#pub-course [data-module="publish-course"]';

  // 事件委托，确保无论折叠/加载顺序如何都能绑定到发布按钮
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest(`${rootSel} .btn.btn-primary`);
    if (!btn) return;

    try {
      const root = document.querySelector(rootSel);
      if (!root) return alert('未找到发布表单');

      // fieldset 顺序：0=基本信息，1=时间与重复，2=上课形式与地点，3=讲义/备注
      const sets = root.querySelectorAll('fieldset');
      const fs1 = sets[0], fs2 = sets[1], fs3 = sets[2], fs4 = sets[3];
      if (!fs1 || !fs2) return alert('表单不完整，请刷新页面');

      // —— 基本信息 —— //
      const courseName = fs1.querySelector('input[placeholder="例如：社会学专业课"]')?.value.trim() || '';
      const teacher    = fs1.querySelector('input[placeholder="老师姓名或ID"]')?.value.trim() || '';
      const selects1   = fs1.querySelectorAll('select'); // 约定：0=课程属性,1=所属(pubDepartment),2=专业(pubMajor),3=课程状态
      const courseAttr = selects1[0]?.value || '';
      const dep        = document.getElementById('pubDepartment')?.value || (selects1[1]?.value || '');
      const majorSel   = document.getElementById('pubMajor');
      const scheduleStatus = selects1[3]?.value || '';

      // —— 专业（多选）与面向范围（M列：majors）——
      // 所属=全部或未选 → ['全部']
      // 所属=文/理 + 专业有选 → [所选多个专业]
      // 所属=文/理 + 专业未选 → [所属]（表示该院全部专业）
      const selectedMajors = (majorSel && !majorSel.disabled)
        ? Array.from(majorSel.selectedOptions).map(o => o.value).filter(Boolean)
        : [];
      const majorsOut = (!dep || dep === '全部')
        ? ['全部']
        : (selectedMajors.length ? selectedMajors : [dep]);

      // —— 可见学生IDs（N列）：若未填名单，默认 = majorsOut —— //
      const studentRaw = fs1.querySelector('input[placeholder="学生姓名或ID"]')?.value.trim() || '';
      let visibleIds = studentRaw ? studentRaw.split(/[,\s，、]+/).filter(Boolean) : [];
      if (!visibleIds.length) visibleIds = majorsOut;

      // —— 时间与重复 —— //
      const dates      = fs2.querySelectorAll('input[type="date"]'); // [单回, 起, 止]
      const singleDate = dates[0]?.value || '';
      const rangeStart = dates[1]?.value || '';
      const rangeEnd   = dates[2]?.value || '';
      const dateRange  = (rangeStart && rangeEnd) ? `${rangeStart}~${rangeEnd}` : '';

      const weekdays   = fs2.querySelector('input[placeholder="如：一,三,五"]')?.value.trim() || '';
      const countStr   = fs2.querySelector('input[type="number"]')?.value || '';
      const count      = countStr ? Number(countStr) : '';

      const times      = fs2.querySelectorAll('input[type="time"]'); // [开始, 结束]
      const startTime  = times[0]?.value || '';
      const endTime    = times[1]?.value || '';
      const breakMins  = fs2.querySelector('input[placeholder="如：10分钟（可选）"]')?.value.trim() || '';

      // —— 上课形式与地点 —— //
      const selects3   = fs3?.querySelectorAll('select') || []; // 0=上课形式, 1=校区
      const classMode  = selects3[0]?.value || '';
      const campus     = selects3[1]?.value || '';
      const classroom  = fs3?.querySelector('input[placeholder="如：A-301"]')?.value.trim() || '';
      const onlineLink = fs3?.querySelector('input[placeholder="https://..."]')?.value.trim() || '';

      // —— 讲义/备注 —— //
      const handoutUrl = fs4?.querySelector('input[placeholder="可填链接或简单备注"]')?.value.trim() || '';

      // —— 最小校验（与你当前业务一致）—— //
      const err = (m)=>alert(m);
      const hasRange  = !!(rangeStart && rangeEnd);
      const hasSingle = !!singleDate;
      if (!courseAttr)             return err('请选择课程属性');
      if (!courseName)             return err('请填写课程名');
      if (!teacher)                return err('请填写任课老师');
      if (!(hasSingle || hasRange))return err('请选择单回日期或填写复数区间');
      if (!startTime || !endTime)  return err('请填写开始/结束时间');
      if (!scheduleStatus)         return err('请选择课程状态');
      // majorsOut 恒不为空（至少会有 ['全部'] 或 [dep]），无需再校验

      // —— 构造 payload（小写 key；后端映射表会处理）—— //
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
        majors:     majorsOut,          // M 列
        visiblestudentids: visibleIds,  // N 列（默认 = M）
        campus,
        classmode:  classMode,
        classroom,
        onlinelink: onlineLink,
        handouturl: handoutUrl,
        schedulestatus: scheduleStatus
      };

      // —— 调用后端 —— //
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = '发布中…';
      const res = await callAPI('publishSlots', payload);
      btn.disabled = false;
      btn.textContent = oldText;

      if (res && res.success) {
        alert('发布成功');
        try { window.calendar && window.calendar.refetchEvents && window.calendar.refetchEvents(); } catch {}
      } else {
        alert('发布失败：' + (res && res.message ? res.message : '未知错误'));
      }
    } catch (e) {
      alert('脚本异常：' + (e && e.message ? e.message : e));
    }
  });
});