        function showNotification(msg, type = 'success') {
            const box = document.createElement('div');
            box.className = `fixed bottom-20 right-5 z-50 text-xs px-4 py-3 rounded-xl border shadow-lg transition-all transform duration-300 ${type === 'error' ? 'bg-rose-900/90 text-rose-200 border-rose-500' : 'bg-[#23262F]/90 text-[#B6FF2E] border-[#B6FF2E]/50'}`;
            box.innerText = msg;
            document.body.appendChild(box);
            setTimeout(() => box.remove(), 3500);
        }

        // Hộp thoại xác nhận dùng chung (thay cho confirm() mặc định của trình duyệt), theo đúng giao diện tối của app.
        // Dùng cho MỌI thao tác xóa trong app: confirmAction('Nội dung hỏi...', () => { /* logic xóa thật sự */ });
        function confirmAction(message, onConfirm, opts) {
            opts = opts || {};
            const title = opts.title || '⚠️ Xác nhận xóa';
            const confirmLabel = opts.confirmLabel || 'Xóa';

            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
            overlay.innerHTML = `
                <div class="bg-[#14161C] border border-[#353945] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
                    <h4 class="font-bold text-sm text-[#F4F5F6] flex items-center gap-2">${title}</h4>
                    <p class="text-xs text-[#B0B4BD] leading-relaxed">${message}</p>
                    <div class="flex justify-end gap-2 pt-1">
                        <button id="confirm-modal-cancel" class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945] transition">Hủy</button>
                        <button id="confirm-modal-ok" class="px-4 py-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/40 text-xs font-semibold hover:bg-rose-500/25 transition">${confirmLabel}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            overlay.querySelector('#confirm-modal-cancel').onclick = close;
            overlay.querySelector('#confirm-modal-ok').onclick = () => { close(); onConfirm(); };
        }

        // MUTATIONS
        // Helper dùng chung: ghi task, nếu lỗi thì đánh dấu pending để tự retry sau
        async function trySyncTasks(successMsg) {
            if (!state.sheetsUrl) { setSyncStatus('idle'); return; }
            setSyncStatus('syncing');
            const ok = await syncTasksOnly();
            if (ok) {
                clearPendingSync();
                setSyncStatus('ok');
                if (successMsg) showNotification(successMsg, 'success');
            } else {
                markPendingSync();
                setSyncStatus('pending');
                showNotification('⚠️ Mất kết nối Sheets. Đã lưu tạm cục bộ, sẽ tự đồng bộ khi có mạng lại.', 'error');
            }
        }

        async function createNewTask() {
            const titleInput      = document.getElementById('task-title-input');
            const descInput       = document.getElementById('task-desc-input');
            const objectiveInput  = document.getElementById('task-objective-input');
            const expectedResultInput = document.getElementById('task-expected-result-input');
            const categoryInput   = document.getElementById('task-category-input');
            const tagsInput       = document.getElementById('task-tags-input');
            const areaTypeInput   = document.getElementById('task-area-type-input');
            const areaValueInput  = document.getElementById('task-area-value-input');
            const areaWorkshopInput = document.getElementById('task-area-workshop-input');
            const areaPersonInput = document.getElementById('task-area-person-input');
            const relInput        = document.getElementById('task-relation-input');
            const personInput     = document.getElementById('task-person-input');
            const startInput      = document.getElementById('task-startdate-input');
            const deadlineInput   = document.getElementById('task-deadline-input');
            const gtaskToggle     = document.getElementById('task-google-task');

            const title = titleInput.value.trim();
            if (!title) return showNotification('Vui lòng nhập tên công việc!', 'error');

            const areaValue = areaValueInput ? areaValueInput.value : '';
            if (!areaValue) return showNotification('Vui lòng chọn Khu vực cụ thể (hoặc thêm dữ liệu ở Cấu Hình)!', 'error');

            const relation = relInput.value;
            const personName = (relation !== 'my-task' && personInput) ? personInput.value : '';
            if (relation !== 'my-task' && !personName) {
                return showNotification('Vui lòng chọn người ở mục Phân quyền!', 'error');
            }

            const today = new Date().toISOString().split('T')[0];
            const newTask = {
                id:          'T' + Date.now(),
                title:       title,
                desc:        descInput ? descInput.value.trim() : '',
                areaType:    areaTypeInput ? areaTypeInput.value : 'factory',
                areaValue:   areaValue,
                areaWorkshop: (areaWorkshopInput && !document.getElementById('task-area-workshop-wrap').classList.contains('hidden')) ? areaWorkshopInput.value : '',
                areaPerson:  (areaPersonInput && !document.getElementById('task-area-person-wrap').classList.contains('hidden')) ? areaPersonInput.value : '',
                relation:    relation,
                personName:  personName,
                status:      'Todo',
                priority:    state.selectedPriority || 'Q2',
                startdate:   startInput ? (startInput.value || today) : today,
                deadline:    deadlineInput ? deadlineInput.value : '',
                gtask:       gtaskToggle ? gtaskToggle.checked : false,
                createdAt:   new Date().toISOString(),
                objective:       objectiveInput ? objectiveInput.value.trim() : '',
                expectedResult:  expectedResultInput ? expectedResultInput.value.trim() : '',
                category:        categoryInput ? categoryInput.value.trim() : '',
                tags:            tagsInput ? tagsInput.value.split(',').map(s => s.trim()).filter(Boolean) : []
            };

            state.tasks.unshift(newTask);
            titleInput.value = '';
            if (descInput)     descInput.value = '';
            if (objectiveInput)      objectiveInput.value = '';
            if (expectedResultInput) expectedResultInput.value = '';
            if (categoryInput)       categoryInput.value = '';
            if (tagsInput)           tagsInput.value = '';
            if (startInput)    startInput.value = '';
            if (deadlineInput) deadlineInput.value = '';
            if (gtaskToggle)   gtaskToggle.checked = false;
            setFormPriority('Q2');
            relInput.value = 'my-task';
            onRelationChange();
            resetAiSuggestState(); // xoá gợi ý AI cũ + trạng thái theo dõi chỉnh sửa tay, chuẩn bị cho công việc tiếp theo

            renderTasks(); renderCalendar(); updateDashboardMetrics();
            saveToLocalStorage();

            await trySyncTasks('✅ Đã lưu lên Google Sheets!');
        }

        async function toggleTaskDone(id) {
            const task = state.tasks.find(t => t.id === id);
            if (task) {
                task.status = task.status === 'Done' ? 'Todo' : 'Done';
                renderTasks(); renderCalendar(); updateDashboardMetrics();
                saveToLocalStorage();
                await trySyncTasks();
            }
        }

        function deleteTask(id) {
            confirmAction('Bạn có chắc muốn xóa công việc này? Hành động này không thể hoàn tác.', async () => {
                state.tasks = state.tasks.filter(t => t.id !== id);
                showNotification('Đã xóa công việc!', 'success');
                renderTasks(); renderCalendar(); updateDashboardMetrics();
                saveToLocalStorage();
                await trySyncTasks();
            });
        }

        function submitInitiative() {
            const title = document.getElementById('initiative-title').value.trim();
            const desc = document.getElementById('initiative-desc').value.trim();
            const type = document.getElementById('initiative-type').value;

            if (!title) return showNotification('Vui lòng nhập tên sáng kiến!', 'error');

            state.initiatives.push({
                id: 'I' + (state.initiatives.length + 1),
                type, title, desc,
                status: 'Đề xuất mới',
                progress: 0
            });

            document.getElementById('initiative-title').value = '';
            document.getElementById('initiative-desc').value = '';
            showNotification('Đã lưu đề xuất sáng kiến mới!', 'success');
            renderInitiatives();
            updateDashboardMetrics();
            syncStateToCSV();
        }

        function addNewLogEntry() {
            const input = document.getElementById('log-text-input');
            const text = input.value.trim();
            if (!text) return showNotification('Vui lòng nhập nội dung nhật ký!', 'error');

            const now = new Date();
            const timeStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

            state.logs.unshift({
                id: 'L' + (state.logs.length + 1),
                timestamp: timeStr,
                author: 'Cá nhân',
                text: text
            });

            input.value = '';
            showNotification('Đã ghi vào nhật ký!', 'success');
            renderLogs();
            syncStateToCSV();
        }

        function dispatchStandardTPMTasks() {
            const tpmTasks = [
                { id: 'T' + (state.tasks.length + 1), title: 'Kiểm tra định kỳ độ rung quạt sấy chính', category: 'tpm-5s', relation: 'delegate', assignee: 'Tổ Cơ Điện', priority: 'High', status: 'Todo', deadline: new Date().toISOString().split('T')[0] },
                { id: 'T' + (state.tasks.length + 2), title: 'Vệ sinh bề mặt rulo dây chuyền ép & Sắp xếp 5S', category: 'tpm-5s', relation: 'delegate', assignee: 'Xưởng Sản Xuất', priority: 'Medium', status: 'Todo', deadline: new Date().toISOString().split('T')[0] },
                { id: 'T' + (state.tasks.length + 3), title: 'Kiểm tra định kỳ hệ thống bình chữa cháy & HSE', category: 'tpm-5s', relation: 'delegate', assignee: 'Ban HSE', priority: 'High', status: 'Todo', deadline: new Date().toISOString().split('T')[0] }
            ];
            state.tasks.push(...tpmTasks);
            showNotification('Đã phát hành 3 công việc TPM & 5S mẫu xuống hệ thống!', 'success');
            renderTasks();
            updateDashboardMetrics();
            syncStateToCSV();
        }

        function generateWeeklyReport() {
            if (state.logs.length === 0 && state.tasks.length === 0) {
                showNotification('Chưa có nhật ký hoặc công việc nào để tổng hợp báo cáo!', 'error');
                return;
            }
            const completedTasks = state.tasks.filter(t => t.status === 'Done');
            let summaryText = `--- BÁO CÁO TỔNG HỢP CÔNG VIỆC TUẦN ---\n\n`;
            summaryText += `1. CÔNG VIỆC HOÀN THÀNH (${completedTasks.length}/${state.tasks.length}):\n`;
            completedTasks.forEach(t => {
                summaryText += ` - ${t.title} [${t.priority}]\n`;
            });
            summaryText += `\n2. NHẬT KÝ XỬ LÝ NỔI BẬT:\n`;
            state.logs.slice(0, 5).forEach(l => {
                summaryText += ` - [${l.timestamp}] ${l.text}\n`;
            });

            const now = new Date();
            const timeStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            state.logs.unshift({
                id: 'L' + (state.logs.length + 1),
                timestamp: timeStr,
                author: 'Hệ Thống',
                text: summaryText
            });
            showNotification('Đã tự động tổng hợp Báo cáo tuần vào Nhật ký!', 'success');
            renderLogs();
            syncStateToCSV();
        }

        function addNewFactory() {
            const input = document.getElementById('cfg-factory-name');
            const val = input.value.trim();
            if (!val) return showNotification('Vui lòng nhập tên nhà máy!', 'error');

            state.config.factories.push({
                id: 'F' + Date.now(),
                name: val,
                members: [],
                workshops: []
            });
            input.value = '';
            showNotification('Đã thêm nhà máy mới!', 'success');
            renderConfigView();
            syncStateToCSV();
        }

        function deleteFactory(id, afterDelete) {
            confirmAction('Xóa nhà máy này? Toàn bộ phân xưởng và nhân sự bên trong cũng sẽ bị xóa theo.', () => {
                state.config.factories = state.config.factories.filter(f => f.id !== id);
                showNotification('Đã xóa nhà máy!', 'success');
                renderConfigView();
                syncStateToCSV();
                if (typeof afterDelete === 'function') afterDelete();
            });
        }

        function addWorkshop(facId) {
            const input = document.getElementById(`cfg-ws-input-${facId}`);
            const val = input.value.trim();
            if (!val) return showNotification('Vui lòng nhập tên phân xưởng!', 'error');

            const fac = state.config.factories.find(f => f.id === facId);
            if (fac) {
                fac.workshops.push({ id: 'WS' + Date.now(), name: val, members: [] });
                input.value = '';
                showNotification('Đã thêm phân xưởng!', 'success');
                renderConfigView();
                syncStateToCSV();
            }
        }

        function deleteWorkshop(facId, wsId, afterDelete) {
            confirmAction('Xóa phân xưởng này? Toàn bộ nhân sự trong xưởng cũng sẽ bị xóa theo.', () => {
                const fac = state.config.factories.find(f => f.id === facId);
                if (fac) {
                    fac.workshops = fac.workshops.filter(w => w.id !== wsId);
                    showNotification('Đã xóa phân xưởng!', 'success');
                    renderConfigView();
                    syncStateToCSV();
                }
                if (typeof afterDelete === 'function') afterDelete();
            });
        }

        function deleteFactoryMember(facId, memberId) {
            confirmAction('Xóa nhân sự này khỏi nhà máy?', () => {
                const fac = state.config.factories.find(f => f.id === facId);
                if (fac) {
                    fac.members = fac.members.filter(m => m.id !== memberId);
                    showNotification('Đã xóa nhân sự!', 'success');
                    renderConfigView();
                    syncStateToCSV();
                }
            });
        }

        function deleteWorkshopMember(facId, wsId, memberId) {
            confirmAction('Xóa nhân sự này khỏi phân xưởng?', () => {
                const fac = state.config.factories.find(f => f.id === facId);
                const ws = fac && fac.workshops.find(w => w.id === wsId);
                if (ws) {
                    ws.members = ws.members.filter(m => m.id !== memberId);
                    showNotification('Đã xóa nhân sự!', 'success');
                    renderConfigView();
                    syncStateToCSV();
                }
            });
        }

        // kind: 'dept' -> state.config.departments, 'team' -> state.config.specialTeams
        function getUnitList(kind) {
            return kind === 'team' ? state.config.specialTeams : state.config.departments;
        }

        function addDepartment() {
            const input = document.getElementById('cfg-dept-name');
            const val = input.value.trim();
            if (!val) return showNotification('Vui lòng nhập tên phòng ban!', 'error');

            state.config.departments.push({ id: 'D' + Date.now(), name: val, members: [] });
            input.value = '';
            showNotification('Đã thêm phòng ban mới!', 'success');
            renderConfigView();
            syncStateToCSV();
        }

        function addSpecialTeam() {
            const input = document.getElementById('cfg-team-name');
            const val = input.value.trim();
            if (!val) return showNotification('Vui lòng nhập tên tổ chuyên trách!', 'error');

            state.config.specialTeams.push({ id: 'TM' + Date.now(), name: val, members: [] });
            input.value = '';
            showNotification('Đã thêm tổ chuyên trách!', 'success');
            renderConfigView();
            syncStateToCSV();
        }

        function deleteUnit(kind, unitId, afterDelete) {
            const label = kind === 'team' ? 'tổ chuyên trách' : 'phòng ban';
            confirmAction(`Xóa ${label} này? Toàn bộ nhân sự bên trong cũng sẽ bị xóa theo.`, () => {
                if (kind === 'team') {
                    state.config.specialTeams = state.config.specialTeams.filter(t => t.id !== unitId);
                } else {
                    state.config.departments = state.config.departments.filter(d => d.id !== unitId);
                }
                showNotification('Đã xóa đơn vị!', 'success');
                renderConfigView();
                syncStateToCSV();
                if (typeof afterDelete === 'function') afterDelete();
            });
        }

        function deleteUnitMember(kind, unitId, memberId) {
            confirmAction('Xóa nhân sự này khỏi đơn vị?', () => {
                const unit = getUnitList(kind).find(u => u.id === unitId);
                if (!unit) return;
                unit.members = unit.members.filter(m => m.id !== memberId);
                showNotification('Đã xóa nhân sự!', 'success');
                renderConfigView();
                syncStateToCSV();
            });
        }

        function addNewPartner() {
            const nameInput = document.getElementById('cfg-partner-name');
            const typeInput = document.getElementById('cfg-partner-type');
            const name = nameInput.value.trim();
            if (!name) return showNotification('Vui lòng nhập tên đơn vị đối tác!', 'error');

            const categories = typeInput.value.split(',').map(s => s.trim()).filter(s => s);

            state.config.partners.push({
                id: 'P' + Date.now(),
                name,
                categories: categories.length > 0 ? categories : ['Chưa phân loại'],
                members: [],
                equipment: [],
                rating: 0,
                ratingComment: ''
            });
            nameInput.value = '';
            typeInput.value = '';
            showNotification('Đã thêm đơn vị đối tác mới!', 'success');
            renderConfigView();
            syncStateToCSV();
        }

        function deletePartner(id) {
            confirmAction('Xóa đơn vị đối tác này? Toàn bộ người liên hệ, thiết bị và đánh giá sẽ bị xóa theo.', () => {
                state.config.partners = state.config.partners.filter(p => p.id !== id);
                showNotification('Đã xóa đơn vị đối tác!', 'success');
                renderConfigView();
                syncStateToCSV();
            });
        }

        function deletePartnerMember(partnerId, memberId) {
            confirmAction('Xóa người liên hệ này khỏi đối tác?', () => {
                const partner = state.config.partners.find(p => p.id === partnerId);
                if (!partner) return;
                partner.members = partner.members.filter(m => m.id !== memberId);
                showNotification('Đã xóa người liên hệ!', 'success');
                renderConfigView();
                syncStateToCSV();
            });
        }

        // --- Phân loại (tag tự do), Thiết bị & Đánh giá chất lượng của Đối tác ---
        function addPartnerCategory(partnerId) {
            const partner = state.config.partners.find(p => p.id === partnerId);
            if (!partner) return;
            const input = document.getElementById(`cfg-pcat-input-${partnerId}`);
            const val = input.value.trim();
            if (!val) return showNotification('Vui lòng nhập tên phân loại!', 'error');

            partner.categories = partner.categories || [];
            if (partner.categories.includes('Chưa phân loại')) partner.categories = partner.categories.filter(c => c !== 'Chưa phân loại');
            if (!partner.categories.includes(val)) partner.categories.push(val);
            input.value = '';
            renderConfigView();
            syncStateToCSV();
        }

        function removePartnerCategory(partnerId, cat) {
            confirmAction(`Xóa thẻ phân loại "${cat}" khỏi đối tác này?`, () => {
                const partner = state.config.partners.find(p => p.id === partnerId);
                if (!partner) return;
                partner.categories = (partner.categories || []).filter(c => c !== cat);
                if (partner.categories.length === 0) partner.categories = ['Chưa phân loại'];
                renderConfigView();
                syncStateToCSV();
            });
        }

        function addPartnerEquipment(partnerId) {
            const partner = state.config.partners.find(p => p.id === partnerId);
            if (!partner) return;
            const input = document.getElementById(`cfg-pequip-input-${partnerId}`);
            const val = input.value.trim();
            if (!val) return showNotification('Vui lòng nhập tên thiết bị / công việc!', 'error');

            partner.equipment = partner.equipment || [];
            partner.equipment.push(val);
            input.value = '';
            showNotification('Đã thêm thiết bị / công việc!', 'success');
            renderConfigView();
            syncStateToCSV();
        }

        function removePartnerEquipment(partnerId, idx) {
            confirmAction('Xóa mục thiết bị / công việc này?', () => {
                const partner = state.config.partners.find(p => p.id === partnerId);
                if (!partner) return;
                partner.equipment = (partner.equipment || []).filter((_, i) => i !== idx);
                renderConfigView();
                syncStateToCSV();
            });
        }

        function setPartnerRating(partnerId, stars) {
            const partner = state.config.partners.find(p => p.id === partnerId);
            if (!partner) return;
            partner.rating = stars;
            renderConfigView();
            syncStateToCSV();
        }

        function savePartnerRatingComment(partnerId) {
            const partner = state.config.partners.find(p => p.id === partnerId);
            if (!partner) return;
            const textarea = document.getElementById(`cfg-prating-comment-${partnerId}`);
            partner.ratingComment = textarea.value.trim();
            showNotification('Đã lưu nhận xét đánh giá!', 'success');
            syncStateToCSV();
        }

        // INITIAL BOOT
