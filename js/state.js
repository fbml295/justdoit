        // 1. GLOBAL STATE DATA
        let state = {
            dirHandle: null,
            sheetsUrl: '',
            geminiKey: '',
            tasks: [],
            initiatives: [],
            logs: [],
            goalBank: [],   // Kho mục tiêu chiến lược
            config: {
                factories: [],
                departments: [],
                specialTeams: [],
                partners: []
            },
            currentTaskFilter: 'all',
            currentTaskSubView: 'list',
            currentConfigSubTab: 'api',
            selectedPriority: 'High',
            lastAiOutput: ''
        };

        const LS_KEY = 'wms_v2_state';
        const LS_GEMINI_KEY = 'wms_gemini_key';

        function saveToLocalStorage() {
            try {
                const snapshot = {
                    tasks: state.tasks,
                    initiatives: state.initiatives,
                    logs: state.logs,
                    goalBank: state.goalBank,
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
                if (snap.goalBank)    state.goalBank    = snap.goalBank;
                if (snap.config)      state.config      = { ...state.config, ...snap.config };
                migrateLegacyConfig();
                migrateInitiatives();
                return true;
            } catch (e) { return false; }
        }

        // Chuyển sáng kiến cũ (chỉ có title/desc/status/progress)
        // sang cấu trúc mới đầy đủ — không mất dữ liệu cũ.
        function migrateInitiatives() {
            const year = new Date().getFullYear();
            state.initiatives = (state.initiatives || []).map((item, idx) => {
                // Nếu đã có cấu trúc mới (có field 'code') thì bỏ qua
                if (item.code) return item;

                // Map trạng thái cũ -> mới
                const statusMap = {
                    'Đề xuất mới':     'draft',
                    'Đang triển khai': 'implementing',
                    'Hoàn thành':      'done'
                };

                return {
                    id: item.id || 'I' + Date.now() + idx,
                    code: 'SK-' + year + '-' + String(idx + 1).padStart(3, '0'),
                    title: item.title || '',
                    problemDesc: item.desc || '',
                    solution: '',
                    type: item.type === 'kaizen' ? 'kaizen' : (item.type === 'initiative' ? 'energy' : 'kaizen'),
                    proposer: '',
                    department: '',
                    proposedDate: new Date().toISOString().split('T')[0],
                    status: statusMap[item.status] || 'draft',

                    hasFinancial: false,
                    financial: {
                        investBreakdown: [],
                        benefitBreakdown: []
                    },

                    actualResult: '',
                    actualBenefit: '',

                    checklist: [],
                    approved: false,
                    approvedDate: '',
                    approvedNote: '',
                    linkedTaskIds: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });
        }

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
                showNotification('Đã chuyển danh bạ cũ sang Đối Tác.', 'success');
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
