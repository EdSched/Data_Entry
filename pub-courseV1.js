// pub-course.js
// 课程发布脚本（前端）

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('publish-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // 从表单取值
    const coursename   = document.getElementById('coursename')?.value.trim() || '';
    const attr         = document.getElementById('course-attr')?.value.trim() || '';
    const teacher      = document.getElementById('teacher')?.value.trim() || '';
    const singledate   = document.getElementById('single-date')?.value.trim() || '';
    const daterange    = (document.getElementById('range-start')?.value.trim() || '') +
                         (document.getElementById('range-end')?.value.trim() ? 
                           '~' + document.getElementById('range-end').value.trim() : '');
    const weekdays     = document.getElementById('weekdays')?.value.trim() || '';
    const count        = document.getElementById('count')?.value.trim() || '';
    const starttime    = document.getElementById('start-time')?.value.trim() || '';
    const endtime      = document.getElementById('end-time')?.value.trim() || '';
    const majors       = document.getElementById('majors')?.value.trim() || '';
    const visiblestudentids = document.getElementById('visiblestudentids')?.value.trim() || '';
    const campus       = document.getElementById('campus')?.value.trim() || '';
    const classmode    = document.getElementById('classmode')?.value.trim() || '';
    const classroom    = document.getElementById('classroom')?.value.trim() || '';
    const onlinelink   = document.getElementById('onlinelink')?.value.trim() || '';
    const handouturl   = document.getElementById('handouturl')?.value.trim() || '';
    const schedulestatus = document.getElementById('schedulestatus')?.value.trim() || '';

    // 组装 payload（字段名与后端统一）
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

    console.log('PUBLISH payload ->', payload);

    // 调用后端 API
    callAPI('publishSlots', payload)
      .then(res => {
        console.log('publishSlots response:', res);
        if (res && res.success) {
          alert('课程发布成功！');
        } else {
          alert('课程发布失败：' + (res && res.message ? res.message : '未知错误'));
        }
      })
      .catch(err => {
        console.error('publishSlots error:', err);
        alert('课程发布请求出错，请检查控制台日志。');
      });
  });
});
