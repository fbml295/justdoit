// =============================================================
// KẾ HOẠCH NĂM (ANNUAL ROADMAP MATRIX)
// Cấu trúc 4 cấp: Năm -> Mục Tiêu Năm (goal) -> 12 Tháng -> 4 Tuần -> Checklist
// =============================================================

const ROADMAP_PALETTE = ['#38bdf8', '#c084fc', '#fb923c', '#10b981', '#f43f5e', '#facc15'];
const LS_ROADMAP_CACHE = 'wms_roadmap_cache';

let roadmapLoaded = false;
let roadmapIsDragging = false;
let activeRoadmapGoalId = null;
let activeRoadmapMonth = null;
let _roadmapSyncTimer = null;

function emptyRoadmapState() {
    const thisYear = new Date().getFullYear();
    return {
        years: [thisYear],
        activeYear: thisYear,
        yearWindowStart: 0,
        slogans: {},
        goals: { [thisYear]: [] }
    };
}

if (!state.roadmap) state.roadmap = emptyRoadmapState();

function renderRoadmapStars(count) { return '★'.repeat(count) + '☆'.repeat(5 - count); }

function emptyRoadmapWeek() {
    return { blocks: [] };
}
function emptyRoadmapMonth() {
    return { pool: [], weeks: { w1: emptyRoadmapWeek(), w2: emptyRoadmapWeek(), w3: emptyRoadmapWeek(), w4: emptyRoadmapWeek() } };
}

// --- Tải dữ liệu ---
async function ensureRoadmapLoaded() {
    if (roadmapLoaded) { renderRoadmapAll(); return; }
    roadmapLoaded = true;

    if (!state.sheetsUrl) {
        _loadRoadmapFromLocalCache();
        renderRoadmapAll();
        return;
    }

    try {
        await loadRoadmapFromSheets();
    } catch (e) {
        console.warn('[Roadmap] Không tải được từ Sheets, dùng cache cục bộ:', e);
        _loadRoadmapFromLocalCache();
    }
    renderRoadmapAll();
}

function _saveRoadmapLocalCache() {
    try { localStorage.setItem(LS_ROADMAP_CACHE, JSON.stringify(state.roadmap)); } catch (e) {}
}
function _loadRoadmapFromLocalCache() {
    try {
        const raw = localStorage.getItem(LS_ROADMAP_CACHE);
        if (raw) state.roadmap = JSON.parse(raw);
    } catch (e) {}
}

async function loadRoadmapFromSheets() {
    const [yearsData, goalsData, poolData, weeksData] = await Promise.all([
        sheetsGet('ke_hoach_nam_years'),
        sheetsGet('ke_hoach_nam_goals'),
        sheetsGet('ke_hoach_nam_pool'),
        sheetsGet('ke_hoach_nam_weeks')
    ]);

    const rs = emptyRoadmapState();
    rs.years = [];
    rs.goals = {};

    (yearsData || []).forEach(r => {
        const y = parseInt(r.year);
        if (!y) return;
        rs.years.push(y);
        if (r.slogan) rs.slogans[y] = r.slogan;
    });
    rs.years.sort((a, b) => a - b);
    if (rs.years.length === 0) rs.years = [new Date().getFullYear()];
    rs.years.forEach(y => { rs.goals[y] = []; });

    const thisYear = new Date().getFullYear();
    rs.activeYear = rs.years.includes(thisYear) ? thisYear : rs.years[rs.years.length - 1];
    rs.yearWindowStart = Math.max(0, Math.min(rs.years.length - 5, rs.years.indexOf(rs.activeYear) - 2));

    const goalById = {};
    (goalsData || []).forEach(r => {
        const y = parseInt(r.year);
        if (!y || !rs.goals[y]) return;
        const goal = { id: r.id, title: r.title || '', stars: parseInt(r.stars) || 5, color: r.color || ROADMAP_PALETTE[0], months: {} };
        rs.goals[y].push(goal);
        goalById[goal.id] = goal;
    });

    (poolData || []).forEach(r => {
        const goal = goalById[r.goalId];
        const m = parseInt(r.month);
        if (!goal || !m) return;
        if (!goal.months[m]) goal.months[m] = emptyRoadmapMonth();
        goal.months[m].pool.push({ id: r.id, name: r.name || '', stars: parseInt(r.stars) || 5 });
    });

    (weeksData || []).forEach(r => {
        const goal = goalById[r.goalId];
        const m = parseInt(r.month);
        const wk = r.weekKey;
        if (!goal || !m || !wk) return;
        if (!goal.months[m]) goal.months[m] = emptyRoadmapMonth();

        let blocks = [];
        if (r.blocksJson) {
            try { blocks = JSON.parse(r.blocksJson) || []; } catch (e) { blocks = []; }
        } else if (r.goalHeader || r.tasksJson) {
            let legacyTasks = [];
            try { legacyTasks = r.tasksJson ? JSON.parse(r.tasksJson) : []; } catch (e) { legacyTasks = []; }
            if (r.goalHeader || legacyTasks.length > 0) {
                blocks = [{ id: 'blk_legacy_' + m + '_' + wk, goalHeader: r.goalHeader || '(Chưa đặt tên)', tasks: legacyTasks }];
            }
        }
        goal.months[m].weeks[wk] = { blocks };
    });

    state.roadmap = rs;
    _saveRoadmapLocalCache();
}

async function syncRoadmapToSheets() {
    _saveRoadmapLocalCache();
    if (!state.sheetsUrl) return;

    const yearsRows = state.roadmap.years.map(y => [String(y), state.roadmap.slogans[y] || '']);
    const goalsRows = [];
    const poolRows = [];
    const weeksRows = [];

    Object.keys(state.roadmap.goals).forEach(yearStr => {
        (state.roadmap.goals[yearStr] || []).forEach(goal => {
            goalsRows.push([goal.id, yearStr, goal.title, String(goal.stars), goal.color]);
            Object.keys(goal.months || {}).forEach(monthStr => {
                const monthData = goal.months[monthStr];
                (monthData.pool || []).forEach(item => {
                    poolRows.push([item.id, goal.id, monthStr, item.name, String(item.stars)]);
                });
                ['w1', 'w2', 'w3', 'w4'].forEach(wk => {
                    const week = (monthData.weeks || {})[wk] || emptyRoadmapWeek();
                    if (!week.blocks || week.blocks.length === 0) return;
                    weeksRows.push([goal.id + '_' + monthStr + '_' + wk, goal.id, monthStr, wk, JSON.stringify(week.blocks)]);
                });
            });
        });
    });

    await Promise.all([
        sheetsPost('ke_hoach_nam_years', ['year', 'slogan'], yearsRows),
        sheetsPost('ke_hoach_nam_goals', ['id', 'year', 'title', 'stars', 'color'], goalsRows),
        sheetsPost('ke_hoach_nam_pool', ['id', 'goalId', 'month', 'name', 'stars'], poolRows),
        sheetsPost('ke_hoach_nam_weeks', ['id', 'goalId', 'month', 'weekKey', 'blocksJson'], weeksRows)
    ]);
}

function scheduleRoadmapSync() {
    _saveRoadmapLocalCache();
    clearTimeout(_roadmapSyncTimer);
    _roadmapSyncTimer = setTimeout(() => {
        syncRoadmapToSheets().catch(e => console.warn('[Roadmap] Lỗi đồng bộ lên Sheets:', e));
    }, 1200);
}

// =============================================================
// NĂM — dùng dialog thay prompt
// =============================================================
function renderRoadmapYearTabs() {
    const container = document.getElementById('roadmap-year-tabs');
    if (!container) return;
    container.innerHTML = '';

    const visibleYears = state.roadmap.years.slice(state.roadmap.yearWindowStart, state.roadmap.yearWindowStart + 5);
    visibleYears.forEach(year => {
        const btn = document.createElement('button');
        const active = year === state.roadmap.activeYear;
        btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition ' + (active ? 'bg-[#B6FF2E] text-[#14161C]' : 'text-[#777E90] hover:text-[#F4F5F6] hover:bg-[#353945]');
        btn.textContent = 'Năm ' + year;
        btn.onclick = () => {
            state.roadmap.activeYear = year;
            renderRoadmapYearTabs();
            renderRoadmapSlogan();
            renderRoadmapMatrix();
        };
        container.appendChild(btn);
    });

    const prevBtn = document.getElementById('roadmap-prev-years');
    const nextBtn = document.getElementById('roadmap-next-years');
    if (prevBtn) prevBtn.disabled = state.roadmap.yearWindowStart === 0;
    if (nextBtn) nextBtn.disabled = state.roadmap.yearWindowStart + 5 >= state.roadmap.years.length;
}

function shiftRoadmapYears(direction) {
    state.roadmap.yearWindowStart = Math.max(0, Math.min(Math.max(0, state.roadmap.years.length - 5), state.roadmap.yearWindowStart + direction));
    renderRoadmapYearTabs();
}

async function addRoadmapYear() {
    const result = await dlgYear(state.roadmap.activeYear + 1);
    if (!result) return;

    const yearNum = parseInt(result.year);
    if (!yearNum || isNaN(yearNum)) { showNotification('Năm không hợp lệ!', 'error'); return; }
    if (state.roadmap.years.includes(yearNum)) { showNotification('Năm này đã tồn tại.', 'error'); return; }

    state.roadmap.years.push(yearNum);
    state.roadmap.years.sort((a, b) => a - b);
    state.roadmap.goals[yearNum] = [];
    state.roadmap.activeYear = yearNum;
    state.roadmap.yearWindowStart = Math.max(0, state.roadmap.years.indexOf(yearNum) - 2);

    renderRoadmapYearTabs();
    renderRoadmapSlogan();
    renderRoadmapMatrix();
    scheduleRoadmapSync();
}

// =============================================================
// SLOGAN — dùng dialog thay input inline
// =============================================================
function renderRoadmapSlogan() {
    const input = document.getElementById('roadmap-slogan-input');
    if (input) input.value = state.roadmap.slogans[state.roadmap.activeYear] || '';
}
function onRoadmapSloganChange() {
    const input = document.getElementById('roadmap-slogan-input');
    if (!input) return;
    state.roadmap.slogans[state.roadmap.activeYear] = input.value;
    scheduleRoadmapSync();
}

async function openSloganDialog() {
    const current = state.roadmap.slogans[state.roadmap.activeYear] || '';
    const result = await dlgSlogan(current);
    if (!result) return;
    state.roadmap.slogans[state.roadmap.activeYear] = result.slogan || '';
    renderRoadmapSlogan();
    scheduleRoadmapSync();
}

// =============================================================
// MỤC TIÊU NĂM — dùng dialog thay prompt
// =============================================================
async function addRoadmapAnnualGoal() {
    const result = await dlgAnnualGoal({});
    if (!result) return;

    if (!state.roadmap.goals[state.roadmap.activeYear]) state.roadmap.goals[state.roadmap.activeYear] = [];
    state.roadmap.goals[state.roadmap.activeYear].push({
        id: 'g_' + Date.now(),
        title: result.title,
        stars: result.stars || 5,
        color: result.color || ROADMAP_PALETTE[0],
        months: {}
    });

    renderRoadmapMatrix();
    scheduleRoadmapSync();
    showNotification('Đã thêm mục tiêu năm!', 'success');
}

async function editRoadmapAnnualGoal(goalId) {
    const goal = (state.roadmap.goals[state.roadmap.activeYear] || []).find(g => g.id === goalId);
    if (!goal) return;

    const result = await dlgAnnualGoal({ title: goal.title, stars: goal.stars, color: goal.color });
    if (!result) return;

    goal.title = result.title;
    goal.stars = result.stars || 5;
    goal.color = result.color || goal.color;

    renderRoadmapMatrix();
    scheduleRoadmapSync();
    showNotification('Đã cập nhật mục tiêu!', 'success');
}

function deleteRoadmapAnnualGoal(goalId) {
    const goal = (state.roadmap.goals[state.roadmap.activeYear] || []).find(g => g.id === goalId);
    if (!goal) return;
    confirmAction(`Xóa mục tiêu "${goal.title}"? Toàn bộ kế hoạch tháng bên trong cũng sẽ bị xóa.`, () => {
        state.roadmap.goals[state.roadmap.activeYear] = (state.roadmap.goals[state.roadmap.activeYear] || []).filter(g => g.id !== goalId);
        renderRoadmapMatrix();
        scheduleRoadmapSync();
        showNotification('Đã xóa mục tiêu!', 'success');
    });
}

function getActiveRoadmapGoal() {
    return (state.roadmap.goals[state.roadmap.activeYear] || []).find(g => g.id === activeRoadmapGoalId);
}

// =============================================================
// TÍNH TIẾN ĐỘ
// =============================================================
function calcRoadmapWeekProgress(week) {
    if (!week || !week.blocks || week.blocks.length === 0) return 0;
    let total = 0, done = 0;
    week.blocks.forEach(block => {
        (block.tasks || []).forEach(t => { total++; if (t.done) done++; });
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
}
function calcRoadmapMonthProgress(monthData) {
    if (!monthData || !monthData.weeks) return 0;
    let total = 0;
    ['w1', 'w2', 'w3', 'w4'].forEach(wk => { total += calcRoadmapWeekProgress(monthData.weeks[wk]); });
    return Math.round(total / 4);
}
function calcRoadmapYearProgress(goal) {
    let totalProg = 0, count = 0;
    for (let m = 1; m <= 12; m++) {
        if (goal.months[m]) { totalProg += calcRoadmapMonthProgress(goal.months[m]); count++; }
    }
    return count === 0 ? 0 : Math.round(totalProg / count);
}

// =============================================================
// MA TRẬN 12 THÁNG
// =============================================================
function renderRoadmapMatrix() {
    const tbody = document.getElementById('roadmap-matrix-body');
    if (!tbody) return;

    const goals = state.roadmap.goals[state.roadmap.activeYear] || [];
    if (goals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="text-center py-10 text-[#777E90] text-xs">Chưa có Mục tiêu năm nào trong năm ${state.roadmap.activeYear}. Bấm "+ Thêm Mục Tiêu Năm" để bắt đầu!</td></tr>`;
        return;
    }

    const rowsHtml = goals.map(goal => {
        const yearProgress = calcRoadmapYearProgress(goal);
        const themeColor = goal.color || ROADMAP_PALETTE[0];

        const tdGoal = `
            <td class="align-top p-3 border-b border-r border-[#353945] sticky left-0 bg-[#1a2332] z-10" style="width:250px;min-width:250px;border-left:4px solid ${themeColor}">
                <div class="font-bold text-xs text-[#F4F5F6] leading-relaxed break-words">${goal.title}</div>
                <div class="text-amber-400 text-[10px] mt-1">${renderRoadmapStars(goal.stars || 5)}</div>
                <div class="mt-2 space-y-1">
                    <div class="flex justify-between text-[10px] text-[#777E90]"><span>Tiến độ</span><span>${yearProgress}%</span></div>
                    <div class="h-1.5 bg-[#353945] rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" style="width:${yearProgress}%;background:${themeColor}"></div></div>
                </div>
                <div class="flex gap-1 mt-2">
                    <button onclick="editRoadmapAnnualGoal('${goal.id}')" title="Sửa mục tiêu"
                        class="text-[9px] px-1.5 py-0.5 rounded bg-[#23262F] border border-[#353945] text-[#777E90] hover:text-[#F4F5F6]">✏️</button>
                    <button onclick="deleteRoadmapAnnualGoal('${goal.id}')" title="Xóa mục tiêu"
                        class="text-[9px] px-1.5 py-0.5 rounded bg-[#23262F] border border-rose-500/30 text-[#777E90] hover:text-rose-400">🗑️</button>
                </div>
            </td>`;

        let tdMonths = '';
        for (let m = 1; m <= 12; m++) {
            const monthData = goal.months[m];
            const progress = calcRoadmapMonthProgress(monthData);
            let content;
            if (monthData && monthData.pool && monthData.pool.length > 0) {
                content = `
                    <div class="space-y-1.5">
                        ${monthData.pool.map(item => `
                            <div class="text-[11px] leading-snug rounded px-2 py-1 flex justify-between gap-1.5 break-words" style="background:rgba(255,255,255,0.05);border-left:3px solid ${themeColor}">
                                <span class="text-[#F4F5F6]">${item.name}</span>
                                <span class="text-amber-400 flex-shrink-0">${item.stars}★</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="mt-2 h-1 bg-[#353945] rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" style="width:${progress}%;background:${themeColor}"></div></div>`;
            } else {
                content = `<div class="flex items-center justify-center h-full min-h-[70px] text-[#777E90] text-xl opacity-40">+</div>`;
            }
            tdMonths += `<td class="align-top p-2 border-b border-r border-[#353945]" style="width:250px;min-width:250px" onclick="handleRoadmapMonthClick(event, '${goal.id}', ${m})"><div class="rounded-lg p-2 min-h-[100px] h-full transition hover:bg-[#23262F] cursor-pointer">${content}</div></td>`;
        }

        return `<tr>${tdGoal}${tdMonths}</tr>`;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

function renderRoadmapAll() {
    renderRoadmapYearTabs();
    renderRoadmapSlogan();
    renderRoadmapMatrix();
}

// =============================================================
// DRAG SCROLL
// =============================================================
function initRoadmapDragScroll() {
    const slider = document.getElementById('roadmap-matrix-container');
    if (!slider || slider.dataset.dragInit) return;
    slider.dataset.dragInit = '1';

    let isDown = false, startX = 0, scrollLeft = 0;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        roadmapIsDragging = false;
        slider.classList.add('cursor-grabbing');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    ['mouseleave', 'mouseup'].forEach(evt => slider.addEventListener(evt, () => {
        isDown = false;
        slider.classList.remove('cursor-grabbing');
    }));
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 5) roadmapIsDragging = true;
        slider.scrollLeft = scrollLeft - walk;
    });
}

function handleRoadmapMonthClick(event, goalId, month) {
    if (roadmapIsDragging) { event.preventDefault(); return; }
    openRoadmapMonthModal(goalId, month);
}

// =============================================================
// MODAL THÁNG — dùng dialog thay prompt
// =============================================================
function openRoadmapMonthModal(goalId, month) {
    activeRoadmapGoalId = goalId;
    activeRoadmapMonth = month;
    const goal = getActiveRoadmapGoal();
    if (!goal) return;

    document.getElementById('roadmap-modal-title').textContent = `Lập Kế Hoạch — Tháng ${month} (${state.roadmap.activeYear})`;
    document.getElementById('roadmap-modal-sub').textContent = `Mục tiêu: ${goal.title}`;

    if (!goal.months[month]) goal.months[month] = emptyRoadmapMonth();

    renderRoadmapModalContent();
    document.getElementById('roadmap-modal-overlay').classList.remove('hidden');
}

function closeRoadmapMonthModal() {
    document.getElementById('roadmap-modal-overlay').classList.add('hidden');
    renderRoadmapMatrix();
}

async function addRoadmapMonthlyGoal() {
    const result = await dlgMonthlyGoal({});
    if (!result) return;

    const goal = getActiveRoadmapGoal();
    if (!goal) return;

    goal.months[activeRoadmapMonth].pool.push({
        id: 'm_' + Date.now(),
        name: result.name,
        stars: result.stars || 5
    });
    renderRoadmapModalContent();
    scheduleRoadmapSync();
    showNotification('Đã thêm việc tháng!', 'success');
}

async function editRoadmapMonthlyGoal(poolItemId) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const item = (goal.months[activeRoadmapMonth].pool || []).find(p => p.id === poolItemId);
    if (!item) return;

    const result = await dlgMonthlyGoal({ name: item.name, stars: item.stars });
    if (!result) return;

    item.name = result.name;
    item.stars = result.stars || 5;
    renderRoadmapModalContent();
    scheduleRoadmapSync();
    showNotification('Đã cập nhật việc tháng!', 'success');
}

function deleteRoadmapMonthlyGoal(poolItemId) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    confirmAction('Xóa việc tháng này? Các tuần đã kéo vào từ việc này sẽ không bị xóa.', () => {
        goal.months[activeRoadmapMonth].pool = goal.months[activeRoadmapMonth].pool.filter(p => p.id !== poolItemId);
        renderRoadmapModalContent();
        scheduleRoadmapSync();
        showNotification('Đã xóa việc tháng!', 'success');
    });
}

function renderRoadmapModalContent() {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const monthData = goal.months[activeRoadmapMonth];
    const themeColor = goal.color || ROADMAP_PALETTE[0];

    // Kho việc tháng
    const poolContainer = document.getElementById('roadmap-pool-container');
    poolContainer.innerHTML = '';
    (monthData.pool || []).forEach(item => {
        const el = document.createElement('div');
        el.className = 'bg-[#14161C] border border-[#353945] rounded-lg px-2.5 py-2 cursor-grab hover:border-[#B6FF2E]/40 transition group';
        el.draggable = true;
        el.ondragstart = (e) => e.dataTransfer.setData('text/plain', item.name);
        el.innerHTML = `
            <div class="flex items-start justify-between gap-1">
                <div class="min-w-0">
                    <div class="text-xs font-semibold text-[#F4F5F6] break-words">${item.name}</div>
                    <div class="text-[10px] text-amber-400 mt-0.5">Ưu tiên: ${renderRoadmapStars(item.stars)}</div>
                </div>
                <div class="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <button onclick="editRoadmapMonthlyGoal('${item.id}')" class="text-[9px] w-5 h-5 rounded bg-[#23262F] border border-[#353945] text-[#777E90] hover:text-[#F4F5F6] flex items-center justify-center">✏️</button>
                    <button onclick="deleteRoadmapMonthlyGoal('${item.id}')" class="text-[9px] w-5 h-5 rounded bg-[#23262F] border border-rose-500/30 text-[#777E90] hover:text-rose-400 flex items-center justify-center">✕</button>
                </div>
            </div>`;
        poolContainer.appendChild(el);
    });

    // 4 tuần
    const weeksGrid = document.getElementById('roadmap-weeks-grid');
    weeksGrid.innerHTML = '';
    ['w1', 'w2', 'w3', 'w4'].forEach((wKey, idx) => {
        if (!monthData.weeks[wKey]) monthData.weeks[wKey] = emptyRoadmapWeek();
        const week = monthData.weeks[wKey];
        if (!week.blocks) week.blocks = [];
        const weekProg = calcRoadmapWeekProgress(week);

        const weekEl = document.createElement('div');
        weekEl.className = 'bg-[#0D0E12] border border-[#353945] rounded-xl p-3 space-y-2 min-h-[180px] flex flex-col';
        weekEl.ondragover = (e) => { e.preventDefault(); weekEl.classList.add('border-[#B6FF2E]'); };
        weekEl.ondragleave = () => weekEl.classList.remove('border-[#B6FF2E]');
        weekEl.ondrop = (e) => {
            e.preventDefault();
            weekEl.classList.remove('border-[#B6FF2E]');
            const droppedName = e.dataTransfer.getData('text/plain');
            if (!droppedName) return;
            const alreadyExists = week.blocks.some(b => b.goalHeader === droppedName);
            if (alreadyExists) {
                showNotification('Việc này đã có trong tuần rồi, bỏ qua.', 'error');
                return;
            }
            week.blocks.push({ id: 'blk_' + Date.now() + Math.random().toString(36).substr(2, 4), goalHeader: droppedName, tasks: [] });
            renderRoadmapModalContent();
            scheduleRoadmapSync();
        };

        const blocksHtml = week.blocks.length > 0
            ? week.blocks.map(block => `
                <div class="space-y-1.5">
                    <div class="text-xs font-semibold rounded px-2 py-1.5 break-words flex items-center justify-between gap-1" style="background:rgba(255,255,255,0.08);border-left:3px solid ${themeColor}">
                        <span>🚩 ${block.goalHeader}</span>
                        <button onclick="deleteRoadmapBlock('${wKey}','${block.id}')" class="text-[9px] text-[#777E90] hover:text-rose-400 flex-shrink-0">✕</button>
                    </div>
                    <div class="space-y-1 pl-1">
                        ${(block.tasks || []).length > 0 ? block.tasks.map((task, tIdx) => `
                            <label class="flex items-start gap-2 text-[11px] ${task.done ? 'text-[#777E90] line-through' : 'text-[#F4F5F6]'} cursor-pointer">
                                <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleRoadmapTask('${wKey}', '${block.id}', ${tIdx})" class="mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0" style="accent-color:${themeColor}">
                                <span class="break-words flex-1">${task.text}</span>
                                <button onclick="deleteRoadmapTask('${wKey}','${block.id}',${tIdx})" class="text-[9px] text-[#777E90] hover:text-rose-400 flex-shrink-0 mt-0.5">✕</button>
                            </label>
                        `).join('') : `<div class="text-[10px] text-[#777E90] italic pl-1">Chưa có việc nhỏ nào.</div>`}
                    </div>
                </div>
            `).join('')
            : `<div class="text-[11px] text-[#777E90] italic">Kéo việc từ Kho Việc Tháng thả vào đây</div>`;

        weekEl.innerHTML = `
            <div class="flex justify-between items-center text-xs font-semibold text-[#F4F5F6] border-b border-dashed border-[#353945] pb-1.5">
                <span>Tuần ${idx + 1}</span><span style="color:${themeColor}">${weekProg}%</span>
            </div>
            <div class="space-y-2.5 flex-1">${blocksHtml}</div>
            <div class="relative">
                <button onclick="addRoadmapWeekTask('${wKey}')" class="w-full text-[10px] text-[#777E90] border border-dashed border-[#353945] rounded-lg py-1.5 hover:text-[#B6FF2E] hover:border-[#B6FF2E]/40 transition">+ Thêm việc nhỏ</button>
            </div>
        `;
        weeksGrid.appendChild(weekEl);
    });
}

// Xóa block khỏi tuần
function deleteRoadmapBlock(weekKey, blockId) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    if (!week) return;
    week.blocks = week.blocks.filter(b => b.id !== blockId);
    renderRoadmapModalContent();
    scheduleRoadmapSync();
}

// Xóa task khỏi block
function deleteRoadmapTask(weekKey, blockId, taskIndex) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    const block = (week.blocks || []).find(b => b.id === blockId);
    if (!block) return;
    block.tasks.splice(taskIndex, 1);
    renderRoadmapModalContent();
    scheduleRoadmapSync();
}

// Thêm việc nhỏ vào tuần — dùng dialog
async function addRoadmapWeekTask(weekKey) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    const blocks = (week && week.blocks) || [];

    if (blocks.length === 0) {
        showNotification('Cần kéo ít nhất 1 việc tháng từ Kho vào tuần này trước khi thêm việc nhỏ.', 'error');
        return;
    }

    if (blocks.length === 1) {
        await _addWeekTaskToBlock(weekKey, blocks[0].id);
        return;
    }

    // Nhiều block → hiện menu chọn (dùng dialog thay prompt)
    _showBlockPickerMenu(weekKey, blocks);
}

function _showBlockPickerMenu(weekKey, blocks) {
    // Xóa menu cũ nếu có
    document.getElementById('roadmap-block-picker')?.remove();

    const menu = document.createElement('div');
    menu.id = 'roadmap-block-picker';
    menu.className = 'fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-4';
    menu.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-xs p-4 space-y-3 shadow-2xl">
            <h4 class="font-bold text-sm text-[#F4F5F6]">Thêm việc nhỏ vào mục nào?</h4>
            <div class="space-y-1.5">
                ${blocks.map(b => `
                    <button onclick="pickBlockForTask('${weekKey}','${b.id}')"
                        class="w-full text-left px-3 py-2 rounded-xl text-[11px] text-[#F4F5F6] bg-[#23262F] hover:bg-[#353945] border border-[#353945] hover:border-[#B6FF2E]/30 transition break-words">
                        🚩 ${b.goalHeader}
                    </button>`).join('')}
            </div>
            <button onclick="document.getElementById('roadmap-block-picker').remove()"
                class="w-full py-2 rounded-xl bg-[#23262F] text-[#777E90] text-xs border border-[#353945] hover:bg-[#353945]">Hủy</button>
        </div>`;
    document.body.appendChild(menu);
    menu.addEventListener('click', e => { if (e.target === menu) menu.remove(); });
}

async function pickBlockForTask(weekKey, blockId) {
    document.getElementById('roadmap-block-picker')?.remove();
    await _addWeekTaskToBlock(weekKey, blockId);
}

async function _addWeekTaskToBlock(weekKey, blockId) {
    const result = await dlgWeekTask({});
    if (!result || !result.text) return;

    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    const block = (week.blocks || []).find(b => b.id === blockId);
    if (!block) return;

    block.tasks.push({ text: result.text, done: false });
    renderRoadmapModalContent();
    scheduleRoadmapSync();
    showNotification('Đã thêm việc nhỏ!', 'success');
}

// Tick/bỏ tick việc nhỏ
function toggleRoadmapTask(weekKey, blockId, taskIndex) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    const block = (week.blocks || []).find(b => b.id === blockId);
    if (!block) return;
    block.tasks[taskIndex].done = !block.tasks[taskIndex].done;
    renderRoadmapModalContent();
    scheduleRoadmapSync();
}
