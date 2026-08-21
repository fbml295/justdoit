// =============================================================
// KHO MỤC TIÊU CHIẾN LƯỢC (Goal Bank)
// Layout: mỗi mục tiêu chính = 1 hàng ngang
//   - Thẻ đầu tiên (cột 1): Mục tiêu chính — nền màu nổi bật
//   - Thẻ tiếp theo (cùng hàng): Mỗi nội dung con = 1 thẻ riêng, cùng kích thước
//   - Thẻ cuối hàng: nút "+ Thêm nội dung"
// Lưu vào 2 sheet: kho_muc_tieu_goals + kho_muc_tieu_items
// =============================================================

const GOAL_BANK_COLORS = [
    '#38bdf8', '#c084fc', '#fb923c', '#10b981',
    '#f43f5e', '#facc15', '#60a5fa', '#34d399',
    '#f97316', '#a78bfa', '#2dd4bf', '#fb7185'
];

// Chiều cao cố định của tất cả thẻ trong 1 hàng
const GOAL_CARD_HEIGHT = '220px';

let goalBankLoaded = false;
let _goalBankSyncTimer = null;

if (!state.goalBank) state.goalBank = [];

// =============================================================
// LOAD / SYNC
// =============================================================

async function ensureGoalBankLoaded() {
    if (goalBankLoaded) { renderGoalBank(); return; }
    goalBankLoaded = true;

    if (!state.sheetsUrl) {
        renderGoalBank();
        return;
    }
    try {
        await loadGoalBankFromSheets();
    } catch(e) {
        console.warn('[GoalBank] Không tải được từ Sheets:', e);
    }
    renderGoalBank();
}

function scheduleGoalBankSync() {
    saveToLocalStorage();
    clearTimeout(_goalBankSyncTimer);
    _goalBankSyncTimer = setTimeout(() => {
        syncGoalBankToSheets().catch(e => console.warn('[GoalBank] Lỗi sync:', e));
    }, 1000);
}

// =============================================================
// RENDER CHÍNH
// =============================================================

function renderGoalBank() {
    const container = document.getElementById('goal-bank-container');
    if (!container) return;

    const goals = state.goalBank || [];

    if (goals.length === 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center py-16 text-[#777E90] text-xs">
                🗃️ Kho mục tiêu đang trống. Bấm <strong class="text-[#B6FF2E] mx-1">+ Thêm Mục Tiêu</strong> để bắt đầu.
            </div>`;
        return;
    }

    // Mỗi goal = 1 hàng ngang, các hàng xếp dọc, mỗi hàng cuộn ngang độc lập
    container.innerHTML = goals.map(g => renderGoalBankRow(g)).join('');
}

function renderGoalBankRow(goal) {
    const color = goal.color || GOAL_BANK_COLORS[0];
    const items = goal.items || [];

    // Màu nền mục tiêu chính — đậm
    const mainBg   = hexToRgba(color, 0.18);
    const mainBorder = color;

    // Thẻ mục tiêu chính
    const mainCard = renderGoalMainCard(goal, color, mainBg, mainBorder);

    // Thẻ nội dung con
    const itemCards = items.map(it => renderGoalItemCard(it, goal.id, color)).join('');

    // Thẻ nút thêm mới
    const addCard = `
        <div class="flex-shrink-0 flex items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition hover:bg-[#B6FF2E]/5 hover:border-[#B6FF2E]/60"
             style="width:220px; min-width:220px; height:${GOAL_CARD_HEIGHT}; border-color:${hexToRgba(color, 0.35)};"
             onclick="addGoalItem('${goal.id}')">
            <div class="text-center space-y-2">
                <div class="text-2xl" style="color:${color}">+</div>
                <div class="text-[11px] font-semibold" style="color:${color}">Thêm nội dung</div>
            </div>
        </div>`;

    return `
        <div class="mb-5">
            <!-- Thanh cuộn ngang cho từng hàng -->
            <div class="overflow-x-auto pb-2 goal-bank-row-scroll" style="cursor:grab;">
                <div class="flex gap-3 w-max">
                    ${mainCard}
                    ${itemCards}
                    ${addCard}
                </div>
            </div>
        </div>`;
}

function renderGoalMainCard(goal, color, bg, borderColor) {
    const stars = goal.stars || 0;
    const starsHtml = stars > 0
        ? `<div class="text-[11px]" style="color:#facc15">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>`
        : '';
    const itemCount = (goal.items || []).length;

    return `
        <div class="flex-shrink-0 rounded-2xl border-2 flex flex-col overflow-hidden"
             style="width:220px; min-width:220px; height:${GOAL_CARD_HEIGHT}; background:${bg}; border-color:${borderColor}; box-shadow: 0 0 16px ${hexToRgba(color, 0.2)};">
            <!-- Accent top bar -->
            <div class="h-1 w-full flex-shrink-0" style="background:${borderColor};"></div>
            <!-- Header -->
            <div class="px-3 pt-2.5 pb-1 flex items-start justify-between gap-1 flex-shrink-0">
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style="background:${hexToRgba(color,0.25)};color:${color};">
                    Mục tiêu
                </span>
                <div class="flex gap-1">
                    <button onclick="editGoalTitle('${goal.id}')"
                        class="w-5 h-5 rounded flex items-center justify-center text-[10px] transition hover:opacity-80"
                        style="background:${hexToRgba(color,0.2)};color:${color};" title="Sửa">✏️</button>
                    <button onclick="deleteGoal('${goal.id}')"
                        class="w-5 h-5 rounded flex items-center justify-center text-[10px] text-rose-400 hover:text-rose-300 transition"
                        style="background:rgba(244,63,94,0.12);" title="Xóa">🗑️</button>
                </div>
            </div>
            <!-- Title + stars — scrollable -->
            <div class="flex-1 px-3 overflow-y-auto min-h-0 space-y-1.5">
                <h4 class="font-bold text-sm text-[#F4F5F6] leading-snug break-words">${escapeGoalHtml(goal.title)}</h4>
                ${starsHtml}
            </div>
            <!-- Footer -->
            <div class="px-3 pb-3 pt-2 flex-shrink-0 border-t" style="border-color:${hexToRgba(color,0.25)};">
                <div class="text-[10px]" style="color:${hexToRgba(color,0.8)};">${itemCount} nội dung con</div>
            </div>
        </div>`;
}

function renderGoalItemCard(item, goalId, color) {
    const itStars = item.stars || 0;
    const starsHtml = itStars > 0
        ? `<div class="text-[10px]" style="color:#facc15">${'★'.repeat(itStars)}${'☆'.repeat(5 - itStars)}</div>`
        : '';

    // Thẻ con dùng màu mục tiêu chính nhưng nhạt hơn
    const bg     = hexToRgba(color, 0.07);
    const border = hexToRgba(color, 0.30);

    return `
        <div class="flex-shrink-0 rounded-2xl border flex flex-col overflow-hidden group"
             style="width:220px; min-width:220px; height:${GOAL_CARD_HEIGHT}; background:${bg}; border-color:${border};">
            <!-- Accent bar mỏng hơn -->
            <div class="h-0.5 w-full flex-shrink-0" style="background:${color};opacity:0.6;"></div>
            <!-- Header actions (hiện khi hover) -->
            <div class="px-3 pt-2.5 pb-1 flex justify-between items-center flex-shrink-0">
                <span class="text-[9px] font-mono" style="color:${hexToRgba(color,0.7)};">Nội dung</span>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="copyGoalItem('${escapeGoalAttr(item.text)}')"
                        class="w-5 h-5 rounded flex items-center justify-center text-[10px] transition"
                        style="background:${hexToRgba(color,0.15)};color:${color};" title="Copy">📋</button>
                    <button onclick="editGoalItem('${goalId}','${item.id}')"
                        class="w-5 h-5 rounded flex items-center justify-center text-[10px] transition"
                        style="background:${hexToRgba(color,0.15)};color:${color};" title="Sửa">✏️</button>
                    <button onclick="deleteGoalItem('${goalId}','${item.id}')"
                        class="w-5 h-5 rounded flex items-center justify-center text-[10px] text-rose-400 hover:text-rose-300 transition"
                        style="background:rgba(244,63,94,0.10);" title="Xóa">✕</button>
                </div>
            </div>
            <!-- Nội dung — scrollable -->
            <div class="flex-1 px-3 overflow-y-auto min-h-0 space-y-1.5">
                <p class="text-[11px] text-[#F4F5F6] leading-relaxed break-words whitespace-pre-wrap">${escapeGoalHtml(item.text)}</p>
                ${starsHtml}
            </div>
            <!-- Footer spacer -->
            <div class="h-2 flex-shrink-0"></div>
        </div>`;
}

// =============================================================
// HELPER — hex → rgba
// =============================================================
function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return `rgba(100,100,100,${alpha})`;
    const h = hex.replace('#', '');
    const full = h.length === 3
        ? h.split('').map(c => c + c).join('')
        : h;
    const r = parseInt(full.substring(0,2), 16);
    const g = parseInt(full.substring(2,4), 16);
    const b = parseInt(full.substring(4,6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// Helper tránh XSS
function escapeGoalHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeGoalAttr(str) {
    return (str || '').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

// =============================================================
// DRAG SCROLL cho từng hàng
// =============================================================
function initGoalBankDragScroll() {
    document.querySelectorAll('.goal-bank-row-scroll').forEach(slider => {
        if (slider.dataset.dragInit) return;
        slider.dataset.dragInit = '1';

        let isDown = false, startX = 0, scrollLeft = 0;
        slider.addEventListener('mousedown', e => {
            isDown = true;
            slider.style.cursor = 'grabbing';
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });
        ['mouseleave', 'mouseup'].forEach(evt => slider.addEventListener(evt, () => {
            isDown = false;
            slider.style.cursor = 'grab';
        }));
        slider.addEventListener('mousemove', e => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            slider.scrollLeft = scrollLeft - (x - startX) * 1.5;
        });
    });
}

// =============================================================
// ACTIONS — MỤC TIÊU CHÍNH
// =============================================================

async function addGoal() {
    const result = await dlgGoalBankGoal({});
    if (!result) return;

    if (!state.goalBank) state.goalBank = [];
    state.goalBank.push({
        id: 'GB' + Date.now(),
        title: result.title,
        stars: result.stars || 5,
        color: result.color || GOAL_BANK_COLORS[0],
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    renderGoalBank();
    setTimeout(() => initGoalBankDragScroll(), 50);
    scheduleGoalBankSync();
    showNotification('Đã thêm mục tiêu mới!', 'success');
}

async function editGoalTitle(goalId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;

    const result = await dlgGoalBankGoal({ title: goal.title, stars: goal.stars, color: goal.color });
    if (!result) return;

    goal.title = result.title;
    goal.stars = result.stars || 5;
    goal.color = result.color || goal.color;
    goal.updatedAt = new Date().toISOString();

    renderGoalBank();
    setTimeout(() => initGoalBankDragScroll(), 50);
    scheduleGoalBankSync();
    showNotification('Đã cập nhật mục tiêu!', 'success');
}

function deleteGoal(goalId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;

    confirmAction(`Xóa mục tiêu "${goal.title}" và toàn bộ ${(goal.items||[]).length} nội dung con?`, () => {
        state.goalBank = state.goalBank.filter(g => g.id !== goalId);
        renderGoalBank();
        setTimeout(() => initGoalBankDragScroll(), 50);
        scheduleGoalBankSync();
        showNotification('Đã xóa mục tiêu!', 'success');
    });
}

// =============================================================
// ACTIONS — NỘI DUNG CON
// =============================================================

async function addGoalItem(goalId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;

    const result = await dlgGoalBankItem({});
    if (!result || !result.text) return;

    if (!goal.items) goal.items = [];
    goal.items.push({
        id: 'GI' + Date.now(),
        text: result.text,
        stars: result.stars || 5,
        createdAt: new Date().toISOString()
    });
    goal.updatedAt = new Date().toISOString();

    renderGoalBank();
    setTimeout(() => initGoalBankDragScroll(), 50);
    scheduleGoalBankSync();
    showNotification('Đã thêm nội dung!', 'success');
}

async function editGoalItem(goalId, itemId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;
    const item = (goal.items || []).find(i => i.id === itemId);
    if (!item) return;

    const result = await dlgGoalBankItem({ text: item.text, stars: item.stars });
    if (!result || !result.text) return;

    item.text = result.text;
    item.stars = result.stars || 5;
    goal.updatedAt = new Date().toISOString();

    renderGoalBank();
    setTimeout(() => initGoalBankDragScroll(), 50);
    scheduleGoalBankSync();
    showNotification('Đã cập nhật nội dung!', 'success');
}

function deleteGoalItem(goalId, itemId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;
    goal.items = (goal.items || []).filter(i => i.id !== itemId);
    goal.updatedAt = new Date().toISOString();
    renderGoalBank();
    setTimeout(() => initGoalBankDragScroll(), 50);
    scheduleGoalBankSync();
    showNotification('Đã xóa nội dung!', 'success');
}

// Copy nội dung vào clipboard
function copyGoalItem(text) {
    const decoded = text
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(decoded)
            .then(() => showNotification('✅ Đã copy vào clipboard!', 'success'))
            .catch(() => _copyFallback(decoded));
    } else {
        _copyFallback(decoded);
    }
}

function _copyFallback(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(el);
    el.select();
    try {
        document.execCommand('copy');
        showNotification('✅ Đã copy vào clipboard!', 'success');
    } catch(e) {
        showNotification('Không copy được, vui lòng copy thủ công.', 'error');
    }
    document.body.removeChild(el);
}
