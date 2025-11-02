// Firebase API shim to replace REST backend using Firestore
// Loads as an ES module and exposes window.firebaseApiCall for non-module scripts

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Use db created in firebase-init.js if present, else create from app
const db = window.firebaseDb || getFirestore(window.firebaseApp);
const auth = window.firebaseAuth;

// Minimal fallback dataset so the quiz works even if Firestore is empty
// Note: read-only in-memory; does not write to Firestore. Intended as a fast safety net.
const DEFAULT_QUIZ = {
  quizId: 1,
  subjects: [
    { id: 1, name: 'DBMS', color: '#000000' },
    { id: 2, name: 'FEDF', color: '#FF6B6B' },
    { id: 3, name: 'OOP', color: '#4ECDC4' },
    { id: 4, name: 'OS',  color: '#45B7D1' }
  ],
  questions: [
    {
      id: 1, subjectId: 1, orderNum: 1,
      questionText: 'Which SQL command is used to remove a table and its data permanently?',
      options: [
        { id: 0, optionText: 'DELETE TABLE', isCorrect: false },
        { id: 1, optionText: 'DROP TABLE',   isCorrect: true  },
        { id: 2, optionText: 'TRUNCATE ROW', isCorrect: false },
        { id: 3, optionText: 'REMOVE TABLE', isCorrect: false }
      ]
    },
    {
      id: 2, subjectId: 2, orderNum: 2,
      questionText: 'Which HTML tag is semantic and represents independent content?',
      options: [
        { id: 0, optionText: '<div>',   isCorrect: false },
        { id: 1, optionText: '<section>', isCorrect: true  },
        { id: 2, optionText: '<span>',  isCorrect: false },
        { id: 3, optionText: '<b>',     isCorrect: false }
      ]
    },
    {
      id: 3, subjectId: 3, orderNum: 3,
      questionText: 'Which OOP concept allows using the same function name with different implementations?',
      options: [
        { id: 0, optionText: 'Encapsulation', isCorrect: false },
        { id: 1, optionText: 'Inheritance',   isCorrect: false },
        { id: 2, optionText: 'Polymorphism',  isCorrect: true  },
        { id: 3, optionText: 'Abstraction',   isCorrect: false }
      ]
    },
    {
      id: 4, subjectId: 4, orderNum: 4,
      questionText: 'Which scheduling algorithm picks the process with the shortest next CPU burst?',
      options: [
        { id: 0, optionText: 'FCFS',  isCorrect: false },
        { id: 1, optionText: 'SJF',   isCorrect: true  },
        { id: 2, optionText: 'RR',    isCorrect: false },
        { id: 3, optionText: 'EDF',   isCorrect: false }
      ]
    },
    {
      id: 5, subjectId: 1, orderNum: 5,
      questionText: 'Which normal form removes partial dependency on a candidate key?',
      options: [
        { id: 0, optionText: '1NF', isCorrect: false },
        { id: 1, optionText: '2NF', isCorrect: true  },
        { id: 2, optionText: '3NF', isCorrect: false },
        { id: 3, optionText: 'BCNF', isCorrect: false }
      ]
    }
  ]
};

function requireAuth() {
  if (!auth || !auth.currentUser) {
    throw new Error('Not authenticated');
  }
  return auth.currentUser;
}

// Helper: safe JSON parse
function safeJson(body) {
  if (!body) return null;
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return null; }
  }
  return body;
}

// Helper: default subjects if none exist
async function getSubjects() {
  const colRef = collection(db, 'subjects');
  const snap = await getDocs(colRef);
  const items = snap.docs.map(d => ({ id: parseInt(d.id,10)||d.id, ...d.data() }));
  if (items.length) return items;
  // Default seed (not persisted automatically)
  return [
    { id: 1, name: 'DBMS', color: '#000000' },
    { id: 2, name: 'FEDF', color: '#FF6B6B' },
    { id: 3, name: 'OOP', color: '#4ECDC4' },
    { id: 4, name: 'OS',  color: '#45B7D1' }
  ];
}

// Helper: ensure quiz doc exists minimally
async function ensureQuiz(quizId) {
  const d = doc(db, 'quizzes', String(quizId));
  const s = await getDoc(d);
  if (!s.exists()) {
    await setDoc(d, { title: `Quiz ${quizId}`, createdAt: serverTimestamp() });
  }
  return d;
}

// Fetch questions for a quiz
async function getQuizQuestions(quizId) {
  await ensureQuiz(quizId);
  const qRef = collection(db, 'quizzes', String(quizId), 'questions');
  const qSnap = await getDocs(query(qRef, orderBy('orderNum')));
  const items = qSnap.docs.map(d => ({ id: parseInt(d.id,10)||d.id, ...d.data() }));
  if (items.length === 0 && quizId === DEFAULT_QUIZ.quizId) {
    // Fallback to built-in questions (read-only)
    return DEFAULT_QUIZ.questions.map(q => ({
      id: q.id,
      subjectId: q.subjectId,
      orderNum: q.orderNum,
      questionText: q.questionText
    }));
  }
  return items;
}

// Fetch options for a question
async function getQuestionOptions(quizId, questionId) {
  const oRef = collection(db, 'quizzes', String(quizId), 'questions', String(questionId), 'options');
  const oSnap = await getDocs(query(oRef, orderBy('index')));
  const items = oSnap.docs.map(d => ({ id: parseInt(d.id,10)||d.id, ...d.data() }));
  if (items.length === 0 && quizId === DEFAULT_QUIZ.quizId) {
    const q = DEFAULT_QUIZ.questions.find(x => String(x.id) === String(questionId));
    if (q) {
      return q.options.map((o, idx) => ({ id: o.id ?? idx, optionText: o.optionText, is_correct: !!o.isCorrect, index: idx }));
    }
  }
  return items;
}

// Create or update user
async function identifyUser(payload) {
  const body = safeJson(payload);
  if (!body) return { error: 'Invalid user payload' };
  const user = requireAuth();
  const uid = user.uid;
  await setDoc(doc(db, 'users', String(uid)), {
    username: body.username || null,
    email: body.email || user.email || null,
    fullName: body.fullName || null,
    role: body.role || 'student',
    externalId: body.externalId || null,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { id: uid };
}

// Start attempt
async function startAttempt(quizId) {
  const user = requireAuth();
  const ref = await addDoc(collection(db, 'attempts'), {
    quizId: (typeof quizId === 'number' ? quizId : parseInt(quizId,10) || quizId),
    userId: user.uid,
    startTime: serverTimestamp(),
    completed: false
  });
  return { id: ref.id };
}

// Save answer
async function saveAnswer(attemptId, body) {
  const data = safeJson(body) || {};
  const qid = data.questionId ?? data.question_id;
  const selectedOptionId = data.selectedOptionId ?? data.selected_id ?? data.selectedIndex;
  if (!qid) return { error: 'Missing questionId' };
  requireAuth();
  const ansRef = doc(db, 'attempts', String(attemptId), 'answers', String(qid));
  await setDoc(ansRef, {
    selectedId: (typeof selectedOptionId === 'number' ? selectedOptionId : parseInt(selectedOptionId,10) || selectedOptionId),
    savedAt: serverTimestamp()
  }, { merge: true });
  return { ok: true };
}

// Complete attempt and compute score
async function completeAttempt(attemptId) {
  requireAuth();
  const attDoc = doc(db, 'attempts', String(attemptId));
  const attSnap = await getDoc(attDoc);
  if (!attSnap.exists()) return { error: 'Attempt not found' };
  const att = attSnap.data();
  const quizId = att.quizId;
  // Load answers
  const ansSnap = await getDocs(collection(db, 'attempts', String(attemptId), 'answers'));
  const answers = ansSnap.docs.map(d => ({ qid: parseInt(d.id,10)||d.id, ...d.data() }));
  // Load questions and compute
  const questions = await getQuizQuestions(quizId);
  let correct = 0;
  for (const q of questions) {
    const ans = answers.find(a => String(a.qid) === String(q.id));
    if (!ans) continue;
    const options = await getQuestionOptions(quizId, q.id);
    const chosen = options.find(o => String(o.id) === String(ans.selectedId));
    if (chosen && (chosen.is_correct === true || chosen.isCorrect === true)) correct++;
  }
  const total = questions.length;
  // Compute timeSpentSeconds now so we can both store it and return it immediately
  let timeSpentSeconds = null;
  try {
    const start = att.startTime && att.startTime.toDate ? att.startTime.toDate().getTime() : (typeof att.startTime === 'number' ? att.startTime : null);
    if (start) {
      const deltaMs = Date.now() - start;
      timeSpentSeconds = Math.max(0, Math.round(deltaMs / 1000));
    }
  } catch (_) { timeSpentSeconds = null; }

  await updateDoc(attDoc, {
    completed: true,
    endTime: serverTimestamp(),
    correctAnswers: correct,
    totalQuestions: total,
    // store computed time spent so listing can show it without recompute
    timeSpentSeconds: timeSpentSeconds
  });
  const score = Math.round((correct * 100) / (total || 1));

  // Update user aggregates (last/best score, attempts count)
  try {
    const userId = att.userId;
    if (userId != null && userId !== undefined) {
      const userRef = doc(db, 'users', String(userId));
      let bestScore = score;
      try {
        const uSnap = await getDoc(userRef);
        if (uSnap.exists() && typeof uSnap.data().bestScore === 'number') {
          bestScore = Math.max(bestScore, uSnap.data().bestScore);
        }
      } catch (_) {}
      await setDoc(userRef, {
        lastAttemptId: String(attemptId),
        lastScore: score,
        lastCorrectAnswers: correct,
        lastTotalQuestions: total,
        bestScore: bestScore,
        attemptsCount: increment(1),
        lastAttemptAt: serverTimestamp()
      }, { merge: true });

      // Per-quiz rollup under user
      const uqRef = doc(db, 'users', String(userId), 'quizzes', String(quizId));
      let uqBest = score;
      try {
        const uqSnap = await getDoc(uqRef);
        if (uqSnap.exists() && typeof uqSnap.data().bestScore === 'number') {
          uqBest = Math.max(uqBest, uqSnap.data().bestScore);
        }
      } catch (_) {}
      await setDoc(uqRef, {
        lastAttemptId: String(attemptId),
        lastScore: score,
        bestScore: uqBest,
        attemptsCount: increment(1),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (e) {
    // Non-fatal: scoring update shouldn't block student completion
    console.warn('[users-rollup] update failed:', e?.message || e);
  }

  // Try to read back the user's attemptsCount so the client can update immediately
  let attemptsCount = null;
  try {
    const userId = att.userId;
    if (userId != null && userId !== undefined) {
      const uRef = doc(db, 'users', String(userId));
      const uSnap2 = await getDoc(uRef);
      if (uSnap2.exists()) attemptsCount = uSnap2.data().attemptsCount ?? null;
    }
  } catch (_) { attemptsCount = null; }

  return { id: String(attemptId), correctAnswers: correct, totalQuestions: total, score, timeSpentSeconds, attemptsCount };
}

// Teacher: list attempts
async function listAttempts() {
  const user = requireAuth();
  // Only teachers should call this; rules will enforce access
  const snap = await getDocs(collection(db, 'attempts'));
  const attempts = await Promise.all(snap.docs.map(async d => {
    const a = d.data();
    let quizTitle = null;
    try { const qd = await getDoc(doc(db, 'quizzes', String(a.quizId))); quizTitle = qd.exists() ? (qd.data().title || `Quiz ${a.quizId}`) : `Quiz ${a.quizId}`; } catch {}
    let userInfo = {};
    try { const ud = await getDoc(doc(db, 'users', String(a.userId))); userInfo = ud.exists() ? ud.data() : {}; } catch {}
    // Compute timeSpentSeconds for older attempts if not stored directly
    let computedTimeSeconds = a.timeSpentSeconds;
    try {
      if ((computedTimeSeconds == null) && a.startTime && a.endTime) {
        const s = a.startTime.toDate ? a.startTime.toDate().getTime() : (typeof a.startTime === 'number' ? a.startTime : null);
        const e = a.endTime.toDate ? a.endTime.toDate().getTime() : (typeof a.endTime === 'number' ? a.endTime : null);
        if (s != null && e != null) computedTimeSeconds = Math.max(0, Math.round((e - s) / 1000));
      }
    } catch (_) { /* ignore */ }

    return {
      id: d.id,
      quizId: a.quizId,
      quizTitle,
      userId: a.userId,
      username: userInfo.username,
      email: userInfo.email,
      fullName: userInfo.fullName,
      // include attemptsCount from the user rollup (if available) so UIs can show total attempts
      attemptsCount: userInfo.attemptsCount || 0,
      correctAnswers: a.correctAnswers,
      totalQuestions: a.totalQuestions,
      startTime: a.startTime?.toDate ? a.startTime.toDate().toISOString() : a.startTime,
      endTime: a.endTime?.toDate ? a.endTime.toDate().toISOString() : a.endTime,
      // prefer stored timeSpentSeconds, otherwise use computed fallback
      timeSpentSeconds: (computedTimeSeconds != null ? computedTimeSeconds : a.timeSpentSeconds),
      completed: !!a.completed,
      
    };
  }));
  return attempts;
}

// Teacher: list users
async function listUsers() {
  requireAuth();
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => {
    const u = d.data();
    return {
      id: d.id,
      username: u.username || null,
      email: u.email || null,
      fullName: u.fullName || null,
      role: u.role || 'student',
      attemptsCount: u.attemptsCount || 0,
      lastScore: u.lastScore || null,
      bestScore: u.bestScore || null,
      lastAttemptAt: u.lastAttemptAt?.toDate ? u.lastAttemptAt.toDate().toISOString() : u.lastAttemptAt
    };
  });
  return users;
}
// Teacher: add question
async function addQuestion(body) {
  const data = safeJson(body) || {};
  const quizId = data.quizId || 1;
  const qId = data.orderNum; // use orderNum as question id to match UI expectations
  if (qId == null) return { error: 'orderNum (question number) is required' };
  // Ensure quiz doc exists so we can update its metadata (updatedAt)
  await ensureQuiz(quizId);
  // Check duplicate
  const qDoc = doc(db, 'quizzes', String(quizId), 'questions', String(qId));
  const qSnap = await getDoc(qDoc);
  if (qSnap.exists()) {
    throw new Error(`Question number ${qId} already exists`);
  }
  // Coerce subjectId to a number safely; fallback to 1 (DBMS) only if parsing fails
  let subjectId = 1;
  try {
    if (data.subjectId != null) {
      const parsed = parseInt(String(data.subjectId), 10);
      if (!Number.isNaN(parsed)) subjectId = parsed;
    }
  } catch (_) {}

  // Debug: log the incoming payload when subjectId is unexpected
  if (subjectId === 1 && data.subjectId != null && String(data.subjectId) !== '1') {
    console.warn('[addQuestion] subjectId coerced to 1 from payload:', data.subjectId, 'full payload:', data);
  }

  await setDoc(qDoc, {
    subjectId: subjectId,
    orderNum: qId,
    points: data.points || 1,
    questionText: data.questionText
  });
  // Write options
  const opts = Array.isArray(data.options) ? data.options : [];
  const correctIndex = data.correctIndex || 0;
  for (let i = 0; i < opts.length; i++) {
    await setDoc(doc(db, 'quizzes', String(quizId), 'questions', String(qId), 'options', String(i)), {
      index: i,
      optionText: opts[i],
      option_text: opts[i],
      is_correct: i === correctIndex
    });
  }
  // Touch quiz metadata so clients can detect changes
  try {
    await updateDoc(doc(db, 'quizzes', String(quizId)), { updatedAt: serverTimestamp() });
  } catch (e) {
    // Non-fatal: if updating metadata fails, continue
    console.warn('[addQuestion] failed to update quiz metadata:', e?.message || e);
  }
  return { id: qId, subjectId: subjectId };
}

// Teacher: delete question by order number
async function deleteQuestion(orderNum, quizId = 1) {
  const qDoc = doc(db, 'quizzes', String(quizId), 'questions', String(orderNum));
  // delete options first
  const oSnap = await getDocs(collection(db, 'quizzes', String(quizId), 'questions', String(orderNum), 'options'));
  await Promise.all(oSnap.docs.map(d => deleteDoc(d.ref)));
  // delete question
  await deleteDoc(qDoc);
  // Touch quiz metadata so clients can detect changes
  try {
    await updateDoc(doc(db, 'quizzes', String(quizId)), { updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn('[deleteQuestion] failed to update quiz metadata:', e?.message || e);
  }
  return { ok: true };
}

// Teacher: list quizzes minimal
async function listQuizzes() {
  const snap = await getDocs(collection(db, 'quizzes'));
  const items = snap.docs.map(d => ({ id: parseInt(d.id,10)||d.id, ...d.data() }));
  if (items.length) return items;
  return [{ id: 1, title: 'Main Quiz' }];
}

// Main API router
async function firebaseApiCall(endpoint, method = 'GET', body = null) {
  method = (method || 'GET').toUpperCase();
  const path = endpoint.split('?')[0];
  const paramsStr = endpoint.includes('?') ? endpoint.split('?')[1] : '';
  const params = new URLSearchParams(paramsStr);

  // Users
  if (path === '/users/identify' && method === 'POST') {
    return await identifyUser(body);
  }

  // Quiz public endpoints (assume quizId=1 unless provided)
  if (path === '/quiz/subjects' && method === 'GET') {
    return await getSubjects();
  }
  if (/^\/quiz\/(\d+)\/questions$/.test(path) && method === 'GET') {
    const quizId = parseInt(path.match(/^\/quiz\/(\d+)\/questions$/)[1], 10);
    const qs = await getQuizQuestions(quizId);
    // Return trimmed fields the UI expects
    return qs.map(q => ({ id: q.id, subjectId: q.subjectId, orderNum: q.orderNum, questionText: q.questionText }));
  }
  if (/^\/quiz\/questions\/(.+)\/options$/.test(path) && method === 'GET') {
    const qid = path.match(/^\/quiz\/questions\/(.+)\/options$/)[1];
    const quizId = 1; // fixed for now
    const opts = await getQuestionOptions(quizId, qid);
    return opts.map(o => ({ id: o.id, optionText: o.optionText || o.option_text, isCorrect: o.is_correct || o.isCorrect }));
  }
  if (/^\/quiz\/(\d+)\/start$/.test(path) && method === 'POST') {
    const quizId = parseInt(path.match(/^\/quiz\/(\d+)\/start$/)[1],10);
    return await startAttempt(quizId);
  }
  if (/^\/quiz\/attempts\/(.+)\/answer$/.test(path) && method === 'POST') {
    const attemptId = path.match(/^\/quiz\/attempts\/(.+)\/answer$/)[1];
    return await saveAnswer(attemptId, body);
  }
  if (/^\/quiz\/attempts\/(.+)\/complete$/.test(path) && method === 'POST') {
    const attemptId = path.match(/^\/quiz\/attempts\/(.+)\/complete$/)[1];
    return await completeAttempt(attemptId);
  }

  // Teacher endpoints
  if (path === '/teacher/attempts' && method === 'GET') {
    return await listAttempts();
  }
  if (path === '/teacher/users' && method === 'GET') {
    return await listUsers();
  }
  if (path === '/teacher/questions' && method === 'POST') {
    return await addQuestion(body);
  }
  if (/^\/teacher\/questions\/(.+)$/.test(path) && method === 'DELETE') {
    const id = path.match(/^\/teacher\/questions\/(.+)$/)[1];
    // byOrderNum=true is expected
    return await deleteQuestion(id);
  }
  if (path === '/quizzes' && method === 'GET') {
    return await listQuizzes();
  }

  throw new Error(`Unsupported Firebase API route: ${method} ${endpoint}`);
}

// Expose globally for non-module scripts
window.firebaseApiCall = firebaseApiCall;
// Signal readiness for consumers that need to wait until this module loads
try {
  window.firebaseApiReady = true;
  window.dispatchEvent(new Event('firebaseApiReady'));
} catch (_) {
  // no-op if dispatch not available
}

export { firebaseApiCall };
