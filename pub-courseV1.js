// pub-course.js — 课程发布（只依赖 data-module，不改HTML）
// 统一脚本 key：
//   coursename, attr, teacher, singledate, daterange, weekdays, count,
//   starttime, endtime, majors, visiblestudentids, campus, classmode,
//   classroom, onlinelink, handouturl, schedulestatus

(function () {
  // 事件委托：点击当前模块内的“发布”按钮
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('[data-module="publish-course"] .btn.btn-primary');
    if (!btn) return;

    const moduleEl = btn.closest('[data-module="publish-course"]');
    if (!moduleEl) return;

    // fieldset 顺序：0=基本信息，1=时间与重复，2=上课形式与地点，3=讲义/备注
    const sets = moduleEl.querySelectorAll('fieldset');
    if (!sets || sets.length === 0) { alert('未找到发布表单'); return; }
    const fsBase = sets[0] || null;
    const fsTime = sets[1] || null;
    const fsLoc  = sets[2] || null;
    const fsNote = sets[3] || null;

    // 工具：在某个 fieldset 内，按出现顺序取第 n 个控件的值（input/select/textarea）
    const pick = (scope, n, selector = 'input,select,textarea') => {
      if (!scope) return '';
      const all = scope.querySelectorAll(selector);
      const el = all && all[n] ? all[n] : null;
      if (!el) return '';
      if (el.multiple) {
        return Array.from(el.selectedOptions || [])
          .map(o => (o.value || '').trim())
          .filter(Boolean);
      }
      return (el.value || '').trim();
    };

    // —— 基本信息（按你HTML顺序）——
    // 0: 课程名(input)
    // 1: 课程属性(select)
    // 2: 任课老师(input)
    // 3: 发布对象所属(select)    // 你这块有 id="pubDepartment"
    // 4: 发布对象专业(select多选) // 你这块有 id="pubMajor"
    // 5: 学生姓名/ID(input) → 可见白名单
    // 6: 课程状态(select)
    const coursename   = pick(fsBase, 0);
    const attr         = pick(fsBase, 1);
    const teacher      = pick(fsBase, 2);

    const depEl   = moduleEl.querySelector('#pubDepartment');
    const majorEl = moduleEl.querySelector('#pubMajor');

    const department = depEl ? (depEl.value || '').trim() : pick(fsBase, 3);
    const majorsSel  = majorEl
      ? Array.from(majorEl.selectedOptions || []).map(o => (o.value || '').trim()).filter(Boolean)
      : (Array.isArray(pick(fsBase, 4)) ? pick(fsBase, 4) : []);

    const visiblestudentids = pick(fsBase, 5);
    const schedulestatus    = pick(fsBase, 6);

    // —— 时间与重复（按你HTML顺序）——
    // 0: 单回日期, 1: 复数区间（起）, 2: 复数区间（止）, 3: 周几,
    // 4: 回数, 5: 开始时间, 6: 结束时间, 7: 休息时间(可选)
    const singledate  = pick(fsTime, 0);
    const rStart      = pick(fsTime, 1);
    const rEnd        = pick(fsTime, 2);
    const weekdays    = pick(fsTime, 3);
    const count       = pick(fsTime, 4);
    const starttime   = pick(fsTime, 5);
    const endtime     = pick(fsTime, 6);
    // const breakmins = pick(fsTime, 7); // 如你的映射需要，可加进 payload

    const daterange = (!singledate && rStart && rEnd) ? (rStart + '~' + rEnd) : '';

    // —— 上课形式与地点（按你HTML顺序）——
    // 0: 上课形式, 1: 校区, 2: 教室, 3: 线上链接
    const classmode  = pick(fsLoc, 0);
    const campus     = pick(fsLoc, 1);
    const classroom  = pick(fsLoc, 2);
    const onlinelink = pick(fsLoc, 3);

    // —— 讲义/备注 ——（按你HTML顺序）
    // 0: 讲义（URL或文本）
    const handouturl = pick(fsNote, 0);

    // 面向所属/专业（majors）：所属选“全部”则传 '全部'；否则把多选专业拼成逗号串
    let majors = '';
    if (department === '全部' || department === '全选（所有学生）') {
      majors = '全部';
    } else if (Array.isArray(majorsSel) && majorsSel.length) {
      majors = majorsSel.join(',');
    } else {
      majors = ''; // 可为空
    }

    // 统一脚本 key 的 payload（与后端 publishSlots 对齐）
    const payload = {
      coursename,
      attr,
      teacher,
      singledate,
      daterange,
      weekdays,
      count,
      starttime,
      endtime,
      majors,
      visiblestudentids,
      campus,
      classmode,
      classroom,
      onlinelink,
      handouturl,
      schedulestatus
    };

    // 最小必填校验（你要是嫌烦可以删掉）
    if (!payload.coursename) return alert('请填写：课程名');
    if (!payload.teacher)    return alert('请填写：任课老师');
    if (!payload.singledate && !payload.daterange) return alert('请填写：单回日期或复数区间');
    if (!payload.starttime || !payload.endtime)    return alert('请填写：开始/结束时间');

    // 发送（沿用你现有封装）
    Promise.resolve(
      typeof callAPI === 'function'
        ? callAPI('publishSlots', payload)
        : fetch(window.API_BASE || '/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'publishSlots', params: payload })
          }).then(r => r.json())
    ).then(res => {
      if (res && res.success) {
        alert('课程发布成功');
      } else {
        alert('课程发布失败：' + (res && res.message ? res.message : '未知错误'));
      }
    }).catch(err => {
      console.error('publishSlots error:', err);
      alert('课程发布请求出错，请查看控制台日志');
    });
  });
})();