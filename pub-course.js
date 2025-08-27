document.addEventListener('DOMContentLoaded', () => {
  const pubBtn = document.querySelector('#pub-course [data-module="publish-course"] .btn.btn-primary');
  if (!pubBtn) return;

  pubBtn.addEventListener('click', () => {
    const dep   = document.getElementById('pubDepartment')?.value || '';
    let major   = document.getElementById('pubMajor')?.value || '';
    if (dep && !major) major = dep;

    let visibleIds = [];
    const raw = document.querySelector('#pub-course input[placeholder="学生姓名或ID"]')?.value.trim() || '';
    if (raw) {
      visibleIds = raw.split(/[,\s，、]+/).filter(Boolean);
    }
    if (visibleIds.length === 0 && major) {
      visibleIds = [major];
    }

    const payload = {
      coursename: document.querySelector('#pub-course input[placeholder="例如：社会学专业课"]')?.value || '',
      attr: document.querySelector('#pub-course select')?.value || '',
      teacher: document.querySelector('#pub-course input[placeholder="老师姓名或ID"]')?.value || '',
      singledate: document.querySelector('#pub-course input[type="date"]')?.value || '',
      starttime: document.querySelector('#pub-course input[type="time"]')?.value || '',
      endtime: document.querySelectorAll('#pub-course input[type="time"]')[1]?.value || '',
      majors: [major],
      visiblestudentids: visibleIds,
      schedulestatus: document.querySelectorAll('#pub-course select')[3]?.value || ''
      // 其他字段同理补上即可
    };

    callAPI('publishSlots', payload).then(res => {
      alert(res.success ? '发布成功' : '发布失败：' + res.message);
    });
  });
});
