const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const statusEl = document.getElementById('status');
const currentLangEl = document.getElementById('current-lang');
const supportEl = document.getElementById('support');
const interimEl = document.getElementById('interim');
const currentFinalEl = document.getElementById('current-final');
const logEl = document.getElementById('log');
const keywordResultEl = document.getElementById('keyword-result');
const grammarResultEl = document.getElementById('grammar-result');
const meaningHintEl = document.getElementById('meaning-hint');
const recentHistoryEl = document.getElementById('recent-history');
const speakerBadgeEl = document.getElementById('speaker-badge');
const interpretSectionEl = document.getElementById('interpret-section');
const interpretResultEl = document.getElementById('interpret-result');
const predictionSectionEl = document.getElementById('prediction-section');
const predictionResultEl = document.getElementById('prediction-result');
const topicNameEl = document.getElementById('topic-name');
const translationSectionEl = document.getElementById('translation-section');
const translationResultEl = document.getElementById('translation-result');
const translationBadgeEl = document.getElementById('translation-badge');
const translationNoteEl = document.getElementById('translation-note');
const koAssistSectionEl = document.getElementById('ko-assist-section');
const koTermResultEl = document.getElementById('ko-term-result');
const koGrammarResultEl = document.getElementById('ko-grammar-result');
const koNaturalResultEl = document.getElementById('ko-natural-result');
const koAssemblyResultEl = document.getElementById('ko-assembly-result');
const koAssistBadgeEl = document.getElementById('ko-assist-badge');
const jpHintSectionEl = document.getElementById('jp-hint-section');
const jpAnalysisGridEl = document.getElementById('jp-analysis-grid');
const generalWordResultEl = document.getElementById('general-word-result');
const segmentBadgeEl = document.getElementById('segment-badge');
const segmentListEl = document.getElementById('segment-list');
const forceBoundaryEl = document.getElementById('force-boundary');
const dbStatusEl = document.getElementById('db-status');
const sourcePaneTitleEl = document.getElementById('source-pane-title');
const assistPaneTitleEl = document.getElementById('assist-pane-title');
const assistModeBadgeEl = document.getElementById('assist-mode-badge');
const jpRightModeEl = document.getElementById('jp-right-mode');
const koRightModeEl = document.getElementById('ko-right-mode');
const koTranslationSectionEl = document.getElementById('ko-translation-section');
const koTranslationBadgeEl = document.getElementById('ko-translation-badge');
const localKoJaResultEl = document.getElementById('local-ko-ja-result');
const aiJpKoResultEl = document.getElementById('ai-jp-ko-result');
const aiKoJaResultEl = document.getElementById('ai-ko-ja-result');
const aiJpHintsEl = document.getElementById('ai-jp-hints');
const aiKoHintsEl = document.getElementById('ai-ko-hints');
const geminiStatusEl = document.getElementById('gemini-status');
const geminiAutoEl = document.getElementById('gemini-auto');
const geminiDialogEl = document.getElementById('gemini-dialog');
const geminiKeyEl = document.getElementById('gemini-key');
const geminiModelEl = document.getElementById('gemini-model');
const geminiPersistEl = document.getElementById('gemini-persist');
const geminiTestResultEl = document.getElementById('gemini-test-result');
const dictionarySearchEl = document.getElementById('dictionary-search');
const dictionarySearchResultEl = document.getElementById('dictionary-search-result');

const autoRestartEl = document.getElementById('auto-restart');
const wakeLockEl = document.getElementById('wake-lock');

let recognition = null;
let currentLang = 'ja-JP';
let desiredListening = false;
let isRunning = false;
let switchingLang = false;
let pendingLang = null;
let wakeLock = null;
let restartTimer = null;

let termsDB = [];
let grammarDB = [];
let questionsDB = [];
let readingsDB = [];
let topicsDB = [];
let translationSentencesDB = [];
let translationPhrasesDB = [];
let koTermsDB = [];
let koGrammarDB = [];
let koNaturalDB = [];
let koConceptsDB = [];
let generalWordsDB = [];

let currentDetectedKeywords = new Set();
let currentDetectedGrammar = new Set();
let currentDetectedGeneralWords = new Set();
let recentHistory = [];

const MERGE_WINDOW_MS = 8000;
const HISTORY_LIMIT = 12;
let currentUtterance = null;
let utteranceCommitTimer = null;
let geminiDebounceTimer = null;
let geminiBusy = false;
let lastGeminiText = '';
let lastGeminiLang = '';
let lastGeminiResult = null;
let lastLocalAssemblyHtml = '';
let lastKoAnalysis = null;

function log(message) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setLanguageLabel() {
  const isJapanese = currentLang === 'ja-JP';
  currentLangEl.textContent = isJapanese ? '일본어 (ja-JP)' : '한국어 (ko-KR)';
  speakerBadgeEl.textContent = isJapanese ? '일본측' : '한국측';
  speakerBadgeEl.className = `speaker-badge ${isJapanese ? 'japanese' : 'korean'}`;
  sourcePaneTitleEl.textContent = isJapanese ? '일본어 입력' : '한국어 입력';
  assistPaneTitleEl.textContent = isJapanese ? '한국어 이해 보조' : '일본어 조립 보조';
  assistModeBadgeEl.textContent = isJapanese ? 'JP → KO' : 'KO → JP';

  document.getElementById('ja-btn').classList.toggle('active', isJapanese);
  document.getElementById('ko-btn').classList.toggle('active', !isJapanese);

  translationSectionEl.classList.toggle('hidden', !isJapanese);
  koTranslationSectionEl.classList.toggle('hidden', isJapanese);
  jpRightModeEl.classList.toggle('hidden', !isJapanese);
  koRightModeEl.classList.toggle('hidden', isJapanese);

  if (isJapanese) {
    interpretSectionEl.classList.add('hidden');
    koAssistSectionEl.classList.add('hidden');
  } else {
    interpretSectionEl.classList.remove('hidden');
    koAssistSectionEl.classList.remove('hidden');
    predictionSectionEl.classList.add('hidden');
  }
}

async function loadData() {
  try {
    const [termsRes, grammarRes, questionsRes, readingsRes, topicsRes, translationsRes, koAssistRes, generalLexiconRes] =
      await Promise.all([
        fetch('data.json'),
        fetch('grammar.json'),
        fetch('questions.json'),
        fetch('readings.json'),
        fetch('topics.json'),
        fetch('translations.json'),
        fetch('korean_assist.json'),
        fetch('general_lexicon.json')
      ]);

    const termsData = await termsRes.json();
    const grammarData = await grammarRes.json();
    const questionsData = await questionsRes.json();
    const readingsData = await readingsRes.json();
    const topicsData = await topicsRes.json();
    const translationsData = await translationsRes.json();
    const koAssistData = await koAssistRes.json();
    const generalLexiconData = await generalLexiconRes.json();

    termsDB = termsData.terms || [];
    grammarDB = grammarData.grammar || [];
    questionsDB = questionsData.questions || [];
    readingsDB = readingsData.readings || [];
    topicsDB = topicsData.topics || [];
    translationSentencesDB = translationsData.sentences || [];
    translationPhrasesDB = translationsData.phrases || [];
    koTermsDB = koAssistData.terms || [];
    koGrammarDB = koAssistData.grammar || [];
    koNaturalDB = koAssistData.natural || [];
    koConceptsDB = koAssistData.concepts || [];
    generalWordsDB = generalLexiconData.words || [];

    readingsDB.sort((a, b) => b[0].length - a[0].length);

    log(`전문용어 DB ${termsDB.length}개 로드 완료`);
    log(`문법 DB ${grammarDB.length}개 로드 완료`);
    log(`예상질문 DB ${questionsDB.length}개 로드 완료`);
    log(`Ruby 읽기 DB ${readingsDB.length}개 로드 완료`);
    log(`주제 예측 DB ${topicsDB.length}개 로드 완료`);
    log(`번역 문장 DB ${translationSentencesDB.length}개 로드 완료`);
    log(`번역 표현 DB ${translationPhrasesDB.length}개 로드 완료`);
    log(`한국어→일본어 핵심표현 DB ${koTermsDB.length}개 로드 완료`);
    log(`한국어→일본어 문법 DB ${koGrammarDB.length}개 로드 완료`);
    log(`일본어식 표현 주의 DB ${koNaturalDB.length}개 로드 완료`);
    log(`한국어 의미개념 DB ${koConceptsDB.length}개 로드 완료`);
    log(`일반 일본어 어휘 DB ${generalWordsDB.length}개 로드 완료`);
    if (dbStatusEl) dbStatusEl.textContent = `${generalWordsDB.length}어휘 · KO문법 ${koGrammarDB.length} · 개념 ${koConceptsDB.length}`;
  } catch (err) {
    log(`DB 로드 실패: ${err.message}`);
  }
}

function rubyJapaneseText(text) {
  if (!text) return '';

  let result = '';
  let i = 0;

  while (i < text.length) {
    let matched = null;

    for (const [word, reading] of readingsDB) {
      if (text.startsWith(word, i)) {
        matched = [word, reading];
        break;
      }
    }

    if (matched) {
      const [word, reading] = matched;
      result += `<ruby>${escapeHtml(word)}<rt>${escapeHtml(reading)}</rt></ruby>`;
      i += word.length;
    } else {
      result += escapeHtml(text[i]);
      i += 1;
    }
  }

  return result;
}

function rubyTerm(term) {
  return `<ruby>${escapeHtml(term.keyword)}<rt>${escapeHtml(term.reading)}</rt></ruby>`;
}

function relatedWithRuby(relatedList) {
  return relatedList.map(word => {
    const found = termsDB.find(t => t.keyword === word);
    if (found) return rubyTerm(found);
    return rubyJapaneseText(word);
  }).join(' · ');
}

function japaneseEntryMatches(text, item) {
  const ja = (item && item.ja) || '';
  if (!ja || !text) return false;
  if (text.includes(ja)) return true;

  const pos = item.pos || '';
  if (pos.includes('동사') || ja.endsWith('する')) {
    if (ja.endsWith('する')) {
      const stem = ja.slice(0, -2);
      if (stem.length >= 2 && text.includes(stem)) return true;
    }
    if (ja.endsWith('る')) {
      const stem = ja.slice(0, -1);
      if (stem.length >= 1) {
        const re = new RegExp(escapeRegExp(stem) + '(?:る|ます|ました|ません|て|た|ない|れば|られる|させる|よう|り|った|って|ら|れ)');
        if (re.test(text)) return true;
      }
    }
    const godan = { 'う':['い','って','った','わ','え'], 'く':['き','いて','いた','か','け','こう'], 'ぐ':['ぎ','いで','いだ','が','げ'], 'す':['し','して','した','さ','せ'], 'つ':['ち','って','った','た','て'], 'ぬ':['に','んで','んだ','な','ね'], 'ぶ':['び','んで','んだ','ば','べ'], 'む':['み','んで','んだ','ま','め'] };
    const last = ja.slice(-1);
    if (godan[last]) {
      const stem = ja.slice(0,-1);
      for (const e of godan[last]) {
        if (text.includes(stem + e)) return true;
      }
    }
  }

  if (pos.includes('형용사') && ja.endsWith('い')) {
    const stem = ja.slice(0,-1);
    if (stem && (text.includes(stem+'く') || text.includes(stem+'かった') || text.includes(stem+'くない'))) return true;
  }
  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyzeCurrentText(text) {
  currentDetectedKeywords = new Set();
  currentDetectedGrammar = new Set();
  currentDetectedGeneralWords = new Set();

  if (text) {
    for (const term of termsDB) {
      if (text.includes(term.keyword)) {
        currentDetectedKeywords.add(term.keyword);
      }
    }

    for (const item of grammarDB) {
      if (item.patterns.some(pattern => text.includes(pattern))) {
        currentDetectedGrammar.add(item.display);
      }
    }

    if (currentLang === 'ja-JP') {
      const specialist = new Set(termsDB.map(t => t.keyword));
      const rankedGeneral = generalWordsDB
        .filter(item => item.ja && !specialist.has(item.ja) && japaneseEntryMatches(text, item))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.ja.length - a.ja.length);
      for (const item of rankedGeneral.slice(0, 12)) {
        currentDetectedGeneralWords.add(item.ja + '|' + item.meaning);
      }
    }
  }

  renderDetectedKeywords();
  renderDetectedGrammar();
  renderDetectedGeneralWords();
  renderMeaningHints();

  if (currentLang === 'ja-JP') {
    detectTopic(text);
  }
}

function renderDetectedKeywords() {
  if (currentDetectedKeywords.size === 0) {
    keywordResultEl.innerHTML =
      '<p class="empty-message">현재 발화에서 감지된 용어가 없습니다.</p>';
    return;
  }

  const items = termsDB.filter(term =>
    currentDetectedKeywords.has(term.keyword)
  );

  keywordResultEl.innerHTML = items.map(term => `
    <div class="keyword-card">
      <h3>${rubyTerm(term)}</h3>
      <p><strong>뜻:</strong> ${term.meaning}</p>
      <p class="related"><strong>관련어:</strong> ${relatedWithRuby(term.related)}</p>
    </div>
  `).join('');
}

function renderDetectedGrammar() {
  if (currentDetectedGrammar.size === 0) {
    grammarResultEl.innerHTML =
      '<p class="empty-message">현재 발화에서 감지된 표현이 없습니다.</p>';
    return;
  }

  const items = grammarDB.filter(item =>
    currentDetectedGrammar.has(item.display)
  );

  grammarResultEl.innerHTML = items.map(item => `
    <div class="grammar-card">
      <h3>${escapeHtml(item.display)}</h3>
      <p><strong>뜻:</strong> ${escapeHtml(item.meaning)}</p>
      <p class="tip"><strong>TIP:</strong> ${escapeHtml(item.tip)}</p>
    </div>
  `).join('');
}

function renderDetectedGeneralWords() {
  if (!generalWordResultEl) return;

  if (currentDetectedGeneralWords.size === 0) {
    generalWordResultEl.innerHTML =
      '<p class="empty-message">일반 어휘가 감지되면 표시됩니다.</p>';
    return;
  }

  const items = [];
  for (const key of currentDetectedGeneralWords) {
    const [ja, meaning] = key.split('|');
    const item = generalWordsDB.find(x => x.ja === ja && x.meaning === meaning);
    if (item) items.push(item);
  }

  generalWordResultEl.innerHTML = items.map(item => `
    <div class="general-word-card">
      <div class="general-ja">${rubyJapaneseText(item.ja)}</div>
      <div class="general-ko">${escapeHtml(item.meaning)}</div>
      <div class="general-meta">${escapeHtml(item.pos || '')} · ${escapeHtml(item.category || '')}</div>
    </div>
  `).join('');
}

function renderMeaningHints() {
  const chips = [];

  for (const term of termsDB) {
    if (currentDetectedKeywords.has(term.keyword)) {
      chips.push(`${term.keyword} → ${term.meaning}`);
    }
  }

  for (const item of grammarDB) {
    if (currentDetectedGrammar.has(item.display)) {
      chips.push(`${item.display} → ${item.meaning}`);
    }
  }

  for (const key of currentDetectedGeneralWords) {
    const [ja, meaning] = key.split('|');
    chips.push(`${ja} → ${meaning}`);
  }

  if (chips.length === 0) {
    meaningHintEl.textContent =
      '현재 발화에서 전문용어와 문법이 감지되면 표시됩니다.';
    return;
  }

  meaningHintEl.innerHTML = chips
    .slice(0, 12)
    .map(text => `<span class="hint-chip">${escapeHtml(text)}</span>`)
    .join('');
}

function detectTopic(text) {
  if (!text || topicsDB.length === 0) {
    predictionSectionEl.classList.add('hidden');
    return;
  }

  const ranked = topicsDB
    .map(topic => {
      const hits = topic.keywords.filter(k => text.includes(k)).length;
      return { topic, hits };
    })
    .sort((a, b) => b.hits - a.hits);

  if (!ranked[0] || ranked[0].hits === 0) {
    predictionSectionEl.classList.add('hidden');
    return;
  }

  const topic = ranked[0].topic;
  topicNameEl.textContent = topic.name_ko;
  predictionSectionEl.classList.remove('hidden');

  const termsHtml = topic.next_terms.map(([word, reading]) => {
    const content = reading
      ? `<ruby>${escapeHtml(word)}<rt>${escapeHtml(reading)}</rt></ruby>`
      : rubyJapaneseText(word);

    return `<span class="prediction-term">${content}</span>`;
  }).join('');

  predictionResultEl.innerHTML = `
    <div class="prediction-grid">
      <div class="prediction-card">
        <h3>다음에 나올 가능성이 높은 단어</h3>
        <div class="prediction-term-list">${termsHtml}</div>
      </div>

      <div class="prediction-card">
        <h3>이어질 가능성이 높은 질문</h3>
        <p class="prediction-question-ko">${escapeHtml(topic.next_question_ko)}</p>
        <p class="prediction-question-ja">${rubyJapaneseText(topic.next_question_ja)}</p>
      </div>
    </div>
  `;
}


function normalizeJa(text) {
  return text
    .replace(/[。、，,.!?！？「」『』（）()\s]/g, '')
    .replace(/です|ます|しています|しております|されています|しました/g, '');
}

function jaNgrams(text, n = 2) {
  const s = normalizeJa(text);
  const set = new Set();

  for (let i = 0; i <= s.length - n; i++) {
    set.add(s.slice(i, i + n));
  }

  return set;
}

function jaDiceSimilarity(a, b) {
  const A = jaNgrams(a);
  const B = jaNgrams(b);

  if (A.size === 0 || B.size === 0) return 0;

  let intersection = 0;
  for (const item of A) {
    if (B.has(item)) intersection++;
  }

  return (2 * intersection) / (A.size + B.size);
}

function scoreTranslation(text, item) {
  const candidates = [item.ja, ...(item.variants || [])];
  let bestTextScore = 0;

  for (const candidate of candidates) {
    bestTextScore = Math.max(bestTextScore, jaDiceSimilarity(text, candidate));
  }

  const keywords = item.keywords || [];
  let keywordHits = 0;

  for (const keyword of keywords) {
    if (text.includes(keyword)) keywordHits++;
  }

  const keywordScore = keywords.length
    ? keywordHits / keywords.length
    : 0;

  return (bestTextScore * 0.72) + (keywordScore * 0.28);
}

function roughPhraseTranslation(text) {
  const matches = [];
  const occupied = new Array(text.length).fill(false);

  const generalPhrases = generalWordsDB
    .filter(item => item.ja && item.ja.length >= 2)
    .map(item => [item.ja, item.meaning]);

  const phrases = [...translationPhrasesDB, ...generalPhrases]
    .sort((a, b) => b[0].length - a[0].length);

  for (const [ja, ko] of phrases) {
    let start = 0;

    while (true) {
      const idx = text.indexOf(ja, start);
      if (idx === -1) break;

      const end = idx + ja.length;
      let overlap = false;

      for (let i = idx; i < end; i++) {
        if (occupied[i]) {
          overlap = true;
          break;
        }
      }

      if (!overlap) {
        matches.push({ idx, end, ja, ko });
        for (let i = idx; i < end; i++) occupied[i] = true;
      }

      start = idx + 1;
    }
  }

  matches.sort((a, b) => a.idx - b.idx);

  return matches.slice(0, 10);
}


function splitJapaneseClauses(text) {
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Split on Japanese punctuation and major connective boundaries.
  return cleaned
    .split(/(?<=[。！？])|、|(?=そのため)|(?=その上で)|(?=一方で)|(?=また)|(?=さらに)/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/[。！？]+$/g, '').trim())
    .filter(Boolean);
}

function translateClause(clause) {
  const ranked = translationSentencesDB
    .map(item => ({ item, score: scoreTranslation(clause, item) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (best && best.score >= 0.50) {
    return {
      type: 'high',
      score: best.score,
      ko: best.item.ko
    };
  }

  if (best && best.score >= 0.32) {
    return {
      type: 'mid',
      score: best.score,
      ko: best.item.ko
    };
  }

  const parts = roughPhraseTranslation(clause);

  if (parts.length) {
    const translated = parts
      .map(p => p.ko)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    return {
      type: 'parts',
      score: 0,
      ko: translated.join(' / '),
      parts
    };
  }

  return {
    type: 'none',
    score: 0,
    ko: ''
  };
}

function buildClauseTranslation(text) {
  const clauses = splitJapaneseClauses(text);
  if (!clauses.length) return null;

  const results = clauses.map(clause => ({
    ja: clause,
    ...translateClause(clause)
  }));

  return results;
}

function translateJapanese(text) {
  if (!text || currentLang !== 'ja-JP') return;

  if (!translationSentencesDB.length) {
    translationResultEl.textContent = '번역 DB를 불러오는 중입니다.';
    return;
  }

  // 1) Whole-sentence match first
  const ranked = translationSentencesDB
    .map(item => ({ item, score: scoreTranslation(text, item) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (best && best.score >= 0.52) {
    const percent = Math.round(best.score * 100);
    translationResultEl.textContent = best.item.ko;
    translationBadgeEl.textContent = `문장 매칭 ${percent}%`;
    translationBadgeEl.className = 'translation-badge high';
    translationNoteEl.textContent =
      '예상 문장 DB와 유사도가 높아 자연스러운 한국어 문장으로 표시했습니다.';
    return;
  }

  // 2) Split into clauses and translate each independently
  const clauseResults = buildClauseTranslation(text);

  if (clauseResults && clauseResults.length > 1) {
    const successful = clauseResults.filter(r => r.type !== 'none');

    if (successful.length >= Math.ceil(clauseResults.length * 0.6)) {
      const highCount = successful.filter(r => r.type === 'high').length;
      const midCount = successful.filter(r => r.type === 'mid').length;

      const translatedText = successful
        .map(r => r.ko)
        .filter(Boolean)
        .join(' ');

      translationResultEl.innerHTML = `
        <div>${escapeHtml(translatedText)}</div>
        <div class="clause-detail">
          ${clauseResults.map(r => `
            <div class="clause-row">
              <div class="clause-ja">${rubyJapaneseText(r.ja)}</div>
              <div class="clause-ko">${r.ko ? escapeHtml(r.ko) : '해석 데이터 부족'}</div>
            </div>
          `).join('')}
        </div>
      `;

      if (highCount + midCount >= Math.ceil(successful.length * 0.7)) {
        translationBadgeEl.textContent = '절 단위 번역';
        translationBadgeEl.className = 'translation-badge mid';
        translationNoteEl.textContent =
          '긴 문장을 절 단위로 나눠 가장 가까운 번역을 조합했습니다. 세부 뉘앙스는 원문을 함께 확인하세요.';
      } else {
        translationBadgeEl.textContent = '부분 해석';
        translationBadgeEl.className = 'translation-badge low';
        translationNoteEl.textContent =
          '일부 절은 문장 DB, 일부는 표현 DB를 사용한 참고 해석입니다.';
      }
      return;
    }
  }

  // 3) Mid whole-sentence match
  if (best && best.score >= 0.30) {
    const percent = Math.round(best.score * 100);
    translationResultEl.textContent = best.item.ko;
    translationBadgeEl.textContent = `참고 매칭 ${percent}%`;
    translationBadgeEl.className = 'translation-badge mid';
    translationNoteEl.textContent =
      '비슷한 예상 문장을 바탕으로 한 참고 번역입니다. 원문과 세부 의미가 다를 수 있습니다.';
    return;
  }

  // 4) Phrase-level meaning fragments
  const parts = roughPhraseTranslation(text);

  if (parts.length) {
    const unique = [];
    const seen = new Set();
    for (const p of parts) {
      const key = p.ja + '|' + p.ko;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }

    translationResultEl.innerHTML = `
      <div>문장 전체 자동번역은 어렵지만, 다음 의미를 포함합니다.</div>
      <div class="translation-parts">
        ${unique.map(p => `<span class="translation-part">${escapeHtml(p.ja)} → ${escapeHtml(p.ko)}</span>`).join('')}
      </div>
    `;
    translationBadgeEl.textContent = '의미 조각';
    translationBadgeEl.className = 'translation-badge low';
    translationNoteEl.textContent =
      '등록된 전문용어·문법·상용표현을 조합한 참고용 해석입니다.';
    return;
  }

  translationResultEl.textContent =
    '현재 DB만으로는 이 문장의 한국어 의미를 충분히 추정하기 어렵습니다.';
  translationBadgeEl.textContent = 'DB 부족';
  translationBadgeEl.className = 'translation-badge low';
  translationNoteEl.textContent =
    '이 문장을 번역 데이터에 추가하면 다음부터 바로 표시할 수 있습니다.';
}


function normalizeKoAssist(text) {
  return (text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[?.!,~"'“”‘’(){}\[\]:;·…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactKo(text) {
  return normalizeKoAssist(text).replace(/\s+/g, '');
}

const KO_PARTICLES = [
  '으로부터','에게서는','에게서','에서는','으로는','로부터','에게는','한테서','까지도','부터도',
  '이라는','라고는','으로써','로써','처럼','보다','마다','밖에','조차','마저','에게','한테','께서',
  '에서','으로','로','와','과','이랑','랑','의','은','는','이','가','을','를','에','도','만','께','부터','까지'
].sort((a,b)=>b.length-a.length);

const KO_ENDINGS = [
  '하겠습니다','하고있습니다','하고 있습니다','하고있어요','하고 있어요','했습니다','하였습니다','합니다','해왔습니다','해 왔습니다',
  '하면서도','하면서','한다면','한다면요','하는데요','하는데','하는','한','할','하고','해서','하여','했다','했어요','해요','해',
  '되겠습니다','되고있습니다','되고 있습니다','되었습니다','됐습니다','됩니다','되면서','되는','된','될','되고','되어','돼서','됐다','돼요',
  '있겠습니다','있었습니다','있습니다','있어요','있으면서','있는','있던','있을','있고','있어','있다',
  '없었습니다','없습니다','없어요','없는','없을','없고','없어','없다',
  '겠습니다','았습니다','었습니다','ㅂ니다','습니다','습니까','나요','는데요','는데','지만','면서','으면','면','어서','아서','여서','해서',
  '려고','도록','듯이','듯','라고','이라고','라는','다는','던','었던','았던','었던','는','은','ㄴ','을','ㄹ','고','며','서','다','요'
].sort((a,b)=>b.length-a.length);

function stemKoToken(token) {
  let t = normalizeKoAssist(token).replace(/\s+/g,'');
  if (!t) return '';

  // 조사 제거
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of KO_PARTICLES) {
      if (t.length > p.length + 1 && t.endsWith(p)) {
        t = t.slice(0, -p.length); changed = true; break;
      }
    }
  }

  // 하다/되다 활용은 명사성 어간까지 정규화: 공유합니다 → 공유, 검토하면서 → 검토
  const special = [
    /(하겠습니다|하고있습니다|하고있어요|했습니다|하였습니다|합니다|하면서도|하면서|한다면|하는데요|하는데|하는|하고|해서|하여|했다|했어요|해요|해|하다)$/,
    /(되겠습니다|되고있습니다|되었습니다|됐습니다|됩니다|되면서|되는|되고|되어|돼서|됐다|돼요|되다)$/
  ];
  for (const re of special) {
    if (re.test(t)) return t.replace(re,'') || t;
  }

  for (const e of KO_ENDINGS) {
    if (t.length > e.length + 1 && t.endsWith(e)) {
      return t.slice(0, -e.length);
    }
  }
  return t;
}

function koTokenSet(text) {
  const result = new Set();
  for (const token of normalizeKoAssist(text).split(' ')) {
    const stem = stemKoToken(token);
    if (stem && stem.length >= 1) result.add(stem);
  }
  return result;
}

function aliasCoreTokens(alias) {
  return normalizeKoAssist(alias)
    .replace(/[~～]/g,'')
    .split(' ')
    .map(stemKoToken)
    .filter(x => x && x.length >= 1 && !['것','수','때','경우','정도'].includes(x));
}

function findKoAliasMatch(text, trigger) {
  const raw = normalizeKoAssist(text);
  const trig = normalizeKoAssist(trigger).replace(/[~～]/g,'').trim();
  if (!raw || !trig) return null;

  let idx = raw.indexOf(trig);
  if (idx >= 0) return { matched: trigger, index: idx, quality: 1.0, length: trig.length };

  const compactText = raw.replace(/\s+/g,'');
  const compactTrig = trig.replace(/\s+/g,'');
  idx = compactText.indexOf(compactTrig);
  if (compactTrig.length >= 2 && idx >= 0) return { matched: trigger, index: idx, quality: 0.94, length: compactTrig.length };

  // 용언 활용형 대응: 검토하다 → 검토하고/검토했습니다, 이용하다 → 이용할
  let root = compactTrig;
  if (root.endsWith('하다')) root = root.slice(0,-2);
  else if (root.endsWith('되다')) root = root.slice(0,-2);
  else if (root.endsWith('다') && root.length >= 3) root = root.slice(0,-1);
  if (root.length >= 2) {
    idx = compactText.indexOf(root);
    if (idx >= 0) return { matched: trigger, index: idx, quality: 0.82, length: root.length };
  }

  // 문장 중간에 부사/조사가 끼어도 의미 토큰이 모두 있으면 약한 매칭
  const cores = aliasCoreTokens(trig);
  if (cores.length >= 2) {
    const inputTokens = koTokenSet(text);
    const hits = cores.filter(c => [...inputTokens].some(t => t.includes(c) || c.includes(t)));
    if (hits.length === cores.length) return { matched: trigger, index: 9999, quality: 0.72, length: compactTrig.length };
  }
  return null;
}

function koContains(text, trigger) {
  return !!findKoAliasMatch(text, trigger);
}

function bestKoAlias(text, aliases = []) {
  let best = null;
  for (const alias of aliases) {
    const m = findKoAliasMatch(text, alias);
    if (!m) continue;
    const score = (m.quality * 100) + Math.min(30, m.length);
    if (!best || score > best.score) best = { ...m, score };
  }
  return best;
}

function collectKoLexicalMatches(text) {
  const candidates = [];
  const add = (item, aliases, source) => {
    const m = bestKoAlias(text, aliases);
    if (!m) return;
    candidates.push({ item, matched:[m.matched], match:m, source,
      score:(item.priority || 50) + m.length * 2 + m.quality * 25 });
  };

  koConceptsDB.forEach(item => add(item, item.aliases || [], 'concept'));
  koTermsDB.forEach(item => add(item, item.ko || [], 'special'));
  generalWordsDB.forEach(item => add(item, item.ko || [], 'general'));

  candidates.sort((a,b) =>
    (a.match.index - b.match.index) ||
    (b.match.length - a.match.length) ||
    (b.score - a.score));

  // 같은 일본어 또는 짧은 표현이 긴 표현에 완전히 포함되면 중복 억제
  const selected = [];
  const seenJa = new Set();
  for (const c of candidates) {
    const ja = c.item.ja || '';
    if (!ja || seenJa.has(ja)) continue;
    const overlappingLonger = selected.some(s => {
      if (s.match.index === 9999 || c.match.index === 9999) return false;
      const s0=s.match.index, s1=s0+s.match.length, c0=c.match.index, c1=c0+c.match.length;
      return c0 >= s0 && c1 <= s1 && s.match.length >= c.match.length + 2;
    });
    if (overlappingLonger && c.source === 'general') continue;
    selected.push(c); seenJa.add(ja);
    if (selected.length >= 18) break;
  }
  return selected;
}

function collectKoGrammarMatches(text) {
  return koGrammarDB
    .map(item => {
      let best = null;
      for (const trigger of (item.ko || [])) {
        const m = findKoAliasMatch(text, trigger);
        if (m && (!best || m.quality*100+m.length > best.quality*100+best.length)) best=m;
      }
      return best ? { item, matched:[best.matched], match:best,
        score:(item.priority || 50) + best.length + best.quality*20 } : null;
    })
    .filter(Boolean)
    // v0.13: 점수순이 아니라 실제 한국어 발화에서 등장한 순서가 1순위.
    // 같은 위치에서만 더 길고 우선도가 높은 문법을 먼저 보여준다.
    .sort((a,b)=>(a.match.index-b.match.index) || (b.match.length-a.match.length) || (b.score-a.score))
    .slice(0,16);
}

function collectKoNaturalMatches(text) {
  return koNaturalDB
    .map(item => {
      const m=bestKoAlias(text,item.triggers||[]);
      return m ? {item,matched:[m.matched],match:m,score:(item.priority||50)+m.length+m.quality*20} : null;
    })
    .filter(Boolean)
    .sort((a,b)=>b.score-a.score)
    .slice(0,5);
}

function rangesOverlap(a0, a1, b0, b1) {
  return Math.max(a0,b0) < Math.min(a1,b1);
}

function buildKoAssembly(text, lexicalMatches, grammarMatches) {
  // v0.13 핵심: "좋아 보이는 단어 나열"이 아니라 실제 한국어 원문의 위치를 따라간다.
  // 위치를 특정할 수 없는 fuzzy 의미 매칭(index=9999)은 단어 힌트에는 남기되 조립선에서는 제외한다.
  const candidates=[];
  lexicalMatches.forEach(x=>{
    if (x.match.index === 9999 || x.match.quality < 0.80) return;
    candidates.push({
      kind:'word', index:x.match.index, end:x.match.index+x.match.length,
      score:x.score, length:x.match.length, source:x.matched[0], ja:x.item.ja,
      meaning:x.item.meaning || '', category:x.item.category || x.item.type || x.item.pos || '',
      sourceRank:x.source==='special'?4:x.source==='concept'?3:2
    });
  });
  grammarMatches.forEach(x=>{
    if (x.match.index === 9999 || x.match.quality < 0.80) return;
    candidates.push({
      kind:'grammar', index:x.match.index, end:x.match.index+x.match.length,
      score:x.score, length:x.match.length, source:x.matched[0], ja:x.item.ja,
      meaning:x.item.meaning || '', category:'문법', sourceRank:3
    });
  });

  // 같은 위치라면 긴 구/표현을 우선. "장애" + "장애인" + "장애인종합복지관" 중 긴 표현 하나를 남긴다.
  candidates.sort((a,b)=>(a.index-b.index) || (b.length-a.length) || (b.sourceRank-a.sourceRank) || (b.score-a.score));
  const selected=[];
  for (const c of candidates) {
    let consumed=false;
    for (let i=0;i<selected.length;i++) {
      const s=selected[i];
      if (!rangesOverlap(c.index,c.end,s.index,s.end)) continue;
      const cContains = c.index<=s.index && c.end>=s.end;
      const sContains = s.index<=c.index && s.end>=c.end;
      if (cContains && (c.length>s.length || c.score>s.score+8)) {
        selected[i]=c;
      }
      // 일부만 겹치는 경우에도 더 짧은 일반어/문법 조각을 반복해서 보여주지 않는다.
      consumed=true; break;
    }
    if (!consumed) selected.push(c);
  }

  selected.sort((a,b)=>(a.index-b.index) || (b.length-a.length));
  const seen=new Set(), result=[];
  for (const n of selected) {
    const key=n.index+'|'+n.end+'|'+n.ja;
    if (seen.has(key)) continue;
    seen.add(key); result.push(n);
    if (result.length>=16) break;
  }
  return result;
}

function renderKoAssembly(assembly, lexicalMatches, grammarMatches) {
  if (!koAssemblyResultEl) return;
  if (!assembly.length) {
    koAssemblyResultEl.innerHTML='<p class="empty-message">원문 위치를 확인할 수 있는 조립 표현을 아직 찾지 못했습니다. 단어 힌트와 문법 카드는 계속 확인할 수 있습니다.</p>';
    lastLocalAssemblyHtml='';
    return;
  }

  const flow=assembly.map((n,i)=>`
    <div class="ordered-assembly-item ${n.kind}">
      <span class="order-no">${i+1}</span>
      <div class="ordered-body">
        <div class="ordered-src">${escapeHtml(n.source)} <span class="kind-tag">${n.kind==='grammar'?'문법':'표현'}</span></div>
        <div class="ordered-jp">${rubyJapaneseText(n.ja)}</div>
      </div>
    </div>`).join('');
  koAssemblyResultEl.innerHTML=`
    <div class="ordered-assembly-list">${flow}</div>
    <div class="assembly-note"><b>말한 순서 기준.</b> 한국어와 일본어의 기본 어순이 비슷한 점을 활용해 원문 위치대로 배치했습니다. 긴 표현이 잡히면 그 안의 짧은 단어·문법은 중복 표시하지 않습니다.</div>`;

  const leftFlow=assembly.slice(0,12).map((n,i)=>`${i?'<span>→</span>':''}<span class="chunk"><small>${i+1}</small> ${rubyJapaneseText(n.ja)}</span>`).join('');
  lastLocalAssemblyHtml=`<div class="local-assembly"><div class="local-assembly-title">LOCAL ORDER · 말한 순서 조립</div><div class="local-assembly-flow">${leftFlow}</div><div class="analysis-stats">원문 위치 기반 ${assembly.length}개 · 전체표현 ${lexicalMatches.length}개 · 문법후보 ${grammarMatches.length}개</div></div>`;
  if (localKoJaResultEl) localKoJaResultEl.innerHTML=lastLocalAssemblyHtml;
  if (koTranslationBadgeEl) koTranslationBadgeEl.textContent='말한 순서 조립';
}

function analyzeKoreanAssist(text) {
  if (!text || currentLang !== 'ko-KR') return;

  const lexicalMatches = collectKoLexicalMatches(text);
  const termMatches = lexicalMatches.filter(x => x.source === 'special' || x.source === 'concept').slice(0,10);
  const genericMatches = lexicalMatches.filter(x => x.source === 'general').slice(0,10);
  const grammarMatches = collectKoGrammarMatches(text);
  const naturalMatches = collectKoNaturalMatches(text);
  const assembly = buildKoAssembly(text, lexicalMatches, grammarMatches);

  lastKoAnalysis={text,lexicalMatches,grammarMatches,naturalMatches,assembly};
  renderKoTerms(termMatches, genericMatches);
  renderKoGrammar(grammarMatches);
  renderKoNatural(naturalMatches);
  renderKoAssembly(assembly, lexicalMatches, grammarMatches);

  const count = lexicalMatches.length + grammarMatches.length + naturalMatches.length;
  const conceptCount=lexicalMatches.filter(x=>x.source==='concept').length;
  koAssistBadgeEl.textContent = count ? `추천 ${count}개 · 의미개념 ${conceptCount} · 문법 ${grammarMatches.length}` : '직접 매칭 없음';
}

function renderKoTerms(matches, genericMatches = []) {
  const combined = [...matches, ...genericMatches];
  if (!combined.length) {
    koTermResultEl.innerHTML = '<p class="empty-message">직접 매칭되는 핵심 표현이 없습니다. 누적 발화 전체를 기준으로 다시 분석합니다.</p>';
    return;
  }

  const seen = new Set();
  const unique = combined.filter(x => {
    const key = x.item.ja + '|' + (x.item.meaning || '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b)=>(a.match.index-b.match.index) || (b.match.length-a.match.length) || (b.score-a.score)).slice(0,18);

  koTermResultEl.innerHTML = unique.map(({ item, matched, source }) => `
    <div class="ko-suggest-card ${source === 'general' ? 'general-suggest' : ''} ${source === 'concept' ? 'concept-suggest' : ''}">
      <div class="ko-source">${escapeHtml(matched[0])}${source==='concept'?'<span class="concept-tag">의미개념</span>':''}</div>
      <div class="ko-arrow">→</div>
      <div class="ko-ja">${rubyJapaneseText(item.ja)}</div>
      <div class="ko-meta"><span>${escapeHtml(item.category || item.type || item.pos || '일반어휘')}</span> ${escapeHtml(item.note || item.meaning || '')}</div>
    </div>
  `).join('');
}

function renderKoGrammar(matches) {
  if (!matches.length) {
    koGrammarResultEl.innerHTML = '<p class="empty-message">현재 문장에서 우선 추천할 문법 뼈대가 없습니다.</p>';
    return;
  }

  koGrammarResultEl.innerHTML = matches.map(({ item, matched },idx) => `
    <div class="ko-grammar-card ${idx<5?'primary-grammar':''}">
      <div class="ko-source small-source">${escapeHtml(matched[0])}${idx<5?'<span class="grammar-priority">우선</span>':''}</div>
      <div class="ko-grammar-ja">${rubyJapaneseText(item.ja)}</div>
      <div class="ko-grammar-meaning">${escapeHtml(item.meaning)}</div>
      <div class="ko-nuance">${escapeHtml(item.nuance)}</div>
      <div class="ko-example">예: ${rubyJapaneseText(item.example)}</div>
    </div>
  `).join('');
}

function renderKoNatural(matches) {
  if (!matches.length) {
    koNaturalResultEl.innerHTML = '<p class="empty-message">특별한 직역 주의 표현이 감지되지 않았습니다.</p>';
    return;
  }

  koNaturalResultEl.innerHTML = matches.map(({ item, matched }) => `
    <div class="natural-card">
      <div class="natural-head">💡 ${escapeHtml(matched[0])}</div>
      <div class="natural-literal"><span>직역 주의</span> ${rubyJapaneseText(item.literal)}</div>
      <div class="natural-recommend">
        ${item.recommended.map(x => `<span class="natural-chip">${rubyJapaneseText(x)}</span>`).join('')}
      </div>
      <div class="natural-reason">${escapeHtml(item.reason)}</div>
    </div>
  `).join('');
}

function normalizeKo(text) {
  return text
    .toLowerCase()
    .replace(/[?.!,~"'“”‘’(){}\[\]\s]/g, '')
    .replace(/합니다|합니까|하나요|인가요|있습니까|있나요|어떻게/g, '');
}

function ngrams(text, n = 2) {
  const s = normalizeKo(text);
  const set = new Set();

  for (let i = 0; i <= s.length - n; i++) {
    set.add(s.slice(i, i + n));
  }

  return set;
}

function diceSimilarity(a, b) {
  const A = ngrams(a);
  const B = ngrams(b);

  if (A.size === 0 || B.size === 0) return 0;

  let intersection = 0;

  for (const item of A) {
    if (B.has(item)) intersection++;
  }

  return (2 * intersection) / (A.size + B.size);
}

function scoreQuestion(text, item) {
  const candidates = [item.ko, ...(item.variants || [])];
  let bestTextScore = 0;

  for (const candidate of candidates) {
    bestTextScore = Math.max(bestTextScore, diceSimilarity(text, candidate));
  }

  const keywords = item.keywords || [];
  let keywordHits = 0;
  let weightedHits = 0;
  for (const keyword of keywords) {
    if (koContains(text, keyword)) {
      keywordHits++;
      weightedHits += Math.min(2.0, Math.max(0.7, normalizeKoAssist(keyword).length / 4));
    }
  }
  const keywordScore = keywords.length > 0 ? keywordHits / keywords.length : 0;
  const semanticBoost = Math.min(1, weightedHits / Math.max(2, keywords.length));
  return (bestTextScore * 0.48) + (keywordScore * 0.34) + (semanticBoost * 0.18);
}

function findSuggestedQuestions(text) {
  if (!text || questionsDB.length === 0) {
    interpretResultEl.innerHTML = '<p class="empty-message">한국어 발화를 인식하면 예상 통역문을 검색합니다.</p>';
    if (localKoJaResultEl && !lastLocalAssemblyHtml) localKoJaResultEl.innerHTML = '<p class="empty-message">한국어 발화를 인식하면 로컬 DB가 단어·문법을 조립해 표시합니다.</p>';
    return;
  }

  const ranked = questionsDB
    .map(item => ({ item, score: scoreQuestion(text, item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const best = ranked[0];

  if (!best || best.score < 0.17) {
    interpretResultEl.innerHTML = `
      <div class="no-match">준비된 예상문장 DB에서 충분히 비슷한 문장을 찾지 못했습니다. 오른쪽 단어·문법을 조립하거나 Gemini 보강을 사용하세요.</div>
    `;
    if (localKoJaResultEl && lastLocalAssemblyHtml && !(lastGeminiLang === 'ko-KR' && lastGeminiText === text)) {
      localKoJaResultEl.innerHTML = lastLocalAssemblyHtml;
    }
    return;
  }

  const candidates = ranked.filter(result => result.score >= 0.14);
  interpretResultEl.innerHTML = candidates.map((result, index) => {
    const item = result.item;
    const percent = Math.round(result.score * 100);
    return `
      <div class="interpret-card ${index === 0 ? 'best' : ''}">
        <div class="match-row"><span class="match-label">${index === 0 ? '가장 가까운 예상문장' : '다른 후보'}</span><span class="match-score">유사도 ${percent}%</span></div>
        <p class="source-ko">${escapeHtml(item.ko)}</p>
        <div class="jp-easy"><span class="mode-label">말하기 쉬움</span>${rubyJapaneseText(item.ja_easy)}</div>
        <div class="jp-formal"><span class="mode-label">공식 표현</span>${rubyJapaneseText(item.ja_formal)}</div>
      </div>`;
  }).join('');

  if (localKoJaResultEl && !(lastGeminiLang === 'ko-KR' && lastGeminiText === text)) {
    const percent = Math.round(best.score * 100);
    localKoJaResultEl.innerHTML = `${lastLocalAssemblyHtml || ''}
      <div class="local-match-addon">
        <div class="mini-label">가까운 예상문장 · 유사도 ${percent}%</div>
        <div class="ai-easy">${rubyJapaneseText(best.item.ja_easy)}</div>
        <div class="ai-formal">공식: ${rubyJapaneseText(best.item.ja_formal)}</div>
      </div>`;
    if (koTranslationBadgeEl) koTranslationBadgeEl.textContent = `로컬 조립 + 문장 ${percent}%`;
  }
}


function getGeminiKey() {
  return sessionStorage.getItem('takasukai_gemini_key') || localStorage.getItem('takasukai_gemini_key') || '';
}

function getGeminiModel() {
  return localStorage.getItem('takasukai_gemini_model') || sessionStorage.getItem('takasukai_gemini_model') || 'gemini-3.5-flash';
}

function updateGeminiStatus(message = '') {
  const key = getGeminiKey();
  geminiStatusEl.textContent = message || (key ? '연결 준비됨' : '미연결');
  geminiStatusEl.classList.toggle('connected', !!key && !message.includes('오류'));
}

function loadGeminiSettings() {
  const localKey = localStorage.getItem('takasukai_gemini_key') || '';
  const sessionKey = sessionStorage.getItem('takasukai_gemini_key') || '';
  geminiKeyEl.value = localKey || sessionKey;
  geminiPersistEl.checked = !!localKey;
  geminiModelEl.value = getGeminiModel();
  geminiAutoEl.checked = localStorage.getItem('takasukai_gemini_auto') === 'true';
  updateGeminiStatus();
}

function saveGeminiSettings() {
  const key = geminiKeyEl.value.trim();
  const model = geminiModelEl.value.trim() || 'gemini-3.5-flash';
  localStorage.setItem('takasukai_gemini_model', model);
  localStorage.setItem('takasukai_gemini_auto', String(geminiAutoEl.checked));
  sessionStorage.removeItem('takasukai_gemini_model');
  if (geminiPersistEl.checked) {
    localStorage.setItem('takasukai_gemini_key', key);
    sessionStorage.removeItem('takasukai_gemini_key');
  } else {
    localStorage.removeItem('takasukai_gemini_key');
    if (key) sessionStorage.setItem('takasukai_gemini_key', key);
    else sessionStorage.removeItem('takasukai_gemini_key');
  }
  updateGeminiStatus();
  geminiTestResultEl.textContent = key ? '설정을 저장했습니다.' : 'API 키를 비웠습니다.';
  geminiTestResultEl.className = 'test-result ok';
}

function stripJsonFence(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
}

async function geminiFetch(prompt, systemInstruction, overrideKey = '') {
  const key = overrideKey || getGeminiKey();
  if (!key) throw new Error('Gemini API 키가 없습니다.');
  const model = (geminiModelEl.value.trim() || getGeminiModel() || 'gemini-3.5-flash').replace(/^models\//,'');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.15, responseMimeType: 'application/json' }
    })
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).error?.message || ''; } catch (_) { detail = await response.text(); }
    throw new Error(`${response.status} ${detail || response.statusText}`.trim());
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
  if (!text) throw new Error('Gemini 응답 내용이 비어 있습니다.');
  return JSON.parse(stripJsonFence(text));
}

const GEMINI_SYSTEM_KO = `당신은 2026년 한국 사회복지법인과 일본 사회福祉法人의 공식 방문에서 한국 측 통역자를 보조하는 일본어 통역 코치다.
목표는 문학적 번역이 아니라 JLPT N2 수준 통역자가 즉시 말할 수 있는 자연스럽고 짧은 일본어를 제공하는 것이다.
한국의 제도명이나 기관명을 일본 제도명으로 임의 치환하지 말라. 특히 '발달장애인평생교육센터'를 生活介護 등으로 바꾸지 말고 기능을 설명하는 표현을 사용하라.
장문은 2~3개의 짧은 일본어 문장으로 나누어라. 지나친 경어와 장식적인 표현을 피하라.
복지 맥락에서는 本人の意思, 意思決定支援, 個別支援計画, 地域生活, 家族支援 등 일본 현장에서 자연스러운 용어를 사용하되 제도적 등치가 불확실하면 경고하라.
반드시 JSON만 출력한다.`;

const GEMINI_SYSTEM_JA = `당신은 일본 사회복지기관 방문 현장에서 일본 측 발언을 한국 측 통역자가 이해하도록 보조한다.
자연스러운 한국어 의미를 우선하되 원문의 핵심 정보, 조건, 주체, 부정, 비교를 빠뜨리지 말라.
사회복지 전문용어는 일본 제도상의 의미를 유지하고 한국 제도명으로 임의 치환하지 말라.
핵심 단어와 문법은 통역자가 듣는 즉시 이해할 수 있도록 짧게 설명하라.
반드시 JSON만 출력한다.`;

function buildGeminiPrompt(text, lang) {
  if (lang === 'ko-KR') return `다음 한국어 발화를 일본어 통역 보조용으로 분석하라.\n\n원문: ${text}\n\n다음 JSON 스키마를 정확히 지켜라:\n{
"support_ja":"통역자가 바로 말하기 쉬운 일본어 1~3문장",
"formal_ja":"필요할 때 참고할 조금 더 공식적인 일본어",
"readings":[{"word":"한자어","reading":"히라가나"}],
"words":[{"ko":"원문의 핵심 한국어","ja":"추천 일본어","reading":"읽기","note":"짧은 뉘앙스"}],
"grammar":[{"ko":"한국어 구조","ja":"일본어 문법/뼈대","meaning":"뜻","nuance":"현장 뉘앙스"}],
"natural":[{"ko":"직역 주의 표현","recommended":"자연스러운 일본어","reason":"이유"}],
"system_notes":["한일 제도 차이 또는 오역 주의가 있을 때만 작성"]
}\nwords는 최대 8개, grammar는 최대 5개, natural은 최대 3개로 제한하라.`;

  return `다음 일본어 발화를 한국어 통역 이해 보조용으로 분석하라.\n\n원문: ${text}\n\n다음 JSON 스키마를 정확히 지켜라:\n{
"translation_ko":"자연스럽고 정확한 한국어 번역",
"summary_ko":"한 줄 핵심 의미",
"keywords":[{"ja":"핵심 일본어","reading":"읽기","ko":"한국어 의미","type":"전문용어/동사/일반어"}],
"grammar":[{"ja":"문법/표현","ko":"뜻","nuance":"이 문장에서의 뉘앙스"}],
"system_notes":["일본 제도 용어 또는 오해 주의가 있을 때만 작성"]
}\nkeywords는 최대 8개, grammar는 최대 5개로 제한하라.`;
}

function rubyJapaneseTextWithExtra(text, readings = []) {
  if (!text) return '';
  const extras = (readings || []).map(x => Array.isArray(x) ? x : [x.word, x.reading]).filter(x => x[0] && x[1]);
  const merged = [...extras, ...readingsDB].sort((a,b) => b[0].length - a[0].length);
  let result = '', i = 0;
  while (i < text.length) {
    let matched = null;
    for (const [word, reading] of merged) {
      if (word && text.startsWith(word, i)) { matched = [word, reading]; break; }
    }
    if (matched) {
      result += `<ruby>${escapeHtml(matched[0])}<rt>${escapeHtml(matched[1])}</rt></ruby>`;
      i += matched[0].length;
    } else {
      result += escapeHtml(text[i]); i += 1;
    }
  }
  return result;
}

function renderGeminiResult(result, lang, text) {
  lastGeminiResult = result;
  lastGeminiText = text;
  lastGeminiLang = lang;
  if (lang === 'ja-JP') {
    aiJpKoResultEl.classList.remove('hidden');
    aiJpKoResultEl.innerHTML = `<span class="ai-label">✦ GEMINI 번역 보강</span><div>${escapeHtml(result.translation_ko || result.summary_ko || '')}</div>${result.summary_ko ? `<div class="ai-formal">핵심: ${escapeHtml(result.summary_ko)}</div>` : ''}`;
    const kws = (result.keywords || []).map(x => `<div class="ai-mini"><b>${x.reading ? `<ruby>${escapeHtml(x.ja)}<rt>${escapeHtml(x.reading)}</rt></ruby>` : escapeHtml(x.ja || '')}</b><span>${escapeHtml(x.ko || '')}${x.type ? ` · ${escapeHtml(x.type)}` : ''}</span></div>`).join('');
    const gr = (result.grammar || []).map(x => `<div class="ai-mini"><b>${escapeHtml(x.ja || '')}</b><span>${escapeHtml(x.ko || '')}${x.nuance ? ` · ${escapeHtml(x.nuance)}` : ''}</span></div>`).join('');
    const notes = (result.system_notes || []).map(x => `<div class="natural-card"><div class="natural-head">⚠️ 제도/오역 주의</div><div class="natural-reason">${escapeHtml(x)}</div></div>`).join('');
    aiJpHintsEl.innerHTML = `<div class="ai-section-title">✦ Gemini 추가 힌트</div><div class="ai-hint-grid">${kws}${gr}</div>${notes}`;
    aiJpHintsEl.classList.toggle('hidden', !(kws || gr || notes));
  } else {
    const readings = result.readings || [];
    aiKoJaResultEl.classList.remove('hidden');
    aiKoJaResultEl.innerHTML = `<span class="ai-label">✦ GEMINI 말하기 보조</span><div class="ai-easy">${rubyJapaneseTextWithExtra(result.support_ja || '', readings)}</div>${result.formal_ja ? `<div class="ai-formal">공식: ${rubyJapaneseTextWithExtra(result.formal_ja, readings)}</div>` : ''}`;
    if (koTranslationBadgeEl) koTranslationBadgeEl.textContent = 'Gemini 보강';
    const words = (result.words || []).map(x => `<div class="ai-mini"><b>${x.reading ? `<ruby>${escapeHtml(x.ja || '')}<rt>${escapeHtml(x.reading)}</rt></ruby>` : escapeHtml(x.ja || '')}</b><span>${escapeHtml(x.ko || '')}${x.note ? ` · ${escapeHtml(x.note)}` : ''}</span></div>`).join('');
    const grammar = (result.grammar || []).map(x => `<div class="ai-mini"><b>${escapeHtml(x.ja || '')}</b><span>${escapeHtml(x.meaning || x.ko || '')}${x.nuance ? ` · ${escapeHtml(x.nuance)}` : ''}</span></div>`).join('');
    const natural = (result.natural || []).map(x => `<div class="natural-card"><div class="natural-head">💡 ${escapeHtml(x.ko || '')}</div><div class="ko-ja">${rubyJapaneseTextWithExtra(x.recommended || '', readings)}</div><div class="natural-reason">${escapeHtml(x.reason || '')}</div></div>`).join('');
    const notes = (result.system_notes || []).map(x => `<div class="natural-card"><div class="natural-head">⚠️ 제도/오역 주의</div><div class="natural-reason">${escapeHtml(x)}</div></div>`).join('');
    aiKoHintsEl.innerHTML = `<div class="ai-section-title">✦ Gemini 추가 추천</div><div class="ai-hint-grid">${words}${grammar}</div>${natural}${notes}`;
    aiKoHintsEl.classList.toggle('hidden', !(words || grammar || natural || notes));
  }
}

async function runGeminiAnalysis(text = '', lang = currentLang, force = false) {
  const targetText = (text || currentUtterance?.text || '').trim();
  if (!targetText) { log('Gemini 분석할 확정 발화가 없습니다.'); return; }
  if (!getGeminiKey()) {
    updateGeminiStatus('API 키 필요');
    if (geminiDialogEl.showModal) geminiDialogEl.showModal();
    return;
  }
  if (geminiBusy) return;
  if (!force && targetText === lastGeminiText && lang === lastGeminiLang) return;
  geminiBusy = true;
  updateGeminiStatus('분석 중…');
  try {
    const result = await geminiFetch(buildGeminiPrompt(targetText, lang), lang === 'ko-KR' ? GEMINI_SYSTEM_KO : GEMINI_SYSTEM_JA);
    renderGeminiResult(result, lang, targetText);
    updateGeminiStatus('연결됨');
    log(`Gemini 분석 완료 (${lang})`);
  } catch (err) {
    updateGeminiStatus('오류');
    log(`Gemini 오류: ${err.message}`);
    const target = lang === 'ko-KR' ? aiKoHintsEl : aiJpHintsEl;
    target.classList.remove('hidden');
    target.innerHTML = `<div class="ai-section-title">Gemini 오류</div><div class="empty-message">${escapeHtml(err.message)} · 로컬 DB 기능은 계속 사용할 수 있습니다.</div>`;
  } finally {
    geminiBusy = false;
  }
}

function clearStaleGeminiPanels(text, lang) {
  if (text === lastGeminiText && lang === lastGeminiLang) return;
  if (lang === 'ja-JP') {
    aiJpKoResultEl.classList.add('hidden');
    aiJpHintsEl.classList.add('hidden');
  } else {
    aiKoJaResultEl.classList.add('hidden');
    aiKoHintsEl.classList.add('hidden');
    if (koTranslationBadgeEl) koTranslationBadgeEl.textContent = '로컬 + AI';
  }
}

function scheduleGeminiAnalysis(text, lang) {
  clearTimeout(geminiDebounceTimer);
  if (!geminiAutoEl.checked || !getGeminiKey() || !text) return;
  geminiDebounceTimer = setTimeout(() => runGeminiAnalysis(text, lang, false), 2600);
}

async function testGeminiConnection() {
  const key = geminiKeyEl.value.trim();
  if (!key) {
    geminiTestResultEl.textContent = 'API 키를 입력하세요.';
    geminiTestResultEl.className = 'test-result fail';
    return;
  }
  geminiTestResultEl.textContent = '연결 확인 중…';
  geminiTestResultEl.className = 'test-result';
  try {
    const result = await geminiFetch('JSON으로 {"ok":true}만 반환해 주세요.', '반드시 JSON만 출력한다.', key);
    if (result && result.ok === true) {
      geminiTestResultEl.textContent = '연결 성공';
      geminiTestResultEl.className = 'test-result ok';
    } else throw new Error('예상과 다른 응답');
  } catch (err) {
    geminiTestResultEl.textContent = `연결 실패: ${err.message}`;
    geminiTestResultEl.className = 'test-result fail';
  }
}

function searchDictionary(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    dictionarySearchResultEl.innerHTML = '<p class="empty-message">한국어 또는 일본어로 검색할 수 있습니다.</p>';
    return;
  }
  const hits = [];
  for (const item of generalWordsDB) {
    const ko = (item.ko || []).join(' ') + ' ' + (item.meaning || '');
    if ((item.ja || '').toLowerCase().includes(q) || ko.toLowerCase().includes(q) || (item.reading || '').includes(q)) hits.push(item);
  }
  for (const item of termsDB) {
    if ((item.keyword || '').includes(q) || (item.meaning || '').toLowerCase().includes(q) || (item.reading || '').includes(q)) {
      hits.push({ja:item.keyword, reading:item.reading, meaning:item.meaning, category:'복지 전문용어', priority:110});
    }
  }
  const unique=[]; const seen=new Set();
  for (const x of hits.sort((a,b)=>(b.priority||0)-(a.priority||0))) {
    const key=x.ja+'|'+x.meaning; if (seen.has(key)) continue; seen.add(key); unique.push(x); if(unique.length>=14) break;
  }
  if (!unique.length) {
    dictionarySearchResultEl.innerHTML = '<p class="empty-message">로컬 DB에서 찾지 못했습니다. Gemini가 연결되어 있다면 실제 발화 분석에서 보완할 수 있습니다.</p>';
    return;
  }
  dictionarySearchResultEl.innerHTML = unique.map(x => `<div class="search-hit"><div class="search-ja">${x.reading ? `<ruby>${escapeHtml(x.ja)}<rt>${escapeHtml(x.reading)}</rt></ruby>` : rubyJapaneseText(x.ja)}</div><div class="search-ko">${escapeHtml(x.meaning || '')}<br><small>${escapeHtml(x.category || '')}</small></div></div>`).join('');
}

function renderCurrentUtterance() {
  if (!currentUtterance || !currentUtterance.segments.length) {
    currentFinalEl.textContent = '아직 확정된 발화가 없습니다.';
    segmentBadgeEl.textContent = '0조각';
    segmentListEl.innerHTML = '<p class="empty-message">확정된 인식 조각이 여기에 순서대로 남습니다.</p>';
    return;
  }

  segmentBadgeEl.textContent = `${currentUtterance.segments.length}조각${currentUtterance.committed ? ' · 기록됨' : ''}`;
  if (currentUtterance.lang === 'ja-JP') {
    currentFinalEl.innerHTML = rubyJapaneseText(currentUtterance.text);
  } else {
    currentFinalEl.textContent = currentUtterance.text;
  }

  segmentListEl.innerHTML = currentUtterance.segments.map((seg, idx) => {
    const body = currentUtterance.lang === 'ja-JP' ? rubyJapaneseText(seg.text) : escapeHtml(seg.text);
    return `<div class="segment-row"><span class="segment-no">${idx + 1}</span><span class="segment-text">${body}</span></div>`;
  }).join('');
}

function pushHistoryGroup(group) {
  if (!group || !group.text) return;
  recentHistory.unshift({
    text: group.text,
    lang: group.lang,
    segments: group.segments.map(x => ({ ...x })),
    time: group.startedTime || new Date().toLocaleTimeString()
  });
  recentHistory = recentHistory.slice(0, HISTORY_LIMIT);
  renderHistory();
}

function commitCurrentUtterance() {
  clearTimeout(utteranceCommitTimer);
  if (!currentUtterance || currentUtterance.committed || !currentUtterance.text) return;
  pushHistoryGroup(currentUtterance);
  currentUtterance.committed = true;
  renderCurrentUtterance();
}

function scheduleUtteranceCommit() {
  clearTimeout(utteranceCommitTimer);
  utteranceCommitTimer = setTimeout(() => {
    commitCurrentUtterance();
  }, MERGE_WINDOW_MS);
}

function startNewUtterance(lang) {
  currentUtterance = {
    lang,
    segments: [],
    text: '',
    startedTime: new Date().toLocaleTimeString(),
    lastFinalAt: 0,
    committed: false
  };
}

function appendFinalSegment(text, lang) {
  const cleaned = (text || '').trim();
  if (!cleaned) return '';

  const now = Date.now();
  const shouldStartNew = !currentUtterance ||
    currentUtterance.lang !== lang ||
    currentUtterance.committed ||
    (currentUtterance.lastFinalAt && now - currentUtterance.lastFinalAt > MERGE_WINDOW_MS);

  if (shouldStartNew) {
    if (currentUtterance && !currentUtterance.committed) commitCurrentUtterance();
    startNewUtterance(lang);
  }

  currentUtterance.segments.push({ text: cleaned, time: new Date().toLocaleTimeString() });
  currentUtterance.text = currentUtterance.segments.map(x => x.text).join(' ').replace(/\s+/g, ' ').trim();
  currentUtterance.lastFinalAt = now;
  currentUtterance.committed = false;
  renderCurrentUtterance();
  scheduleUtteranceCommit();
  return currentUtterance.text;
}

function forceUtteranceBoundary() {
  const finalText = currentUtterance?.text || '';
  const finalLang = currentUtterance?.lang || currentLang;
  commitCurrentUtterance();
  if (geminiAutoEl.checked && finalText) runGeminiAnalysis(finalText, finalLang, false);
  currentUtterance = null;
  clearTimeout(utteranceCommitTimer);
  renderCurrentUtterance();
  interimEl.textContent = '새 발화를 기다리는 중...';
  log('사용자가 발화 구분을 확정했습니다.');
}

function renderHistory() {
  if (recentHistory.length === 0) {
    recentHistoryEl.innerHTML =
      '<p class="empty-message">이전 발화가 없습니다. 끊어진 문장도 발화 묶음으로 보관됩니다.</p>';
    return;
  }

  recentHistoryEl.innerHTML = recentHistory.map((item, index) => {
    const speaker = item.lang === 'ja-JP' ? '🇯🇵 일본측' : '🇰🇷 한국측';
    const text = item.lang === 'ja-JP' ? rubyJapaneseText(item.text) : escapeHtml(item.text);
    const segmentDetails = (item.segments || []).length > 1 ? `
      <details class="history-segments">
        <summary>인식 조각 ${(item.segments || []).length}개 보기</summary>
        ${(item.segments || []).map((seg, i) => `<div class="history-segment"><b>${i+1}</b> ${item.lang === 'ja-JP' ? rubyJapaneseText(seg.text) : escapeHtml(seg.text)}</div>`).join('')}
      </details>` : '';

    return `
      <div class="history-item">
        <div class="history-meta-row">
          <div class="history-meta">${speaker} · ${item.time} · ${(item.segments || []).length || 1}조각</div>
          <button class="reanalyze-btn" data-history-index="${index}" type="button">다시 분석</button>
        </div>
        <div class="history-text">${text}</div>
        ${segmentDetails}
      </div>
    `;
  }).join('');
}

function analyzeHistoryItem(index) {
  const item = recentHistory[index];
  if (!item) return;
  currentLang = item.lang;
  setLanguageLabel();
  currentUtterance = {
    lang: item.lang,
    text: item.text,
    segments: (item.segments || [{ text: item.text, time: item.time }]).map(x => ({ ...x })),
    startedTime: item.time,
    lastFinalAt: Date.now(),
    committed: true
  };
  renderCurrentUtterance();
  analyzeCurrentText(item.text);
  if (item.lang === 'ko-KR') {
    analyzeKoreanAssist(item.text);
    findSuggestedQuestions(item.text);
  } else {
    translateJapanese(item.text);
  }
  scheduleGeminiAnalysis(item.text, item.lang);
  log(`기록 다시 분석: ${item.text}`);
}

async function requestWakeLock() {
  if (!wakeLockEl.checked) return;

  if (!('wakeLock' in navigator)) {
    log('Wake Lock API를 이 브라우저에서 사용할 수 없습니다.');
    return;
  }

  try {
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock.request('screen');
    log('화면 켜짐 유지 요청 성공');
  } catch (err) {
    log(`Wake Lock 실패: ${err.name} - ${err.message}`);
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
    } catch (_) {}
    wakeLock = null;
  }
}

function buildRecognition() {
  if (!SpeechRecognition) {
    supportEl.textContent = '지원되지 않음';
    setStatus('음성인식 API 미지원');
    return null;
  }

  const r = new SpeechRecognition();
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.lang = currentLang;

  r.onstart = () => {
    isRunning = true;
    setStatus('듣는 중 ●');
    log(`음성인식 시작 (${r.lang})`);
  };

  r.onspeechstart = () => {
    setStatus('말소리 감지 중 ●');
  };

  r.onspeechend = () => {
    setStatus('듣는 중 ●');
  };

  r.onresult = (event) => {
    let interim = '';
    let newFinal = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        newFinal += text;
      } else {
        interim += text;
      }
    }

    if (currentLang === 'ja-JP') {
      interimEl.innerHTML = interim ? rubyJapaneseText(interim) : '듣는 중...';
    } else {
      interimEl.textContent = interim || '듣는 중...';
    }

    if (interim) {
      const base = currentUtterance && currentUtterance.lang === currentLang && !currentUtterance.committed
        ? currentUtterance.text
        : '';
      const liveContext = `${base} ${interim}`.trim();
      analyzeCurrentText(liveContext);

      if (currentLang === 'ko-KR') {
        analyzeKoreanAssist(liveContext);
        findSuggestedQuestions(liveContext);
      } else {
        translateJapanese(liveContext);
      }
    }

    if (newFinal) {
      const combinedText = appendFinalSegment(newFinal, currentLang);
      clearStaleGeminiPanels(combinedText, currentLang);
      analyzeCurrentText(combinedText);

      if (currentLang === 'ko-KR') {
        analyzeKoreanAssist(combinedText);
        findSuggestedQuestions(combinedText);
      } else {
        translateJapanese(combinedText);
      }
      scheduleGeminiAnalysis(combinedText, currentLang);

      log(`최종 인식 조각: ${newFinal} / 누적: ${combinedText}`);
    }
  };

  r.onerror = (event) => {
    log(`오류: ${event.error}${event.message ? ' / ' + event.message : ''}`);

    if (event.error !== 'aborted') {
      setStatus(`오류: ${event.error}`);
    }

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      desiredListening = false;
    }
  };

  r.onend = () => {
    isRunning = false;
    log('음성인식 세션 종료');

    if (switchingLang && pendingLang) {
      currentLang = pendingLang;
      pendingLang = null;
      switchingLang = false;

      setLanguageLabel();
      log(`언어 전환 완료 -> ${currentLang}`);

      if (desiredListening) {
        setStatus('새 언어로 다시 시작 중...');
        restartRecognition(250);
      }
      return;
    }

    if (desiredListening && autoRestartEl.checked) {
      setStatus('자동 재시작 중...');
      restartRecognition(700);
    } else {
      setStatus('중지됨');
    }
  };

  return r;
}

function restartRecognition(delay = 300) {
  clearTimeout(restartTimer);

  restartTimer = setTimeout(() => {
    if (!desiredListening || isRunning || switchingLang) return;

    recognition = buildRecognition();
    if (!recognition) return;

    recognition.lang = currentLang;

    try {
      recognition.start();
    } catch (err) {
      log(`start() 실패: ${err.name} - ${err.message}`);
      setStatus('시작 실패 — 다시 눌러주세요');
    }
  }, delay);
}

async function startOrSwitch(lang) {
  if (currentLang !== lang && currentUtterance && !currentUtterance.committed) {
    commitCurrentUtterance();
    currentUtterance = null;
    renderCurrentUtterance();
  }
  desiredListening = true;
  await requestWakeLock();

  if (isRunning && currentLang === lang && !switchingLang) {
    log(`이미 ${lang}로 듣는 중`);
    return;
  }

  if (isRunning) {
    pendingLang = lang;
    switchingLang = true;
    setStatus('언어 전환 중...');
    log(`언어 전환 요청: ${currentLang} -> ${lang}`);

    try {
      recognition.stop();
    } catch (err) {
      log(`stop() 실패: ${err.name} - ${err.message}`);
    }
    return;
  }

  currentLang = lang;
  pendingLang = null;
  switchingLang = false;
  setLanguageLabel();
  restartRecognition(100);
}

async function stopListening() {
  commitCurrentUtterance();
  desiredListening = false;
  switchingLang = false;
  pendingLang = null;
  clearTimeout(restartTimer);

  if (recognition && isRunning) {
    try {
      recognition.stop();
    } catch (_) {}
  }

  await releaseWakeLock();
  interimEl.textContent = '중지됨';
  setStatus('중지됨');
  log('사용자가 음성인식을 중지했습니다.');
}

document.getElementById('ja-btn').addEventListener('click', () => startOrSwitch('ja-JP'));
document.getElementById('ko-btn').addEventListener('click', () => startOrSwitch('ko-KR'));
document.getElementById('stop-btn').addEventListener('click', stopListening);
forceBoundaryEl.addEventListener('click', forceUtteranceBoundary);
recentHistoryEl.addEventListener('click', (event) => {
  const btn = event.target.closest('.reanalyze-btn');
  if (!btn) return;
  analyzeHistoryItem(Number(btn.dataset.historyIndex));
});

document.getElementById('clear-history').addEventListener('click', () => {
  recentHistory = [];
  renderHistory();
});

document.getElementById('clear-log').addEventListener('click', () => {
  logEl.textContent = '';
});

wakeLockEl.addEventListener('change', async () => {
  if (wakeLockEl.checked && desiredListening) {
    await requestWakeLock();
  } else if (!wakeLockEl.checked) {
    await releaseWakeLock();
  }
});

document.getElementById('gemini-settings-btn').addEventListener('click', () => {
  loadGeminiSettings();
  if (geminiDialogEl.showModal) geminiDialogEl.showModal();
});
document.getElementById('gemini-save-btn').addEventListener('click', () => {
  saveGeminiSettings();
  setTimeout(() => { try { geminiDialogEl.close(); } catch (_) {} }, 250);
});
document.getElementById('gemini-test-btn').addEventListener('click', testGeminiConnection);
document.getElementById('gemini-analyze-btn').addEventListener('click', () => runGeminiAnalysis('', currentLang, true));
geminiAutoEl.addEventListener('change', () => {
  localStorage.setItem('takasukai_gemini_auto', String(geminiAutoEl.checked));
  if (geminiAutoEl.checked && currentUtterance?.text) scheduleGeminiAnalysis(currentUtterance.text, currentUtterance.lang);
});
document.getElementById('dictionary-search-btn').addEventListener('click', () => searchDictionary(dictionarySearchEl.value));
dictionarySearchEl.addEventListener('keydown', e => { if (e.key === 'Enter') searchDictionary(dictionarySearchEl.value); });
dictionarySearchEl.addEventListener('input', () => { if (dictionarySearchEl.value.trim().length >= 2) searchDictionary(dictionarySearchEl.value); });

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    log('페이지가 다시 화면에 표시됨');

    if (desiredListening && wakeLockEl.checked) {
      await requestWakeLock();
    }
  } else {
    log('페이지가 백그라운드/비표시 상태가 됨');
  }
});

if (SpeechRecognition) {
  supportEl.textContent = '지원됨';
  log('SpeechRecognition API 감지됨.');
} else {
  supportEl.textContent = '지원되지 않음';
  log('SpeechRecognition API를 찾지 못했습니다.');
}

loadGeminiSettings();
setLanguageLabel();
renderCurrentUtterance();
renderHistory();
loadData();
