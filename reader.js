/* Sentence-first presentation. Original recognition and local analysis remain the source of truth. */
(() => {
  const $ = id => document.getElementById(id);
  const pane = document.querySelector('.pane-left');
  const speech = document.querySelector('.speech-card');
  const toolbar = document.createElement('div');
  toolbar.className = 'reader-toolbar';
  toolbar.innerHTML = `<div class="reader-switches">
    <button type="button" id="meaning-toggle" aria-pressed="true">한국어 뜻</button>
    <button type="button" id="ruby-toggle" aria-pressed="true">あ 후리가나</button>
    </div><div class="reader-actions">
    <button type="button" id="reader-copy" aria-label="원문 복사">복사</button>
    <button type="button" id="reader-zoom" aria-pressed="false">크게</button>
    <button type="button" id="reader-speak" aria-label="일본어 원문 듣기">듣기</button>
    </div>`;
  speech.before(toolbar);
  const card = document.createElement('div');
  card.className = 'sentence-card';
  speech.before(card);
  card.append(speech, $('translation-section'), $('ko-translation-section'));
  // Recognition fragments are diagnostic details, not part of the reading card.
  const segments = document.querySelector('.segment-details');
  pane.append(segments);
  const hints = document.createElement('section');
  hints.className = 'reader-hints';
  hints.innerHTML = `<div class="hint-heading"><h3>문장 속 표현</h3><span>누르면 자세히</span></div>
    <div id="reader-chips" class="reader-chips"></div>
    <div id="reader-alerts" class="reader-alerts" role="status"></div>`;
  card.after(hints);
  const feedback = document.createElement('p');
  feedback.id = 'reader-feedback';
  feedback.className = 'reader-feedback';
  feedback.setAttribute('role', 'status');
  toolbar.after(feedback);

  const extra = document.createElement('details');
  extra.className = 'reader-extra';
  extra.innerHTML = '<summary>번역팩 · 뉘앙스 · 전체 분석</summary>';
  const side = document.querySelector('.pane-right');
  side.before(extra);
  extra.append(side);

  // Keep advanced recording options reachable without crowding the first screen.
  const settings = document.createElement('details');
  settings.className = 'recording-options';
  settings.innerHTML = '<summary>음성인식 · AI 옵션</summary>';
  document.querySelector('.control-dock').append(settings);
  settings.append(document.querySelector('.status-strip'), document.querySelector('.option-strip'));

  const input = document.createElement('details');
  input.className = 'manual-input';
  input.innerHTML = `<summary>직접 입력 · 예문으로 살펴보기</summary>
    <form id="reader-input-form">
      <label for="reader-language">입력 언어</label>
      <select id="reader-language"><option value="ja-JP">일본어 → 한국어</option><option value="ko-KR">한국어 → 일본어</option></select>
      <label for="reader-input">통역할 문장</label>
      <textarea id="reader-input" rows="3" placeholder="문장을 입력하거나 아래 예문을 선택하세요." maxlength="3000"></textarea>
      <div class="manual-actions"><button type="button" id="example-ja" disabled>일본어 예문</button><button type="button" id="example-ko" disabled>한국어 예문</button><button type="submit" id="reader-analyze" disabled>문장 분석</button></div>
    </form>`;
  document.querySelector('.control-dock').after(input);

  const say = message => { feedback.textContent = message; };
  $('ruby-toggle').addEventListener('click', () => {
    const hidden = document.body.classList.toggle('hide-ruby');
    $('ruby-toggle').setAttribute('aria-pressed', String(!hidden));
  });
  $('meaning-toggle').addEventListener('click', () => {
    const hidden = pane.classList.toggle('hide-meaning');
    $('meaning-toggle').setAttribute('aria-pressed', String(!hidden));
  });
  $('reader-zoom').addEventListener('click', () => {
    const large = pane.classList.toggle('reader-large');
    $('reader-zoom').setAttribute('aria-pressed', String(large));
  });
  $('reader-copy').addEventListener('click', async () => {
    const text = currentUtterance?.text;
    if (!text) return say('복사할 발화를 먼저 입력하세요.');
    try { await navigator.clipboard.writeText(text); say('원문을 복사했습니다.'); }
    catch (_) { say('자동 복사를 사용할 수 없습니다. 문장을 길게 눌러 복사하세요.'); }
  });
  $('reader-speak').addEventListener('click', async () => {
    if (!currentUtterance?.text || currentUtterance.lang !== 'ja-JP') return say('일본어 원문을 입력하면 들을 수 있습니다.');
    if (!('speechSynthesis' in window)) return say('이 브라우저에서는 읽어주기를 사용할 수 없습니다.');
    // Stop the microphone first so that the app does not transcribe its own voice.
    if (desiredListening) await stopListening();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentUtterance.text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.85;
    utterance.onerror = () => say('읽어주기를 실행하지 못했습니다. 기기의 일본어 음성을 확인하세요.');
    speechSynthesis.speak(utterance);
    say('일본어 원문을 읽습니다. 녹음은 발언 버튼으로 다시 시작하세요.');
  });

  async function analyzeInput(text, lang) {
    if (!text.trim()) return say('분석할 문장을 입력하세요.');
    await stopListening();
    clearTimeout(geminiDebounceTimer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    commitCurrentUtterance();
    currentLang = lang;
    setLanguageLabel();
    startNewUtterance(lang);
    const full = appendFinalSegment(text, lang);
    clearStaleGeminiPanels(full, lang);
    analyzeCurrentText(full);
    if (lang === 'ja-JP') translateJapanese(full);
    else { analyzeKoreanAssist(full); findSuggestedQuestions(full); }
    // Manual examples use only local data, even when automatic AI is enabled.
    interimEl.textContent = '직접 입력 · 로컬 분석';
    setStatus('직접 입력');
    say('로컬 DB로 분석했습니다.');
    renderHints();
  }
  $('reader-input-form').addEventListener('submit', async event => {
    event.preventDefault();
    await analyzeInput($('reader-input').value, $('reader-language').value);
  });
  const examples = {
    'ja-JP': '利用者一人ひとりの希望や特性を踏まえて、個別支援計画を作成しています。',
    'ko-KR': '장애인의 전 생애를 동행하며 지속적인 변화를 통해 보통의 삶을 실현한다.'
  };
  for (const [id, lang] of [['example-ja', 'ja-JP'], ['example-ko', 'ko-KR']]) {
    $(id).addEventListener('click', async () => {
      $('reader-language').value = lang;
      $('reader-input').value = examples[lang];
      await analyzeInput(examples[lang], lang);
    });
  }

  function chip(kind, ja, ko, detail) {
    return `<details class="expression-chip"><summary><span class="chip-kind">${escapeHtml(kind)}</span><span lang="ja">${rubyJapaneseText(ja || '')}</span><span class="chip-meaning">${escapeHtml(ko || '')}</span></summary><div class="chip-detail">${detail || '추가 설명이 등록되지 않았습니다.'}</div></details>`;
  }
  function renderHints() {
    const isJa = currentLang === 'ja-JP';
    $('meaning-toggle').disabled = !isJa;
    $('reader-speak').disabled = !isJa;
    currentFinalEl.lang = isJa ? 'ja' : 'ko';
    $('reader-alerts').innerHTML = '';
    const chips = [];
    if (isJa) {
      for (const term of termsDB.filter(x => currentDetectedKeywords.has(x.keyword))) {
        chips.push(chip('복지', term.keyword, term.meaning, `관련 표현: ${relatedWithRuby(term.related || [])}`));
      }
      for (const item of grammarDB.filter(x => currentDetectedGrammar.has(x.display))) {
        chips.push(chip('문법', item.display, item.meaning, escapeHtml(item.tip || '')));
      }
      for (const key of currentDetectedGeneralWords) {
        const [ja, ko] = key.split('|');
        const item = generalWordsDB.find(x => x.ja === ja && x.meaning === ko);
        chips.push(chip('단어', ja, ko, escapeHtml(item?.category || '일반 어휘')));
      }
    } else if (lastKoAnalysis && currentUtterance && lastKoAnalysis.text === currentUtterance.text) {
      const analysis = lastKoAnalysis;
      for (const { item, matched } of analysis.packMatches) {
        const candidates = item.candidates || [];
        const detail = candidates.map(c => `<p><span lang="ja">${rubyJapaneseText(c.ja || '')}</span><small>${escapeHtml(c.label || '')} · ${escapeHtml(c.nuance || '')}</small></p>`).join('') + `<p>${escapeHtml(item.note || '')}</p>`;
        chips.push(chip('번역팩', candidates[0]?.ja, matched[0], detail));
      }
      for (const {item, matched} of analysis.grammarMatches) {
        chips.push(chip('문법', item.ja, matched[0], `${escapeHtml(item.meaning || '')}<p lang="ja">${rubyJapaneseText(item.example || '')}</p>`));
      }
      for (const {item, matched} of analysis.lexicalMatches.slice(0, 8)) {
        chips.push(chip('표현', item.ja, matched[0], escapeHtml(item.meaning || item.category || '')));
      }
      const missing = analysis.coverage.missing || [];
      const warnings = analysis.packMatches.filter(x => x.item.system);
      $('reader-alerts').innerHTML = (missing.length ? `<p>의미 확인 필요 · ${missing.map(x => escapeHtml(x.raw)).join(' / ')}<small>로컬 DB에서 강하게 연결하지 못한 표현입니다.</small></p>` : '') + warnings.map(({item}) => `<p>제도 차이 주의 · ${escapeHtml(item.note || item.system)}</p>`).join('') + analysis.naturalMatches.map(({item}) => `<p>표현 주의 · ${escapeHtml(item.reason || '')}</p>`).join('');
    }
    const target = $('reader-chips');
    const html = chips.length ? chips.slice(0, 6).join('') + (chips.length > 6
      ? `<details class="more-expressions"><summary>표현 ${chips.length - 6}개 더 보기</summary><div class="reader-chips">${chips.slice(6).join('')}</div></details>` : '')
      : '<p class="empty-message">발화를 입력하면 이곳에 단어와 문법이 모입니다.</p>';
    // Preserve opened explanations if analysis did not change.
    if (target.dataset.content !== html) { target.innerHTML = html; target.dataset.content = html; }
  }
  document.addEventListener('interpreter-analysis', renderHints);
  document.addEventListener('interpreter-ready', () => {
    for (const id of ['example-ja', 'example-ko', 'reader-analyze']) $(id).disabled = false;
    renderHints();
  });
  document.addEventListener('interpreter-load-error', () => say('데이터를 불러오지 못했습니다. 웹 주소 또는 로컬 서버에서 열고 새로고침하세요.'));
  // Re-render controls on mode changes, including history recall and microphone switching.
  new MutationObserver(renderHints).observe(document.body, {attributes: true, attributeFilter: ['data-language']});
  renderHints();
})();
