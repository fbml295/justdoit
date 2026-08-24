        // =============================================================
        // MODAL FUNCTIONS — đọc/ghi field của modal (prefix modal-)
        // Thêm vào cuối js/tasks.js, TRƯỚC dòng đóng cuối cùng
        // =============================================================

        function onModalAreaTypeChange() {
            const type = document.getElementById('modal-task-area-type').value;
            const valueSelect = document.getElementById('modal-task-area-value');
            const workshopWrap = document.getElementById('modal-task-area-workshop-wrap');
            const personWrap = document.getElementById('modal-task-area-person-wrap');
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
            onModalAreaValueChange();
        }

        function onModalAreaValueChange() {
            const type = document.getElementById('modal-task-area-type').value;
            const value = document.getElementById('modal-task-area-value').value;
            const workshopWrap = document.getElementById('modal-task-area-workshop-wrap');
            const workshopSelect = document.getElementById('modal-task-area-workshop');
            const personWrap = document.getElementById('modal-task-area-person-wrap');
            const personSelect = document.getElementById('modal-task-area-person');

            workshopWrap.classList.add('hidden');
            personWrap.classList.add('hidden');

            if (type === 'factory' && value) {
                const fac = (state.config.factories || []).find(f => f.name === value);
                if (fac && fac.workshops && fac.workshops.length > 0) {
                    workshopSelect.innerHTML = '<option value="">-- Toàn nhà máy --</option>'
                        + fac.workshops.map(w => `<option value="${w.name}">${w.name}</option>`).join('');
                    workshopWrap.classList.remove('hidden');
                }
                refreshModalFactoryPersonOptions(fac);
            } else if ((type === 'unit' || type === 'partner') && value) {
                const unit = getAllUnits(type).find(u => u.name === value);
                if (unit && unit.members && unit.members.length > 0) {
                    personSelect.innerHTML = '<option value="">-- Cả đơn vị --</option>'
                        + unit.members.map(m => `<option value="${m.name}">${m.name}${m.role ? ' — ' + m.role : ''}</option>`).join('');
                    personWrap.classList.remove('hidden');
                }
            }
        }

        function onModalAreaWorkshopChange() {
            const facName = document.getElementById('modal-task-area-value').value;
            const fac = (state.config.factories || []).find(f => f.name === facName);
            if (fac) refreshModalFactoryPersonOptions(fac);
        }

        function refreshModalFactoryPersonOptions(fac) {
            const personWrap = document.getElementById('modal-task-area-person-wrap');
            const personSelect = document.getElementById('modal-task-area-person');
            if (!fac) { personWrap.classList.add('hidden'); return; }

            const wsName = document.getElementById('modal-task-area-workshop').value;
            let members = fac.members || [];
            if (wsName) {
                const ws = (fac.workshops || []).find(w => w.name === wsName);
                members = ws ? (ws.members || []) : [];
            }

            if (members.length > 0) {
                personSelect.innerHTML = '<option value="">-- Cả khu vực --</option>'
                    + members.map(m => `<option value="${m.name}">${m.name}${m.role ? ' — ' + m.role : ''}</option>`).join('');
                personWrap.classList.remove('hidden');
            } else {
                personWrap.classList.add('hidden');
            }
        }

        function onModalRelationChange() {
            const rel = document.getElementById('modal-task-relation').value;
            const wrap = document.getElementById('modal-task-person-wrap');
            const select = document.getElementById('modal-task-person');
            const hint = document.getElementById('modal-task-person-hint');

            if (rel === 'my-task') {
                wrap.classList.add('hidden');
                return;
            }
            wrap.classList.remove('hidden');

            const personnel = getAllPersonnel();
            if (personnel.length === 0) {
                select.innerHTML = '<option value="">-- Chưa có ai --</option>';
                if (hint) hint.classList.remove('hidden');
            } else {
                if (hint) hint.classList.add('hidden');
                select.innerHTML = '<option value="">-- Chọn người --</option>'
                    + personnel.map(m => `<option value="${m.name}">${m.name}${m.role ? ' — ' + m.role : ''} (${m.unitLabel})</option>`).join('');
            }
        }

        // Override refreshTaskFormOptions để init modal fields
        function refreshTaskFormOptions() {
            // Giữ lại cho form cũ (nếu cần)
            if (document.getElementById('task-area-type-input')) onAreaTypeChange();
            if (document.getElementById('task-relation-input')) onRelationChange();
            // Init modal fields
            onModalAreaTypeChange();
            onModalRelationChange();
        }

        // Override triggerAiPlanAnalysis để đọc từ modal
        async function triggerAiPlanAnalysis() {
            const titleInput = document.getElementById('modal-task-title');
            const title = titleInput ? titleInput.value.trim() : '';
            if (!title) { showNotification('Vui lòng nhập Tên công việc trước.', 'error'); return; }

            setAiPlanStatus('⏳ Đang phân tích kế hoạch...', 'loading');
            const hint = document.getElementById('ai-plan-empty-hint');
            if (hint) hint.classList.add('hidden');

            try {
                const suggestion = await aiGeneratePlan(title);
                renderAiPlanSuggestions(suggestion);
                setAiPlanStatus('✨ Đã có gợi ý — tick chọn mục cần dùng, các mục đã tick sẽ tự thành checklist khi bạn bấm "Làm Việc Đi!"', 'success');
            } catch (e) {
                console.warn('[AI Plan] Lỗi khi lấy gợi ý:', e);
                setAiPlanStatus('⚠ Không lấy được gợi ý từ Gemini.', 'error');
                if (hint) hint.classList.remove('hidden');
            }
        }
