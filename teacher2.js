(function(){
  // Simple, robust teacher dashboard script
  const state = {
    currentUser: null,
    role: null,
    attempts: [],
    sort: { field: 'startTime', dir: 'desc' }
  };

  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

  function setHeaderUser(email){ const el = $('#teacherEmail'); if(el) el.textContent = email || ''; }

  // Wait for Firebase and Auth to be ready
  async function waitForFirebase(){
    // Wait for firebaseApiCall as well, but do not fail if slightly delayed
    await new Promise(resolve => {
      let tries = 0;
      const t = setInterval(()=>{
        tries++;
        if (window.firebaseAuth && window.firebaseDb) { clearInterval(t); resolve(); }
        if (tries > 100) { clearInterval(t); resolve(); }
      }, 50);
    });
    // If api shim fires a ready event
    if (!window.firebaseApiCall) {
      await new Promise(r=>{
        const h=()=>{ window.removeEventListener('firebaseApiReady', h); r(); };
        window.addEventListener('firebaseApiReady', h, { once: true });
        setTimeout(r, 2000);
      });
    }
  }

  async function getUserRole(uid){
    try {
      const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const snap = await getDoc(doc(window.firebaseDb, 'users', String(uid)));
      if (snap.exists()) return snap.data().role || 'student';
    } catch (e){ console.warn('role lookup failed', e); }
    return 'student';
  }

  function protectTeacher(){
    const auth = window.firebaseAuth;
    const helpers = window.firebaseAuthHelpers;
    if (!auth || !helpers){
      console.error('Auth not ready');
      location.href = '/index.html';
      return;
    }
    helpers.onAuthStateChanged(async user => {
      if (!user){
        location.href = '/index.html';
        return;
      }
      state.currentUser = user;
      setHeaderUser(user.email || user.displayName || '');
      const role = await getUserRole(user.uid);
      state.role = role;
      if (role !== 'teacher') {
        location.href = '/index.html';
        return;
      }
      // Authorized: initialize UI
      initUI();
      loadAttempts();
      loadUsers();
      loadFormData();
    });
  }

  function onTabClicks(){
    const navBtns = $all('nav button[data-tab]');
    navBtns.forEach(btn=>btn.addEventListener('click',()=>{
      navBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $all('main section').forEach(s=>s.classList.remove('active'));
      const tab = btn.getAttribute('data-tab');
      $('#tab-'+tab).classList.add('active');
      if (tab==='attempts') loadAttempts();
      if (tab==='users') loadUsers();
      if (tab==='addq') loadFormData();
    }));
    const logoutBtn = $('#logoutBtn');
    if (logoutBtn){
      logoutBtn.addEventListener('click', async ()=>{
        try { await window.firebaseAuthHelpers.signOut(); } catch(_){}
        location.href = '/index.html';
      });
    }
  }

  async function api(path, method='GET', body=null){
    // Ensure api shim exists
    if (typeof window.firebaseApiCall !== 'function') throw new Error('API not ready');
    return await window.firebaseApiCall(path, method, body ? JSON.stringify(body) : null);
  }

  function renderAttempts(){
    const searchVal = ($('#searchStudent')?.value || '').toLowerCase();
    const quizFilter = ($('#filterQuiz')?.value || '').toLowerCase();
    const completion = $('#completionFilter')?.value || 'all';

    let rows = state.attempts.filter(a=>{
      const studentStr = ((a.email||'')+' '+(a.username||'')+' '+(a.userId||'')).toLowerCase();
      const quizStr = (a.quizTitle||'').toLowerCase();
      if (searchVal && !studentStr.includes(searchVal)) return false;
      if (quizFilter && !quizStr.includes(quizFilter)) return false;
      if (completion==='completed' && !a.completed) return false;
      if (completion==='inprogress' && a.completed) return false;
      return true;
    }).map(a=>({
      ...a,
      percent: (a.totalQuestions && a.correctAnswers!=null) ? Math.round((a.correctAnswers*100)/a.totalQuestions) : 0
    }));

    // Apply score filter (if selected)
    try {
      const scoreVal = ($('#scoreFilter')?.value || 'all');
      if (scoreVal !== 'all') {
        const th = parseInt(scoreVal, 10);
        if (!Number.isNaN(th)) rows = rows.filter(r => (r.percent || 0) >= th);
      }
    } catch(_) {}

    const dir = state.sort.dir==='asc'?1:-1;
    const f = state.sort.field;
    rows.sort((x,y)=>{
      if (x[f]==null && y[f]!=null) return 1;
      if (y[f]==null && x[f]!=null) return -1;
      if (x[f]==y[f]) return 0;
      return x[f]>y[f]?dir:-dir;
    });

    const tbody = $('#attemptTable tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(r=>`<tr>
      <td>${esc(r.email||r.username||('ID '+r.userId))}</td>
      <td>${esc(r.fullName||'-')}</td>
      <td>${esc(r.quizTitle||('Quiz '+r.quizId))}</td>
      <td>${r.correctAnswers ?? '-'} / ${r.totalQuestions ?? '-'}</td>
      <td>${r.percent ?? 0}%</td>
      <td>${r.attemptsForUser ?? '-'}</td>
      <td>${r.timeSpentSeconds ?? '-'}</td>
      <td class="nowrap">${fmt(r.startTime)}</td>
      <td class="nowrap">${fmt(r.endTime)}</td>
    </tr>`).join('');

    const avg = rows.length? Math.round(rows.reduce((s,r)=>s+(r.percent||0),0)/rows.length):0;
    $('#statAttempts').textContent = 'Attempts: '+rows.length;
    $('#statAvg').textContent = 'Avg %: '+avg;
  }

  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
  function fmt(d){ if(!d) return '-'; try { return new Date(d).toLocaleString(); } catch { return '-'; } }

  async function loadAttempts(){
    try {
      const data = await api('/teacher/attempts');
      state.attempts = Array.isArray(data)? data : [];
      renderAttempts();
    } catch(e){ console.error('loadAttempts failed', e); }
  }

  async function loadUsers(){
    try {
      const data = await api('/teacher/users');
      const tbody = $('#usersTable tbody');
      if (!tbody) return;
      tbody.innerHTML = (data||[]).map(u=>`<tr>
        <td>${esc(u.id)}</td>
        <td>${esc(u.username||'-')}</td>
        <td>${esc(u.fullName||'-')}</td>
        <td>${esc(u.email||'-')}</td>
        <td>${esc(u.role||'student')}</td>
        <td>${u.attemptsCount||0}</td>
        <td>${u.bestScore!=null?u.bestScore:'-'}</td>
        <td>${u.lastScore!=null?u.lastScore:'-'}</td>
        <td class="nowrap">${fmt(u.lastAttemptAt)}</td>
      </tr>`).join('');
    } catch(e){ console.error('loadUsers failed', e); }
  }

  async function loadFormData(){
    // Populate quizzes
    try {
      const quizzes = await api('/quizzes');
      const qSel = document.querySelector('select[name="quizId"]');
      if (qSel) {
        qSel.innerHTML = (quizzes||[]).map(q=>`<option value="${q.id}">${esc(q.title||('Quiz '+q.id))}</option>`).join('');
      }
    } catch(_){}
    // Populate subjects
    try {
      const subjects = await api('/quiz/subjects');
      const sSel = document.querySelector('select[name="subjectId"]');
      if (sSel) {
        sSel.innerHTML = (subjects||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
      }
    } catch(_){}
    // Correct options A-E
    const cSel = document.querySelector('select[name="correctIndex"]');
    if (cSel) {
      const letters = ['A','B','C','D','E'];
      cSel.innerHTML = letters.map((L,i)=>`<option value="${i}">Option ${L}</option>`).join('');
    }
  }

  function initAddQuestion(){
    const form = $('#addQuestionForm');
    if (!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const optsRaw = [fd.get('opt0'),fd.get('opt1'),fd.get('opt2'),fd.get('opt3'),fd.get('opt4')].filter(x=>x && x.trim());
      if (optsRaw.length < 2) {
        showMsg('#addQMsg','❌ Please provide at least two options (A and B)','error');
        return;
      }
      const payload = {
        quizId: parseInt(fd.get('quizId')||'1'),
        subjectId: parseInt(fd.get('subjectId')||'1'),
        orderNum: parseInt(fd.get('orderNum')||'0'),
        points: parseInt(fd.get('points')||'1'),
        questionText: String(fd.get('questionText')||'').trim(),
        correctIndex: parseInt(fd.get('correctIndex')||'0'),
        options: optsRaw
      };
      if (!payload.questionText) {
        showMsg('#addQMsg','❌ Question text is required','error');
        return;
      }
      if (payload.correctIndex >= optsRaw.length) {
        showMsg('#addQMsg','❌ Correct answer must be within provided options','error');
        return;
      }
      // Validate subject selection
      if (!Number.isFinite(payload.subjectId) || payload.subjectId < 1) {
        showMsg('#addQMsg','❌ Please select a valid subject for this question','error');
        return;
      }
      try {
        showMsg('#addQMsg','Saving...');
        await api('/teacher/questions','POST', payload);
        form.reset();
        await loadFormData();
        showMsg('#addQMsg','✅ Question saved successfully!','success');
      } catch(e){
        let msg = e?.message || 'Failed to save question';
        if (/already exists|duplicate/i.test(msg)) msg = `Question Number ${payload.orderNum} already exists.`;
        showMsg('#addQMsg','❌ '+msg,'error');
      }
    });
  }

  function initDeleteQuestion(){
    const form = $('#deleteQuestionForm');
    if (!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const id = new FormData(form).get('questionId');
      if (!id) { showMsg('#delQMsg','❌ Enter a question number','error'); return; }
      if (!confirm(`Delete Question #${id}? This cannot be undone.`)) return;
      try {
        showMsg('#delQMsg','Deleting...');
        await api(`/teacher/questions/${encodeURIComponent(id)}?byOrderNum=true`, 'DELETE');
        form.reset();
        showMsg('#delQMsg',`✅ Question #${id} deleted`,'success');
      } catch(e){ showMsg('#delQMsg','❌ '+(e?.message||'Delete failed'),'error'); }
    });
  }

  function showMsg(sel, text, kind){
    const el = $(sel); if (!el) return; el.textContent = text || '';
    el.className = 'mini'+(kind? ' '+kind: '');
  }

  function initSorting(){
    $all('#attemptTable thead th').forEach(th=>{
      th.addEventListener('click',()=>{
        const map = {student:'email', name:'fullName', quiz:'quizTitle', score:'correctAnswers', percent:'percent', attempts:'attemptsForUser', time:'timeSpentSeconds', start:'startTime', end:'endTime'};
        const key = map[th.dataset.sort];
        if (!key) return;
        if (state.sort.field===key){ state.sort.dir = state.sort.dir==='asc'?'desc':'asc'; } else { state.sort.field = key; state.sort.dir='desc'; }
        renderAttempts();
      });
    });
  }

  function initUI(){
    onTabClicks();
    initAddQuestion();
    initDeleteQuestion();
    initSorting();
    // Wire filter controls to re-render attempts when changed
    ['#searchStudent', '#filterQuiz', '#completionFilter', '#scoreFilter'].forEach(sel=>{
      const el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', renderAttempts);
      el.addEventListener('change', renderAttempts);
    });
    // Wire sort control
    const sortEl = document.querySelector('#sortBy');
    if (sortEl) {
      sortEl.addEventListener('change', ()=>{
        const v = sortEl.value || 'default';
        if (v === 'score-desc') state.sort.field = 'percent', state.sort.dir = 'desc';
        else if (v === 'score-asc') state.sort.field = 'percent', state.sort.dir = 'asc';
        else state.sort.field = 'start', state.sort.dir = 'desc';
        renderAttempts();
      });
    }
  }

  // Boot
  (async function start(){
    await waitForFirebase();
    protectTeacher();
  })();
})();
