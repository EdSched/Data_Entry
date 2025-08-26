/***********************
 * 修复版本：统一API响应格式，增加调试信息
 * 兼容函数：testConnection / ping / loginByUsername / registerByProfile / getCourseCalendarEvents
 ***********************/

// ========= 配置 =========
const SPREADSHEET_ID = '143a4QkLhuesusFyjiuIx8118A_PyffZBobmnT9NPaRc';

const SHEET_NAMES = {
  USERS: '用户表',
  STUDENTS: '学生信息表',
  COURSES: '课程安排表',
  ATTENDANCE: '课程确认表',
  CONSULTATION: '面谈记录表',
  PROGRESS: '学习进度表',
  FEEDBACK: '反馈提醒表',
  TEACHER_FEEDBACK: '讲师反馈表',
  SCHEDULE: '日程表',
  ATTENDANCERECORD: '出席明细表'
};

// ========= 工具 =========
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('找不到工作表：' + name);
  return sh;
}

function headerIndexMap_(sheet) {
  const header = (sheet.getRange(1,1,1, sheet.getLastColumn()).getValues()[0]||[]).map(s=>String(s).trim());
  const m = {}; header.forEach((h,i)=>{ if(h) m[h]=i; });
  return m;
}

function colMap(row0){ const m={}; row0.forEach((h,i)=>{ m[String(h).trim()]=i; }); return m; }
function safeVal(idx,row,name,def=''){ return (name in idx) ? (row[idx[name]] ?? def) : def; }
function safeSet(sheet,rowNo,idx,name,val){ if(name in idx) sheet.getRange(rowNo, idx[name]+1).setValue(val); }

// ========= 调试日志函数 =========
function debugLog(message, data) {
  console.log(`[DEBUG] ${message}`, data || '');
}

// ========= 用户解析 =========
function getHeaderIdxAndData_(sheet){
  const values = sheet.getDataRange().getValues();
  return { idx: colMap(values[0]||[]), values };
}

function resolveUserId_(idOrUsername){
  if (!idOrUsername) return '';
  const sh = getSheet(SHEET_NAMES.USERS);
  const { idx, values } = getHeaderIdxAndData_(sh);
  const cId = idx['用户ID'];
  const cName = ('用户名' in idx) ? idx['用户名'] : -1;

  for (let i=1;i<values.length;i++){
    if (String(values[i][cId]) === String(idOrUsername)) return String(values[i][cId]||'');
  }
  if (cName >= 0){
    for (let i=1;i<values.length;i++){
      if (String(values[i][cName]) === String(idOrUsername)) return String(values[i][cId]||'');
    }
  }
  return '';
}

// ========= API 外壳 =========
function doPost(e){
  try{
    let action, params={};
    if (e && e.postData){
      const ct=(e.postData.type||'').toLowerCase();
      if (ct.includes('application/json')){
        const body = JSON.parse(e.postData.contents||'{}'); action = body.action; params = body.params||{};
      }else{
        action = e.parameter ? e.parameter.action : undefined;
        if (e.parameter && typeof e.parameter.params==='string'){
          try{ params = JSON.parse(e.parameter.params); }catch(_){ params={}; }
        }
      }
    }else if(e && e.parameter){
      action = e.parameter.action;
      if (e.parameter.params){ try{ params = JSON.parse(e.parameter.params); }catch(_){ params={}; } }
    }else{
      action='testConnection';
    }

    debugLog('API调用', {action, params});

    let result;
    switch(action){
      case 'testConnection': result=testConnection(); break;
      case 'ping': result={success:true,message:'pong',echo: params && params.t, timestamp:new Date().toISOString()}; break;

      case 'registerByProfile': result=registerByProfile(params); break;
      case 'loginByUsername': result=loginByUsername(params.username); break;

      // 课程日历数据获取
      case 'getCourseCalendarEvents': result=getCourseCalendarEvents(params); break;

      default: result={success:false, message:'未知的API调用: '+action};
    }
    
    debugLog('API响应', result);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    debugLog('API错误', err.toString());
    return ContentService.createTextOutput(JSON.stringify({success:false,message:'服务器错误: '+err}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e){
  if (e.parameter && e.parameter.test){
    return ContentService.createTextOutput(JSON.stringify({success:true,message:'API OK', ts:new Date().toISOString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({success:true, methods:['GET','POST']}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========= 健康检查 =========
function testConnection(){
  try{
    const users = getSheet(SHEET_NAMES.USERS);
    const cnt = Math.max(0, users.getLastRow()-1);
    return { success:true, message:'连接成功', userCount:cnt, timestamp:new Date().toISOString() };
  }catch(err){
    return { success:false, message: String(err), timestamp:new Date().toISOString() };
  }
}

// ========= 注册 / 登录 =========
function registerByProfile(p){
  try{
    const { name, email, department, major, role } = p||{};
    if (!name || !email || !department || !major || !role) return {success:false,message:'请填写姓名、邮箱、所属、专业、身份'};
    const sh = getSheet(SHEET_NAMES.USERS);
    const idx = headerIndexMap_(sh);
    const row = Array(sh.getLastColumn()).fill('');

    // 尽量按列名写入（无列名则跳过）
    if ('用户ID' in idx) row[idx['用户ID']] = ''; // 由你线下分配
    if ('姓名'   in idx) row[idx['姓名']] = name;
    if ('所属'   in idx) row[idx['所属']] = department;
    if ('专业'   in idx) row[idx['专业']] = major;
    if ('身份'   in idx) row[idx['身份']] = role;
    if ('邮箱'   in idx) row[idx['邮箱']] = email;

    sh.appendRow(row);
    return { success:true, message:'登记成功！请由老师分配"用户ID"后再登录。' };
  }catch(err){
    return { success:false, message:'登记失败：'+err };
  }
}

function loginByUsername(username){
  try{
    if (!username) return {success:false,message:'请输入用户ID'};
    const sh = getSheet(SHEET_NAMES.USERS);
    const { idx, values } = getHeaderIdxAndData_(sh);
    const cId = idx['用户ID'];
    const cNm = ('用户名' in idx) ? idx['用户名'] : -1;

    let iHit = -1;
    for (let i=1;i<values.length;i++){
      if (String(values[i][cId]) === String(username)) { iHit=i; break; }
      if (cNm>=0 && String(values[i][cNm]) === String(username)) { iHit=i; break; }
    }
    if (iHit===-1) return {success:false,message:'用户ID不存在'};

    const r = values[iHit];
    const u = {
      username,
      userId: String(r[idx['用户ID']]||''),
      name: safeVal(idx,r,'姓名',''),
      department: safeVal(idx,r,'所属',''),
      major: safeVal(idx,r,'专业',''),
      role: safeVal(idx,r,'身份',''),
      vip: ('VIP' in idx) ? (r[idx['VIP']]||'') : '',
      email: ('邮箱' in idx) ? (r[idx['邮箱']]||'') : ''
    };
    return { success:true, user:u };
  }catch(err){
    return { success:false, message:String(err) };
  }
}

// ========= 课程日历功能 =========

// 课程属性颜色配置
const COURSE_ATTR_COLORS = {
  '大课': '#1976d2',    // 蓝色
  'VIP': '#d32f2f',     // 红色  
  '面谈': '#7b1fa2',    // 紫色
  '必修': '#388e3c',    // 绿色
  '共通': '#f57c00'     // 橙色
};

// 批次ID回退颜色（6色哈希）
const BATCH_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#009688'];

// 默认颜色
const DEFAULT_COLOR = '#94A3B8';

// 获取课程日历事件 - 修复：统一返回格式
function getCourseCalendarEvents(params) {
  try {
    debugLog('开始获取课程日历事件', params);
    
    const { userId, startDate, endDate } = params || {};
    
    if (!userId) {
      return { success: false, message: '用户ID为空' };
    }
    
    // 获取课程安排表数据
    const courseSheet = getSheet(SHEET_NAMES.COURSES);
    const courseData = getHeaderIdxAndData_(courseSheet);
    const courseIdx = courseData.idx;
    const courseRows = courseData.values;
    
    debugLog('课程表列名', Object.keys(courseIdx));
    debugLog('课程表行数', courseRows.length);
    
    // 获取用户表数据（用于姓名→用户ID映射）
    const userSheet = getSheet(SHEET_NAMES.USERS);
    const userData = getHeaderIdxAndData_(userSheet);
    
    // 获取当前用户信息
    const currentUser = getCurrentUserInfo(userId, userData);
    debugLog('当前用户信息', currentUser);
    
    if (!currentUser) {
      return { success: false, message: '用户信息不存在' };
    }
    
    const events = [];
    
    // 解析日期范围
    const viewStart = startDate ? new Date(startDate) : new Date();
    const viewEnd = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    debugLog('日期范围', { viewStart: viewStart.toISOString(), viewEnd: viewEnd.toISOString() });
    
    // 遍历课程数据
    let processedCount = 0;
    let validEventCount = 0;
    
    for (let i = 1; i < courseRows.length; i++) {
      const row = courseRows[i];
      processedCount++;
      
      // 提取必要字段
      const slotId = safeVal(courseIdx, row, '槽位ID', '');
      if (!slotId) {
        debugLog(`第${i}行：槽位ID为空，跳过`);
        continue;
      }
      
      const courseName = safeVal(courseIdx, row, '课程名', '');
      if (!courseName) {
        debugLog(`第${i}行：课程名为空，跳过`, { slotId });
        continue;
      }
      
      const startTime = safeVal(courseIdx, row, '开始时间', '');
      const endTime = safeVal(courseIdx, row, '结束时间', '');
      if (!startTime || !endTime) {
        debugLog(`第${i}行：时间信息不完整，跳过`, { slotId, startTime, endTime });
        continue;
      }
      
      // 获取其他字段
      const batchId = safeVal(courseIdx, row, '批次ID', '');
      const courseAttr = safeVal(courseIdx, row, '课程属性', '');
      const teacher = safeVal(courseIdx, row, '任课老师', '');
      const singleDate = safeVal(courseIdx, row, '单回日期', '');
      const dateRange = safeVal(courseIdx, row, '复数区间', '');
      const weekdays = safeVal(courseIdx, row, '周几', '');
      const targetMajors = safeVal(courseIdx, row, '面向专业', '');
      const visibleStudentNames = safeVal(courseIdx, row, '可见学生IDs', '');
      
      debugLog(`第${i}行基本信息`, {
        slotId, courseName, teacher, singleDate, dateRange, weekdays, targetMajors
      });
      
      // 可见性过滤
      if (!isEventVisibleToUser(currentUser, teacher, targetMajors, visibleStudentNames, userData)) {
        debugLog(`第${i}行：权限过滤，对用户不可见`, { slotId, currentUser: currentUser.name });
        continue;
      }
      
      // 生成事件日期
      let eventDates = [];
      
      if (singleDate && !dateRange) {
        // 单次课程
        const formattedDate = formatDateString(singleDate);
        if (formattedDate) {
          eventDates.push(formattedDate);
          debugLog(`第${i}行：单次课程日期`, { slotId, singleDate, formattedDate });
        }
      } else if (dateRange && weekdays) {
        // 重复课程
        eventDates = generateRecurringDates(dateRange, weekdays, viewStart, viewEnd);
        debugLog(`第${i}行：重复课程日期`, { slotId, dateRange, weekdays, eventDates });
      }
      
      if (eventDates.length === 0) {
        debugLog(`第${i}行：无有效日期，跳过`, { slotId });
        continue;
      }
      
      // 获取事件颜色
      const eventColor = getEventColor(courseAttr, batchId);
      
      // 为每个日期创建事件
      eventDates.forEach(date => {
        if (isDateInRange(date, viewStart, viewEnd)) {
          events.push({
            id: `${slotId}_${date}`,
            title: courseName,
            start: `${date}T${formatTime(startTime)}`,
            end: `${date}T${formatTime(endTime)}`,
            backgroundColor: eventColor,
            borderColor: eventColor,
            extendedProps: {
              slotId: slotId,
              courseAttr: courseAttr,
              teacher: teacher
            }
          });
          validEventCount++;
        }
      });
    }
    
    debugLog('处理结果统计', {
      processedRows: processedCount,
      totalEvents: events.length,
      validEventCount: validEventCount
    });
    
    // 修复：返回统一格式
    return {
      success: true,
      data: events,
      message: `成功获取${events.length}个课程事件`,
      debug: {
        processedRows: processedCount,
        totalEvents: events.length,
        dateRange: { startDate, endDate }
      }
    };
    
  } catch (err) {
    debugLog('获取日历数据错误', err.toString());
    return { success: false, message: '获取日历数据失败: ' + err };
  }
}

// 获取当前用户信息
function getCurrentUserInfo(userId, userData) {
  if (!userId) return null;
  
  const { idx, values } = userData;
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx['用户ID']]) === String(userId)) {
      return {
        userId: userId,
        name: safeVal(idx, values[i], '姓名', ''),
        role: safeVal(idx, values[i], '身份', ''),
        major: safeVal(idx, values[i], '专业', ''),
        department: safeVal(idx, values[i], '所属', '')
      };
    }
  }
  return null;
}

// 可见性判断
function isEventVisibleToUser(user, teacher, targetMajors, visibleStudentNames, userData) {
  if (!user) return true; // 未登录默认全部可见
  
  const { role, name, major, department } = user;
  
  // 解析面向专业
  const majorList = parseMajorList(targetMajors);
  const isAllMajors = majorList.includes('全部') || majorList.includes('全专业') || majorList.length === 0;
  
  // 解析可见学生姓名并映射到用户ID
  const visibleUserIds = mapNamesToUserIds(visibleStudentNames, userData);
  
  debugLog('可见性判断', {
    userRole: role,
    userName: name,
    userMajor: major,
    teacher: teacher,
    majorList: majorList,
    isAllMajors: isAllMajors,
    visibleUserIds: visibleUserIds
  });
  
  if (role === '学生') {
    // 学生可见条件：被指名 OR 专业匹配 OR 全专业
    const visible = visibleUserIds.includes(user.userId) || 
                   majorList.includes(major) || 
                   isAllMajors;
    debugLog('学生可见性结果', visible);
    return visible;
  } else if (role === '老师') {
    // 老师可见条件：任课老师匹配 OR 专业匹配 OR 部门匹配 OR 全专业
    const visible = name === teacher || 
                   majorList.includes(major) || 
                   majorList.includes(department) ||
                   isAllMajors;
    debugLog('老师可见性结果', visible);
    return visible;
  }
  
  debugLog('默认可见（管理员等）', true);
  return true; // 其他情况默认可见（如管理员）
}

// 解析专业列表
function parseMajorList(majorsStr) {
  if (!majorsStr) return [];
  return majorsStr.split(/[,，\s、]+/).map(s => s.trim()).filter(Boolean);
}

// 姓名映射到用户ID
function mapNamesToUserIds(namesStr, userData) {
  if (!namesStr) return [];
  
  const names = namesStr.split(/[,，\s、]+/).map(s => s.trim()).filter(Boolean);
  const userIds = [];
  const { idx, values } = userData;
  
  names.forEach(name => {
    for (let i = 1; i < values.length; i++) {
      const userName = safeVal(idx, values[i], '姓名', '');
      const userId = safeVal(idx, values[i], '用户ID', '');
      const userRole = safeVal(idx, values[i], '身份', '');
      
      // 精确匹配姓名，优先学生身份
      if (userName === name && userRole === '学生' && userId) {
        userIds.push(userId);
      }
    }
  });
  
  return [...new Set(userIds)]; // 去重
}

// 生成重复课程日期
function generateRecurringDates(dateRange, weekdays, viewStart, viewEnd) {
  const dates = [];
  
  try {
    // 解析日期范围
    const rangeParts = dateRange.split('~');
    if (rangeParts.length !== 2) {
      debugLog('日期范围格式错误', dateRange);
      return dates;
    }
    
    const rangeStart = new Date(rangeParts[0].trim());
    const rangeEnd = new Date(rangeParts[1].trim());
    
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      debugLog('日期解析失败', { dateRange, rangeStart, rangeEnd });
      return dates;
    }
    
    // 解析周几
    const weekdayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
    const targetWeekdays = weekdays.split(/[,，\s、]+/)
      .map(s => s.trim())
      .map(s => weekdayMap[s])
      .filter(d => d !== undefined);
    
    if (targetWeekdays.length === 0) {
      debugLog('周几解析失败', weekdays);
      return dates;
    }
    
    // 计算实际搜索范围（取交集）
    const searchStart = new Date(Math.max(rangeStart.getTime(), viewStart.getTime()));
    const searchEnd = new Date(Math.min(rangeEnd.getTime(), viewEnd.getTime()));
    
    // 逐日检查
    let current = new Date(searchStart);
    while (current <= searchEnd) {
      if (targetWeekdays.includes(current.getDay())) {
        dates.push(formatDateString(current));
      }
      current.setDate(current.getDate() + 1);
    }
    
    debugLog('重复课程日期生成完成', { dateRange, weekdays, generatedDates: dates });
    
  } catch (err) {
    debugLog('生成重复日期出错', err.toString());
  }
  
  return dates;
}

// 检查日期是否在范围内
function isDateInRange(dateStr, startDate, endDate) {
  const date = new Date(dateStr);
  return date >= startDate && date <= endDate;
}

// 格式化日期字符串
function formatDateString(date) {
  try {
    if (typeof date === 'string') {
      // 如果已经是字符串，尝试标准化格式
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return formatDateString(d);
      }
      return date; // 如果无法解析，返回原字符串
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (err) {
    debugLog('日期格式化出错', { date, error: err.toString() });
    return null;
  }
}

// 格式化时间
function formatTime(timeStr) {
  if (!timeStr) return '00:00:00';
  try {
    const parts = String(timeStr).split(':');
    if (parts.length >= 2) {
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1].padStart(2, '0');
      return `${hours}:${minutes}:00`;
    }
    return '00:00:00';
  } catch (err) {
    debugLog('时间格式化出错', { timeStr, error: err.toString() });
    return '00:00:00';
  }
}

// 获取事件颜色
function getEventColor(courseAttr, batchId) {
  // 优先使用课程属性固定色
  if (courseAttr && COURSE_ATTR_COLORS[courseAttr]) {
    return COURSE_ATTR_COLORS[courseAttr];
  }
  
  // 其次使用批次ID哈希色
  if (batchId) {
    let hash = 0;
    for (let i = 0; i < String(batchId).length; i++) {
      hash = ((hash << 5) - hash + String(batchId).charCodeAt(i)) & 0xffffffff;
    }
    return BATCH_COLORS[Math.abs(hash) % BATCH_COLORS.length];
  }
  
  // 默认颜色
  return DEFAULT_COLOR;
}
