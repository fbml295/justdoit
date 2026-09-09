// =============================================================
// KẾ HOẠCH NĂM — MOBILE VIEW
// Cấu trúc thẻ dọc 3 cấp:
//   Cấp 1: Danh sách thẻ Mục tiêu năm
//   Cấp 2: Bấm vào mục tiêu → danh sách 12 thẻ tháng
//   Cấp 3: Bấm vào tháng → 4 thẻ tuần (cùng lúc, cuộn dọc)
// Dùng chung state.roadmap với desktop — không tách dữ liệu.
// =============================================================

// Trạng thái điều hướng mobile (độc lập với desktop)
let _mbGoalId = null;   // goalId đang mở (cấp 2)
let _mbMonth  = null;   // tháng đang mở (cấp 3), null = đang ở cấp 2

// Kiểm tra xem có đang ở mobile không (< 768px)
function isMobileView() {
    return window.innerWidth < 768;
}

// Entry point — gọi thay cho renderRoadmapAll() khi ở mobile
function renderRoadmapMobile() {
    // Cấp 3: đang xem tuần của 1 tháng
    if (_mbGoalId && _mbMonth !== null) {
        _renderMobileWeeks();
        return;
    }
    // Cấp 2: đang xem các tháng của 1 mục tiêu
    if (_mbGoalId) {
        _renderMobileMonths();
        return;
    }
    // Cấp 1: danh sách mục tiêu năm
    _renderMobileGoals();
}

// =============================================================
// CẤP 1 — Danh sách Mục tiêu năm
// =============================================================
function _renderMobileGoals() {
    const container = document.getElementById('roadmap-mobile-container');
    if (!container) return;

    const year = state.roadmap.activeYear;
    const goals = state.roadmap.goals[year] || [];

    let html = `
        <!-- Header năm -->
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="font-bold text-base text-[#F4F5F6]">🗺️ Kế Hoạch Năm</h3>
                <div class="flex items-center gap-2 mt-1">
                    <button onclick="shiftRoadmapYears(-1)" class="text-[#777E90] px-2 py-1 rounded-lg bg-[#23262F] border border-[#353945] text-xs">◀</button>
                    <span class="text-sm font-bold text-[#B6FF2E]">${year}</span>
                    <button onclick="shiftRoadmapYears(1)" class="text-[#777E90] px-2 py-1 rounded-lg bg-[#23262F] border border-[#353945] text-xs">▶</button>
                    <button onclick="addRoadmapYear()" class="text-[10px] px-2 py-1 rounded-lg border border-dashed border-[#B6FF2E]/40 text-[#B6FF2E]">+ Năm</button>
                </div>
            </div>
            <button onclick="addRoadmapAnnualGoal()" class="bg-[#B6FF2E] text-[#14161C] font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1">
                <span>+</span><span>Thêm Mục Tiêu</span>
            </button>
        </div>`;

    // Slogan
    const slogan = state.roadmap.slogans[year] || '';
    html += `
        <div onclick="openSloganDialog()" class="mb-4 bg-gradient-to-r from-[#23262F] to-[#0D0E12] border border-[#353945] border-t-2 border-t-[#B6FF2E] rounded-xl px-4 py-2.5 text-center cursor-pointer">
            <p class="text-sm font-bold italic text-[#F4F5F6]">${slogan || '✍️ Bấm để nhập slogan năm...'}</p>
            <span class="text-[10px] text-[#777E90]">✍️ Bấm để sửa</span>
        </div>`;

    if (goals.length === 0) {
        html += `<div class="text-center text-[#777E90] text-xs py-10">Chưa có mục tiêu nào. Bấm "+ Thêm Mục Tiêu" để bắt đầu!</div>`;
    } else {
        html += `<div class="space-y-3">`;
        goals.forEach(goal => {
            const color = goal.color || '#38bdf8';
            const yearProg = calcRoadmapYearProgress(goal);
            const monthsWithData = Object.keys(goal.months || {}).length;
            html += `
                <div onclick="mbOpenGoal('${goal.id}')"
                    class="bg-[#14161C] border border-[#353945] rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition"
                    style="border-left: 4px solid ${color};">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-sm text-[#F4F5F6] leading-snug">${escHtml(goal.title)}</div>
                            <div class="text-amber-400 text-xs mt-1">${renderRoadmapStars(goal.stars || 5)}</div>
                            <div class="text-[11px] text-[#777E90] mt-1">${monthsWithData} tháng đã lên kế hoạch</div>
                        </div>
                        <div class="flex flex-col items-end gap-2 flex-shrink-0">
                            <div class="flex gap-1.5">
                                <button onclick="event.stopPropagation(); editRoadmapAnnualGoal('${goal.id}')"
                                    class="text-[10px] w-7 h-7 rounded-lg bg-[#23262F] border border-[#353945] text-[#777E90] flex items-center justify-center">✏️</button>
                                <button onclick="event.stopPropagation(); deleteRoadmapAnnualGoal('${goal.id}')"
                                    class="text-[10px] w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">🗑️</button>
                            </div>
                            <span class="text-xs font-bold" style="color:${color}">${yearProg}%</span>
                        </div>
                    </div>
                    <div class="mt-3 h-1.5 bg-[#353945] rounded-full overflow-hidden">
                        <div class="h-full rounded-full" style="width:${yearProg}%; background:${color};"></div>
                    </div>
                    <div class="mt-2 text-[11px] text-[#777E90] text-right">Bấm để xem 12 tháng →</div>
                </div>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

// =============================================================
// CẤP 2 — 12 thẻ tháng của 1 mục tiêu
// =============================================================
function _renderMobileMonths() {
    const container = document.getElementById('roadmap-mobile-container');
    if (!container) return;

    const year = state.roadmap.activeYear;
    const goals = state.roadmap.goals[year] || [];
    const goal = goals.find(g => g.id === _mbGoalId);
    if (!goal) { _mbGoalId = null; _renderMobileGoals(); return; }

    const color = goal.color || '#38bdf8';
    const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                        'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

    let html = `
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 mb-4">
            <button onclick="mbBackToGoals()" class="flex items-center gap-1.5 text-[#777E90] text-sm">
                ← <span class="text-xs">Mục tiêu năm</span>
            </button>
        </div>
        <!-- Tên mục tiêu -->
        <div class="mb-4 p-3 rounded-2xl border" style="border-left: 4px solid ${color}; background: rgba(0,0,0,0.2);">
            <div class="font-bold text-sm text-[#F4F5F6]">${escHtml(goal.title)}</div>
            <div class="text-amber-400 text-xs mt-0.5">${renderRoadmapStars(goal.stars || 5)}</div>
        </div>
        <!-- Nút thêm việc tháng -->
        <div class="mb-3 text-[11px] text-[#777E90]">Bấm vào tháng để lập kế hoạch chi tiết</div>
        <div class="space-y-2.5">`;

    for (let m = 1; m <= 12; m++) {
        const monthData = goal.months[m];
        const prog = calcRoadmapMonthProgress(monthData);
        const poolCount = monthData ? (monthData.pool || []).length : 0;
        const hasData = poolCount > 0;

        const previewItems = hasData
            ? (monthData.pool || []).slice(0, 2).map(it =>
                `<div class="text-[11px] text-[#F4F5F6] truncate pl-2 border-l-2" style="border-color:${color}">${escHtml(it.name)}</div>`
              ).join('')
            : `<div class="text-[11px] text-[#777E90] italic">Chưa có kế hoạch</div>`;

        html += `
            <div onclick="mbOpenMonth(${m})"
                class="bg-[#14161C] border rounded-xl p-3 cursor-pointer active:scale-[0.98] transition ${hasData ? '' : 'border-[#353945] opacity-70'}"
                style="${hasData ? `border-color: ${color}40;` : ''}">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-bold text-sm text-[#F4F5F6]">${monthNames[m-1]}</span>
                    <div class="flex items-center gap-2">
                        ${hasData ? `<span class="text-xs font-bold" style="color:${color}">${prog}%</span>` : ''}
                        <span class="text-[#777E90] text-xs">→</span>
                    </div>
                </div>
                ${previewItems}
                ${hasData ? `
                <div class="mt-2 h-1 bg-[#353945] rounded-full overflow-hidden">
                    <div class="h-full rounded-full" style="width:${prog}%; background:${color};"></div>
                </div>` : ''}
            </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

// =============================================================
// CẤP 3 — 4 thẻ tuần của 1 tháng
// =============================================================
function _renderMobileWeeks() {
    const container = document.getElementById('roadmap-mobile-container');
    if (!container) return;

    const year = state.roadmap.activeYear;
    const goals = state.roadmap.goals[year] || [];
    const goal = goals.find(g => g.id === _mbGoalId);
    if (!goal) { _mbGoalId = null; _renderMobileGoals(); return; }

    const color = goal.color || '#38bdf8';
    const monthName = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                       'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'][_mbMonth - 1];

    if (!goal.months[_mbMonth]) goal.months[_mbMonth] = emptyRoadmapMonth();
    const monthData = goal.months[_mbMonth];

    // Kho việc tháng
    const poolHtml = (monthData.pool || []).length > 0
        ? (monthData.pool || []).map(it => `
            <div class="flex items-center justify-between gap-2 bg-[#0D0E12] rounded-lg px-3 py-2">
                <span class="text-sm text-[#F4F5F6] flex-1">${escHtml(it.name)}</span>
                <div class="flex gap-1.5 flex-shrink-0">
                    <button onclick="mbEditPoolItem('${it.id}')" class="text-[10px] w-6 h-6 rounded bg-[#23262F] border border-[#353945] text-[#777E90] flex items-center justify-center">✏️</button>
                    <button onclick="mbDeletePoolItem('${it.id}')" class="text-[10px] w-6 h-6 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">✕</button>
                </div>
            </div>`).join('')
        : `<div class="text-[11px] text-[#777E90] italic text-center py-2">Chưa có việc tháng nào</div>`;

    // 4 tuần
    const weekKeys = ['w1','w2','w3','w4'];
    const weekLabels = ['Tuần 1','Tuần 2','Tuần 3','Tuần 4'];
    const weeksHtml = weekKeys.map((wk, idx) => {
        if (!monthData.weeks[wk]) monthData.weeks[wk] = emptyRoadmapWeek();
        const week = monthData.weeks[wk];
        const prog = calcRoadmapWeekProgress(week);
        const blocks = week.blocks || [];

        const blocksHtml = blocks.length > 0
            ? blocks.map(block => {
                const tasksHtml = (block.tasks || []).map((task, tIdx) => `
                    <div class="flex items-start gap-2 py-1">
                        <input type="checkbox" ${task.done ? 'checked' : ''}
                            onchange="mbToggleTask('${wk}','${block.id}',${tIdx})"
                            class="mt-0.5 w-4 h-4 rounded flex-shrink-0" style="accent-color:${color}">
                        <span class="text-sm flex-1 ${task.done ? 'line-through text-[#777E90]' : 'text-[#F4F5F6]'}">${escHtml(task.text)}</span>
                        <button onclick="mbDeleteTask('${wk}','${block.id}',${tIdx})"
                            class="text-[#777E90] text-xs flex-shrink-0 w-5 h-5 flex items-center justify-center">✕</button>
                    </div>`).join('');

                return `
                    <div class="mb-2">
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-sm font-semibold text-[#F4F5F6] flex-1" style="border-left:3px solid ${color}; padding-left:8px">🚩 ${escHtml(block.goalHeader)}</span>
                            <button onclick="mbDeleteBlock('${wk}','${block.id}')"
                                class="text-[#777E90] hover:text-rose-400 text-xs flex-shrink-0 w-5 h-5 flex items-center justify-center">✕</button>
                        </div>
                        <div class="pl-3 space-y-0.5">
                            ${tasksHtml || '<p class="text-[11px] text-[#777E90] italic">Chưa có việc nhỏ</p>'}
                        </div>
                    </div>`;
            }).join('')
            : `<p class="text-[11px] text-[#777E90] italic text-center py-2">Chưa có việc nào</p>`;

        return `
            <div class="bg-[#14161C] border border-[#353945] rounded-2xl p-3.5 space-y-2">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-sm text-[#F4F5F6]">${weekLabels[idx]}</span>
                    <span class="text-xs font-bold" style="color:${color}">${prog}%</span>
                </div>
                ${prog > 0 ? `<div class="h-1 bg-[#353945] rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${prog}%; background:${color};"></div></div>` : ''}
                <div class="space-y-1">${blocksHtml}</div>
                <div class="flex gap-2 pt-1 border-t border-[#353945]">
                    <button onclick="mbAddTaskToWeek('${wk}')"
                        class="flex-1 py-2 rounded-xl bg-[#23262F] border border-dashed border-[#B6FF2E]/30 text-[#B6FF2E] text-xs font-semibold">
                        + Việc nhỏ
                    </button>
                </div>
            </div>`;
    }).join('');

    let html = `
        <!-- Breadcrumb 2 cấp -->
        <div class="flex items-center gap-2 mb-4 flex-wrap">
            <button onclick="mbBackToGoals()" class="text-[#777E90] text-xs">← Mục tiêu</button>
            <span class="text-[#353945]">/</span>
            <button onclick="mbBackToMonths()" class="text-[#777E90] text-xs">${escHtml(goal.title).slice(0,20)}...</button>
            <span class="text-[#353945]">/</span>
            <span class="text-[#B6FF2E] text-xs font-semibold">${monthName}</span>
        </div>

        <!-- Kho việc tháng -->
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl p-3.5 mb-4 space-y-2">
            <div class="flex items-center justify-between">
                <span class="font-bold text-sm text-[#F4F5F6]">📋 Kho việc tháng</span>
                <button onclick="mbAddPoolItem()" class="text-[10px] px-2.5 py-1.5 rounded-lg border border-dashed border-[#B6FF2E]/40 text-[#B6FF2E] font-semibold">+ Thêm việc</button>
            </div>
            <div class="space-y-1.5">${poolHtml}</div>
            ${(monthData.pool || []).length > 0 ? `<p class="text-[10px] text-[#777E90]">💡 Bấm "Việc nhỏ" trong từng tuần để phân bổ việc vào tuần</p>` : ''}
        </div>

        <!-- 4 tuần -->
        <div class="space-y-3">${weeksHtml}</div>
    `;

    container.innerHTML = html;
}

// =============================================================
// ĐIỀU HƯỚNG
// =============================================================
function mbOpenGoal(goalId) {
    _mbGoalId = goalId;
    _mbMonth = null;
    renderRoadmapMobile();
}
function mbOpenMonth(month) {
    _mbMonth = month;
    renderRoadmapMobile();
}
function mbBackToGoals() {
    _mbGoalId = null;
    _mbMonth = null;
    renderRoadmapMobile();
}
function mbBackToMonths() {
    _mbMonth = null;
    renderRoadmapMobile();
}

// =============================================================
// ACTIONS — Kho việc tháng
// =============================================================
async function mbAddPoolItem() {
    const goal = _getMbGoal();
    if (!goal) return;
    const result = await dlgMonthlyGoal({});
    if (!result) return;
    if (!goal.months[_mbMonth]) goal.months[_mbMonth] = emptyRoadmapMonth();
    goal.months[_mbMonth].pool.push({ id: 'm_' + Date.now(), name: result.name, stars: result.stars || 5 });
    scheduleRoadmapSync();
    _renderMobileWeeks();
}

async function mbEditPoolItem(poolItemId) {
    const goal = _getMbGoal();
    if (!goal || !goal.months[_mbMonth]) return;
    const item = (goal.months[_mbMonth].pool || []).find(p => p.id === poolItemId);
    if (!item) return;
    const result = await dlgMonthlyGoal({ name: item.name, stars: item.stars });
    if (!result) return;
    item.name = result.name;
    item.stars = result.stars || 5;
    scheduleRoadmapSync();
    _renderMobileWeeks();
}

function mbDeletePoolItem(poolItemId) {
    const goal = _getMbGoal();
    if (!goal || !goal.months[_mbMonth]) return;
    confirmAction('Xóa việc tháng này?', () => {
        goal.months[_mbMonth].pool = goal.months[_mbMonth].pool.filter(p => p.id !== poolItemId);
        scheduleRoadmapSync();
        _renderMobileWeeks();
    });
}

// =============================================================
// ACTIONS — Tuần / Task
// =============================================================
async function mbAddTaskToWeek(weekKey) {
    const goal = _getMbGoal();
    if (!goal || !goal.months[_mbMonth]) return;
    const week = goal.months[_mbMonth].weeks[weekKey];
    const blocks = (week && week.blocks) || [];
    const pool = (goal.months[_mbMonth].pool || []);

    if (pool.length === 0) {
        showNotification('Thêm việc vào Kho việc tháng trước!', 'error');
        return;
    }

    // Chọn block (việc tháng) để gắn việc nhỏ vào
    if (blocks.length === 0) {
        // Chưa có block nào trong tuần — hiện picker chọn từ pool
        _mbShowPoolPicker(weekKey);
        return;
    }

    // Nếu có 1 block → thêm thẳng
    if (blocks.length === 1) {
        await _mbAddWeekTaskToBlock(weekKey, blocks[0].id);
        return;
    }

    // Nhiều block → chọn block
    _mbShowBlockPicker(weekKey, blocks);
}

function _mbShowPoolPicker(weekKey) {
    const goal = _getMbGoal();
    if (!goal) return;
    const pool = (goal.months[_mbMonth].pool || []);

    const overlay = document.createElement('div');
    overlay.id = 'mb-picker-overlay';
    overlay.className = 'fixed inset-0 z-[400] bg-black/60 flex items-end justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-sm p-4 space-y-3 mb-4">
            <h4 class="font-bold text-sm text-[#F4F5F6]">Chọn việc tháng để thêm vào tuần</h4>
            <div class="space-y-2">
                ${pool.map(it => `
                    <button onclick="mbPickPoolForWeek('${weekKey}','${it.id}')"
                        class="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[#F4F5F6] bg-[#23262F] border border-[#353945] active:scale-[0.98]">
                        🚩 ${escHtml(it.name)}
                    </button>`).join('')}
            </div>
            <button onclick="document.getElementById('mb-picker-overlay').remove()"
                class="w-full py-2.5 rounded-xl bg-[#23262F] text-[#777E90] text-sm border border-[#353945]">Hủy</button>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function mbPickPoolForWeek(weekKey, poolItemId) {
    document.getElementById('mb-picker-overlay')?.remove();
    const goal = _getMbGoal();
    if (!goal) return;
    const item = (goal.months[_mbMonth].pool || []).find(p => p.id === poolItemId);
    if (!item) return;

    const week = goal.months[_mbMonth].weeks[weekKey];
    const alreadyExists = (week.blocks || []).some(b => b.goalHeader === item.name);
    if (alreadyExists) {
        // Block đã có → thêm task vào block đó
        const block = week.blocks.find(b => b.goalHeader === item.name);
        _mbAddWeekTaskToBlock(weekKey, block.id);
        return;
    }
    // Tạo block mới
    if (!week.blocks) week.blocks = [];
    week.blocks.push({ id: 'blk_' + Date.now(), goalHeader: item.name, tasks: [] });
    // Sau đó thêm task vào block mới
    const newBlock = week.blocks[week.blocks.length - 1];
    _mbAddWeekTaskToBlock(weekKey, newBlock.id);
}

function _mbShowBlockPicker(weekKey, blocks) {
    const overlay = document.createElement('div');
    overlay.id = 'mb-picker-overlay';
    overlay.className = 'fixed inset-0 z-[400] bg-black/60 flex items-end justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-sm p-4 space-y-3 mb-4">
            <h4 class="font-bold text-sm text-[#F4F5F6]">Thêm việc nhỏ vào mục nào?</h4>
            <div class="space-y-2">
                ${blocks.map(b => `
                    <button onclick="mbPickBlock('${weekKey}','${b.id}')"
                        class="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[#F4F5F6] bg-[#23262F] border border-[#353945] active:scale-[0.98]">
                        🚩 ${escHtml(b.goalHeader)}
                    </button>`).join('')}
                <button onclick="mbPickFromPool('${weekKey}')"
                    class="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[#B6FF2E] bg-[#B6FF2E]/10 border border-[#B6FF2E]/30 active:scale-[0.98]">
                    + Thêm từ kho việc tháng
                </button>
            </div>
            <button onclick="document.getElementById('mb-picker-overlay').remove()"
                class="w-full py-2.5 rounded-xl bg-[#23262F] text-[#777E90] text-sm border border-[#353945]">Hủy</button>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function mbPickBlock(weekKey, blockId) {
    document.getElementById('mb-picker-overlay')?.remove();
    _mbAddWeekTaskToBlock(weekKey, blockId);
}

function mbPickFromPool(weekKey) {
    document.getElementById('mb-picker-overlay')?.remove();
    _mbShowPoolPicker(weekKey);
}

async function _mbAddWeekTaskToBlock(weekKey, blockId) {
    const result = await dlgWeekTask({});
    if (!result || !result.text) return;
    const goal = _getMbGoal();
    if (!goal) return;
    const week = goal.months[_mbMonth].weeks[weekKey];
    const block = (week.blocks || []).find(b => b.id === blockId);
    if (!block) return;
    block.tasks.push({ text: result.text, done: false });
    scheduleRoadmapSync();
    _renderMobileWeeks();
    showNotification('Đã thêm việc nhỏ!', 'success');
}

function mbToggleTask(weekKey, blockId, taskIndex) {
    const goal = _getMbGoal();
    if (!goal) return;
    const week = goal.months[_mbMonth].weeks[weekKey];
    const block = (week.blocks || []).find(b => b.id === blockId);
    if (!block) return;
    block.tasks[taskIndex].done = !block.tasks[taskIndex].done;
    scheduleRoadmapSync();
    _renderMobileWeeks();
}

function mbDeleteTask(weekKey, blockId, taskIndex) {
    const goal = _getMbGoal();
    if (!goal) return;
    const week = goal.months[_mbMonth].weeks[weekKey];
    const block = (week.blocks || []).find(b => b.id === blockId);
    if (!block) return;
    block.tasks.splice(taskIndex, 1);
    scheduleRoadmapSync();
    _renderMobileWeeks();
}

function mbDeleteBlock(weekKey, blockId) {
    const goal = _getMbGoal();
    if (!goal) return;
    const week = goal.months[_mbMonth].weeks[weekKey];
    confirmAction('Xóa mục này và toàn bộ việc nhỏ bên trong?', () => {
        week.blocks = (week.blocks || []).filter(b => b.id !== blockId);
        scheduleRoadmapSync();
        _renderMobileWeeks();
    });
}

// =============================================================
// HELPER
// =============================================================
function _getMbGoal() {
    const year = state.roadmap.activeYear;
    return (state.roadmap.goals[year] || []).find(g => g.id === _mbGoalId);
}

function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
