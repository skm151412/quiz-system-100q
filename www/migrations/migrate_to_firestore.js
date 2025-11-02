/*
  Migration script: Import quiz data from MySQL dump into Firestore

  Usage:
    1) Create a Firebase service account JSON and set environment variable:
       $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\path\\to\\serviceAccount.json"   # PowerShell
    2) Install deps: npm i
    3) Run: npm run migrate

  Notes:
    - Parses subjects, quizzes, questions, question_options from quiz_system_export.sql
    - Writes to Firestore with structure used by the frontend:
      subjects/{id}
      quizzes/{quizId}
      quizzes/{quizId}/questions/{orderNum}
      quizzes/{quizId}/questions/{orderNum}/options/{index}
*/

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function initFirebase() {
  // Prefer local service account file if present; else use ADC via env var
  const localKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(localKeyPath)) {
    const key = require(localKeyPath);
    admin.initializeApp({
      credential: admin.credential.cert(key)
    });
  } else {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('No credentials found. Provide serviceAccountKey.json at repo root or set GOOGLE_APPLICATION_CREDENTIALS.');
      process.exit(1);
    }
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
  return admin.firestore();
}

function readSqlDump(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Robust tuple extraction for a table's INSERT statement
function parseInsertTuples(sql, table) {
  const marker = `INSERT INTO \`${table}\` VALUES `;
  const re = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, r=>r), 'g');
  const idx = sql.search(re);
  if (idx === -1) return [];
  // Start after the first "(" following the marker
  let i = idx + marker.length;
  while (i < sql.length && sql[i] !== '(') i++;
  if (i >= sql.length) return [];
  // Collect until the terminating ")" before the semicolon that closes the VALUES list
  const tuples = [];
  let depth = 0, inStr = false, esc = false, buf = '';
  for (let j = i; j < sql.length; j++) {
    const ch = sql[j];
    if (inStr) {
      buf += ch;
      if (esc) { esc = false; }
      else if (ch === '\\') esc = true;
      else if (ch === "'") inStr = false;
    } else {
      if (ch === "'") { inStr = true; buf += ch; }
      else if (ch === '(') { depth++; buf += ch; }
      else if (ch === ')') { depth--; buf += ch; if (depth === 0) { tuples.push(buf.slice(1, -1)); buf = ''; } }
      else if (ch === ';' && depth === 0) { break; }
      else { buf += ch; }
    }
  }
  return tuples;
}

function parseSubjects(sql) {
  const tuples = parseInsertTuples(sql, 'subjects');
  return tuples.map(t => {
    const v = splitValues(t);
    return {
      id: toInt(v[0]),
      color: stripQuotes(v[1]),
      name: stripQuotes(v[4])
    };
  });
}

function parseQuizzes(sql) {
  const tuples = parseInsertTuples(sql, 'quizzes');
  return tuples.map(t => {
    const v = splitValues(t);
    return {
      id: toInt(v[0]),
      title: stripQuotes(v[7]),
      timeLimit: toInt(v[6]),
      totalQuestions: toInt(v[8])
    };
  });
}

function parseQuestions(sql) {
  const tuples = parseInsertTuples(sql, 'questions');
  return tuples.map(t => {
    const v = splitValues(t);
    return {
      id: toInt(v[0]),
      orderNum: toInt(v[2]),
      points: toInt(v[3]),
      questionText: stripQuotes(v[4]),
      quizId: toInt(v[6]),
      subjectId: toInt(v[7])
    };
  });
}

function parseQuestionOptions(sql) {
  const tuples = parseInsertTuples(sql, 'question_options');
  return tuples.map(t => {
    const v = splitValues(t);
    const raw = v[1] || '';
    const isCorrect = /\x01|\u0001|\u0001|\u0001|\u0001|\u0001|\u0001|\u0001/.test(raw) || /_binary\s*'\x01'/.test(raw) || /_binary\s*'\u0001'/.test(raw) || raw.includes('\u0001') || raw.includes('\x01') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\x01') || raw.includes('\u0001') || raw.includes('\x01') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || raw.includes('\u0001') || v[1] === '1';
    return {
      id: toInt(v[0]),
      isCorrect,
      optionText: stripQuotes(v[2]),
      index: toInt(v[3]),
      questionId: toInt(v[4])
    };
  });
}

// Tuple/value splitting helpers
function splitTuples(s) {
  // Split on '),(' at the top level
  const tuples = [];
  let depth = 0, buf = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; buf += ch; }
    else if (ch === ')') { depth--; buf += ch; }
    else if (ch === ',' && depth === 0) { /* between tuples */ }
    else { buf += ch; }
    // detect end of a tuple
    if (depth === 0 && buf.trim()) {
      const trimmed = buf.trim();
      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        tuples.push(trimmed.slice(1, -1));
        buf = '';
      }
    }
  }
  if (buf.trim()) tuples.push(buf.trim());
  return tuples;
}

function splitValues(t) {
  const out = [];
  let i = 0, cur = '', inStr = false, esc = false;
  while (i < t.length) {
    const ch = t[i];
    if (inStr) {
      if (esc) { cur += ch; esc = false; }
      else if (ch === '\\') { cur += ch; esc = true; }
      else if (ch === "'") { cur += ch; inStr = false; }
      else { cur += ch; }
    } else {
      if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else if (ch === "'") { inStr = true; cur += ch; }
      else { cur += ch; }
    }
    i++;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

function stripQuotes(s) {
  if (!s) return null;
  if (s === 'NULL') return null;
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/\\'/g, "'");
  }
  return s;
}

function toInt(s) {
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? null : n;
}

async function run() {
  const db = await initFirebase();
  const sqlPath = path.join(__dirname, '..', 'quiz_system_export.sql');
  const sql = readSqlDump(sqlPath);

  const subjects = parseSubjects(sql);
  const quizzes = parseQuizzes(sql);
  const questions = parseQuestions(sql);
  const options = parseQuestionOptions(sql);

  console.log(`Parsed: ${subjects.length} subjects, ${quizzes.length} quizzes, ${questions.length} questions, ${options.length} options`);

  // Write subjects
  for (const s of subjects) {
    await db.collection('subjects').doc(String(s.id)).set({
      name: s.name,
      color: s.color
    }, { merge: true });
  }

  // Write quizzes
  for (const qz of quizzes) {
    await db.collection('quizzes').doc(String(qz.id)).set({
      title: qz.title || `Quiz ${qz.id}`,
      timeLimit: qz.timeLimit || null,
      totalQuestions: qz.totalQuestions || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // Index options by questionId
  const optsByQ = new Map();
  for (const o of options) {
    if (!optsByQ.has(o.questionId)) optsByQ.set(o.questionId, []);
    optsByQ.get(o.questionId).push(o);
  }

  // Write questions and options (use orderNum as question doc id)
  for (const q of questions) {
    const quizId = q.quizId || 1;
    const qDoc = db.collection('quizzes').doc(String(quizId)).collection('questions').doc(String(q.orderNum));
    await qDoc.set({
      subjectId: q.subjectId,
      orderNum: q.orderNum,
      points: q.points || 1,
      questionText: q.questionText
    }, { merge: true });

    const oList = (optsByQ.get(q.id) || []).sort((a,b)=> (a.index||0) - (b.index||0));
    for (const o of oList) {
      await qDoc.collection('options').doc(String(o.index || 0)).set({
        index: o.index || 0,
        optionText: o.optionText,
        option_text: o.optionText,
        is_correct: !!o.isCorrect
      }, { merge: true });
    }
  }

  console.log('Migration complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
