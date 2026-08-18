// =============================================================
// DIALOG DÙNG CHUNG — nhập liệu cho Kế Hoạch Năm & Kho Mục Tiêu
//
// Dùng: showInputDialog(config) → trả về Promise<object|null>
//
// config = {
//   title:       string,          // Tiêu đề dialog
//   fields: [                     // Danh sách trường cần nhập
//     {
//       id:          string,       // key trong kết quả trả về
//       label:       string,       // nhãn hiển thị
//       type:        'text'        // 'text' | 'textarea' | 'color' | 'stars' | 'number'
//       placeholder: string,       // placeholder (tuỳ chọn)
//       value:       any,          // giá trị mặc định (tuỳ chọn)
//       required:    bool,         // bắt buộc nhập (tuỳ chọn)
//       max:         number,       // cho type='stars': số sao tối đa (mặc định 5)
//     }
//   ],
//   confirmLabel: string,         // nhãn nút xác nhận (mặc định 'Lưu')
//   cancelLabel:  string,         // nhãn nút hủy (mặc định 'Hủy')
// }
//
// Kết quả: { id: value, ... } hoặc null nếu bấm Hủy/đóng
// =============================================================

const DIALOG_COLORS = [
    '#38bdf8', '#c084fc', '#fb923c', '#10b981',
    '#f43f5e', '#facc15', '#60a5fa', '#34d399',
    '#f97316', '#a78bfa', '#2dd4bf', '#fb7185'
];

function showInputDialog(config) {
    return new Promise((resolve) => {
        // Xóa dialog cũ nếu còn
        document.getElementById('shared-input-dialog-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'shared-input-dialog-overlay';
        overlay.className = 'fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';

        // Build các field HTML
        const fieldsHtml = (config.fields || []).map(field => {
            switch (field.type) {

                case 'textarea':
                    return `
                        <div class="space-y-1.5">
                            <label class="block text-[11px] font-semibold text-[#777E90] uppercase tracking-wider">
                                ${field.label}${field.required ? ' <span class="text-rose-400">*</span>' : ''}
                            </label>
                            <textarea
                                id="dlg-field-${field.id}"
                                rows="4"
                                placeholder="${field.placeholder || ''}"
                                class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2.5 text-sm text-[#F4F5F6] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E] resize-none transition"
                            >${field.value || ''}</textarea>
                            <p class="text-[10px] text-[#777E90]">Enter để xuống dòng • Ctrl+Enter để lưu</p>
                        </div>`;

                case 'color':
                    const currentColor = field.value || DIALOG_COLORS[0];
                    return `
                        <div class="space-y-2">
                            <label class="block text-[11px] font-semibold text-[#777E90] uppercase tracking-wider">${field.label}</label>
                            <div class="flex flex-wrap gap-2 items-center">
                                ${DIALOG_COLORS.map(c => `
                                    <button type="button"
                                        onclick="dlgSelectColor('${field.id}', '${c}', this)"
                                        class="w-7 h-7 rounded-full border-2 transition hover:scale-110 dlg-color-btn-${field.id} ${c === currentColor ? 'border-white scale-110' : 'border-transparent'}"
                                        style="background:${c}"
                                        data-color="${c}">
                                    </button>`).join('')}
                                <div class="flex items-center gap-2 ml-1">
                                    <input type="color"
                                        id="dlg-colorpicker-${field.id}"
                                        value="${currentColor}"
                                        onchange="dlgPickerChange('${field.id}', this.value)"
                                        class="w-7 h-7 rounded-lg cursor-pointer border border-[#353945] bg-transparent p-0"
                                        title="Chọn màu tự do">
                                    <span class="text-[10px] text-[#777E90]">Tự chọn</span>
                                </div>
                            </div>
                            <input type="hidden" id="dlg-field-${field.id}" value="${currentColor}">
                        </div>`;

                case 'stars':
                    const max = field.max || 5;
                    const current = field.value || max;
                    return `
                        <div class="space-y-1.5">
                            <label class="block text-[11px] font-semibold text-[#777E90] uppercase tracking-wider">${field.label}</label>
                            <div class="flex items-center gap-1" id="dlg-stars-${field.id}">
                                ${Array.from({length: max}, (_, i) => i + 1).map(n => `
                                    <button type="button"
                                        onclick="dlgSetStar('${field.id}', ${n}, ${max})"
                                        class="text-2xl transition hover:scale-110 dlg-star-btn"
                                        data-n="${n}">
                                        ${n <= current ? '★' : '☆'}
                                    </button>`).join('')}
                                <span id="dlg-stars-label-${field.id}" class="text-[11px] text-[#777E90] ml-2">${current}/${max}</span>
                            </div>
                            <input type="hidden" id="dlg-field-${field.id}" value="${current}">
                        </div>`;

                case 'number':
                    return `
                        <div class="space-y-1.5">
                            <label class="block text-[11px] font-semibold text-[#777E90] uppercase tracking-wider">
                                ${field.label}${field.required ? ' <span class="text-rose-400">*</span>' : ''}
                            </label>
                            <input type="number"
                                id="dlg-field-${field.id}"
                                value="${field.value || ''}"
                                placeholder="${field.placeholder || ''}"
                                class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2.5 text-sm text-[#F4F5F6] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E] transition">
                        </div>`;

                default: // 'text'
                    return `
                        <div class="space-y-1.5">
                            <label class="block text-[11px] font-semibold text-[#777E90] uppercase tracking-wider">
                                ${field.label}${field.required ? ' <span class="text-rose-400">*</span>' : ''}
                            </label>
                            <input type="text"
                                id="dlg-field-${field.id}"
                                value="${(field.value || '').toString().replace(/"/g, '&quot;')}"
                                placeholder="${field.placeholder || ''}"
                                class="w-full bg-[#23262F] border border-[#353945] rounded-xl px-3 py-2.5 text-sm text-[#F4F5F6] focus:outline-none focus:ring-1 focus:ring-[#B6FF2E] transition">
                        </div>`;
            }
        }).join('');

        overlay.innerHTML = `
            <div class="bg-[#14161C] border border-[#353945] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <!-- Header -->
                <div class="flex items-center justify-between px-5 py-4 bg-[#111827] border-b border-[#353945]">
                    <h4 class="font-bold text-sm text-[#F4F5F6]">${config.title || 'Nhập thông tin'}</h4>
                    <button id="dlg-close-btn" class="text-[#777E90] hover:text-rose-400 text-xl px-1 leading-none">✕</button>
                </div>
                <!-- Body -->
                <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    ${fieldsHtml}
                    <div id="dlg-error" class="hidden text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2"></div>
                </div>
                <!-- Footer -->
                <div class="flex justify-end gap-2 px-5 py-4 border-t border-[#353945] bg-[#111827]">
                    <button id="dlg-cancel-btn"
                        class="px-4 py-2 rounded-xl bg-[#23262F] text-[#F4F5F6] border border-[#353945] text-xs font-semibold hover:bg-[#353945] transition">
                        ${config.cancelLabel || 'Hủy'}
                    </button>
                    <button id="dlg-confirm-btn"
                        class="px-5 py-2 rounded-xl bg-[#B6FF2E] text-[#14161C] text-xs font-bold hover:opacity-90 transition shadow-[0_0_10px_rgba(182,255,46,0.2)]">
                        ${config.confirmLabel || 'Lưu'}
                    </button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        // Focus vào field đầu tiên có thể nhập
        setTimeout(() => {
            const firstInput = overlay.querySelector('input[type="text"], input[type="number"], textarea');
            if (firstInput) {
                firstInput.focus();
                if (firstInput.value) firstInput.select();
            }
        }, 50);

        // Hàm thu thập kết quả
        function collectResult() {
            const result = {};
            let valid = true;
            const errorEl = document.getElementById('dlg-error');

            for (const field of (config.fields || [])) {
                const el = document.getElementById(`dlg-field-${field.id}`);
                if (!el) continue;

                let val = el.value;
                if (field.type === 'stars' || field.type === 'number') {
                    val = Number(val);
                }

                if (field.required && (!val || (typeof val === 'string' && !val.trim()))) {
                    valid = false;
                    if (errorEl) {
                        errorEl.textContent = `Vui lòng nhập "${field.label}"`;
                        errorEl.classList.remove('hidden');
                    }
                    // Highlight ô lỗi
                    el.classList.add('border-rose-500');
                    el.classList.remove('border-[#353945]');
                    el.focus();
                    break;
                } else {
                    el.classList.remove('border-rose-500');
                    el.classList.add('border-[#353945]');
                }

                result[field.id] = (field.type === 'text' || field.type === 'textarea')
                    ? (typeof val === 'string' ? val.trim() : val)
                    : val;
            }

            return valid ? result : null;
        }

        function closeDialog(result) {
            overlay.remove();
            resolve(result);
        }

        // Event listeners
        document.getElementById('dlg-close-btn').onclick = () => closeDialog(null);
        document.getElementById('dlg-cancel-btn').onclick = () => closeDialog(null);
        document.getElementById('dlg-confirm-btn').onclick = () => {
            const result = collectResult();
            if (result) closeDialog(result);
        };

        // Click ngoài để đóng
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeDialog(null);
        });

        // Ctrl+Enter để submit từ bất kỳ field nào
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') { closeDialog(null); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const result = collectResult();
                if (result) closeDialog(result);
                return;
            }
            // Enter trên input text (không phải textarea) → submit
            if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
                const result = collectResult();
                if (result) closeDialog(result);
            }
        });
    });
}

// =============================================================
// Helpers cho color picker & stars (gọi từ onclick inline)
// =============================================================

function dlgSelectColor(fieldId, color, btn) {
    // Bỏ highlight tất cả nút màu của field này
    document.querySelectorAll(`.dlg-color-btn-${fieldId}`).forEach(b => {
        b.classList.remove('border-white', 'scale-110');
        b.classList.add('border-transparent');
    });
    // Highlight nút được chọn
    btn.classList.add('border-white', 'scale-110');
    btn.classList.remove('border-transparent');
    // Cập nhật hidden input & color picker
    const hidden = document.getElementById(`dlg-field-${fieldId}`);
    if (hidden) hidden.value = color;
    const picker = document.getElementById(`dlg-colorpicker-${fieldId}`);
    if (picker) picker.value = color;
}

function dlgPickerChange(fieldId, color) {
    // Bỏ highlight tất cả nút màu cố định
    document.querySelectorAll(`.dlg-color-btn-${fieldId}`).forEach(b => {
        b.classList.remove('border-white', 'scale-110');
        b.classList.add('border-transparent');
    });
    // Cập nhật hidden input
    const hidden = document.getElementById(`dlg-field-${fieldId}`);
    if (hidden) hidden.value = color;
}

function dlgSetStar(fieldId, n, max) {
    const container = document.getElementById(`dlg-stars-${fieldId}`);
    if (!container) return;
    // Cập nhật hiển thị sao
    container.querySelectorAll('.dlg-star-btn').forEach(btn => {
        btn.textContent = Number(btn.dataset.n) <= n ? '★' : '☆';
        btn.style.color = Number(btn.dataset.n) <= n ? '#facc15' : '#777E90';
    });
    // Cập nhật label và hidden input
    const label = document.getElementById(`dlg-stars-label-${fieldId}`);
    if (label) label.textContent = `${n}/${max}`;
    const hidden = document.getElementById(`dlg-field-${fieldId}`);
    if (hidden) hidden.value = n;
}

// =============================================================
// Preset configs — gọi nhanh cho từng ngữ cảnh
// =============================================================

// Thêm/sửa năm
function dlgYear(defaultValue) {
    return showInputDialog({
        title: '📅 Năm Kế Hoạch',
        fields: [
            { id: 'year', label: 'Năm', type: 'number', placeholder: new Date().getFullYear() + 1, value: defaultValue, required: true }
        ],
        confirmLabel: 'Thêm Năm'
    });
}

// Thêm/sửa mục tiêu năm (có màu + sao)
function dlgAnnualGoal(defaults) {
    defaults = defaults || {};
    return showInputDialog({
        title: defaults.title ? '✏️ Sửa Mục Tiêu Năm' : '🎯 Thêm Mục Tiêu Năm',
        fields: [
            { id: 'title', label: 'Tên mục tiêu', type: 'text', placeholder: 'VD: Tối ưu tiêu thụ năng lượng 10%', value: defaults.title || '', required: true },
            { id: 'stars', label: 'Độ ưu tiên', type: 'stars', value: defaults.stars || 5, max: 5 },
            { id: 'color', label: 'Màu sắc', type: 'color', value: defaults.color || DIALOG_COLORS[0] }
        ],
        confirmLabel: defaults.title ? 'Lưu Thay Đổi' : 'Thêm Mục Tiêu'
    });
}

// Thêm/sửa việc tháng trong Kho (có sao)
function dlgMonthlyGoal(defaults) {
    defaults = defaults || {};
    return showInputDialog({
        title: defaults.name ? '✏️ Sửa Việc Tháng' : '📌 Thêm Việc Vào Tháng',
        fields: [
            { id: 'name', label: 'Nội dung việc tháng', type: 'text', placeholder: 'VD: Hoàn thiện báo cáo Q1', value: defaults.name || '', required: true },
            { id: 'stars', label: 'Độ ưu tiên', type: 'stars', value: defaults.stars || 5, max: 5 }
        ],
        confirmLabel: defaults.name ? 'Lưu' : 'Thêm'
    });
}

// Thêm việc nhỏ tuần (chỉ text)
function dlgWeekTask(defaults) {
    defaults = defaults || {};
    return showInputDialog({
        title: '🪜 Thêm Việc Nhỏ',
        fields: [
            { id: 'text', label: 'Nội dung việc cần làm', type: 'textarea', placeholder: 'Nhập nội dung...\n(Enter để xuống dòng, Ctrl+Enter để lưu)', value: defaults.text || '', required: true }
        ],
        confirmLabel: 'Thêm'
    });
}

// Thêm/sửa mục tiêu chính trong Kho Mục Tiêu (có màu + sao)
function dlgGoalBankGoal(defaults) {
    defaults = defaults || {};
    const usedColors = (state.goalBank || []).map(g => g.color);
    const autoColor = DIALOG_COLORS.find(c => !usedColors.includes(c)) || DIALOG_COLORS[0];
    return showInputDialog({
        title: defaults.title ? '✏️ Sửa Mục Tiêu' : '🗃️ Thêm Mục Tiêu Vào Kho',
        fields: [
            { id: 'title', label: 'Tên mục tiêu', type: 'text', placeholder: 'VD: Xây dựng hệ thống ESG', value: defaults.title || '', required: true },
            { id: 'stars', label: 'Độ ưu tiên', type: 'stars', value: defaults.stars || 5, max: 5 },
            { id: 'color', label: 'Màu sắc', type: 'color', value: defaults.color || autoColor }
        ],
        confirmLabel: defaults.title ? 'Lưu Thay Đổi' : 'Thêm Mục Tiêu'
    });
}

// Thêm/sửa nội dung con trong Kho Mục Tiêu (textarea + sao)
function dlgGoalBankItem(defaults) {
    defaults = defaults || {};
    return showInputDialog({
        title: defaults.text ? '✏️ Sửa Nội Dung' : '+ Thêm Nội Dung',
        fields: [
            { id: 'text', label: 'Nội dung', type: 'textarea', placeholder: 'Nhập nội dung cần làm để đạt mục tiêu...\n(Enter để xuống dòng, Ctrl+Enter để lưu)', value: defaults.text || '', required: true },
            { id: 'stars', label: 'Độ ưu tiên', type: 'stars', value: defaults.stars || 5, max: 5 }
        ],
        confirmLabel: defaults.text ? 'Lưu' : 'Thêm'
    });
}

// Thêm slogan năm
function dlgSlogan(currentSlogan) {
    return showInputDialog({
        title: '✍️ Slogan / Châm Ngôn Năm',
        fields: [
            { id: 'slogan', label: 'Nội dung', type: 'text', placeholder: 'VD: Năm 2026 — Bứt phá & Tăng trưởng', value: currentSlogan || '' }
        ],
        confirmLabel: 'Lưu'
    });
}
