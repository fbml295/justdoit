        // --- Đọc/ghi Google Sheets ---
        // sheetsGet(sheetName) và sheetsPost(sheetName, headers, dataRows) được định nghĩa
        // trong js/google-sheets-api.js (gọi thẳng Google Sheets API v4 bằng token OAuth
        // của người dùng đang đăng nhập — KHÔNG còn qua Apps Script Web App trung gian nữa).
        // File này chỉ còn giữ các hàm xử lý dữ liệu (chuẩn hóa, chuyển đổi, đồng bộ) dùng chung.

        // --- Chuẩn hóa số điện thoại: khắc phục việc Google Sheets tự hiểu chuỗi số là số thực,
        // làm mất số 0 ở đầu (VD: "0901234567" -> 901234567). Áp dụng khi ĐỌC dữ liệu về.
        function normalizePhone(v) {
            if (v === null || v === undefined) return '';
            let s = String(v).trim();
            if (!s) return '';
            s = s.replace(/^'/, '');       // bỏ dấu nháy đơn ép kiểu văn bản nếu còn sót
            s = s.replace(/\.0$/, '');     // bỏ .0 nếu Sheets trả về dạng số thực
            if (/^[0-9]{9}$/.test(s)) s = '0' + s; // số VN bị rụng mất số 0 đầu (còn lại đúng 9 số)
            return s;
        }
        // Khi GHI lên Sheets: thêm dấu nháy đơn để ép Google Sheets lưu dạng văn bản, không tự chuyển thành số
        function toSheetPhone(v) {
            const s = (v || '').toString().trim();
            return s ? "'" + s : '';
        }

        // --- Chuyển đổi Đơn vị (Phòng ban/Tổ đội/Đối tác) <-> dòng phẳng Sheets ---
        // Mỗi đơn vị có thể có 0..n nhân sự (namecard). Nếu 0 nhân sự vẫn ghi 1 dòng để không mất đơn vị.
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

        // rows: [unitId, unitName, memberId, memberName, memberRole, memberPhone, memberEmail]
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

        // rows: [unitId, unitName, categories, equipment, rating, ratingComment, memberId, memberName, memberRole, memberPhone, memberEmail]
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

        // --- Nhà máy: nhân sự có 2 cấp (thuộc cả nhà máy / thuộc 1 xưởng cụ thể) ---
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
                    tags:            r.tags ? r.tags.split(';').filter(t => t) : []
                }));
            }

            const initData = await sheetsGet('sang_kien_kaizen');
            if (initData) {
                state.initiatives = initData.map(r => ({
                    id: r.id || 'I' + Math.random().toString(36).substr(2, 4),
                    type: r.type || 'initiative',
                    title: r.title || '',
                    desc: r.desc || '',
                    status: r.status || 'Đề xuất mới',
                    progress: Number(r.progress) || 0
                }));
            }

            const logsData = await sheetsGet('nhat_ky_cong_viec');
            if (logsData) {
                state.logs = logsData.map(r => ({
                    id: r.id || 'L' + Math.random().toString(36).substr(2, 4),
                    timestamp: r.timestamp || '',
                    author: r.author || 'Cá nhân',
                    text: r.text || ''
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

            saveToLocalStorage();
        }

        // --- Indicator trạng thái sync (hiển thị ngay trên nút Sheets ở header trên cùng) ---
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

        // --- Chỉ ghi sheet Tasks (nhanh, dùng sau mỗi thao tác task) ---
        async function syncTasksOnly() {
            if (!state.sheetsUrl) return false;
            try {
                return await sheetsPost('danh_sach_cong_viec',
                    ['id','title','desc','areaType','areaValue','areaWorkshop','areaPerson','relation','personName','status','priority','startdate','deadline','gtask','createdAt','objective','expectedResult','category','tags'],
                    state.tasks.map(t => [t.id, t.title, t.desc||'', t.areaType||'', t.areaValue||'', t.areaWorkshop||'', t.areaPerson||'', t.relation, t.personName||'', t.status, t.priority, t.startdate||'', t.deadline||'', t.gtask?'1':'0', t.createdAt||'', t.objective||'', t.expectedResult||'', t.category||'', (t.tags||[]).join(';')])
                );
            } catch(e) { return false; }
        }

        // --- Ghi vào Sheets ---
        async function syncStateToSheets() {
            if (!state.sheetsUrl) return;

            await sheetsPost('danh_sach_cong_viec',
                ['id','title','desc','areaType','areaValue','areaWorkshop','areaPerson','relation','personName','status','priority','startdate','deadline','gtask','createdAt','objective','expectedResult','category','tags'],
                state.tasks.map(t => [t.id, t.title, t.desc||'', t.areaType||'', t.areaValue||'', t.areaWorkshop||'', t.areaPerson||'', t.relation, t.personName||'', t.status, t.priority, t.startdate||'', t.deadline||'', t.gtask?'1':'0', t.createdAt||'', t.objective||'', t.expectedResult||'', t.category||'', (t.tags||[]).join(';')])
            );
            await sheetsPost('sang_kien_kaizen',
                ['id','type','title','desc','status','progress'],
                state.initiatives.map(i => [i.id,i.type,i.title,i.desc,i.status,i.progress])
            );
            await sheetsPost('nhat_ky_cong_viec',
                ['id','timestamp','author','text'],
                state.logs.map(l => [l.id,l.timestamp,l.author,l.text])
            );
            await sheetsPost('cau_hinh_nha_may',
                ['facId','facName','scope','wsId','wsName','memberId','memberName','memberRole','memberPhone','memberEmail'],
                flattenFactoriesToRows(state.config.factories)
            );
            const deptRows = [
                ...flattenUnitsToRows(state.config.departments).map(r => ['department', ...r]),
                ...flattenUnitsToRows(state.config.specialTeams).map(r => ['team', ...r])
            ];
            await sheetsPost('cau_hinh_phong_ban',
                ['unitType','unitId','unitName','memberId','memberName','memberRole','memberPhone','memberEmail'],
                deptRows
            );
            await sheetsPost('cau_hinh_doi_tac',
                ['unitId','unitName','categories','equipment','rating','ratingComment','memberId','memberName','memberRole','memberPhone','memberEmail'],
                flattenPartnersToRows(state.config.partners)
            );
        }

        // --- Hàm lưu chính: ghi cả Sheets lẫn localStorage ---
        async function syncStateToCSV() {
            saveToLocalStorage();
            if (!state.sheetsUrl) { setSyncStatus('idle'); return; }
            setSyncStatus('syncing');
            const ok = await syncStateToSheets();
            if (ok) {
                clearPendingSync();
                setSyncStatus('ok');
            } else {
                markPendingSync();
                setSyncStatus('pending');
                showNotification('⚠️ Mất kết nối Sheets. Đã lưu tạm, sẽ tự đồng bộ khi có mạng lại.', 'error');
            }
        }

