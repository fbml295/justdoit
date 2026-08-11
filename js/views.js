        function renderInitiatives() {
            const container = document.getElementById('initiatives-render-area');
            if (!container) return;
            container.innerHTML = '';

            if (state.initiatives.length === 0) {
                container.innerHTML = `
                    <div class="bg-[#14161C] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">
                        💡 Chưa có đề xuất sáng kiến / dự án nào. Hãy nhập thông tin đề xuất ở form bên trái!
                    </div>
                `;
                return;
            }

            state.initiatives.forEach(item => {
                const card = document.createElement('div');
                card.className = "bg-[#14161C] p-5 rounded-2xl border border-[#353945] space-y-3";
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-sm text-[#F4F5F6]">${item.title}</h4>
                        <span class="text-[10px] bg-[#B6FF2E]/10 text-[#B6FF2E] border border-[#B6FF2E]/30 px-2 py-0.5 rounded font-mono">${item.status || 'Đang triển khai'}</span>
                    </div>
                    <p class="text-xs text-[#777E90]">${item.desc}</p>
                    <div class="space-y-1">
                        <div class="flex justify-between text-[11px]">
                            <span class="text-[#777E90]">Tiến độ thực hiện</span>
                            <span class="text-[#B6FF2E] font-mono">${item.progress || 0}%</span>
                        </div>
                        <div class="w-full bg-[#23262F] h-1.5 rounded-full overflow-hidden">
                            <div class="bg-[#B6FF2E] h-full" style="width: ${item.progress || 0}%"></div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        const LOG_TYPE_DEFS = {
            work:     { label: '📋 Nhật ký công việc', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
            meeting:  { label: '🗓️ Biên bản họp',      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
            note:     { label: '📝 Ghi chú',            color: 'text-[#B6FF2E] bg-[#B6FF2E]/10 border-[#B6FF2E]/30' },
            incident: { label: '⚠️ Sự cố',              color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
        };

        let selectedLogTypeFilters = new Set();

        function toggleLogTypeFilter(type) {
            if (selectedLogTypeFilters.has(type)) selectedLogTypeFilters.delete(type);
            else selectedLogTypeFilters.add(type);
            renderLogs();
        }
        function clearLogTypeFilters() {
            selectedLogTypeFilters.clear();
            renderLogs();
        }
        function renderLogTypeFilterChips() {
            const chipContainer = document.getElementById('log-type-filter-chips');
            if (!chipContainer) return;
            chipContainer.innerHTML = Object.keys(LOG_TYPE_DEFS).map(type => {
                const active = selectedLogTypeFilters.has(type);
                return `<button onclick="toggleLogTypeFilter('${type}')" class="text-[10px] px-2.5 py-1 rounded-full border font-mono transition ${active ? 'bg-[#B6FF2E] text-[#14161C] border-[#B6FF2E]' : 'bg-[#23262F] text-[#777E90] border-[#353945] hover:border-[#B6FF2E]/40'}">${LOG_TYPE_DEFS[type].label}</button>`;
            }).join('') + (selectedLogTypeFilters.size > 0
                ? `<button onclick="clearLogTypeFilters()" class="text-[10px] px-2.5 py-1 rounded-full border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20">✕ Bỏ lọc</button>`
                : '');
        }

        // Hiện/ẩn ô "Người tham dự" tuỳ theo Loại đang chọn (chỉ có ý nghĩa với Biên bản họp)
        function onLogTypeChange() {
            const typeInput = document.getElementById('log-type-input');
            const wrap = document.getElementById('log-attendees-wrap');
            if (typeInput && wrap) wrap.classList.toggle('hidden', typeInput.value !== 'meeting');
        }

        // Đổ danh sách công việc vào select "Liên kết công việc" (gọi lại mỗi khi renderLogs)
        function populateLogLinkedTaskSelect() {
            const sel = document.getElementById('log-linked-task-input');
            if (!sel) return;
            const current = sel.value;
            sel.innerHTML = '<option value="">-- Không liên kết --</option>'
                + state.tasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
            if (current && state.tasks.some(t => t.id === current)) sel.value = current;
        }

        function renderLogs() {
            const container = document.getElementById('logs-render-area');
            if (!container) return;
            container.innerHTML = '';
            renderLogTypeFilterChips();
            populateLogLinkedTaskSelect();

            if (state.logs.length === 0) {
                container.innerHTML = `
                    <div class="bg-[#23262F] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">
                        📝 Nhật ký đang trống. Hãy ghi chép ở ô bên trái!
                    </div>
                `;
                return;
            }

            const searchInput = document.getElementById('log-search-input');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            let filteredLogs = state.logs;

            if (searchTerm) {
                filteredLogs = filteredLogs.filter(l => {
                    const inTitle = (l.title || '').toLowerCase().includes(searchTerm);
                    const inText = (l.text || '').toLowerCase().includes(searchTerm);
                    const inTags = (l.tags || []).some(t => t.toLowerCase().includes(searchTerm));
                    return inTitle || inText || inTags;
                });
            }
            if (selectedLogTypeFilters.size > 0) {
                filteredLogs = filteredLogs.filter(l => selectedLogTypeFilters.has(l.type || 'work'));
            }

            if (filteredLogs.length === 0) {
                container.innerHTML = `
                    <div class="bg-[#23262F] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">
                        🔍 Không tìm thấy nhật ký nào phù hợp với tìm kiếm/bộ lọc hiện tại.
                    </div>
                `;
                return;
            }

            filteredLogs.forEach(log => {
                const typeDef = LOG_TYPE_DEFS[log.type || 'work'] || LOG_TYPE_DEFS.work;
                const linkedTask = log.linkedTaskId ? state.tasks.find(t => t.id === log.linkedTaskId) : null;

                const card = document.createElement('div');
                card.className = "bg-[#23262F] p-4 rounded-xl border border-[#353945] space-y-2 text-xs";
                card.innerHTML = `
                    <div class="flex justify-between items-start gap-2 text-[#777E90] border-b border-[#353945] pb-1.5">
                        <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span class="text-[10px] px-2 py-0.5 rounded-full border font-mono ${typeDef.color}">${typeDef.label}</span>
                            ${log.title ? `<span class="font-semibold text-[#F4F5F6] truncate">${log.title}</span>` : ''}
                        </div>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <span class="font-mono text-[10px]">${log.timestamp || ''}</span>
                            <button onclick="openEditLogModal('${log.id}')" title="Sửa" class="text-[#777E90] hover:text-[#B6FF2E] px-1.5 py-0.5 bg-[#14161C] rounded-lg border border-[#353945]">&#x270F;&#xFE0F;</button>
                            <button onclick="deleteLogEntry('${log.id}')" title="Xoá" class="text-[#777E90] hover:text-rose-400 px-1.5 py-0.5 bg-[#14161C] rounded-lg border border-[#353945]">&#x2715;</button>
                        </div>
                    </div>
                    <p class="text-[#F4F5F6] leading-relaxed whitespace-pre-wrap">${log.text}</p>
                    ${log.attendees && log.attendees.length ? `<p class="text-[10px] text-[#777E90]">👥 Tham dự: ${log.attendees.join(', ')}</p>` : ''}
                    ${linkedTask ? `<p class="text-[10px] text-[#B6FF2E]">🔗 Liên kết: ${linkedTask.title}</p>` : ''}
                    ${log.tags && log.tags.length ? `<div class="flex flex-wrap gap-1">${log.tags.map(t => `<span class="text-[10px] text-[#777E90] bg-[#14161C] px-1.5 py-0.5 rounded">#${t}</span>`).join('')}</div>` : ''}
                    <p class="text-[10px] text-[#777E90] pt-1 border-t border-[#353945]">✍️ ${log.author || 'Cá nhân'}</p>
                `;
                container.appendChild(card);
            });
        }

        function renderConfigView() {
            // Đồng bộ luôn options ở form tạo Công việc (Khu vực / Phân quyền) mỗi khi Cấu hình thay đổi
            refreshTaskFormOptions();

            renderOrgChartMindmap();
            renderPartnerCards();

            renderPersonnelDirectory();
            if (document.getElementById('personnel-scope-input')) onPersonnelScopeChange();
        }

        // Namecard nhân sự dùng chung cho phòng ban/tổ đội/đối tác
        function renderMemberCard(m, onDelete) {
            const phoneDisplay = normalizePhone(m.phone);
            return `
                <div class="bg-[#23262F] border border-[#353945] rounded-xl p-3 space-y-1">
                    <div class="flex items-center justify-between">
                        <h5 class="font-bold text-xs text-[#F4F5F6]">${m.name}</h5>
                        <button onclick="${onDelete}" class="text-rose-400 hover:text-rose-300 text-[10px] px-1.5 py-0.5 bg-[#14161C] rounded-lg border border-[#353945]">Xóa</button>
                    </div>
                    ${m.role ? `<p class="text-[10px] text-[#B6FF2E]">${m.role}</p>` : ''}
                    <div class="text-[10px] text-[#777E90] space-y-0.5">
                        ${phoneDisplay ? `<p>📞 ${phoneDisplay}</p>` : ''}
                        ${m.email ? `<p>✉️ ${m.email}</p>` : ''}
                        ${(!phoneDisplay && !m.email) ? '<p class="italic">Chưa có SĐT/Email</p>' : ''}
                    </div>
                </div>
            `;
        }

        // ============ SƠ ĐỒ TỔ CHỨC DẠNG MINDMAP (D3.js, cây ngang mở từ trái sang phải) ============
        let orgExpandedIds = new Set();   // các node đã được người dùng bấm mở (mặc định mọi thứ ngoài gốc đều thu gọn)
        let orgZoomTransform = null;       // giữ lại vị trí kéo/phóng to giữa các lần vẽ lại
        let orgZoomBehavior = null;
        let selectedOrgId = null;
        let selectedOrgRef = null;

        function orgNodeColor(kind) {
            return { root:'#B6FF2E', factory:'#38BDF8', workshop:'#60A5FA', dept:'#A78BFA', team:'#FBBF24', member:'#34D399' }[kind] || '#777E90';
        }

        function memberNode(m, ref) {
            return { id: 'm-' + m.id, name: m.name + (m.role ? ' — ' + m.role : ''), kind: 'member', ref: { ...ref, memberId: m.id }, children: [] };
        }

        function unitOcNode(u, kind) {
            return {
                id: kind + '-' + u.id, name: u.name, kind, ref: { kind, unitId: u.id },
                count: (u.members || []).length,
                children: (u.members || []).map(m => memberNode(m, { kind, unitId: u.id }))
            };
        }

        // Dựng cây dữ liệu Công Ty > Nhà máy (> Xưởng) / Phòng ban / Tổ chuyên trách > Nhân sự
        function buildOrgHierarchy() {
            const factories = state.config.factories || [];
            const depts = state.config.departments || [];
            const teams = state.config.specialTeams || [];

            const factoryNodes = factories.map(f => {
                const wsNodes = (f.workshops || []).map(ws => ({
                    id: 'ws-' + ws.id, name: ws.name, kind: 'workshop', ref: { kind: 'workshop', facId: f.id, wsId: ws.id },
                    count: (ws.members || []).length,
                    children: (ws.members || []).map(m => memberNode(m, { kind: 'workshop', facId: f.id, wsId: ws.id }))
                }));
                const facMemberNodes = (f.members || []).map(m => memberNode(m, { kind: 'factory', facId: f.id }));
                const total = (f.members || []).length + (f.workshops || []).reduce((s, w) => s + (w.members || []).length, 0);
                return {
                    id: 'f-' + f.id, name: f.name, kind: 'factory', ref: { kind: 'factory', facId: f.id },
                    count: total,
                    children: [...facMemberNodes, ...wsNodes]
                };
            });

            return {
                id: 'root', name: 'CÔNG TY', kind: 'root', ref: { kind: 'root' },
                children: [...factoryNodes, ...depts.map(d => unitOcNode(d, 'dept')), ...teams.map(t => unitOcNode(t, 'team'))]
            };
        }

        function resolveMembersArray(ref) {
            if (!ref) return null;
            if (ref.kind === 'factory') { const f = (state.config.factories || []).find(x => x.id === ref.facId); return f ? f.members : null; }
            if (ref.kind === 'workshop') { const f = (state.config.factories || []).find(x => x.id === ref.facId); const ws = f && f.workshops.find(w => w.id === ref.wsId); return ws ? ws.members : null; }
            if (ref.kind === 'dept') { const d = (state.config.departments || []).find(x => x.id === ref.unitId); return d ? d.members : null; }
            if (ref.kind === 'team') { const t = (state.config.specialTeams || []).find(x => x.id === ref.unitId); return t ? t.members : null; }
            if (ref.kind === 'partner') { const p = (state.config.partners || []).find(x => x.id === ref.unitId); return p ? p.members : null; }
            return null;
        }

        function renderOrgSidePanel(nodeData) {
            const panel = document.getElementById('orgchart-sidepanel');
            if (!panel) return;
            const ref = nodeData.ref;
            const kindLabel = { factory: 'Nhà Máy', workshop: 'Phân Xưởng', dept: 'Phòng Ban', team: 'Tổ Chuyên Trách', member: 'Nhân Sự' }[nodeData.kind] || '';

            if (nodeData.kind === 'root') {
                panel.innerHTML = `
                    <div class="text-center text-xs text-[#777E90] py-6">
                        🏢 <span class="text-[#F4F5F6] font-bold">CÔNG TY</span><br>
                        Bấm vào 1 nhánh (Nhà máy / Phòng ban / Tổ) để xem danh sách nhân sự.
                    </div>`;
                return;
            }

            if (nodeData.kind === 'member') {
                const arr = resolveMembersArray(ref) || [];
                const m = arr.find(x => x.id === ref.memberId);
                panel.innerHTML = `
                    <div class="space-y-2">
                        <span class="text-[10px] font-mono text-[#777E90]">NHÂN SỰ</span>
                        ${m ? renderMemberCard(m, `orgDeleteSelectedMember()`) : '<p class="text-xs text-[#777E90]">Không tìm thấy, có thể đã bị xóa.</p>'}
                    </div>`;
                return;
            }

            const members = resolveMembersArray(ref) || [];
            const deleteUnitBtn = {
                factory: `<button onclick="orgDeleteUnit()" class="w-full py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold hover:bg-rose-500/20">🗑️ Xóa nhà máy này</button>`,
                workshop: `<button onclick="orgDeleteUnit()" class="w-full py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold hover:bg-rose-500/20">🗑️ Xóa xưởng này</button>`,
                dept: `<button onclick="orgDeleteUnit()" class="w-full py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold hover:bg-rose-500/20">🗑️ Xóa phòng ban này</button>`,
                team: `<button onclick="orgDeleteUnit()" class="w-full py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold hover:bg-rose-500/20">🗑️ Xóa tổ này</button>`
            }[nodeData.kind] || '';
            panel.innerHTML = `
                <div class="space-y-3">
                    <div>
                        <span class="text-[10px] font-mono text-[#777E90]">${kindLabel.toUpperCase()}</span>
                        <h4 class="font-bold text-sm text-[#F4F5F6]">${nodeData.name}</h4>
                    </div>
                    <div>
                        <span class="text-[10px] font-mono text-[#777E90]">NHÂN SỰ (${members.length}) — thêm mới ở tab 👤 Nhân Sự</span>
                        <div class="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-1 mt-1.5">
                            ${members.length > 0 ? members.map(m => renderMemberCard(m, `orgDeleteMember('${m.id}')`)).join('') : '<span class="text-[11px] text-[#777E90] italic">Chưa có nhân sự.</span>'}
                        </div>
                    </div>
                    ${deleteUnitBtn ? `<div class="pt-2 border-t border-[#353945]">${deleteUnitBtn}</div>` : ''}
                </div>
            `;
        }

        function orgDeleteUnit() {
            if (!selectedOrgRef) return;
            const ref = selectedOrgRef;
            const resetPanel = () => {
                selectedOrgId = null; selectedOrgRef = null;
                renderOrgSidePanel({ kind: 'root', ref: { kind: 'root' } });
            };
            if (ref.kind === 'factory') deleteFactory(ref.facId, resetPanel);
            else if (ref.kind === 'workshop') deleteWorkshop(ref.facId, ref.wsId, resetPanel);
            else if (ref.kind === 'dept' || ref.kind === 'team') deleteUnit(ref.kind, ref.unitId, resetPanel);
        }

        function orgDeleteMember(memberId) {
            confirmAction('Xóa nhân sự này?', () => {
                const arr = resolveMembersArray(selectedOrgRef);
                if (!arr) return;
                const idx = arr.findIndex(m => m.id === memberId);
                if (idx > -1) arr.splice(idx, 1);
                showNotification('Đã xóa nhân sự!', 'success');
                renderConfigView();
            });
        }

        function orgDeleteSelectedMember() {
            confirmAction('Xóa nhân sự này?', () => {
                const arr = resolveMembersArray(selectedOrgRef);
                if (!arr || !selectedOrgRef) return;
                const idx = arr.findIndex(m => m.id === selectedOrgRef.memberId);
                if (idx > -1) arr.splice(idx, 1);
                selectedOrgId = null; selectedOrgRef = null;
                showNotification('Đã xóa nhân sự!', 'success');
                renderConfigView();
                renderOrgSidePanel({ kind: 'root', ref: { kind: 'root' } });
            });
        }

        function onOrgNodeClick(d) {
            selectedOrgId = d.data.id;
            selectedOrgRef = d.data.ref;
            renderOrgSidePanel(d.data);

            if (d.data.kind !== 'member') {
                if (orgExpandedIds.has(d.data.id)) orgExpandedIds.delete(d.data.id);
                else orgExpandedIds.add(d.data.id);
            }
            renderOrgChartMindmap();
        }

        function orgZoomIn() {
            const svg = d3.select('#orgchart-mindmap svg');
            if (!svg.empty() && orgZoomBehavior) svg.transition().duration(200).call(orgZoomBehavior.scaleBy, 1.3);
        }
        function orgZoomOut() {
            const svg = d3.select('#orgchart-mindmap svg');
            if (!svg.empty() && orgZoomBehavior) svg.transition().duration(200).call(orgZoomBehavior.scaleBy, 0.7);
        }
        function orgZoomReset() {
            const svg = d3.select('#orgchart-mindmap svg');
            if (!svg.empty() && orgZoomBehavior) {
                svg.transition().duration(300).call(orgZoomBehavior.transform, d3.zoomIdentity);
                orgZoomTransform = d3.zoomIdentity;
            }
        }

        // Vẽ sơ đồ tổ chức dạng mindmap cây ngang, gốc bên trái mở dần sang phải (giống NotebookLM)
        // Có kéo (pan) & phóng to/thu nhỏ (zoom), bấm vào 1 nhánh để mở/thu gọn hoặc xem chi tiết
        function renderOrgChartMindmap() {
            const container = document.getElementById('orgchart-mindmap');
            if (!container || typeof d3 === 'undefined') return;

            const existingSvg = container.querySelector('svg');
            if (existingSvg && existingSvg.__zoomTransform__) orgZoomTransform = existingSvg.__zoomTransform__;

            container.innerHTML = '';

            const dx = 28;   // khoảng cách dọc giữa 2 node liền kề cùng cấp
            const dy = 250;  // khoảng cách ngang giữa các cấp (độ sâu)
            const cssHeight = 640;

            const data = buildOrgHierarchy();
            const root = d3.hierarchy(data);

            // Áp trạng thái mở/thu gọn: mọi thứ ngoài gốc đều thu gọn mặc định, trừ khi người dùng đã bấm mở
            root.each(d => {
                if (d.depth === 0) return;
                if (d.children && !orgExpandedIds.has(d.data.id)) {
                    d._children = d.children;
                    d.children = null;
                }
            });

            const treeLayout = d3.tree().nodeSize([dx, dy]);
            treeLayout(root);

            let x0 = Infinity, x1 = -Infinity, y1 = 0;
            root.each(d => {
                if (d.x > x1) x1 = d.x;
                if (d.x < x0) x0 = d.x;
                if (d.y > y1) y1 = d.y;
            });

            const marginTop = 40, marginBottom = 40, marginLeft = 20, marginRight = 220;
            const viewHeight = (x1 - x0) + marginTop + marginBottom;
            const viewWidth = y1 + marginLeft + marginRight;

            const svg = d3.select(container).append('svg')
                .attr('viewBox', [-marginLeft, x0 - marginTop, viewWidth, viewHeight])
                .style('width', '100%').style('height', cssHeight + 'px').style('cursor', 'grab');

            const g = svg.append('g');

            const zoomBehavior = d3.zoom().scaleExtent([0.3, 4]).on('zoom', (event) => {
                g.attr('transform', event.transform);
                svg.node().__zoomTransform__ = event.transform;
            });
            svg.call(zoomBehavior);
            if (orgZoomTransform) svg.call(zoomBehavior.transform, orgZoomTransform);
            orgZoomBehavior = zoomBehavior;

            // Đường nối kiểu vuông góc (elbow, bo góc nhẹ): đi thẳng ra ngoài trước ở đúng hàng của cha
            // (đoạn chạy ngang dài nằm gọn trên hàng của cha, không cắt qua chữ của nhánh khác),
            // rồi mới rẽ dọc sát về phía nhánh con để vào đúng hàng của con.
            function elbowPath(link) {
                const sy = link.source.y, sx = link.source.x;
                const ty = link.target.y, tx = link.target.x;
                if (sx === tx) return `M${sy},${sx}H${ty}`;

                const stub = 24; // khoảng cách từ trục xương sống đến nhánh con
                const midY = Math.max(sy + 6, ty - stub);
                const r = Math.min(10, Math.abs(tx - sx) / 2, Math.abs(midY - sy) / 2, Math.abs(ty - midY) / 2);
                if (r < 1) return `M${sy},${sx}H${midY}V${tx}H${ty}`;

                const dirV = tx > sx ? 1 : -1;
                return `M${sy},${sx}` +
                    `H${midY - r}` +
                    `Q${midY},${sx} ${midY},${sx + r * dirV}` +
                    `V${tx - r * dirV}` +
                    `Q${midY},${tx} ${midY + r},${tx}` +
                    `H${ty}`;
            }

            // Vẽ đường nối trước (nằm dưới cùng), để node và chữ luôn hiện rõ phía trên
            g.append('g').attr('fill', 'none').attr('stroke', '#353945').attr('stroke-width', 1.5)
                .selectAll('path').data(root.links()).join('path').attr('d', elbowPath);

            const node = g.append('g').selectAll('g').data(root.descendants()).join('g')
                .attr('transform', d => `translate(${d.y},${d.x})`)
                .style('cursor', d => d.data.kind === 'member' ? 'default' : 'pointer')
                .on('click', (event, d) => { event.stopPropagation(); onOrgNodeClick(d); });

            node.append('circle')
                .attr('r', d => d.depth === 0 ? 16 : (d.data.kind === 'member' ? 6 : 11))
                .attr('fill', d => orgNodeColor(d.data.kind))
                .attr('stroke', d => selectedOrgId === d.data.id ? '#FFFFFF' : '#0D0E12')
                .attr('stroke-width', d => selectedOrgId === d.data.id ? 3 : 2);

            // Số lượng nhân sự hiển thị ngay trong chấm tròn — có số nghĩa là còn cấp bên dưới, không cần dấu +/- nữa
            node.filter(d => d.data.kind !== 'member' && d.depth > 0).append('text')
                .attr('text-anchor', 'middle').attr('dy', '0.32em')
                .attr('fill', '#0D0E12').attr('font-size', '9px').attr('font-weight', '900')
                .text(d => d.data.count);

            const nameText = node.append('text')
                .attr('x', 18)
                .attr('dy', '0.32em')
                .attr('text-anchor', 'start')
                .attr('font-size', d => d.depth === 0 ? '13px' : '11px')
                .attr('font-weight', d => d.depth === 0 ? '700' : '500')
                .attr('stroke', '#0D0E12')
                .attr('stroke-width', 5)
                .attr('stroke-linejoin', 'round')
                .style('paint-order', 'stroke')
                .attr('fill', '#F4F5F6')
                .text(d => d.data.name);

            if (root.descendants().length <= 1) {
                container.insertAdjacentHTML('beforeend', `<div class="absolute inset-0 flex items-center justify-center text-xs text-[#777E90] pointer-events-none">Chưa có Nhà máy / Phòng ban / Tổ chuyên trách nào. Hãy thêm mới ở ô phía trên!</div>`);
            }
        }

        // Vẽ sao đánh giá bằng SVG (không dùng ký tự ★ vì font hiển thị viền khó nhìn ở sao chưa chọn)
        function renderStarsSVG(rating, opts) {
            opts = opts || {};
            const size = opts.size || 16;
            const clickable = !!opts.clickable;
            let html = '<span class="inline-flex items-center gap-0.5 align-middle">';
            for (let n = 1; n <= 5; n++) {
                const filled = n <= rating;
                const fillColor = filled ? '#FBBF24' : '#3A3F4B';
                const path = '<path d="M12 2.5l2.95 6.53 7.05.66-5.35 4.9 1.6 7.16L12 17.9l-6.25 3.85 1.6-7.16-5.35-4.9 7.05-.66L12 2.5z"/>';
                if (clickable) {
                    html += `<button type="button" onclick="setPartnerRating('${opts.partnerId}', ${n})" class="leading-none hover:opacity-75 transition" title="${n}/5 sao"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fillColor}" stroke="none">${path}</svg></button>`;
                } else {
                    html += `<span class="leading-none"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fillColor}" stroke="none">${path}</svg></span>`;
                }
            }
            html += '</span>';
            return html;
        }

        // Bộ lọc Đối tác: tìm theo tên đơn vị/người liên hệ + chọn nhiều phân loại cùng lúc
        let selectedPartnerCategoryFilters = new Set();

        function getAllPartnerCategories() {
            const set = new Set();
            (state.config.partners || []).forEach(p => {
                if (p.categories && p.categories.length > 0) p.categories.forEach(c => set.add(c));
                else set.add('Chưa phân loại');
            });
            return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
        }

        function togglePartnerCategoryFilter(cat) {
            if (selectedPartnerCategoryFilters.has(cat)) selectedPartnerCategoryFilters.delete(cat);
            else selectedPartnerCategoryFilters.add(cat);
            renderPartnerCards();
        }

        function clearPartnerCategoryFilters() {
            selectedPartnerCategoryFilters.clear();
            renderPartnerCards();
        }

        function renderPartnerCategoryFilterChips() {
            const chipContainer = document.getElementById('partner-category-filter-chips');
            if (!chipContainer) return;
            const cats = getAllPartnerCategories();
            if (cats.length === 0) { chipContainer.innerHTML = ''; return; }
            chipContainer.innerHTML = cats.map(c => {
                const active = selectedPartnerCategoryFilters.has(c);
                const safe = c.replace(/'/g, "\\'");
                return `<button onclick="togglePartnerCategoryFilter('${safe}')" class="text-[10px] px-2.5 py-1 rounded-full border font-mono transition ${active ? 'bg-[#B6FF2E] text-[#14161C] border-[#B6FF2E]' : 'bg-[#23262F] text-[#777E90] border-[#353945] hover:border-[#B6FF2E]/40'}">${c}</button>`;
            }).join('') + (selectedPartnerCategoryFilters.size > 0
                ? `<button onclick="clearPartnerCategoryFilters()" class="text-[10px] px-2.5 py-1 rounded-full border border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20">✕ Bỏ lọc</button>`
                : '');
        }

        function renderPartnerCards() {
            const container = document.getElementById('cfg-partners-list');
            if (!container) return;
            renderPartnerCategoryFilterChips();

            const allPartners = state.config.partners || [];
            if (allPartners.length === 0) {
                container.innerHTML = `
                    <div class="bg-[#14161C] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">
                        🤝 Chưa có đơn vị đối tác nào. Hãy thêm mới ở ô bên trái!
                    </div>
                `;
                return;
            }

            const searchInput = document.getElementById('partner-search-input');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            let partners = allPartners;
            if (searchTerm) {
                partners = partners.filter(p => {
                    const nameMatch = (p.name || '').toLowerCase().includes(searchTerm);
                    const memberMatch = (p.members || []).some(m => (m.name || '').toLowerCase().includes(searchTerm));
                    return nameMatch || memberMatch;
                });
            }
            if (selectedPartnerCategoryFilters.size > 0) {
                partners = partners.filter(p => {
                    const cats = (p.categories && p.categories.length > 0) ? p.categories : ['Chưa phân loại'];
                    return cats.some(c => selectedPartnerCategoryFilters.has(c));
                });
            }

            container.innerHTML = '';
            if (partners.length === 0) {
                container.innerHTML = `
                    <div class="bg-[#14161C] p-8 rounded-2xl border border-[#353945] text-center text-[#777E90] text-xs">
                        🔍 Không tìm thấy đối tác nào phù hợp với tìm kiếm / bộ lọc hiện tại.
                    </div>
                `;
                return;
            }
            partners.forEach((p) => {
                const categories = p.categories && p.categories.length > 0 ? p.categories : ['Chưa phân loại'];
                const rating = p.rating || 0;
                const isExpanded = expandedPartnerIds.has(p.id);
                const starsCompact = renderStarsSVG(rating, { size: 13, clickable: false });

                const card = document.createElement('div');
                card.className = "bg-[#14161C] rounded-2xl border border-[#353945] overflow-hidden";

                if (!isExpanded) {
                    card.innerHTML = `
                        <button onclick="togglePartnerExpand('${p.id}')" class="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1B1E26] transition text-left">
                            <span class="font-bold text-sm text-[#F4F5F6] flex items-center gap-2"><span>🤝</span> ${p.name}</span>
                            <span class="flex items-center gap-2">
                                ${starsCompact}
                                <span class="text-[10px] text-[#777E90]">${rating > 0 ? rating + '/5' : 'Chưa đánh giá'}</span>
                                <span class="text-[#777E90] text-[10px]">▼</span>
                            </span>
                        </button>
                    `;
                    container.appendChild(card);
                    return;
                }

                card.innerHTML = `
                    <div class="p-4 space-y-3">
                    <button onclick="togglePartnerExpand('${p.id}')" class="flex justify-between items-center w-full border-b border-[#353945] pb-2 text-left hover:opacity-80">
                        <h4 class="font-bold text-sm text-[#F4F5F6] flex items-center gap-2"><span>🤝</span> ${p.name}</h4>
                        <span class="flex items-center gap-2">
                            ${starsCompact}
                            <span class="text-[#777E90] text-[10px]">▲ Thu gọn</span>
                        </span>
                    </button>
                    <div class="flex justify-end -mt-1">
                        <button onclick="deletePartner('${p.id}')" class="text-rose-400 hover:text-rose-300 text-xs">Xóa đơn vị</button>
                    </div>

                    <div class="space-y-1.5">
                        <span class="text-[10px] font-mono text-[#777E90]">PHÂN LOẠI</span>
                        <div class="flex flex-wrap gap-1.5">
                            ${categories.map(c => `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">${c} <button onclick="removePartnerCategory('${p.id}', '${c}')" class="hover:text-rose-400 font-bold">✕</button></span>`).join('')}
                        </div>
                        <div class="flex gap-2">
                            <input id="cfg-pcat-input-${p.id}" type="text" placeholder="Thêm phân loại (VD: Nhà thầu điện...)" class="flex-1 bg-[#23262F] border border-[#353945] rounded-xl px-2.5 py-1.5 text-xs text-[#F4F5F6] focus:outline-none">
                            <button onclick="addPartnerCategory('${p.id}')" class="px-3 py-1.5 rounded-xl bg-[#353945] text-[#B6FF2E] border border-[#B6FF2E]/30 text-xs font-semibold hover:bg-[#B6FF2E]/10">+</button>
                        </div>
                    </div>

                    <div class="space-y-1.5 pt-2 border-t border-[#353945]">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-mono text-[#777E90]">NGƯỜI LIÊN HỆ (${(p.members || []).length})</span>
                            <button onclick="quickAddPersonnel('partner', null, null, '${p.id}')" class="text-[10px] px-2.5 py-1 rounded-lg bg-[#353945] text-[#B6FF2E] border border-[#B6FF2E]/30 hover:bg-[#B6FF2E]/10 font-semibold">+ Thêm người</button>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            ${(p.members || []).length > 0
                                ? p.members.map(m => renderMemberCard(m, `deletePartnerMember('${p.id}', '${m.id}')`)).join('')
                                : `<span class="text-[11px] text-[#777E90] italic sm:col-span-2">Chưa có người liên hệ nào.</span>`
                            }
                        </div>
                    </div>

                    <div class="space-y-1.5 pt-2 border-t border-[#353945]">
                        <span class="text-[10px] font-mono text-[#777E90]">THIẾT BỊ ĐÃ CUNG CẤP / CÔNG VIỆC ĐÃ & ĐANG LÀM</span>
                        <div class="flex flex-wrap gap-1.5">
                            ${(p.equipment && p.equipment.length > 0)
                                ? p.equipment.map((e, i) => `<span class="bg-[#23262F] text-[#F4F5F6] border border-[#353945] px-2 py-0.5 rounded text-[10px] flex items-center gap-1">🔧 ${e} <button onclick="removePartnerEquipment('${p.id}', ${i})" class="text-[#777E90] hover:text-rose-400 font-bold">✕</button></span>`).join('')
                                : `<span class="text-[11px] text-[#777E90] italic">Chưa có thiết bị / công việc nào được ghi nhận.</span>`
                            }
                        </div>
                        <div class="flex gap-2">
                            <input id="cfg-pequip-input-${p.id}" type="text" placeholder="VD: Bảo trì lò hơi số 1, Cung cấp băng tải..." class="flex-1 bg-[#23262F] border border-[#353945] rounded-xl px-2.5 py-1.5 text-xs text-[#F4F5F6] focus:outline-none">
                            <button onclick="addPartnerEquipment('${p.id}')" class="px-3 py-1.5 rounded-xl bg-[#353945] text-[#B6FF2E] border border-[#B6FF2E]/30 text-xs font-semibold hover:bg-[#B6FF2E]/10">+</button>
                        </div>
                    </div>

                    <div class="space-y-1.5 pt-2 border-t border-[#353945]">
                        <span class="text-[10px] font-mono text-[#777E90]">ĐÁNH GIÁ CHẤT LƯỢNG</span>
                        <div class="flex items-center gap-1">
                            ${renderStarsSVG(rating, { size: 22, clickable: true, partnerId: p.id })}
                            <span class="text-[10px] text-[#777E90] ml-1">${rating > 0 ? rating + '/5' : 'Chưa đánh giá'}</span>
                        </div>
                        <div class="flex gap-2">
                            <textarea id="cfg-prating-comment-${p.id}" placeholder="Nhận xét đánh giá (chất lượng thi công, tiến độ, thái độ...)" class="flex-1 bg-[#23262F] border border-[#353945] rounded-xl px-2.5 py-1.5 text-xs text-[#F4F5F6] focus:outline-none resize-none" rows="2">${p.ratingComment || ''}</textarea>
                            <button onclick="savePartnerRatingComment('${p.id}')" class="px-3 py-1.5 rounded-xl bg-[#353945] text-[#B6FF2E] border border-[#B6FF2E]/30 text-xs font-semibold hover:bg-[#B6FF2E]/10 self-start">Lưu</button>
                        </div>
                    </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // Trạng thái mở/thu gọn của từng thẻ Đối tác (chỉ tồn tại trong phiên làm việc, không lưu lên Sheets)
        let expandedPartnerIds = new Set();
        function togglePartnerExpand(partnerId) {
            if (expandedPartnerIds.has(partnerId)) expandedPartnerIds.delete(partnerId);
            else expandedPartnerIds.add(partnerId);
            renderPartnerCards();
        }



        // renderCalendar() — đã chuyển sang js/weekly-calendar.js (kèm tính năng
        // chuyển tháng theo ngày hệ thống, chọn tuần, hiện "Lịch Tuần" và nút In).

        function updateDashboardMetrics() {
            const todayTasksCount = state.tasks.length;
            const completedCount = state.tasks.filter(t => t.status === 'Done').length;
            const rate = todayTasksCount > 0 ? Math.round((completedCount / todayTasksCount) * 100) : 0;

            const elemToday = document.getElementById('kpi-today-tasks');
            if (elemToday) elemToday.innerText = todayTasksCount;

            const elemRate = document.getElementById('kpi-completion-rate');
            if (elemRate) elemRate.innerText = rate;

            const elemKaizen = document.getElementById('kpi-kaizen-count');
            if (elemKaizen) elemKaizen.innerText = state.initiatives.length;
        }

