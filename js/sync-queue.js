        // =============================================================
        // OFFLINE QUEUE — đánh dấu có thay đổi chưa lên Sheets,
        // tự động đồng bộ lại khi có mạng / khi tab được focus
        // =============================================================
        const LS_PENDING_SYNC = 'wms_pending_sync';

        function markPendingSync() {
            localStorage.setItem(LS_PENDING_SYNC, '1');
        }
        function clearPendingSync() {
            localStorage.removeItem(LS_PENDING_SYNC);
        }
        function hasPendingSync() {
            return localStorage.getItem(LS_PENDING_SYNC) === '1';
        }

        // Thử đồng bộ lại toàn bộ dữ liệu đang lưu cục bộ lên Sheets
        async function retryPendingSync(silent) {
            if (!state.sheetsUrl || !hasPendingSync()) return;
            setSyncStatus('syncing');
            const ok = await syncStateToSheets();
            if (ok) {
                clearPendingSync();
                setSyncStatus('ok');
                if (!silent) showNotification('✅ Đã đồng bộ lại dữ liệu tạm lên Google Sheets!', 'success');
            } else {
                setSyncStatus('pending');
            }
        }

        // Lắng nghe khi trình duyệt có mạng trở lại
        window.addEventListener('online', () => {
            showNotification('🌐 Đã có kết nối mạng, đang đồng bộ dữ liệu...', 'success');
            retryPendingSync(false);
        });

        async function connectLocalFolder() {
            showNotification('Phiên bản này dùng Google Sheets. Vào Cấu Hình → Kết Nối API để đăng nhập Google.', 'error');
        }

        async function loadStateFromCSV() {
            await loadStateFromSheets();
            renderTasks(); renderInitiatives(); renderLogs(); renderConfigView(); renderCalendar(); updateDashboardMetrics();
        }

        async function forceLoadFromSheets() {
            if (!state.sheetsUrl) {
                showNotification('Chưa đăng nhập Google hoặc chưa tìm thấy Google Sheet. Vào tab Kết Nối API.', 'error');
                return;
            }
            showNotification('Đang tải dữ liệu từ Google Sheets...', 'success');
            await loadStateFromSheets();
            renderTasks(); renderInitiatives(); renderLogs(); renderConfigView(); renderCalendar(); updateDashboardMetrics();
            showNotification('Đã tải xong dữ liệu từ Google Sheets!', 'success');
        }

        // --- UI: Lưu Gemini Key ---
        function saveGeminiKey() {
            const keyInput = document.getElementById('cfg-gemini-key');
            const key = keyInput.value.trim().replace(/\s+/g, '');
            if (!key) {
                showNotification('Vui lòng nhập API key!', 'error');
                return;
            }
            state.geminiKey = key;
            localStorage.setItem(LS_GEMINI_KEY, key);
            updateGeminiStatusUI();
            showNotification('Đã lưu Gemini API Key thành công!', 'success');
        }

        function toggleKeyVisibility() {
            const inp = document.getElementById('cfg-gemini-key');
            inp.type = inp.type === 'password' ? 'text' : 'password';
        }

        async function testGeminiKey() {
            const resultBox = document.getElementById('gemini-test-result');
            resultBox.classList.remove('hidden');
            resultBox.className = 'text-[11px] p-3 rounded-xl bg-[#23262F] border border-[#353945] text-[#777E90] font-mono whitespace-pre-wrap';
            resultBox.textContent = '⏳ Đang test kết nối Gemini...';

            const inputElem = document.getElementById('cfg-gemini-key');
            const rawKey = (inputElem ? inputElem.value : '') || state.geminiKey || localStorage.getItem(LS_GEMINI_KEY) || '';
            const apiKey = rawKey.trim().replace(/\s+/g, '');

            if (!apiKey) {
                resultBox.textContent = '❌ Chưa nhập API Key. Hãy nhập key vào ô bên trên rồi bấm Lưu trước.';
                resultBox.className = 'text-[11px] p-3 rounded-xl bg-[#23262F] border border-rose-500/50 text-rose-400 font-mono whitespace-pre-wrap';
                return;
            }
            if (!apiKey.startsWith('AIza')) {
                resultBox.textContent = '❌ Key không hợp lệ — phải bắt đầu bằng "AIza"\nBạn đang nhập: ' + apiKey.substring(0, 10) + '...';
                resultBox.className = 'text-[11px] p-3 rounded-xl bg-[#23262F] border border-rose-500/50 text-rose-400 font-mono whitespace-pre-wrap';
                return;
            }

            const modelsToTest = [
                'gemini-3-flash-preview',
                'gemini-3.1-flash-lite-preview',
                'gemini-2.5-flash-lite-preview-06-17'
            ];
            let log = `Key: ${apiKey.substring(0,8)}...\n\n`;

            for (const model of modelsToTest) {
                log += `🔄 Thử model: ${model}\n`;
                resultBox.textContent = log;
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: 'Trả lời đúng 3 chữ: Xin chào bạn' }] }] })
                    });
                    const data = await res.json();
                    if (data.error) {
                        log += `   ❌ Lỗi ${data.error.code}: ${data.error.message}\n\n`;
                    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                        log += `   ✅ THÀNH CÔNG! Phản hồi: "${data.candidates[0].content.parts[0].text.trim()}"\n`;
                        resultBox.textContent = log;
                        resultBox.className = 'text-[11px] p-3 rounded-xl bg-[#23262F] border border-emerald-500/50 text-emerald-400 font-mono whitespace-pre-wrap';
                        updateGeminiStatusUI();
                        showNotification('Gemini AI hoạt động với model ' + model + '!', 'success');
                        return;
                    } else {
                        log += `   ⚠️ Không có phản hồi hợp lệ. Response: ${JSON.stringify(data).substring(0,120)}\n\n`;
                    }
                } catch (e) {
                    log += `   ❌ Lỗi kết nối mạng: ${e.message}\n\n`;
                }
                resultBox.textContent = log;
            }

            log += '\n💡 Gợi ý:\n';
            log += '• Kiểm tra key tại aistudio.google.com/app/apikey\n';
            log += '• Đảm bảo đã bật "Generative Language API" trong Google Cloud Console\n';
            log += '• Thử tạo key mới nếu key hiện tại bị lỗi';
            resultBox.textContent = log;
            resultBox.className = 'text-[11px] p-3 rounded-xl bg-[#23262F] border border-rose-500/50 text-rose-400 font-mono whitespace-pre-wrap';
        }

        // Cập nhật khối hiển thị trạng thái kết nối Google Sheets (trong tab Kết Nối API).
        // sheetsConnected = true khi đã đăng nhập Google THÀNH CÔNG và đã xác định được
        // đúng Google Sheet mục tiêu (activeSpreadsheetId, xem js/google-drive-api.js).
        function updateStorageModeUI(sheetsConnected) {
            const dot  = document.getElementById('storage-mode-dot');
            const text = document.getElementById('storage-mode-text');
            const badge = document.getElementById('sheets-status-badge');
            const icon  = document.getElementById('storage-icon');
            const statusText = document.getElementById('folder-status-text');
            if (sheetsConnected) {
                const who = (typeof googleUserProfile !== 'undefined' && googleUserProfile) ? googleUserProfile.email : '';
                if (dot)  { dot.className  = 'w-2 h-2 rounded-full bg-emerald-400'; }
                if (text) { text.className = 'text-emerald-400'; text.textContent = 'Google Sheets (đã đăng nhập' + (who ? ' — ' + who : '') + ')'; }
                if (badge){ badge.className = 'text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'; badge.textContent = '✅ Đã kết nối'; }
                if (icon) icon.textContent = '☁️';
                if (statusText) statusText.textContent = 'Sheets: Đã kết nối';
            } else {
                if (dot)  { dot.className  = 'w-2 h-2 rounded-full bg-amber-400'; }
                if (text) { text.className = 'text-[#777E90]'; text.textContent = 'localStorage (chỉ trình duyệt này, chưa đăng nhập Google)'; }
                if (badge){ badge.className = 'text-[10px] px-2 py-0.5 rounded font-mono bg-[#353945] text-[#777E90]'; badge.textContent = 'Chưa kết nối'; }
                if (icon) icon.textContent = '💾';
                if (statusText) statusText.textContent = 'Đăng Nhập Google';
            }
        }

        function updateGeminiStatusUI() {
            const badge = document.getElementById('gemini-status-badge');
            if (!badge) return;
            if (state.geminiKey) {
                badge.className = 'text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
                badge.textContent = '✅ Đã có key';
            } else {
                badge.className = 'text-[10px] px-2 py-0.5 rounded font-mono bg-[#353945] text-[#777E90]';
                badge.textContent = 'Chưa có key';
            }
        }

        function exportAllToJSON() {
            const snap = { tasks: state.tasks, initiatives: state.initiatives, logs: state.logs, config: state.config, exportedAt: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'backup_wms_' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            showNotification('Đã xuất backup JSON!', 'success');
        }

        // Khôi phục Gemini Key đã lưu + trạng thái đăng nhập Google (đăng nhập Google được
        // khôi phục riêng trong js/google-auth.js -> restoreGoogleSession(), gọi trong boot()).
        function bootLoadSettings() {
            const savedKey = localStorage.getItem(LS_GEMINI_KEY);
            if (savedKey) {
                state.geminiKey = savedKey;
                const keyInput = document.getElementById('cfg-gemini-key');
                if (keyInput) keyInput.value = savedKey;
            }
            updateGeminiStatusUI();
        }
