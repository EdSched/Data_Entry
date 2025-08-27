// pub-course.js —— 课程安排发布（事件委托 + 强健容错）
document.addEventListener('DOMContentLoaded', () => {
  const rootSel = '#pub-course [data-module="publish-course"]';

  // 用事件委托，避免按钮未找到时无法绑定
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest(`${rootSel} .btn.btn-primary`);
    if (!btn) return; // 不是发布按钮，忽略

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
      const selects1   = fs1.querySelectorAll('select'); // 0=课程属性,1=所属,2=专业,3=课程状态
      const courseAttr = selects1[0]?.value || '';
      const dep        = document.getElementById('pubDepartment')?.value || (selects1[1]?.value || '');
      const majorSel   = document.getElementById('pubMajor');
      const scheduleStatus = selects1[3]?.value || '';

      // —— 专业（多选） —— //
      // 所属=全部/未选 → 视为全体；所属=文/理 → 多选；若未选任何专业 → 视为该院全部（用所属代表）
      let selectedMajors = [];
      if (majorSel && !majorSel.disabled) {
        selectedMajors = Array.from(majorSel.selectedOptions).map(o => o.value).filter(Boolean);
      }
      let majorsOut;
      if (!dep || dep === '全部') majorsOut = ['全部'];
      else if (selectedMajors.length) majorsOut = selectedMajors;
      else majorsOut = [dep];

      // —— 可见学生IDs：若未填名单，默认 = majorsOut —— //
      const studentRaw = fs1.querySelector('input[placeholder="学生姓名或ID"]')?.value.trim() || '';
      let visibleIds = studentRaw ? studentRaw.split(/[,\s，、]+/).filter(Boolean) : [];
      if (visibleIds.length === 0) visibleIds = majorsOut;

      // —— 时间与重复 —— //
      const dates      = fs2.querySelectorAll('input[type="date"]');   // [单回, 起, 止]
      const singleDate = dates[0]?.value || '';
      const rangeStart = dates[1]?.value || '';
      const rangeEnd   = dates[2]?.value || '';
      const dateRange  = (rangeStart && rangeEnd) ? `${rangeStart}~${rangeEnd}` : '';

      const weekdays   = fs2.querySelector('input[placeholder="如：一,三,五"]')?.value.trim() || '';
      const countStr   = fs2.querySelector('input[type="number"]')?.value || '';
      const count      = countStr ? Number(countStr) : '';

      const times      = fs2.querySelectorAll('input[type="time"]');   // [开始, 结束]
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

      // —— 最小校验 —— //
      const err = (m)=>alert(m);
      const hasRange  = !!(rangeStart && rangeEnd);
      const hasSingle = !!singleDate;
      if (!courseAttr)            return err('请选择课程属性');
      if (!courseName)            return err('请填写课程名');
      if (!teacher)               return err('请填写任课老师');
      if (!(hasSingle||hasRange)) return err('请选择单回日期或填写复数区间');
      if (!startTime || !endTime) return err('请填写开始/结束时间');
      if (!scheduleStatus)        return err('请选择课程状态');

      // —— 构造 payload（小写 key，映射表会处理） —— //
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
      btn.disabled = true; btn.textContent = '发布中…';
      const res = await callAPI('publishSlots', payload);
      btn.disabled = false; btn.textContent = '发布';

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