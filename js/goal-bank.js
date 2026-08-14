// =============================================================
// KHO MỤC TIÊU CHIẾN LƯỢC (Goal Bank)
// Lưu trữ các mục tiêu lớn và nội dung con để tham khảo,
// có thể copy nội dung con để đưa vào Kế Hoạch Năm.
// Hiển thị dạng cuộn ngang, mỗi mục tiêu = 1 cột.
// Lưu vào 2 sheet riêng: kho_muc_tieu_goals + kho_muc_tieu_items
// =============================================================

const GOAL_BANK_COLORS = [
    '#38bdf8', '#c084fc', '#fb923c', '#10b981',
    '#f43f5e', '#facc15', '#60a5fa', '#34d399'
];

let goalBankLoaded = false;
let _goalBankSyncTimer = null;

// --- Đảm bảo state.goalBank tồn tại ---
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
}

function renderGoalBankColumn(goal) {
    const color = goal.color || GOAL_BANK_COLORS[0];
    const items = goal.items || [];

    const itemsHtml = items.length > 0
        ? items.map(it => `
            <div class="group flex items-start gap-2 bg-[#0D0E12] border border-[#353945] rounded-xl p-3 hover:border-[#B6FF2E]/30 transition">
                <span class="flex-1 text-[11px] text-[#F4F5F6] leading-relaxed break-words">${escapeGoalHtml(it.text)}</span>
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
            </div>`).join('')
        : `<div class="text-[11px] text-[#777E90] italic text-center py-4">Chưa có nội dung. Bấm "+ Thêm" để thêm.</div>`;

    return `
        <div class="flex-shrink-0 bg-[#14161C] border border-[#353945] rounded-2xl overflow-hidden"
             style="width:280px; border-top: 3px solid ${color};">
            <!-- Header cột -->
            <div class="px-4 py-3 flex items-start justify-between gap-2">
                <h4 class="font-bold text-sm text-[#F4F5F6] leading-snug flex-1 break-words">${escapeGoalHtml(goal.title)}</h4>
                <div class="flex gap-1 flex-shrink-0">
                    <button onclick="editGoalTitle('${goal.id}')"
                        title="Sửa tên mục tiêu"
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
            <!-- Nội dung con -->
            <div class="px-3 pb-3 space-y-2 max-h-[520px] overflow-y-auto">
                ${itemsHtml}
            </div>
            <!-- Nút thêm nội dung con -->
            <div class="px-3 pb-3">
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
// ACTIONS — MỤC TIÊU CHÍNH
// =============================================================

function addGoal() {
    const title = prompt('Nhập tên mục tiêu chính:');
    if (!title || !title.trim()) return;

    const usedColors = (state.goalBank || []).map(g => g.color);
    const color = GOAL_BANK_COLORS.find(c => !usedColors.includes(c)) || GOAL_BANK_COLORS[Math.floor(Math.random() * GOAL_BANK_COLORS.length)];

    if (!state.goalBank) state.goalBank = [];
    state.goalBank.push({
        id: 'GB' + Date.now(),
        title: title.trim(),
        color,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    renderGoalBank();
    scheduleGoalBankSync();
    showNotification('Đã thêm mục tiêu mới!', 'success');
}

function editGoalTitle(goalId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;

    const newTitle = prompt('Sửa tên mục tiêu:', goal.title);
    if (!newTitle || !newTitle.trim()) return;

    goal.title = newTitle.trim();
    goal.updatedAt = new Date().toISOString();
    renderGoalBank();
    scheduleGoalBankSync();
    showNotification('Đã cập nhật tên mục tiêu!', 'success');
}

function deleteGoal(goalId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;

    confirmAction(`Xóa mục tiêu "${goal.title}" và toàn bộ ${goal.items.length} nội dung con?`, () => {
        state.goalBank = state.goalBank.filter(g => g.id !== goalId);
        renderGoalBank();
        scheduleGoalBankSync();
        showNotification('Đã xóa mục tiêu!', 'success');
    });
}

// =============================================================
// ACTIONS — NỘI DUNG CON
// =============================================================

function addGoalItem(goalId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;

    // Dùng modal nhỏ thay vì prompt để nhập thoải mái hơn
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h4 class="font-bold text-sm text-[#F4F5F6]">+ Thêm Nội Dung</h4>
            <p class="text-[11px] text-[#777E90]">Mục tiêu: <span class="text-[#B6FF2E]">${escapeGoalHtml(goal.title)}</span></p>
            <textarea id="goal-item-input" rows="4"
                placeholder="Nhập nội dung cần làm để đạt mục tiêu này..."
                class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2.5 text-xs text-[#F4F5F6] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E] resize-none"></textarea>
            <div class="flex justify-end gap-2">
                <button id="goal-item-cancel" class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945]">Hủy</button>
                <button id="goal-item-ok" class="px-4 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90">Thêm</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#goal-item-input');
    textarea.focus();

    overlay.querySelector('#goal-item-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#goal-item-ok').onclick = () => {
        const text = textarea.value.trim();
        if (!text) { showNotification('Vui lòng nhập nội dung!', 'error'); return; }

        if (!goal.items) goal.items = [];
        goal.items.push({
            id: 'GI' + Date.now(),
            text,
            createdAt: new Date().toISOString()
        });
        goal.updatedAt = new Date().toISOString();

        overlay.remove();
        renderGoalBank();
        scheduleGoalBankSync();
        showNotification('Đã thêm nội dung!', 'success');
    };

    // Enter + Ctrl/Cmd để submit nhanh
    textarea.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            overlay.querySelector('#goal-item-ok').click();
        }
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function editGoalItem(goalId, itemId) {
    const goal = (state.goalBank || []).find(g => g.id === goalId);
    if (!goal) return;
    const item = (goal.items || []).find(i => i.id === itemId);
    if (!item) return;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h4 class="font-bold text-sm text-[#F4F5F6]">✏️ Sửa Nội Dung</h4>
            <textarea id="goal-item-edit-input" rows="4"
                class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2.5 text-xs text-[#F4F5F6] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E] resize-none">${escapeGoalHtml(item.text)}</textarea>
            <div class="flex justify-end gap-2">
                <button id="goal-item-edit-cancel" class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945]">Hủy</button>
                <button id="goal-item-edit-ok" class="px-4 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90">Lưu</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#goal-item-edit-input');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    overlay.querySelector('#goal-item-edit-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#goal-item-edit-ok').onclick = () => {
        const text = textarea.value.trim();
        if (!text) { showNotification('Nội dung không được để trống!', 'error'); return; }
        item.text = text;
        goal.updatedAt = new Date().toISOString();
        overlay.remove();
        renderGoalBank();
        scheduleGoalBankSync();
        showNotification('Đã cập nhật nội dung!', 'success');
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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
    // Decode HTML entities trước khi copy
    const decoded = text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(decoded).then(() => {
            showNotification('✅ Đã copy vào clipboard!', 'success');
        }).catch(() => _copyFallback(decoded));
    } else {
        _copyFallback(decoded);
    }
}

function _copyFallback(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
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
// DRAG SCROLL cho Kho Mục Tiêu (giống roadmap)
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
