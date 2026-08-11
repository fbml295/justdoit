// =============================================================
// LỊCH THÁNG + CÔNG VIỆC THEO NGÀY (tab Công Việc → Lịch)
//
// KHÁC với "Danh sách công việc" (state.tasks): đây là các công việc CHUNG chỉ để
// nhìn nhanh trên lịch tháng — bấm vào 1 NGÀY bất kỳ để thêm 1 hoặc nhiều công việc
// cho đúng ngày đó (VD: Thứ 2: Làm việc A; Thứ 3: Họp đối tác...), mỗi công việc có
// đủ Nội dung / Địa điểm / Thành phần / Ghi chú. KHÔNG hiện ở tab Danh Sách Công Việc.
//
// In theo tuần: chọn RIÊNG 1 tuần cần in (không liên quan tới việc bấm ngày để thêm
// việc), hệ thống gom công việc theo TỪNG NGÀY trong tuần đó (Thứ 2 -> Chủ Nhật)
// thành 1 bảng: Thứ/Ngày | Nội dung | Địa điểm | Thành phần | Ghi chú.
//
// Lưu trữ: sheet riêng 'lich_tuan_cong_viec' (qua sheetsGet/sheetsPost có sẵn), tải
// LƯỜI (lazy) như Kế Hoạch Năm — chỉ gọi Sheets khi vào tab Công Việc/Lịch lần đầu.
// Lưu tạm localStorage ngay lập tức, đồng bộ lên Sheets qua debounce 1.2s.
// =============================================================

const LS_WEEKLY_CAL_CACHE = 'wms_weekly_cal_cache';
const WEEKLY_CAL_CACHE_VERSION = 2; // v2 = dữ liệu theo NGÀY (khác v1 cũ theo tuần, đã đổi cấu trúc)

let weeklyCalLoaded = false;
let _weeklyCalSyncTimer = null;
let activeWeeklyCalDayKey = null; // ngày đang mở trong modal "Thêm Công Việc Ngày"

// state.weeklyCal.dayItems = { 'YYYY-MM-DD': [{id, content, location, participants, note}, ...] }
if (!state.weeklyCal || !state.weeklyCal.dayItems) state.weeklyCal = { dayItems: {} };
// state.calendarNav = tháng/năm đang xem trên Lịch Tháng + tuần ĐANG ĐƯỢC CHỌN ĐỂ IN (tách biệt với việc thêm công việc theo ngày)
if (!state.calendarNav) {
    const now = new Date();
    state.calendarNav = { year: now.getFullYear(), month: now.getMonth(), printWeekKey: null };
}

function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDateFull(dateStr) {
    const d = new Date(dateStr);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}
function fmtDateForInput(dateObj) {
    const d = new Date(dateObj);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const VN_WEEKDAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']; // index 0 = Thứ 2

// --- Xác định "Thứ 2 đầu tuần" của 1 ngày bất kỳ, dùng làm khoá cho cả tuần ---
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
    return fmtDateFull(mondayKey) + ' — ' + fmtDateFull(getWeekSundayKey(mondayKey));
}

// --- Số tuần chuẩn ISO 8601 (tuần 1 = tuần chứa Thứ 5 đầu tiên của năm) ---
function getISOWeekInfo(mondayKeyOrDate) {
    const base = new Date(mondayKeyOrDate);
    const d = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
    const dayNum = d.getUTCDay() || 7; // Thứ 2 = 1 ... Chủ Nhật = 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // dời về đúng Thứ 5 của tuần ISO
    const isoYearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - isoYearStart) / 86400000) + 1) / 7);
    return { week: weekNo, isoYear: d.getUTCFullYear() };
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
        console.warn('[Lịch Ngày] Không tải được từ Sheets, dùng cache cục bộ:', e);
        _loadWeeklyCalFromLocalCache();
    }
    renderCalendar();
}

function _saveWeeklyCalLocalCache() {
    try { localStorage.setItem(LS_WEEKLY_CAL_CACHE, JSON.stringify({ version: WEEKLY_CAL_CACHE_VERSION, dayItems: state.weeklyCal.dayItems })); } catch (e) { /* bỏ qua nếu đầy quota */ }
}
function _loadWeeklyCalFromLocalCache() {
    try {
        const raw = localStorage.getItem(LS_WEEKLY_CAL_CACHE);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === WEEKLY_CAL_CACHE_VERSION && parsed.dayItems) {
            state.weeklyCal = { dayItems: parsed.dayItems };
        }
        // Cache ở định dạng cũ (theo tuần, trước khi đổi sang theo ngày) sẽ bị bỏ qua —
        // dữ liệu thật (nếu có) vẫn được đọc & tự chuyển đổi từ Google Sheets, xem bên dưới.
    } catch (e) { /* dữ liệu hỏng, giữ nguyên state.weeklyCal mặc định */ }
}

async function loadWeeklyCalFromSheets() {
    const rows = await sheetsGet('lich_tuan_cong_viec');
    const dayItems = {};
    (rows || []).forEach(r => {
        let dateKey, item;
        if (r.dateKey) {
            // Định dạng hiện tại: mỗi dòng là 1 công việc gắn với đúng 1 ngày cụ thể
            dateKey = r.dateKey;
            item = {
                id: r.itemId || ('DI' + Math.random().toString(36).substr(2, 6)),
                content: r.content || '',
                location: r.location || '',
                participants: r.participants || '',
                note: r.note || ''
            };
        } else if (r.weekKey && r.text) {
            // Migrate dữ liệu bản trước (mục chung cho cả tuần, không gắn ngày cụ thể)
            // -> tạm gán vào đúng Thứ 2 đầu tuần đó để không mất dữ liệu đã lưu.
            dateKey = r.weekKey;
            item = { id: r.itemId || ('DI' + Math.random().toString(36).substr(2, 6)), content: r.text, location: '', participants: '', note: '' };
        } else {
            return;
        }
        if (!item.content) return;
        if (!dayItems[dateKey]) dayItems[dateKey] = [];
        dayItems[dateKey].push(item);
    });
    state.weeklyCal = { dayItems };
    _saveWeeklyCalLocalCache();
}

async function syncWeeklyCalToSheets() {
    _saveWeeklyCalLocalCache();
    if (!state.sheetsUrl) return; // chưa kết nối Sheets -> chỉ lưu cục bộ

    const rows = [];
    Object.keys(state.weeklyCal.dayItems).forEach(dateKey => {
        (state.weeklyCal.dayItems[dateKey] || []).forEach(item => {
            if (!item.content) return;
            rows.push([dateKey, item.id, item.content, item.location || '', item.participants || '', item.note || '']);
        });
    });
    await sheetsPost('lich_tuan_cong_viec', ['dateKey', 'itemId', 'content', 'location', 'participants', 'note'], rows);
}

// Gộp nhiều thao tác liên tiếp thành 1 lần ghi Sheets, tránh spam API
function scheduleWeeklyCalSync() {
    _saveWeeklyCalLocalCache();
    clearTimeout(_weeklyCalSyncTimer);
    _weeklyCalSyncTimer = setTimeout(() => {
        syncWeeklyCalToSheets().catch(e => console.warn('[Lịch Ngày] Lỗi đồng bộ lên Sheets:', e));
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
    renderCalendar();
}

function goToCurrentCalendarMonth() {
    const now = new Date();
    state.calendarNav.year = now.getFullYear();
    state.calendarNav.month = now.getMonth();
    renderCalendar();
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
        emptyCell.className = 'p-2 bg-[#14161C]/30 rounded-xl border border-[#353945]/30 min-h-[86px]';
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const dayTasks = state.tasks.filter(t => t.deadline === dateStr);
        const isToday = isViewingCurrentMonth && day === today.getDate();
        const weekKeyOfDay = fmtWeekKey(cellDate);
        const dayItems = (state.weeklyCal.dayItems && state.weeklyCal.dayItems[dateStr]) || [];
        const isInPrintWeek = !!state.calendarNav.printWeekKey && state.calendarNav.printWeekKey === weekKeyOfDay;

        const cell = document.createElement('div');
        cell.className = `p-2 rounded-xl border min-h-[86px] flex flex-col justify-start text-left transition cursor-pointer ${
            isToday ? 'border-[#B6FF2E] bg-[#B6FF2E]/10' : (isInPrintWeek ? 'border-amber-400/70 bg-amber-400/5' : 'border-[#353945] bg-[#23262F] hover:border-[#B6FF2E]/30')
        }`;
        cell.title = 'Bấm để thêm/xem công việc của ngày này';
        cell.onclick = () => openDayItemsModal(dateStr);

        let taskDots = '';
        if (dayTasks.length > 0) {
            taskDots = `<div class="mt-1 space-y-0.5">
                ${dayTasks.slice(0, 2).map(t => `<div class="text-[9px] truncate px-1 py-0.5 rounded bg-[#353945] text-[#B6FF2E]">${escapeHtml(t.title)}</div>`).join('')}
                ${dayTasks.length > 2 ? `<div class="text-[8px] text-[#777E90]">+${dayTasks.length - 2} việc khác</div>` : ''}
            </div>`;
        }

        let dayItemsHtml = '';
        if (dayItems.length > 0) {
            const shown = dayItems.slice(0, 2);
            dayItemsHtml = `<div class="mt-1 space-y-0.5 pt-1 border-t border-dashed border-[#353945]/70">
                ${shown.map(it => `<div class="text-[9px] truncate px-1 py-0.5 rounded bg-amber-500/10 text-amber-300">🗂️ ${escapeHtml(it.content)}${it.location ? ' @ ' + escapeHtml(it.location) : ''}</div>`).join('')}
                ${dayItems.length > shown.length ? `<div class="text-[8px] text-[#777E90]">+${dayItems.length - shown.length} việc khác...</div>` : ''}
            </div>`;
        }

        cell.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-mono text-xs ${isToday ? 'font-bold text-[#B6FF2E]' : 'text-[#F4F5F6]'}">${day}</span>
                <span class="flex items-center gap-1">
                    ${dayTasks.length > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-[#B6FF2E]"></span>` : ''}
                    ${dayItems.length > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>` : ''}
                </span>
            </div>
            ${taskDots}
            ${dayItemsHtml}
        `;
        calendarGrid.appendChild(cell);
    }

    updatePrintWeekLabel();
}

// =============================================================
// MODAL "CÔNG VIỆC NGÀY" — bấm vào 1 ngày trên lịch để thêm/xoá công việc của ĐÚNG ngày đó
// =============================================================
async function openDayItemsModal(dateStr) {
    await ensureWeeklyCalLoaded();
    activeWeeklyCalDayKey = dateStr;
    ['day-item-content-input', 'day-item-location-input', 'day-item-participants-input', 'day-item-note-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderDayItemsModal();
    document.getElementById('day-items-modal-overlay').classList.remove('hidden');
}

function closeDayItemsModal() {
    document.getElementById('day-items-modal-overlay').classList.add('hidden');
    renderCalendar(); // cập nhật lại lịch tháng để hiện thay đổi vừa thêm/xoá
}

function renderDayItemsModal() {
    const d = new Date(activeWeeklyCalDayKey);
    const weekdayLabel = VN_WEEKDAY_LABELS[(d.getDay() + 6) % 7]; // quy đổi CN=0 -> vị trí cuối cùng trong mảng
    const titleEl = document.getElementById('day-items-modal-title');
    if (titleEl) titleEl.textContent = `${weekdayLabel}, ${fmtDateFull(activeWeeklyCalDayKey)}`;

    const items = state.weeklyCal.dayItems[activeWeeklyCalDayKey] || [];
    const list = document.getElementById('day-items-modal-list');
    if (!list) return;
    list.innerHTML = items.length > 0
        ? items.map(it => `
            <div class="bg-[#0D0E12] border border-[#353945] rounded-lg p-3 space-y-1">
                <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-semibold text-[#F4F5F6] break-words">${escapeHtml(it.content)}</span>
                    <button onclick="deleteDayItem('${it.id}')" class="text-[#777E90] hover:text-rose-400 text-xs flex-shrink-0">✕</button>
                </div>
                <div class="text-[10px] text-[#777E90] space-y-0.5">
                    ${it.location ? `<p>📍 ${escapeHtml(it.location)}</p>` : ''}
                    ${it.participants ? `<p>👥 ${escapeHtml(it.participants)}</p>` : ''}
                    ${it.note ? `<p>📝 ${escapeHtml(it.note)}</p>` : ''}
                </div>
            </div>
        `).join('')
        : `<div class="text-xs text-[#777E90] italic text-center py-4">Chưa có công việc nào trong ngày này.</div>`;
}

function addDayItem() {
    const contentInput = document.getElementById('day-item-content-input');
    const locationInput = document.getElementById('day-item-location-input');
    const participantsInput = document.getElementById('day-item-participants-input');
    const noteInput = document.getElementById('day-item-note-input');

    const content = contentInput ? contentInput.value.trim() : '';
    if (!content) return showNotification('Vui lòng nhập Nội dung công việc.', 'error');

    if (!state.weeklyCal.dayItems[activeWeeklyCalDayKey]) state.weeklyCal.dayItems[activeWeeklyCalDayKey] = [];
    state.weeklyCal.dayItems[activeWeeklyCalDayKey].push({
        id: 'DI' + Date.now() + Math.random().toString(36).substr(2, 4),
        content,
        location: locationInput ? locationInput.value.trim() : '',
        participants: participantsInput ? participantsInput.value.trim() : '',
        note: noteInput ? noteInput.value.trim() : ''
    });

    [contentInput, locationInput, participantsInput, noteInput].forEach(el => { if (el) el.value = ''; });
    renderDayItemsModal();
    scheduleWeeklyCalSync();
}

function deleteDayItem(itemId) {
    const arr = state.weeklyCal.dayItems[activeWeeklyCalDayKey];
    if (!arr) return;
    state.weeklyCal.dayItems[activeWeeklyCalDayKey] = arr.filter(i => i.id !== itemId);
    renderDayItemsModal();
    scheduleWeeklyCalSync();
}

// =============================================================
// CHỌN TUẦN ĐỂ IN — tách biệt hoàn toàn với thao tác bấm ngày để thêm công việc
// =============================================================
function openPrintWeekSelectModal() {
    const input = document.getElementById('print-week-select-date-input');
    if (input) input.value = state.calendarNav.printWeekKey || fmtDateForInput(new Date());
    document.getElementById('print-week-select-modal-overlay').classList.remove('hidden');
}
function closePrintWeekSelectModal() {
    document.getElementById('print-week-select-modal-overlay').classList.add('hidden');
}
function confirmPrintWeekSelect() {
    const input = document.getElementById('print-week-select-date-input');
    const val = input ? input.value : '';
    if (!val) return showNotification('Vui lòng chọn 1 ngày bất kỳ trong tuần cần in.', 'error');

    state.calendarNav.printWeekKey = fmtWeekKey(new Date(val + 'T00:00:00'));
    closePrintWeekSelectModal();
    renderCalendar();
    showNotification('Đã chọn tuần để in: ' + fmtWeekRangeLabel(state.calendarNav.printWeekKey), 'success');
}

function updatePrintWeekLabel() {
    const labelEl = document.getElementById('print-week-chosen-label');
    const printBtn = document.getElementById('btn-print-calendar-week');
    const weekKey = state.calendarNav.printWeekKey;

    if (labelEl) {
        if (weekKey) {
            const { week, isoYear } = getISOWeekInfo(weekKey);
            labelEl.textContent = `Tuần ${week}/${isoYear} (${fmtWeekRangeLabel(weekKey)})`;
            labelEl.classList.remove('hidden');
        } else {
            labelEl.classList.add('hidden');
        }
    }
    if (printBtn) {
        printBtn.disabled = !weekKey;
        printBtn.classList.toggle('opacity-40', !weekKey);
        printBtn.classList.toggle('cursor-not-allowed', !weekKey);
    }
}

// =============================================================
// IN — bảng công việc theo từng ngày (Thứ 2 → Chủ Nhật) của tuần đã chọn để in
// =============================================================
function printSelectedCalendarWeek() {
    const weekKey = state.calendarNav.printWeekKey;
    if (!weekKey) {
        showNotification('Vui lòng bấm "Chọn Tuần Để In" trước.', 'error');
        return;
    }
    const { week, isoYear } = getISOWeekInfo(weekKey);
    const monday = new Date(weekKey);
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
    const rangeLabel = `từ ngày ${fmtDateFull(weekKey)} đến ngày ${fmtDateFull(getWeekSundayKey(weekKey))}`;

    // Gom danh sách theo TỪNG NGÀY trong tuần (Thứ 2 -> Chủ Nhật), mỗi công việc là 1 dòng riêng
    let bodyRowsHtml = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(d.getDate() + i);
        const dateKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const dayLabel = VN_WEEKDAY_LABELS[i] + '<br>' + fmtDateFull(dateKey);
        const items = state.weeklyCal.dayItems[dateKey] || [];

        if (items.length === 0) {
            bodyRowsHtml += `<tr>
                <td class="day-cell">${dayLabel}</td>
                <td class="empty-cell" colspan="4">(Chưa có công việc)</td>
            </tr>`;
        } else {
            items.forEach((it, idx) => {
                bodyRowsHtml += `<tr>
                    ${idx === 0 ? `<td class="day-cell" rowspan="${items.length}">${dayLabel}</td>` : ''}
                    <td>${escapeHtml(it.content)}</td>
                    <td>${escapeHtml(it.location)}</td>
                    <td>${escapeHtml(it.participants)}</td>
                    <td>${escapeHtml(it.note)}</td>
                </tr>`;
            });
        }
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showNotification('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup rồi thử lại.', 'error');
        return;
    }
    printWin.document.write(`
        <html>
        <head>
            <title>Lịch Tuần ${week} — ${isoYear}</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; padding: 28px; color: #111; }
                h1 { font-size: 18px; margin: 0 0 6px; }
                p.range { color: #444; margin: 0 0 20px; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
                th, td { border: 1px solid #999; padding: 8px 10px; text-align: left; vertical-align: top; }
                th { background: #eee; font-weight: 700; }
                .day-cell { font-weight: 700; white-space: nowrap; background: #f7f7f7; }
                .empty-cell { color: #888; font-style: italic; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h1>Lịch Tuần ${week}, năm ${isoYear}</h1>
            <p class="range">${rangeLabel}</p>
            <table>
                <thead>
                    <tr>
                        <th style="width:14%">Thứ / Ngày</th>
                        <th style="width:34%">Nội dung</th>
                        <th style="width:16%">Địa điểm</th>
                        <th style="width:18%">Thành phần</th>
                        <th style="width:18%">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>${bodyRowsHtml}</tbody>
            </table>
        </body>
        </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
}
