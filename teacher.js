// Teacher dashboard script
(function(){
  // Backend base selection mirrors student app behavior
  const HOST = (location.hostname && location.hostname !== '') ? location.hostname : '127.0.0.1';
  const IS_LOCAL = (HOST === 'localhost' || HOST === '127.0.0.1');
  // If window.QUIZ_BACKEND_BASE is set (via backend-origin.js), use it; otherwise:
  // - local dev: http://<host>:8081/api
  // - production: '/api' (only valid if Firebase rewrites are configured)
  const API_BASE = (window.QUIZ_BACKEND_BASE)
    ? `${window.QUIZ_BACKEND_BASE}/api`
    : (IS_LOCAL ? `http://${HOST}:8081/api` : '/api');

  // Retrieve teacher context from sessionStorage (set in script.js after identification)
  const teacherCtx = JSON.parse(sessionStorage.getItem('teacherCtx')||'{}');
  if(!teacherCtx.userId || teacherCtx.role !== 'teacher') {
    alert('Unauthorized: teacher session not found');
    location.href = 'index.html';
    return;
  }
  document.getElementById('teacherEmail').textContent = teacherCtx.email || teacherCtx.username || ('ID '+teacherCtx.userId);

  // Tab switching
  const navButtons = document.querySelectorAll('nav button[data-tab]');
  navButtons.forEach(btn=>btn.addEventListener('click',()=>{
    navButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('main section').forEach(s=>s.classList.remove('active'));
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='attempts') loadAttempts();
    if(btn.dataset.tab==='addq') loadQuizAndSubjects(); // Load quizzes and subjects when tab switched
    if(btn.dataset.tab==='users') loadUsers();
  }));

  document.getElementById('logoutBtn').addEventListener('click',()=>{
    sessionStorage.removeItem('teacherCtx');
    location.href='index.html';
  });

  async function api(endpoint, options={}) {
    // Route to Firebase shim if in Firebase-only mode
    if (window.FIREBASE_MODE && typeof window.firebaseApiCall === 'function') {
      const method = (options && options.method) || 'GET';
      const body = (options && options.body) || null;
      return await window.firebaseApiCall(endpoint + (endpoint.includes('?')?'&':'?') + 'userId='+encodeURIComponent(teacherCtx.userId), method, body);
    }
    const url = API_BASE+endpoint + (endpoint.includes('?')?'&':'?') + 'userId='+encodeURIComponent(teacherCtx.userId);
    const opt = Object.assign({headers:{'Content-Type':'application/json'}}, options);
    const res = await fetch(url,opt);
    
    if(!res.ok) {
      const responseText = await res.text();
      let errorMessage = `${res.status}`;
      
      // Try to parse JSON error response
      try {
        if (responseText && responseText.includes('{')) {
          const errorJson = JSON.parse(responseText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          } else if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } else if (responseText) {
          errorMessage += ': ' + responseText;
        }
      } catch (e) {
        // If parsing fails, use the raw text
        errorMessage += ': ' + responseText;
      }
      
      throw new Error(errorMessage);
    }
    
    if(res.status===204) return null;
    const ct = res.headers.get('content-type')||'';
    return ct.includes('json')?res.json():res.text();
  }

  // Attempts table logic
  let attemptsCache = [];
  let currentSort = {field:'start', dir:'desc'};

  async function loadAttempts() {
    try {
      const data = await api('/teacher/attempts');
      attemptsCache = data || [];
      renderAttempts();
    } catch(e){
      console.error('Failed to load attempts', e);
    }
  }

  function renderAttempts(){
    const searchVal = document.getElementById('searchStudent').value.toLowerCase();
    const quizFilter = document.getElementById('filterQuiz').value.toLowerCase();
    const completion = document.getElementById('completionFilter').value;
    let rows = attemptsCache.filter(a=>{
      const studentStr = (a.email||'')+' '+(a.username||'')+' '+(a.userId||'');
      const quizStr = (a.quizTitle||'');
      if(searchVal && !studentStr.toLowerCase().includes(searchVal)) return false;
      if(quizFilter && !quizStr.toLowerCase().includes(quizFilter)) return false;
      if(completion==='completed' && !a.completed) return false;
      if(completion==='inprogress' && a.completed) return false;
      return true;
    });
    // compute percent
    rows.forEach(r=>{r.percent = (r.totalQuestions && r.correctAnswers!=null)? Math.round((r.correctAnswers*100)/r.totalQuestions):0;});
  // attempts count per user (for sorting) – reuse map built later, so build early
  const attemptsPerKey = rows.reduce((m,r)=>{const k=r.userId||r.email||r.username; if(k){m[k]=(m[k]||0)+1;} return m;},{});
  rows.forEach(r=>{ const k=r.userId||r.email||r.username; r._attemptsSort = attemptsPerKey[k]||1; });
  // sort
    rows.sort((a,b)=>{
      const f=currentSort.field, dir=currentSort.dir==='asc'?1:-1;
      if(a[f]==null && b[f]!=null) return 1;
      if(b[f]==null && a[f]!=null) return -1;
      if(a[f]==b[f]) return 0;
      return a[f]>b[f]?dir:-dir;
    });
    const attemptCountMap = rows.reduce((m,r)=>{const k=r.userId||r.email||r.username; if(k){m[k]=(m[k]||0)+1;} return m;},{});
    const tbody = document.querySelector('#attemptTable tbody');
    tbody.innerHTML = rows.map(r=>{
      const key = r.userId||r.email||r.username;
      const attemptsForUser = attemptCountMap[key] || 1;
      return `<tr>
        <td>${escapeHtml(r.email||r.username||('ID '+r.userId))}</td>
        <td>${escapeHtml(r.fullName||'-')}</td>
        <td>${escapeHtml(r.quizTitle||'Quiz '+r.quizId)}</td>
        <td>${r.correctAnswers ?? '-'} / ${r.totalQuestions ?? '-'}</td>
        <td>${r.percent ?? 0}%</td>
        <td>${attemptsForUser}</td>
        <td>${r.timeSpentSeconds ?? '-'}</td>
        <td class="nowrap">${fmtDate(r.startTime)}</td>
        <td class="nowrap">${fmtDate(r.endTime)}</td>
      </tr>`;
    }).join('');
    // stats
    const avg = rows.length? Math.round(rows.reduce((s,r)=>s+(r.percent||0),0)/rows.length):0;
    document.getElementById('statAttempts').textContent = 'Attempts: '+rows.length;
    document.getElementById('statAvg').textContent = 'Avg %: '+avg;
  }

  function escapeHtml(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
  function fmtDate(d){ if(!d) return '-'; return new Date(d).toLocaleString(); }

  ['searchStudent','filterQuiz','completionFilter'].forEach(id=>{
    document.getElementById(id).addEventListener('input',renderAttempts);
    document.getElementById(id).addEventListener('change',renderAttempts);
  });

  document.querySelectorAll('#attemptTable th').forEach(th=>{
    th.addEventListener('click',()=>{
      const fieldMap={student:'email',name:'fullName',quiz:'quizTitle',score:'correctAnswers',percent:'percent',attempts:'_attemptsSort',time:'timeSpentSeconds',start:'startTime',end:'endTime'};
      const f = fieldMap[th.dataset.sort];
      if(currentSort.field===f) currentSort.dir = currentSort.dir==='asc'?'desc':'asc'; else {currentSort.field=f; currentSort.dir='desc';}
      renderAttempts();
    });
  });

  // Add question
  document.getElementById('addQuestionForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    
    // Get all options (A-E) that have content
    const opts = [
      fd.get('opt0'),  // Option A
      fd.get('opt1'),  // Option B
      fd.get('opt2'),  // Option C
      fd.get('opt3'),  // Option D
      fd.get('opt4')   // Option E (if exists)
    ].filter(o => o && o.trim());
    
    // Make sure we have at least 2 options
    if (opts.length < 2) {
      const msg = document.getElementById('addQMsg');
      msg.textContent = '❌ Please provide at least two answer options (A and B)';
      msg.className = 'mini error';
      return;
    }
    
    const payload = {
      quizId: parseInt(fd.get('quizId') || '1'),
      subjectId: parseInt(fd.get('subjectId') || '1'),
      orderNum: parseInt(fd.get('orderNum') || '0'),
      points: parseInt(fd.get('points') || '1'),
      questionText: fd.get('questionText'),
      correctIndex: parseInt(fd.get('correctIndex') || '0'),
      options: opts
    };
    
    // Validate correct answer is within range of provided options
    if (payload.correctIndex >= opts.length) {
      const msg = document.getElementById('addQMsg');
      msg.textContent = '❌ Correct answer must be one of the provided options';
      msg.className = 'mini error';
      return;
    }
    
    const msg = document.getElementById('addQMsg');
    msg.textContent = 'Saving...';
    msg.className = 'mini';
    
    try{ 
      await api('/teacher/questions', {method: 'POST', body: JSON.stringify(payload)}); 
      msg.textContent = '✅ Question saved successfully!'; 
      msg.className = 'mini success';
      e.target.reset(); 
      
      // Reload dropdowns after form reset
      loadQuizAndSubjects();
    }
    catch(err){
      // Format the error message based on the error type
      let errorMsg = err.message;
      
      // Handle specific error cases
      if (errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
        errorMsg = `Question Number ${payload.orderNum} already exists. Please use a different number.`;
      }
      
      msg.textContent = '❌ ' + errorMsg;
      msg.className = 'mini error';
    }
  });

  // Delete question
  document.getElementById('deleteQuestionForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const id = new FormData(e.target).get('questionId');
    const msg = document.getElementById('delQMsg');
    
    if(!id){
      msg.textContent='Please enter a question number';
      msg.className = 'mini error';
      return;
    }
    
    // Confirmation to prevent accidental deletion
    if(!confirm(`Are you sure you want to delete Question #${id}? This action cannot be undone.`)){
      return;
    }
    
    msg.textContent='Deleting...';
    msg.className = 'mini';
    
    try{ 
      // Use byOrderNum=true to delete by question number instead of ID
      const res = await api('/teacher/questions/'+encodeURIComponent(id)+'?byOrderNum=true', {method:'DELETE'}); 
      msg.textContent='✅ Question #' + id + ' deleted successfully'; 
      msg.className = 'mini success';
      e.target.reset();
    }
    catch(err){ 
      msg.textContent='❌ '+err.message;
      msg.className = 'mini error';
    }
  });

  // Load quiz and subject data for form dropdowns
  async function loadQuizAndSubjects() {
    try {
      // Load subjects for dropdown
      const subjects = await api('/quiz/subjects');
      if (subjects && Array.isArray(subjects)) {
        const subjectDropdown = document.querySelector('select[name="subjectId"]');
        if (subjectDropdown) {
          subjectDropdown.innerHTML = subjects.map(s => 
            `<option value="${s.id}">${s.name}</option>`
          ).join('');
        }
      }
      
      // Load quizzes for dropdown
      const quizzes = await api('/quizzes');
      if (quizzes && Array.isArray(quizzes)) {
        const quizDropdown = document.querySelector('select[name="quizId"]');
        if (quizDropdown) {
          quizDropdown.innerHTML = quizzes.map(q => 
            `<option value="${q.id}">${q.title || 'Quiz ' + q.id}</option>`
          ).join('');
        }
      }
      
      // Set up correct answer dropdown
      const correctDropdown = document.querySelector('select[name="correctIndex"]');
      if (correctDropdown && !correctDropdown.options.length) {
        // Standard options A-E for correct answer
        const options = ['A', 'B', 'C', 'D', 'E'];
        correctDropdown.innerHTML = options.map((letter, index) => 
          `<option value="${index}">${letter}</option>`
        ).join('');
      }
    } catch (error) {
      console.error('Failed to load quiz/subject data', error);
    }
  }

  // Initial load
  loadAttempts();
  // Also load quiz and subject data initially 
  loadQuizAndSubjects();
  // Preload users in background
  loadUsers();

  async function loadUsers(){
    try {
      const list = await api('/teacher/users');
      const tbody = document.querySelector('#usersTable tbody');
      if (!tbody) return;
      tbody.innerHTML = (list||[]).map(u=>`<tr>
        <td>${escapeHtml(String(u.id))}</td>
        <td>${escapeHtml(u.username||'-')}</td>
        <td>${escapeHtml(u.fullName||'-')}</td>
        <td>${escapeHtml(u.email||'-')}</td>
        <td>${escapeHtml(u.role||'student')}</td>
        <td>${u.attemptsCount||0}</td>
        <td>${u.bestScore!=null?u.bestScore: '-'}</td>
        <td>${u.lastScore!=null?u.lastScore: '-'}</td>
        <td class="nowrap">${fmtDate(u.lastAttemptAt)}</td>
      </tr>`).join('');
    } catch(e){
      console.error('Failed to load users', e);
    }
  }
})();
