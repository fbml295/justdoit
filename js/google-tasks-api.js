// =============================================================
// GOOGLE TASKS API — đồng bộ 1 chiều app -> Google Tasks:
// - Tick "G-Task" trên 1 công việc -> tạo 1 việc tương ứng bên Google Tasks.
// - Bỏ tick -> xóa việc đó khỏi Google Tasks.
// - Tick "Xong việc" trong app -> tự đánh dấu hoàn thành bên Google Tasks.
// Mọi việc đều nằm trong 1 danh sách riêng "CMMS - Công Việc" (tự tạo nếu chưa có).
// =============================================================

const CMMS_TASKLIST_TITLE = 'CMMS - Công Việc';
let _cmmsTaskListId = null;

async function tasksApiFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers);
    return driveApiFetch(url, options); // dùng chung wrapper xử lý lỗi 401 (hết hạn token) với Sheets/Drive API
}

// Tìm (hoặc tạo mới nếu chưa có) danh sách "CMMS - Công Việc" trong Google Tasks của người dùng
async function ensureCmmsTaskList() {
    if (_cmmsTaskListId) return _cmmsTaskListId;

    const listRes = await tasksApiFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists');
    if (!listRes.ok) throw new Error(await readGoogleErrorDetail(listRes));
    const listJson = await listRes.json();
    const found = (listJson.items || []).find(l => l.title === CMMS_TASKLIST_TITLE);
    if (found) { _cmmsTaskListId = found.id; return _cmmsTaskListId; }

    const createRes = await tasksApiFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        method: 'POST',
        body: JSON.stringify({ title: CMMS_TASKLIST_TITLE })
    });
    if (!createRes.ok) throw new Error(await readGoogleErrorDetail(createRes));
    const created = await createRes.json();
    _cmmsTaskListId = created.id;
    return _cmmsTaskListId;
}

// Google Tasks API chỉ nhận "due" dạng RFC3339 (ngày), bỏ qua phần giờ
function _toGoogleTaskDue(dateStr) {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

// Tạo 1 việc mới bên Google Tasks tương ứng với 1 công việc trong app, trả về ID Google Task
async function pushTaskToGoogleTasks(task) {
    const listId = await ensureCmmsTaskList();
    const notesParts = [];
    if (task.category) notesParts.push('Danh mục: ' + task.category);
    if (task.tags && task.tags.length) notesParts.push('Thẻ: ' + task.tags.join(', '));

    const body = {
        title: task.title,
        notes: notesParts.join('\n'),
        status: task.status === 'Done' ? 'completed' : 'needsAction'
    };
    const due = _toGoogleTaskDue(task.deadline);
    if (due) body.due = due;

    const res = await tasksApiFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await readGoogleErrorDetail(res));
    const created = await res.json();
    return created.id;
}

// Xóa việc khỏi Google Tasks (khi bỏ tick G-Task)
async function deleteTaskFromGoogleTasks(task) {
    if (!task.googleTaskId) return;
    const listId = await ensureCmmsTaskList();
    const res = await tasksApiFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${task.googleTaskId}`, {
        method: 'DELETE'
    });
    if (!res.ok && res.status !== 404) throw new Error(await readGoogleErrorDetail(res));
}

// Đồng bộ trạng thái Xong/Chưa xong sang Google Tasks (chỉ 1 chiều: app -> Google)
async function updateGoogleTaskStatus(task) {
    if (!task.googleTaskId) return;
    const listId = await ensureCmmsTaskList();
    const res = await tasksApiFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${task.googleTaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: task.status === 'Done' ? 'completed' : 'needsAction' })
    });
    if (!res.ok) throw new Error(await readGoogleErrorDetail(res));
}

// Cập nhật lại tên/ghi chú/hạn của 1 việc ĐÃ CÓ trên Google Tasks (dùng khi sửa công việc trong app)
async function updateGoogleTaskDetails(task) {
    if (!task.googleTaskId) return;
    const listId = await ensureCmmsTaskList();
    const notesParts = [];
    if (task.category) notesParts.push('Danh mục: ' + task.category);
    if (task.tags && task.tags.length) notesParts.push('Thẻ: ' + task.tags.join(', '));

    const body = { title: task.title, notes: notesParts.join('\n') };
    const due = _toGoogleTaskDue(task.deadline);
    if (due) body.due = due;

    const res = await tasksApiFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${task.googleTaskId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await readGoogleErrorDetail(res));
}
