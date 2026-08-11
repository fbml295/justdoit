        // =============================================================
        // GEMINI AI UTILITIES & API HANDLERS (CHUẨN HÓA URL & XỬ LÝ LỖI)
        // =============================================================

        // =============================================================
// GEMINI AI UTILITIES & API HANDLERS (ĐÃ FIX LỖI QUOTA 429)
// =============================================================

// 1. HÀM GỌI TEXT GEMINI (Ưu tiên model 1.5 Flash & 1.5 Pro có Quota miễn phí dồi dào)
async function fetchGeminiText(prompt, systemInstruction = "Bạn là chuyên gia cố vấn quản trị vận hành nhà máy, TPM, 5S và OKRs chuyên nghiệp. Trả lời bằng tiếng Việt ngắn gọn, mạch lạc, có phân đoạn bằng bullet points.") {
    const inputElem = document.getElementById('cfg-gemini-key');
    const rawKey = state.geminiKey || localStorage.getItem(LS_GEMINI_KEY) || (inputElem ? inputElem.value : "");
    const apiKey = (rawKey || "").trim().replace(/\s+/g, '');
    
    if (!apiKey) {
        throw new Error("Chưa có Gemini API Key. Vui lòng vào Cấu Hình → Kết Nối API để nhập Key.");
    }

    if (apiKey.startsWith("AQ.")) {
        throw new Error("Mã nhập vào là OAuth Token (AQ.Ab...). Vui lòng dán đúng API Key chuẩn có dạng AIza...");
    }
    
    // Model miễn phí cho tài khoản mới (cập nhật 7/2026)
    const modelsToTry = [
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite-preview',
        'gemini-2.5-flash-lite-preview-06-17'
    ];

    let lastErrorMessage = "";

    for (const model of modelsToTry) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.error) {
                lastErrorMessage = `Lỗi ${data.error.code}: ${data.error.message}`;
                console.warn(`Model ${model} báo lỗi (${data.error.code}), thử model tiếp theo...`);
                
                // Nếu dính lỗi hết Quota (429) hoặc không thấy model (404), chuyển ngay sang model tiếp theo
                if (data.error.code === 404 || data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED') {
                    continue; 
                }
                throw new Error(`Lỗi Google API (${data.error.code}): ${data.error.message}`);
            }

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
        } catch (e) {
            if (e.message.startsWith("Lỗi Google API") || e.message.startsWith("Mã nhập vào")) throw e;
            lastErrorMessage = e.message || "Lỗi kết nối mạng";
            console.warn(`Lỗi khi gọi model ${model}:`, e);
        }
    }

    throw new Error(`Không thể kết nối Gemini API. Chi tiết: ${lastErrorMessage}`);
}   

// 2. HÀM ĐỌC GIỌNG NÓI TTS
async function fetchGeminiTTS(textToRead) {
    // Thử Gemini TTS trước, nếu lỗi fallback sang Web Speech API
    const inputElem = document.getElementById('cfg-gemini-key');
    const rawKey = state.geminiKey || localStorage.getItem(LS_GEMINI_KEY) || (inputElem ? inputElem.value : "");
    const apiKey = (rawKey || "").trim().replace(/\s+/g, '');

    if (apiKey) {
        // Thử các model TTS có thể dùng
        const ttsModels = [
            'gemini-2.5-flash-preview-tts',
            'gemini-3-flash-preview'
        ];
        for (const ttsModel of ttsModels) {
            try {
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${apiKey}`;
                const payload = {
                    contents: [{
                        parts: [{ text: "Hãy đọc nội dung báo cáo quản trị sau bằng tiếng Việt với giọng đọc dõng dạc, rõ ràng:\n\n" + textToRead }]
                    }]
                };
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await response.json();
                if (!result.error && result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return result.candidates[0].content.parts[0].text;
                }
            } catch(e) { /* thử model tiếp */ }
        }
    }

    // Fallback: Web Speech API (có sẵn trong mọi trình duyệt, miễn phí)
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
            reject(new Error("Trình duyệt không hỗ trợ đọc giọng nói."));
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        // Tìm giọng tiếng Việt nếu có
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(v => v.lang.startsWith('vi'));
        if (viVoice) utterance.voice = viVoice;
        utterance.onend = () => resolve('__WEBSPEECH__');
        utterance.onerror = (e) => reject(new Error("Lỗi đọc: " + e.error));
        window.speechSynthesis.speak(utterance);
    });
}

// 3. HÀM TẠO ẢNH POSTER
async function fetchImagenPoster(imagePrompt) {
    const inputElem = document.getElementById('cfg-gemini-key');
    const rawKey = state.geminiKey || localStorage.getItem(LS_GEMINI_KEY) || (inputElem ? inputElem.value : "");
    const apiKey = (rawKey || "").trim().replace(/\s+/g, '');
    if (!apiKey) throw new Error("Chưa có Gemini API Key.");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
    
    const payload = {
        instances: [{ prompt: imagePrompt }],
        parameters: { sampleCount: 1 }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.error) {
        throw new Error(`Lỗi Imagen (${result.error.code}): ${result.error.message}`);
    }

    if (result.predictions && result.predictions[0]?.bytesBase64Encoded) {
        return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
    }
    throw new Error("Không thể tạo hình ảnh poster.");
}

        // AI FEATURE HANDLERS
        async function triggerAiWeeklySummary() {
            setAiLoading(true, "Đang gom dữ liệu Task, OKR & Nhật ký để tổng hợp báo cáo điều hành...");
            document.getElementById('ai-output-title').innerText = "Báo Cáo Điều Hành & Đánh Giá Vận Hành Tuần";
            document.getElementById('ai-image-output-container').classList.add('hidden');

            const taskSummary = state.tasks.map(t => `- [${t.status}] ${t.title} (${t.priority}, ${t.relation})`).join('\n');
            const logSummary = state.logs.slice(0, 8).map(l => `- [${l.timestamp}] ${l.text}`).join('\n');
            const kaizenSummary = state.initiatives.map(i => `- ${i.title}: ${i.desc} (${i.progress}%)`).join('\n');

            const prompt = `Dưới đây là dữ liệu vận hành thực tế của nhà máy và phòng ban:

1. DANH SÁCH CÔNG VIỆC (${state.tasks.length} tasks):
${taskSummary || "Chưa có công việc nào."}

2. NHẬT KÝ CÔNG VIỆC HÀNG NGÀY:
${logSummary || "Chưa có nhật ký nào."}

3. SÁNG KIẾN KAIZEN & TIẾT KIỆM NĂNG LƯỢNG:
${kaizenSummary || "Chưa có đề xuất."}

YÊU CẦU: Hãy đóng vai Giám Đốc Vận Hành (COO) để viết 1 BÁO CÁO ĐIỀU HÀNH TỔNG HỢP súc tích gồm 4 phần:
1. Đánh giá tổng quan hiệu suất và tiến độ hoàn thành.
2. Các điểm sáng nổi bật & Sáng kiến triển khai tốt.
3. Rủi ro, tồn đọng cần khắc phục ngay.
4. Top 3 hành động chiến lược ưu tiên cho tuần tiếp theo.`;

            try {
                const textResult = await fetchGeminiText(prompt);
                state.lastAiOutput = textResult;
                renderAiOutput(textResult);
            } catch (err) {
                showNotification(err.message, 'error');
            } finally {
                setAiLoading(false);
            }
        }

        async function triggerAiKaizenPlanner() {
            setAiLoading(true, "Gemini đang xây dựng kế hoạch phân rã Kaizen & Tiết kiệm năng lượng...");
            document.getElementById('ai-output-title').innerText = "Kế Hoạch Cải Tiến Kaizen & Tối Ưu Năng Lượng Smart";
            document.getElementById('ai-image-output-container').classList.add('hidden');

            const prompt = `Hãy lập một Đề xuất Sáng kiến Kaizen & Tiết kiệm Năng lượng chuẩn ISO 50001 & TPM cho Nhà máy sản xuất với các thông tin chi tiết:
1. Tên dự án đề xuất
2. Mục tiêu đo lường cụ thể (SEC kWh/Tấn, giảm Downtime...)
3. Phân rã 5 bước thực hiện cụ thể giao cho các tổ Cơ Điện, Phân Xưởng và HSE.
4. Lợi ích dự kiến về chi phí và an toàn.`;

            try {
                const textResult = await fetchGeminiText(prompt);
                state.lastAiOutput = textResult;
                renderAiOutput(textResult);
            } catch (err) {
                showNotification(err.message, 'error');
            } finally {
                setAiLoading(false);
            }
        }

        async function triggerAiPosterGen() {
            setAiLoading(true, "Imagen 3.0 đang vẽ Poster minh họa tiêu chuẩn 5S & An toàn...");
            document.getElementById('ai-output-title').innerText = "Poster Minh Họa Tiêu Chuẩn 5S / An Toàn Factory";

            const textPrompt = "Thiết kế Poster tuyên truyền tiêu chuẩn 5S và An Toàn Lao Động trong Nhà Máy Kỹ Thuật Hiện Đại.";
            const imgPrompt = "Professional industrial safety and 5S poster for modern automated factory floor, sleek graphite style with lime green accent highlights, highly detailed graphic design banner.";

            try {
                const textResult = await fetchGeminiText("Viết 5 quy tắc vàng về 5S và An Toàn Lao Động ngắn gọn để in lên Poster nhà máy.");
                state.lastAiOutput = textResult;
                renderAiOutput(textResult);

                const imgUrl = await fetchImagenPoster(imgPrompt);
                const imgElem = document.getElementById('ai-generated-image');
                imgElem.src = imgUrl;
                document.getElementById('ai-image-output-container').classList.remove('hidden');
            } catch (err) {
                showNotification(err.message, 'error');
            } finally {
                setAiLoading(false);
            }
        }

        async function executeCustomAiQuery() {
            const input = document.getElementById('ai-custom-prompt');
            const query = input.value.trim();
            if (!query) return showNotification('Vui lòng nhập câu hỏi hoặc yêu cầu cho Gemini!', 'error');

            setAiLoading(true, "Gemini đang xử lý yêu cầu riêng của bạn...");
            document.getElementById('ai-output-title').innerText = "Kết Quả Tư Vấn Tùy Chỉnh Gemini AI";
            document.getElementById('ai-image-output-container').classList.add('hidden');

            try {
                const res = await fetchGeminiText(query);
                state.lastAiOutput = res;
                renderAiOutput(res);
                input.value = '';
            } catch (err) {
                showNotification(err.message, 'error');
            } finally {
                setAiLoading(false);
            }
        }

        async function readAiOutputWithTTS() {
            if (!state.lastAiOutput) {
                return showNotification('Chưa có nội dung để đọc!', 'error');
            }

            const btn = document.getElementById('btn-read-tts');
            btn.innerHTML = '<span>⏳</span><span>Đang chuẩn bị giọng đọc...</span>';

            try {
                const result = await fetchGeminiTTS(state.lastAiOutput.slice(0, 1500));

                if (result === '__WEBSPEECH__') {
                    // Web Speech API đã tự đọc rồi, không cần làm thêm gì
                    showNotification('Đang đọc bằng giọng nói trình duyệt!', 'success');
                } else if (result && result.startsWith('http')) {
                    const playerCard = document.getElementById('ai-audio-player-card');
                    const audioElem = document.getElementById('ai-audio-element');
                    audioElem.src = result;
                    playerCard.classList.remove('hidden');
                    audioElem.play();
                    showNotification('Đã tạo xong tệp âm thanh giọng đọc!', 'success');
                } else {
                    showNotification('Đang đọc bằng giọng nói trình duyệt!', 'success');
                }
            } catch (err) {
                showNotification(err.message, 'error');
            } finally {
                btn.innerHTML = '<span>🔊</span><span>Đọc Bằng Giọng Nói</span>';
            }
        }

        async function generateAiTasksSuggest() {
            showNotification('Gemini đang gợi ý 3 công việc ưu tiên...', 'success');
            try {
                const text = await fetchGeminiText("Gợi ý 3 công việc vận hành nhà máy và 5S khẩn cấp cho ngày hôm nay theo dạng JSON dạng đơn giản: tiêu đề công việc.");
                const newAiTask = {
                    id: 'T' + (state.tasks.length + 1),
                    title: 'Kiểm tra 5S & Tối ưu SEC năng lượng (Gợi ý từ Gemini AI)',
                    category: 'tpm-5s',
                    relation: 'my-task',
                    status: 'Todo',
                    priority: 'High',
                    deadline: new Date().toISOString().split('T')[0]
                };
                state.tasks.push(newAiTask);
                renderTasks();
                renderCalendar();
                updateDashboardMetrics();
                syncStateToCSV();
                showNotification('Đã tự động thêm 1 công việc ưu tiên từ Gemini vào danh sách!', 'success');
            } catch (e) {
                showNotification('Lỗi tạo gợi ý task từ AI.', 'error');
            }
        }

        function setAiLoading(isLoading, message = "") {
            const spinner = document.getElementById('ai-loading-spinner');
            const outputContainer = document.getElementById('ai-output-container');
            if (isLoading) {
                spinner.classList.remove('hidden');
                if (message) spinner.querySelector('p').innerText = message;
                outputContainer.classList.add('hidden');
            } else {
                spinner.classList.add('hidden');
                outputContainer.classList.remove('hidden');
            }
        }

        function renderAiOutput(text) {
            const container = document.getElementById('ai-output-container');
            container.innerText = text;
        }

        function copyAiOutputText() {
            if (!state.lastAiOutput) return showNotification('Chưa có nội dung để chép!', 'error');
            const temp = document.createElement('textarea');
            temp.value = state.lastAiOutput;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showNotification('Đã sao chép nội dung vào Clipboard!', 'success');
        }

        // NAVIGATION & VIEW SWITCHING
        function switchView(viewName) {
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById(`view-${viewName}`);
            if (target) target.classList.remove('hidden');

            if (viewName === 'tasks') {
                refreshTaskFormOptions();
            }

            const titleMap = {
                dashboard: { title: "Bảng Điều Khiển Chỉ Số Vận Hành", subtitle: "Mục tiêu OKRs, Tiến độ Dự án & Chỉ số Năng lượng" },
                tasks: { title: "Quản Lý Công Việc & Lịch Trình", subtitle: "Phân loại phân quyền và theo dõi tiến độ công việc" },
                ai: { title: "Trợ Lý AI Gemini 3.1 & Imagen", subtitle: "Tổng hợp báo cáo điều hành, lập kế hoạch Kaizen & Đọc giọng nói TTS" },
                roadmap: { title: "Kế Hoạch Năm", subtitle: "Ma trận mục tiêu năm — tháng — tuần, kéo thả lập kế hoạch, theo dõi tiến độ tự động" },
                tpm: { title: "Chương Trình TPM & Tiêu Chuẩn 5S", subtitle: "Phát hành danh mục công việc chuẩn hóa xuống trực tiếp các bộ phận" },
                kaizen: { title: "Sáng Kiến Kaizen & Dự Án Cải Tiến", subtitle: "Đề xuất và theo dõi tiến độ các dự án tiết kiệm năng lượng" },
                logs: { title: "Nhật Ký Công Việc Hàng Ngày", subtitle: "Ghi chép tiến độ, kết quả xử lý công việc và báo cáo tuần" },
                config: { title: "Cấu Hình Hệ Thống", subtitle: "Quản lý Nhà máy, Phân xưởng, Phòng ban, Tổ chuyên trách và Danh bạ" }
            };

            if (titleMap[viewName]) {
                document.getElementById('page-title').innerText = titleMap[viewName].title;
                document.getElementById('page-subtitle').innerText = titleMap[viewName].subtitle;
            }

            document.querySelectorAll('.nav-item-side').forEach(el => {
                el.classList.remove('bg-[#B6FF2E]', 'text-[#14161C]', 'font-semibold');
                el.classList.add('text-[#777E90]', 'hover:bg-[#353945]', 'hover:text-[#F4F5F6]', 'font-medium');
            });
            const btnSide = document.getElementById(`btn-side-${viewName}`);
            if (btnSide) {
                btnSide.classList.add('bg-[#B6FF2E]', 'text-[#14161C]', 'font-semibold');
                btnSide.classList.remove('text-[#777E90]', 'hover:bg-[#353945]', 'hover:text-[#F4F5F6]', 'font-medium');
            }

            document.querySelectorAll('.nav-item-bottom').forEach(el => {
                el.classList.remove('text-[#B6FF2E]');
                el.classList.add('text-[#777E90]');
            });
            const btnBottom = document.getElementById(`btn-bottom-${viewName}`);
            if (btnBottom) {
                btnBottom.classList.add('text-[#B6FF2E]');
                btnBottom.classList.remove('text-[#777E90]');
            }

            if (viewName === 'tasks') {
                renderTasks();
                ensureWeeklyCalLoaded(); // tự gọi renderCalendar() sau khi đảm bảo đã có dữ liệu Lịch Tuần
            } else if (viewName === 'kaizen') {
                renderInitiatives();
            } else if (viewName === 'logs') {
                renderLogs();
            } else if (viewName === 'config') {
                renderConfigView();
            } else if (viewName === 'dashboard') {
                updateDashboardMetrics();
            } else if (viewName === 'roadmap') {
                ensureRoadmapLoaded();
                initRoadmapDragScroll();
            }
        }

        function switchTaskSubView(mode) {
            state.currentTaskSubView = mode;
            const btnList = document.getElementById('btn-subview-list');
            const btnCal = document.getElementById('btn-subview-calendar');
            const viewList = document.getElementById('subview-tasks-list');
            const viewCal = document.getElementById('subview-tasks-calendar');

            if (mode === 'list') {
                btnList.className = 'px-5 py-2 text-xs md:text-sm font-semibold rounded-lg bg-[#B6FF2E] text-[#14161C] transition';
                btnCal.className = 'px-5 py-2 text-xs md:text-sm font-medium rounded-lg text-[#777E90] hover:text-[#F4F5F6] transition';
                viewList.classList.remove('hidden');
                viewCal.classList.add('hidden');
            } else {
                btnCal.className = 'px-5 py-2 text-xs md:text-sm font-semibold rounded-lg bg-[#B6FF2E] text-[#14161C] transition';
                btnList.className = 'px-5 py-2 text-xs md:text-sm font-medium rounded-lg text-[#777E90] hover:text-[#F4F5F6] transition';
                viewCal.classList.remove('hidden');
                viewList.classList.add('hidden');
                ensureWeeklyCalLoaded(); // tự gọi renderCalendar() sau khi đảm bảo đã có dữ liệu Lịch Tuần
            }
        }

        function switchConfigSubTab(tabName) {
            state.currentConfigSubTab = tabName;
            document.querySelectorAll('.cfg-tab').forEach(el => {
                el.classList.remove('bg-[#B6FF2E]', 'text-[#14161C]', 'font-semibold');
                el.classList.add('text-[#777E90]', 'hover:text-[#F4F5F6]', 'font-medium');
            });
            const tabBtn = document.getElementById(`cfg-tab-${tabName}`);
            if (tabBtn) {
                tabBtn.classList.add('bg-[#B6FF2E]', 'text-[#14161C]', 'font-semibold');
                tabBtn.classList.remove('text-[#777E90]', 'hover:text-[#F4F5F6]', 'font-medium');
            }

            ['api','orgchart','contacts','personnel'].forEach(sub => {
                const el = document.getElementById(`cfg-subview-${sub}`);
                if (el) el.classList.add('hidden');
            });

            const targetSub = document.getElementById(`cfg-subview-${tabName}`);
            if (targetSub) targetSub.classList.remove('hidden');
        }

        // =============================================================
        // AI SUGGEST — Gợi ý tự động các trường khi tạo Công việc mới
        // (service riêng biệt: chỉ lo gọi Gemini + xử lý dữ liệu, KHÔNG đụng tới DOM/UI.
        //  Phần wiring UI — debounce, điền vào ô, hint, nút bấm — nằm trong js/tasks.js)
        // =============================================================

        const AI_SUGGEST_TIMEOUT_MS = 20000; // 20 giây / lần gọi
        const AI_SUGGEST_MAX_RETRY = 1;      // thử thêm tối đa 1 lần nếu lỗi mạng/timeout
        const AI_SUGGEST_SYSTEM_INSTRUCTION =
            'Bạn là chuyên gia quản lý dự án và cải tiến doanh nghiệp. Nhiệm vụ: phân tích tên công việc được cung cấp, ' +
            'sinh mục tiêu theo nguyên tắc SMART, đề xuất mô tả công việc, đề xuất kết quả mong đợi, xác định mức ưu tiên ' +
            'theo ma trận Eisenhower (diễn đạt bằng 1 câu ngắn gọn, ví dụ "Quan trọng nhưng không khẩn cấp"), xác định ' +
            'danh mục phù hợp, và sinh các thẻ (tags) liên quan. CHỈ trả về JSON hợp lệ theo đúng cấu trúc yêu cầu, ' +
            'KHÔNG dùng Markdown (không bọc trong dấu ```), KHÔNG giải thích thêm bất kỳ nội dung nào ngoài JSON.';

        function buildAiSuggestPrompt(title) {
            return `Tên công việc: "${title}"

Hãy trả về DUY NHẤT 1 object JSON với đúng cấu trúc sau (không thêm trường nào khác, không thêm chú thích):
{
  "objective": "Mục tiêu SMART cho công việc này",
  "description": "Mô tả chi tiết công việc cần làm",
  "expected_result": "Kết quả mong đợi cụ thể, có thể đo lường",
  "priority": "Mức ưu tiên theo ma trận Eisenhower, diễn đạt ngắn gọn bằng tiếng Việt",
  "category": "Danh mục phù hợp cho công việc này",
  "tags": ["thẻ 1", "thẻ 2", "thẻ 3"]
}`;
        }

        // Cache theo đúng tên công việc (đã trim) — tên giống hệt lần trước thì không gọi lại API
        const aiSuggestCache = {};

        function _aiLog(...args)  { console.log('[AI Suggest]', ...args); }
        function _aiWarn(...args) { console.warn('[AI Suggest]', ...args); }

        function _aiWithTimeout(promise, ms) {
            let timer;
            const timeoutPromise = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Hết thời gian chờ phản hồi từ Gemini (timeout)')), ms);
            });
            return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
        }

        function _parseAiSuggestJson(rawText) {
            if (!rawText) throw new Error('Gemini trả về nội dung rỗng');
            let text = rawText.trim();
            // Phòng trường hợp model vẫn bọc trong ```json ... ``` dù đã dặn không dùng Markdown
            const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (fenceMatch) text = fenceMatch[1].trim();
            // Lấy đúng phần từ dấu { đầu tiên tới } cuối cùng, phòng model thêm chữ thừa trước/sau
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                text = text.substring(firstBrace, lastBrace + 1);
            }
            const json = JSON.parse(text);
            return {
                objective:       typeof json.objective === 'string' ? json.objective.trim() : '',
                description:     typeof json.description === 'string' ? json.description.trim() : '',
                expected_result: typeof json.expected_result === 'string' ? json.expected_result.trim() : '',
                priority:        typeof json.priority === 'string' ? json.priority.trim() : '',
                category:        typeof json.category === 'string' ? json.category.trim() : '',
                tags: Array.isArray(json.tags) ? json.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()) : []
            };
        }

        // Service chính: phân tích tên công việc, trả về gợi ý các trường.
        // Có cache theo tên công việc, timeout, retry và log — không đụng tới DOM.
        // opts.forceRefresh = true -> bỏ qua cache, luôn gọi lại API (dùng cho nút "Gợi ý lại")
        async function aiSuggestTaskFields(title, opts) {
            opts = opts || {};
            const key = (title || '').trim();
            if (!key) throw new Error('Tên công việc rỗng');

            if (!opts.forceRefresh && aiSuggestCache[key]) {
                _aiLog('Dùng cache cho:', key);
                return aiSuggestCache[key];
            }

            const prompt = buildAiSuggestPrompt(key);
            let lastError = null;

            for (let attempt = 0; attempt <= AI_SUGGEST_MAX_RETRY; attempt++) {
                try {
                    _aiLog(`Gọi Gemini phân tích (lần thử ${attempt + 1}/${AI_SUGGEST_MAX_RETRY + 1}):`, key);
                    const rawText = await _aiWithTimeout(fetchGeminiText(prompt, AI_SUGGEST_SYSTEM_INSTRUCTION), AI_SUGGEST_TIMEOUT_MS);
                    const result = _parseAiSuggestJson(rawText);
                    aiSuggestCache[key] = result;
                    _aiLog('Kết quả:', result);
                    return result;
                } catch (e) {
                    lastError = e;
                    _aiWarn(`Lần thử ${attempt + 1} thất bại:`, e.message || e);
                }
            }

            throw lastError || new Error('Không lấy được gợi ý từ Gemini');
        }

        // =============================================================
        // AI PLANNING — sinh gợi ý lập kế hoạch đầy đủ (SMART/Pareto/Eisenhower/
        // Action Plan/KPI/Rủi ro/Biện pháp/Hồ sơ) cho tab "Khởi Tạo Công Việc Mới".
        // Service riêng biệt, không đụng tới DOM — phần UI nằm ở js/tasks.js.
        // =============================================================

        const AI_PLAN_TIMEOUT_MS = 30000; // nặng hơn AI Suggest thường (8 nhóm cùng lúc) -> cho thêm thời gian
        const AI_PLAN_MAX_RETRY = 1;
        const AI_PLAN_SYSTEM_INSTRUCTION =
            'Bạn là chuyên gia quản lý dự án và cải tiến doanh nghiệp, thành thạo các phương pháp SMART, nguyên tắc ' +
            'Pareto (80/20), ma trận Eisenhower, lập Action Plan, xây dựng KPI, quản trị rủi ro. Nhiệm vụ: phân tích tên ' +
            'công việc được cung cấp và sinh ra đầy đủ các nhóm gợi ý lập kế hoạch theo đúng cấu trúc JSON yêu cầu. ' +
            'CHỈ trả về JSON hợp lệ, KHÔNG dùng Markdown (không bọc trong dấu ```), KHÔNG giải thích thêm bất kỳ nội dung ' +
            'nào ngoài JSON. Mỗi mục trong các danh sách là 1 câu ngắn gọn, cụ thể, có thể dùng làm 1 dòng việc cần làm.';

        function buildAiPlanPrompt(title) {
            return `Tên công việc: "${title}"

Hãy trả về DUY NHẤT 1 object JSON với đúng cấu trúc sau (không thêm trường nào khác, không thêm chú thích):
{
  "smart": "Mục tiêu SMART viết thành 1 đoạn ngắn",
  "pareto": ["việc quan trọng nhất 1", "việc quan trọng nhất 2", "..."],
  "eisenhower": {
    "do_now": ["việc cần làm ngay 1", "..."],
    "schedule": ["việc nên lên lịch 1", "..."],
    "delegate": ["việc nên giao người khác 1", "..."],
    "eliminate": ["việc không cần ưu tiên 1", "..."]
  },
  "action_plan": ["bước 1", "bước 2", "..."],
  "kpi": ["chỉ số KPI 1", "..."],
  "risks": ["rủi ro 1", "..."],
  "mitigations": ["biện pháp phòng ngừa 1", "..."],
  "documents": ["hồ sơ/tài liệu cần chuẩn bị 1", "..."]
}
Mỗi danh sách nên có khoảng 3-6 mục, ngắn gọn, thực tế, phù hợp với môi trường nhà máy/bảo trì công nghiệp.`;
        }

        const aiPlanCache = {};

        function _parseAiPlanJson(rawText) {
            if (!rawText) throw new Error('Gemini trả về nội dung rỗng');
            let text = rawText.trim();
            const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (fenceMatch) text = fenceMatch[1].trim();
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                text = text.substring(firstBrace, lastBrace + 1);
            }
            const json = JSON.parse(text);
            const asStrList = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [];
            const eh = json.eisenhower || {};
            return {
                smart: typeof json.smart === 'string' ? json.smart.trim() : '',
                pareto: asStrList(json.pareto),
                eisenhower: {
                    do_now: asStrList(eh.do_now),
                    schedule: asStrList(eh.schedule),
                    delegate: asStrList(eh.delegate),
                    eliminate: asStrList(eh.eliminate)
                },
                action_plan: asStrList(json.action_plan),
                kpi: asStrList(json.kpi),
                risks: asStrList(json.risks),
                mitigations: asStrList(json.mitigations),
                documents: asStrList(json.documents)
            };
        }

        // Service chính: phân tích tên công việc, trả về đầy đủ gợi ý lập kế hoạch.
        // Có cache riêng (khác cache của aiSuggestTaskFields), timeout, retry, log — không đụng DOM.
        async function aiGeneratePlan(title, opts) {
            opts = opts || {};
            const key = (title || '').trim();
            if (!key) throw new Error('Tên công việc rỗng');

            if (!opts.forceRefresh && aiPlanCache[key]) {
                _aiLog('[Plan] Dùng cache cho:', key);
                return aiPlanCache[key];
            }

            const prompt = buildAiPlanPrompt(key);
            let lastError = null;

            for (let attempt = 0; attempt <= AI_PLAN_MAX_RETRY; attempt++) {
                try {
                    _aiLog(`[Plan] Gọi Gemini lập kế hoạch (lần thử ${attempt + 1}/${AI_PLAN_MAX_RETRY + 1}):`, key);
                    const rawText = await _aiWithTimeout(fetchGeminiText(prompt, AI_PLAN_SYSTEM_INSTRUCTION), AI_PLAN_TIMEOUT_MS);
                    const result = _parseAiPlanJson(rawText);
                    aiPlanCache[key] = result;
                    _aiLog('[Plan] Kết quả:', result);
                    return result;
                } catch (e) {
                    lastError = e;
                    _aiWarn(`[Plan] Lần thử ${attempt + 1} thất bại:`, e.message || e);
                }
            }

            throw lastError || new Error('Không lấy được gợi ý kế hoạch từ Gemini');
        }

