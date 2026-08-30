        // =============================================================
        // KHU VỰC - chọn 2 bước, dữ liệu lấy từ state.config
        // =============================================================
        // Gộp tất cả các đơn vị có nhân sự (Phòng ban + Tổ đội + Đối tác) làm 1 danh sách để tra cứu
        function getAllUnits(type) {
            if (type === 'unit') {
                const depts = (state.config.departments || []).map(d => ({ ...d, icon: '🏢' }));
                const teams = (state.config.specialTeams || []).map(t => ({ ...t, icon: '🛠️' }));
                return depts.concat(teams);
            } else if (type === 'partner') {
                return (state.config.partners || []).map(p => ({ ...p, icon: p.type === 'Supplier' ? '📦' : '👷' }));
            }
            return [];
        }

        // Gộp toàn bộ nhân sự trong Nhà máy/Xưởng/Phòng ban/Tổ đội/Đối tác thành 1 danh sách phẳng
        // Mỗi phần tử có `ref` để biết chính xác nó thuộc đâu (dùng khi xóa từ danh mục tổng hợp)
        function getAllPersonnel() {
            const list = [];
            (state.config.factories || []).forEach(f => {
                (f.members || []).forEach(m => list.push({ ...m, unit: f.name, unitLabel: '🏭 ' + f.name, ref: { kind: 'factory', facId: f.id } }));
                (f.workshops || []).forEach(ws => (ws.members || []).forEach(m => list.push({ ...m, unit: f.name + ' / ' + ws.name, unitLabel: '🏭 ' + f.name + ' / 🏗️ ' + ws.name, ref: { kind: 'workshop', facId: f.id, wsId: ws.id } })));
            });
            (state.config.departments || []).forEach(d => (d.members || []).forEach(m => list.push({ ...m, unit: d.name, unitLabel: '🏢 ' + d.name, ref: { kind: 'dept', unitId: d.id } })));
            (state.config.specialTeams || []).forEach(t => (t.members || []).forEach(m => list.push({ ...m, unit: t.name, unitLabel: '🛠️ ' + t.name, ref: { kind: 'team', unitId: t.id } })));
            (state.config.partners || []).forEach(p => (p.members || []).forEach(m => list.push({ ...m, unit: p.name, unitLabel: '🤝 ' + p.name, ref: { kind: 'partner', unitId: p.id } })));
            return list;
        }

        function deletePersonnelByRef(ref, memberId) {
            if (ref.kind === 'factory') deleteFactoryMember(ref.facId, memberId);
            else if (ref.kind === 'workshop') deleteWorkshopMember(ref.facId, ref.wsId, memberId);
            else if (ref.kind === 'partner') deletePartnerMember(ref.unitId, memberId);
            else deleteUnitMember(ref.kind, ref.unitId, memberId);
        }

        // Đổi hiển thị form thêm nhân sự tùy theo "Thuộc về" đang chọn
        // Nhảy nhanh từ Sơ Đồ Tổ Chức sang tab Nhân Sự, tự chọn sẵn đúng đơn vị để điền tên vào là xong
        function quickAddPersonnel(scope, facId, wsId, unitId) {
            switchConfigSubTab('personnel');
            const scopeSelect = document.getElementById('personnel-scope-input');
            scopeSelect.value = scope;
            onPersonnelScopeChange();

            if (scope === 'factory' && facId) {
                document.getElementById('personnel-factory-input').value = facId;
            } else if (scope === 'workshop' && facId) {
                document.getElementById('personnel-ws-factory-input').value = facId;
                onPersonnelFactoryChange();
                if (wsId) document.getElementById('personnel-workshop-input').value = wsId;
            } else if (unitId) {
                document.getElementById('personnel-unit-input').value = unitId;
            }

            const nameInput = document.getElementById('personnel-name-input');
            if (nameInput) nameInput.focus();
        }

        function onPersonnelScopeChange() {
            const scope = document.getElementById('personnel-scope-input').value;
            document.getElementById('personnel-factory-wrap').classList.toggle('hidden', scope !== 'factory');
            document.getElementById('personnel-workshop-wrap').classList.toggle('hidden', scope !== 'workshop');
            document.getElementById('personnel-unit-wrap').classList.toggle('hidden', !['dept','team','partner'].includes(scope));

            if (scope === 'factory') {
                const sel = document.getElementById('personnel-factory-input');
                sel.innerHTML = (state.config.factories || []).map(f => `<option value="${f.id}">${f.name}</option>`).join('') || '<option value="">-- Chưa có nhà máy, vào tab Nhà Máy & Xưởng để thêm --</option>';
            } else if (scope === 'workshop') {
                const facSel = document.getElementById('personnel-ws-factory-input');
                facSel.innerHTML = (state.config.factories || []).map(f => `<option value="${f.id}">${f.name}</option>`).join('') || '<option value="">-- Chưa có nhà máy --</option>';
                onPersonnelFactoryChange();
            } else if (['dept','team','partner'].includes(scope)) {
                const sel = document.getElementById('personnel-unit-input');
                const list = scope === 'dept' ? state.config.departments : (scope === 'team' ? state.config.specialTeams : state.config.partners);
                sel.innerHTML = (list || []).map(u => `<option value="${u.id}">${u.name}</option>`).join('') || '<option value="">-- Chưa có đơn vị, vào tab tương ứng để thêm --</option>';
            }
        }

        function onPersonnelFactoryChange() {
            const facId = document.getElementById('personnel-ws-factory-input').value;
            const fac = (state.config.factories || []).find(f => f.id === facId);
            const wsSel = document.getElementById('personnel-workshop-input');
            const items = fac ? (fac.workshops || []) : [];
            wsSel.innerHTML = items.length > 0
                ? items.map(w => `<option value="${w.id}">${w.name}</option>`).join('')
                : '<option value="">-- Nhà máy này chưa có xưởng --</option>';
        }

        // Thêm nhân sự vào đúng đơn vị đã chọn (1 form duy nhất cho mọi loại đơn vị)
        function addPersonnelUnified() {
            const scope = document.getElementById('personnel-scope-input').value;
            const nameInput  = document.getElementById('personnel-name-input');
            const roleInput  = document.getElementById('personnel-role-input');
            const phoneInput = document.getElementById('personnel-phone-input');
            const emailInput = document.getElementById('personnel-email-input');

            const name = nameInput.value.trim();
            if (!name) return showNotification('Vui lòng nhập họ tên!', 'error');

            const member = {
                id: 'M' + Date.now(),
                name,
                role: roleInput.value.trim(),
                phone: phoneInput.value.trim(),
                email: emailInput.value.trim()
            };

            let ok = false;
            if (scope === 'factory') {
                const fac = state.config.factories.find(f => f.id === document.getElementById('personnel-factory-input').value);
                if (fac) { fac.members.push(member); ok = true; }
            } else if (scope === 'workshop') {
                const fac = state.config.factories.find(f => f.id === document.getElementById('personnel-ws-factory-input').value);
                const ws = fac && fac.workshops.find(w => w.id === document.getElementById('personnel-workshop-input').value);
                if (ws) { ws.members.push(member); ok = true; }
            } else {
                const list = scope === 'dept' ? state.config.departments : (scope === 'team' ? state.config.specialTeams : state.config.partners);
                const unit = (list || []).find(u => u.id === document.getElementById('personnel-unit-input').value);
                if (unit) { unit.members.push(member); ok = true; }
            }

            if (!ok) return showNotification('Vui lòng chọn đầy đủ đơn vị (Nhà máy/Xưởng/Phòng ban/Tổ/Đối tác)!', 'error');

            nameInput.value = ''; roleInput.value = ''; phoneInput.value = ''; emailInput.value = '';
            showNotification('Đã thêm nhân sự mới!', 'success');
            renderConfigView();
            syncStateToCSV();
        }

        // Danh mục tổng hợp toàn bộ nhân sự, có lọc theo loại đơn vị
        function renderPersonnelDirectory() {
            const container = document.getElementById('cfg-personnel-list');
            if (!container) return;
            const filterEl = document.getElementById('personnel-filter-input');
            const filter = filterEl ? filterEl.value : 'all';

            let list = getAllPersonnel();
            if (filter !== 'all') {
                list = list.filter(p => filter === 'factory' ? (p.ref.kind === 'factory' || p.ref.kind === 'workshop') : p.ref.kind === filter);
            }

            const countEl = document.getElementById('cfg-personnel-count');
            if (countEl) countEl.innerText = `${list.length} người`;

            if (list.length === 0) {
                container.innerHTML = `
                    <div class="bg-[#14161C] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">
                        👤 Chưa có nhân sự nào phù hợp. Hãy thêm mới ở form bên trái!
                    </div>
                `;
                return;
            }

            container.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${list.map(p => { const ph = normalizePhone(p.phone); return `
                <div class="bg-[#14161C] border border-[#353945] rounded-xl p-3 space-y-1">
                    <div class="flex items-center justify-between">
                        <h5 class="font-bold text-xs text-[#F4F5F6]">${p.name}</h5>
                        <button onclick='deletePersonnelByRef(${JSON.stringify(p.ref)}, "${p.id}")' class="text-rose-400 hover:text-rose-300 text-[10px] px-1.5 py-0.5 bg-[#23262F] rounded-lg border border-[#353945]">Xóa</button>
                    </div>
                    ${p.role ? `<p class="text-[10px] text-[#B6FF2E]">${p.role}</p>` : ''}
                    <p class="text-[10px] text-[#777E90]">${p.unitLabel}</p>
                    <div class="text-[10px] text-[#777E90] space-y-0.5">
                        ${ph ? `<p>📞 ${ph}</p>` : ''}
                        ${p.email ? `<p>✉️ ${p.email}</p>` : ''}
                        ${(!ph && !p.email) ? '<p class="italic">Chưa có SĐT/Email</p>' : ''}
                    </div>
                </div>
            `; }).join('')}</div>`;
        }

        function onAreaTypeChange() {
            const type = document.getElementById('task-area-type-input').value;
            const valueSelect = document.getElementById('task-area-value-input');
            const workshopWrap = document.getElementById('task-area-workshop-wrap');
            const personWrap = document.getElementById('task-area-person-wrap');
            valueSelect.innerHTML = '';
            workshopWrap.classList.add('hidden');
            personWrap.classList.add('hidden');

            let items = [];
            if (type === 'factory') {
                items = (state.config.factories || []).map(f => ({ value: f.name, label: f.name }));
            } else if (type === 'unit' || type === 'partner') {
                items = getAllUnits(type).map(u => ({ value: u.name, label: u.icon + ' ' + u.name }));
            }

            if (items.length === 0) {
                valueSelect.innerHTML = '<option value="">-- Chưa có dữ liệu, vào Cấu Hình thêm --</option>';
            } else {
                valueSelect.innerHTML = items.map(it => `<option value="${it.value}">${it.label}</option>`).join('');
            }
            onAreaValueChange();
        }

        function onAreaValueChange() {
            const type = document.getElementById('task-area-type-input').value;
            const value = document.getElementById('task-area-value-input').value;
            const workshopWrap = document.getElementById('task-area-workshop-wrap');
            const workshopSelect = document.getElementById('task-area-workshop-input');
            const personWrap = document.getElementById('task-area-person-wrap');
            const personSelect = document.getElementById('task-area-person-input');

            workshopWrap.classList.add('hidden');
            personWrap.classList.add('hidden');

            if (type === 'factory' && value) {
                const fac = (state.config.factories || []).find(f => f.name === value);
                if (fac && fac.workshops && fac.workshops.length > 0) {
                    workshopSelect.innerHTML = '<option value="">-- Toàn nhà máy (không chọn xưởng) --</option>'
                        + fac.workshops.map(w => `<option value="${w.name}">${w.name}</option>`).join('');
                    workshopWrap.classList.remove('hidden');
                }
                refreshFactoryPersonOptions(fac);
            } else if ((type === 'unit' || type === 'partner') && value) {
                const unit = getAllUnits(type).find(u => u.name === value);
                if (unit && unit.members && unit.members.length > 0) {
                    personSelect.innerHTML = '<option value="">-- Cả đơn vị (không chọn người cụ thể) --</option>'
                        + unit.members.map(m => `<option value="${m.name}">${m.name}${m.role ? ' — ' + m.role : ''}</option>`).join('');
                    personWrap.classList.remove('hidden');
                }
            }
        }

        // Khi đổi lựa chọn Xưởng (bên trong Nhà máy) thì làm mới danh sách người phụ trách tương ứng
        function onAreaWorkshopChange() {
            const facName = document.getElementById('task-area-value-input').value;
            const fac = (state.config.factories || []).find(f => f.name === facName);
            if (fac) refreshFactoryPersonOptions(fac);
        }

        function refreshFactoryPersonOptions(fac) {
            const personWrap = document.getElementById('task-area-person-wrap');
            const personSelect = document.getElementById('task-area-person-input');
            if (!fac) { personWrap.classList.add('hidden'); return; }

            const wsName = document.getElementById('task-area-workshop-input').value;
            let members = fac.members || [];
            if (wsName) {
                const ws = (fac.workshops || []).find(w => w.name === wsName);
                members = ws ? (ws.members || []) : [];
            }

            if (members.length > 0) {
                personSelect.innerHTML = '<option value="">-- Cả khu vực (không chọn người cụ thể) --</option>'
                    + members.map(m => `<option value="${m.name}">${m.name}${m.role ? ' — ' + m.role : ''}</option>`).join('');
                personWrap.classList.remove('hidden');
            } else {
                personWrap.classList.add('hidden');
            }
        }

        // =============================================================
        // PHÂN QUYỀN - hiện chọn người khi Cấp trên giao / Giao cấp dưới
        // =============================================================
        function onRelationChange() {
            const rel = document.getElementById('task-relation-input').value;
            const wrap = document.getElementById('task-person-wrap');
            const select = document.getElementById('task-person-input');
            const hint = document.getElementById('task-person-hint');

            if (rel === 'my-task') {
                wrap.classList.add('hidden');
                return;
            }
            wrap.classList.remove('hidden');

            const personnel = getAllPersonnel();
            if (personnel.length === 0) {
                select.innerHTML = '<option value="">-- Chưa có ai --</option>';
                hint.classList.remove('hidden');
            } else {
                hint.classList.add('hidden');
                select.innerHTML = '<option value="">-- Chọn người --</option>'
                    + personnel.map(m => `<option value="${m.name}">${m.name}${m.role ? ' — ' + m.role : ''} (${m.unitLabel})</option>`).join('');
            }
        }

        // Gọi khi vào tab Công Việc hoặc khi Cấu Hình cập nhật, để form luôn đồng bộ dữ liệu mới nhất
        function refreshTaskFormOptions() {
            if (document.getElementById('task-area-type-input')) onAreaTypeChange();
            if (document.getElementById('task-relation-input')) onRelationChange();
        }

        function setFormPriority(prio) {
            state.selectedPriority = prio;
            const styles = {
                Q1: 'bg-rose-500/20 text-rose-400 border-rose-500',
                Q2: 'bg-amber-500/20 text-amber-400 border-amber-500',
                Q3: 'bg-blue-500/20 text-blue-400 border-blue-500',
                Q4: 'bg-[#353945] text-[#777E90] border-[#353945]'
            };
            ['Q1','Q2','Q3','Q4'].forEach(p => {
                const btn = document.getElementById('prio-' + p);
                if (!btn) return;
                const base = 'prio-btn py-2 px-1 rounded-lg text-center font-semibold border text-[10px] leading-tight ';
                btn.className = base + (p === prio ? styles[p] : 'bg-[#353945] text-[#777E90] border-[#353945]');
            });
        }

        function filterTasks(type) {
            state.currentTaskFilter = type;
            document.querySelectorAll('.task-tab').forEach(el => {
                el.classList.remove('bg-[#B6FF2E]', 'text-[#14161C]', 'font-semibold');
                el.classList.add('text-[#777E90]', 'hover:text-[#F4F5F6]', 'font-medium');
            });
            const activeTab = document.getElementById(`tab-${type}`);
            if (activeTab) {
                activeTab.classList.add('bg-[#B6FF2E]', 'text-[#14161C]', 'font-semibold');
                activeTab.classList.remove('text-[#777E90]', 'hover:text-[#F4F5F6]', 'font-medium');
            }
            renderTasks();
        }

        // RENDERING UI
        function fmtDate(dateStr) {
            if (!dateStr) return '';
            try {
                const d = new Date(dateStr);
                const dd = String(d.getDate()).padStart(2,'0');
                const mm = String(d.getMonth()+1).padStart(2,'0');
                const yy = String(d.getFullYear()).slice(2);
                return dd + '/' + mm + '/' + yy;
            } catch(e) { return dateStr; }
        }

        function fmtDateTime(isoStr) {
            if (!isoStr) return '';
            try {
                const d = new Date(isoStr);
                const dd = String(d.getDate()).padStart(2,'0');
                const mm = String(d.getMonth()+1).padStart(2,'0');
                const yy = String(d.getFullYear()).slice(2);
                const hh = String(d.getHours()).padStart(2,'0');
                const mi = String(d.getMinutes()).padStart(2,'0');
                return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
            } catch(e) { return isoStr; }
        }

        function getPrioBadge(priority) {
            const map = {
                Q1: '<span class="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold">&#x1F534; Q1 Quan trọng+Gấp</span>',
                Q2: '<span class="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold">&#x1F7E1; Q2 Quan trọng</span>',
                Q3: '<span class="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold">&#x1F535; Q3 Gấp</span>',
                Q4: '<span class="inline-flex items-center gap-1 bg-[#353945] text-[#777E90] border border-[#353945] px-2 py-0.5 rounded text-[10px]">&#x26AA; Q4 Có thể bỏ</span>',
                // backward compat
                High:   '<span class="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold">&#x1F534; Khẩn cấp</span>',
                Medium: '<span class="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">&#x1F7E1; Thường</span>',
                Low:    '<span class="inline-flex items-center gap-1 bg-[#353945] text-[#777E90] border border-[#353945] px-2 py-0.5 rounded text-[10px]">&#x26AA; Thấp</span>',
            };
            return map[priority] || map.Q2;
        }

        function isOverdue(deadlineStr) {
            if (!deadlineStr) return false;
            return new Date(deadlineStr) < new Date(new Date().toDateString());
        }

        function getAreaBadge(task) {
            const icons = { factory: '&#x1F3ED;', unit: '&#x1F3E2;', partner: '&#x1F91D;' };
            const icon = icons[task.areaType] || '&#x1F3ED;';
            let label = task.areaValue || '';
            if (task.areaWorkshop) label += ' / ' + task.areaWorkshop;
            if (task.areaPerson) label += ' — 👤 ' + task.areaPerson;
            if (!label) return '';
            return `<span class="text-[10px] text-[#777E90] bg-[#23262F] border border-[#353945] px-2 py-0.5 rounded inline-flex items-center gap-1">${icon} ${label}</span>`;
        }

        // Bộ lọc Danh mục cho danh sách Công Việc: chọn được nhiều danh mục cùng lúc
        let selectedTaskCategoryFilters = new Set();

        function getAllTaskCategories() {
            const set = new Set();
            state.tasks.forEach(t => { if (t.category) set.add(t.category); });
            return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
        }

        function toggleTaskCategoryFilter(cat) {
            if (selectedTaskCategoryFilters.has(cat)) selectedTaskCategoryFilters.delete(cat);
            else selectedTaskCategoryFilters.add(cat);
            renderTasks();
        }

        function clearTaskCategoryFilters() {
            selectedTaskCategoryFilters.clear();
            renderTasks();
        }

        function renderTaskCategoryFilterChips() {
            const chipContainer = document.getElementById('task-category-filter-chips');
            if (!chipContainer) return;
            const cats = getAllTaskCategories();
            if (cats.length === 0) { chipContainer.innerHTML = ''; return; }
            chipContainer.innerHTML = cats.map(c => {
                const active = selectedTaskCategoryFilters.has(c);
                const safe = c.replace(/'/g, "\\'");
                return `<button onclick="toggleTaskCategoryFilter('${safe}')" class="text-[10px] px-2.5 py-1 rounded-full border font-mono transition ${active ? 'bg-[#B6FF2E] text-[#14161C] border-[#B6FF2E]' : 'bg-[#23262F] text-[#777E90] border-[#353945] hover:border-[#B6FF2E]/40'}">${c}</button>`;
            }).join('') + (selectedTaskCategoryFilters.size > 0
                ? `<button onclick="clearTaskCategoryFilters()" class="text-[10px] px-2.5 py-1 rounded-full border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20">✕ Bỏ lọc</button>`
                : '');
        }

        function renderTasks() {
            const container = document.getElementById('tasks-render-area');
            if (!container) return;
            container.innerHTML = '';
            renderTaskCategoryFilterChips();
            renderDeadlineReminderBanner();

            let filteredList = state.tasks;
            if (state.currentTaskFilter !== 'all') {
                filteredList = filteredList.filter(t => t.relation === state.currentTaskFilter);
            }

            const searchInput = document.getElementById('task-search-input');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            if (searchTerm) {
                filteredList = filteredList.filter(t => {
                    const inTitle = (t.title || '').toLowerCase().includes(searchTerm);
                    const inCategory = (t.category || '').toLowerCase().includes(searchTerm);
                    const inTags = (t.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
                    return inTitle || inCategory || inTags;
                });
            }

            const statusFilter = document.getElementById('task-status-filter');
            const statusVal = statusFilter ? statusFilter.value : 'all';
            if (statusVal === 'overdue') {
                filteredList = filteredList.filter(t => t.status !== 'Done' && isOverdue(t.deadline));
            } else if (statusVal === 'todo') {
                filteredList = filteredList.filter(t => t.status !== 'Done');
            } else if (statusVal === 'done') {
                filteredList = filteredList.filter(t => t.status === 'Done');
            }

            if (selectedTaskCategoryFilters.size > 0) {
                filteredList = filteredList.filter(t => t.category && selectedTaskCategoryFilters.has(t.category));
            }

            const sortSelect = document.getElementById('task-sort-select');
            const sortVal = sortSelect ? sortSelect.value : 'newest';
            filteredList = filteredList.slice(); // không sắp xếp trực tiếp trên state.tasks gốc
            if (sortVal === 'deadline') {
                filteredList.sort((a, b) => {
                    if (!a.deadline && !b.deadline) return 0;
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                });
            } else if (sortVal === 'progress') {
                filteredList.sort((a, b) => calcPlanProgress(b.plan).percent - calcPlanProgress(a.plan).percent);
            }
            // 'newest' giữ nguyên thứ tự gốc (task mới tạo luôn được unshift lên đầu state.tasks)

            const totalBadge = document.getElementById('total-tasks-badge');
            if (totalBadge) totalBadge.innerText = state.tasks.length;

            if (filteredList.length === 0) {
                container.innerHTML = '<div class="bg-[#14161C] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">&#x1F4CB; Không tìm thấy công việc nào phù hợp với tìm kiếm/bộ lọc hiện tại.</div>';
                return;
            }

            filteredList.forEach(task => {
                const isDone     = task.status === 'Done';
                const overdue    = !isDone && isOverdue(task.deadline);
                const areaBadge  = getAreaBadge(task);

                let relLabel = 'Cá nhân';
                let relColor = 'bg-emerald-500/10 text-emerald-400';
                if (task.relation === 'boss-assign') { relLabel = 'Sếp giao' + (task.personName ? ': ' + task.personName : ''); relColor = 'bg-purple-500/10 text-purple-400'; }
                if (task.relation === 'delegate')    { relLabel = 'Giao: ' + (task.personName || '...'); relColor = 'bg-blue-500/10 text-blue-400'; }
                const relBadge = `<span class="${relColor} px-2 py-0.5 rounded text-[10px]">${relLabel}</span>`;

                const deadlineHtml = task.deadline
                    ? `<div class="${overdue ? 'text-rose-400 font-bold' : 'text-[#777E90]'} text-[10px]">${overdue ? '&#x26A0;&#xFE0F;' : '&#x1F4C5;'} DL: ${fmtDate(task.deadline)}</div>`
                    : '';
                const startHtml = task.startdate
                    ? `<div class="text-[#777E90] text-[10px]">&#x23F0; BĐ: ${fmtDateTime(task.startdate)}</div>`
                    : '';
                const createdHtml = task.createdAt
                    ? `<div class="text-[#777E90] text-[10px]">&#x1F550; ${fmtDateTime(task.createdAt)}</div>`
                    : '';
                const categoryTagsHtml = (task.category || (task.tags && task.tags.length))
                    ? `<div class="flex flex-wrap items-center gap-1">
                        ${task.category ? `<span class="text-[10px] text-[#B6FF2E] bg-[#B6FF2E]/10 border border-[#B6FF2E]/20 px-1.5 py-0.5 rounded">${task.category}</span>` : ''}
                        ${(task.tags || []).map(t => `<span class="text-[10px] text-[#777E90] bg-[#23262F] px-1.5 py-0.5 rounded">#${t}</span>`).join('')}
                       </div>`
                    : '';

                const borderColor = overdue ? 'border-rose-500/40' : (isDone ? 'border-[#353945]' : 'border-[#353945] hover:border-[#B6FF2E]/30');

                const card = document.createElement('div');
                card.dataset.taskId = task.id;
                card.className = `bg-[#14161C] p-3.5 rounded-xl border ${borderColor} transition ${isDone ? 'opacity-50' : ''}`;
                card.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <!-- NGĂN TRÁI - rộng hơn: tên + nội dung -->
                        <div class="md:col-span-7 flex items-start gap-2.5 min-w-0">
                            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskDone('${task.id}')" class="task-done-checkbox mt-1 w-4 h-4 rounded accent-[#B6FF2E] cursor-pointer flex-shrink-0">
                            <div class="min-w-0">
                                <h4 class="task-title-text font-bold text-sm text-[#F4F5F6] ${isDone ? 'line-through text-[#777E90]' : ''} leading-snug">${task.title}</h4>
                                ${categoryTagsHtml}
                                ${renderTaskPlanSection(task)}
                            </div>
                        </div>
                        <!-- NGĂN PHẢI - hẹp hơn: thông tin còn lại -->
                        <div class="md:col-span-5 space-y-1.5 md:border-l md:border-[#23262F] md:pl-3">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    ${relBadge}
                                </div>
                                <div class="flex items-center gap-1.5 flex-shrink-0">
                                    <button onclick="openEditTaskModal('${task.id}')" title="Sửa công việc" class="text-[#777E90] hover:text-[#B6FF2E] text-xs px-2 py-1 bg-[#23262F] rounded-lg border border-[#353945] hover:border-[#B6FF2E]/30 transition">&#x270F;&#xFE0F;</button>
                                    <button onclick="deleteTask('${task.id}')" title="Xoá công việc" class="text-[#777E90] hover:text-rose-400 text-xs px-2 py-1 bg-[#23262F] rounded-lg border border-[#353945] hover:border-rose-500/30 transition">&#x2715;</button>
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                ${areaBadge}
                            </div>
                            <label class="flex items-center gap-1.5 cursor-pointer w-fit">
                                <input type="checkbox" ${task.gtask ? 'checked' : ''} onchange="toggleTaskGtask('${task.id}')" class="w-3.5 h-3.5 rounded accent-[#B6FF2E] cursor-pointer">
                                <span class="text-[10px] ${task.gtask ? 'text-[#B6FF2E]' : 'text-[#777E90]'}">G-Task ${task.gtask ? '(đã đưa vào Google Tasks)' : ''}</span>
                            </label>
                            <div class="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                                ${startHtml}
                                ${deadlineHtml}
                                ${createdHtml}
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }


        // =============================================================
        // 🧠 AI PROJECT PLANNING ASSISTANT
        // AI chỉ GỢI Ý (SMART/Pareto/Eisenhower/Action Plan/KPI/Rủi ro/Biện pháp/Hồ sơ).
        // Người dùng tick chọn mục cần dùng -> bấm "Thêm Vào Kế Hoạch" mới thực sự được
        // thêm vào kế hoạch nháp (đi kèm công việc khi tạo). Sau khi thêm, mỗi mục có
        // trạng thái riêng (⬜ Chưa thực hiện / 🔄 Đang thực hiện / ✅ Hoàn thành), bấm để
        // đổi trạng thái theo vòng. Có thể xoá bất cứ lúc nào. Dashboard tự cập nhật theo
        // thời gian thực. Không nhóm nào bị trộn lẫn với nhóm khác.
        // =============================================================

        const PLAN_GROUP_DEFS = [
            { key: 'pareto',      aiKey: 'pareto',       label: '📊 Pareto' },
            { key: 'actionPlan',  aiKey: 'action_plan',  label: '🪜 Action Plan' },
            { key: 'kpi',         aiKey: 'kpi',           label: '🎯 KPI' },
            { key: 'risks',       aiKey: 'risks',         label: '⚠️ Rủi ro' },
            { key: 'mitigations', aiKey: 'mitigations',   label: '🛡️ Biện pháp' },
            { key: 'documents',   aiKey: 'documents',     label: '📁 Hồ sơ' }
        ];
        const PLAN_EISENHOWER_DEFS = [
            { key: 'doNow',     aiKey: 'do_now',    label: '🔥 Làm ngay' },
            { key: 'schedule',  aiKey: 'schedule',   label: '📅 Lên lịch' },
            { key: 'delegate',  aiKey: 'delegate',   label: '🤝 Giao người khác' },
            { key: 'eliminate', aiKey: 'eliminate',  label: '🚫 Không ưu tiên' }
        ];

        function emptyPlanGroups() {
            return {
                pareto: [], actionPlan: [], kpi: [], risks: [], mitigations: [], documents: [],
                eisenhower: { doNow: [], schedule: [], delegate: [], eliminate: [] }
            };
        }

        function _planAllGroupArrays(plan) {
            return [
                plan.groups.pareto, plan.groups.actionPlan, plan.groups.kpi,
                plan.groups.risks, plan.groups.mitigations, plan.groups.documents,
                plan.groups.eisenhower.doNow, plan.groups.eisenhower.schedule,
                plan.groups.eisenhower.delegate, plan.groups.eisenhower.eliminate
            ];
        }
        function _findPlanItem(plan, itemId) {
            for (const arr of _planAllGroupArrays(plan)) {
                const idx = arr.findIndex(i => i.id === itemId);
                if (idx !== -1) return { arr, idx };
            }
            return null;
        }
        function calcPlanProgress(plan) {
            if (!plan) return { total: 0, done: 0, progress: 0, pending: 0, percent: 0 };
            const all = _planAllGroupArrays(plan).flat();
            const total = all.length;
            const done = all.filter(i => i.status === 'done').length;
            const progress = all.filter(i => i.status === 'progress').length;
            return { total, done, progress, pending: total - done - progress, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
        }
        function planStatusIcon(status) { return status === 'done' ? '✅' : status === 'progress' ? '🔄' : '⬜'; }
        function planNextStatus(status) { return status === 'pending' ? 'progress' : status === 'progress' ? 'done' : 'pending'; }

        function setAiPlanStatus(text, type) {
            const el = document.getElementById('ai-plan-status');
            if (!el) return;
            if (!text) { el.classList.add('hidden'); el.textContent = ''; return; }
            el.classList.remove('hidden');
            el.textContent = text;
            el.className = 'text-[10px] ' + (type === 'error' ? 'text-amber-400' : type === 'loading' ? 'text-[#777E90]' : 'text-emerald-400');
        }

        // Render 1 nhóm gợi ý AI (checkbox — tick chọn xong sẽ được đọc trực tiếp khi bấm "Làm Việc Đi!")
        function _renderAiPlanSuggestionGroup(containerId, items, groupKey, subKey) {
            const container = document.getElementById(containerId);
            if (!container) return;
            if (!items || items.length === 0) {
                container.innerHTML = '<p class="text-[10px] text-[#777E90] italic">Không có gợi ý.</p>';
                return;
            }
            const idPrefix = 'ai-plan-check-' + groupKey + (subKey ? '-' + subKey : '');
            container.innerHTML = items.map((text, i) => `
                <label class="flex items-start gap-2 py-0.5 text-[11px] text-[#F4F5F6] cursor-pointer hover:bg-[#14161C] rounded-lg px-1.5 -mx-1.5">
                    <input type="checkbox" id="${idPrefix}-${i}" data-text="${text.replace(/"/g, '&quot;')}" class="mt-0.5 w-3.5 h-3.5 rounded accent-[#B6FF2E] flex-shrink-0">
                    <span>${text}</span>
                </label>
            `).join('');
        }

             function renderAiPlanSuggestions(suggestion) {
            const hint = document.getElementById('ai-plan-empty-hint');
            if (hint) hint.classList.add('hidden');
            const smartEl = document.getElementById('ai-plan-smart-text');
            if (smartEl) smartEl.textContent = suggestion.smart || '(không có)';

            PLAN_GROUP_DEFS.forEach(def => {
                _renderAiPlanSuggestionGroup('ai-plan-list-' + def.key, suggestion[def.aiKey], def.key);
            });
            PLAN_EISENHOWER_DEFS.forEach(def => {
                _renderAiPlanSuggestionGroup('ai-plan-list-eisenhower-' + def.key, (suggestion.eisenhower || {})[def.aiKey], 'eisenhower', def.key);
            });

            const block = document.getElementById('ai-plan-suggestions-block');
            if (block) block.classList.remove('hidden');
        }

        // Nút [🧠 Phân Tích Kế Hoạch AI] — kích hoạt thủ công (không tự động), vì đây là
        // 1 lần gọi AI nặng hơn nhiều (8 nhóm gợi ý cùng lúc).
        async function triggerAiPlanAnalysis() {
            const titleInput = document.getElementById('task-title-input');
            const title = titleInput ? titleInput.value.trim() : '';
            if (!title) { showNotification('Vui lòng nhập Tên công việc trước.', 'error'); return; }

            setAiPlanStatus('⏳ Đang phân tích kế hoạch...', 'loading');
            try {
                const suggestion = await aiGeneratePlan(title);
                renderAiPlanSuggestions(suggestion);
                setAiPlanStatus('✨ Đã có gợi ý — tick chọn mục cần dùng, các mục đã tick sẽ tự thành checklist khi bạn bấm "Làm Việc Đi!"', 'success');
            } catch (e) {
                console.warn('[AI Plan] Lỗi khi lấy gợi ý:', e);
                setAiPlanStatus('⚠ Không lấy được gợi ý từ Gemini.', 'error');
            }
        }

        // Đọc TRỰC TIẾP các checkbox đang tick trong khối gợi ý AI (không cần bước trung
        // gian) để dựng thành kế hoạch của công việc sắp tạo. Trả về null nếu chưa tick gì.
        function buildPlanFromCheckedSuggestions() {
            const groups = emptyPlanGroups();
            let total = 0;

            const addFromGroup = (targetArr, idPrefix) => {
                document.querySelectorAll(`input[id^="${idPrefix}-"]:checked`).forEach(cb => {
                    const text = cb.dataset.text;
                    if (!text) return;
                    targetArr.push({ id: 'PI' + Date.now() + Math.random().toString(36).substr(2, 4), text, status: 'pending' });
                    total++;
                });
            };

            PLAN_GROUP_DEFS.forEach(def => addFromGroup(groups[def.key], 'ai-plan-check-' + def.key));
            PLAN_EISENHOWER_DEFS.forEach(def => addFromGroup(groups.eisenhower[def.key], 'ai-plan-check-eisenhower-' + def.key));

            return total > 0 ? { groups } : null;
        }

        // Hiện danh sách 1 nhóm dạng checklist có thể đổi trạng thái + xoá (dùng cho kế
        // hoạch đã lưu kèm công việc, trong thẻ công việc ở danh sách)
        function renderPlanChecklistGroup(items, toggleFnName, deleteFnName, ownerId) {
            if (!items || items.length === 0) return '';
            return items.map(it => `
                <div class="flex items-center gap-2 py-0.5 text-[11px] text-[#F4F5F6]">
                    <button type="button" onclick="${toggleFnName}('${ownerId ? ownerId + "', '" : ''}${it.id}')" class="flex-shrink-0 leading-none">${planStatusIcon(it.status)}</button>
                    <span class="flex-1 ${it.status === 'done' ? 'line-through text-[#777E90]' : ''}">${it.text}</span>
                    <button type="button" onclick="${deleteFnName}('${ownerId ? ownerId + "', '" : ''}${it.id}')" class="text-[#777E90] hover:text-rose-400 flex-shrink-0 text-[10px]">✕</button>
                </div>
            `).join('');
        }

        // Gọi sau khi tạo công việc thành công, để chuẩn bị sạch cho công việc tiếp theo
        // Gọi sau khi tạo công việc thành công, để chuẩn bị sạch cho công việc tiếp theo.
        // QUAN TRỌNG: phải XOÁ SẠCH nội dung checkbox (không chỉ ẩn đi), nếu không các ô đã
        // tick (kể cả mục tự thêm tay) sẽ vẫn còn ẩn trong DOM và bị đọc nhầm vào công việc
        // tiếp theo nếu người dùng không chạy lại AI trước khi tạo việc mới.
        function resetAiPlanState() {
            const suggestBlock = document.getElementById('ai-plan-suggestions-block');
            if (suggestBlock) suggestBlock.classList.add('hidden');

            PLAN_GROUP_DEFS.forEach(def => {
                const el = document.getElementById('ai-plan-list-' + def.key);
                if (el) el.innerHTML = '';
            });
            PLAN_EISENHOWER_DEFS.forEach(def => {
                const el = document.getElementById('ai-plan-list-eisenhower-' + def.key);
                if (el) el.innerHTML = '';
            });
            const smartEl = document.getElementById('ai-plan-smart-text');
            if (smartEl) smartEl.textContent = '';

        setAiPlanStatus(null);
            const hint = document.getElementById('ai-plan-empty-hint');
            if (hint) hint.classList.remove('hidden');
        }

        // --- Theo dõi kế hoạch của 1 công việc ĐÃ TẠO (trong thẻ công việc ở danh sách) ---
        function toggleTaskPlanItem(taskId, itemId) {
            const task = state.tasks.find(t => t.id === taskId);
            if (!task || !task.plan) return;
            const found = _findPlanItem(task.plan, itemId);
            if (found) {
                found.arr[found.idx].status = planNextStatus(found.arr[found.idx].status);
                renderTasks(); saveToLocalStorage(); trySyncTasks();
            }
        }
        function deleteTaskPlanItem(taskId, itemId) {
            const task = state.tasks.find(t => t.id === taskId);
            if (!task || !task.plan) return;
            const found = _findPlanItem(task.plan, itemId);
            if (found) {
                found.arr.splice(found.idx, 1);
                renderTasks(); saveToLocalStorage(); trySyncTasks();
            }
        }
        // Cho phép tự gõ thêm 1 mục vào kế hoạch NGAY LÚC ĐANG TẠO công việc, không cần chờ AI.
        // Chèn thẳng vào đúng khối gợi ý (ở trạng thái đã tick sẵn), để buildPlanFromCheckedSuggestions()
        // tự động gom vào khi bấm "Làm Việc Đi!" — không cần thêm logic gộp riêng.
        function addManualPlanItemToForm(groupSelectId, inputId) {
            const groupSelect = document.getElementById(groupSelectId);
            const input = document.getElementById(inputId);
            const text = input ? input.value.trim() : '';
            if (!text) { showNotification('Vui lòng nhập nội dung mục cần thêm.', 'error'); return; }

            const groupVal = groupSelect ? groupSelect.value : 'actionPlan';
            let containerId, idPrefix;
            if (groupVal.startsWith('eisenhower.')) {
                const sub = groupVal.split('.')[1];
                containerId = 'ai-plan-list-eisenhower-' + sub;
                idPrefix = 'ai-plan-check-eisenhower-' + sub;
            } else {
                containerId = 'ai-plan-list-' + groupVal;
                idPrefix = 'ai-plan-check-' + groupVal;
            }
            const container = document.getElementById(containerId);
            if (!container) return;

            const emptyHint = container.querySelector('p.italic');
            if (emptyHint) container.innerHTML = '';

            const label = document.createElement('label');
            label.className = 'flex items-start gap-2 py-0.5 text-[11px] text-[#F4F5F6] cursor-pointer hover:bg-[#14161C] rounded-lg px-1.5 -mx-1.5';
            label.innerHTML = `
                <input type="checkbox" id="${idPrefix}-manual-${Date.now()}" data-text="${text.replace(/"/g, '&quot;')}" checked class="mt-0.5 w-3.5 h-3.5 rounded accent-[#B6FF2E] flex-shrink-0">
                <span>${text} <span class="text-[#777E90]">(tự thêm)</span></span>
            `;
            container.appendChild(label);

            input.value = '';
            const block = document.getElementById('ai-plan-suggestions-block');
            if (block) block.classList.remove('hidden'); // hiện khối kế hoạch lên để thấy ngay mục vừa thêm
            showNotification('Đã thêm mục vào kế hoạch (đang tick sẵn, sẽ đưa vào khi tạo việc)!', 'success');
        }

        // =============================================================
        // NHẮC HẸN DEADLINE — banner trong app (luôn hoạt động) + thông báo trình duyệt
        // (tuỳ chọn, cần người dùng bấm bật 1 lần, chỉ hoạt động khi tab app đang mở)
        // =============================================================

        const LS_NOTIFIED_TASKS_TODAY = 'wms_notified_tasks_today';

        function getUpcomingAndOverdueTasks() {
            const now = new Date();
            const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
            return state.tasks.filter(t => {
                if (t.status === 'Done' || !t.deadline) return false;
                const dl = new Date(t.deadline + (t.deadline.length === 10 ? 'T23:59:59' : ''));
                if (isNaN(dl.getTime())) return false;
                return dl <= in24h; // đã quá hạn HOẶC còn dưới 24h
            }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        }

        function renderDeadlineReminderBanner() {
            const banner = document.getElementById('deadline-reminder-banner');
            const titleEl = document.getElementById('deadline-reminder-title');
            const listEl = document.getElementById('deadline-reminder-list');
            if (!banner || !titleEl || !listEl) return;

            const tasks = getUpcomingAndOverdueTasks();
            if (tasks.length === 0) { banner.classList.add('hidden'); return; }

            banner.classList.remove('hidden');
            const overdueCount = tasks.filter(t => new Date(t.deadline) < new Date()).length;
            titleEl.textContent = `⚠️ ${tasks.length} công việc sắp tới hạn / quá hạn` + (overdueCount > 0 ? ` (${overdueCount} đã quá hạn)` : '');

            listEl.innerHTML = tasks.slice(0, 5).map(t => {
                const overdue = new Date(t.deadline) < new Date();
                return `<div class="text-[10px] ${overdue ? 'text-rose-400' : 'text-amber-300'}">${overdue ? '🔴' : '🟡'} ${t.title} — ${fmtDate(t.deadline)}</div>`;
            }).join('') + (tasks.length > 5 ? `<div class="text-[10px] text-[#777E90]">... và ${tasks.length - 5} việc khác</div>` : '');

            maybeSendBrowserNotifications(tasks);
        }

        // Bấm nút "Bật thông báo trình duyệt" — chỉ hoạt động khi tab app đang mở
        // (không phải push notification nền, trình duyệt không hỗ trợ nếu không có server).
        function requestDeadlineNotificationPermission() {
            if (!('Notification' in window)) {
                showNotification('Trình duyệt này không hỗ trợ thông báo.', 'error');
                return;
            }
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showNotification('Đã bật thông báo deadline! (chỉ hoạt động khi app đang mở trên trình duyệt)', 'success');
                    maybeSendBrowserNotifications(getUpcomingAndOverdueTasks());
                } else {
                    showNotification('Bạn chưa cho phép thông báo trình duyệt.', 'error');
                }
            });
        }

        // Gửi thông báo trình duyệt tối đa 1 lần/ngày cho mỗi công việc, tránh làm phiền lặp lại
        function maybeSendBrowserNotifications(tasks) {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            const today = new Date().toISOString().split('T')[0];
            let notifiedMap = {};
            try { notifiedMap = JSON.parse(localStorage.getItem(LS_NOTIFIED_TASKS_TODAY) || '{}'); } catch (e) {}
            if (notifiedMap.date !== today) notifiedMap = { date: today, ids: [] };

            tasks.forEach(t => {
                if (notifiedMap.ids.includes(t.id)) return;
                const overdue = new Date(t.deadline) < new Date();
                new Notification(overdue ? '⚠️ Công việc đã quá hạn' : '🟡 Công việc sắp tới hạn', {
                    body: t.title + ' — hạn: ' + fmtDate(t.deadline),
                    icon: undefined
                });
                notifiedMap.ids.push(t.id);
            });
            localStorage.setItem(LS_NOTIFIED_TASKS_TODAY, JSON.stringify(notifiedMap));
        }

        async function toggleTaskGtask(taskId) {
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const turningOn = !task.gtask;
            task.gtask = turningOn; // cập nhật lạc quan trước, rollback nếu API lỗi
            renderTasks();

            try {
                if (turningOn) {
                    showNotification('Đang đưa vào Google Tasks...', 'success');
                    const gid = await pushTaskToGoogleTasks(task);
                    task.googleTaskId = gid;
                    showNotification('Đã đưa vào Google Tasks!', 'success');
                } else {
                    await deleteTaskFromGoogleTasks(task);
                    task.googleTaskId = null;
                    showNotification('Đã xóa khỏi Google Tasks.', 'success');
                }
            } catch (e) {
                console.warn('[Google Tasks] Lỗi đồng bộ:', e);
                task.gtask = !turningOn; // rollback vì API lỗi
                showNotification('⚠ Không đồng bộ được với Google Tasks: ' + (e.message || e)
                    + '. Nếu vừa bật tính năng này lần đầu, hãy Đăng xuất rồi Đăng nhập lại để cấp thêm quyền Google Tasks.', 'error');
            }

            renderTasks(); saveToLocalStorage(); trySyncTasks();
        }

        function addManualPlanItem(taskId, groupSelectId, inputId) {
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;
            if (!task.plan) task.plan = { groups: emptyPlanGroups() };
            const groupSelect = document.getElementById(groupSelectId);
            const input = document.getElementById(inputId);
            const text = input ? input.value.trim() : '';
            if (!text) { showNotification('Vui lòng nhập nội dung mục cần thêm.', 'error'); return; }

            const groupVal = groupSelect ? groupSelect.value : 'actionPlan';
            const newItem = { id: 'PI' + Date.now() + Math.random().toString(36).substr(2, 4), text, status: 'pending' };
            if (groupVal.startsWith('eisenhower.')) {
                task.plan.groups.eisenhower[groupVal.split('.')[1]].push(newItem);
            } else {
                task.plan.groups[groupVal].push(newItem);
            }
            input.value = '';
            renderTasks(); saveToLocalStorage(); trySyncTasks();
        }

        // Render toàn bộ kế hoạch của 1 công việc đã tạo (dùng trong thẻ công việc, xem renderTasks())
        function renderTaskPlanSection(task) {
            if (!task.plan) return '';
            const progress = calcPlanProgress(task.plan);
            if (progress.total === 0) return '';

            let groupsHtml = '';
            PLAN_GROUP_DEFS.forEach(def => {
                const items = task.plan.groups[def.key];
                if (!items || items.length === 0) return;
                groupsHtml += `<div class="bg-[#0D0E12] rounded-lg p-2"><p class="text-[10px] font-bold text-[#B6FF2E] mb-1">${def.label}</p>${renderPlanChecklistGroup(items, 'toggleTaskPlanItem', 'deleteTaskPlanItem', task.id)}</div>`;
            });
            PLAN_EISENHOWER_DEFS.forEach(def => {
                const items = task.plan.groups.eisenhower[def.key];
                if (!items || items.length === 0) return;
                groupsHtml += `<div class="bg-[#0D0E12] rounded-lg p-2"><p class="text-[10px] font-bold text-[#B6FF2E] mb-1">⏰ ${def.label}</p>${renderPlanChecklistGroup(items, 'toggleTaskPlanItem', 'deleteTaskPlanItem', task.id)}</div>`;
            });

            const selectId = 'plan-add-group-' + task.id;
            const inputId = 'plan-add-input-' + task.id;
            const allGroupOptions = PLAN_GROUP_DEFS.map(d => `<option value="${d.key}">${d.label}</option>`)
                .concat(PLAN_EISENHOWER_DEFS.map(d => `<option value="eisenhower.${d.key}">⏰ ${d.label}</option>`)).join('');

            return `
                <details class="mt-2 bg-[#14161C] rounded-xl border border-[#353945] p-2.5">
                    <summary class="cursor-pointer text-[10px] font-bold text-[#B6FF2E] flex items-center justify-between">
                        <span>🧠 Kế hoạch: ${progress.done}/${progress.total} hoàn thành</span>
                        <span class="text-[#F4F5F6]">${progress.percent}%</span>
                    </summary>
                    <div class="mt-2 space-y-1.5">${groupsHtml}</div>
                    <div class="mt-2 flex gap-1.5">
                        <select id="${selectId}" class="bg-[#23262F] border border-[#353945] rounded-lg px-2 py-1.5 text-[10px] text-[#F4F5F6]">${allGroupOptions}</select>
                        <input id="${inputId}" type="text" placeholder="Thêm mục mới..." class="flex-1 bg-[#23262F] border border-[#353945] rounded-lg px-2 py-1.5 text-[10px] text-[#F4F5F6] focus:outline-none">
                        <button type="button" onclick="addManualPlanItem('${task.id}', '${selectId}', '${inputId}')" class="px-2.5 py-1.5 rounded-lg bg-[#353945] text-[#B6FF2E] text-[10px] font-semibold hover:bg-[#B6FF2E]/10">+</button>
                    </div>
                </details>
            `;
        }

