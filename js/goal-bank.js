// =============================================================
// KHO MỤC TIÊU CHIẾN LƯỢC (Goal Bank)
// Lưu trữ các mục tiêu lớn và nội dung con để tham khảo,
// có thể copy nội dung con để đưa vào Kế Hoạch Năm.
// Hiển thị dạng cuộn ngang, mỗi mục tiêu = 1 cột.
// Lưu vào 2 sheet riêng: kho_muc_tieu_goals + kho_muc_tieu_items
// =============================================================

const GOAL_BANK_COLORS = [
    '#38bdf8', '#c084fc', '#fb923c', '#10b981',
    '#f43f5e', '#facc15', '#60a5fa', '#34d399',
    '#f97316', '#a78bfa', '#2dd4bf', '#fb7185'
];

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
            <div class="flex items-center justify-center h-64 text-[#777E90] text-xs">
                🗃️ Kho mục tiêu đang trống. Bấm <strong class="text-[#B6FF2E] mx-1">+ Thêm Mục Tiêu</strong> để bắt đầu.
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="flex gap-4 pb-4" style="min-width: max-content;">
            ${goals.map(g => renderGoalBankColumn(g)).join('')}
        </div>`;

    // Kích hoạt drag scroll sau khi render
    setTimeout(() => initGoalBankDragScroll(), 50);
}

function renderGoalBankColumn(goal) {
    const color = goal.color || GOAL_BANK_COLORS[0];
    const items = goal.items || [];
    const stars = goal.stars || 0;

    const starsHtml = stars > 0
        ? `<div class="text-amber-400 text-[10px]">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>`
        : '';

    const itemsHtml = items.length > 0
        ? items.map(it => {
            const itStars = it.stars || 0;
            const itStarsHtml = itStars > 0
                ? `<div class="text-amber-400 text-[9px] mt-0.5">${'★'.repeat(itStars)}${'☆'.repeat(5 - itStars)}</div>`
                : '';
            return `
            <div class="group flex items-start gap-2 bg-[#0D0E12] border border-[#353945] rounded-xl p-3 hover:border-[#B6FF2E]/30 transition">
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] text-[#F4F5F6] leading-relaxed break-words whitespace-pre-wrap">${escapeGoalHtml(it.text)}</p>
                    ${itStarsHtml}
                </div>
                <div class="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <button onclick="copyGoalItem('${escapeGoalAttr(it.text)}')"
                        title="Copy nội dung"
                        class="w-6 h-6 rounded-lg bg-[#23262F] border border-[#353945] text-[#B6FF2E] hover:bg-[#B6FF2E]/10 flex items-center justify-center text-[10px]">
                        📋
                    </button>
                    <button onclick="editGoalItem('${goal.id}', '${it.id}')"
                        title="Sửa"
                        class="w-6 h-6 rounded-lg bg-[#23262F] border border-[#353945] text-[#777E90] hover:text-[#F4F5F6] flex items-center justify-center text-[10px]">
                        ✏️
                    </button>
                    <button onclick="deleteGoalItem('${goal.id}', '${it.id}')"
                        title="Xóa"
                        class="w-6 h-6 rounded-lg bg-[#23262F] border border-rose-500/30 text-[#777E90] hover:text-rose-400 flex items-center justify-center text-[10px]">
                        ✕
                    </button>
                </div>
            </div>`;
        }).join('')
        : `<div class="text-[11px] text-[#777E90] italic text-center py-4">Chưa có nội dung.<br>Bấm "+ Thêm Nội Dung" để thêm.</div>`;

    return `
        <div class="flex-shrink-0 bg-[#14161C] border border-[#353945] rounded-2xl overflow-hidden flex flex-col"
             style="width:280px; border-top: 3px solid ${color};">
            <!-- Header cột -->
            <div class="px-4 py-3 border-b border-[#353945]" style="background: linear-gradient(135deg, ${color}15, transparent);">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <h4 class="font-bold text-sm text-[#F4F5F6] leading-snug break-words">${escapeGoalHtml(goal.title)}</h4>
                        ${starsHtml}
                    </div>
                    <div class="flex gap-1 flex-shrink-0">
                        <button onclick="editGoalTitle('${goal.id}')"
                            title="Sửa mục tiêu"
                            class="w-6 h-6 rounded-lg bg-[#23262F] border border-[#353945] text-[#777E90] hover:text-[#F4F5F6] flex items-center justify-center text-[10px]">
                            ✏️
                        </button>
                        <button onclick="deleteGoal('${goal.id}')"
                            title="Xóa mục tiêu"
                            class="w-6 h-6 rounded-lg bg-[#23262F] border border-rose-500/30 text-[#777E90] hover:text-rose-400 flex items-center justify-center text-[10px]">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="text-[10px] text-[#777E90] mt-1">${items.length} nội dung</div>
            </div>
            <!-- Nội dung con -->
            <div class="px-3 py-3 space-y-2 flex-1 overflow-y-auto" style="max-height: 480px;">
                ${itemsHtml}
            </div>
            <!-- Nút thêm nội dung con -->
            <div class="px-3 pb-3 pt-1 border-t border-[#353945]">
                <button onclick="addGoalItem('${goal.id}')"
                    class="w-full text-[11px] py-2 rounded-xl border border-dashed border-[#B6FF2E]/40 text-[#B6FF2E] hover:bg-[#B6FF2E]/10 transition font-semibold">
                    + Thêm Nội Dung
                </button>
            </div>
        </div>`;
}

// Helper tránh XSS
function escapeGoalHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeGoalAttr(str) {
    return (str || '').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

// =============================================================
// ACTIONS — MỤC TIÊU CHÍNH (dùng dialog)
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
    scheduleGoalBankSync();
    showNotification('Đã cập nhật mục tiêu!', 'success');
}

function deleteGoal(goalId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;

    confirmAction(`Xóa mục tiêu "${goal.title}" và toàn bộ ${(goal.items||[]).length} nội dung con?`, () => {
        state.goalBank = state.goalBank.filter(g => g.id !== goalId);
        renderGoalBank();
        scheduleGoalBankSync();
        showNotification('Đã xóa mục tiêu!', 'success');
    });
}

// =============================================================
// ACTIONS — NỘI DUNG CON (dùng dialog)
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
    scheduleGoalBankSync();
    showNotification('Đã cập nhật nội dung!', 'success');
}

function deleteGoalItem(goalId, itemId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;
    goal.items = (goal.items || []).filter(i => i.id !== itemId);
    goal.updatedAt = new Date().toISOString();
    renderGoalBank();
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

// =============================================================
// DRAG SCROLL cho Kho Mục Tiêu
// =============================================================
function initGoalBankDragScroll() {
    const slider = document.getElementById('goal-bank-scroll');
    if (!slider || slider.dataset.dragInit) return;
    slider.dataset.dragInit = '1';

    let isDown = false, startX = 0, scrollLeft = 0;
    slider.addEventListener('mousedown', e => {
        isDown = true;
        slider.classList.add('cursor-grabbing');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    ['mouseleave', 'mouseup'].forEach(evt => slider.addEventListener(evt, () => {
        isDown = false;
        slider.classList.remove('cursor-grabbing');
    }));
    slider.addEventListener('mousemove', e => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        slider.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
}
