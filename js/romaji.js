// ローマ字入力エンジン：かな読みに対して複数のローマ字表記（shi/si, tsu/tu, nn/n など）を受け付ける
(function () {
  const ONE = {
    'あ':['a'],'い':['i','yi'],'う':['u','wu','whu'],'え':['e'],'お':['o'],
    'か':['ka','ca'],'き':['ki'],'く':['ku','cu','qu'],'け':['ke'],'こ':['ko','co'],
    'さ':['sa'],'し':['shi','si','ci'],'す':['su'],'せ':['se','ce'],'そ':['so'],
    'た':['ta'],'ち':['chi','ti'],'つ':['tsu','tu'],'て':['te'],'と':['to'],
    'な':['na'],'に':['ni'],'ぬ':['nu'],'ね':['ne'],'の':['no'],
    'は':['ha'],'ひ':['hi'],'ふ':['fu','hu'],'へ':['he'],'ほ':['ho'],
    'ま':['ma'],'み':['mi'],'む':['mu'],'め':['me'],'も':['mo'],
    'や':['ya'],'ゆ':['yu'],'よ':['yo'],
    'ら':['ra'],'り':['ri'],'る':['ru'],'れ':['re'],'ろ':['ro'],
    'わ':['wa'],'を':['wo','o'],
    'が':['ga'],'ぎ':['gi'],'ぐ':['gu'],'げ':['ge'],'ご':['go'],
    'ざ':['za'],'じ':['ji','zi'],'ず':['zu'],'ぜ':['ze'],'ぞ':['zo'],
    'だ':['da'],'ぢ':['di','ji','zi'],'づ':['du','zu'],'で':['de'],'ど':['do'],
    'ば':['ba'],'び':['bi'],'ぶ':['bu'],'べ':['be'],'ぼ':['bo'],
    'ぱ':['pa'],'ぴ':['pi'],'ぷ':['pu'],'ぺ':['pe'],'ぽ':['po'],
    'ゔ':['vu','bu'],
    'ぁ':['xa','la'],'ぃ':['xi','li'],'ぅ':['xu','lu'],'ぇ':['xe','le'],'ぉ':['xo','lo'],
    'ゃ':['xya','lya'],'ゅ':['xyu','lyu'],'ょ':['xyo','lyo'],'ゎ':['xwa','lwa'],
    'っ':['xtu','ltu','xtsu','ltsu'],
    'ー':['-'],'、':[','],'。':['.'],'・':['/'],'　':[' '],
  };
  const TWO = {};
  const add = (k, v) => { TWO[k] = v; };
  // 拗音
  [['き','k'],['ぎ','g'],['に','n'],['ひ','h'],['び','b'],['ぴ','p'],['み','m'],['り','r']].forEach(([c, r]) => {
    add(c + 'ゃ', [r + 'ya']); add(c + 'ゅ', [r + 'yu']); add(c + 'ょ', [r + 'yo']);
    add(c + 'ぇ', [r + 'ye']); add(c + 'ぃ', [r + 'yi']);
  });
  add('しゃ',['sha','sya']); add('しゅ',['shu','syu']); add('しょ',['sho','syo']); add('しぇ',['she','sye']);
  add('ちゃ',['cha','tya','cya']); add('ちゅ',['chu','tyu','cyu']); add('ちょ',['cho','tyo','cyo']); add('ちぇ',['che','tye','cye']);
  add('じゃ',['ja','zya','jya']); add('じゅ',['ju','zyu','jyu']); add('じょ',['jo','zyo','jyo']); add('じぇ',['je','zye','jye']);
  add('ぢゃ',['dya','ja','zya','jya']); add('ぢゅ',['dyu','ju','zyu','jyu']); add('ぢょ',['dyo','jo','zyo','jyo']);
  add('ふぁ',['fa','fwa','hwa']); add('ふぃ',['fi','fyi','hwi']); add('ふぇ',['fe','fye','hwe']); add('ふぉ',['fo','fwo','hwo']); add('ふゅ',['fyu']);
  add('てぃ',['thi','ti']); add('でぃ',['dhi','di']); add('てゅ',['thu','tyu']); add('でゅ',['dhu','dyu']);
  add('とぅ',['twu']); add('どぅ',['dwu']);
  add('うぃ',['wi','whi']); add('うぇ',['we','whe']); add('うぉ',['who','wo']);
  add('ゔぁ',['va','ba']); add('ゔぃ',['vi','bi']); add('ゔぇ',['ve','be']); add('ゔぉ',['vo','bo']);
  add('つぁ',['tsa']); add('つぃ',['tsi']); add('つぇ',['tse']); add('つぉ',['tso']);
  add('くぁ',['qa','kwa']); add('くぃ',['qi']); add('くぇ',['qe']); add('くぉ',['qo','kwo']);
  add('ぐぁ',['gwa']); add('すぃ',['swi']); add('ずぃ',['zwi']);

  function toHiragana(s) {
    return s.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  }

  // 位置 i から始まる候補 [{len, roms}] を返す
  function candidates(kana, i) {
    const out = [];
    const ch = kana[i];
    if (ch === undefined) return out;
    if (/[a-z0-9.,\-+!?'/:;()&% ]/.test(ch)) return [{ len: 1, roms: [ch] }];
    if (ch === 'ん') {
      // 判定を優しくするため、後ろの文字に関係なく n 1回でも受け付ける（kinen → きんえん など）
      const next = kana[i + 1];
      const nextRoms = next === undefined ? [] : candidates(kana, i + 1).flatMap(c => c.roms);
      const nFirst = next === undefined || nextRoms.every(r => !/^[aiueony']/.test(r));
      return [{ len: 1, roms: nFirst ? ['n', 'nn', 'xn', "n'"] : ['nn', 'n', 'xn', "n'"] }];
    }
    if (ch === 'ー') {
      // 長音は「-」のほか、直前の母音でも入力できる（chiitaa → ちーたー）
      const roms = ['-'];
      const prev = kana[i - 1];
      const vowel = { 'ゃ': 'a', 'ゅ': 'u', 'ょ': 'o' }[prev] || ((ONE[prev] || [''])[0].match(/[aiueo]$/) || [])[0];
      if (vowel) roms.push(vowel);
      return [{ len: 1, roms }];
    }
    if (ch === 'っ') {
      const next = candidates(kana, i + 1);
      for (const c of next) {
        const dbl = c.roms.filter(r => /^[bcdfghjklmpqrstvwxyz]/.test(r) && !/^n/.test(r)).map(r => r[0] + r);
        c.roms.filter(r => r.startsWith('ch')).forEach(r => dbl.push('t' + r)); // matcha など
        if (dbl.length) out.push({ len: 1 + c.len, roms: dbl });
      }
      out.push({ len: 1, roms: ONE['っ'] });
      return out;
    }
    const two = kana.substr(i, 2);
    if (TWO[two]) out.push({ len: 2, roms: TWO[two] });
    if (ONE[ch]) out.push({ len: 1, roms: ONE[ch] });
    if (!out.length) out.push({ len: 1, roms: [ch] }); // 未知文字はそのまま
    return out;
  }

  class Typer {
    constructor(reading) {
      this.kana = toHiragana(reading).toLowerCase().replace(/\s/g, ' ');
      this.pos = 0; this.buf = ''; this.typed = '';
    }
    get done() { return this.pos >= this.kana.length; }
    // キーを処理し true(正) / false(誤) を返す
    input(key) {
      key = key.toLowerCase();
      if (this.done) return false;
      if (this._try(key)) return true;
      // バッファが完成した表記と一致していれば確定して次の位置で再試行（例：n → k）
      if (this.buf) {
        const cands = candidates(this.kana, this.pos);
        const exact = cands.find(c => c.roms.includes(this.buf));
        if (exact) {
          const save = [this.pos, this.buf];
          this.pos += exact.len; this.buf = '';
          if (!this.done && this._try(key)) return true;
          [this.pos, this.buf] = save;
        }
      }
      return false;
    }
    _try(key) {
      const nb = this.buf + key;
      const cands = candidates(this.kana, this.pos);
      const ok = cands.some(c => c.roms.some(r => r.startsWith(nb)));
      if (!ok) return false;
      this.buf = nb; this.typed += key;
      const exact = cands.find(c => c.roms.includes(nb));
      const longer = cands.some(c => c.roms.some(r => r.length > nb.length && r.startsWith(nb)));
      // 最後の文字は、完成した時点で確定する（末尾の「ん」は n 1回でよい）
      if (exact && (!longer || this.pos + exact.len >= this.kana.length)) { this.pos += exact.len; this.buf = ''; }
      return true;
    }
    // かなを直接入力（スマホの日本語キーボードなど）。一致すれば true
    inputKana(ch) {
      if (this.done || this.kana[this.pos] !== ch) return false;
      this.pos++; this.buf = ''; this.typed += ch;
      return true;
    }
    // 入力済みかなの文字数
    get kanaDone() { return this.pos; }
    // 残りの入力ガイド
    remainingGuide() {
      let s = '', i = this.pos, first = true;
      while (i < this.kana.length) {
        const cands = candidates(this.kana, i);
        let pick = null, rom = null;
        for (const c of cands) {
          const r = first && this.buf ? c.roms.find(x => x.startsWith(this.buf)) : c.roms[0];
          if (r) { pick = c; rom = r; break; }
        }
        if (!pick) { pick = cands[0]; rom = pick.roms[0]; }
        s += first && this.buf ? rom.slice(this.buf.length) : rom;
        i += pick.len; first = false;
      }
      return s;
    }
    // 全体のローマ字（目安）。文字数の計算に使う
    static guideOf(reading) { return new Typer(reading).remainingGuide(); }
  }

  window.Romaji = { Typer, toHiragana };
})();
