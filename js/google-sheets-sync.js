        // --- Đọc/ghi Google Sheets ---

        // --- Chuẩn hóa số điện thoại ---
        function normalizePhone(v) {
            if (v === null || v === undefined) return '';
            let s = String(v).trim();
            if (!s) return '';
            s = s.replace(/^'/, '');
            s = s.replace(/\.0$/, '');
            if (/^[0-9]{9}$/.test(s)) s = '0' + s;
            return s;
        }
        function toSheetPhone(v) {
            const s = (v || '').toString().trim();
            return s ? "'" + s : '';
        }

        // --- Đơn vị <-> dòng phẳng Sheets ---
        function buildUnitsFromRows(rows, withType) {
            const units = [];
            const byId = {};
            (rows || []).forEach(r => {
                const unitId = r.unitId || r.unitName;
                if (!unitId) return;
                let unit = byId[unitId];
                if (!unit) {
                    unit = { id: unitId, name: r.unitName || '', members: [] };
                    if (withType) unit.type = r.partnerType || 'Contractor';
                    byId[unitId] = unit;
                    units.push(unit);
                }
                if (r.memberId || r.memberName) {
                    unit.members.push({
                        id: r.memberId || 'M' + Math.random().toString(36).substr(2, 4),
                        name: r.memberName || '',
                        role: r.memberRole || '',
                        phone: normalizePhone(r.memberPhone),
                        email: r.memberEmail || ''
                    });
                }
            });
            return units;
        }

        function flattenUnitsToRows(units) {
            const rows = [];
            (units || []).forEach(u => {
                if (!u.members || u.members.length === 0) {
                    rows.push([u.id, u.name, '', '', '', '', '']);
                } else {
                    u.members.forEach(m => rows.push([u.id, u.name, m.id, m.name, m.role || '', toSheetPhone(m.phone), m.email || '']));
                }
            });
            return rows;
        }

        // --- Đối tác ---
        function buildPartnersFromRows(rows) {
            const partners = [];
            const byId = {};
            (rows || []).forEach(r => {
                const unitId = r.unitId || r.unitName;
                if (!unitId) return;
                let p = byId[unitId];
                if (!p) {
                    p = {
                        id: unitId,
                        name: r.unitName || '',
                        categories: r.categories ? r.categories.split(';').filter(c => c) : ['Chưa phân loại'],
                        equipment: r.equipment ? r.equipment.split(';').filter(e => e) : [],
                        rating: Number(r.rating) || 0,
                        ratingComment: r.ratingComment || '',
                        members: []
                    };
                    byId[unitId] = p;
                    partners.push(p);
                }
                if (r.memberId || r.memberName) {
                    p.members.push({
                        id: r.memberId || 'M' + Math.random().toString(36).substr(2, 4),
                        name: r.memberName || '', role: r.memberRole || '', phone: normalizePhone(r.memberPhone), email: r.memberEmail || ''
                    });
                }
            });
            return partners;
        }

        function flattenPartnersToRows(partners) {
            const rows = [];
            (partners || []).forEach(p => {
                const cats = (p.categories && p.categories.length > 0 ? p.categories : ['Chưa phân loại']).join(';');
                const equip = (p.equipment || []).join(';');
                const rating = p.rating || 0;
                const comment = p.ratingComment || '';
                if (p.members && p.members.length > 0) {
                    p.members.forEach(m => rows.push([p.id, p.name, cats, equip, rating, comment, m.id, m.name, m.role || '', toSheetPhone(m.phone), m.email || '']));
                } else {
                    rows.push([p.id, p.name, cats, equip, rating, comment, '', '', '', '', '']);
                }
            });
            return rows;
        }

        // --- Nhà máy ---
        function buildFactoriesFromRows(rows) {
            const facMap = {};
            const facOrder = [];
            (rows || []).forEach(r => {
                const facId = r.facId;
                if (!facId) return;
                let fac = facMap[facId];
                if (!fac) {
                    fac = { id: facId, name: r.facName || '', members: [], workshops: [], _wsMap: {} };
                    facMap[facId] = fac;
                    facOrder.push(fac);
                }
                if (r.scope === 'workshop' && (r.wsId || r.wsName)) {
                    const wsId = r.wsId || r.wsName;
                    let ws = fac._wsMap[wsId];
                    if (!ws) {
                        ws = { id: wsId, name: r.wsName || '', members: [] };
                        fac._wsMap[wsId] = ws;
                        fac.workshops.push(ws);
                    }
                    if (r.memberId || r.memberName) {
                        ws.members.push({
                            id: r.memberId || 'M' + Math.random().toString(36).substr(2, 4),
                            name: r.memberName || '', role: r.memberRole || '', phone: normalizePhone(r.memberPhone), email: r.memberEmail || ''
                        });
                    }
                } else if (r.memberId || r.memberName) {
                    fac.members.push({
                        id: r.memberId || 'M' + Math.random().toString(36).substr(2, 4),
                        name: r.memberName || '', role: r.memberRole || '', phone: normalizePhone(r.memberPhone), email: r.memberEmail || ''
                    });
                }
            });
            facOrder.forEach(f => delete f._wsMap);
            return facOrder;
        }

        function flattenFactoriesToRows(factories) {
            const rows = [];
            (factories || []).forEach(fac => {
                if (fac.members && fac.members.length > 0) {
                    fac.members.forEach(m => rows.push([fac.id, fac.name, 'factory', '', '', m.id, m.name, m.role || '', toSheetPhone(m.phone), m.email || '']));
                } else {
                    rows.push([fac.id, fac.name, 'factory', '', '', '', '', '', '', '']);
                }
                (fac.workshops || []).forEach(ws => {
                    if (ws.members && ws.members.length > 0) {
                        ws.members.forEach(m => rows.push([fac.id, fac.name, 'workshop', ws.id, ws.name, m.id, m.name, m.role || '', toSheetPhone(m.phone), m.email || '']));
                    } else {
                        rows.push([fac.id, fac.name, 'workshop', ws.id, ws.name, '', '', '', '', '']);
                    }
                });
            });
            return rows;
        }

        // =============================================================
        // SÁNG KIẾN v2 — chuyển đổi <-> 2 sheet riêng:
        //   sang_kien_kaizen      : 1 dòng / sáng kiến (các trường phẳng)
        //   sang_kien_checklist   : nhiều dòng / sáng kiến (từng bước checklist)
        //   sang_kien_financial   : nhiều dòng / sáng kiến (các mục chi phí & lợi ích)
        // =============================================================

        // Flatten sáng kiến -> dòng chính (1 dòng/sáng kiến)
        function flattenInitiativesToRows(initiatives) {
            return (initiatives || []).map(item => [
                item.id || '',
                item.code || '',
                item.title || '',
                item.type || 'kaizen',
                item.status || 'draft',
                item.proposer || '',
                item.department || '',
                item.proposedDate || '',
                item.problemDesc || '',
                item.solution || '',
                item.hasFinancial ? '1' : '0',
                item.actualResult || '',
                item.actualBenefit || '',
                item.approved ? '1' : '0',
                item.approvedDate || '',
                item.approvedNote || '',
                (item.linkedTaskIds || []).join(';'),
                item.createdAt || '',
                item.updatedAt || ''
            ]);
        }

        // Flatten checklist -> dòng (nhiều dòng/sáng kiến)
        function flattenChecklistToRows(initiatives) {
            const rows = [];
            (initiatives || []).forEach(item => {
                (item.checklist || []).forEach(c => {
                    rows.push([
                        c.id || '',
                        item.id || '',
                        c.text || '',
                        c.done ? '1' : '0',
                        c.assignee || '',
                        c.pushedToTask ? '1' : '0',
                        c.taskId || ''
                    ]);
                });
            });
            return rows;
        }

        // Flatten financial breakdown -> dòng
        function flattenFinancialToRows(initiatives) {
            const rows = [];
            (initiatives || []).forEach(item => {
                if (!item.hasFinancial) return;
                (item.financial.investBreakdown || []).forEach(r => {
                    rows.push([r.id || '', item.id || '', 'invest', r.label || '', r.amount || 0]);
                });
                (item.financial.benefitBreakdown || []).forEach(r => {
                    rows.push([r.id || '', item.id || '', 'benefit', r.label || '', r.amount || 0]);
                });
            });
            return rows;
        }

        // Dựng lại mảng initiatives từ 3 sheet
        function buildInitiativesFromRows(mainRows, checkRows, finRows) {
            const byId = {};
            const order = [];

            (mainRows || []).forEach(r => {
                if (!r.id) return;
                const item = {
                    id: r.id,
                    code: r.code || '',
                    title: r.title || '',
                    type: r.type || 'kaizen',
                    status: r.status || 'draft',
                    proposer: r.proposer || '',
                    department: r.department || '',
                    proposedDate: r.proposedDate || '',
                    problemDesc: r.problemDesc || '',
                    solution: r.solution || '',
                    hasFinancial: r.hasFinancial === '1',
                    actualResult: r.actualResult || '',
                    actualBenefit: r.actualBenefit || '',
                    approved: r.approved === '1',
                    approvedDate: r.approvedDate || '',
                    approvedNote: r.approvedNote || '',
                    linkedTaskIds: r.linkedTaskIds ? r.linkedTaskIds.split(';').filter(x => x) : [],
                    createdAt: r.createdAt || '',
                    updatedAt: r.updatedAt || '',
                    checklist: [],
                    financial: { investBreakdown: [], benefitBreakdown: [] }
                };
                byId[item.id] = item;
                order.push(item);
            });

            (checkRows || []).forEach(r => {
                const item = byId[r.initiativeId];
                if (!item) return;
                item.checklist.push({
                    id: r.id || 'C' + Math.random().toString(36).substr(2, 4),
                    text: r.text || '',
                    done: r.done === '1',
                    assignee: r.assignee || '',
                    pushedToTask: r.pushedToTask === '1',
                    taskId: r.taskId || null
                });
            });

            (finRows || []).forEach(r => {
                const item = byId[r.initiativeId];
                if (!item) return;
                const entry = { id: r.id || '', label: r.label || '', amount: Number(r.amount) || 0 };
                if (r.bdType === 'invest') item.financial.investBreakdown.push(entry);
                else if (r.bdType === 'benefit') item.financial.benefitBreakdown.push(entry);
            });

            return order;
        }

        // --- Load từ Sheets ---
        async function loadStateFromSheets() {
            const tasksData = await sheetsGet('danh_sach_cong_viec');
            if (tasksData) {
                state.tasks = tasksData.map(r => ({
                    id:           r.id || 'T' + Math.random().toString(36).substr(2,4),
                    title:        r.title || '',
                    desc:         r.desc || '',
                    areaType:     r.areaType || 'factory',
                    areaValue:    r.areaValue || r.category || '',
                    areaWorkshop: r.areaWorkshop || '',
                    areaPerson:   r.areaPerson || '',
                    relation:     r.relation || 'my-task',
                    personName:   r.personName || '',
                    status:       r.status || 'Todo',
                    priority:     r.priority || 'Q2',
                    startdate:    r.startdate || '',
                    deadline:     r.deadline || '',
                    gtask:        r.gtask === '1',
                    createdAt:    r.createdAt || '',
                    objective:       r.objective || '',
                    expectedResult:  r.expectedResult || '',
                    category:        r.category || '',
                    tags:            r.tags ? r.tags.split(';').filter(t => t) : [],
                    plan: (() => {
                        if (!r.planData) return null;
                        try { return JSON.parse(r.planData); } catch (e) { return null; }
                    })(),
                    googleTaskId: r.googleTaskId || null
                }));
            }

            // --- Sáng kiến v2: đọc 3 sheet ---
            const [initMain, initCheck, initFin] = await Promise.all([
                sheetsGet('sang_kien_kaizen'),
                sheetsGet('sang_kien_checklist'),
                sheetsGet('sang_kien_financial')
            ]);

            if (initMain && initMain.length > 0) {
                // Kiểm tra có phải dữ liệu cũ không (cũ chỉ có id/type/title/desc/status/progress)
                const isLegacy = initMain.some(r => r.code === undefined);
                if (isLegacy) {
                    // Dữ liệu cũ: load vào state rồi chạy migration
                    state.initiatives = initMain.map(r => ({
                        id: r.id || 'I' + Math.random().toString(36).substr(2, 4),
                        type: r.type || 'kaizen',
                        title: r.title || '',
                        desc: r.desc || '',
                        status: r.status || 'Đề xuất mới',
                        progress: Number(r.progress) || 0
                    }));
                    migrateInitiatives();
                } else {
                    state.initiatives = buildInitiativesFromRows(initMain, initCheck, initFin);
                }
            } else if (initMain && initMain.length === 0) {
                // Sheet tồn tại nhưng rỗng -> giữ nguyên state hiện tại
            }

            const logsData = await sheetsGet('nhat_ky_cong_viec');
            if (logsData) {
                state.logs = logsData.map(r => ({
                    id: r.id || 'L' + Math.random().toString(36).substr(2, 4),
                    timestamp: r.timestamp || '',
                    author: r.author || 'Cá nhân',
                    type: r.type || 'work',
                    title: r.title || '',
                    text: r.text || '',
                    attendees: r.attendees ? r.attendees.split(';').filter(x => x) : [],
                    linkedTaskId: r.linkedTaskId || '',
                    tags: r.tags ? r.tags.split(';').filter(x => x) : []
                }));
            }

            const facData = await sheetsGet('cau_hinh_nha_may');
            if (facData) {
                const isLegacyFac = facData.some(r => r.workshops !== undefined && r.facId === undefined);
                if (isLegacyFac) {
                    state.config.factories = facData.map(r => ({
                        id: r.id || 'F' + Math.random().toString(36).substr(2, 4),
                        name: r.name || '',
                        members: [],
                        workshops: (r.workshops ? r.workshops.split(';').filter(w => w) : []).map((w, i) => ({ id: (r.id || 'F') + '-WS' + i, name: w, members: [] }))
                    }));
                } else {
                    state.config.factories = buildFactoriesFromRows(facData);
                }
            }

            const deptData = await sheetsGet('cau_hinh_phong_ban');
            if (deptData) {
                const isLegacyDept = deptData.some(r => r.type !== undefined && r.unitType === undefined);
                if (isLegacyDept) {
                    state.config.departments = deptData.filter(r => r.type === 'department' && r.name).map((r, i) => ({ id: 'D' + i, name: r.name, members: [] }));
                    state.config.specialTeams = deptData.filter(r => r.type === 'team' && r.name).map((r, i) => ({ id: 'TM' + i, name: r.name, members: [] }));
                } else {
                    state.config.departments = buildUnitsFromRows(deptData.filter(r => r.unitType === 'department'));
                    state.config.specialTeams = buildUnitsFromRows(deptData.filter(r => r.unitType === 'team'));
                }
            }

            const partnerData = await sheetsGet('cau_hinh_doi_tac');
            if (partnerData) {
                const isVeryLegacy = partnerData.some(r => r.dept !== undefined && r.unitId === undefined);
                const isMidLegacy = partnerData.some(r => r.partnerType !== undefined && r.categories === undefined);
                if (isVeryLegacy) {
                    const groups = {};
                    partnerData.forEach(r => {
                        if (r.type === 'Contractor' || r.type === 'Supplier') {
                            const key = r.dept || r.name;
                            if (!groups[key]) groups[key] = { id: 'P' + Object.keys(groups).length, name: key, categories: [r.type === 'Supplier' ? 'Nhà cung cấp vật tư' : 'Nhà thầu kỹ thuật'], equipment: [], rating: 0, ratingComment: '', members: [] };
                            groups[key].members.push({ id: r.id || ('M' + Math.random().toString(36).substr(2, 4)), name: r.name, role: r.role || '', phone: '', email: '' });
                        }
                    });
                    state.config.partners = Object.values(groups);
                } else if (isMidLegacy) {
                    state.config.partners = buildUnitsFromRows(partnerData, true).map(u => ({
                        id: u.id, name: u.name,
                        categories: [u.type === 'Supplier' ? 'Nhà cung cấp vật tư' : 'Nhà thầu kỹ thuật'],
                        equipment: [], rating: 0, ratingComment: '',
                        members: u.members
                    }));
                } else {
                    state.config.partners = buildPartnersFromRows(partnerData);
                }
            }

            // Kho mục tiêu
            await loadGoalBankFromSheets();

            saveToLocalStorage();
        }

        // --- Indicator trạng thái sync ---
        function setSyncStatus(status, msg) {
            const dot  = document.getElementById('sync-status-dot');
            const text = document.getElementById('folder-status-text');
            const reloadBtn = document.getElementById('btn-header-reload');
            if (!dot || !text) return;

            if (reloadBtn) reloadBtn.classList.toggle('hidden', !state.sheetsUrl);

            if (status === 'syncing') {
                dot.className    = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0';
                text.textContent = 'Đang lưu...';
            } else if (status === 'ok') {
                dot.className    = 'w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0';
                const n = new Date();
                text.textContent = 'Sheets: Đã lưu ' + String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0') + ':' + String(n.getSeconds()).padStart(2,'0');
            } else if (status === 'error') {
                dot.className    = 'w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0';
                text.textContent = 'Lỗi lưu' + (msg ? ': ' + msg : '');
            } else if (status === 'pending') {
                dot.className    = 'w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0';
                text.textContent = 'Chờ đồng bộ (offline)';
            } else if (state.sheetsUrl) {
                dot.className    = 'w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0';
                text.textContent = 'Sheets: Đã kết nối';
            } else {
                dot.className    = 'w-1.5 h-1.5 rounded-full bg-[#353945] flex-shrink-0';
                text.textContent = 'Cấu Hình Sheets API';
            }
        }

        // --- Chỉ ghi sheet Tasks ---
        async function syncTasksOnly() {
            if (!state.sheetsUrl) return false;
            try {
                return await sheetsPost('danh_sach_cong_viec',
                    ['id','title','desc','areaType','areaValue','areaWorkshop','areaPerson','relation','personName','status','priority','startdate','deadline','gtask','createdAt','objective','expectedResult','category','tags','planData','googleTaskId'],
                    state.tasks.map(t => [t.id, t.title, t.desc||'', t.areaType||'', t.areaValue||'', t.areaWorkshop||'', t.areaPerson||'', t.relation, t.personName||'', t.status, t.priority, t.startdate||'', t.deadline||'', t.gtask?'1':'0', t.createdAt||'', t.objective||'', t.expectedResult||'', t.category||'', (t.tags||[]).join(';'), t.plan ? JSON.stringify(t.plan) : '', t.googleTaskId||''])
                );
            } catch(e) { return false; }
        }

        // --- Chỉ ghi sheet Sáng kiến (3 sheet) ---
        async function syncInitiativesOnly() {
            if (!state.sheetsUrl) return false;
            try {
                const [r1, r2, r3] = await Promise.all([
                    sheetsPost('sang_kien_kaizen',
                        ['id','code','title','type','status','proposer','department','proposedDate','problemDesc','solution','hasFinancial','actualResult','actualBenefit','approved','approvedDate','approvedNote','linkedTaskIds','createdAt','updatedAt'],
                        flattenInitiativesToRows(state.initiatives)
                    ),
                    sheetsPost('sang_kien_checklist',
                        ['id','initiativeId','text','done','assignee','pushedToTask','taskId'],
                        flattenChecklistToRows(state.initiatives)
                    ),
                    sheetsPost('sang_kien_financial',
                        ['id','initiativeId','bdType','label','amount'],
                        flattenFinancialToRows(state.initiatives)
                    )
                ]);
                return r1 && r2 && r3;
            } catch(e) { return false; }
        }

        // --- Ghi toàn bộ ---
        async function syncStateToSheets() {
            if (!state.sheetsUrl) return false;
            try {
                const _results = await Promise.allSettled([
                    sheetsPost('danh_sach_cong_viec',
                        ['id','title','desc','areaType','areaValue','areaWorkshop','areaPerson','relation','personName','status','priority','startdate','deadline','gtask','createdAt','objective','expectedResult','category','tags','planData','googleTaskId'],
                        state.tasks.map(t => [t.id, t.title, t.desc||'', t.areaType||'', t.areaValue||'', t.areaWorkshop||'', t.areaPerson||'', t.relation, t.personName||'', t.status, t.priority, t.startdate||'', t.deadline||'', t.gtask?'1':'0', t.createdAt||'', t.objective||'', t.expectedResult||'', t.category||'', (t.tags||[]).join(';'), t.plan ? JSON.stringify(t.plan) : '', t.googleTaskId||''])
                    ),
                    sheetsPost('sang_kien_kaizen',
                        ['id','code','title','type','status','proposer','department','proposedDate','problemDesc','solution','hasFinancial','actualResult','actualBenefit','approved','approvedDate','approvedNote','linkedTaskIds','createdAt','updatedAt'],
                        flattenInitiativesToRows(state.initiatives)
                    ),
                    sheetsPost('sang_kien_checklist',
                        ['id','initiativeId','text','done','assignee','pushedToTask','taskId'],
                        flattenChecklistToRows(state.initiatives)
                    ),
                    sheetsPost('sang_kien_financial',
                        ['id','initiativeId','bdType','label','amount'],
                        flattenFinancialToRows(state.initiatives)
                    ),
                    sheetsPost('nhat_ky_cong_viec',
                        ['id','timestamp','author','type','title','text','attendees','linkedTaskId','tags'],
                        state.logs.map(l => [l.id, l.timestamp, l.author, l.type || 'work', l.title || '', l.text, (l.attendees||[]).join(';'), l.linkedTaskId || '', (l.tags||[]).join(';')])
                    ),
                    sheetsPost('cau_hinh_nha_may',
                        ['facId','facName','scope','wsId','wsName','memberId','memberName','memberRole','memberPhone','memberEmail'],
                        flattenFactoriesToRows(state.config.factories)
                    ),
                    sheetsPost('cau_hinh_phong_ban',
                        ['unitType','unitId','unitName','memberId','memberName','memberRole','memberPhone','memberEmail'],
                        [
                            ...flattenUnitsToRows(state.config.departments).map(r => ['department', ...r]),
                            ...flattenUnitsToRows(state.config.specialTeams).map(r => ['team', ...r])
                        ]
                    ),
                    sheetsPost('cau_hinh_doi_tac',
                        ['unitId','unitName','categories','equipment','rating','ratingComment','memberId','memberName','memberRole','memberPhone','memberEmail'],
                        flattenPartnersToRows(state.config.partners)
                    ),
                    sheetsPost('kho_muc_tieu_goals',
                        ['id', 'title', 'color', 'createdAt', 'updatedAt'],
                        flattenGoalBankToRows(state.goalBank)
                    ),
                    sheetsPost('kho_muc_tieu_items',
                        ['id', 'goalId', 'text', 'createdAt'],
                        flattenGoalBankItemsToRows(state.goalBank)
                    )
                ]);
                const _failed = _results.filter(r => r.status === 'rejected' || r.value === false);
                if (_failed.length > 0) {
                    console.warn('[Sync] ' + _failed.length + ' sheet(s) ghi thất bại');
                    return false;
                }
                return true;
            } catch(e) {
                console.warn('[Sync] Lỗi kết nối khi ghi Sheets:', e.message || e);
                return false;
            }
        }

        // =============================================================
        // KHO MỤC TIÊU — đọc/ghi sheet riêng 'kho_muc_tieu'
        // Cấu trúc: 2 sheet
        //   kho_muc_tieu_goals   : 1 dòng / mục tiêu chính
        //   kho_muc_tieu_items   : nhiều dòng / mục tiêu chính (nội dung con)
        // =============================================================

        function flattenGoalBankToRows(goalBank) {
            return (goalBank || []).map(g => [
                g.id || '',
                g.title || '',
                g.color || '#38bdf8',
                g.createdAt || '',
                g.updatedAt || ''
            ]);
        }

        function flattenGoalBankItemsToRows(goalBank) {
            const rows = [];
            (goalBank || []).forEach(g => {
                (g.items || []).forEach(it => {
                    rows.push([it.id || '', g.id || '', it.text || '', it.createdAt || '']);
                });
            });
            return rows;
        }

        function buildGoalBankFromRows(goalRows, itemRows) {
            const byId = {};
            const order = [];
            (goalRows || []).forEach(r => {
                if (!r.id) return;
                const g = {
                    id: r.id,
                    title: r.title || '',
                    color: r.color || '#38bdf8',
                    createdAt: r.createdAt || '',
                    updatedAt: r.updatedAt || '',
                    items: []
                };
                byId[g.id] = g;
                order.push(g);
            });
            (itemRows || []).forEach(r => {
                const g = byId[r.goalId];
                if (!g || !r.text) return;
                g.items.push({
                    id: r.id || ('GI' + Math.random().toString(36).substr(2, 4)),
                    text: r.text,
                    createdAt: r.createdAt || ''
                });
            });
            return order;
        }

        async function loadGoalBankFromSheets() {
            const [goalRows, itemRows] = await Promise.all([
                sheetsGet('kho_muc_tieu_goals'),
                sheetsGet('kho_muc_tieu_items')
            ]);
            if (goalRows && goalRows.length > 0) {
                state.goalBank = buildGoalBankFromRows(goalRows, itemRows);
            }
        }

        async function syncGoalBankToSheets() {
            if (!state.sheetsUrl) return false;
            try {
                const [r1, r2] = await Promise.all([
                    sheetsPost('kho_muc_tieu_goals',
                        ['id', 'title', 'color', 'createdAt', 'updatedAt'],
                        flattenGoalBankToRows(state.goalBank)
                    ),
                    sheetsPost('kho_muc_tieu_items',
                        ['id', 'goalId', 'text', 'createdAt'],
                        flattenGoalBankItemsToRows(state.goalBank)
                    )
                ]);
                return r1 && r2;
            } catch(e) {
                console.warn('[GoalBank] Lỗi ghi Sheets:', e);
                return false;
            }
        }

        // --- Hàm lưu chính ---
        async function syncStateToCSV() {
            saveToLocalStorage();
            if (!state.sheetsUrl) { setSyncStatus('idle'); return; }
            setSyncStatus('syncing');
            try {
                const ok = await syncStateToSheets();
                if (ok) {
                    clearPendingSync();
                    setSyncStatus('ok');
                } else {
                    // Ghi thất bại nhưng không phải exception — có thể do mạng chập
                    markPendingSync();
                    setSyncStatus('pending');
                    // Không hiện notification ở đây để tránh làm phiền —
                    // chỉ đổi màu dot thành cam, sẽ tự retry khi có mạng
                    console.warn('[Sync] Ghi Sheets thất bại, đã đánh dấu pending để retry sau.');
                }
            } catch(e) {
                // Exception thật (mạng đứt hoàn toàn, CORS, ...)
                markPendingSync();
                setSyncStatus('pending');
                console.warn('[Sync] Exception khi ghi Sheets:', e);
            }
        }
