        // 1. GLOBAL STATE DATA
        let state = {
            dirHandle: null,   // giữ lại để không lỗi các hàm cũ
            sheetsUrl: '',     // (Tái sử dụng tên field cũ) Cờ báo đã kết nối Google Sheets —
                               // khi đăng nhập Google + tìm thấy Sheet thành công, field này được
                               // gán = activeSpreadsheetId (xem js/google-drive-api.js). Rỗng = chưa kết nối.
            geminiKey: '',     // Gemini API key
            tasks: [],
            initiatives: [],
            logs: [],
            config: {
                factories: [],
                departments: [],   // [{id,name,members:[{id,name,role,phone,email}]}]
                specialTeams: [],  // [{id,name,members:[{id,name,role,phone,email}]}]
                partners: []       // [{id,name,type,members:[{id,name,role,phone,email}]}]
            },
            currentTaskFilter: 'all',
            currentTaskSubView: 'list',
            currentConfigSubTab: 'api',
            selectedPriority: 'High',
            lastAiOutput: ''
        };

        // =============================================================
        // STORAGE LAYER - Hybrid: Google Sheets (ưu tiên) + localStorage (fallback)
        // =============================================================

        const LS_KEY = 'wms_v2_state';
        const LS_GEMINI_KEY = 'wms_gemini_key';

        // --- localStorage helpers ---
        function saveToLocalStorage() {
            try {
                const snapshot = {
                    tasks: state.tasks,
                    initiatives: state.initiatives,
                    logs: state.logs,
                    config: state.config
                };
                localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
            } catch (e) { console.warn('localStorage full:', e); }
        }

        function loadFromLocalStorage() {
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (!raw) return false;
                const snap = JSON.parse(raw);
                if (snap.tasks)       state.tasks       = snap.tasks;
                if (snap.initiatives) state.initiatives = snap.initiatives;
                if (snap.logs)        state.logs        = snap.logs;
                if (snap.config)      state.config      = { ...state.config, ...snap.config };
                migrateLegacyConfig();
                return true;
            } catch (e) { return false; }
        }

        // Chuyển dữ liệu cấu hình từ bản cũ (phòng ban/tổ đội là chuỗi tên, danh bạ là 1 danh sách phẳng)
        // sang cấu trúc mới (đơn vị có danh sách nhân sự namecard bên trong), để không mất dữ liệu đã lưu trước đó.
        function migrateLegacyConfig() {
            if ((state.config.factories || []).some(f => (f.workshops || []).some(w => typeof w === 'string') || f.members === undefined)) {
                state.config.factories = (state.config.factories || []).map(f => ({
                    id: f.id,
                    name: f.name,
                    members: f.members || [],
                    workshops: (f.workshops || []).map((w, i) => typeof w === 'string' ? { id: f.id + '-WS' + i, name: w, members: [] } : w)
                }));
            }
            if ((state.config.departments || []).some(d => typeof d === 'string')) {
                state.config.departments = state.config.departments.map((d, i) => ({ id: 'D' + i, name: d, members: [] }));
            }
            if ((state.config.specialTeams || []).some(t => typeof t === 'string')) {
                state.config.specialTeams = state.config.specialTeams.map((t, i) => ({ id: 'TM' + i, name: t, members: [] }));
            }
            if (state.config.contacts && state.config.contacts.length > 0 && (!state.config.partners || state.config.partners.length === 0)) {
                const groups = {};
                state.config.contacts.forEach(c => {
                    if (c.type === 'Contractor' || c.type === 'Supplier') {
                        const key = c.dept || c.name;
                        if (!groups[key]) groups[key] = { id: 'P' + Object.keys(groups).length, name: key, categories: [c.type === 'Supplier' ? 'Nhà cung cấp vật tư' : 'Nhà thầu kỹ thuật'], equipment: [], rating: 0, ratingComment: '', members: [] };
                        groups[key].members.push({ id: c.id || ('M' + Math.random().toString(36).substr(2, 4)), name: c.name, role: c.role || '', phone: '', email: '' });
                    }
                });
                state.config.partners = Object.values(groups);
                showNotification('Đã chuyển danh bạ cũ sang Đối Tác. Nhân sự nội bộ cũ (Employee) cần thêm lại thủ công vào đúng Phòng ban/Tổ đội.', 'success');
            }
            state.config.partners = (state.config.partners || []).map(p => {
                if (p.type && !p.categories) {
                    p.categories = [p.type === 'Supplier' ? 'Nhà cung cấp vật tư' : 'Nhà thầu kỹ thuật'];
                    delete p.type;
                }
                if (!p.categories || p.categories.length === 0) p.categories = ['Chưa phân loại'];
                if (!p.equipment) p.equipment = [];
                if (p.rating === undefined) p.rating = 0;
                if (p.ratingComment === undefined) p.ratingComment = '';
                return p;
            });
            delete state.config.contacts;
        }

