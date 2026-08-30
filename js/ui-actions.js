
        function normalizePhone(v) {
            if (v === null || v === undefined) return '';
            let s = String(v).trim();
            if (!s) return '';
            s = s.replace(/^'/, '').replace(/\.0$/, '');
            if (/^[0-9]{9}$/.test(s)) s = '0' + s;
            return s;
        }

                function showNotification(msg, type = 'success') {
            const box = document.createElement('div');
            box.className = `fixed bottom-20 right-5 z-50 text-xs px-4 py-3 rounded-xl border shadow-lg transition-all transform duration-300 ${type === 'error' ? 'bg-rose-900/90 text-rose-200 border-rose-500' : 'bg-[#23262F]/90 text-[#B6FF2E] border-[#B6FF2E]/50'}`;
            box.innerText = msg;
            document.body.appendChild(box);
            setTimeout(() => box.remove(), 3500);
        }

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

        function openEditTaskModal(taskId) {
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
            overlay.innerHTML = `
                <div class="bg-[#14161C] border border-[#353945] rounded-2xl p-5 max-w-md w-full space-y-3 shadow-2xl">
                    <h4 class="font-bold text-sm text-[#F4F5F6] flex items-center gap-2">&#x270F;&#xFE0F; Sửa Công Việc</h4>
                    <div>
                        <label class="block text-[10px] text-[#777E90] mb-1">TÊN CÔNG VIỆC</label>
                        <input id="edit-task-title" type="text" value="${(task.title || '').replace(/"/g, '&quot;')}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-sm focus:outline-none focus:ring-1 focus:ring-[#B6FF2E]">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] text-[#777E90] mb-1">DANH MỤC</label>
                            <input id="edit-task-category" type="text" value="${(task.category || '').replace(/"/g, '&quot;')}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-2.5 py-2 text-[#F4F5F6] text-[11px] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E]">
                        </div>
                        <div>
                            <label class="block text-[10px] text-[#777E90] mb-1">THẺ (phân cách dấu phẩy)</label>
                            <input id="edit-task-tags" type="text" value="${(task.tags || []).join(', ').replace(/"/g, '&quot;')}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-2.5 py-2 text-[#F4F5F6] text-[11px] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E]">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] text-[#777E90] mb-1">NGÀY & GIỜ BẮT ĐẦU</label>
                            <input id="edit-task-startdate" type="datetime-local" value="${task.startdate || ''}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-2 py-2 text-[#F4F5F6] text-[11px] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E]">
                        </div>
                        <div>
                            <label class="block text-[10px] text-[#777E90] mb-1">DEADLINE</label>
                            <input id="edit-task-deadline" type="date" value="${task.deadline || ''}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-2 py-2 text-[#F4F5F6] text-[11px] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E]">
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 pt-1">
                        <button id="edit-task-cancel" class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945] transition">Hủy</button>
                        <button id="edit-task-save" class="px-4 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90 transition">Lưu</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            overlay.querySelector('#edit-task-cancel').onclick = close;
            overlay.querySelector('#edit-task-save').onclick = () => {
                const newTitle = overlay.querySelector('#edit-task-title').value.trim();
                if (!newTitle) { showNotification('Tên công việc không được để trống.', 'error'); return; }
                task.title    = newTitle;
                task.category = overlay.querySelector('#edit-task-category').value.trim();
                task.tags     = overlay.querySelector('#edit-task-tags').value.split(',').map(s => s.trim()).filter(Boolean);
                task.startdate = overlay.querySelector('#edit-task-startdate').value;
                task.deadline  = overlay.querySelector('#edit-task-deadline').value;
                close();
                renderTasks(); renderCalendar(); updateDashboardMetrics();
                saveToLocalStorage();
                if (task.gtask && task.googleTaskId) {
                    updateGoogleTaskDetails(task).catch(e => console.warn('[Google Tasks] Không đồng bộ được thay đổi:', e));
                }
                trySyncTasks('✅ Đã lưu thay đổi!');
            };
        }

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
            const modal = document.getElementById('create-task-modal-overlay');
            const titleInput      = modal.querySelector('#modal-task-title');
            const categoryInput   = modal.querySelector('#modal-task-category');
            const tagsInput       = modal.querySelector('#modal-task-tags');
            const areaTypeInput   = modal.querySelector('#modal-task-area-type');
            const areaValueInput  = modal.querySelector('#modal-task-area-value');
            const areaWorkshopInput = modal.querySelector('#modal-task-area-workshop');
            const areaPersonInput = modal.querySelector('#modal-task-area-person');
            const relInput        = modal.querySelector('#modal-task-relation');
            const personInput     = modal.querySelector('#modal-task-person');
            const startInput      = modal.querySelector('#modal-task-startdate');
            const deadlineInput   = modal.querySelector('#modal-task-deadline');

            const title = titleInput ? titleInput.value.trim() : '';
            if (!title) return showNotification('Vui lòng nhập tên công việc!', 'error');

            const areaValue = areaValueInput ? areaValueInput.value : '';
            if (!areaValue) return showNotification('Vui lòng chọn Khu vực cụ thể!', 'error');

            const relation = relInput ? relInput.value : 'my-task';
            const personName = (relation !== 'my-task' && personInput) ? personInput.value : '';
            if (relation !== 'my-task' && !personName) {
                return showNotification('Vui lòng chọn người ở mục Phân quyền!', 'error');
            }

            const workshopWrap = modal.querySelector('#modal-task-area-workshop-wrap');
            const personWrap   = modal.querySelector('#modal-task-area-person-wrap');

            const newTask = {
                id:          'T' + Date.now(),
                title:       title,
                desc:        '',
                areaType:    areaTypeInput ? areaTypeInput.value : 'factory',
                areaValue:   areaValue,
                areaWorkshop: (areaWorkshopInput && workshopWrap && !workshopWrap.classList.contains('hidden')) ? areaWorkshopInput.value : '',
                areaPerson:  (areaPersonInput && personWrap && !personWrap.classList.contains('hidden')) ? areaPersonInput.value : '',
                relation:    relation,
                personName:  personName,
                status:      'Todo',
                priority:    'Q2',
                startdate:   startInput ? startInput.value : '',
                deadline:    deadlineInput ? deadlineInput.value : '',
                gtask:       false,
                createdAt:   new Date().toISOString(),
                objective:       '',
                expectedResult:  '',
                category:        categoryInput ? categoryInput.value.trim() : '',
                tags:            tagsInput ? tagsInput.value.split(',').map(s => s.trim()).filter(Boolean) : [],
                plan:            buildPlanFromCheckedSuggestions()
            };

            state.tasks.unshift(newTask);
            closeCreateTaskModal();
            renderTasks(); renderCalendar(); updateDashboardMetrics();
            saveToLocalStorage();

            await trySyncTasks('✅ Đã lưu lên Google Sheets!');
        }

        async function toggleTaskDone(id) {
            const task = state.tasks.find(t => t.id === id);
            if (!task) return;

            task.status = task.status === 'Done' ? 'Todo' : 'Done';
            const isDone = task.status === 'Done';
            saveToLocalStorage();

            // Nếu bộ lọc trạng thái hiện tại sẽ làm task này cần ẩn/hiện lại trong danh
            // sách (VD đang lọc "Chưa hoàn thành" mà vừa tick Xong), phải render lại toàn
            // bộ danh sách. Các trường hợp còn lại chỉ cập nhật DOM tại chỗ — không đụng
            // tới phần "Kế hoạch AI" bên trong card, tránh bị thu gọn ngoài ý muốn.
            const statusFilterEl = document.getElementById('task-status-filter');
            const statusVal = statusFilterEl ? statusFilterEl.value : 'all';
            const needFullRerender =
                (statusVal === 'todo' && isDone) ||
                (statusVal === 'done' && !isDone) ||
                (statusVal === 'overdue'); // phụ thuộc deadline, an toàn thì render lại

            if (needFullRerender) {
                renderTasks();
            } else {
                updateTaskDoneVisual(id, isDone);
            }
            renderCalendar(); updateDashboardMetrics();

            if (task.gtask && task.googleTaskId) {
                updateGoogleTaskStatus(task).catch(e => console.warn('[Google Tasks] Không đồng bộ được trạng thái:', e));
            }
            await trySyncTasks();
        }

        // Cập nhật trực tiếp giao diện 1 thẻ công việc khi tick Xong/Chưa xong,
        // KHÔNG rebuild lại DOM của thẻ đó — giữ nguyên trạng thái mở/đóng của khối
        // "Kế hoạch AI" bên trong, tránh hiện tượng bị thu gọn khi vừa bấm tick.
        function updateTaskDoneVisual(taskId, isDone) {
            const card = document.querySelector(`[data-task-id="${taskId}"]`);
            if (!card) { renderTasks(); return; }

            const task = state.tasks.find(t => t.id === taskId);
            const overdue = !isDone && task && isOverdue(task.deadline);

            card.classList.toggle('opacity-50', isDone);
            card.classList.remove('border-rose-500/40', 'border-[#353945]', 'hover:border-[#B6FF2E]/30');
            if (overdue) {
                card.classList.add('border-rose-500/40');
            } else {
                card.classList.add('border-[#353945]');
                if (!isDone) card.classList.add('hover:border-[#B6FF2E]/30');
            }

            const titleEl = card.querySelector('.task-title-text');
            if (titleEl) {
                titleEl.classList.toggle('line-through', isDone);
                titleEl.classList.toggle('text-[#777E90]', isDone);
            }

            const cb = card.querySelector('.task-done-checkbox');
            if (cb) cb.checked = isDone;
        }

        function deleteTask(id) {
            confirmAction('Bạn có chắc muốn xóa công việc này? Hành động này không thể hoàn tác.', async () => {
                const task = state.tasks.find(t => t.id === id);
                if (task && task.gtask && task.googleTaskId) {
                    deleteTaskFromGoogleTasks(task).catch(e => console.warn('[Google Tasks] Không xóa được bên Google Tasks:', e));
                }
                state.tasks = state.tasks.filter(t => t.id !== id);
                showNotification('Đã xóa công việc!', 'success');
                renderTasks(); renderCalendar(); updateDashboardMetrics();
                saveToLocalStorage();
                await trySyncTasks();
            });
        }

        function addNewLogEntry() {
            const typeInput      = document.getElementById('log-type-input');
            const titleInput     = document.getElementById('log-title-input');
            const attendeesInput = document.getElementById('log-attendees-input');
            const textInput      = document.getElementById('log-text-input');
            const linkedTaskInput = document.getElementById('log-linked-task-input');
            const tagsInput      = document.getElementById('log-tags-input');

            const text = textInput.value.trim();
            if (!text) return showNotification('Vui lòng nhập nội dung nhật ký!', 'error');

            const now = new Date();
            const timeStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

            state.logs.unshift({
                id: 'L' + Date.now(),
                timestamp: timeStr,
                author: 'Cá nhân',
                type: typeInput ? typeInput.value : 'work',
                title: titleInput ? titleInput.value.trim() : '',
                text: text,
                attendees: (attendeesInput && !document.getElementById('log-attendees-wrap').classList.contains('hidden'))
                    ? attendeesInput.value.split(',').map(s => s.trim()).filter(Boolean) : [],
                linkedTaskId: linkedTaskInput ? linkedTaskInput.value : '',
                tags: tagsInput ? tagsInput.value.split(',').map(s => s.trim()).filter(Boolean) : []
            });

            titleInput.value = '';
            attendeesInput.value = '';
            textInput.value = '';
            tagsInput.value = '';
            linkedTaskInput.value = '';
            showNotification('Đã ghi vào nhật ký!', 'success');
            renderLogs();
            syncStateToCSV();
        }

        function deleteLogEntry(id) {
            confirmAction('Bạn có chắc muốn xoá nhật ký này?', () => {
                state.logs = state.logs.filter(l => l.id !== id);
                showNotification('Đã xoá nhật ký!', 'success');
                renderLogs();
                syncStateToCSV();
            });
        }

        function openEditLogModal(logId) {
            const log = state.logs.find(l => l.id === logId);
            if (!log) return;

            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
            overlay.innerHTML = `
                <div class="bg-[#14161C] border border-[#353945] rounded-2xl p-5 max-w-md w-full space-y-3 shadow-2xl">
                    <h4 class="font-bold text-sm text-[#F4F5F6] flex items-center gap-2">&#x270F;&#xFE0F; Sửa Nhật Ký</h4>
                    <div>
                        <label class="block text-[10px] text-[#777E90] mb-1">LOẠI</label>
                        <select id="edit-log-type" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-xs focus:outline-none">
                            ${Object.keys(LOG_TYPE_DEFS).map(t => `<option value="${t}" ${log.type === t ? 'selected' : ''}>${LOG_TYPE_DEFS[t].label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] text-[#777E90] mb-1">TIÊU ĐỀ</label>
                        <input id="edit-log-title" type="text" value="${(log.title || '').replace(/"/g, '&quot;')}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-xs focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-[10px] text-[#777E90] mb-1">NGƯỜI THAM DỰ (phân cách dấu phẩy)</label>
                        <input id="edit-log-attendees" type="text" value="${(log.attendees || []).join(', ').replace(/"/g, '&quot;')}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-xs focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-[10px] text-[#777E90] mb-1">NỘI DUNG</label>
                        <textarea id="edit-log-text" rows="4" class="w-full bg-[#23262F] border border-[#353945] rounded-xl p-2.5 text-[#F4F5F6] text-xs focus:outline-none resize-none">${log.text || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] text-[#777E90] mb-1">LIÊN KẾT CÔNG VIỆC</label>
                        <select id="edit-log-linked-task" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-xs focus:outline-none">
                            <option value="">-- Không liên kết --</option>
                            ${state.tasks.map(t => `<option value="${t.id}" ${log.linkedTaskId === t.id ? 'selected' : ''}>${t.title}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] text-[#777E90] mb-1">THẺ (phân cách dấu phẩy)</label>
                        <input id="edit-log-tags" type="text" value="${(log.tags || []).join(', ').replace(/"/g, '&quot;')}" class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2 text-[#F4F5F6] text-xs focus:outline-none">
                    </div>
                    <div class="flex justify-end gap-2 pt-1">
                        <button id="edit-log-cancel" class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945] transition">Hủy</button>
                        <button id="edit-log-save" class="px-4 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90 transition">Lưu</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            overlay.querySelector('#edit-log-cancel').onclick = close;
            overlay.querySelector('#edit-log-save').onclick = () => {
                const newText = overlay.querySelector('#edit-log-text').value.trim();
                if (!newText) { showNotification('Nội dung không được để trống.', 'error'); return; }
                log.type = overlay.querySelector('#edit-log-type').value;
                log.title = overlay.querySelector('#edit-log-title').value.trim();
                log.attendees = overlay.querySelector('#edit-log-attendees').value.split(',').map(s => s.trim()).filter(Boolean);
                log.text = newText;
                log.linkedTaskId = overlay.querySelector('#edit-log-linked-task').value;
                log.tags = overlay.querySelector('#edit-log-tags').value.split(',').map(s => s.trim()).filter(Boolean);
                close();
                showNotification('Đã lưu thay đổi nhật ký!', 'success');
                renderLogs();
                syncStateToCSV();
            };
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
            completedTasks.forEach(t => { summaryText += ` - ${t.title} [${t.priority}]\n`; });
            summaryText += `\n2. NHẬT KÝ XỬ LÝ NỔI BẬT:\n`;
            state.logs.slice(0, 5).forEach(l => { summaryText += ` - [${l.timestamp}] ${l.text}\n`; });

            const now = new Date();
            const timeStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            state.logs.unshift({
                id: 'L' + Date.now(),
                timestamp: timeStr,
                author: 'Hệ Thống',
                type: 'note',
                title: 'Báo cáo tổng hợp tuần',
                text: summaryText,
                attendees: [],
                linkedTaskId: '',
                tags: ['báo cáo tuần']
            });
            showNotification('Đã tự động tổng hợp Báo cáo tuần vào Nhật ký!', 'success');
            renderLogs();
            syncStateToCSV();
        }

        function addNewFactory() {
            const input = document.getElementById('cfg-factory-name');
            const val = input.value.trim();
            if (!val) return showNotification('Vui lòng nhập tên nhà máy!', 'error');
            state.config.factories.push({ id: 'F' + Date.now(), name: val, members: [], workshops: [] });
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
                id: 'P' + Date.now(), name,
                categories: categories.length > 0 ? categories : ['Chưa phân loại'],
                members: [], equipment: [], rating: 0, ratingComment: ''
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

        // Tương thích — chuyển hướng sang saveAddNew mới
        function addPersonnelUnified() {
            if (typeof saveAddNew === 'function') saveAddNew();
        }

        // =============================================================
        // MODAL TẠO CÔNG VIỆC MỚI
        // =============================================================
        function openCreateTaskModal() {
            refreshTaskFormOptions();
            resetAiPlanState();
            const hint = document.getElementById('ai-plan-empty-hint');
            if (hint) hint.classList.remove('hidden');
            document.getElementById('create-task-modal-overlay').classList.remove('hidden');
        }

        function closeCreateTaskModal() {
            document.getElementById('create-task-modal-overlay').classList.add('hidden');
        }

        // INITIAL BOOT
