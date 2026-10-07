(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
  const DIFF_LABEL = { 1: '易しい', 2: '普通', 3: '難しい' };
  const LEN_LABEL = { 1: '短い', 2: '普通', 3: '長い' };

  // ---------- 保存 ----------
  const store = {
    get(key, def) { try { const v = localStorage.getItem('tq.' + key); return v ? JSON.parse(v) : def; } catch { return def; } },
    set(key, val) { try { localStorage.setItem('tq.' + key, JSON.stringify(val)); } catch { /* 保存できない環境では無視 */ } },
  };
  let stats = store.get('stats', {});           // { id: { shown, correct } }
  let fav = new Set(store.get('fav', []));
  let weak = new Set(store.get('weak', []));
  let history = store.get('history', { plays: 0, answered: 0, correct: 0 });
  const saveMarks = () => { store.set('fav', [...fav]); store.set('weak', [...weak]); };
  const statOf = id => stats[id] || { shown: 0, correct: 0 };
  const rateOf = id => { const s = statOf(id); return s.shown ? s.correct / s.shown : null; };

  // ---------- 画面遷移 ----------
  function show(name) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    window.scrollTo(0, 0);
    if (name === 'home') renderHome();
    if (name === 'settings') renderSettings();
    if (name === 'list') renderList();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    if (b.dataset.go === 'home' && game && game.state !== 'over') endGame('quit', false);
    if (b.dataset.listfilter) $('#list-mark').value = b.dataset.listfilter;
    show(b.dataset.go);
  });
  $('#btn-howto').onclick = () => $('#howto').showModal();

  function renderHome() {
    const acc = history.answered ? Math.round(history.correct / history.answered * 100) : 0;
    const played = Object.keys(stats).length;
    $('#home-stats').innerHTML =
      `登録問題数 <b>${QUESTIONS.length}</b> 問 ・ プレイ回数 <b>${history.plays}</b> 回<br>` +
      `これまでの回答数 <b>${history.answered}</b> ・ 正答率 <b>${acc}%</b> ・ 出題済み <b>${played}</b> / ${QUESTIONS.length} 問`;
  }

  // ---------- 設定 ----------
  const defaultSettings = {
    mode: 'normal', time: 120, qtime: 20, lives: -1, misslimit: 0, count: 20, sound: 1,
    genres: QUESTIONS.map(q => q.category + '/' + q.genre).filter((v, i, a) => a.indexOf(v) === i),
    diff: [1, 2, 3], len: [1, 2, 3], srcFav: true, srcWeak: true, srcAuto: false, autoRate: 70,
  };
  let settings = Object.assign({}, defaultSettings, store.get('settings', {}));
  // 新しく追加されたジャンルは、保存済みの設定があっても最初は選択状態にする
  {
    const known = new Set(settings.knownGenres || settings.genres);
    defaultSettings.genres.forEach(g => { if (!known.has(g) && !settings.genres.includes(g)) settings.genres.push(g); });
    settings.knownGenres = defaultSettings.genres.slice();
  }

  function buildCatTree() {
    $('#cat-tree').innerHTML = CATEGORIES.map(c => {
      const count = QUESTIONS.filter(q => q.category === c).length;
      return `<div class="cat-box" data-cat="${esc(c)}">
        <label class="cat-title"><input type="checkbox" class="cat-check">${esc(c)}<small>${count}問</small></label>
        <div class="checks">${GENRES[c].map(g => {
          const n = QUESTIONS.filter(q => q.category === c && q.genre === g).length;
          return `<label><input type="checkbox" class="genre-check" value="${esc(c + '/' + g)}"><span>${esc(g)} (${n})</span></label>`;
        }).join('')}</div></div>`;
    }).join('');
  }
  buildCatTree();

  function syncCatChecks() {
    $$('.cat-box').forEach(box => {
      const gs = [...box.querySelectorAll('.genre-check')];
      const on = gs.filter(g => g.checked).length;
      const cc = box.querySelector('.cat-check');
      cc.checked = on === gs.length; cc.indeterminate = on > 0 && on < gs.length;
    });
  }

  function renderSettings() {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === settings.mode));
    $('#normal-options').hidden = settings.mode !== 'normal';
    $('#custom-options').hidden = settings.mode !== 'custom';
    $('#opt-time').value = settings.time; $('#opt-qtime').value = settings.qtime;
    $('#opt-lives').value = settings.lives; $('#opt-misslimit').value = settings.misslimit;
    $('#opt-count').value = settings.count; $('#opt-sound').value = settings.sound;
    $$('.genre-check').forEach(g => g.checked = settings.genres.includes(g.value));
    $$('#opt-diff input').forEach(i => i.checked = settings.diff.includes(+i.value));
    $$('#opt-len input').forEach(i => i.checked = settings.len.includes(+i.value));
    $('#src-fav').checked = settings.srcFav; $('#src-weak').checked = settings.srcWeak;
    $('#src-auto').checked = settings.srcAuto; $('#auto-rate').value = settings.autoRate;
    syncCatChecks();
    renderCustomList();
    updatePoolCount();
  }

  function readSettings() {
    settings.time = +$('#opt-time').value; settings.qtime = +$('#opt-qtime').value;
    settings.lives = +$('#opt-lives').value; settings.misslimit = +$('#opt-misslimit').value;
    settings.count = +$('#opt-count').value; settings.sound = +$('#opt-sound').value;
    settings.genres = $$('.genre-check').filter(g => g.checked).map(g => g.value);
    settings.diff = $$('#opt-diff input').filter(i => i.checked).map(i => +i.value);
    settings.len = $$('#opt-len input').filter(i => i.checked).map(i => +i.value);
    settings.srcFav = $('#src-fav').checked; settings.srcWeak = $('#src-weak').checked;
    settings.srcAuto = $('#src-auto').checked; settings.autoRate = +$('#auto-rate').value;
    store.set('settings', settings);
  }

  const autoWeakIds = () => QUESTIONS.filter(q => {
    const r = rateOf(q.id); return r !== null && r * 100 < settings.autoRate;
  }).map(q => q.id);

  function buildPool() {
    if (settings.mode === 'custom') {
      const ids = new Set();
      if (settings.srcFav) fav.forEach(id => ids.add(id));
      if (settings.srcWeak) weak.forEach(id => ids.add(id));
      if (settings.srcAuto) autoWeakIds().forEach(id => ids.add(id));
      return [...ids].map(id => byId[id]).filter(Boolean);
    }
    return QUESTIONS.filter(q => settings.genres.includes(q.category + '/' + q.genre)
      && settings.diff.includes(q.difficulty) && settings.len.includes(q.length));
  }

  function updatePoolCount() {
    const n = buildPool().length;
    const el = $('#pool-count');
    el.textContent = n ? `条件に合う問題：${n}問` : '条件に合う問題がありません';
    el.classList.toggle('bad', !n);
    $('#btn-start').disabled = !n;
    $('#cnt-fav').textContent = fav.size; $('#cnt-weak').textContent = weak.size;
    $('#cnt-auto').textContent = autoWeakIds().length;
  }

  function renderCustomList() {
    const ids = [...new Set([...fav, ...weak])].filter(id => byId[id]);
    $('#custom-list').innerHTML = ids.length ? ids.map(id => {
      const q = byId[id];
      return `<div class="custom-item"><div class="name">${esc(q.answer)} <small>${esc(q.category)} / ${esc(q.genre)} ― ${esc(q.question)}</small></div>${markButtons(id)}</div>`;
    }).join('') : '<p class="note">まだ登録されていません。問題一覧やリザルト画面で ★ / ⚠ を押して登録できます。</p>';
  }

  $('#screen-settings').addEventListener('change', e => {
    if (e.target.classList.contains('cat-check')) {
      e.target.closest('.cat-box').querySelectorAll('.genre-check').forEach(g => g.checked = e.target.checked);
    }
    syncCatChecks(); readSettings(); updatePoolCount();
  });
  $$('.tab').forEach(t => t.onclick = () => { readSettings(); settings.mode = t.dataset.mode; store.set('settings', settings); renderSettings(); });
  $('#cat-all').onclick = () => { $$('.genre-check').forEach(g => g.checked = true); syncCatChecks(); readSettings(); updatePoolCount(); };
  $('#cat-none').onclick = () => { $$('.genre-check').forEach(g => g.checked = false); syncCatChecks(); readSettings(); updatePoolCount(); };

  // ---------- お気に入り・苦手 ----------
  function markButtons(id) {
    return `<span class="marks"><button class="mark ${fav.has(id) ? 'on' : ''}" data-mark="fav" data-id="${esc(id)}" title="お気に入り">★</button>` +
      `<button class="mark ${weak.has(id) ? 'on' : ''}" data-mark="weak" data-id="${esc(id)}" title="苦手リスト">⚠</button></span>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mark]');
    if (!b) return;
    const set = b.dataset.mark === 'fav' ? fav : weak;
    const id = b.dataset.id;
    set.has(id) ? set.delete(id) : set.add(id);
    saveMarks();
    $$(`[data-mark="${b.dataset.mark}"]`).filter(x => x.dataset.id === id).forEach(x => x.classList.toggle('on', set.has(id)));
    if ($('#screen-settings').classList.contains('active')) { renderCustomList(); updatePoolCount(); }
    if ($('#screen-list').classList.contains('active') && ['fav', 'weak', 'custom'].includes($('#list-mark').value)) renderList();
  });

  // ---------- 効果音 ----------
  let audio;
  function beep(freq, dur, type = 'sine', vol = 0.06) {
    if (!settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(audio.destination);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.start(); o.stop(audio.currentTime + dur);
    } catch { /* 音が出せない環境では無視 */ }
  }

  // ---------- ゲーム ----------
  let game = null;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  $('#btn-start').onclick = () => { readSettings(); startGame(); };
  $('#btn-retry').onclick = () => startGame();

  function startGame() {
    const pool = shuffle(buildPool().slice());
    if (!pool.length) { show('settings'); return; }
    const queue = settings.count ? pool.slice(0, settings.count) : pool;
    game = {
      s: { ...settings }, queue, idx: -1, results: [], state: 'ready',
      elapsed: 0, last: 0, cur: null, keys: 0, miss: 0, wrong: 0, timer: null,
    };
    show('game');
    $('#game-ready').hidden = false; $('#game-main').hidden = true;
    $('#hud-time').textContent = game.s.time ? game.s.time.toFixed(1) : '∞';
    $('#hud-time').classList.remove('danger');
    $('#hud-num').textContent = `0/${queue.length}`;
    ['#hud-correct', '#hud-wrong', '#hud-miss'].forEach(s => $(s).textContent = 0);
    focusInput();
  }

  function begin() {
    if (!game || game.state !== 'ready') return;
    $('#game-ready').hidden = true; $('#game-main').hidden = false;
    game.last = performance.now();
    game.timer = setInterval(tick, 50);
    nextQuestion();
  }
  $('#game-ready').onclick = begin;

  // スマホなどタッチ端末だけ隠し入力欄にフォーカスしてキーボードを出す。
  // PC ではフォーカスしない（IME が文字を変換し始めて入力が乱れるのを防ぐ）
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  function focusInput() {
    const i = $('#hidden-input'); i.value = '';
    if (isTouch) i.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  $('#screen-game').addEventListener('click', e => { if (!e.target.closest('button')) focusInput(); });

  function nextQuestion() {
    game.idx++;
    if (game.idx >= game.queue.length) return endGame('done');
    const q = game.queue[game.idx];
    game.cur = { q, typer: new Romaji.Typer(q.reading), time: 0, miss: 0, keys: 0, hint: 0 };
    game.state = 'playing';
    $('#hud-num').textContent = `${game.idx + 1}/${game.queue.length}`;
    $('#q-cat').textContent = `${q.category} / ${q.genre}`;
    $('#q-diff').textContent = `${DIFF_LABEL[q.difficulty]}・${LEN_LABEL[q.length]}`;
    $('#q-lives').textContent = game.s.lives >= 0 ? `残りミス ${game.s.lives - game.wrong}` : '';
    $('#q-text').textContent = q.question;
    $('#feedback').textContent = ''; $('#feedback').className = 'feedback';
    renderAnswer();
  }

  function renderAnswer(reveal) {
    const { q, typer, hint } = game.cur;
    const kana = typer.kana;
    const quiz = !reveal; // 答えは正解・不正解が決まるまで伏せる
    $('#q-answer').textContent = quiz ? '？？？' : q.answer;
    const shown = Math.max(typer.kanaDone, hint);
    const kanaHtml = quiz
      ? `<span class="done">${esc(kana.slice(0, typer.kanaDone))}</span><span class="rest">${esc(kana.slice(typer.kanaDone, shown))}</span><span class="mask">${'○'.repeat(Math.max(0, kana.length - shown))}</span>`
      : `<span class="done">${esc(kana.slice(0, typer.kanaDone))}</span><span class="rest">${esc(kana.slice(typer.kanaDone))}</span>`;
    $('#q-kana').innerHTML = kanaHtml;
    $('#q-roma').innerHTML = `<span class="done">${esc(typer.typed)}</span>` + (quiz ? '<span class="rest">_</span>' : `<span class="rest">${esc(typer.remainingGuide())}</span>`);
  }

  function tick() {
    const now = performance.now();
    const dt = (now - game.last) / 1000;
    game.last = now;
    if (game.state !== 'playing') return;
    game.elapsed += dt;
    game.cur.time += dt;
    if (game.s.time) {
      const left = Math.max(0, game.s.time - game.elapsed);
      // 制限時間が0になっても、今の問題は正解するか回答時間が切れるまで続ける
      if (left <= 0 && !game.overtime) {
        game.overtime = true;
        $('#q-lives').textContent = '⏰ タイムアップ！この問題がラスト';
      }
      $('#hud-time').textContent = game.overtime ? 'ラスト' : left.toFixed(1);
      $('#hud-time').classList.toggle('danger', left <= 10);
    } else {
      $('#hud-time').textContent = game.elapsed.toFixed(1);
    }
    if (game.s.qtime) {
      const r = Math.max(0, 1 - game.cur.time / game.s.qtime);
      const bar = $('#qtimer-bar');
      bar.style.width = (r * 100) + '%';
      bar.classList.toggle('low', r < 0.25);
      if (r <= 0) finishQuestion('timeout');
    } else {
      $('#qtimer-bar').style.width = '100%';
    }
  }

  function onKey(ch) {
    if (!game) return;
    if (game.state === 'ready') { begin(); return; } // どのキーでもスタート
    if (game.state !== 'playing') return;
    const c = game.cur;
    if (c.typer.input(ch)) hit();
    else if (ch === ' ') return; // 不要なスペースはミスにしない
    else miss();
  }
  function hit() {
    const c = game.cur;
    c.keys++; game.keys++;
    beep(880, 0.04, 'square', 0.02);
    renderAnswer();
    if (c.typer.done) finishQuestion('ok');
  }
  function miss() {
    const c = game.cur;
    c.miss++; game.miss++;
    $('#hud-miss').textContent = game.miss;
    beep(160, 0.08, 'sawtooth', 0.04);
    const box = $('.answer-box'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    if (game.s.misslimit && c.miss > game.s.misslimit) finishQuestion('misslimit');
  }

  // 文字列での入力（スマホの日本語キーボードや IME の確定文字）。かな・答えの直接入力も受け付ける
  const norm = s => Romaji.toHiragana(s.normalize('NFKC').toLowerCase()).replace(/[\s・･]/g, '');
  function onText(str) {
    if (!game || !str) return;
    if (game.state === 'ready') { begin(); return; }
    if (game.state !== 'playing') return;
    const c = game.cur;
    const text = norm(str);
    if (!text) return;
    // 答えそのもの（漢字など）や残りの読みをまとめて入力した場合は正解
    if (text === norm(c.q.answer) || text === norm(c.typer.kana.slice(c.typer.pos))) {
      const rest = c.typer.kana.length - c.typer.pos;
      c.typer.typed += c.typer.kana.slice(c.typer.pos);
      c.typer.pos = c.typer.kana.length; c.typer.buf = '';
      c.keys += rest - 1; game.keys += rest - 1;
      hit();
      return;
    }
    for (const ch of text) {
      if (game.state !== 'playing') return;
      if (/[\x20-\x7e]/.test(ch)) onKey(ch);
      else if (c.typer.inputKana(ch)) hit();
      else miss();
    }
  }

  const RESULT_LABEL = { ok: '○ 正解', skip: '× スキップ', timeout: '× 時間切れ', misslimit: '× 誤タイプ超過' };

  function finishQuestion(result) {
    const c = game.cur;
    game.state = 'feedback';
    game.results.push({ q: c.q, result, time: c.time, miss: c.miss, keys: c.keys, hint: c.hint });
    const s = stats[c.q.id] = statOf(c.q.id);
    s.shown++; if (result === 'ok') s.correct++;
    store.set('stats', stats);
    history.answered++; if (result === 'ok') history.correct++;
    store.set('history', history);

    const ok = result === 'ok';
    if (!ok) game.wrong++;
    $('#hud-correct').textContent = game.results.filter(r => r.result === 'ok').length;
    $('#hud-wrong').textContent = game.wrong;
    const fb = $('#feedback');
    fb.className = 'feedback ' + (ok ? 'ok' : 'ng');
    fb.textContent = ok ? `正解！ (${c.time.toFixed(1)}秒)` : `${RESULT_LABEL[result]}　答え：${c.q.answer}（${c.q.reading}）`;
    renderAnswer(true);
    if (ok) { beep(1046, 0.12, 'sine', 0.06); setTimeout(() => beep(1568, 0.15, 'sine', 0.05), 90); }
    else beep(220, 0.25, 'triangle', 0.07);

    const livesOut = game.s.lives >= 0 && game.wrong > game.s.lives;
    setTimeout(() => {
      if (!game || game.state !== 'feedback') return;
      if (livesOut) endGame('lives');
      else if (game.overtime) endGame('time');
      else nextQuestion();
    }, ok ? 550 : 1400);
  }

  function skip() { if (game && game.state === 'playing') finishQuestion('skip'); }
  $('#btn-skip').onclick = () => { skip(); focusInput(); };
  $('#btn-hint').onclick = () => {
    if (!game || game.state !== 'playing') return;
    const c = game.cur;
    c.hint = Math.min(c.typer.kana.length, Math.max(c.hint, c.typer.kanaDone) + 1);
    renderAnswer(); focusInput();
  };
  $('#btn-quit').onclick = () => endGame('quit');

  // キー入力（物理キーボードは keydown、スマホなどは input イベントで受け取る）
  // 日本語入力（IME）がオンでも、押された物理キー（e.code）から英字を判定する
  const CODE_MAP = { Minus: '-', NumpadSubtract: '-', Period: '.', NumpadDecimal: '.', Comma: ',', Slash: '/', Space: ' ', Quote: "'" };
  function keyFromEvent(e) {
    if (e.key && e.key.length === 1) {
      const k = e.key.normalize('NFKC').toLowerCase();
      if (/^[\x20-\x7e]$/.test(k)) return k;
    }
    if (e.key === 'Process' || e.key === 'Unidentified' || (e.key && e.key.length === 1)) {
      let m;
      if ((m = /^Key([A-Z])$/.exec(e.code))) return m[1].toLowerCase();
      if ((m = /^(?:Digit|Numpad)(\d)$/.exec(e.code))) return m[1];
      if (CODE_MAP[e.code]) return CODE_MAP[e.code];
    }
    return null;
  }
  let keyDuringComposition = false;
  document.addEventListener('keydown', e => {
    if (!$('#screen-game').classList.contains('active') || !game) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); skip(); return; }
    if (e.key === 'Enter' && game.state === 'ready') { e.preventDefault(); begin(); return; }
    const ch = keyFromEvent(e);
    if (ch === null) return;
    e.preventDefault();
    if (e.isComposing || e.key === 'Process') keyDuringComposition = true;
    onKey(ch);
  });
  const hiddenInput = $('#hidden-input');
  let composing = false;
  hiddenInput.addEventListener('compositionstart', () => { composing = true; keyDuringComposition = false; });
  hiddenInput.addEventListener('compositionend', e => {
    composing = false;
    const v = e.data || hiddenInput.value; hiddenInput.value = '';
    if (keyDuringComposition) { keyDuringComposition = false; return; } // keydown で処理済み
    if ($('#screen-game').classList.contains('active')) onText(v);
  });
  hiddenInput.addEventListener('input', e => {
    if (composing || e.isComposing) return;
    const v = hiddenInput.value; hiddenInput.value = '';
    if ($('#screen-game').classList.contains('active')) onText(v);
  });

  function endGame(reason, toResult = true) {
    if (!game || game.state === 'over') return;
    clearInterval(game.timer);
    const unanswered = game.state === 'playing' ? game.cur : null;
    game.state = 'over';
    game.reason = reason;
    game.unanswered = unanswered && unanswered.keys + unanswered.miss > 0 ? unanswered : null;
    if (game.results.length) { history.plays++; store.set('history', history); }
    if (toResult) { renderResult(); show('result'); }
  }

  // ---------- リザルト ----------
  function renderResult() {
    const g = game, rs = g.results;
    const correct = rs.filter(r => r.result === 'ok').length;
    const answered = rs.length;
    const skips = rs.filter(r => r.result === 'skip').length;
    const typeTime = rs.reduce((a, r) => a + r.time, 0) + (g.unanswered ? g.unanswered.time : 0);
    const keys = g.keys, miss = g.miss;
    const kpm = typeTime > 0 ? Math.round(keys / typeTime * 60) : 0;
    const kps = typeTime > 0 ? (keys / typeTime).toFixed(2) : '0.00';
    const keyAcc = keys + miss ? (keys / (keys + miss) * 100).toFixed(1) : '0.0';
    const acc = answered ? (correct / answered * 100).toFixed(1) : '0.0';
    const avg = answered ? (rs.reduce((a, r) => a + r.time, 0) / answered).toFixed(1) : '0.0';
    const okTimes = rs.filter(r => r.result === 'ok').map(r => r.time);
    const fastest = okTimes.length ? Math.min(...okTimes).toFixed(1) : '-';
    const score = Math.round(correct * 100 + kpm * 2 - miss * 5);
    const reasons = { time: '⏰ 制限時間終了！', lives: '💥 ミスの上限に達しました', done: '🎉 全問終了！', quit: '中断しました' };
    $('#result-reason').textContent = reasons[g.reason] + `（${g.s.mode === 'custom' ? 'カスタム' : '通常'}モード）`;

    const stat = (label, val, unit = '', main = false) => `<div class="stat ${main ? 'main' : ''}"><small>${label}</small><b>${val}<span>${unit}</span></b></div>`;
    $('#result-stats').innerHTML = [
      stat('スコア', Math.max(0, score), '点', true),
      stat('時間内の回答数', answered, '問', true),
      stat('正解数', correct, `/ ${answered}`),
      stat('正答率', acc, '%', true),
      stat('タイプ速度', kpm, '打/分', true),
      stat('1秒あたり', kps, '打'),
      stat('誤タイプ数', miss, '回', true),
      stat('タイプ正確率', keyAcc, '%'),
      stat('正しい打鍵数', keys, '打'),
      stat('スキップ', skips, '問'),
      stat('平均回答時間', avg, '秒'),
      stat('最速正解', fastest, '秒'),
      stat('プレイ時間', g.elapsed.toFixed(1), '秒'),
    ].join('');

    const rows = rs.map((r, i) => resultRow(i + 1, r.q, r.result, r.time, r.miss, r.hint));
    if (g.unanswered) {
      const u = g.unanswered;
      rows.push(resultRow('-', u.q, 'unanswered', u.time, u.miss, u.hint));
    }
    $('#result-table').innerHTML = `<thead><tr><th>#</th><th>結果</th><th>答え（読み）</th><th>問題</th><th class="num">時間</th><th class="num">誤タイプ</th><th>登録</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="7">回答した問題はありません</td></tr>'}</tbody>`;
    $('#btn-addweak').disabled = !rs.some(r => r.result !== 'ok');
    $('#btn-addweak').textContent = '間違えた問題を苦手リストに追加';
  }
  function resultRow(n, q, result, time, miss, hint) {
    const label = result === 'unanswered' ? '― 未回答（終了時）' : RESULT_LABEL[result];
    const cls = result === 'ok' ? 'res-ok' : 'res-ng';
    return `<tr><td class="num">${n}</td><td class="${cls}">${label}${hint ? '<br><small>ヒント' + hint + '</small>' : ''}</td>
      <td class="ans">${esc(q.answer)}<small>${esc(q.reading)}</small></td><td class="q">${esc(q.question)}<br><small>${esc(q.category)} / ${esc(q.genre)}</small></td>
      <td class="num">${time.toFixed(1)}秒</td><td class="num">${miss}</td><td>${markButtons(q.id)}</td></tr>`;
  }
  $('#btn-addweak').onclick = () => {
    if (!game) return;
    game.results.filter(r => r.result !== 'ok').forEach(r => weak.add(r.q.id));
    saveMarks();
    renderResult();
    $('#btn-addweak').textContent = '✓ 苦手リストに追加しました';
  };

  // ---------- 問題一覧 ----------
  $('#list-cat').innerHTML += CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('');
  function fillGenres() {
    const c = $('#list-cat').value;
    const gs = c ? GENRES[c] : [...new Set(QUESTIONS.map(q => q.genre))];
    $('#list-genre').innerHTML = '<option value="">すべてのジャンル</option>' + gs.map(g => `<option>${esc(g)}</option>`).join('');
  }
  fillGenres();
  $('#list-cat').addEventListener('change', () => { fillGenres(); renderList(); });
  ['#list-genre', '#list-diff', '#list-mark', '#list-sort'].forEach(s => $(s).addEventListener('change', renderList));
  $('#list-search').addEventListener('input', renderList);

  const kanaKey = q => Romaji.toHiragana(q.reading);
  const collator = new Intl.Collator('ja');
  function renderList() {
    const text = Romaji.toHiragana($('#list-search').value.trim().toLowerCase());
    const cat = $('#list-cat').value, genre = $('#list-genre').value, diff = $('#list-diff').value;
    const mark = $('#list-mark').value, sort = $('#list-sort').value;
    let list = QUESTIONS.filter(q => {
      if (cat && q.category !== cat) return false;
      if (genre && q.genre !== genre) return false;
      if (diff && q.difficulty !== +diff) return false;
      if (mark === 'fav' && !fav.has(q.id)) return false;
      if (mark === 'weak' && !weak.has(q.id)) return false;
      if (mark === 'custom' && !fav.has(q.id) && !weak.has(q.id)) return false;
      if (mark === 'played' && !statOf(q.id).shown) return false;
      if (mark === 'unplayed' && statOf(q.id).shown) return false;
      if (text) {
        const hay = Romaji.toHiragana((q.answer + ' ' + q.reading + ' ' + q.question + ' ' + q.genre).toLowerCase());
        if (!hay.includes(text)) return false;
      }
      return true;
    });
    const catIdx = q => CATEGORIES.indexOf(q.category) * 100 + GENRES[q.category].indexOf(q.genre);
    const cmpKana = (a, b) => collator.compare(kanaKey(a), kanaKey(b));
    const sorters = {
      'kana': cmpKana,
      'kana-desc': (a, b) => cmpKana(b, a),
      'category': (a, b) => catIdx(a) - catIdx(b) || cmpKana(a, b),
      'diff': (a, b) => a.difficulty - b.difficulty || cmpKana(a, b),
      'diff-desc': (a, b) => b.difficulty - a.difficulty || cmpKana(a, b),
      'len': (a, b) => a.reading.length - b.reading.length || cmpKana(a, b),
      'played': (a, b) => statOf(b.id).shown - statOf(a.id).shown || cmpKana(a, b),
      'rate': (a, b) => (rateOf(a.id) ?? 2) - (rateOf(b.id) ?? 2) || statOf(b.id).shown - statOf(a.id).shown || cmpKana(a, b),
    };
    list.sort(sorters[sort]);
    $('#list-count').textContent = `${list.length} / ${QUESTIONS.length} 問`;
    $('#list-table').innerHTML = `<thead><tr><th>答え（読み）</th><th>問題</th><th>カテゴリ / ジャンル</th><th>難易度</th><th class="num">出題回数</th><th class="num">正解数</th><th class="num">正答率</th><th>登録</th></tr></thead><tbody>` +
      (list.map(q => {
        const s = statOf(q.id), r = rateOf(q.id);
        return `<tr><td class="ans">${esc(q.answer)}<small>${esc(q.reading)}</small></td><td class="q">${esc(q.question)}</td>
          <td>${esc(q.category)}<br><small>${esc(q.genre)}</small></td><td><span class="diff">${'★'.repeat(q.difficulty)}</span><br><small>${DIFF_LABEL[q.difficulty]}・${LEN_LABEL[q.length]}</small></td>
          <td class="num">${s.shown}</td><td class="num">${s.correct}</td><td class="num">${r === null ? '-' : Math.round(r * 100) + '%'}</td><td>${markButtons(q.id)}</td></tr>`;
      }).join('') || '<tr><td colspan="8">該当する問題がありません</td></tr>') + '</tbody>';
  }
  $('#btn-reset-stats').onclick = () => {
    if (!confirm('出題回数・正解数の記録をすべてリセットしますか？（★・⚠の登録は残ります）')) return;
    stats = {}; history = { plays: 0, answered: 0, correct: 0 };
    store.set('stats', stats); store.set('history', history);
    renderList();
  };

  show('home');
})();
