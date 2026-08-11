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
        // goals[năm] = [ { id, title, stars, color, months: { 1: { pool:[{id,name,stars}], weeks:{ w1:{blocks:[{id,goalHeader,tasks:[{text,done}]}]}, w2..w4 } } } } ]
    };
}

if (!state.roadmap) state.roadmap = emptyRoadmapState();

function renderRoadmapStars(count) { return '★'.repeat(count) + '☆'.repeat(5 - count); }

// Mỗi tuần có thể chứa NHIỀU khối (block) — mỗi khối tương ứng 1 việc tháng được kéo
// thả vào tuần đó, gồm 1 dòng tiêu đề (goalHeader) + danh sách tickbox RIÊNG của khối.
// Kéo 2 việc tháng khác nhau vào cùng 1 tuần -> có 2 block, mỗi block tự theo dõi tickbox độc lập.
function emptyRoadmapWeek() {
    return { blocks: [] }; // blocks: [{ id, goalHeader, tasks: [{text, done}] }]
}
function emptyRoadmapMonth() {
    return { pool: [], weeks: { w1: emptyRoadmapWeek(), w2: emptyRoadmapWeek(), w3: emptyRoadmapWeek(), w4: emptyRoadmapWeek() } };
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

        let blocks = [];
        if (r.blocksJson) {
            // Định dạng mới: nhiều khối (mỗi khối = 1 goalHeader + tickbox riêng)
            try { blocks = JSON.parse(r.blocksJson) || []; } catch (e) { blocks = []; }
        } else if (r.goalHeader || r.tasksJson) {
            // Migrate dữ liệu cũ: tuần chỉ có 1 goalHeader + 1 danh sách tickbox chung
            // -> gộp thành đúng 1 block để không mất dữ liệu đã lưu trước đó.
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
                    const week = (monthData.weeks || {})[wk] || emptyRoadmapWeek();
                    if (!week.blocks || week.blocks.length === 0) return; // tuần trống -> khỏi ghi dòng thừa
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
            // Mỗi việc tháng kéo vào trở thành 1 KHỐI riêng (goalHeader + tickbox riêng).
            // Nếu việc này đã có sẵn trong tuần (trùng tên) -> bỏ qua, không tạo khối trùng.
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
                    <div class="text-xs font-semibold rounded px-2 py-1.5 break-words" style="background:rgba(255,255,255,0.08);border-left:3px solid ${themeColor}">🚩 ${block.goalHeader}</div>
                    <div class="space-y-1 pl-1">
                        ${(block.tasks || []).length > 0 ? block.tasks.map((task, tIdx) => `
                            <label class="flex items-start gap-2 text-[11px] ${task.done ? 'text-[#777E90] line-through' : 'text-[#F4F5F6]'} cursor-pointer">
                                <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleRoadmapTask('${wKey}', '${block.id}', ${tIdx})" class="mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0" style="accent-color:${themeColor}">
                                <span class="break-words">${task.text}</span>
                            </label>
                        `).join('') : `<div class="text-[10px] text-[#777E90] italic pl-1">Chưa có việc nhỏ nào trong mục này.</div>`}
                    </div>
                </div>
            `).join('')
            : `<div class="text-[11px] text-[#777E90] italic">Kéo việc từ Kho Việc Tháng thả vào đây (kéo được nhiều việc, mỗi việc thành 1 mục riêng)</div>`;

        weekEl.innerHTML = `
            <div class="flex justify-between items-center text-xs font-semibold text-[#F4F5F6] border-b border-dashed border-[#353945] pb-1.5">
                <span>Tuần ${idx + 1}</span><span style="color:${themeColor}">${weekProg}%</span>
            </div>
            <div class="space-y-2.5 flex-1">${blocksHtml}</div>
            <div class="relative">
                <button onclick="toggleRoadmapAddTaskMenu('${wKey}')" id="roadmap-add-task-btn-${wKey}" class="w-full text-[10px] text-[#777E90] border border-dashed border-[#353945] rounded-lg py-1.5 hover:text-[#B6FF2E] hover:border-[#B6FF2E]/40 transition">+ Thêm việc nhỏ (Tickbox)</button>
                <div id="roadmap-add-task-menu-${wKey}" class="hidden absolute bottom-full left-0 right-0 mb-1 bg-[#14161C] border border-[#353945] rounded-lg overflow-hidden shadow-xl z-10 max-h-40 overflow-y-auto"></div>
            </div>
        `;
        weeksGrid.appendChild(weekEl);
    });
}

// Tick/bỏ tick 1 việc nhỏ — cần chỉ rõ block (blockId) vì 1 tuần có thể có nhiều khối,
// mỗi khối có danh sách tickbox độc lập.
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

// Nút "+ Thêm việc nhỏ" — dùng CHUNG 1 nút cho cả tuần để tiết kiệm không gian:
// - Chưa có khối nào trong tuần -> báo cần kéo việc tháng vào trước.
// - Chỉ có 1 khối -> thêm thẳng vào khối đó luôn, khỏi hỏi lại cho nhanh.
// - Có từ 2 khối trở lên -> hiện danh sách goalheader để người dùng chọn thêm vào đúng khối nào.
function toggleRoadmapAddTaskMenu(weekKey) {
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    const blocks = (week && week.blocks) || [];

    if (blocks.length === 0) {
        showNotification('Cần kéo ít nhất 1 việc tháng từ Kho Việc Tháng vào tuần này trước khi thêm việc nhỏ.', 'error');
        return;
    }
    if (blocks.length === 1) {
        addRoadmapTaskToBlock(weekKey, blocks[0].id);
        return;
    }

    // Đóng các menu khác đang mở (nếu có) để không hiện chồng nhiều menu cùng lúc
    document.querySelectorAll('[id^="roadmap-add-task-menu-"]').forEach(el => {
        if (el.id !== `roadmap-add-task-menu-${weekKey}`) el.classList.add('hidden');
    });

    const menu = document.getElementById(`roadmap-add-task-menu-${weekKey}`);
    if (!menu) return;
    const isOpen = !menu.classList.contains('hidden');
    if (isOpen) { menu.classList.add('hidden'); return; }

    menu.innerHTML = blocks.map(b => `
        <button type="button" onclick="addRoadmapTaskToBlock('${weekKey}', '${b.id}')" class="w-full text-left px-3 py-2 text-[11px] text-[#F4F5F6] hover:bg-[#23262F] transition break-words border-b border-[#353945] last:border-b-0">🚩 ${b.goalHeader}</button>
    `).join('');
    menu.classList.remove('hidden');
}

function addRoadmapTaskToBlock(weekKey, blockId) {
    const menu = document.getElementById(`roadmap-add-task-menu-${weekKey}`);
    if (menu) menu.classList.add('hidden');

    const text = prompt('Nhập việc cần làm cho mục này:');
    if (!text) return;
    const goal = getActiveRoadmapGoal();
    if (!goal) return;
    const week = goal.months[activeRoadmapMonth].weeks[weekKey];
    const block = (week.blocks || []).find(b => b.id === blockId);
    if (!block) return;
    block.tasks.push({ text, done: false });
    renderRoadmapModalContent();
    scheduleRoadmapSync();
}
