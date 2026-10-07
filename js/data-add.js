// 問題を追加するための関数。data.js の後、追加の問題ファイル（data-it.js など）より前に読み込む。
// 形式は data.js と同じ： [ジャンル, 難易度(1:易 2:普 3:難), 問題文, 答え, 読み]
function addQuestions(category, list) {
  if (!CATEGORIES.includes(category)) CATEGORIES.push(category);
  GENRES[category] = GENRES[category] || [];
  for (const [genre, difficulty, question, answer, reading] of list) {
    const len = reading.length;
    QUESTIONS.push({
      id: category + ':' + answer,
      category, genre, difficulty, question, answer, reading,
      length: len <= 5 ? 1 : len <= 10 ? 2 : 3,
    });
    if (!GENRES[category].includes(genre)) GENRES[category].push(genre);
  }
}
