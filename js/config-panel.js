// =============================================================
// CONFIG PANEL — Tab "Thêm Mới" trong Cấu Hình
// Gộp: Nhà máy, Phòng ban, Đối tác, Xưởng, Nhân sự, Liên hệ đối tác
// Layout 2 cột: Form bên trái | Danh mục + tag lọc bên phải
// =============================================================

// Trạng thái lọc hiện tại
let cfgActiveTag = 'all'; // 'all' | 'factory:ID' | 'workshop:ID' | 'dept:ID' | 'team:ID' | 'partner:ID' | 'partners'

// =============================================================
// RENDER TOÀN BỘ PANEL
// =============================================================

function renderAddNewPanel() {
    renderAddNewTags();
    renderAddNewDirectory();
    syncAddNewFormScope();
}

// =============================================================
// TAGS LỌC
// =============================================================

function renderAddNewTags() {
    const container = document.getElementById('addnew-tags-container');
    if (!container) return;

    const tags = [];

    // Tag "Tất cả"
    tags.push({ id: 'all', label: '🌐 Tất cả', color: '' });

    // Nhà máy + Xưởng
    (state.config.factories || []).forEach(f => {
        tags.push({ id: 'factory:' + f.id, label: '🏭 ' + f.name, color: 'blue' });
        (f.workshops || []).forEach(ws => {
            tags.push({ id: 'workshop:' + f.id + ':' + ws.id, label: '🏗️ ' + ws.name, color: 'sky', indent: true });
        });
    });

    // Phòng ban
    (state.config.departments || []).forEach(d => {
        tags.push({ id: 'dept:' + d.id, label: '🏢 ' + d.name, color: 'purple' });
    });

    // Tổ chuyên trách
    (state.config.specialTeams || []).forEach(t => {
        tags.push({ id: 'team:' + t.id, label: '🛠️ ' + t.name, color: 'amber' });
    });

    // Đối tác (nhóm chung + từng đối tác)
    if ((state.config.partners || []).length > 0) {
        tags.push({ id: 'partners', label: '🤝 Đối tác', color: 'emerald' });
        (state.config.partners || []).forEach(p => {
            tags.push({ id: 'partner:' + p.id, label: '  └ ' + p.name, color: 'emerald', indent: true });
        });
    }

    const colorMap = {
        blue:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
        sky:     'bg-sky-500/10 text-sky-400 border-sky-500/30',
        purple:  'bg-purple-500/10 text-purple-400 border-purple-500/30',
        amber:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        '':      'bg-[#353945] text-[#F4F5F6] border-[#353945]',
    };
    const activeClass  = 'ring-2 ring-[#B6FF2E] font-bold';
    const inactiveClass = 'hover:border-[#B6FF2E]/40';

    container.innerHTML = tags.map(tag => {
        const base = colorMap[tag.color || ''];
        const isActive = cfgActiveTag === tag.id;
        const pl = tag.indent ? 'pl-3' : '';
        return `<button
            onclick="setCfgTag('${tag.id}')"
            class="text-[10px] px-2.5 py-1 rounded-full border font-mono transition ${base} ${pl} ${isActive ? activeClass : inactiveClass}">
            ${tag.label}
        </button>`;
    }).join('');
}

function setCfgTag(tagId) {
    cfgActiveTag = tagId;
    renderAddNewTags();
    renderAddNewDirectory();
}

// =============================================================
// DANH MỤC BÊN PHẢI
// =============================================================

function renderAddNewDirectory() {
    const container = document.getElementById('addnew-directory-container');
    if (!container) return;

    const tag = cfgActiveTag;
    let sections = [];

    if (tag === 'all') {
        // Hiện tất cả
        (state.config.factories || []).forEach(f => {
            const members = f.members || [];
            sections.push({ title: '🏭 ' + f.name, kind: 'factory', id: f.id, members, wsId: null, facId: f.id, isUnit: true });
            (f.workshops || []).forEach(ws => {
                sections.push({ title: '🏗️ ' + ws.name + ' (' + f.name + ')', kind: 'workshop', id: ws.id, members: ws.members || [], wsId: ws.id, facId: f.id, isUnit: false });
            });
        });
        (state.config.departments || []).forEach(d => {
            sections.push({ title: '🏢 ' + d.name, kind: 'dept', id: d.id, members: d.members || [], isUnit: true });
        });
        (state.config.specialTeams || []).forEach(t => {
            sections.push({ title: '🛠️ ' + t.name, kind: 'team', id: t.id, members: t.members || [], isUnit: true });
        });
        (state.config.partners || []).forEach(p => {
            sections.push({ title: '🤝 ' + p.name, kind: 'partner', id: p.id, members: p.members || [], partner: p, isUnit: true });
        });

    } else if (tag.startsWith('factory:')) {
        const facId = tag.replace('factory:', '');
        const fac = (state.config.factories || []).find(f => f.id === facId);
        if (fac) {
            sections.push({ title: '🏭 ' + fac.name, kind: 'factory', id: fac.id, members: fac.members || [], facId: fac.id, isUnit: true });
            (fac.workshops || []).forEach(ws => {
                sections.push({ title: '🏗️ ' + ws.name, kind: 'workshop', id: ws.id, members: ws.members || [], wsId: ws.id, facId: fac.id, isUnit: false });
            });
        }

    } else if (tag.startsWith('workshop:')) {
        const parts = tag.replace('workshop:', '').split(':');
        const facId = parts[0], wsId = parts[1];
        const fac = (state.config.factories || []).find(f => f.id === facId);
        const ws = fac && (fac.workshops || []).find(w => w.id === wsId);
        if (ws) {
            sections.push({ title: '🏗️ ' + ws.name + ' — ' + fac.name, kind: 'workshop', id: ws.id, members: ws.members || [], wsId: ws.id, facId: facId, isUnit: false });
        }

    } else if (tag.startsWith('dept:')) {
        const deptId = tag.replace('dept:', '');
        const dept = (state.config.departments || []).find(d => d.id === deptId);
        if (dept) sections.push({ title: '🏢 ' + dept.name, kind: 'dept', id: dept.id, members: dept.members || [], isUnit: true });

    } else if (tag.startsWith('team:')) {
        const teamId = tag.replace('team:', '');
        const team = (state.config.specialTeams || []).find(t => t.id === teamId);
        if (team) sections.push({ title: '🛠️ ' + team.name, kind: 'team', id: team.id, members: team.members || [], isUnit: true });

    } else if (tag === 'partners') {
        (state.config.partners || []).forEach(p => {
            sections.push({ title: '🤝 ' + p.name, kind: 'partner', id: p.id, members: p.members || [], partner: p, isUnit: true });
        });

    } else if (tag.startsWith('partner:')) {
        const partnerId = tag.replace('partner:', '');
        const p = (state.config.partners || []).find(p => p.id === partnerId);
        if (p) sections.push({ title: '🤝 ' + p.name, kind: 'partner', id: p.id, members: p.members || [], partner: p, isUnit: true });
    }

    if (sections.length === 0) {
        container.innerHTML = `<div class="text-center text-[#777E90] text-xs py-8">Chưa có dữ liệu. Thêm mới ở form bên trái!</div>`;
        return;
    }

    container.innerHTML = sections.map(sec => renderDirectorySection(sec)).join('');
}

function renderDirectorySection(sec) {
    const { title, kind, id, members, partner, facId, wsId, isUnit } = sec;
    const memberCount = (members || []).length;

    // Header đơn vị + nút xóa đơn vị
    const deleteUnitBtn = isUnit ? `
        <button onclick="deleteUnitFromDirectory('${kind}','${id}','${facId||''}','${wsId||''}')"
            class="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 whitespace-nowrap">
            🗑️ Xóa
        </button>` : '';

    // Nút thêm xưởng (chỉ cho factory)
    const addWsBtn = kind === 'factory' ? `
        <button onclick="quickAddWorkshop('${id}')"
            class="text-[9px] px-1.5 py-0.5 rounded bg-[#23262F] border border-[#353945] text-[#777E90] hover:text-[#B6FF2E] hover:border-[#B6FF2E]/30 whitespace-nowrap">
            + Xưởng
        </button>` : '';

    // Nút thêm nhân sự nhanh
    const addMemberBtn = `
        <button onclick="quickFocusAddMember('${kind}','${id}','${facId||''}','${wsId||''}')"
            class="text-[9px] px-1.5 py-0.5 rounded bg-[#B6FF2E]/10 border border-[#B6FF2E]/30 text-[#B6FF2E] hover:bg-[#B6FF2E]/20 whitespace-nowrap">
            + Nhân sự
        </button>`;

    // Thẻ nhân sự
    const memberCards = memberCount > 0
        ? (members || []).map(m => renderMemberDirectoryCard(m, kind, id, facId, wsId)).join('')
        : `<div class="text-[11px] text-[#777E90] italic text-center py-3">Chưa có nhân sự</div>`;

    // Phần đặc biệt của đối tác
    let partnerExtra = '';
    if (kind === 'partner' && partner) {
        const cats = (partner.categories || []).join(', ') || 'Chưa phân loại';
        const rating = partner.rating || 0;
        const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
        partnerExtra = `
            <div class="flex flex-wrap gap-2 text-[10px] text-[#777E90] mb-2">
                <span>📁 ${cats}</span>
                ${rating > 0 ? `<span class="text-amber-400">${stars}</span>` : ''}
                ${partner.ratingComment ? `<span class="italic">${partner.ratingComment}</span>` : ''}
            </div>`;
    }

    return `
        <div class="bg-[#14161C] border border-[#353945] rounded-2xl overflow-hidden mb-3">
            <div class="flex items-center justify-between px-4 py-2.5 bg-[#111827] border-b border-[#353945] gap-2 flex-wrap">
                <span class="font-bold text-xs text-[#F4F5F6]">${title}</span>
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[10px] text-[#777E90]">${memberCount} người</span>
                    ${addWsBtn}
                    ${addMemberBtn}
                    ${deleteUnitBtn}
                </div>
            </div>
            <div class="p-3">
                ${partnerExtra}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${memberCards}
                </div>
            </div>
        </div>`;
}

function renderMemberDirectoryCard(m, kind, unitId, facId, wsId) {
    const phone = normalizePhone(m.phone);
    const deleteRef = JSON.stringify({ kind, unitId, facId: facId||null, wsId: wsId||null, memberId: m.id });
    return `
        <div class="bg-[#23262F] border border-[#353945] rounded-xl p-3 space-y-1">
            <div class="flex items-center justify-between gap-2">
                <h5 class="font-bold text-xs text-[#F4F5F6] truncate">${m.name}</h5>
                <button onclick='deleteMemberFromDirectory(${deleteRef})'
                    class="text-[#777E90] hover:text-rose-400 text-[10px] px-1.5 py-0.5 bg-[#14161C] rounded-lg border border-[#353945] flex-shrink-0">
                    Xóa
                </button>
            </div>
            ${m.role ? `<p class="text-[10px] text-[#B6FF2E]">${m.role}</p>` : ''}
            <div class="text-[10px] text-[#777E90] space-y-0.5">
                ${phone ? `<p>📞 ${phone}</p>` : ''}
                ${m.email ? `<p>✉️ ${m.email}</p>` : ''}
                ${(!phone && !m.email) ? '<p class="italic">Chưa có SĐT/Email</p>' : ''}
            </div>
        </div>`;
}

// =============================================================
// FORM BÊN TRÁI
// =============================================================

// Đồng bộ form khi scope thay đổi
function syncAddNewFormScope() {
    const scope = document.getElementById('addnew-scope-input')?.value || 'factory';

    // Các wrapper
    const wrappers = ['addnew-parent-factory-wrap', 'addnew-parent-ws-factory-wrap',
        'addnew-parent-dept-wrap', 'addnew-parent-partner-wrap',
        'addnew-person-fields'];
    wrappers.forEach(id => document.getElementById(id)?.classList.add('hidden'));

    const titleEl = document.getElementById('addnew-name-label');
    const nameInput = document.getElementById('addnew-name-input');

    switch(scope) {
        case 'factory':
            if (titleEl) titleEl.textContent = 'Tên nhà máy *';
            if (nameInput) nameInput.placeholder = 'VD: Nhà máy MDF số 1';
            break;

        case 'workshop':
            if (titleEl) titleEl.textContent = 'Tên xưởng *';
            if (nameInput) nameInput.placeholder = 'VD: Xưởng Băm Dăm';
            document.getElementById('addnew-parent-factory-wrap')?.classList.remove('hidden');
            _populateAddNewSelect('addnew-parent-factory-select',
                (state.config.factories || []).map(f => ({ value: f.id, label: f.name })),
                'Chọn nhà máy');
            break;

        case 'dept':
            if (titleEl) titleEl.textContent = 'Tên phòng ban *';
            if (nameInput) nameInput.placeholder = 'VD: Phòng Kế Toán';
            break;

        case 'team':
            if (titleEl) titleEl.textContent = 'Tên tổ chuyên trách *';
            if (nameInput) nameInput.placeholder = 'VD: Tổ Cơ Điện';
            break;

        case 'partner':
            if (titleEl) titleEl.textContent = 'Tên đối tác *';
            if (nameInput) nameInput.placeholder = 'VD: Công ty AET';
            document.getElementById('addnew-parent-partner-wrap')?.classList.remove('hidden');
            break;

        case 'member_factory':
            if (titleEl) titleEl.textContent = 'Họ tên *';
            if (nameInput) nameInput.placeholder = 'Nhập họ tên...';
            document.getElementById('addnew-parent-factory-wrap')?.classList.remove('hidden');
            document.getElementById('addnew-person-fields')?.classList.remove('hidden');
            _populateAddNewSelect('addnew-parent-factory-select',
                (state.config.factories || []).map(f => ({ value: f.id, label: '🏭 ' + f.name })),
                'Chọn nhà máy');
            break;

        case 'member_workshop':
            if (titleEl) titleEl.textContent = 'Họ tên *';
            if (nameInput) nameInput.placeholder = 'Nhập họ tên...';
            document.getElementById('addnew-parent-ws-factory-wrap')?.classList.remove('hidden');
            document.getElementById('addnew-person-fields')?.classList.remove('hidden');
            _populateAddNewSelect('addnew-parent-ws-factory-select',
                (state.config.factories || []).map(f => ({ value: f.id, label: '🏭 ' + f.name })),
                'Chọn nhà máy');
            onAddNewWsFactoryChange();
            break;

        case 'member_dept':
            if (titleEl) titleEl.textContent = 'Họ tên *';
            if (nameInput) nameInput.placeholder = 'Nhập họ tên...';
            document.getElementById('addnew-parent-dept-wrap')?.classList.remove('hidden');
            document.getElementById('addnew-person-fields')?.classList.remove('hidden');
            _populateAddNewSelect('addnew-parent-dept-select',
                [
                    ...(state.config.departments || []).map(d => ({ value: 'dept:' + d.id, label: '🏢 ' + d.name })),
                    ...(state.config.specialTeams || []).map(t => ({ value: 'team:' + t.id, label: '🛠️ ' + t.name })),
                ],
                'Chọn phòng ban / tổ');
            break;

        case 'member_partner':
            if (titleEl) titleEl.textContent = 'Họ tên *';
            if (nameInput) nameInput.placeholder = 'Nhập họ tên...';
            document.getElementById('addnew-parent-partner-wrap')?.classList.remove('hidden');
            document.getElementById('addnew-person-fields')?.classList.remove('hidden');
            _populateAddNewSelect('addnew-parent-partner-select',
                (state.config.partners || []).map(p => ({ value: p.id, label: '🤝 ' + p.name })),
                'Chọn đối tác');
            break;
    }
}

function _populateAddNewSelect(selectId, options, placeholder) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = options.length > 0
        ? options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')
        : `<option value="">-- Chưa có dữ liệu --</option>`;
    if (current && options.some(o => o.value === current)) sel.value = current;
}

function onAddNewWsFactoryChange() {
    const facId = document.getElementById('addnew-parent-ws-factory-select')?.value;
    const fac = (state.config.factories || []).find(f => f.id === facId);
    const wsSel = document.getElementById('addnew-parent-ws-select');
    if (!wsSel) return;
    const workshops = fac ? (fac.workshops || []) : [];
    wsSel.innerHTML = workshops.length > 0
        ? workshops.map(w => `<option value="${w.id}">${w.name}</option>`).join('')
        : `<option value="">-- Nhà máy này chưa có xưởng --</option>`;
}

// =============================================================
// LƯU ĐỐI TƯỢNG MỚI
// =============================================================

function saveAddNew() {
    const scope = document.getElementById('addnew-scope-input')?.value;
    const name  = document.getElementById('addnew-name-input')?.value.trim();

    if (!name) return showNotification('Vui lòng nhập tên!', 'error');

    switch(scope) {
        case 'factory':
            state.config.factories.push({ id: 'F' + Date.now(), name, members: [], workshops: [] });
            showNotification('Đã thêm nhà máy!', 'success');
            break;

        case 'workshop': {
            const facId = document.getElementById('addnew-parent-factory-select')?.value;
            const fac = state.config.factories.find(f => f.id === facId);
            if (!fac) return showNotification('Vui lòng chọn nhà máy!', 'error');
            fac.workshops.push({ id: 'WS' + Date.now(), name, members: [] });
            showNotification('Đã thêm xưởng!', 'success');
            break;
        }

        case 'dept':
            state.config.departments.push({ id: 'D' + Date.now(), name, members: [] });
            showNotification('Đã thêm phòng ban!', 'success');
            break;

        case 'team':
            state.config.specialTeams.push({ id: 'TM' + Date.now(), name, members: [] });
            showNotification('Đã thêm tổ chuyên trách!', 'success');
            break;

        case 'partner': {
            const catInput = document.getElementById('addnew-partner-cat-input')?.value.trim();
            const cats = catInput ? catInput.split(',').map(s => s.trim()).filter(Boolean) : ['Chưa phân loại'];
            state.config.partners.push({ id: 'P' + Date.now(), name, categories: cats, members: [], equipment: [], rating: 0, ratingComment: '' });
            showNotification('Đã thêm đối tác!', 'success');
            break;
        }

        case 'member_factory': {
            const facId = document.getElementById('addnew-parent-factory-select')?.value;
            const fac = state.config.factories.find(f => f.id === facId);
            if (!fac) return showNotification('Vui lòng chọn nhà máy!', 'error');
            fac.members.push(_buildMember(name));
            showNotification('Đã thêm nhân sự!', 'success');
            break;
        }

        case 'member_workshop': {
            const facId = document.getElementById('addnew-parent-ws-factory-select')?.value;
            const wsId  = document.getElementById('addnew-parent-ws-select')?.value;
            const fac = state.config.factories.find(f => f.id === facId);
            const ws  = fac && (fac.workshops || []).find(w => w.id === wsId);
            if (!ws) return showNotification('Vui lòng chọn xưởng!', 'error');
            ws.members.push(_buildMember(name));
            showNotification('Đã thêm nhân sự!', 'success');
            break;
        }

        case 'member_dept': {
            const val = document.getElementById('addnew-parent-dept-select')?.value;
            if (!val) return showNotification('Vui lòng chọn phòng ban / tổ!', 'error');
            const [kind, unitId] = val.split(':');
            const list = kind === 'dept' ? state.config.departments : state.config.specialTeams;
            const unit = list.find(u => u.id === unitId);
            if (!unit) return showNotification('Không tìm thấy đơn vị!', 'error');
            unit.members.push(_buildMember(name));
            showNotification('Đã thêm nhân sự!', 'success');
            break;
        }

        case 'member_partner': {
            const partnerId = document.getElementById('addnew-parent-partner-select')?.value;
            const partner = state.config.partners.find(p => p.id === partnerId);
            if (!partner) return showNotification('Vui lòng chọn đối tác!', 'error');
            partner.members.push(_buildMember(name));
            showNotification('Đã thêm nhân sự đối tác!', 'success');
            break;
        }

        default:
            return showNotification('Vui lòng chọn loại đối tượng!', 'error');
    }

    // Reset form
    document.getElementById('addnew-name-input').value = '';
    const roleEl = document.getElementById('addnew-role-input');
    const phoneEl = document.getElementById('addnew-phone-input');
    const emailEl = document.getElementById('addnew-email-input');
    if (roleEl)  roleEl.value  = '';
    if (phoneEl) phoneEl.value = '';
    if (emailEl) emailEl.value = '';

    // Cập nhật UI
    saveToLocalStorage();
    syncStateToCSV();
    renderAddNewPanel();
    renderOrgChartMindmap();
}

function _buildMember(name) {
    return {
        id: 'M' + Date.now(),
        name,
        role:  document.getElementById('addnew-role-input')?.value.trim()  || '',
        phone: document.getElementById('addnew-phone-input')?.value.trim() || '',
        email: document.getElementById('addnew-email-input')?.value.trim() || ''
    };
}

// =============================================================
// XÓA TỪ DANH MỤC
// =============================================================

function deleteUnitFromDirectory(kind, id, facId, wsId) {
    const labels = { factory: 'nhà máy', workshop: 'xưởng', dept: 'phòng ban', team: 'tổ chuyên trách', partner: 'đối tác' };
    const label = labels[kind] || 'đơn vị';

    confirmAction(`Xóa ${label} này? Toàn bộ nhân sự bên trong cũng sẽ bị xóa theo.`, () => {
        switch(kind) {
            case 'factory':
                state.config.factories = state.config.factories.filter(f => f.id !== id);
                break;
            case 'workshop': {
                const fac = state.config.factories.find(f => f.id === facId);
                if (fac) fac.workshops = fac.workshops.filter(w => w.id !== id);
                break;
            }
            case 'dept':
                state.config.departments = state.config.departments.filter(d => d.id !== id);
                break;
            case 'team':
                state.config.specialTeams = state.config.specialTeams.filter(t => t.id !== id);
                break;
            case 'partner':
                state.config.partners = state.config.partners.filter(p => p.id !== id);
                break;
        }
        saveToLocalStorage();
        syncStateToCSV();
        renderAddNewPanel();
        renderOrgChartMindmap();
        showNotification('Đã xóa!', 'success');
        // Reset tag nếu đang lọc theo đơn vị vừa xóa
        if (cfgActiveTag !== 'all') cfgActiveTag = 'all';
    });
}

function deleteMemberFromDirectory(ref) {
    confirmAction('Xóa nhân sự này?', () => {
        const { kind, unitId, facId, wsId, memberId } = ref;
        let arr = null;
        switch(kind) {
            case 'factory': {
                const fac = state.config.factories.find(f => f.id === unitId);
                if (fac) arr = fac.members;
                break;
            }
            case 'workshop': {
                const fac = state.config.factories.find(f => f.id === facId);
                const ws  = fac && fac.workshops.find(w => w.id === unitId);
                if (ws) arr = ws.members;
                break;
            }
            case 'dept': {
                const d = state.config.departments.find(d => d.id === unitId);
                if (d) arr = d.members;
                break;
            }
            case 'team': {
                const t = state.config.specialTeams.find(t => t.id === unitId);
                if (t) arr = t.members;
                break;
            }
            case 'partner': {
                const p = state.config.partners.find(p => p.id === unitId);
                if (p) arr = p.members;
                break;
            }
        }
        if (!arr) return;
        const idx = arr.findIndex(m => m.id === memberId);
        if (idx > -1) arr.splice(idx, 1);
        saveToLocalStorage();
        syncStateToCSV();
        renderAddNewPanel();
        showNotification('Đã xóa nhân sự!', 'success');
    });
}

// =============================================================
// HELPERS
// =============================================================

// Thêm xưởng nhanh từ nút trong danh mục
function quickAddWorkshop(facId) {
    const scopeEl = document.getElementById('addnew-scope-input');
    if (scopeEl) { scopeEl.value = 'workshop'; syncAddNewFormScope(); }
    const facSel = document.getElementById('addnew-parent-factory-select');
    if (facSel) { facSel.value = facId; }
    document.getElementById('addnew-name-input')?.focus();
}

// Focus form thêm nhân sự nhanh từ nút trong danh mục
function quickFocusAddMember(kind, unitId, facId, wsId) {
    let scope = 'member_factory';
    if (kind === 'factory')  scope = 'member_factory';
    if (kind === 'workshop') scope = 'member_workshop';
    if (kind === 'dept')     scope = 'member_dept';
    if (kind === 'team')     scope = 'member_dept';
    if (kind === 'partner')  scope = 'member_partner';

    const scopeEl = document.getElementById('addnew-scope-input');
    if (scopeEl) { scopeEl.value = scope; syncAddNewFormScope(); }

    // Chọn sẵn đơn vị
    setTimeout(() => {
        if (scope === 'member_factory') {
            const sel = document.getElementById('addnew-parent-factory-select');
            if (sel) sel.value = unitId;
        } else if (scope === 'member_workshop') {
            const facSel = document.getElementById('addnew-parent-ws-factory-select');
            if (facSel) { facSel.value = facId; onAddNewWsFactoryChange(); }
            setTimeout(() => {
                const wsSel = document.getElementById('addnew-parent-ws-select');
                if (wsSel) wsSel.value = unitId;
            }, 50);
        } else if (scope === 'member_dept') {
            const sel = document.getElementById('addnew-parent-dept-select');
            const prefix = kind === 'team' ? 'team:' : 'dept:';
            if (sel) sel.value = prefix + unitId;
        } else if (scope === 'member_partner') {
            const sel = document.getElementById('addnew-parent-partner-select');
            if (sel) sel.value = unitId;
        }
        document.getElementById('addnew-name-input')?.focus();
    }, 100);
}
