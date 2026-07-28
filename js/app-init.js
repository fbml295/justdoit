        async function boot() {
            bootLoadSettings();
            initGoogleAuth(); // khởi tạo nút Đăng nhập Google + tự khôi phục phiên đăng nhập cũ (nếu còn hạn)

            const hasLocal = loadFromLocalStorage();
            if (hasLocal) {
                renderTasks(); renderInitiatives(); renderLogs(); renderConfigView(); renderCalendar(); updateDashboardMetrics();
            }

            if (state.sheetsUrl) {
                // Nếu có dữ liệu đang chờ đồng bộ (do lần trước mất mạng) → thử đẩy lên trước
                if (hasPendingSync()) {
                    setSyncStatus('syncing');
                    const pushOk = await syncStateToSheets();
                    if (pushOk) { clearPendingSync(); showNotification('✅ Đã đồng bộ dữ liệu tạm lên Google Sheets!', 'success'); }
                }

                setSyncStatus('syncing');
                try {
                    await loadStateFromSheets();
                    renderTasks(); renderInitiatives(); renderLogs(); renderConfigView(); renderCalendar(); updateDashboardMetrics();
                    setSyncStatus('ok');
                } catch(e) {
                    markPendingSync();
                    setSyncStatus('pending');
                    showNotification('⚠️ Không thể đồng bộ Sheets, đang dùng dữ liệu cục bộ.', 'error');
                }
            } else {
                setSyncStatus('idle');
                if (!hasLocal) {
                    switchView('config');
                    switchConfigSubTab('api');
                    showNotification('Chào mừng! Hãy đăng nhập Google để bắt đầu.', 'success');
                }
            }

            updateDashboardMetrics();
        }

        // Tự động thử đồng bộ lại + kéo dữ liệu mới khi người dùng quay lại tab
        let _lastAutoReload = 0;
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && state.sheetsUrl) {
                if (hasPendingSync()) {
                    await retryPendingSync(true);
                }
                const now = Date.now();
                if (now - _lastAutoReload > 30000) {
                    _lastAutoReload = now;
                    try {
                        await loadStateFromSheets();
                        renderTasks(); renderInitiatives(); renderLogs(); renderCalendar(); updateDashboardMetrics();
                        setSyncStatus('ok');
                    } catch(e) { /* silent */ }
                }
            }
        });

        boot();
    