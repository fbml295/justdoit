// =============================================================
// KẾ HOẠCH NĂM (ANNUAL ROADMAP MATRIX)
// Cấu trúc 4 cấp: Năm -> Mục Tiêu Năm (goal) -> 12 Tháng -> 4 Tuần -> Checklist
//
// Lưu trữ: dùng chung Google Sheet đang kết nối (qua sheetsGet/sheetsPost đã có sẵn),
// tách thành 3 sheet riêng (năm, mục tiêu, kho việc tháng, tuần+checklist) để giữ cấu
// trúc rõ ràng thay vì nhồi tất cả vào 1 bảng duy nhất.
//
// Hiệu năng: dữ liệu được tải LƯỜI (lazy) — chỉ gọi Sheets khi người dùng thực sự mở
// tab này lần đầu, không ảnh hưởng tốc độ khởi động các tab khác. Mọi thay đổi được
// lưu tạm localStorage NGAY LẬP TỨC (không mất dữ liệu nếu mất mạng) và đồng bộ lên
// Sheets qua debounce 1.2s (gộp nhiều thao tác liên tiếp thành 1 lần ghi, tránh spam API).
// =============================================================

const ROADMAP_PALETTE = ['#38bdf8', '#c084fc', '#fb923c', '#10b981', '#f43f5e', '#facc15'];
const LS_ROADMAP_CACHE = 'wms_roadmap_cache';

let roadmapLoaded = false;
let roadmapIsDragging = false; // phân biệt click mở modal hay đang kéo cuộn ngang bảng
let activeRoadmapGoalId = null;
let activeRoadmapMonth = null;
let _roadmapSyncTimer = null;

function emptyRoadmapState() {
    const thisYear = new Date().getFullYear();
    return {
        years: [thisYear],
        activeYear: thisYear,
        yearWindowStart: 0,
        slogans: {},   // { năm: "slogan" }
        goals: { [thisYear]: [] }
        // goals[năm] = [ { id, title, stars, color, months: { 1: { pool:[{id,name,stars}], weeks:{ w1:{goalHeader,tasks:[{text,done}]}, w2..w4 } } } } ]
    };
}

if (!state.roadmap) state.roadmap = emptyRoadmapState();

function renderRoadmapStars(count) { return '★'.repeat(count) + '☆'.repeat(5 - count); }

function emptyRoadmapMonth() {
    return { pool: [], weeks: { w1: { goalHeader: '', tasks: [] }, w2: { goalHeader: '', tasks: [] }, w3: { goalHeader: '', tasks: [] }, w4: { goalHeader: '', tasks: [] } } };
}

// --- Tải dữ liệu (lười — chỉ tải 1 lần khi vào tab lần đầu) ---
async function ensureRoadmapLoaded() {
    if (roadmapLoaded) { renderRoadmapAll(); return; }
    roadmapLoaded = true; // đánh dấu trước để tránh gọi trùng nếu người dùng bấm tab nhanh nhiều lần

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
    try { localStorage.setItem(LS_ROADMAP_CACHE, JSON.stringify(state.roadmap)); } catch (e) { /* bỏ qua nếu đầy quota */ }
}
function _loadRoadmapFromLocalCache() {
    try {
        const raw = localStorage.getItem(LS_ROADMAP_CACHE);
        if (raw) state.roadmap = JSON.parse(raw);
    } catch (e) { /* dữ liệu hỏng, giữ nguyên state.roadmap mặc định */ }
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
        let tasks = [];
        try { tasks = r.tasksJson ? JSON.parse(r.tasksJson) : []; } catch (e) { tasks = []; }
        goal.months[m].weeks[wk] = { goalHeader: r.goalHeader || '', tasks };
    });

    state.roadmap = rs;
    _saveRoadmapLocalCache();
}

async function syncRoadmapToSheets() {
    _saveRoadmapLocalCache();
    if (!state.sheetsUrl) return; // chưa kết nối Sheets -> chỉ lưu cục bộ

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
                    const week = (monthData.weeks || {})[wk] || { goalHeader: '', tasks: [] };
                    if (!week.goalHeader && (!week.tasks || week.tasks.length === 0)) return; // tuần trống -> khỏi ghi dòng thừa
                    weeksRows.push([goal.id + '_' + monthStr + '_' + wk, goal.id, monthStr, wk, week.goalHeader || '', JSON.stringify(week.tasks || [])]);
                });
            });
        });
    });

    await Promise.all([
        sheetsPost('ke_hoach_nam_years', ['year', 'slogan'], yearsRows),
        sheetsPost('ke_hoach_nam_goals', ['id', 'year', 'title', 'stars', 'color'], goalsRows),
        sheetsPost('ke_hoach_nam_pool', ['id', 'goalId', 'month', 'name', 'stars'], poolRows),
        sheetsPost('ke_hoach_nam_weeks', ['id', 'goalId', 'month', 'weekKey', 'goalHeader', 'tasksJson'], weeksRows)
    ]);
}

// Gộp nhiều thao tác liên tiếp (VD tích nhiều checkbox liền nhau) thành 1 lần ghi Sheets
function scheduleRoadmapSync() {
    _saveRoadmapLocalCache(); // lưu cục bộ ngay, không cần chờ debounce
    clearTimeout(_roadmapSyncTimer);
    _roadmapSyncTimer = setTimeout(() => {
        syncRoadmapToSheets().catch(e => console.warn('[Roadmap] Lỗi đồng bộ lên Sheets:', e));
    }, 1200);
}

// =============================================================
// NĂM
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

function addRoadmapYear() {
    const input = prompt('Nhập năm mới cần tạo:', state.roadmap.activeYear + 1);
    if (!input) return;
    const yearNum = parseInt(input);
    if (!yearNum) return;
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
// SLOGAN
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

// =============================================================
// MỤC TIÊU NĂM (GOAL)
// =============================================================
function addRoadmapAnnualGoal() {
    const title = prompt(`Nhập tên Mục tiêu năm cho Năm ${state.roadmap.activeYear}:`);
    if (!title) return;
    const starsInput = prompt('Đánh giá độ quan trọng (1-5 sao):', '5');
    const stars = Math.max(1, Math.min(5, parseInt(starsInput) || 5));
    const color = ROADMAP_PALETTE[Math.floor(Math.random() * ROADMAP_PALETTE.length)];

    if (!state.roadmap.goals[state.roadmap.activeYear]) state.roadmap.goals[state.roadmap.activeYear] = [];
    state.roadmap.goals[state.roadmap.activeYear].push({ id: 'g_' + Date.now(), title, stars, color, months: {} });

    renderRoadmapMatrix();
    scheduleRoadmapSync();
}

function getActiveRoadmapGoal() {
    return (state.roadmap.goals[state.roadmap.activeYear] || []).find(g => g.id === activeRoadmapGoalId);
}

// =============================================================
// TÍNH TIẾN ĐỘ TỰ ĐỘNG (CASCADE PROGRESS)
// =============================================================
function calcRoadmapWeekProgress(week) {
    if (!week || !week.tasks || week.tasks.length === 0) return 0;
    const done = week.tasks.filter(t => t.done).length;
    return Math.round((done / week.tasks.length) * 100);
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

    // Dựng bằng mảng chuỗi rồi gán 1 lần (innerHTML) — nhanh hơn nhiều so với appendChild lặp,
    // quan trọng khi ma trận có nhiều Mục tiêu năm x 12 tháng.
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
// KÉO RÊ CHUỘT ĐỂ CUỘN NGANG MA TRẬN (DRAG-TO-SCROLL)
// =============================================================
function initRoadmapDragScroll() {
    const slider = document.getElementById('roadmap-matrix-container');
    if (!slider || slider.dataset.dragInit) return; // chỉ gắn sự kiện 1 lần duy nhất
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
        const walk = (x - startX) * 1.5; // hệ số tốc độ cuộn
        if (Math.abs(walk) > 5) roadmapIsDragging = true; // di chuyển > 5px -> tính là đang kéo, không phải click
        slider.scrollLeft = scrollLeft - walk;
    });
}

// Chỉ mở modal khi nhấp chuột thực sự (không phải do vừa kéo cuộn xong)
function handleRoadmapMonthClick(event, goalId, month) {
    if (roadmapIsDragging) { event.preventDefault(); return; }
    openRoadmapMonthModal(goalId, month);
}

// =============================================================
// MODAL THÁNG: KHO VIỆC + 4 TUẦN (KÉO THẢ)
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
    renderRoadmapMatrix(); // cập nhật lại % tiến độ ngoài ma trận sau khi có thể đã tick checkbox trong modal
}

function addRoadmapMonthlyGoal() {
    const name = prompt('Nhập việc/mục tiêu chính trong tháng:');
    if (!name) return;
    const starsInput = prompt('Độ ưu tiên (1-5 sao):', '5');
    const stars = Math.max(1, Math.min(5, parseInt(starsInput) || 5));
    const goal = getActiveRoadmapGoal();
    if (!goal) return;

    goal.months[activeRoadmapMonth].pool.push({ id: 'm_' + Date.now(), name, stars });
    renderRoadmapModalContent();
    scheduleRoadmapSync();
}

function renderRoadmapModalContent() {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const monthData = goal.months[activeRoadmapMonth];
    const themeColor = goal.color || ROADMAP_PALETTE[0];

    // Kho việc tháng (kéo được)
    const poolContainer = document.getElementById('roadmap-pool-container');
    poolContainer.innerHTML = '';
    monthData.pool.forEach(item => {
        const el = document.createElement('div');
        el.className = 'bg-[#14161C] border border-[#353945] rounded-lg px-2.5 py-2 cursor-grab hover:border-[#B6FF2E]/40 transition';
        el.draggable = true;
        el.ondragstart = (e) => e.dataTransfer.setData('text/plain', item.name);
        el.innerHTML = `
            <div class="text-xs font-semibold text-[#F4F5F6] break-words">${item.name}</div>
            <div class="text-[10px] text-amber-400 mt-0.5">Ưu tiên: ${renderRoadmapStars(item.stars)}</div>
        `;
        poolContainer.appendChild(el);
    });

    // 4 tuần (vùng thả + checklist)
    const weeksGrid = document.getElementById('roadmap-weeks-grid');
    weeksGrid.innerHTML = '';
    ['w1', 'w2', 'w3', 'w4'].forEach((wKey, idx) => {
        const week = monthData.weeks[wKey];
        const weekProg = calcRoadmapWeekProgress(week);

        const weekEl = document.createElement('div');
        weekEl.className = 'bg-[#0D0E12] border border-[#353945] rounded-xl p-3 space-y-2 min-h-[180px] flex flex-col';
        weekEl.ondragover = (e) => { e.preventDefault(); weekEl.classList.add('border-[#B6FF2E]'); };
        weekEl.ondragleave = () => weekEl.classList.remove('border-[#B6FF2E]');
        weekEl.ondrop = (e) => {
            e.preventDefault();
            weekEl.classList.remove('border-[#B6FF2E]');
            week.goalHeader = e.dataTransfer.getData('text/plain'); // tên việc chính trở thành Tiêu đề mục tiêu Tuần
            renderRoadmapModalContent();
            scheduleRoadmapSync();
        };

        weekEl.innerHTML = `
            <div class="flex justify-between items-center text-xs font-semibold text-[#F4F5F6] border-b border-dashed border-[#353945] pb-1.5">
                <span>Tuần ${idx + 1}</span><span style="color:${themeColor}">${weekProg}%</span>
            </div>
            ${week.goalHeader
                ? `<div class="text-xs font-semibold rounded px-2 py-1.5 break-words" style="background:rgba(255,255,255,0.08);border-left:3px solid ${themeColor}">🚩 ${week.goalHeader}</div>`
                : `<div class="text-[11px] text-[#777E90] italic">Kéo việc tháng thả vào đây</div>`}
            <div class="space-y-1.5 flex-1">
                ${week.tasks.map((task, tIdx) => `
                    <label class="flex items-start gap-2 text-[11px] ${task.done ? 'text-[#777E90] line-through' : 'text-[#F4F5F6]'} cursor-pointer">
                        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleRoadmapTask('${wKey}', ${tIdx})" class="mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0" style="accent-color:${themeColor}">
                        <span class="break-words">${task.text}</span>
                    </label>
                `).join('')}
            </div>
            ${week.goalHeader ? `<button onclick="addRoadmapTask('${wKey}')" class="text-[10px] text-[#777E90] border border-dashed border-[#353945] rounded-lg py-1.5 hover:text-[#B6FF2E] hover:border-[#B6FF2E]/40 transition">+ Thêm việc nhỏ (Tickbox)</button>` : ''}
        `;
        weeksGrid.appendChild(weekEl);
    });
}

function toggleRoadmapTask(weekKey, taskIndex) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    week.tasks[taskIndex].done = !week.tasks[taskIndex].done;
    renderRoadmapModalContent();
    scheduleRoadmapSync();
}

function addRoadmapTask(weekKey) {
    const text = prompt('Nhập việc cần làm cho tuần này:');
    if (!text) return;
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    goal.months[activeRoadmapMonth].weeks[weekKey].tasks.push({ text, done: false });
    renderRoadmapModalContent();
    scheduleRoadmapSync();
}
