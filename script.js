// Enhanced script.js for 100-question database-backed quiz system
document.addEventListener("DOMContentLoaded", function () {
    // Setup variables
    let totalQuestions = 0;
    let currentQuestionIndex = 0;
    let userAnswers = {};
    let quizStarted = false;
    let attemptId = null;
    let quizData = null;
    let correctAnswers = {};
    // Completion & monitoring flags (added)
    let quizCompleted = false; // prevents duplicate submissions
    let networkMonitorInterval = null; // interval id for student connectivity monitoring
    // Auto-submit warning state
    let autoSubmitCountdownActive = false;
    let autoSubmitCountdownTimer = null;
    let autoSubmitSecondsRemaining = 0;
    let autoSubmitVisibilityHandler = null;
    let autoSubmitReason = null; // 'online-detected' | 'time-expired'
    let autoSubmitOfflineHandler = null; // cancels countdown if internet goes OFF again
    // Track questions user marked for review before final submission
    const markedForReview = new Set();
    // Newly added: user identification variables
    let currentUserId = null; // will be set after user input
    let currentUserRole = null; // 'student' or 'teacher'
    // Additional optional user metadata
    let currentUsername = null;
    let currentUserFullName = null;
    let currentUserEmail = null;
    const quizPassword = "123"; // Default password for the quiz (guard only)
    const authorPassword = "123"; // Password for showing answers (author-only)

    // Timer setup - will be set from database
    let timeLeft = 90 * 60; // Default 90 minutes in seconds
    const timerElement = document.getElementById("timer");

    // Navigation buttons
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const submitBtn = document.getElementById("submitBtn");
    const resultDiv = document.getElementById("result");
    const progressFill = document.getElementById("progressFill");

    // Question navigation panel
    const rightBox = document.querySelector(".right.box");

    // Show answers control flag
    let showAnswersEnabled = false;

    // API base URL
    // Production (Firebase Hosting): we'll configure a rewrite so '/api/**' proxies to Cloud Run.
    // Dev: keep using http://<host>:8081/api when running locally.
    // Optional override: set window.QUIZ_BACKEND_BASE to an absolute origin (e.g. 'https://run.app').
    const API_HOST = (location.hostname && location.hostname !== '') ? location.hostname : '127.0.0.1';
    const isLocalHost = (API_HOST === 'localhost' || API_HOST === '127.0.0.1');
    const API_BASE = (window.QUIZ_BACKEND_BASE)
        ? `${window.QUIZ_BACKEND_BASE}/api`
        : (isLocalHost ? `http://${API_HOST}:8081/api` : '/api');

    // Subject color mapping
    const subjectColors = {
        1: '#000000', // DBMS - Black
        2: '#FF6B6B', // FEDF - Red
        3: '#4ECDC4', // OOP - Teal
        4: '#45B7D1'  // OS - Blue
    };

    // Device detection
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Internet connectivity detection
    let isOnline = navigator.onLine;
    let connectionStatus = {
        online: isOnline,
        lastChecked: new Date(),
        flightModeRequired: true
    };

    function updateConnectionStatus() {
        const wasOnline = connectionStatus.online;
        connectionStatus.online = navigator.onLine;
        connectionStatus.lastChecked = new Date();
        
        console.log(`Status update: navigator.onLine changed from ${wasOnline} to ${connectionStatus.online}`);
        
        if (wasOnline !== connectionStatus.online) {
            updateFlightModeIndicator();
            updateQuizStartButton();
        }
    }

    function checkInternetConnection() {
        console.log("Performing connection check...");
        
        // Use a more reliable technique to check internet connectivity
        // We'll do a direct test to known external resources with actual fetch
        // and consider it offline ONLY if ALL external resource tests fail
        
        // Prefer a same-origin, cache-busted health endpoint for connectivity check
        const origin = location.origin || '';
        const testUrls = [ `${origin}/health.txt` ];
        
        // Create a fetch promise for each URL with a short timeout
        const fetchPromises = testUrls.map(url => {
            return new Promise((resolve, reject) => {
                // Use Date.now() to prevent caching
                const nocacheUrl = `${url}?nc=${Date.now()}`;
                
                // Set a timeout for the fetch to avoid long waits
                const timeoutId = setTimeout(() => {
                    console.log(`Fetch timeout for ${url}`);
                    reject(new Error('Timeout'));
                }, 2000);
                
                fetch(nocacheUrl, { 
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-store'
                })
                .then(response => {
                    clearTimeout(timeoutId);
                    console.log(`Fetch success for ${url}`);
                    resolve(true);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    console.log(`Fetch failed for ${url}: ${error.message}`);
                    reject(error);
                });
            });
        });
        
        // Consider online only if at least one fetch succeeds
        Promise.any(fetchPromises)
            .then(() => {
                // At least one URL was reachable - we're online
                console.log('ONLINE: At least one external resource reachable');
                if (!connectionStatus.online) {
                    connectionStatus.online = true;
                    updateFlightModeIndicator();
                    updateQuizStartButton();
                }
            })
            .catch(error => {
                // ALL URLs failed - we're likely offline
                console.log('OFFLINE: All external resources unreachable');
                connectionStatus.online = false;
                updateFlightModeIndicator();
                updateQuizStartButton();
            });
    }

    function updateFlightModeIndicator() {
        const indicator = document.getElementById('flight-mode-indicator');
        const statusText = document.getElementById('connection-status');
        const startButton = document.querySelector('button[onclick="verifyPasswordAndStart()"]');
        
        console.log('Updating flight mode indicator - online status:', connectionStatus.online);
        
        if (indicator) {
            if (connectionStatus.online) {
                indicator.className = 'flight-mode-indicator online';
                statusText.textContent = '🌐 Internet Connected - Flight mode required to start quiz';
                indicator.style.borderColor = '#ff4757';
                indicator.style.backgroundColor = '#ff6b7a';
                console.log('UI updated: Online state');
            } else {
                indicator.className = 'flight-mode-indicator offline';
                statusText.textContent = '✈️ Flight mode active - Quiz can be started';
                indicator.style.borderColor = '#2ed573';
                indicator.style.backgroundColor = '#7bed9f';
                console.log('UI updated: Offline state');
            }
        } else {
            console.log('Warning: flight-mode-indicator element not found');
        }
    }

    function updateQuizStartButton() {
        const startButton = document.querySelector('button[onclick="verifyPasswordAndStart()"]');
        console.log('Updating start button - online status:', connectionStatus.online);
        
        if (startButton) {
            if (connectionStatus.online) {
                startButton.disabled = true;
                startButton.style.backgroundColor = '#ccc';
                startButton.style.cursor = 'not-allowed';
                startButton.textContent = 'Turn off Internet to Start Quiz';
                console.log('Start button disabled - internet detected');
            } else {
                startButton.disabled = false;
                startButton.style.backgroundColor = '';
                startButton.style.cursor = '';
                startButton.textContent = 'Start 100-Question Quiz';
                console.log('Start button enabled - flight mode active');
            }
        } else {
            console.log('Warning: start button not found');
        }
    }

    // Set up event listeners for online/offline events
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Periodically check connection status
    setInterval(checkInternetConnection, 12000); // Lighter: check every 12 seconds

    // API helper functions
    // Ensure we don't fall back to /api when Firebase shim hasn't finished loading yet
    function waitForFirebaseApi(timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            if (window.FIREBASE_MODE && typeof window.firebaseApiCall === 'function') {
                return resolve();
            }
            let settled = false;
            const onReady = () => {
                if (!settled) {
                    settled = true;
                    window.removeEventListener('firebaseApiReady', onReady);
                    resolve();
                }
            };
            window.addEventListener('firebaseApiReady', onReady, { once: true });
            const t = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    window.removeEventListener('firebaseApiReady', onReady);
                    // Resolve anyway so caller can decide fallback behavior
                    resolve();
                }
            }, timeoutMs);
        });
    }

    // Simple offline cache for quiz data (prefetched while online)
    const quizCache = {
        loaded: false,
        subjects: [],
        questions: [],
        optionsByQid: {}
    };

    // Load cache from localStorage if present
    try {
        const cached = JSON.parse(localStorage.getItem('quizCache_v1') || 'null');
        if (cached && cached.questions && cached.subjects && cached.optionsByQid) {
            Object.assign(quizCache, cached, { loaded: true });
            console.log('[offline-cache] Restored quiz cache from localStorage');
        }
    } catch (_) {}

    async function prefetchQuizDataIfOnline() {
        if (!navigator.onLine) return; // only prefetch when online
        try {
            await waitForFirebaseApi(5000);
            if (typeof window.firebaseApiCall !== 'function') return;
            console.log('[offline-cache] Prefetching quiz data...');
            const [subjects, questions] = await Promise.all([
                window.firebaseApiCall('/quiz/subjects', 'GET'),
                window.firebaseApiCall('/quiz/1/questions', 'GET')
            ]);
            const optionsByQidEntries = await Promise.all(questions.map(async q => {
                const opts = await window.firebaseApiCall(`/quiz/questions/${q.id}/options`, 'GET');
                return [String(q.id), opts];
            }));
            const optionsByQid = Object.fromEntries(optionsByQidEntries);
            quizCache.subjects = Array.isArray(subjects) ? subjects : [];
            quizCache.questions = Array.isArray(questions) ? questions : [];
            quizCache.optionsByQid = optionsByQid;
            quizCache.loaded = true;
            try {
                localStorage.setItem('quizCache_v1', JSON.stringify({
                    subjects: quizCache.subjects,
                    questions: quizCache.questions,
                    optionsByQid: quizCache.optionsByQid
                }));
            } catch (_) {}
            console.log(`[offline-cache] Prefetched ${quizCache.questions.length} questions`);
        } catch (e) {
            console.warn('[offline-cache] Prefetch failed:', e.message || e);
        }
    }

    // attempt answers buffer for offline mode
    const offlineAttempt = {
        id: null,
        answers: {},
        completed: false,
        result: null,
        synced: false,
        remoteAttemptId: null
    };
    let offlineUserPayload = null; // queued identification when offline

    // Restore any persisted offline state
    try {
        const saved = JSON.parse(localStorage.getItem('offline_attempt_v1')||'null');
        if (saved && typeof saved === 'object') Object.assign(offlineAttempt, saved);
        const savedUser = JSON.parse(localStorage.getItem('offline_user_payload_v1')||'null');
        if (savedUser) offlineUserPayload = savedUser;
    } catch(_){}

    function persistOfflineAttempt(){
        try { localStorage.setItem('offline_attempt_v1', JSON.stringify(offlineAttempt)); } catch(_){}
    }
    function persistOfflineUserPayload(){
        try { localStorage.setItem('offline_user_payload_v1', JSON.stringify(offlineUserPayload)); } catch(_){}
    }

    async function flushOfflineToFirestore(){
        if (!navigator.onLine) return false;
        await waitForFirebaseApi(7000);
        if (typeof window.firebaseApiCall !== 'function') return false;
        try {
            // Identify user first if queued
            if (offlineUserPayload) {
                try {
                    const savedUser = await window.firebaseApiCall('/users/identify','POST', offlineUserPayload);
                    if (savedUser && savedUser.id) {
                        currentUserId = savedUser.id;
                    }
                    offlineUserPayload = null;
                    persistOfflineUserPayload();
                } catch(e){ /* keep queued */ }
            }

            if (offlineAttempt.id && !offlineAttempt.synced) {
                const started = await window.firebaseApiCall(`/quiz/1/start`, 'POST');
                const remoteId = started && (started.id || started.attemptId || started.attempt_id);
                if (!remoteId) return false;
                offlineAttempt.remoteAttemptId = remoteId;
                for (const [qid, sel] of Object.entries(offlineAttempt.answers||{})){
                    await window.firebaseApiCall(`/quiz/attempts/${remoteId}/answer`, 'POST', {
                        questionId: qid,
                        selectedOptionId: sel
                    });
                }
                if (offlineAttempt.completed) {
                    await window.firebaseApiCall(`/quiz/attempts/${remoteId}/complete`, 'POST');
                }
                offlineAttempt.synced = true;
                persistOfflineAttempt();
            }
            return true;
        } catch (e) {
            console.warn('[offline-sync] flush failed:', e.message||e);
            return false;
        }
    }
    window.addEventListener('online', () => { flushOfflineToFirestore(); });

    async function apiCall(endpoint, method = 'GET', body = null) {
        // In Firebase-only mode, route through firebase-api shim (wait for it if needed)
        if (window.FIREBASE_MODE) {
            if (typeof window.firebaseApiCall !== 'function') {
                await waitForFirebaseApi(7000);
            }
            // If offline, serve from cache for supported endpoints
            if (!navigator.onLine) {
                const path = endpoint.split('?')[0];
                // GET subjects/questions/options from cache
                if (method === 'GET' && path === '/quiz/subjects') {
                    if (!quizCache.loaded) throw new Error('Offline: quiz not cached yet');
                    return quizCache.subjects.length ? quizCache.subjects : [
                        { id: 1, name: 'DBMS', color: '#000000' },
                        { id: 2, name: 'FEDF', color: '#FF6B6B' },
                        { id: 3, name: 'OOP', color: '#4ECDC4' },
                        { id: 4, name: 'OS',  color: '#45B7D1' }
                    ];
                }
                if (method === 'GET' && path === '/quiz/1/questions') {
                    if (!quizCache.loaded) throw new Error('Offline: quiz not cached yet');
                    return quizCache.questions;
                }
                const optMatch = path.match(/^\/quiz\/questions\/(.+)\/options$/);
                if (method === 'GET' && optMatch) {
                    if (!quizCache.loaded) throw new Error('Offline: quiz not cached yet');
                    return quizCache.optionsByQid[String(optMatch[1])] || [];
                }
                // POST start -> fabricate attempt id locally
                if (method === 'POST' && /^\/quiz\/1\/start$/.test(path)) {
                    offlineAttempt.id = 'local-' + Date.now();
                    offlineAttempt.answers = {};
                    return { id: offlineAttempt.id };
                }
                // POST answer -> store locally
                const ansMatch = path.match(/^\/quiz\/attempts\/(.+)\/answer$/);
                if (method === 'POST' && ansMatch) {
                    const payload = (typeof body === 'string') ? JSON.parse(body || '{}') : (body || {});
                    const qid = payload.questionId ?? payload.question_id;
                    const selected = payload.selectedOptionId ?? payload.selected_id ?? payload.selectedIndex;
                    if (qid == null) throw new Error('Offline: missing questionId');
                    offlineAttempt.answers[String(qid)] = selected;
                    return { ok: true };
                }
                // POST complete -> compute score from cache
                const compMatch = path.match(/^\/quiz\/attempts\/(.+)\/complete$/);
                if (method === 'POST' && compMatch) {
                    if (!quizCache.loaded) throw new Error('Offline: quiz not cached yet');
                    let correct = 0;
                    const total = quizCache.questions.length;
                    for (const q of quizCache.questions) {
                        const sel = offlineAttempt.answers[String(q.id)];
                        const opts = quizCache.optionsByQid[String(q.id)] || [];
                        const chosen = opts.find(o => String(o.id) === String(sel));
                        if (chosen && (chosen.isCorrect === true || chosen.is_correct === true)) correct++;
                    }
                    return { correctAnswers: correct, totalQuestions: total, score: Math.round((correct * 100) / (total || 1)) };
                }
                // Any other endpoint not supported offline
                throw new Error('Offline: endpoint not available');
            }
            // Online normal path via firebase shim
            if (typeof window.firebaseApiCall === 'function') {
                return await window.firebaseApiCall(endpoint, method, body);
            }
            // If still not available, throw an explicit error rather than hitting unknown /api
            throw new Error('Firebase API not ready');
        }
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            const url = API_BASE + endpoint;
            const response = await fetch(url, options);

            // Try to parse response safely
            const contentType = response.headers.get('content-type') || '';
            let data = null;
            if (response.status === 204) {
                data = {};
            } else if (contentType.includes('application/json')) {
                // Parse JSON if body exists
                const text = await response.text();
                data = text ? JSON.parse(text) : {};
            } else {
                // Fallback: read text (useful for error messages from proxies/servers)
                data = { message: await response.text() };
            }

            if (!response.ok) {
                const message = (data && (data.error || data.message)) || `API request failed (${response.status})`;
                throw new Error(message);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Initialize quiz
    async function initializeQuiz() {
        try {
            // Show authentication first, then prerequisites
            showUserIdentificationPage();
        } catch (error) {
            console.error('Quiz initialization error:', error);
            alert('Failed to initialize quiz. Please refresh the page.');
        }
    }

    // Show prerequisites panel
    function showPrerequisites() {
        const quizContainer = document.querySelector(".container");
        const prerequisiteDiv = document.createElement("div");
        prerequisiteDiv.classList.add("prerequisite");
        prerequisiteDiv.innerHTML = `
            <div class="prerequisite-content">
                <h2>Computer Science Fundamentals Quiz</h2>
                <div class="quiz-details">
                    <p><strong>100 Questions</strong> covering 4 major subjects:</p>
                    <ul style="list-style: none; padding: 0;">
                        <li>🗄️ <strong>DBMS</strong>: Questions 1-25 (Database Management Systems)</li>
                        <li>🌐 <strong>FEDF</strong>: Questions 26-50 (Front-End Development Frameworks)</li>
                        <li>⚙️ <strong>OOP</strong>: Questions 51-75 (Object-Oriented Programming)</li>
                        <li>💻 <strong>OS</strong>: Questions 76-100 (Operating Systems)</li>
                    </ul>
                </div>
                
                <!-- Flight Mode Status Indicator -->
                <div id="flight-mode-indicator" class="flight-mode-indicator">
                    <div class="indicator-icon">✈️</div>
                    <div id="connection-status" class="connection-status">
                        🌐 Checking internet connection...
                    </div>
                    <button type="button" onclick="forceConnectionCheck()" style="margin-left: 10px; padding: 5px 10px; border: none; border-radius: 5px; background: #3498db; color: white; cursor: pointer; font-size: 12px;">
                        🔄 Recheck
                    </button>
                </div>
                
                <div class="prerequisites-list">
                    <p><strong>Before starting, please ensure:</strong></p>
                    <ul>
                        <li><strong>❗ Turn OFF internet connection (Enable flight mode)</strong></li>
                        <li>Close all other browser tabs and applications</li>
                        <li>Ensure you have a stable power source</li>
                        <li>Find a quiet environment for concentration</li>
                        <li>Allocate 90 minutes for completion</li>
                    </ul>
                    <p style="color: #ff4757; font-weight: bold; margin-top: 15px;">
                        ⚠️ Quiz cannot be started while internet is connected
                    </p>
                </div>
                <div class="password-section">
                    <label for="quiz-password">Enter Quiz Password:</label>
                    <input type="password" id="quiz-password" placeholder="Enter password" aria-describedby="password-error" aria-invalid="false">
                    <button onclick="verifyPasswordAndStart()" id="start-quiz-btn">Start 100-Question Quiz</button>
                    <div id="password-error" style="color: red; display: none; margin-top: 10px;" aria-live="polite"></div>
                </div>
            </div>
        `;
        prerequisiteDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            overflow-y: auto;
        `;

        document.body.appendChild(prerequisiteDiv);

        // Initialize connection status check
        setTimeout(() => {
            // Initial check
            checkInternetConnection();
            
            // Secondary check after a delay for better accuracy
            setTimeout(() => {
                checkInternetConnection();
                updateFlightModeIndicator();
                updateQuizStartButton();
            }, 1000);
        }, 500);

        // Kick off background prefetch while the user is online on the landing screen
        prefetchQuizDataIfOnline();

        // Make functions global
        window.forceConnectionCheck = function() {
            console.log('=== Manual Connection Check ===');
            
            // Show checking status
            const statusText = document.getElementById('connection-status');
            if (statusText) {
                statusText.textContent = '🔄 Checking connection status...';
            }
            
            // Clear any previous checks and run a new one
            checkInternetConnection();
            
            // Run a second check after a delay for better accuracy
            setTimeout(() => {
                checkInternetConnection();
            }, 1000);
        };

    window.verifyPasswordAndStart = async function() {
            // Debug information
            console.log('=== Quiz Start Attempt ===');
            console.log('connectionStatus.online:', connectionStatus.online);
            console.log('connectionStatus.lastChecked:', connectionStatus.lastChecked);
            
            // Run a quick connection check first
            await new Promise(resolve => {
                // Show checking status
                const statusText = document.getElementById('connection-status');
                if (statusText) {
                    statusText.textContent = '🔄 Final connection check...';
                }
                
                // Create a separate promise just for this final check
                const testUrls = ['https://www.google.com/generate-204'];
                
                const fetchPromises = testUrls.map(url => {
                    return new Promise((resolve, reject) => {
                        fetch(`${url}?nc=${Date.now()}`, { 
                            method: 'HEAD',
                            mode: 'no-cors',
                            cache: 'no-store'
                        })
                        .then(() => resolve(true))
                        .catch(() => reject(false));
                    });
                });
                
                Promise.any(fetchPromises)
                    .then(() => {
                        connectionStatus.online = true;
                        resolve();
                    })
                    .catch(() => {
                        connectionStatus.online = false;
                        resolve();
                    });
                
                // Set a timeout to ensure we don't wait too long
                setTimeout(resolve, 2000);
            });
            
            updateFlightModeIndicator();
            updateQuizStartButton();
            
            // After final check, verify if we're offline
            if (connectionStatus.online) {
                alert('❗ Please turn off your internet connection (enable flight mode) before starting the quiz.');
                console.log('Quiz start blocked: Connection detected');
                return;
            }

            const password = document.getElementById('quiz-password').value;
            const errorDiv = document.getElementById('password-error');

            // Local password verification to avoid backend dependency
            if (password !== quizPassword) {
                errorDiv.textContent = 'Invalid password';
                errorDiv.style.display = 'block';
                return;
            }

            console.log('Password verified locally – proceeding to start quiz flow');
            // At this stage, user is already authenticated; proceed to load quiz
            prerequisiteDiv.remove();
            loadQuizData();
        };
    }

    // New: user identification page (shown after password & offline checks pass)
    function showUserIdentificationPage() {
        const userDiv = document.createElement('div');
        userDiv.classList.add('user-identification');
        userDiv.innerHTML = `
            <div class="prerequisite-content" style="max-width: 520px;">
                <h2>User Identification</h2>
                <p style="margin-top:0;">Enter your User ID and (optionally) basic details, then select your role to begin.</p>
                <div style="margin:15px 0; display:flex; flex-direction:column; gap:12px;">
                    <label style="display:flex; flex-direction:column; font-weight:600;">
                        User ID (number required):
                        <input type="number" id="user-id-input" min="1" placeholder="e.g. 42" style="padding:8px; border-radius:6px; border:1px solid #555; background:#222; color:#fff;">
                    </label>
                    <label style="display:flex; flex-direction:column; font-weight:600;">
                        Username (optional):
                        <input type="text" id="user-username-input" maxlength="50" placeholder="e.g. jdoe" style="padding:8px; border-radius:6px; border:1px solid #555; background:#222; color:#fff;">
                    </label>
                    <label style="display:flex; flex-direction:column; font-weight:600;">
                        Full Name (optional):
                        <input type="text" id="user-fullname-input" maxlength="100" placeholder="e.g. John Doe" style="padding:8px; border-radius:6px; border:1px solid #555; background:#222; color:#fff;">
                    </label>
                    <label style="display:flex; flex-direction:column; font-weight:600;">
                        Email (required, must end with @klh.edu.in):
                        <input type="email" id="user-email-input" maxlength="120" placeholder="e.g. name@klh.edu.in" style="padding:8px; border-radius:6px; border:1px solid #555; background:#222; color:#fff;">
                    </label>
                    <label style="display:flex; flex-direction:column; font-weight:600;">
                        Password (required for sign-in):
                        <input type="password" id="user-password-input" maxlength="120" placeholder="Choose or enter your password" style="padding:8px; border-radius:6px; border:1px solid #555; background:#222; color:#fff;">
                    </label>
                    <fieldset style="border:1px solid #444; border-radius:6px; padding:10px;">
                        <legend style="padding:0 6px; font-weight:600;">Role</legend>
                        <label style="margin-right:15px;">
                            <input type="radio" name="user-role" value="student" checked> Student
                        </label>
                        <label>
                            <input type="radio" name="user-role" value="teacher"> Teacher
                        </label>
                    </fieldset>
                    
                    <button id="confirm-user-btn" style="padding:10px 16px; background:#27ae60; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:15px;">Begin Quiz</button>
                    <div id="user-setup-error" style="display:none; color:#ff6b6b; font-weight:600;" aria-live="polite"></div>
                </div>
            </div>
        `;
        userDiv.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9);
            display:flex; justify-content:center; align-items:center;
            z-index:1000; overflow-y:auto; padding:20px; box-sizing:border-box;`;

        document.body.appendChild(userDiv);

        // Role UI has no separate teacher password; authorization is via Firebase Auth + role in Firestore

        document.getElementById('confirm-user-btn').addEventListener('click', async () => {
            const userIdInput = document.getElementById('user-id-input');
            const usernameInput = document.getElementById('user-username-input');
            const fullnameInput = document.getElementById('user-fullname-input');
            const emailInput = document.getElementById('user-email-input');
            const passwordInput = document.getElementById('user-password-input');
            const errorBox = document.getElementById('user-setup-error');
            const roleValue = document.querySelector('input[name="user-role"]:checked')?.value || 'student';

            const parsedId = parseInt(userIdInput.value, 10);
            if (isNaN(parsedId)) {
                errorBox.textContent = 'Invalid ID: must be a number.';
                errorBox.style.display = 'block';
                return;
            }

            // Role-specific ID range constraints
            const isStudent = roleValue === 'student';
            const isTeacher = roleValue === 'teacher';

            let idValid = true;
            if (isStudent) {
                // Student IDs: 2410030001 - 2410030600
                idValid = parsedId >= 2410030001 && parsedId <= 2410030600;
            } else if (isTeacher) {
                // Teacher IDs: 20001 - 20100
                idValid = parsedId >= 20001 && parsedId <= 20100;
            }
            if (!idValid) {
                errorBox.textContent = 'Invalid ID for selected role.';
                errorBox.style.display = 'block';
                return;
            }

            // Require password for authentication
            const pw = (passwordInput.value || '').trim();
            if (!pw || pw.length < 6) {
                errorBox.textContent = 'Password required (min 6 chars).';
                errorBox.style.display = 'block';
                return;
            }

            // Email must be present and end with @klh.edu.in
            const emailVal = (emailInput.value || '').trim();
            if (!emailVal || !emailVal.toLowerCase().endsWith('@klh.edu.in')) {
                errorBox.textContent = 'Invalid ID: email must end with @klh.edu.in';
                errorBox.style.display = 'block';
                return;
            }
            // Basic email pattern check (lightweight)
            if (!/^([^\s@]+)@klh\.edu\.in$/i.test(emailVal)) {
                errorBox.textContent = 'Invalid email format.';
                errorBox.style.display = 'block';
                return;
            }

            // Store the raw entered number temporarily; may be too large for backend INT primary key
            currentUserId = parsedId;
            currentUserRole = roleValue;
            currentUsername = usernameInput.value.trim() || null;
            currentUserFullName = fullnameInput.value.trim() || null;
            currentUserEmail = emailInput.value.trim() || null;

            // Authenticate with Firebase; students can self-register, teachers must pre-exist
            try {
                const helpers = window.firebaseAuthHelpers;
                const auth = window.firebaseAuth;
                try {
                    await helpers.signInWithEmailAndPassword(currentUserEmail, pw);
                } catch (e) {
                    if (isStudent && /auth\/user-not-found/.test(e.message)) {
                        await helpers.createUserWithEmailAndPassword(currentUserEmail, pw);
                    } else {
                        throw e;
                    }
                }
                const savedUser = await apiCall('/users/identify', 'POST', {
                    username: currentUsername || String(currentUserId),
                    email: currentUserEmail,
                    fullName: currentUserFullName,
                    role: currentUserRole,
                    externalId: currentUserId
                });
                currentUserId = savedUser && savedUser.id ? savedUser.id : (auth && auth.currentUser ? auth.currentUser.uid : null);
                console.log('User record persisted/identified:', savedUser);
            } catch (persistErr) {
                console.warn('User identify call failed, proceeding anyway:', persistErr.message);
                // Queue user payload for sync when back online
                try {
                    offlineUserPayload = {
                        username: currentUsername || String(currentUserId),
                        email: currentUserEmail,
                        fullName: currentUserFullName,
                        role: currentUserRole,
                        externalId: currentUserId,
                        id: currentUserId
                    };
                    persistOfflineUserPayload();
                } catch(_){}
            }

            console.log('User identification confirmed:', { currentUserId, currentUserRole, currentUsername, currentUserFullName, currentUserEmail });

            // If teacher, redirect to dashboard instead of loading quiz
            if (currentUserRole === 'teacher') {
                userDiv.remove();
                window.location.href = 'teacher.html';
                return;
            }

            userDiv.remove();
            // After successful login/identification, show prerequisites next
            showPrerequisites();
        });
    }
    // Load quiz data from backend
    async function loadQuizData() {
        try {
            // Start quiz attempt (Auth uid used server-side)
            let startResponse;
            try {
                startResponse = await apiCall(`/quiz/1/start`, 'POST');
            } catch (e) {
                console.error('Start attempt failed:', e);
                throw e; // rethrow
            }
            attemptId = startResponse.id || startResponse.attempt_id || startResponse.attemptId;

            // Load questions
            const questions = await apiCall('/quiz/1/questions');

            // Load subjects (if available) to enrich with name/color
            let subjects = [];
            try {
                subjects = await apiCall('/quiz/subjects');
            } catch (subErr) {
                console.warn('Fetching subjects failed; continuing with defaults', subErr);
            }

            // Build a lookup for subjects by id (fallback to name/color from question if present)
            const subjectById = new Map();
            if (Array.isArray(subjects)) {
                subjects.forEach(s => subjectById.set(s.id || s.subjectId, s));
            }

            // For each question, fetch options in parallel
            const optionPromises = questions.map(q => apiCall(`/quiz/questions/${q.id}/options`).catch((err) => { console.warn('Options fetch failed for q', q.id, err); return []; }));
            const allOptions = await Promise.all(optionPromises);

            // Adapt data to expected shape in the UI
            const adaptedQuestions = questions.map((q, idx) => {
                const subjectId = q.subjectId || q.subject_id;
                const subject = subjectById.get(subjectId) || { id: subjectId, name: q.subjectName || 'Subject', color: q.subjectColor || subjectColors[subjectId] || '#999' };
                const optionsRaw = allOptions[idx] || [];
                const options = optionsRaw.map(o => ({
                    id: o.id,
                    option_text: o.optionText || o.option_text,
                    is_correct: (o.isCorrect !== undefined ? o.isCorrect : o.is_correct)
                }));
                return {
                    id: q.id,
                    subject_id: subjectId,
                    order_num: q.orderNum || q.order_num || (idx + 1),
                    question_text: q.questionText || q.question_text,
                    options
                };
            });

            const uniqueSubjectIds = [...new Set(adaptedQuestions.map(q => q.subject_id))];
            const adaptedSubjects = uniqueSubjectIds.map(id => {
                const s = subjectById.get(id);
                return {
                    id,
                    name: s?.name || s?.subjectName || `Subject ${id}`,
                    color: s?.color || s?.subjectColor || subjectColors[id] || '#666'
                };
            });

            quizData = {
                questions: adaptedQuestions,
                subjects: adaptedSubjects,
                total_questions: adaptedQuestions.length
            };

            console.log(`Loaded ${quizData.total_questions} questions from database`);

            // Process and display questions
            await processQuizData();

            // Start the quiz
            startQuiz();

        } catch (error) {
            console.error('Failed to load quiz data:', error);
            const msg = (error && error.message) ? String(error.message) : 'Unknown error';
            alert('Failed to load quiz data. Details: ' + msg);
        }
    }

    // Process quiz data and generate HTML
    async function processQuizData() {
        const quizForm = document.getElementById('quizForm');
        const loadingDiv = document.getElementById('loading');

        quizForm.innerHTML = '';
        loadingDiv.style.display = 'block';

        // Group questions by subject
        const questionsBySubject = {};
        quizData.questions.forEach(q => {
            if (!questionsBySubject[q.subject_id]) {
                questionsBySubject[q.subject_id] = [];
            }
            questionsBySubject[q.subject_id].push(q);
        });

        // Sort questions by order number
        quizData.questions.sort((a, b) => a.order_num - b.order_num);

        let questionIndex = 0;

        // Generate HTML for all questions
        quizData.questions.forEach((question, index) => {
            const subject = quizData.subjects.find(s => s.id === question.subject_id);
            correctAnswers[`q${question.id}`] = question.options.find(opt => opt.is_correct)?.option_text || '';

            const questionDiv = document.createElement('div');
            questionDiv.className = 'question';
            questionDiv.style.display = index === 0 ? 'block' : 'none';

            let optionsHTML = '';
            question.options.forEach((option, optIndex) => {
                optionsHTML += `
                    <label>
                        <input type="radio" name="q${question.id}" value="${option.id}" data-question-id="${question.id}">
                        <span>${option.option_text}</span>
                    </label>
                `;
            });

            questionDiv.innerHTML = `
                <div class="question-header">
                    <h3>Question ${question.order_num}</h3>
                    <span class="subject-badge" style="background-color: ${subject.color}">${subject.name}</span>
                </div>
                <p class="question-text">${question.question_text}</p>
                <div class="options">
                    ${optionsHTML}
                </div>
                <div class="review-actions">
                    <button type="button" class="mark-review-btn" data-question-id="${question.id}">Mark for Review</button>
                </div>
            `;

            quizForm.appendChild(questionDiv);
            questionIndex++;
        });

        totalQuestions = questionIndex;
        loadingDiv.style.display = 'none';

        // Update navigation
        createNavigationButtons();
        updateNavigationButtonStyles();
    }

    // Create navigation buttons in right panel
    function createNavigationButtons() {
        // New grouped navigation: 4 subjects with fixed ranges based on order_num
        const container = document.getElementById('questionNavigation');
        if (!container) return;
        container.innerHTML = '';

        // Determine subjects & ranges from quizData (fallback to fixed chunk of 25)
        // Build map subjectId -> questions (sorted by order_num)
        const bySubject = new Map();
        quizData.questions.forEach(q => {
            if (!bySubject.has(q.subject_id)) bySubject.set(q.subject_id, []);
            bySubject.get(q.subject_id).push(q);
        });
        bySubject.forEach(arr => arr.sort((a,b)=>a.order_num-b.order_num));

        // Sort subject order by first question order_num
        const subjectEntries = [...bySubject.entries()].sort((a,b)=>a[1][0].order_num - b[1][0].order_num);

        subjectEntries.forEach(([subjectId, questions]) => {
            const subjectMeta = quizData.subjects.find(s=>s.id===subjectId) || { name: `Subject ${subjectId}` };
            // Header
            const header = document.createElement('div');
            header.className = 'qnav-subject';
            header.textContent = subjectMeta.name.toUpperCase();
            container.appendChild(header);
            // Grid box
            const grid = document.createElement('div');
            grid.className = 'qnav-group-box';
            questions.forEach(q => {
                const idx = quizData.questions.findIndex(qq=>qq.id===q.id); // index for showQuestion
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = q.order_num;
                btn.className = 'qnav-btn';
                btn.addEventListener('click', ()=>showQuestion(idx));
                grid.appendChild(btn);
            });
            container.appendChild(grid);
        });
    }

    // Start quiz functionality
    function startQuiz() {
        quizStarted = true;
        document.querySelector('.container').style.display = 'flex';

        // Set up timer based on quiz configuration (90 minutes for 100 questions)
        timeLeft = 90 * 60;

        updateTimer();
        const timer = setInterval(() => {
            if (!quizStarted) {
                clearInterval(timer);
                return;
            }
            updateTimer();
        }, 1000);

        function updateTimer() {
            if (timeLeft <= 0) {
                clearInterval(timer);
                submitQuiz(true); // Auto-submit when time expires
                return;
            }

            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;

            timerElement.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Change color when time is running low
            if (timeLeft < 300) { // Less than 5 minutes
                timerElement.style.color = '#f44336';
            } else if (timeLeft < 900) { // Less than 15 minutes
                timerElement.style.color = '#ff9800';
            }

            timeLeft--;
        }

        // Set up event listeners
        setupEventListeners();

        // Student-only: auto-submit if internet turns ON after starting (anti-cheat)
        if (currentUserRole === 'student') {
            const initiateCountdown = () => {
                if (!quizStarted || quizCompleted || autoSubmitCountdownActive) return;
                autoSubmitCountdownActive = true;
                autoSubmitSecondsRemaining = 30; // extend warning to 30 seconds
                autoSubmitReason = 'online-detected';

                // Overlay creation
                let overlay = document.getElementById('auto-submit-warning');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'auto-submit-warning';
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:3000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,Segoe UI,Arial,sans-serif;text-align:center;padding:32px;';
                    overlay.innerHTML = `
                        <div style="max-width:640px;">
                          <h2 style="margin:0 0 14px;color:#ffcc00;font-size:2.2rem;">Internet Detected</h2>
                          <p style="margin:0 0 20px;font-size:1.05rem;line-height:1.5;">
                            Your device reconnected to the Internet. Per exam rules this attempt will auto-submit.<br>
                            <strong>Do NOT switch tabs or minimize – that will submit immediately.</strong>
                          </p>
                          <div id="auto-submit-count" style="font-size:3.2rem;font-weight:700;letter-spacing:2px;margin-bottom:20px;">30</div>
                          <button id="auto-submit-now" style="background:#e74c3c;border:none;color:#fff;padding:12px 28px;font-size:1rem;border-radius:8px;cursor:pointer;font-weight:600;">Submit Now</button>
                        </div>`;
                    document.body.appendChild(overlay);
                }
                const countEl = document.getElementById('auto-submit-count');
                const submitBtnNow = document.getElementById('auto-submit-now');
                if (submitBtnNow) submitBtnNow.onclick = () => submitQuiz(false);

                // Tab visibility enforcement
                autoSubmitVisibilityHandler = () => {
                    if (document.hidden && quizStarted && !quizCompleted) {
                        submitQuiz(false);
                    }
                };
                document.addEventListener('visibilitychange', autoSubmitVisibilityHandler);

                // If user turns Internet OFF again during countdown, cancel and let them continue
                const cancelCountdown = () => {
                    if (!autoSubmitCountdownActive) return;
                    autoSubmitCountdownActive = false;
                    if (autoSubmitCountdownTimer) { clearInterval(autoSubmitCountdownTimer); autoSubmitCountdownTimer = null; }
                    if (autoSubmitVisibilityHandler) { document.removeEventListener('visibilitychange', autoSubmitVisibilityHandler); autoSubmitVisibilityHandler = null; }
                    const over = document.getElementById('auto-submit-warning');
                    if (over) over.remove();
                };
                autoSubmitOfflineHandler = () => { if (!navigator.onLine) cancelCountdown(); };
                window.addEventListener('offline', autoSubmitOfflineHandler);

                autoSubmitCountdownTimer = setInterval(() => {
                    // If network went OFF, cancel
                    if (!navigator.onLine) { return; }
                    autoSubmitSecondsRemaining--;
                    if (countEl) countEl.textContent = String(autoSubmitSecondsRemaining);
                    if (autoSubmitSecondsRemaining <= 0) {
                        clearInterval(autoSubmitCountdownTimer);
                        autoSubmitCountdownTimer = null;
                        submitQuiz(false);
                    }
                }, 1000);
            };

            const handleOnline = () => {
                if (quizStarted && !quizCompleted) initiateCountdown();
            };
            window.addEventListener('online', handleOnline, { once: true });
            networkMonitorInterval = setInterval(() => {
                if (navigator.onLine && quizStarted && !quizCompleted && !autoSubmitCountdownActive) {
                    handleOnline();
                }
            }, 4000);
        }

        // Show first question
        showQuestion(0);
    }

    // Set up event listeners
    function setupEventListeners() {
        // Navigation buttons
        prevBtn.addEventListener("click", () => {
            if (currentQuestionIndex > 0) {
                showQuestion(currentQuestionIndex - 1);
            }
        });

        nextBtn.addEventListener("click", () => {
            if (currentQuestionIndex < totalQuestions - 1) {
                showQuestion(currentQuestionIndex + 1);
            }
        });

        submitBtn.addEventListener("click", () => {
            const answeredCount = Object.keys(userAnswers).length;
            const confirmMessage = answeredCount === totalQuestions 
                ? "Are you sure you want to submit the quiz?" 
                : `You have answered ${answeredCount} out of ${totalQuestions} questions. Are you sure you want to submit?`;

            if (confirm(confirmMessage)) {
                submitQuiz();
            }
        });

        // Answer selection with debounce per question
        const pendingSaves = new Map();
        document.addEventListener('change', async (e) => {
            if (e.target.type === 'radio' && quizStarted) {
                const questionId = e.target.dataset.questionId;
                const selectedOptionId = e.target.value;
                const questionName = e.target.name;

                // Store locally
                userAnswers[questionName] = selectedOptionId;

                // Update progress
                updateProgress();

                // Visual feedback for selected option
                const labels = e.target.closest('.options').querySelectorAll('label');
                labels.forEach(label => label.classList.remove('selected'));
                e.target.closest('label').classList.add('selected');

                // Debounced save
                const key = String(questionId);
                if (pendingSaves.has(key)) clearTimeout(pendingSaves.get(key));
                const t = setTimeout(async () => {
                    try {
                        await apiCall(`/quiz/attempts/${attemptId}/answer`, 'POST', {
                            questionId: parseInt(questionId),
                            selectedOptionId: parseInt(selectedOptionId)
                        });
                        if (!navigator.onLine) { // persist local buffer while offline
                            offlineAttempt.answers[String(parseInt(questionId))] = parseInt(selectedOptionId);
                            persistOfflineAttempt();
                        }
                    } catch (error) {
                        console.error('Failed to save answer:', error);
                    }
                }, 350);
                pendingSaves.set(key, t);

                updateNavigationButtonStyles();
            }
        });

        // Mark for Review toggle (event delegation)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.mark-review-btn');
            if (!btn || !quizStarted) return;
            const qId = parseInt(btn.dataset.questionId, 10);
            if (markedForReview.has(qId)) {
                markedForReview.delete(qId);
            } else {
                markedForReview.add(qId);
            }
            // Update button label & styles
            updateReviewButtonState(qId, btn);
            updateNavigationButtonStyles();
        });
    }

    // Update the Mark for Review button text/state for a given question
    function updateReviewButtonState(questionId, buttonEl) {
        const isMarked = markedForReview.has(questionId);
        const btn = buttonEl || document.querySelector(`.mark-review-btn[data-question-id="${questionId}"]`);
        if (btn) {
            btn.textContent = isMarked ? 'Unmark Review' : 'Mark for Review';
            btn.classList.toggle('marked', isMarked);
        }
    }

    // Update progress bar
    function updateProgress() {
        const progress = (Object.keys(userAnswers).length / totalQuestions) * 100;
        progressFill.style.width = `${progress}%`;
    }

    // Show specific question
    function showQuestion(index) {
        const allQuestions = document.querySelectorAll(".question");

        if (allQuestions.length === 0) {
            // No questions available
            const loadingDiv = document.getElementById('loading');
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
            const quizForm = document.getElementById('quizForm');
            quizForm.innerHTML = '<p style="padding:20px;">No questions available for this quiz. Please ensure the database is initialized.</p>';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            submitBtn.disabled = true;
            return;
        }

        // Hide all questions
        allQuestions.forEach(q => q.style.display = 'none');

        // Show selected question
        if (allQuestions[index]) {
            allQuestions[index].style.display = 'block';
            currentQuestionIndex = index;

            // Restore selected answer if exists
            const questionElement = allQuestions[index];
            const radioInputs = questionElement.querySelectorAll('input[type="radio"]');
            radioInputs.forEach(input => {
                if (userAnswers[input.name] === input.value) {
                    input.checked = true;
                    input.closest('label').classList.add('selected');
                }
            });
            // Sync review button state
            const qId = quizData.questions[index]?.id;
            updateReviewButtonState(qId);
        }

        // Update navigation buttons
        prevBtn.disabled = (index === 0);
        nextBtn.disabled = (index === totalQuestions - 1);

        // Update navigation button styles
        updateNavigationButtonStyles();
    }

    // Update navigation button styles
    function updateNavigationButtonStyles() {
        const navButtons = document.querySelectorAll('.qnav-btn');
        navButtons.forEach((btn, index) => {
            const questionId = quizData.questions[index]?.id;
            const questionName = `q${questionId}`;

            btn.classList.remove('answered', 'current', 'review');

            if (userAnswers[questionName]) {
                btn.classList.add('answered');
            }

            if (index === currentQuestionIndex) {
                btn.classList.add('current');
            }

            if (markedForReview.has(questionId)) {
                btn.classList.add('review');
            }
        });
    }

    // Submit quiz
    async function submitQuiz(timeExpired = false) {
        try {
            if (quizCompleted) return; // guard against duplicates
            quizStarted = false;
            quizCompleted = true;
            if (timeExpired && !autoSubmitReason) autoSubmitReason = 'time-expired';
            if (networkMonitorInterval) { // stop monitoring
                clearInterval(networkMonitorInterval);
                networkMonitorInterval = null;
            }
            if (autoSubmitCountdownTimer) {
                clearInterval(autoSubmitCountdownTimer);
                autoSubmitCountdownTimer = null;
            }
            if (autoSubmitVisibilityHandler) {
                document.removeEventListener('visibilitychange', autoSubmitVisibilityHandler);
                autoSubmitVisibilityHandler = null;
            }
            if (autoSubmitOfflineHandler) {
                window.removeEventListener('offline', autoSubmitOfflineHandler);
                autoSubmitOfflineHandler = null;
            }
            const warningOverlay = document.getElementById('auto-submit-warning');
            if (warningOverlay) warningOverlay.remove();
            const result = await apiCall(`/quiz/attempts/${attemptId}/complete`, 'POST');
            if (!navigator.onLine) {
                offlineAttempt.completed = true;
                offlineAttempt.result = result;
                persistOfflineAttempt();
            } else {
                // If back online, try to flush any pending offline data
                flushOfflineToFirestore();
            }

            // Adapt result shape for UI
            const adapted = {
                score: (typeof result.score === 'number') ? result.score : Math.round(((result.correctAnswers ?? 0) * 100) / (result.totalQuestions || totalQuestions || 1)),
                correct_answers: result.correctAnswers ?? result.correct_answers ?? 0,
                total_questions: result.totalQuestions ?? result.total_questions ?? totalQuestions
            };

            showResults(adapted, timeExpired, autoSubmitReason);

        } catch (error) {
            console.error('Failed to submit quiz:', error);
            alert('Failed to submit quiz. Please try again.');
        }
    }

    // Show quiz results
    function showResults(results, timeExpired = false, submitReason = null) {
    const { score, correct_answers, total_questions } = results;
    const subjectScores = calculateSubjectScores();
    // Always use full quiz length from loaded data as authoritative total
    const totalQuizQuestions = (quizData && quizData.questions ? quizData.questions.length : total_questions);

        // Compute answered / unanswered / incorrect counts for analytics
        const answeredIds = Object.keys(userAnswers);
        let correctCount = 0;
        answeredIds.forEach(qName => {
            const qId = parseInt(qName.replace('q',''),10);
            const q = quizData.questions.find(x=>x.id===qId);
            if (q){
                const sel = q.options.find(o=>o.id==userAnswers[qName]);
                if (sel && sel.is_correct) correctCount++; }
        });
    const incorrectCount = answeredIds.length - correctCount;
    const unansweredCount = totalQuizQuestions - answeredIds.length;
    const accuracyPct = answeredIds.length? Math.round((correctCount/answeredIds.length)*100):0;
    const overallScorePct = totalQuizQuestions? Math.round((correctCount/totalQuizQuestions)*100):0;

        // Build subject progress stats (accuracy + completion)
        const subjectProgress = quizData.subjects.map(sub=>{
            const subQs = quizData.questions.filter(q=>q.subject_id===sub.id);
            const total = subQs.length;
            let subAnswered=0, subCorrect=0;
            subQs.forEach(q=>{
                const ans = userAnswers[`q${q.id}`];
                if(ans){
                    subAnswered++;
                    const opt = q.options.find(o=>o.id==ans);
                    if(opt && opt.is_correct) subCorrect++;
                }
            });
            return {
                id: sub.id,
                name: sub.name,
                color: sub.color,
                answered: subAnswered,
                correct: subCorrect,
                total,
                accuracy: subAnswered? Math.round((subCorrect/subAnswered)*100):0,
                completion: Math.round((subAnswered/total)*100)
            };
        });

             const autoMsg = submitReason === 'online-detected' ? `<div style="margin:12px 0 18px;padding:12px 16px;border:1px solid #ffcc00;background:#2b2400;color:#ffdd55;border-radius:6px;font-weight:600;">Submission finalized due to Internet reconnection detection.</div>` : '';
             const timeMsg = submitReason === 'time-expired' ? `<div style=\"margin:12px 0 18px;padding:12px 16px;border:1px solid #ff6b6b;background:#2b0000;color:#ff9b9b;border-radius:6px;font-weight:600;\">Time expired – quiz auto-submitted.</div>` : '';
             resultDiv.innerHTML = `
          <div class="quiz-analytics-wrapper">
             <h2 class="qa-heading">Quiz Results</h2>
                 ${autoMsg}${timeMsg}
             <div class="qa-top-grid">
                 <div class="qa-card qa-score">
                     <p><strong>Your Score:</strong> ${correctCount}/${totalQuizQuestions} (${overallScorePct}%)</p>
                     <p><strong>Questions Answered:</strong> ${answeredIds.length}/${totalQuizQuestions}</p>
                     <p><strong>Accuracy (Answered Correct):</strong> ${accuracyPct}%</p>
                 </div>
                 <div class="qa-card qa-chart">
                     <h3>Your Progress</h3>
                     <div class="donut-wrapper">
                        <canvas id="progressDonut" width="220" height="220"></canvas>
                        <div class="donut-center" id="donutCenterPct">${overallScorePct}%</div>
                     </div>
                     <div class="qa-legend">
                         <span><span class="dot dot-correct"></span> Correct (${correctCount})</span>
                         <span><span class="dot dot-incorrect"></span> Incorrect (${incorrectCount})</span>
                         <span><span class="dot dot-unanswered"></span> Unanswered (${unansweredCount})</span>
                     </div>
                 </div>
             </div>
             <div class="qa-subject-section">
                 <h3 class="sub-heading">Subject-wise Performance</h3>
                 <div class="subject-grid">
                 ${subjectProgress.map(sp=>`
                    <div class="subject-card">
                      <div class="subject-card-header"><span class="subject-title">${sp.name}</span><span class="subject-total">${sp.correct}/${sp.total}</span></div>
                      <div class="subject-metrics"><span>Accuracy: ${sp.accuracy}%</span><span>Completion: ${sp.completion}%</span></div>
                      <div class="subject-bar accuracy"><div class="fill" style="width:${sp.accuracy}%"></div></div>
                      <div class="subject-bar completion"><div class="fill" style="width:${sp.completion}%"></div></div>
                    </div>`).join('')}
                 </div>
             </div>
             <div class="author-section qa-author">
                <h3>Show Answers (Author Only)</h3>
                <input type="password" id="author-password" placeholder="Enter author password">
                <button id="toggle-answers-btn">Show Answers</button>
                <div id="author-feedback" class="qa-author-feedback" style="display:none;">Incorrect author password!</div>
             </div>
             ${timeExpired ? '<p class="warning" style="text-align:center;">⚠️ Time Expired!</p>' : ''}
          </div>`;

        resultDiv.style.display = 'block';

        // Draw donut chart (simple custom canvas to avoid external libs)
    drawProgressDonut(correctCount, incorrectCount, unansweredCount, overallScorePct);

        setupAnswerToggle();

        // Disable all inputs but keep navigation enabled
        document.querySelectorAll("input[type=radio]").forEach(input => {
            input.disabled = true;
        });

        // Enable navigation for review
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        submitBtn.style.display = 'none';

        // After results are shown, highlight the user's wrong selections in red
        try { markIncorrectSelections(); } catch(_) {}
        // And update right-side navigation to show incorrect questions in red
        try { markIncorrectNavButtons(); } catch(_) {}


    // Mark user's wrong selections by applying a CSS class to the selected label
    function markIncorrectSelections(){
        if(!quizData || !quizData.questions) return;
        quizData.questions.forEach(q=>{
            const selId = userAnswers[`q${q.id}`];
            if(!selId) return;
            const sel = (q.options||[]).find(o=>String(o.id)===String(selId));
            if(sel && sel.is_correct===false){
                const el = document.querySelector(`input[name="q${q.id}"][value="${selId}"]`);
                const label = el && el.closest('label');
                if(label) label.classList.add('wrong-answer');
            }
        });
    }

    // Mark incorrect questions in the right navigation (red boxes)
    function markIncorrectNavButtons(){
        if(!quizData || !quizData.questions) return;
        const navButtons = document.querySelectorAll('.qnav-btn');
        navButtons.forEach((btn, index)=>{
            const q = quizData.questions[index];
            if(!q) return;
            const selId = userAnswers[`q${q.id}`];
            if(!selId) return;
            const sel = (q.options||[]).find(o=>String(o.id)===String(selId));
            if(sel && sel.is_correct===false){
                btn.classList.add('incorrect');
                btn.classList.remove('answered');
            }
        });
    }
        // After submission, visually mark any wrong selections in red
        markIncorrectSelections();
    }

    // Visually mark user's wrong selections in the question list (red)
    function markIncorrectSelections() {
        if (!quizData || !quizData.questions) return;
        quizData.questions.forEach(q => {
            const selectedId = userAnswers[`q${q.id}`];
            if (!selectedId) return; // unanswered -> skip
            const selectedOpt = q.options.find(o => String(o.id) === String(selectedId));
            if (selectedOpt && !selectedOpt.is_correct) {
                const inputEl = document.querySelector(`input[name="q${q.id}"][value="${selectedId}"]`);
                if (inputEl) {
                    const label = inputEl.closest('label');
                    if (label) label.classList.add('wrong-answer');
                }
            }
        });
    }

    function drawProgressDonut(correct, incorrect, unanswered, pct){
        const canvas = document.getElementById('progressDonut');
        if(!canvas) return; const ctx = canvas.getContext('2d');
        const total = correct + incorrect + unanswered || 1;
        const segments = [
            { value: correct, color:'#2e7d32'},
            { value: incorrect, color:'#c62828'},
            { value: unanswered, color:'#9e9e9e'}
        ];
        let startAngle = -Math.PI/2;
        const cx = canvas.width/2, cy = canvas.height/2, r = Math.min(cx,cy)-5;
        segments.forEach(seg=>{
            const angle = (seg.value/total)*Math.PI*2;
            ctx.beginPath();
            ctx.moveTo(cx,cy);
            ctx.fillStyle = seg.color;
            ctx.arc(cx,cy,r,startAngle,startAngle+angle);
            ctx.fill();
            startAngle += angle;
        });
        // Inner cutout for donut
        ctx.globalCompositeOperation='destination-out';
        ctx.beginPath();
        ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.fill();
        ctx.globalCompositeOperation='source-over';
        // Center text updated separately (fallback if JS executes before overlay)
        const centerDiv = document.getElementById('donutCenterPct');
        if(centerDiv && typeof pct === 'number') centerDiv.textContent = pct + '%';
    }

    // Calculate subject-wise scores
    function calculateSubjectScores() {
        const subjectScores = [];

        quizData.subjects.forEach(subject => {
            const subjectQuestions = quizData.questions.filter(q => q.subject_id === subject.id);
            let correctCount = 0;

            subjectQuestions.forEach(question => {
                const questionName = `q${question.id}`;
                if (userAnswers[questionName]) {
                    const selectedOption = question.options.find(opt => opt.id == userAnswers[questionName]);
                    if (selectedOption && selectedOption.is_correct) {
                        correctCount++;
                    }
                }
            });

            subjectScores.push({
                name: subject.name,
                color: subject.color,
                score: correctCount,
                total: subjectQuestions.length
            });
        });

        return subjectScores;
    }

    // Set up answer toggle functionality
    function setupAnswerToggle() {
        const toggleBtn = document.getElementById("toggle-answers-btn");

        toggleBtn.addEventListener("click", async function () {
            const passwordInput = document.getElementById("author-password");
            const feedback = document.getElementById("author-feedback");

            feedback.style.display = "none";

            if (passwordInput.value !== authorPassword) {
                feedback.textContent = "Incorrect author password!";
                feedback.style.display = "block";
                return;
            }

            showAnswersEnabled = !showAnswersEnabled;
            toggleBtn.textContent = showAnswersEnabled ? "Hide Answers" : "Show Answers";

            if (showAnswersEnabled) {
                // Build answers from loaded quizData and userAnswers
                const answers = quizData.questions.map(q => {
                    const selectedId = userAnswers[`q${q.id}`];
                    const correctOpt = q.options.find(o => o.is_correct);
                    const selectedOpt = q.options.find(o => String(o.id) === String(selectedId));
                    return {
                        correct_option: correctOpt?.option_text || '',
                        selected_option: selectedOpt?.option_text || (selectedId ? 'Unknown option' : null),
                        is_correct: !!(selectedOpt && selectedOpt.is_correct)
                    };
                });
                showCorrectAnswers(answers);
            } else {
                hideCorrectAnswers();
            }
        });
    }

    // Show correct answers in questions
    function showCorrectAnswers(answerData) {
        answerData.forEach((answer, index) => {
            // Resolve the real question element by name instead of relying on index ordering
            const q = (quizData && quizData.questions) ? quizData.questions[index] : null;
            if (!q) return;
            const anyInput = document.querySelector(`input[name="q${q.id}"]`);
            const question = anyInput ? anyInput.closest('.question') : null;
            if (!question) return;

            // Highlight the correct option in green
            try {
                const correctOption = (q.options || []).find(o => o.is_correct);
                if (correctOption) {
                    const correctInput = question.querySelector(`input[name="q${q.id}"][value="${correctOption.id}"]`);
                    if (correctInput) {
                        const correctLabel = correctInput.closest('label');
                        if (correctLabel) correctLabel.classList.add('correct-answer');
                    }
                }
            } catch(_) {}

            // Ensure the textual explanation box exists/updates
            let answerDisplay = question.querySelector('.correct-answer-display');
            if (!answerDisplay) {
                answerDisplay = document.createElement('div');
                answerDisplay.className = 'correct-answer-display';
                question.appendChild(answerDisplay);
            }
            answerDisplay.innerHTML = `
                <strong>✅ Correct Answer:</strong> ${answer.correct_option}<br>
                <strong>📝 Your Answer:</strong> ${answer.selected_option || 'Not answered'}<br>
                <strong>📊 Result:</strong> ${answer.is_correct ? '<span style="color: #4CAF50;">✓ Correct</span>' : '<span style="color: #f44336;">✗ Incorrect</span>'}
            `;
        });
    }

    // Hide correct answers
    function hideCorrectAnswers() {
        document.querySelectorAll('.correct-answer-display').forEach(display => { display.remove(); });
        // Remove green highlight when answers are hidden
        document.querySelectorAll('.options label.correct-answer').forEach(label => { label.classList.remove('correct-answer'); });
    }

    // Initialize the quiz when page loads
    initializeQuiz();
});

// === Optional Runtime Customization Utilities ===
// These allow changing question number colors without touching other logic.
window.setQuestionNumberColors = function({
    normal, current, answered, review, currentBg
}={}) {
    const root = document.documentElement.style;
    if (normal) root.setProperty('--qnav-number-color', normal);
    if (current) root.setProperty('--qnav-number-current-color', current);
    if (answered) root.setProperty('--qnav-number-answered-color', answered);
    if (review) root.setProperty('--qnav-number-review-color', review);
    if (currentBg) root.setProperty('--qnav-current-bg', currentBg);
};
// Example usage (uncomment to test):
// setQuestionNumberColors({ normal:'#111', current:'#fff', answered:'#fff', review:'#fff', currentBg:'#ff9800'});
