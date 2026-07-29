        async function boot() {
            bootLoadSettings();
            loadFromLocalStorage(); // khôi phục cache cục bộ để hiện ngay lập tức SAU KHI mở khoá (không hiện gì lúc này vì màn hình còn đang bị chặn)
            initGoogleAuth(); // tự lo toàn bộ: hiện nút đăng nhập, khôi phục phiên cũ, và MỞ KHOÁ #app-main-content khi kết nối xong
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
    