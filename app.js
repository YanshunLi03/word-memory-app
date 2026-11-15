const STORAGE_KEY = "wordnest-data-v1";
const DAY = 86400000;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
// 本地日期键（原实现用 UTC 日期，东八区每天 0-8 点会把打卡记到"昨天"，导致连续打卡断裂）
const localDateKey = date => {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const today = () => localDateKey(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const daysFromNow = n => new Date(Date.now() + n * DAY).toISOString();

const starterWords = [
  ["serendipity", "/ˌserənˈdɪpəti/", "意外发现美好事物的运气", "Finding that little café was pure serendipity.", "精选词汇"],
  ["resilient", "/rɪˈzɪliənt/", "有韧性的；能迅速恢复的", "Children are often more resilient than adults expect.", "精选词汇"],
  ["elaborate", "/ɪˈlæbərət/", "精心制作的；详尽的", "She gave us an elaborate explanation.", "精选词汇"],
  ["concise", "/kənˈsaɪs/", "简明的；简洁的", "Keep your answer clear and concise.", "工作英语"],
  ["deadline", "/ˈdedlaɪn/", "截止日期", "We need to meet the Friday deadline.", "工作英语"],
  ["negotiate", "/nɪˈɡoʊʃieɪt/", "谈判；协商", "They negotiated a better contract.", "工作英语"],
  ["itinerary", "/aɪˈtɪnəreri/", "旅行计划；行程", "I emailed you our travel itinerary.", "旅行英语"],
  ["souvenir", "/ˌsuːvəˈnɪr/", "纪念品", "I bought a small souvenir in Kyoto.", "旅行英语"],
  ["breathtaking", "/ˈbreθteɪkɪŋ/", "令人惊叹的", "The view from the mountain was breathtaking.", "旅行英语"],
  ["ubiquitous", "/juːˈbɪkwɪtəs/", "无处不在的", "Smartphones have become ubiquitous.", "精选词汇"],
  ["versatile", "/ˈvɜːrsətl/", "多才多艺的；用途广泛的", "This is a versatile tool for designers.", "精选词汇"],
  ["insight", "/ˈɪnsaɪt/", "洞察力；深刻见解", "The report offers valuable insight.", "工作英语"]
];

function initialData() {
  return {
    decks: ["精选词汇", "工作英语", "旅行英语"],
    words: starterWords.map((w, i) => ({
      id: uid() + i, word: w[0], phonetic: w[1], meaning: w[2], example: w[3], deck: w[4], tags: [],
      status: i < 3 ? "learning" : "new", interval: i < 3 ? i + 1 : 0, ease: 2.5,
      due: i < 3 ? daysFromNow(i - 2) : new Date().toISOString(), reviews: i < 3 ? 2 : 0, correct: i < 3 ? 1 : 0
    })),
    sessions: [],
    activity: {},
    settings: { dailyGoal: 10, voice: "en-US", autoSpeak: false, dark: false },
    xp: 0,
    bestStreak: 0
  };
}

let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || initialData();
let study = { mode: "flash", queue: [], index: 0, correct: 0, answered: false };
let selectedIds = new Set();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatDate(value) {
  const d = new Date(value);
  if (d <= new Date()) return "今天";
  const diff = Math.ceil((d - new Date()) / DAY);
  if (diff === 1) return "明天";
  return `${diff} 天后`;
}

function countToday() {
  return data.activity[today()] || 0;
}

function streak() {
  let n = 0;
  let cursor = new Date();
  if (!data.activity[today()]) cursor = new Date(Date.now() - DAY);
  while (data.activity[localDateKey(cursor)]) {
    n++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  data.bestStreak = Math.max(data.bestStreak || 0, n);
  return n;
}

function dueWords(deck = "all") {
  return data.words.filter(w => (deck === "all" || w.deck === deck) && new Date(w.due) <= new Date());
}

function wordStatus(word) {
  if (word.interval >= 21 || (word.reviews >= 5 && word.correct / word.reviews >= .8)) return "mastered";
  if (word.reviews > 0) return "learning";
  return "new";
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function escapeHtml(text = "") {
  return text.replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function navigate(view) {
  $$(".view").forEach(v => v.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  const titles = { dashboard: "学习总览", library: "我的单词库", study: "专注学习", stats: "学习统计", settings: "设置与数据" };
  $("#pageTitle").textContent = titles[view];
  $(".sidebar").classList.remove("open");
  if (view === "library") renderLibrary();
  if (view === "stats") renderStats();
  if (view === "settings") renderSettings();
  if (view === "dashboard") renderDashboard();
}

function fillDeckSelects() {
  const options = data.decks.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  $("#deckFilter").innerHTML = `<option value="all">全部词书</option>${options}`;
  $("#studyDeck").innerHTML = `<option value="all">全部词书</option>${options}`;
  $("#wordDeckInput").innerHTML = options;
}

function renderDashboard() {
  const daily = countToday();
  const target = data.settings.dailyGoal;
  const percent = Math.min(100, Math.round(daily / target * 100));
  const currentStreak = streak();
  $("#goalRing").style.setProperty("--progress", percent);
  $("#goalPercent").textContent = `${percent}%`;
  $("#dueCount").textContent = dueWords().length;
  $("#todayCount").textContent = daily;
  $("#streakCount").textContent = currentStreak;
  $("#sideStreak").textContent = `${currentStreak} 天`;
  $("#masteredCount").textContent = data.words.filter(w => wordStatus(w) === "mastered").length;
  $("#heroText").textContent = daily >= target ? "今日目标已完成，保持住这份节奏！" : `今天还差 ${target - daily} 个单词完成目标。`;

  let total = 0;
  const days = [...Array(7)].map((_, i) => {
    const date = new Date(Date.now() - (6 - i) * DAY);
    const key = localDateKey(date);
    const value = data.activity[key] || 0;
    total += value;
    return { label: "日一二三四五六"[date.getDay()], value };
  });
  const max = Math.max(...days.map(d => d.value), 1);
  $("#weekChart").innerHTML = days.map(d => `<div class="bar-group"><div class="bar" data-value="${d.value}" style="height:${Math.max(3, d.value / max * 100)}%"></div><span>周${d.label}</span></div>`).join("");
  $("#weekTotal").textContent = `共 ${total} 次`;

  $("#deckSummary").innerHTML = data.decks.map((deck, i) => {
    const words = data.words.filter(w => w.deck === deck);
    const mastered = words.filter(w => wordStatus(w) === "mastered").length;
    const p = words.length ? Math.round(mastered / words.length * 100) : 0;
    return `<div class="deck-row"><span class="deck-dot">${["A","B","C","D"][i % 4]}</span><div><b>${escapeHtml(deck)}</b><small>${words.length} 个单词 · ${mastered} 已掌握</small><div class="deck-progress"><i style="width:${p}%"></i></div></div><small>${p}%</small></div>`;
  }).join("") || `<p class="muted">还没有词书。</p>`;
  save();
}

function renderLibrary() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const deck = $("#deckFilter").value;
  const status = $("#statusFilter").value;
  const filtered = data.words.filter(w => {
    const matchText = !query || [w.word, w.meaning, w.example].some(x => x.toLowerCase().includes(query));
    const matchDeck = deck === "all" || w.deck === deck;
    const actual = wordStatus(w);
    const matchStatus = status === "all" || actual === status || (status === "due" && new Date(w.due) <= new Date());
    return matchText && matchDeck && matchStatus;
  });
  $("#wordCountLabel").textContent = `${filtered.length} 个单词`;
  $("#wordTable").innerHTML = filtered.map(w => {
    const statusMap = { new: "未学习", learning: "学习中", mastered: "已掌握" };
    const actual = wordStatus(w);
    return `<tr><td><input class="row-check" data-id="${w.id}" type="checkbox" ${selectedIds.has(w.id) ? "checked" : ""}></td><td><b>${escapeHtml(w.word)}</b><small>${escapeHtml(w.phonetic)}</small></td><td>${escapeHtml(w.meaning)}</td><td><span class="tag">${escapeHtml(w.deck)}</span></td><td><span class="status ${actual}">${statusMap[actual]}</span></td><td>${formatDate(w.due)}</td><td><div class="row-actions"><button data-speak="${w.id}" title="朗读">♪</button><button data-edit="${w.id}" title="编辑">✎</button><button data-delete="${w.id}" title="删除">×</button></div></td></tr>`;
  }).join("");
  $("#emptyLibrary").classList.toggle("hidden", filtered.length > 0);
}

function openWordDialog(id) {
  const word = data.words.find(w => w.id === id);
  $("#dialogTitle").textContent = word ? "编辑单词" : "添加新单词";
  $("#wordId").value = word?.id || "";
  $("#wordInput").value = word?.word || "";
  $("#phoneticInput").value = word?.phonetic || "";
  $("#meaningInput").value = word?.meaning || "";
  $("#exampleInput").value = word?.example || "";
  $("#wordDeckInput").value = word?.deck || data.decks[0];
  $("#tagsInput").value = word?.tags?.join(", ") || "";
  $("#wordDialog").showModal();
  setTimeout(() => $("#wordInput").focus(), 50);
}

function saveWord() {
  const id = $("#wordId").value;
  const fields = {
    word: $("#wordInput").value.trim(), phonetic: $("#phoneticInput").value.trim(), meaning: $("#meaningInput").value.trim(),
    example: $("#exampleInput").value.trim(), deck: $("#wordDeckInput").value,
    tags: $("#tagsInput").value.split(",").map(x => x.trim()).filter(Boolean)
  };
  if (id) Object.assign(data.words.find(w => w.id === id), fields);
  else data.words.unshift({ id: uid(), ...fields, status: "new", interval: 0, ease: 2.5, due: new Date().toISOString(), reviews: 0, correct: 0 });
  save();
  $("#wordDialog").close();
  renderLibrary();
  renderDashboard();
  toast(id ? "单词已更新" : "新单词已添加");
}

function speak(word) {
  if (!("speechSynthesis" in window)) return toast("当前浏览器不支持语音朗读");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = data.settings.voice;
  utterance.rate = .85;
  speechSynthesis.speak(utterance);
}

function buildStudyQueue() {
  const deck = $("#studyDeck").value;
  const limit = Number($("#studyLimit").value);
  const matches = data.words.filter(w => deck === "all" || w.deck === deck);
  const due = matches.filter(w => new Date(w.due) <= new Date());
  const later = matches.filter(w => new Date(w.due) > new Date());
  return [...due, ...later].slice(0, limit);
}

function startStudy() {
  study = { ...study, queue: buildStudyQueue(), index: 0, correct: 0, answered: false, started: Date.now() };
  if (!study.queue.length) return toast("这个词书还没有单词");
  $("#studySetup").classList.add("hidden");
  $("#studyDone").classList.add("hidden");
  $("#studySession").classList.remove("hidden");
  showStudyCard();
}

function showStudyCard() {
  const word = study.queue[study.index];
  study.answered = false;
  $("#studyCounter").textContent = `${study.index + 1} / ${study.queue.length}`;
  $("#studyProgress").style.width = `${study.index / study.queue.length * 100}%`;
  ["flash", "spell", "choice"].forEach(mode => $(`#${mode}Stage`).classList.toggle("hidden", mode !== study.mode));
  if (study.mode === "flash") {
    $("#cardDeck").textContent = word.deck;
    $("#cardWord").textContent = word.word;
    $("#cardPhonetic").textContent = word.phonetic;
    $("#cardMeaning").textContent = word.meaning;
    $("#cardExample").textContent = word.example;
    $("#cardAnswer").classList.add("hidden");
    $("#revealBtn").classList.remove("hidden");
    $("#ratingButtons").classList.add("hidden");
  }
  if (study.mode === "spell") {
    $("#spellMeaning").textContent = word.meaning;
    $("#spellExample").textContent = word.example.replace(new RegExp(word.word, "ig"), "______");
    $("#spellInput").value = "";
    $("#spellInput").disabled = false;
    $("#spellFeedback").textContent = "";
    $("#spellFeedback").className = "feedback";
    $("#checkSpellBtn").textContent = "检查答案";
    setTimeout(() => $("#spellInput").focus(), 50);
  }
  if (study.mode === "choice") {
    $("#choiceWord").textContent = word.word;
    $("#choicePhonetic").textContent = word.phonetic;
    const others = data.words.filter(w => w.id !== word.id).sort(() => Math.random() - .5).slice(0, 3).map(w => w.meaning);
    const options = [word.meaning, ...others].sort(() => Math.random() - .5);
    $("#choiceOptions").innerHTML = options.map(x => `<button>${escapeHtml(x)}</button>`).join("");
  }
  if (data.settings.autoSpeak) speak(word.word);
}

function reviewWord(word, rating) {
  const factors = { again: 0, hard: 1.2, good: 2.5, easy: 4 };
  word.reviews++;
  if (rating !== "again") word.correct++;
  word.ease = Math.max(1.3, word.ease + ({ again: -.2, hard: -.1, good: 0, easy: .15 }[rating]));
  word.interval = rating === "again" ? 0 : Math.max(1, Math.round((word.interval || 1) * factors[rating] * word.ease / 2.5));
  word.due = rating === "again" ? new Date(Date.now() + 60000).toISOString() : daysFromNow(word.interval);
  word.status = wordStatus(word);
  if (rating !== "again") study.correct++;
  data.activity[today()] = (data.activity[today()] || 0) + 1;
  data.xp += rating === "again" ? 2 : rating === "easy" ? 12 : 10;
  nextStudyCard();
}

function nextStudyCard() {
  study.index++;
  save();
  if (study.index >= study.queue.length) finishStudy();
  else showStudyCard();
}

function finishStudy() {
  const accuracy = Math.round(study.correct / study.queue.length * 100);
  data.sessions.unshift({ id: uid(), date: new Date().toISOString(), count: study.queue.length, correct: study.correct, mode: study.mode, duration: Math.max(1, Math.round((Date.now() - study.started) / 60000)) });
  data.sessions = data.sessions.slice(0, 100);
  save();
  $("#studySession").classList.add("hidden");
  $("#studyDone").classList.remove("hidden");
  $("#doneCount").textContent = study.queue.length;
  $("#doneAccuracy").textContent = `${accuracy}%`;
  $("#doneXp").textContent = study.correct * 10;
  $("#doneText").textContent = accuracy >= 80 ? "状态很好，记忆正在变得更牢固。" : "完成比完美更重要，下一轮会更熟悉。";
  renderDashboard();
}

function checkSpelling() {
  if (study.answered) return nextStudyCard();
  const word = study.queue[study.index];
  const answer = $("#spellInput").value.trim().toLowerCase();
  const correct = answer === word.word.toLowerCase();
  $("#spellFeedback").textContent = correct ? "正确！" : `正确答案：${word.word}`;
  $("#spellFeedback").classList.add(correct ? "good" : "bad");
  $("#spellInput").disabled = true;
  $("#checkSpellBtn").textContent = "下一个";
  study.answered = true;
  if (correct) study.correct++;
  recordQuizResult(word, correct);
}

function recordQuizResult(word, correct) {
  word.reviews++;
  if (correct) word.correct++;
  word.interval = correct ? Math.max(1, Math.round((word.interval || 1) * word.ease)) : 0;
  word.due = correct ? daysFromNow(word.interval) : new Date(Date.now() + 60000).toISOString();
  word.status = wordStatus(word); // 与闪卡模式保持一致：拼写/选择题也应推进掌握状态
  data.activity[today()] = (data.activity[today()] || 0) + 1;
  data.xp += correct ? 10 : 2;
  save();
}

function answerChoice(button) {
  if (study.answered) return;
  const word = study.queue[study.index];
  const correct = button.textContent === word.meaning;
  study.answered = true;
  if (correct) study.correct++;
  button.classList.add(correct ? "correct" : "wrong");
  if (!correct) [...button.parentElement.children].find(b => b.textContent === word.meaning).classList.add("correct");
  recordQuizResult(word, correct);
  setTimeout(nextStudyCard, 800);
}

function renderStats() {
  const reviews = data.words.reduce((sum, w) => sum + w.reviews, 0);
  const correct = data.words.reduce((sum, w) => sum + w.correct, 0);
  $("#totalReviews").textContent = reviews;
  $("#avgAccuracy").textContent = `${reviews ? Math.round(correct / reviews * 100) : 0}%`;
  $("#totalXp").textContent = data.xp;
  $("#bestStreak").textContent = data.bestStreak || streak();
  const counts = { new: 0, learning: 0, mastered: 0 };
  data.words.forEach(w => counts[wordStatus(w)]++);
  const total = data.words.length || 1;
  const meta = { mastered: ["已掌握", "var(--green)"], learning: ["学习中", "var(--blue)"], new: ["未学习", "var(--muted)"] };
  $("#masteryChart").innerHTML = Object.entries(meta).map(([key, [label, color]]) => `<div class="master-row"><span>${label}</span><div><i style="width:${counts[key] / total * 100}%;background:${color}"></i></div><b>${counts[key]}</b></div>`).join("");
  $("#heatmap").innerHTML = [...Array(91)].map((_, i) => {
    const key = localDateKey(new Date(Date.now() - (90 - i) * DAY));
    const value = data.activity[key] || 0;
    const level = value ? Math.min(4, Math.ceil(value / 4)) : 0;
    return `<span class="heat-cell" data-level="${level}" title="${key}: ${value} 次"></span>`;
  }).join("");
  const modeMap = { flash: "闪卡复习", spell: "拼写挑战", choice: "选择题" };
  $("#historyList").innerHTML = data.sessions.length ? data.sessions.slice(0, 8).map(s => `<div class="history-row"><div><b>${modeMap[s.mode]}</b><small>${new Date(s.date).toLocaleString("zh-CN")}</small></div><span>${s.count} 个单词</span><span>${Math.round(s.correct / s.count * 100)}% 正确</span><span>${s.duration} 分钟</span></div>`).join("") : `<p class="muted">完成第一轮学习后，记录会出现在这里。</p>`;
}

function renderSettings() {
  $("#dailyGoalInput").value = data.settings.dailyGoal;
  $("#voiceSelect").value = data.settings.voice;
  $("#autoSpeakInput").checked = data.settings.autoSpeak;
  $("#darkInput").checked = data.settings.dark;
  $("#deckManager").innerHTML = data.decks.map(d => `<div class="deck-manage-row"><span>${escapeHtml(d)} <small>(${data.words.filter(w => w.deck === d).length})</small></span><button data-remove-deck="${escapeHtml(d)}">删除</button></div>`).join("");
}

function updateSetting(key, value) {
  data.settings[key] = value;
  save();
  applyTheme();
  renderDashboard();
}

function applyTheme() {
  document.body.classList.toggle("dark", data.settings.dark);
  $("#themeBtn").textContent = data.settings.dark ? "☀" : "☾";
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const quote = value => `"${String(value || "").replaceAll('"', '""')}"`;
  const rows = [["word", "phonetic", "meaning", "example", "deck", "tags"], ...data.words.map(w => [w.word, w.phonetic, w.meaning, w.example, w.deck, w.tags.join("|")])];
  download(`wordnest-words-${today()}.csv`, "\ufeff" + rows.map(r => r.map(quote).join(",")).join("\n"), "text/csv");
}

function parseCsv(text) {
  const lines = text.replace(/^\ufeff/, "").trim().split(/\r?\n/);
  const parseLine = line => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map(m => (m[1] ?? m[2]).replaceAll('""', '"'));
  const headers = parseLine(lines.shift());
  return lines.map(line => Object.fromEntries(parseLine(line).map((v, i) => [headers[i], v])));
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    if (file.name.endsWith(".json")) data = JSON.parse(reader.result);
    else {
      const rows = parseCsv(reader.result);
      rows.forEach(r => {
        if (!data.decks.includes(r.deck)) data.decks.push(r.deck || "导入词书");
        data.words.push({ id: uid(), word: r.word, phonetic: r.phonetic, meaning: r.meaning, example: r.example, deck: r.deck || "导入词书", tags: (r.tags || "").split("|").filter(Boolean), interval: 0, ease: 2.5, due: new Date().toISOString(), reviews: 0, correct: 0 });
      });
    }
    save();
    fillDeckSelects();
    renderSettings();
    renderDashboard();
    toast("数据导入成功");
  };
  reader.readAsText(file);
}

function bindEvents() {
  $("#mainNav").addEventListener("click", e => e.target.closest("[data-view]") && navigate(e.target.closest("[data-view]").dataset.view));
  $$('[data-go]').forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));
  $("#menuBtn").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $("#themeBtn").addEventListener("click", () => updateSetting("dark", !data.settings.dark));
  ["#quickAddBtn", "#addWordBtn"].forEach(id => $(id).addEventListener("click", () => openWordDialog()));
  $("#wordForm").addEventListener("submit", e => { e.preventDefault(); saveWord(); });
  $$('[data-close]').forEach(b => b.addEventListener("click", () => $("#wordDialog").close()));
  ["#searchInput", "#deckFilter", "#statusFilter"].forEach(id => $(id).addEventListener("input", renderLibrary));
  $("#wordTable").addEventListener("click", e => {
    const id = e.target.dataset.edit || e.target.dataset.delete || e.target.dataset.speak;
    if (e.target.dataset.edit) openWordDialog(id);
    if (e.target.dataset.speak) speak(data.words.find(w => w.id === id).word);
    if (e.target.dataset.delete && confirm("确定删除这个单词吗？")) { data.words = data.words.filter(w => w.id !== id); save(); renderLibrary(); }
    if (e.target.classList.contains("row-check")) { e.target.checked ? selectedIds.add(id) : selectedIds.delete(id); }
  });
  $("#selectAllBtn").addEventListener("click", () => { $$(".row-check").forEach(c => selectedIds.add(c.dataset.id)); renderLibrary(); });
  $("#headCheck").addEventListener("change", e => { $$(".row-check").forEach(c => { c.checked = e.target.checked; e.target.checked ? selectedIds.add(c.dataset.id) : selectedIds.delete(c.dataset.id); }); });
  $("#deleteSelectedBtn").addEventListener("click", () => { if (selectedIds.size && confirm(`删除选中的 ${selectedIds.size} 个单词？`)) { data.words = data.words.filter(w => !selectedIds.has(w.id)); selectedIds.clear(); save(); renderLibrary(); } });
  $$(".mode-card").forEach(b => b.addEventListener("click", () => { $$(".mode-card").forEach(x => x.classList.remove("selected")); b.classList.add("selected"); study.mode = b.dataset.mode; }));
  $("#heroStudyBtn").addEventListener("click", () => { navigate("study"); setTimeout(startStudy, 0); });
  $("#startStudyBtn").addEventListener("click", startStudy);
  $("#exitStudyBtn").addEventListener("click", () => { $("#studySession").classList.add("hidden"); $("#studySetup").classList.remove("hidden"); });
  $("#revealBtn").addEventListener("click", () => { $("#cardAnswer").classList.remove("hidden"); $("#revealBtn").classList.add("hidden"); $("#ratingButtons").classList.remove("hidden"); });
  $("#ratingButtons").addEventListener("click", e => e.target.closest("[data-rating]") && reviewWord(study.queue[study.index], e.target.closest("[data-rating]").dataset.rating));
  $("#speakBtn").addEventListener("click", () => speak(study.queue[study.index].word));
  $("#checkSpellBtn").addEventListener("click", checkSpelling);
  $("#spellInput").addEventListener("keydown", e => { if (e.key === "Enter") checkSpelling(); });
  $("#choiceOptions").addEventListener("click", e => e.target.tagName === "BUTTON" && answerChoice(e.target));
  $("#studyAgainBtn").addEventListener("click", () => { $("#studyDone").classList.add("hidden"); $("#studySetup").classList.remove("hidden"); });
  document.addEventListener("keydown", e => { if (e.code === "Space" && !$("#studySession").classList.contains("hidden") && study.mode === "flash" && !$("#revealBtn").classList.contains("hidden")) { e.preventDefault(); $("#revealBtn").click(); } });
  $("#dailyGoalInput").addEventListener("change", e => updateSetting("dailyGoal", Number(e.target.value)));
  $("#voiceSelect").addEventListener("change", e => updateSetting("voice", e.target.value));
  $("#autoSpeakInput").addEventListener("change", e => updateSetting("autoSpeak", e.target.checked));
  $("#darkInput").addEventListener("change", e => updateSetting("dark", e.target.checked));
  $("#deckForm").addEventListener("submit", e => { e.preventDefault(); const name = $("#newDeckName").value.trim(); if (name && !data.decks.includes(name)) { data.decks.push(name); save(); fillDeckSelects(); renderSettings(); e.target.reset(); } });
  $("#deckManager").addEventListener("click", e => { const name = e.target.dataset.removeDeck; if (name && !data.words.some(w => w.deck === name)) { data.decks = data.decks.filter(d => d !== name); save(); fillDeckSelects(); renderSettings(); } else if (name) toast("请先移动或删除词书中的单词"); });
  $("#exportJsonBtn").addEventListener("click", () => download(`wordnest-backup-${today()}.json`, JSON.stringify(data, null, 2), "application/json"));
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#importFile").addEventListener("change", e => e.target.files[0] && importData(e.target.files[0]));
  $("#resetBtn").addEventListener("click", () => { if (confirm("确定恢复初始数据吗？当前数据会被覆盖。")) { data = initialData(); save(); location.reload(); } });
}

function init() {
  $("#todayLabel").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  fillDeckSelects();
  applyTheme();
  bindEvents();
  renderDashboard();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js");
}

init();
