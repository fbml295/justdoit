// =============================================================
// SÁNG KIẾN / KAIZEN v2
// Logic đầy đủ: tạo, sửa, xóa, tài chính, checklist, phê duyệt,
// đẩy task sang Công Việc, AI tư vấn, in phiếu HTML
// =============================================================

// --- Hằng số ---
const INITIATIVE_TYPES = {
    kaizen:   { label: '🔧 Kaizen / Cải tiến',          color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    energy:   { label: '⚡ Tiết kiệm năng lượng',        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    safety:   { label: '🛡️ An toàn lao động',            color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
    quality:  { label: '🎯 Chất lượng sản phẩm',         color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
    process:  { label: '📋 Cải tiến quy trình',          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
};

const INITIATIVE_STATUSES = {
    draft:          { label: 'Đề xuất mới',        color: 'text-[#777E90] bg-[#353945] border-[#353945]' },
    reviewing:      { label: 'Đang xét duyệt',     color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    approved:       { label: 'Đã phê duyệt',       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    implementing:   { label: 'Đang triển khai',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    done:           { label: 'Hoàn thành',          color: 'text-[#B6FF2E] bg-[#B6FF2E]/10 border-[#B6FF2E]/30' },
    rejected:       { label: 'Từ chối',             color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
};

// --- Tạo mã sáng kiến tự động ---
function generateInitiativeCode() {
    const year = new Date().getFullYear();
    const existing = (state.initiatives || []).filter(i => (i.code || '').startsWith('SK-' + year));
    const seq = String(existing.length + 1).padStart(3, '0');
    return `SK-${year}-${seq}`;
}

// --- Tạo sáng kiến rỗng ---
function emptyInitiative() {
    return {
        id: 'I' + Date.now(),
        code: generateInitiativeCode(),
        title: '',
        problemDesc: '',
        solution: '',
        type: 'kaizen',
        proposer: '',
        department: '',
        proposedDate: new Date().toISOString().split('T')[0],
        status: 'draft',

        hasFinancial: false,
        financial: {
            investBreakdown: [],   // [{id, label, amount}]
            benefitBreakdown: [],  // [{id, label, amount}]
        },

        actualResult: '',
        actualBenefit: '',

        checklist: [],             // [{id, text, done, assignee, pushedToTask, taskId}]

        approved: false,
        approvedDate: '',
        approvedNote: '',

        linkedTaskIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// --- Tính tài chính ---
function calcFinancial(fin) {
    const invest = (fin.investBreakdown || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const monthly = (fin.benefitBreakdown || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const yearly = monthly * 12;
    const payback = invest > 0 && monthly > 0 ? (invest / monthly) : null;
    const roi = invest > 0 ? ((yearly - invest) / invest * 100) : null;
    return { invest, monthly, yearly, payback, roi };
}

function fmtMoney(n) {
    if (!n && n !== 0) return '—';
    return Number(n).toLocaleString('vi-VN') + ' đ';
}
function fmtPayback(months) {
    if (months === null || isNaN(months)) return '—';
    if (months < 1) return '< 1 tháng';
    const m = Math.round(months * 10) / 10;
    return m + ' tháng';
}
function fmtROI(roi) {
    if (roi === null || isNaN(roi)) return '—';
    return (Math.round(roi * 10) / 10) + '%';
}

// --- Lấy danh sách nhân sự từ config ---
function getPersonnelOptions() {
    const list = [];
    (state.config.factories || []).forEach(f => {
        (f.members || []).forEach(m => list.push({ value: m.name, label: m.name + (m.role ? ' — ' + m.role : '') + ' (🏭 ' + f.name + ')' }));
        (f.workshops || []).forEach(ws => (ws.members || []).forEach(m => list.push({ value: m.name, label: m.name + (m.role ? ' — ' + m.role : '') + ' (🏗️ ' + ws.name + ')' })));
    });
    (state.config.departments || []).forEach(d => (d.members || []).forEach(m => list.push({ value: m.name, label: m.name + (m.role ? ' — ' + m.role : '') + ' (🏢 ' + d.name + ')' })));
    (state.config.specialTeams || []).forEach(t => (t.members || []).forEach(m => list.push({ value: m.name, label: m.name + (m.role ? ' — ' + m.role : '') + ' (🛠️ ' + t.name + ')' })));
    return list;
}

// =============================================================
// RENDER DANH SÁCH SÁNG KIẾN
// =============================================================

let initiativeFilters = { status: 'all', type: 'all', search: '' };
let expandedInitiativeIds = new Set();

function renderInitiatives() {
    renderInitiativeStats();
    renderInitiativeFilterChips();
    renderInitiativeCards();
}

function renderInitiativeStats() {
    const el = document.getElementById('initiative-stats');
    if (!el) return;
    const all = state.initiatives || [];
    const total = all.length;
    const done = all.filter(i => i.status === 'done').length;
    const implementing = all.filter(i => i.status === 'implementing').length;
    const hasFinancial = all.filter(i => i.hasFinancial);
    const totalInvest = hasFinancial.reduce((s, i) => s + calcFinancial(i.financial).invest, 0);
    const totalMonthly = hasFinancial.reduce((s, i) => s + calcFinancial(i.financial).monthly, 0);

    el.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div class="bg-[#14161C] border border-[#353945] rounded-xl p-3 text-center">
                <div class="text-2xl font-extrabold text-[#F4F5F6]">${total}</div>
                <div class="text-[#777E90] mt-0.5">Tổng sáng kiến</div>
            </div>
            <div class="bg-[#14161C] border border-[#353945] rounded-xl p-3 text-center">
                <div class="text-2xl font-extrabold text-[#B6FF2E]">${done}</div>
                <div class="text-[#777E90] mt-0.5">Hoàn thành</div>
            </div>
            <div class="bg-[#14161C] border border-[#353945] rounded-xl p-3 text-center">
                <div class="text-2xl font-extrabold text-blue-400">${implementing}</div>
                <div class="text-[#777E90] mt-0.5">Đang triển khai</div>
            </div>
            <div class="bg-[#14161C] border border-[#353945] rounded-xl p-3 text-center">
                <div class="text-sm font-extrabold text-amber-400">${fmtMoney(totalMonthly)}<span class="text-[10px] font-normal">/tháng</span></div>
                <div class="text-[#777E90] mt-0.5">Tổng lợi ích TK</div>
            </div>
        </div>
    `;
}

function renderInitiativeFilterChips() {
    const el = document.getElementById('initiative-filter-chips');
    if (!el) return;

    const statusOpts = [['all', 'Tất cả'], ...Object.entries(INITIATIVE_STATUSES).map(([k, v]) => [k, v.label])];
    el.innerHTML = statusOpts.map(([k, label]) => {
        const active = initiativeFilters.status === k;
        return `<button onclick="setInitiativeFilter('status','${k}')" class="text-[10px] px-2.5 py-1 rounded-full border font-mono transition ${active ? 'bg-[#B6FF2E] text-[#14161C] border-[#B6FF2E]' : 'bg-[#23262F] text-[#777E90] border-[#353945] hover:border-[#B6FF2E]/40'}">${label}</button>`;
    }).join('');
}

function setInitiativeFilter(key, val) {
    initiativeFilters[key] = val;
    renderInitiativeCards();
    renderInitiativeFilterChips();
}

function renderInitiativeCards() {
    const container = document.getElementById('initiatives-render-area');
    if (!container) return;

    let list = state.initiatives || [];

    if (initiativeFilters.status !== 'all') list = list.filter(i => i.status === initiativeFilters.status);
    if (initiativeFilters.type !== 'all') list = list.filter(i => i.type === initiativeFilters.type);
    if (initiativeFilters.search) {
        const q = initiativeFilters.search.toLowerCase();
        list = list.filter(i => (i.title || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q) || (i.proposer || '').toLowerCase().includes(q));
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="bg-[#14161C] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">💡 Chưa có sáng kiến nào phù hợp. Bấm "+ Sáng Kiến Mới" để bắt đầu!</div>`;
        return;
    }

    container.innerHTML = '';
    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-[#14161C] rounded-2xl border border-[#353945] overflow-hidden';
        const isExpanded = expandedInitiativeIds.has(item.id);
        const typeDef = INITIATIVE_TYPES[item.type] || INITIATIVE_TYPES.kaizen;
        const statusDef = INITIATIVE_STATUSES[item.status] || INITIATIVE_STATUSES.draft;
        const fin = item.hasFinancial ? calcFinancial(item.financial) : null;
        const checkDone = (item.checklist || []).filter(c => c.done).length;
        const checkTotal = (item.checklist || []).length;
        const progress = checkTotal > 0 ? Math.round(checkDone / checkTotal * 100) : 0;

        if (!isExpanded) {
            card.innerHTML = `
                <button onclick="toggleInitiativeExpand('${item.id}')" class="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1B1E26] transition text-left gap-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-[10px] font-mono text-[#777E90] flex-shrink-0">${item.code || ''}</span>
                        <span class="font-bold text-sm text-[#F4F5F6] truncate">${item.title || '(Chưa có tiêu đề)'}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded border font-mono flex-shrink-0 ${typeDef.color}">${typeDef.label}</span>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${item.approved ? '<span class="text-[10px] text-emerald-400">✅ Đã duyệt</span>' : ''}
                        <span class="text-[10px] px-2 py-0.5 rounded border font-mono ${statusDef.color}">${statusDef.label}</span>
                        ${fin ? `<span class="text-[10px] text-amber-400 font-mono">${fmtMoney(fin.monthly)}/th</span>` : ''}
                        <span class="text-[#777E90] text-[10px]">▼</span>
                    </div>
                </button>
            `;
            container.appendChild(card);
            return;
        }

        // Expanded card
        card.innerHTML = `
            <div class="p-4 space-y-4">
                <!-- Header -->
                <div class="flex justify-between items-start border-b border-[#353945] pb-3 gap-3">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-[10px] font-mono text-[#777E90]">${item.code || ''}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded border font-mono ${typeDef.color}">${typeDef.label}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded border font-mono ${statusDef.color}">${statusDef.label}</span>
                            ${item.approved ? '<span class="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded">✅ Đã phê duyệt</span>' : ''}
                        </div>
                        <h4 class="font-bold text-base text-[#F4F5F6] mt-1">${item.title || '(Chưa có tiêu đề)'}</h4>
                        <div class="text-[10px] text-[#777E90] mt-0.5 flex gap-3 flex-wrap">
                            ${item.proposer ? `<span>👤 ${item.proposer}</span>` : ''}
                            ${item.department ? `<span>🏢 ${item.department}</span>` : ''}
                            ${item.proposedDate ? `<span>📅 ${item.proposedDate}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button onclick="openInitiativeAI('${item.id}')" class="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#B6FF2E]/15 text-[#B6FF2E] border border-[#B6FF2E]/40 font-semibold hover:bg-[#B6FF2E]/25">✨ AI Tư Vấn</button>
                        <button onclick="openEditInitiativeModal('${item.id}')" class="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#23262F] text-[#F4F5F6] border border-[#353945] hover:bg-[#353945]">✏️ Sửa</button>
                        <button onclick="printInitiative('${item.id}')" class="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#23262F] text-[#F4F5F6] border border-[#353945] hover:bg-[#353945]">🖨️ In Phiếu</button>
                        <button onclick="deleteInitiative('${item.id}')" class="text-[10px] px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20">🗑️</button>
                        <button onclick="toggleInitiativeExpand('${item.id}')" class="text-[10px] px-2 py-1.5 rounded-lg bg-[#23262F] text-[#777E90] border border-[#353945]">▲</button>
                    </div>
                </div>

                <!-- Mô tả vấn đề & Giải pháp -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    ${item.problemDesc ? `<div class="bg-[#23262F] rounded-xl p-3 border border-[#353945]"><p class="text-[10px] font-mono text-[#777E90] mb-1">VẤN ĐỀ</p><p class="text-[#F4F5F6] leading-relaxed whitespace-pre-wrap">${item.problemDesc}</p></div>` : ''}
                    ${item.solution ? `<div class="bg-[#23262F] rounded-xl p-3 border border-[#353945]"><p class="text-[10px] font-mono text-[#777E90] mb-1">GIẢI PHÁP</p><p class="text-[#F4F5F6] leading-relaxed whitespace-pre-wrap">${item.solution}</p></div>` : ''}
                </div>

                <!-- Tài chính -->
                ${item.hasFinancial ? renderInitiativeFinancialCard(item) : ''}

                <!-- Kết quả thực tế -->
                ${(item.actualResult || item.actualBenefit) ? `
                <div class="bg-[#23262F] rounded-xl p-3 border border-[#353945] text-xs space-y-1">
                    <p class="text-[10px] font-mono text-[#B6FF2E]">KẾT QUẢ THỰC TẾ</p>
                    ${item.actualResult ? `<p class="text-[#F4F5F6] whitespace-pre-wrap">${item.actualResult}</p>` : ''}
                    ${item.actualBenefit ? `<p class="text-emerald-400 font-semibold">Lợi ích thực tế: ${fmtMoney(item.actualBenefit)}/tháng</p>` : ''}
                </div>` : ''}

                <!-- Checklist triển khai -->
                ${renderInitiativeChecklist(item)}

                <!-- Phê duyệt -->
                ${renderInitiativeApproval(item)}

                <!-- Đổi trạng thái -->
                <div class="flex items-center gap-2 pt-2 border-t border-[#353945] flex-wrap">
                    <span class="text-[10px] text-[#777E90]">Trạng thái:</span>
                    ${Object.entries(INITIATIVE_STATUSES).map(([k, v]) =>
                        `<button onclick="setInitiativeStatus('${item.id}','${k}')" class="text-[10px] px-2.5 py-1 rounded-full border transition ${item.status === k ? v.color + ' font-bold' : 'bg-[#23262F] text-[#777E90] border-[#353945] hover:border-[#B6FF2E]/30'}">${v.label}</button>`
                    ).join('')}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderInitiativeFinancialCard(item) {
    const fin = calcFinancial(item.financial);
    return `
        <div class="bg-[#23262F] rounded-xl p-3 border border-amber-500/20 text-xs space-y-3">
            <p class="text-[10px] font-mono text-amber-400">💰 TÀI CHÍNH & HIỆU QUẢ</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <p class="text-[10px] text-[#777E90] mb-1">CHI PHÍ ĐẦU TƯ</p>
                    ${(item.financial.investBreakdown || []).map(r => `
                        <div class="flex justify-between text-[11px] py-0.5">
                            <span class="text-[#777E90]">${r.label}</span>
                            <span class="text-[#F4F5F6] font-mono">${fmtMoney(r.amount)}</span>
                        </div>`).join('')}
                    <div class="flex justify-between text-[11px] font-bold border-t border-[#353945] mt-1 pt-1">
                        <span class="text-rose-400">Tổng đầu tư</span>
                        <span class="text-rose-400 font-mono">${fmtMoney(fin.invest)}</span>
                    </div>
                </div>
                <div>
                    <p class="text-[10px] text-[#777E90] mb-1">LỢI ÍCH HÀNG THÁNG</p>
                    ${(item.financial.benefitBreakdown || []).map(r => `
                        <div class="flex justify-between text-[11px] py-0.5">
                            <span class="text-[#777E90]">${r.label}</span>
                            <span class="text-[#F4F5F6] font-mono">${fmtMoney(r.amount)}</span>
                        </div>`).join('')}
                    <div class="flex justify-between text-[11px] font-bold border-t border-[#353945] mt-1 pt-1">
                        <span class="text-emerald-400">Tổng lợi ích/tháng</span>
                        <span class="text-emerald-400 font-mono">${fmtMoney(fin.monthly)}</span>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-[#353945]">
                <div class="text-center bg-[#14161C] rounded-lg p-2">
                    <div class="text-sm font-extrabold text-[#B6FF2E]">${fmtPayback(fin.payback)}</div>
                    <div class="text-[10px] text-[#777E90]">Hoàn vốn</div>
                </div>
                <div class="text-center bg-[#14161C] rounded-lg p-2">
                    <div class="text-sm font-extrabold text-amber-400">${fmtMoney(fin.yearly)}</div>
                    <div class="text-[10px] text-[#777E90]">Lợi ích/năm</div>
                </div>
                <div class="text-center bg-[#14161C] rounded-lg p-2">
                    <div class="text-sm font-extrabold text-purple-400">${fmtROI(fin.roi)}</div>
                    <div class="text-[10px] text-[#777E90]">ROI năm 1</div>
                </div>
            </div>
        </div>
    `;
}

function renderInitiativeChecklist(item) {
    const list = item.checklist || [];
    const done = list.filter(c => c.done).length;
    const pct = list.length > 0 ? Math.round(done / list.length * 100) : 0;
    return `
        <div class="bg-[#23262F] rounded-xl p-3 border border-[#353945] text-xs space-y-2">
            <div class="flex items-center justify-between">
                <p class="text-[10px] font-mono text-[#B6FF2E]">📋 CÁC BƯỚC TRIỂN KHAI ${list.length > 0 ? '(' + done + '/' + list.length + ' — ' + pct + '%)' : ''}</p>
                <button onclick="addInitiativeCheckItem('${item.id}')" class="text-[10px] px-2.5 py-1 rounded-lg border border-dashed border-[#B6FF2E]/40 text-[#B6FF2E] hover:bg-[#B6FF2E]/10">+ Thêm bước</button>
            </div>
            ${list.length > 0 ? `
            <div class="h-1 bg-[#353945] rounded-full overflow-hidden">
                <div class="h-full bg-[#B6FF2E] rounded-full transition-all" style="width:${pct}%"></div>
            </div>` : ''}
            <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                ${list.map(c => `
                    <div class="flex items-center gap-2 py-0.5">
                        <input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleInitiativeCheck('${item.id}','${c.id}')" class="w-3.5 h-3.5 rounded flex-shrink-0 accent-[#B6FF2E] cursor-pointer">
                        <span class="flex-1 ${c.done ? 'line-through text-[#777E90]' : 'text-[#F4F5F6]'}">${c.text}</span>
                        ${c.assignee ? `<span class="text-[10px] text-[#777E90]">👤 ${c.assignee}</span>` : ''}
                        ${c.pushedToTask ? `<span class="text-[10px] text-[#B6FF2E] border border-[#B6FF2E]/30 bg-[#B6FF2E]/10 px-1.5 rounded">→ Task</span>` : `<button onclick="pushInitiativeCheckToTask('${item.id}','${c.id}')" class="text-[10px] text-[#777E90] hover:text-[#B6FF2E] border border-[#353945] px-1.5 py-0.5 rounded hover:border-[#B6FF2E]/30 whitespace-nowrap">→ Đẩy Task</button>`}
                        <button onclick="deleteInitiativeCheck('${item.id}','${c.id}')" class="text-[#777E90] hover:text-rose-400 text-[10px] flex-shrink-0">✕</button>
                    </div>`).join('')}
            </div>
            ${list.length === 0 ? '<p class="text-[11px] text-[#777E90] italic">Chưa có bước triển khai. Bấm "+ Thêm bước" hoặc dùng ✨ AI Tư Vấn.</p>' : ''}
        </div>
    `;
}

function renderInitiativeApproval(item) {
    return `
        <div class="bg-[#23262F] rounded-xl p-3 border border-[#353945] text-xs space-y-2">
            <p class="text-[10px] font-mono text-[#777E90]">✅ PHÊ DUYỆT</p>
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" ${item.approved ? 'checked' : ''} onchange="toggleInitiativeApproved('${item.id}')" class="w-4 h-4 rounded accent-[#B6FF2E] cursor-pointer">
                <span class="text-[#F4F5F6] font-semibold">Đã được phê duyệt (sau khi có chữ ký)</span>
            </label>
            ${item.approved ? `
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[10px] text-[#777E90] mb-1">NGÀY PHÊ DUYỆT</label>
                    <input type="date" value="${item.approvedDate || ''}" onchange="updateInitiativeField('${item.id}','approvedDate',this.value)" class="w-full bg-[#14161C] border border-[#353945] rounded-lg px-2 py-1.5 text-[#F4F5F6] text-[11px] focus:outline-none">
                </div>
                <div>
                    <label class="block text-[10px] text-[#777E90] mb-1">GHI CHÚ</label>
                    <input type="text" value="${item.approvedNote || ''}" onchange="updateInitiativeField('${item.id}','approvedNote',this.value)" placeholder="Người duyệt, số phiếu..." class="w-full bg-[#14161C] border border-[#353945] rounded-lg px-2 py-1.5 text-[#F4F5F6] text-[11px] focus:outline-none">
                </div>
            </div>` : ''}
        </div>
    `;
}

// =============================================================
// MODAL TẠO / SỬA SÁNG KIẾN
// =============================================================

function openNewInitiativeModal() {
    const item = emptyInitiative();
    state.initiatives.unshift(item);
    saveToLocalStorage();
    openEditInitiativeModal(item.id);
}

function openEditInitiativeModal(id) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;

    const personnelOpts = getPersonnelOptions();
    const deptList = [
        ...(state.config.factories || []).map(f => f.name),
        ...(state.config.departments || []).map(d => d.name),
        ...(state.config.specialTeams || []).map(t => t.name)
    ];

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.id = 'initiative-edit-overlay';

    overlay.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div class="flex justify-between items-center px-5 py-3.5 bg-[#111827] border-b border-[#353945] flex-shrink-0">
                <div>
                    <h4 class="font-bold text-sm text-[#F4F5F6]">✏️ Sáng Kiến — ${item.code}</h4>
                </div>
                <button onclick="closeInitiativeModal('${id}')" class="text-[#777E90] hover:text-rose-400 text-xl px-2">✕</button>
            </div>
            <div class="overflow-y-auto p-5 space-y-4 text-xs flex-1">

                <!-- Thông tin cơ bản -->
                <div class="space-y-3">
                    <p class="text-[10px] font-mono text-[#B6FF2E] font-bold">THÔNG TIN CƠ BẢN</p>
                    <div>
                        <label class="block text-[#777E90] mb-1">TIÊU ĐỀ SÁNG KIẾN <span class="text-rose-400">*</span></label>
                        <input id="ie-title" type="text" value="${(item.title || '').replace(/"/g,'&quot;')}" placeholder="Nhập tiêu đề..." class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E]">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[#777E90] mb-1">LOẠI</label>
                            <select id="ie-type" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] focus:outline-none">
                                ${Object.entries(INITIATIVE_TYPES).map(([k,v]) => `<option value="${k}" ${item.type===k?'selected':''}>${v.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-[#777E90] mb-1">TRẠNG THÁI</label>
                            <select id="ie-status" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] focus:outline-none">
                                ${Object.entries(INITIATIVE_STATUSES).map(([k,v]) => `<option value="${k}" ${item.status===k?'selected':''}>${v.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[#777E90] mb-1">NGƯỜI ĐỀ XUẤT</label>
                            <select id="ie-proposer" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] focus:outline-none">
                                <option value="">-- Chọn người --</option>
                                ${personnelOpts.map(p => `<option value="${p.value}" ${item.proposer===p.value?'selected':''}>${p.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-[#777E90] mb-1">BỘ PHẬN</label>
                            <select id="ie-department" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] focus:outline-none">
                                <option value="">-- Chọn bộ phận --</option>
                                ${deptList.map(d => `<option value="${d}" ${item.department===d?'selected':''}>${d}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[#777E90] mb-1">NGÀY ĐỀ XUẤT</label>
                        <input id="ie-date" type="date" value="${item.proposedDate || ''}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-[#777E90] mb-1">MÔ TẢ VẤN ĐỀ</label>
                        <textarea id="ie-problem" rows="3" placeholder="Hiện trạng vấn đề, nguyên nhân..." class="w-full bg-[#23262F] border border-[#353945] rounded-xl p-3 text-[#F4F5F6] focus:outline-none resize-none">${item.problemDesc || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[#777E90] mb-1">GIẢI PHÁP ĐỀ XUẤT</label>
                        <textarea id="ie-solution" rows="3" placeholder="Giải pháp cụ thể, cách thực hiện..." class="w-full bg-[#23262F] border border-[#353945] rounded-xl p-3 text-[#F4F5F6] focus:outline-none resize-none">${item.solution || ''}</textarea>
                    </div>
                </div>

                <!-- Tài chính -->
                <div class="border-t border-[#353945] pt-4 space-y-3">
                    <div class="flex items-center gap-2">
                        <p class="text-[10px] font-mono text-amber-400 font-bold">💰 TÀI CHÍNH & HIỆU QUẢ</p>
                        <label class="flex items-center gap-1.5 cursor-pointer ml-auto">
                            <input type="checkbox" id="ie-has-financial" ${item.hasFinancial?'checked':''} onchange="toggleIEFinancial()" class="w-3.5 h-3.5 rounded accent-[#B6FF2E]">
                            <span class="text-[10px] text-[#777E90]">Tính được hiệu quả tài chính</span>
                        </label>
                    </div>
                    <div id="ie-financial-section" class="${item.hasFinancial ? '' : 'hidden'} space-y-3">
                        <!-- Chi phí đầu tư -->
                        <div>
                            <div class="flex items-center justify-between mb-1.5">
                                <label class="text-[#777E90]">CHI PHÍ ĐẦU TƯ</label>
                                <button onclick="addIEBreakdownRow('invest')" class="text-[10px] text-[#B6FF2E] border border-[#B6FF2E]/30 px-2 py-0.5 rounded hover:bg-[#B6FF2E]/10">+ Thêm mục</button>
                            </div>
                            <div id="ie-invest-rows" class="space-y-1.5">
                                ${(item.financial.investBreakdown || []).map(r => buildBreakdownRowHTML('invest', r)).join('')}
                            </div>
                        </div>
                        <!-- Lợi ích -->
                        <div>
                            <div class="flex items-center justify-between mb-1.5">
                                <label class="text-[#777E90]">LỢI ÍCH HÀNG THÁNG</label>
                                <button onclick="addIEBreakdownRow('benefit')" class="text-[10px] text-[#B6FF2E] border border-[#B6FF2E]/30 px-2 py-0.5 rounded hover:bg-[#B6FF2E]/10">+ Thêm mục</button>
                            </div>
                            <div id="ie-benefit-rows" class="space-y-1.5">
                                ${(item.financial.benefitBreakdown || []).map(r => buildBreakdownRowHTML('benefit', r)).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Kết quả thực tế -->
                <div class="border-t border-[#353945] pt-4 space-y-2">
                    <p class="text-[10px] font-mono text-emerald-400 font-bold">📊 KẾT QUẢ THỰC TẾ (điền sau khi hoàn thành)</p>
                    <textarea id="ie-actual-result" rows="2" placeholder="Kết quả đạt được, chỉ số đo lường..." class="w-full bg-[#23262F] border border-[#353945] rounded-xl p-3 text-[#F4F5F6] focus:outline-none resize-none">${item.actualResult || ''}</textarea>
                    <div>
                        <label class="block text-[#777E90] mb-1">LỢI ÍCH THỰC TẾ (đ/tháng)</label>
                        <input id="ie-actual-benefit" type="number" value="${item.actualBenefit || ''}" placeholder="0" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] focus:outline-none">
                    </div>
                </div>

            </div>
            <div class="flex justify-end gap-2 px-5 py-3.5 border-t border-[#353945] flex-shrink-0">
                <button onclick="closeInitiativeModal('${id}')" class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945]">Hủy</button>
                <button onclick="saveInitiativeFromModal('${id}')" class="px-4 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90">💾 Lưu</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeInitiativeModal(id); });

    // Khởi tạo dữ liệu breakdown nếu chưa có
    if (!item.financial.investBreakdown || item.financial.investBreakdown.length === 0) {
        document.getElementById('ie-invest-rows').innerHTML = buildBreakdownRowHTML('invest', { id: 'inv_' + Date.now(), label: 'Vật tư', amount: '' });
    }
    if (!item.financial.benefitBreakdown || item.financial.benefitBreakdown.length === 0) {
        document.getElementById('ie-benefit-rows').innerHTML = buildBreakdownRowHTML('benefit', { id: 'ben_' + Date.now(), label: 'Tiết kiệm điện', amount: '' });
    }
}

function buildBreakdownRowHTML(type, row) {
    return `
        <div class="flex gap-1.5 items-center" id="row-${row.id}">
            <input type="text" value="${(row.label||'').replace(/"/g,'&quot;')}" placeholder="Tên mục..." class="flex-1 bg-[#14161C] border border-[#353945] rounded-lg px-2.5 py-1.5 text-[11px] text-[#F4F5F6] focus:outline-none" data-bd-type="${type}" data-bd-id="${row.id}" data-bd-field="label">
            <input type="number" value="${row.amount || ''}" placeholder="Số tiền (đ)" class="w-36 bg-[#14161C] border border-[#353945] rounded-lg px-2.5 py-1.5 text-[11px] text-[#F4F5F6] focus:outline-none font-mono" data-bd-type="${type}" data-bd-id="${row.id}" data-bd-field="amount">
            <button onclick="removeIEBreakdownRow('${row.id}')" class="text-[#777E90] hover:text-rose-400 text-[10px] flex-shrink-0 px-1">✕</button>
        </div>
    `;
}

function toggleIEFinancial() {
    const cb = document.getElementById('ie-has-financial');
    const section = document.getElementById('ie-financial-section');
    if (section) section.classList.toggle('hidden', !cb.checked);
}

function addIEBreakdownRow(type) {
    const container = document.getElementById(`ie-${type}-rows`);
    if (!container) return;
    const id = type.slice(0,3) + '_' + Date.now();
    const div = document.createElement('div');
    div.innerHTML = buildBreakdownRowHTML(type, { id, label: '', amount: '' });
    container.appendChild(div.firstElementChild);
}

function removeIEBreakdownRow(rowId) {
    document.getElementById('row-' + rowId)?.remove();
}

function _readBreakdownRows(type) {
    const rows = [];
    document.querySelectorAll(`[data-bd-type="${type}"][data-bd-field="label"]`).forEach(labelEl => {
        const id = labelEl.dataset.bdId;
        const amountEl = document.querySelector(`[data-bd-type="${type}"][data-bd-id="${id}"][data-bd-field="amount"]`);
        const label = labelEl.value.trim();
        const amount = Number(amountEl?.value) || 0;
        if (label || amount) rows.push({ id, label, amount });
    });
    return rows;
}

function saveInitiativeFromModal(id) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;

    const title = document.getElementById('ie-title').value.trim();
    if (!title) { showNotification('Vui lòng nhập tiêu đề sáng kiến!', 'error'); return; }

    item.title = title;
    item.type = document.getElementById('ie-type').value;
    item.status = document.getElementById('ie-status').value;
    item.proposer = document.getElementById('ie-proposer').value;
    item.department = document.getElementById('ie-department').value;
    item.proposedDate = document.getElementById('ie-date').value;
    item.problemDesc = document.getElementById('ie-problem').value.trim();
    item.solution = document.getElementById('ie-solution').value.trim();
    item.actualResult = document.getElementById('ie-actual-result').value.trim();
    item.actualBenefit = document.getElementById('ie-actual-benefit').value;
    item.hasFinancial = document.getElementById('ie-has-financial').checked;

    if (item.hasFinancial) {
        item.financial.investBreakdown = _readBreakdownRows('invest');
        item.financial.benefitBreakdown = _readBreakdownRows('benefit');
    }

    item.updatedAt = new Date().toISOString();
    closeInitiativeModal(id);
    saveToLocalStorage();
    syncStateToCSV();
    renderInitiatives();
    showNotification('Đã lưu sáng kiến!', 'success');
}

function closeInitiativeModal(id) {
    document.getElementById('initiative-edit-overlay')?.remove();
    // Nếu sáng kiến mới mà chưa có title thì xóa
    const item = state.initiatives.find(i => i.id === id);
    if (item && !item.title) {
        state.initiatives = state.initiatives.filter(i => i.id !== id);
        saveToLocalStorage();
    }
    renderInitiatives();
}

// =============================================================
// MUTATIONS
// =============================================================

function toggleInitiativeExpand(id) {
    if (expandedInitiativeIds.has(id)) expandedInitiativeIds.delete(id);
    else expandedInitiativeIds.add(id);
    renderInitiativeCards();
}

function setInitiativeStatus(id, status) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    syncStateToCSV();
    renderInitiatives();
}

function updateInitiativeField(id, field, value) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;
    item[field] = value;
    item.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    syncStateToCSV();
}

function toggleInitiativeApproved(id) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;
    item.approved = !item.approved;
    if (item.approved && !item.approvedDate) item.approvedDate = new Date().toISOString().split('T')[0];
    if (item.approved && item.status !== 'done') item.status = 'approved';
    item.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    syncStateToCSV();
    renderInitiatives();
    showNotification(item.approved ? '✅ Đã đánh dấu phê duyệt!' : 'Đã bỏ đánh dấu phê duyệt.', 'success');
}

function deleteInitiative(id) {
    confirmAction('Xóa sáng kiến này? Hành động không thể hoàn tác.', () => {
        state.initiatives = state.initiatives.filter(i => i.id !== id);
        expandedInitiativeIds.delete(id);
        showNotification('Đã xóa sáng kiến!', 'success');
        saveToLocalStorage();
        syncStateToCSV();
        renderInitiatives();
    });
}

// --- Checklist ---
function addInitiativeCheckItem(id) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4';
    const personnelOpts = getPersonnelOptions();
    overlay.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <h4 class="font-bold text-sm text-[#F4F5F6]">+ Thêm bước triển khai</h4>
            <div>
                <label class="block text-[10px] text-[#777E90] mb-1">NỘI DUNG BƯỚC</label>
                <input id="check-text-input" type="text" placeholder="Mô tả việc cần làm..." class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-sm focus:outline-none focus:ring-1 focus:ring-[#B6FF2E]">
            </div>
            <div>
                <label class="block text-[10px] text-[#777E90] mb-1">PHÂN CÔNG (tuỳ chọn)</label>
                <select id="check-assignee-input" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-xs focus:outline-none">
                    <option value="">-- Không phân công --</option>
                    ${personnelOpts.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
                </select>
            </div>
            <div class="flex justify-end gap-2">
                <button id="check-cancel" class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945]">Hủy</button>
                <button id="check-ok" class="px-4 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90">Thêm</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('check-text-input').focus();
    document.getElementById('check-cancel').onclick = () => overlay.remove();
    document.getElementById('check-ok').onclick = () => {
        const text = document.getElementById('check-text-input').value.trim();
        if (!text) { showNotification('Vui lòng nhập nội dung bước!', 'error'); return; }
        const assignee = document.getElementById('check-assignee-input').value;
        item.checklist.push({ id: 'C' + Date.now(), text, done: false, assignee, pushedToTask: false, taskId: null });
        item.updatedAt = new Date().toISOString();
        overlay.remove();
        saveToLocalStorage();
        syncStateToCSV();
        renderInitiatives();
    };
}

function toggleInitiativeCheck(initiativeId, checkId) {
    const item = state.initiatives.find(i => i.id === initiativeId);
    if (!item) return;
    const c = item.checklist.find(c => c.id === checkId);
    if (c) { c.done = !c.done; item.updatedAt = new Date().toISOString(); }
    saveToLocalStorage();
    syncStateToCSV();
    renderInitiatives();
}

function deleteInitiativeCheck(initiativeId, checkId) {
    const item = state.initiatives.find(i => i.id === initiativeId);
    if (!item) return;
    item.checklist = item.checklist.filter(c => c.id !== checkId);
    item.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    syncStateToCSV();
    renderInitiatives();
}

// --- Đẩy bước checklist sang tab Công Việc ---
function pushInitiativeCheckToTask(initiativeId, checkId) {
    const item = state.initiatives.find(i => i.id === initiativeId);
    if (!item) return;
    const c = item.checklist.find(c => c.id === checkId);
    if (!c) return;

    const newTask = {
        id: 'T' + Date.now(),
        title: '[' + (item.code || 'SK') + '] ' + c.text,
        desc: 'Từ sáng kiến: ' + item.title,
        areaType: 'unit',
        areaValue: item.department || '',
        areaWorkshop: '',
        areaPerson: c.assignee || '',
        relation: c.assignee ? 'delegate' : 'my-task',
        personName: c.assignee || '',
        status: 'Todo',
        priority: 'Q2',
        startdate: '',
        deadline: '',
        gtask: false,
        createdAt: new Date().toISOString(),
        objective: '',
        expectedResult: '',
        category: 'Sáng kiến',
        tags: [item.type, item.code].filter(Boolean),
        plan: null,
        googleTaskId: null
    };

    state.tasks.unshift(newTask);
    c.pushedToTask = true;
    c.taskId = newTask.id;
    if (!item.linkedTaskIds) item.linkedTaskIds = [];
    item.linkedTaskIds.push(newTask.id);
    item.updatedAt = new Date().toISOString();

    saveToLocalStorage();
    syncStateToCSV();
    renderInitiatives();
    showNotification('✅ Đã đẩy sang tab Công Việc: "' + newTask.title + '"', 'success');
}

// =============================================================
// AI TƯ VẤN SÁNG KIẾN
// =============================================================

function openInitiativeAI(id) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;

    if (!state.geminiKey) {
        showNotification('Chưa có Gemini API Key. Vào Cấu Hình → Kết Nối API để nhập Key.', 'error');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.id = 'initiative-ai-overlay';
    overlay.innerHTML = `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div class="flex justify-between items-center px-5 py-3.5 bg-[#111827] border-b border-[#353945] flex-shrink-0">
                <h4 class="font-bold text-sm text-[#F4F5F6]">✨ AI Tư Vấn — ${item.code}: ${item.title || ''}</h4>
                <button onclick="document.getElementById('initiative-ai-overlay').remove()" class="text-[#777E90] hover:text-rose-400 text-xl px-2">✕</button>
            </div>
            <div class="overflow-y-auto p-5 space-y-4 flex-1 text-xs">
                <div id="ai-initiative-loading" class="flex flex-col items-center justify-center py-12 space-y-3">
                    <div class="w-10 h-10 border-4 border-[#353945] border-t-[#B6FF2E] rounded-full animate-spin"></div>
                    <p class="text-xs font-mono text-[#B6FF2E] animate-pulse">Gemini đang phân tích sáng kiến...</p>
                </div>
                <div id="ai-initiative-result" class="hidden space-y-4"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    _runInitiativeAI(item);
}

async function _runInitiativeAI(item) {
    const typeDef = INITIATIVE_TYPES[item.type] || INITIATIVE_TYPES.kaizen;
    const prompt = `Tôi có một sáng kiến cải tiến tại nhà máy sản xuất:
- Mã: ${item.code}
- Loại: ${typeDef.label}
- Tiêu đề: ${item.title || '(chưa có)'}
- Mô tả vấn đề: ${item.problemDesc || '(chưa có)'}
- Giải pháp đề xuất: ${item.solution || '(chưa có)'}
- Bộ phận: ${item.department || '(chưa có)'}

Hãy tư vấn chi tiết cho sáng kiến này theo đúng cấu trúc JSON sau (CHỈ trả về JSON, không giải thích thêm):
{
  "problem_analysis": ["phân tích vấn đề 1", "phân tích vấn đề 2", "..."],
  "solution_details": ["chi tiết giải pháp 1", "chi tiết giải pháp 2", "..."],
  "action_steps": ["bước thực hiện 1", "bước thực hiện 2", "..."],
  "invest_items": [{"label": "tên mục chi phí", "note": "ghi chú ước tính"}, ...],
  "benefit_items": [{"label": "tên mục lợi ích", "note": "ghi chú ước tính"}, ...],
  "risks": ["rủi ro 1", "rủi ro 2", "..."],
  "success_metrics": ["chỉ số đo lường 1", "chỉ số đo lường 2", "..."]
}
Lưu ý: invest_items và benefit_items chỉ cần điền nếu loại sáng kiến có thể tính hiệu quả tài chính. Nếu là An toàn/Quy trình thuần túy thì có thể để mảng rỗng [].`;

    try {
        const raw = await fetchGeminiText(prompt,
            'Bạn là chuyên gia tư vấn cải tiến sản xuất (Lean/Kaizen/TPM). CHỈ trả về JSON hợp lệ, không dùng markdown, không giải thích thêm.');

        let json;
        try {
            let text = raw.trim();
            const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (fence) text = fence[1].trim();
            const f = text.indexOf('{'), l = text.lastIndexOf('}');
            if (f !== -1 && l !== -1) text = text.substring(f, l + 1);
            json = JSON.parse(text);
        } catch (e) {
            throw new Error('Không parse được JSON từ Gemini.');
        }

        _renderInitiativeAIResult(json, item);
    } catch (e) {
        const loading = document.getElementById('ai-initiative-loading');
        if (loading) loading.innerHTML = `<p class="text-rose-400 text-xs text-center">⚠ ${e.message}</p>`;
    }
}

function _renderInitiativeAIResult(json, item) {
    const loading = document.getElementById('ai-initiative-loading');
    const result = document.getElementById('ai-initiative-result');
    if (!loading || !result) return;
    loading.classList.add('hidden');
    result.classList.remove('hidden');

    const asArr = v => Array.isArray(v) ? v : [];

    const sections = [
        { key: 'problem_analysis', label: '🔍 Phân tích vấn đề', color: 'text-rose-400', items: asArr(json.problem_analysis) },
        { key: 'solution_details', label: '💡 Chi tiết giải pháp', color: 'text-blue-400', items: asArr(json.solution_details) },
        { key: 'action_steps', label: '🪜 Các bước thực hiện', color: 'text-[#B6FF2E]', canAdd: true, addTarget: 'checklist', items: asArr(json.action_steps) },
        { key: 'risks', label: '⚠️ Rủi ro cần lưu ý', color: 'text-amber-400', items: asArr(json.risks) },
        { key: 'success_metrics', label: '🎯 Chỉ số đo lường', color: 'text-purple-400', items: asArr(json.success_metrics) },
    ];

    const investItems = asArr(json.invest_items);
    const benefitItems = asArr(json.benefit_items);

    result.innerHTML = sections.filter(s => s.items.length > 0).map(s => `
        <div class="bg-[#23262F] rounded-xl p-3 border border-[#353945] space-y-2">
            <p class="text-[10px] font-bold font-mono ${s.color}">${s.label}</p>
            <div class="space-y-1.5">
                ${s.items.map((text, idx) => `
                    <div class="flex items-start gap-2">
                        <input type="checkbox" id="ai-chk-${s.key}-${idx}" data-text="${text.replace(/"/g,'&quot;')}" data-target="${s.addTarget || ''}" class="mt-0.5 w-3.5 h-3.5 rounded accent-[#B6FF2E] flex-shrink-0 cursor-pointer">
                        <label for="ai-chk-${s.key}-${idx}" class="text-[11px] text-[#F4F5F6] cursor-pointer leading-relaxed">${text}</label>
                    </div>`).join('')}
            </div>
        </div>
    `).join('') + (investItems.length > 0 || benefitItems.length > 0 ? `
        <div class="bg-[#23262F] rounded-xl p-3 border border-amber-500/20 space-y-2">
            <p class="text-[10px] font-bold font-mono text-amber-400">💰 Gợi ý mục tài chính (tick để thêm vào phần Tài Chính)</p>
            ${investItems.length > 0 ? `
            <p class="text-[10px] text-rose-400 font-semibold">Chi phí đầu tư:</p>
            ${investItems.map((r, idx) => `
                <div class="flex items-start gap-2">
                    <input type="checkbox" id="ai-chk-invest-${idx}" data-label="${(r.label||'').replace(/"/g,'&quot;')}" data-bd="invest" class="mt-0.5 w-3.5 h-3.5 rounded accent-[#B6FF2E] flex-shrink-0 cursor-pointer">
                    <label for="ai-chk-invest-${idx}" class="text-[11px] text-[#F4F5F6] cursor-pointer">${r.label} <span class="text-[#777E90]">${r.note ? '— ' + r.note : ''}</span></label>
                </div>`).join('')}` : ''}
            ${benefitItems.length > 0 ? `
            <p class="text-[10px] text-emerald-400 font-semibold mt-1">Lợi ích/tháng:</p>
            ${benefitItems.map((r, idx) => `
                <div class="flex items-start gap-2">
                    <input type="checkbox" id="ai-chk-benefit-${idx}" data-label="${(r.label||'').replace(/"/g,'&quot;')}" data-bd="benefit" class="mt-0.5 w-3.5 h-3.5 rounded accent-[#B6FF2E] flex-shrink-0 cursor-pointer">
                    <label for="ai-chk-benefit-${idx}" class="text-[11px] text-[#F4F5F6] cursor-pointer">${r.label} <span class="text-[#777E90]">${r.note ? '— ' + r.note : ''}</span></label>
                </div>`).join('')}` : ''}
        </div>` : '') + `
        <div class="flex justify-end gap-2 pt-2 border-t border-[#353945]">
            <button onclick="applyInitiativeAISuggestions('${item.id}')" class="px-4 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90">✅ Áp dụng mục đã tick</button>
        </div>
    `;
}

function applyInitiativeAISuggestions(id) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;

    let addedChecklist = 0, addedBD = 0;

    // Thêm vào checklist (action_steps được tick)
    document.querySelectorAll('input[data-target="checklist"]:checked').forEach(cb => {
        const text = cb.dataset.text;
        if (!text) return;
        item.checklist.push({ id: 'C' + Date.now() + Math.random().toString(36).substr(2,3), text, done: false, assignee: '', pushedToTask: false, taskId: null });
        addedChecklist++;
    });

    // Thêm vào breakdown tài chính
    document.querySelectorAll('input[data-bd]:checked').forEach(cb => {
        const bdType = cb.dataset.bd;
        const label = cb.dataset.label;
        if (!label) return;
        if (!item.financial[bdType + 'Breakdown']) item.financial[bdType + 'Breakdown'] = [];
        item.financial[bdType + 'Breakdown'].push({ id: bdType.slice(0,3) + '_' + Date.now() + Math.random().toString(36).substr(2,3), label, amount: 0 });
        if (bdType === 'invest' || bdType === 'benefit') item.hasFinancial = true;
        addedBD++;
    });

    item.updatedAt = new Date().toISOString();
    document.getElementById('initiative-ai-overlay')?.remove();
    saveToLocalStorage();
    syncStateToCSV();
    renderInitiatives();
    showNotification(`✅ Đã áp dụng ${addedChecklist} bước checklist, ${addedBD} mục tài chính!`, 'success');
}

// =============================================================
// IN PHIẾU HTML
// =============================================================

function printInitiative(id) {
    const item = state.initiatives.find(i => i.id === id);
    if (!item) return;

    const typeDef = INITIATIVE_TYPES[item.type] || INITIATIVE_TYPES.kaizen;
    const statusDef = INITIATIVE_STATUSES[item.status] || INITIATIVE_STATUSES.draft;
    const fin = item.hasFinancial ? calcFinancial(item.financial) : null;
    const checkDone = (item.checklist || []).filter(c => c.done).length;
    const checkTotal = (item.checklist || []).length;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu Sáng Kiến — ${item.code}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #111; background: #fff; padding: 20mm; }
  h1 { text-align: center; font-size: 16pt; text-transform: uppercase; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 11pt; color: #555; margin-bottom: 20px; }
  .code-badge { text-align: center; font-size: 10pt; font-family: monospace; background: #f0f0f0; border: 1px solid #ccc; display: inline-block; padding: 4px 12px; border-radius: 4px; margin-bottom: 20px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; border-bottom: 1.5px solid #333; padding-bottom: 3px; margin-bottom: 8px; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; width: 35%; }
  .money { font-family: monospace; text-align: right; }
  .total-row td { font-weight: bold; background: #f9f9f9; }
  .highlight { background: #fffde7; }
  .checklist { list-style: none; }
  .checklist li { padding: 4px 0; border-bottom: 1px dashed #ddd; display: flex; gap: 8px; }
  .check-box { width: 14px; height: 14px; border: 1.5px solid #333; display: inline-block; flex-shrink: 0; margin-top: 2px; }
  .check-box.done { background: #222; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; text-align: center; }
  .signature-box { border: 1px solid #ccc; border-radius: 6px; padding: 10px; min-height: 100px; display: flex; flex-direction: column; justify-content: space-between; }
  .sig-label { font-size: 10pt; font-weight: bold; margin-bottom: 60px; }
  .sig-name { font-size: 10pt; color: #555; font-style: italic; }
  @media print { body { padding: 15mm; } }
</style>
</head>
<body>
  <h1>Phiếu Đề Xuất Sáng Kiến / Cải Tiến</h1>
  <p class="subtitle">${typeDef.label}</p>
  <div style="text-align:center"><span class="code-badge">${item.code}</span></div>

  <div class="section">
    <div class="section-title">I. Thông tin chung</div>
    <table>
      <tr><th>Tiêu đề sáng kiến</th><td colspan="3"><strong>${item.title || ''}</strong></td></tr>
      <tr><th>Người đề xuất</th><td>${item.proposer || ''}</td><th>Bộ phận</th><td>${item.department || ''}</td></tr>
      <tr><th>Ngày đề xuất</th><td>${item.proposedDate || ''}</td><th>Trạng thái</th><td>${statusDef.label}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">II. Nội dung</div>
    <table>
      <tr><th>Mô tả vấn đề / hiện trạng</th><td style="white-space:pre-wrap">${item.problemDesc || ''}</td></tr>
      <tr><th>Giải pháp đề xuất</th><td style="white-space:pre-wrap">${item.solution || ''}</td></tr>
    </table>
  </div>

  ${fin ? `
  <div class="section">
    <div class="section-title">III. Tài chính & Hiệu quả kinh tế</div>
    <table>
      <tr><th colspan="2" style="background:#fff3e0">CHI PHÍ ĐẦU TƯ</th><th colspan="2" style="background:#e8f5e9">LỢI ÍCH HÀNG THÁNG</th></tr>
      ${Math.max((item.financial.investBreakdown||[]).length,(item.financial.benefitBreakdown||[]).length) > 0 ?
        Array.from({length: Math.max((item.financial.investBreakdown||[]).length,(item.financial.benefitBreakdown||[]).length)}, (_,i) => {
            const inv = (item.financial.investBreakdown||[])[i];
            const ben = (item.financial.benefitBreakdown||[])[i];
            return `<tr>
                <td>${inv ? inv.label : ''}</td><td class="money">${inv ? fmtMoney(inv.amount) : ''}</td>
                <td>${ben ? ben.label : ''}</td><td class="money">${ben ? fmtMoney(ben.amount) : ''}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">Chưa có dữ liệu</td></tr>'}
      <tr class="total-row">
        <td>Tổng đầu tư</td><td class="money">${fmtMoney(fin.invest)}</td>
        <td>Tổng lợi ích/tháng</td><td class="money">${fmtMoney(fin.monthly)}</td>
      </tr>
    </table>
    <table style="margin-top:8px">
      <tr class="highlight">
        <th>Thời gian hoàn vốn</th><td class="money">${fmtPayback(fin.payback)}</td>
        <th>Lợi ích/năm</th><td class="money">${fmtMoney(fin.yearly)}</td>
        <th>ROI năm đầu</th><td class="money">${fmtROI(fin.roi)}</td>
      </tr>
    </table>
  </div>` : ''}

  ${item.checklist && item.checklist.length > 0 ? `
  <div class="section">
    <div class="section-title">${fin ? 'IV' : 'III'}. Các bước triển khai (${checkDone}/${checkTotal})</div>
    <ul class="checklist">
      ${item.checklist.map((c, i) => `
        <li>
          <span class="check-box ${c.done ? 'done' : ''}"></span>
          <span>${i+1}. ${c.text}${c.assignee ? ' <em style="color:#666">— ' + c.assignee + '</em>' : ''}</span>
        </li>`).join('')}
    </ul>
  </div>` : ''}

  ${item.actualResult || item.actualBenefit ? `
  <div class="section">
    <div class="section-title">Kết quả thực tế</div>
    <table>
      ${item.actualResult ? `<tr><th>Kết quả</th><td style="white-space:pre-wrap">${item.actualResult}</td></tr>` : ''}
      ${item.actualBenefit ? `<tr><th>Lợi ích thực tế</th><td>${fmtMoney(item.actualBenefit)}/tháng</td></tr>` : ''}
    </table>
  </div>` : ''}

  <div class="signature-row">
    <div class="signature-box">
      <div class="sig-label">Người đề xuất</div>
      <div class="sig-name">${item.proposer || '................................'}</div>
    </div>
    <div class="signature-box">
      <div class="sig-label">Trưởng bộ phận</div>
      <div class="sig-name">................................</div>
    </div>
    <div class="signature-box">
      <div class="sig-label">Người phê duyệt</div>
      <div class="sig-name">${item.approved && item.approvedNote ? item.approvedNote : '................................'}</div>
    </div>
  </div>
  ${item.approved ? `<p style="text-align:center;margin-top:12px;color:#2e7d32;font-size:11pt">✅ Đã phê duyệt ngày ${item.approvedDate || ''}</p>` : ''}

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
}
