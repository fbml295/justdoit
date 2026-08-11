// =============================================================
// LỊCH TUẦN — "Công việc chính trong tuần" hiển thị trên Lịch Tháng
// (tab Công Việc → Lịch)
//
// KHÁC với "Danh sách công việc" (state.tasks): đây chỉ là danh sách công việc
// CHUNG CHUNG cho cả 1 tuần (không gắn với ngày cụ thể, không có trạng thái
// Xong/Chưa xong, không hiện ở tab Danh Sách Công Việc) — mục đích để nhìn nhanh
// trên lịch tháng "tuần này cần làm những việc lớn gì".
//
// Lưu trữ: tách biệt hoàn toàn với sheet công việc chính, dùng riêng 1 sheet
// 'lich_tuan_cong_viec' (qua sheetsGet/sheetsPost có sẵn), tải LƯỜI (lazy) như
// Kế Hoạch Năm — chỉ gọi Sheets khi người dùng thực sự mở tab Công Việc/Lịch lần
// đầu. Lưu tạm localStorage ngay lập tức, đồng bộ lên Sheets qua debounce 1.2s.
// =============================================================

const LS_WEEKLY_CAL_CACHE = 'wms_weekly_cal_cache';

let weeklyCalLoaded = false;
let _weeklyCalSyncTimer = null;
let activeWeeklyCalWeekKey = null; // tuần đang mở trong modal "Lịch Tuần"

// state.weeklyCal = { weekItems: { 'YYYY-MM-DD (Thứ 2 đầu tuần)': [{id, text}, ...] } }
if (!state.weeklyCal) state.weeklyCal = { weekItems: {} };
// state.calendarNav = tháng/năm đang xem trên Lịch Tháng + tuần đang được chọn
if (!state.calendarNav) {
    const now = new Date();
    state.calendarNav = { year: now.getFullYear(), month: now.getMonth(), selectedWeekKey: null };
}

function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Xác định "Thứ 2 đầu tuần" của 1 ngày bất kỳ, dùng làm khoá (key) cho cả tuần ---
function fmtWeekKey(dateObj) {
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Chủ Nhật ... 6 = Thứ 7
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function getWeekSundayKey(mondayKey) {
    const d = new Date(mondayKey);
    d.setDate(d.getDate() + 6);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtWeekRangeLabel(mondayKey) {
    return fmtDate(mondayKey) + ' — ' + fmtDate(getWeekSundayKey(mondayKey));
}

// --- Tải dữ liệu (lười — chỉ tải 1 lần khi vào tab Công Việc / Lịch lần đầu) ---
async function ensureWeeklyCalLoaded() {
    if (weeklyCalLoaded) { renderCalendar(); return; }
    weeklyCalLoaded = true; // đánh dấu trước để tránh gọi trùng nếu bấm tab nhanh nhiều lần

    if (!state.sheetsUrl) {
        _loadWeeklyCalFromLocalCache();
        renderCalendar();
        return;
    }
    try {
        await loadWeeklyCalFromSheets();
    } catch (e) {
        console.warn('[Lịch Tuần] Không tải được từ Sheets, dùng cache cục bộ:', e);
        _loadWeeklyCalFromLocalCache();
    }
    renderCalendar();
}

function _saveWeeklyCalLocalCache() {
    try { localStorage.setItem(LS_WEEKLY_CAL_CACHE, JSON.stringify(state.weeklyCal)); } catch (e) { /* bỏ qua nếu đầy quota */ }
}
function _loadWeeklyCalFromLocalCache() {
    try {
        const raw = localStorage.getItem(LS_WEEKLY_CAL_CACHE);
        if (raw) state.weeklyCal = JSON.parse(raw);
    } catch (e) { /* dữ liệu hỏng, giữ nguyên state.weeklyCal mặc định */ }
}

async function loadWeeklyCalFromSheets() {
    const rows = await sheetsGet('lich_tuan_cong_viec');
    const weekItems = {};
    (rows || []).forEach(r => {
        if (!r.weekKey || !r.text) return;
        if (!weekItems[r.weekKey]) weekItems[r.weekKey] = [];
        weekItems[r.weekKey].push({ id: r.itemId || ('WI' + Math.random().toString(36).substr(2, 6)), text: r.text });
    });
    state.weeklyCal = { weekItems };
    _saveWeeklyCalLocalCache();
}

async function syncWeeklyCalToSheets() {
    _saveWeeklyCalLocalCache();
    if (!state.sheetsUrl) return; // chưa kết nối Sheets -> chỉ lưu cục bộ

    const rows = [];
    Object.keys(state.weeklyCal.weekItems).forEach(weekKey => {
        (state.weeklyCal.weekItems[weekKey] || []).forEach(item => {
            if (!item.text) return;
            rows.push([weekKey, item.id, item.text]);
        });
    });
    await sheetsPost('lich_tuan_cong_viec', ['weekKey', 'itemId', 'text'], rows);
}

// Gộp nhiều thao tác liên tiếp thành 1 lần ghi Sheets, tránh spam API
function scheduleWeeklyCalSync() {
    _saveWeeklyCalLocalCache();
    clearTimeout(_weeklyCalSyncTimer);
    _weeklyCalSyncTimer = setTimeout(() => {
        syncWeeklyCalToSheets().catch(e => console.warn('[Lịch Tuần] Lỗi đồng bộ lên Sheets:', e));
    }, 1200);
}

// =============================================================
// LỊCH THÁNG — hiển thị đúng tháng/năm theo ngày giờ hệ thống, có chuyển tháng
// =============================================================
function shiftCalendarMonth(direction) {
    let { year, month } = state.calendarNav;
    month += direction;
    if (month < 0) { month = 11; year--; }
    else if (month > 11) { month = 0; year++; }
    state.calendarNav.year = year;
    state.calendarNav.month = month;
    state.calendarNav.selectedWeekKey = null; // đổi tháng -> bỏ chọn tuần cũ cho khỏi nhầm khi in
    renderCalendar();
}

function goToCurrentCalendarMonth() {
    const now = new Date();
    state.calendarNav.year = now.getFullYear();
    state.calendarNav.month = now.getMonth();
    renderCalendar();
}

function selectCalendarWeek(weekKey) {
    state.calendarNav.selectedWeekKey = (state.calendarNav.selectedWeekKey === weekKey) ? null : weekKey; // bấm lại để bỏ chọn
    renderCalendar();
}

function updateCalendarPrintButtonState() {
    const btn = document.getElementById('btn-print-calendar-week');
    if (!btn) return;
    const has = !!state.calendarNav.selectedWeekKey;
    btn.disabled = !has;
    btn.classList.toggle('opacity-40', !has);
    btn.classList.toggle('cursor-not-allowed', !has);
    btn.title = has ? 'In công việc chính tuần: ' + fmtWeekRangeLabel(state.calendarNav.selectedWeekKey) : 'Bấm chọn 1 tuần trên lịch trước';
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';

    const { year, month } = state.calendarNav;
    const labelEl = document.getElementById('calendar-month-label');
    if (labelEl) labelEl.textContent = `Tháng ${month + 1} / ${year}`;

    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Thứ của ngày 1 trong tháng (0=CN..6=T7) -> quy đổi sang lịch bắt đầu từ Thứ 2 (0=T2..6=CN)
    const jsDay = firstOfMonth.getDay();
    const firstDayOffset = jsDay === 0 ? 6 : jsDay - 1;

    const today = new Date();
    const isViewingCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let i = 0; i < firstDayOffset; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'p-2 bg-[#14161C]/30 rounded-xl border border-[#353945]/30 min-h-[76px]';
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const dayTasks = state.tasks.filter(t => t.deadline === dateStr);
        const isToday = isViewingCurrentMonth && day === today.getDate();
        const weekKey = fmtWeekKey(cellDate);
        const weekItems = (state.weeklyCal.weekItems && state.weeklyCal.weekItems[weekKey]) || [];
        const isSelectedWeek = state.calendarNav.selectedWeekKey === weekKey;

        const cell = document.createElement('div');
        cell.className = `p-2 rounded-xl border min-h-[76px] flex flex-col justify-start text-left transition cursor-pointer ${
            isToday ? 'border-[#B6FF2E] bg-[#B6FF2E]/10' : (isSelectedWeek ? 'border-amber-400 bg-amber-400/10' : 'border-[#353945] bg-[#23262F] hover:border-[#B6FF2E]/30')
        }`;
        cell.title = 'Bấm để chọn cả tuần này (dùng cho nút In)';
        cell.onclick = () => selectCalendarWeek(weekKey);

        let taskDots = '';
        if (dayTasks.length > 0) {
            taskDots = `<div class="mt-1 space-y-0.5">
                ${dayTasks.slice(0, 2).map(t => `<div class="text-[9px] truncate px-1 py-0.5 rounded bg-[#353945] text-[#B6FF2E]">${escapeHtml(t.title)}</div>`).join('')}
                ${dayTasks.length > 2 ? `<div class="text-[8px] text-[#777E90]">+${dayTasks.length - 2} việc khác</div>` : ''}
            </div>`;
        }

        let weekItemsHtml = '';
        if (weekItems.length > 0) {
            const shown = weekItems.slice(0, 3);
            weekItemsHtml = `<div class="mt-1 space-y-0.5 pt-1 border-t border-dashed border-[#353945]/70">
                ${shown.map(it => `<div class="text-[9px] truncate px-1 py-0.5 rounded bg-amber-500/10 text-amber-300">🗂️ ${escapeHtml(it.text)}</div>`).join('')}
                ${weekItems.length > shown.length ? `<div class="text-[8px] text-[#777E90]">+${weekItems.length - shown.length} việc khác...</div>` : ''}
            </div>`;
        }

        cell.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-mono text-xs ${isToday ? 'font-bold text-[#B6FF2E]' : 'text-[#F4F5F6]'}">${day}</span>
                ${dayTasks.length > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-[#B6FF2E]"></span>` : ''}
            </div>
            ${taskDots}
            ${weekItemsHtml}
        `;
        calendarGrid.appendChild(cell);
    }

    updateCalendarPrintButtonState();
}

// =============================================================
// MODAL "LỊCH TUẦN" — thêm/xoá công việc chính của 1 tuần
// =============================================================
async function openWeeklyCalModal(weekKey) {
    await ensureWeeklyCalLoaded();
    activeWeeklyCalWeekKey = weekKey || state.calendarNav.selectedWeekKey || fmtWeekKey(new Date());
    state.calendarNav.selectedWeekKey = activeWeeklyCalWeekKey; // mở modal cho tuần nào thì tự chọn luôn tuần đó trên lịch
    renderWeeklyCalModal();
    document.getElementById('weekly-cal-modal-overlay').classList.remove('hidden');
}

function closeWeeklyCalModal() {
    document.getElementById('weekly-cal-modal-overlay').classList.add('hidden');
    renderCalendar(); // cập nhật lại lịch tháng để hiện thay đổi mới + trạng thái nút In
}

function shiftWeeklyCalWeek(direction) {
    const d = new Date(activeWeeklyCalWeekKey);
    d.setDate(d.getDate() + direction * 7);
    activeWeeklyCalWeekKey = fmtWeekKey(d);
    state.calendarNav.selectedWeekKey = activeWeeklyCalWeekKey;
    renderWeeklyCalModal();
}

function renderWeeklyCalModal() {
    const items = state.weeklyCal.weekItems[activeWeeklyCalWeekKey] || [];

    const rangeEl = document.getElementById('weekly-cal-modal-range');
    if (rangeEl) rangeEl.textContent = fmtWeekRangeLabel(activeWeeklyCalWeekKey);

    const list = document.getElementById('weekly-cal-modal-list');
    if (!list) return;
    list.innerHTML = items.length > 0
        ? items.map(it => `
            <div class="flex items-center gap-2 bg-[#0D0E12] border border-[#353945] rounded-lg px-3 py-2">
                <span class="flex-1 text-xs text-[#F4F5F6] break-words">${escapeHtml(it.text)}</span>
                <button onclick="deleteWeeklyCalItem('${it.id}')" class="text-[#777E90] hover:text-rose-400 text-xs flex-shrink-0">✕</button>
            </div>
        `).join('')
        : `<div class="text-xs text-[#777E90] italic text-center py-4">Chưa có công việc chính nào cho tuần này.</div>`;
}

function addWeeklyCalItem() {
    const input = document.getElementById('weekly-cal-modal-input');
    const text = input ? input.value.trim() : '';
    if (!text) return showNotification('Vui lòng nhập nội dung công việc.', 'error');

    if (!state.weeklyCal.weekItems[activeWeeklyCalWeekKey]) state.weeklyCal.weekItems[activeWeeklyCalWeekKey] = [];
    state.weeklyCal.weekItems[activeWeeklyCalWeekKey].push({ id: 'WI' + Date.now() + Math.random().toString(36).substr(2, 4), text });

    input.value = '';
    renderWeeklyCalModal();
    scheduleWeeklyCalSync();
}

function deleteWeeklyCalItem(itemId) {
    const arr = state.weeklyCal.weekItems[activeWeeklyCalWeekKey];
    if (!arr) return;
    state.weeklyCal.weekItems[activeWeeklyCalWeekKey] = arr.filter(i => i.id !== itemId);
    renderWeeklyCalModal();
    scheduleWeeklyCalSync();
}

// =============================================================
// IN — chỉ in đúng nội dung của tuần đang được CHỌN trên lịch tháng
// =============================================================
function printSelectedCalendarWeek() {
    const weekKey = state.calendarNav.selectedWeekKey;
    if (!weekKey) {
        showNotification('Vui lòng bấm chọn 1 tuần trên lịch trước khi in.', 'error');
        return;
    }
    const items = state.weeklyCal.weekItems[weekKey] || [];
    const rangeLabel = fmtWeekRangeLabel(weekKey);

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showNotification('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup rồi thử lại.', 'error');
        return;
    }
    printWin.document.write(`
        <html>
        <head>
            <title>In Lịch Tuần — ${escapeHtml(rangeLabel)}</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #111; }
                h1 { font-size: 18px; margin: 0 0 4px; }
                p.range { color: #555; margin: 0 0 24px; font-size: 13px; }
                ol { padding-left: 22px; margin: 0; }
                li { margin-bottom: 10px; font-size: 14px; line-height: 1.4; }
                .empty { color: #888; font-style: italic; font-size: 13px; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h1>📅 Công Việc Chính Trong Tuần</h1>
            <p class="range">${escapeHtml(rangeLabel)}</p>
            ${items.length > 0
                ? '<ol>' + items.map(it => `<li>${escapeHtml(it.text)}</li>`).join('') + '</ol>'
                : '<p class="empty">Chưa có công việc chính nào được ghi cho tuần này.</p>'}
        </body>
        </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
}
