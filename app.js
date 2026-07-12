
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const el = {
    answered:$('answered'),accuracy:$('accuracy'),bestStreak:$('bestStreak'),level:$('level'),
    category:$('category'),difficulty:$('difficulty'),home:$('home'),quiz:$('quiz'),result:$('result'),
    qCategory:$('qCategory'),counter:$('counter'),progressBar:$('progressBar'),timer:$('timer'),
    question:$('question'),options:$('options'),feedback:$('feedback'),
    quit:$('quit'),score:$('score'),resultTitle:$('resultTitle'),resultText:$('resultText'),
    categoryBreakdown:$('categoryBreakdown'),again:$('again'),homeBtn:$('homeBtn'),insight:$('insight')
  };

  let QUESTIONS = [];
  try {
    const response = await fetch('questions.json', {cache:'no-store'});
    QUESTIONS = await response.json();
  } catch (error) {
    document.body.innerHTML = '<main class="app-shell"><section class="section-block"><h1>Kunde inte läsa frågebanken</h1><p>Öppna appen via GitHub Pages.</p></section></main>';
    return;
  }

  let stats;
  try { stats = JSON.parse(localStorage.getItem('pqa_v5_stats')); } catch (e) {}
  stats = stats || {answered:0,correct:0,bestStreak:0,wrong:{},byCategory:{},seen:[]};

  let round = [], index = 0, points = 0, streak = 0, answeredCurrent = false;
  let lastMode = 'normal', categoryScores = {}, timerId = null, secondsLeft = 60, finishedCount = 0;
  let advanceId = null;

  [...new Set(QUESTIONS.map(q => q.category))].sort().forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    el.category.appendChild(option);
  });

  function save() {
    localStorage.setItem('pqa_v5_stats', JSON.stringify(stats));
    renderStats();
  }

  function level() {
    if (stats.correct >= 800) return 'Quizorakel';
    if (stats.correct >= 500) return 'Allvetare';
    if (stats.correct >= 250) return 'Quizräv';
    if (stats.correct >= 80) return 'Pubtalang';
    return 'Pubnovis';
  }

  function renderStats() {
    el.answered.textContent = stats.answered;
    el.accuracy.textContent = stats.answered ? Math.round(stats.correct / stats.answered * 100) + '%' : '0%';
    el.bestStreak.textContent = stats.bestStreak;
    el.level.textContent = level();

    const categories = Object.entries(stats.byCategory)
      .filter(([, value]) => value.a >= 5)
      .map(([name, value]) => ({name, percent:Math.round(value.c / value.a * 100)}))
      .sort((a, b) => a.percent - b.percent);

    if (!categories.length) {
      el.insight.innerHTML = '<strong>Din quizprofil byggs upp</strong>Efter några rundor ser du ditt starkaste och svagaste område här.';
    } else {
      const weak = categories[0];
      const strong = categories[categories.length - 1];
      el.insight.innerHTML = '<strong>Din quizprofil</strong><span class="weak">Träna mer: ' + weak.name + ' (' + weak.percent + '%)</span><br>Starkast just nu: ' + strong.name + ' (' + strong.percent + '%)';
    }
  }

  function shuffle(array, seed = null) {
    const copy = [...array];
    let random = Math.random;
    if (seed !== null) {
      let state = seed >>> 0;
      random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function daySeed() {
    const d = new Date();
    return Number(String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'));
  }

  function show(target) {
    [el.home, el.quiz, el.result].forEach(section => section.classList.add('hidden'));
    target.classList.remove('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function filteredPool() {
    return QUESTIONS.filter(q =>
      (el.category.value === 'Alla' || q.category === el.category.value) &&
      (el.difficulty.value === 'Alla' || String(q.difficulty) === el.difficulty.value)
    );
  }

  function start(mode) {
    clearInterval(timerId);
    clearTimeout(advanceId);
    lastMode = mode;
    let pool = filteredPool();

    if (mode === 'weak') {
      const weak = pool.filter(q => stats.wrong[q.id]);
      if (weak.length >= 3) pool = weak;
    }

    const count = mode === 'bishops' ? 30 : mode === 'daily' ? 15 : 10;

    if (mode === 'daily') {
      pool = shuffle(pool, daySeed());
    } else {
      const unseen = pool.filter(q => !stats.seen.includes(q.id));
      pool = shuffle(unseen.length >= count ? unseen : pool);
    }

    round = pool.slice(0, Math.min(count, pool.length));
    index = 0;
    points = 0;
    streak = 0;
    categoryScores = {};
    secondsLeft = 60;
    finishedCount = 0;
    answeredCurrent = false;

    show(el.quiz);

    if (mode === 'quick') {
      el.timer.classList.remove('hidden');
      el.timer.textContent = '60 sek';
      timerId = setInterval(() => {
        secondsLeft--;
        el.timer.textContent = secondsLeft + ' sek';
        if (secondsLeft <= 0) {
          clearInterval(timerId);
          finish();
        }
      }, 1000);
    } else {
      el.timer.classList.add('hidden');
    }

    showQuestion();
  }

  function showQuestion() {
    clearTimeout(advanceId);
    if (index >= round.length) {
      finish();
      return;
    }

    answeredCurrent = false;
    const q = round[index];
    el.qCategory.textContent = q.category + ' · ' + ['', 'Lätt', 'Medel', 'Svår'][q.difficulty];
    el.counter.textContent = (index + 1) + ' av ' + round.length;
    el.progressBar.style.width = (index / round.length * 100) + '%';
    el.question.textContent = q.question;
    el.options.innerHTML = '';
    el.feedback.classList.add('hidden');

    q.options.forEach((text, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option';
      button.innerHTML = '<span class="answer-letter">' + ['A','B','C','D'][optionIndex] + '</span><span>' + text + '</span>';
      button.addEventListener('click', () => answer(optionIndex, button));
      el.options.appendChild(button);
    });
  }

  function answer(choice, button) {
    if (answeredCurrent) return;
    answeredCurrent = true;
    finishedCount++;

    const q = round[index];
    const buttons = [...el.options.querySelectorAll('.option')];
    buttons.forEach((item, itemIndex) => {
      item.disabled = true;
      if (itemIndex === q.answer) item.classList.add('correct');
    });

    stats.answered++;
    if (!stats.seen.includes(q.id)) {
      stats.seen.push(q.id);
      if (stats.seen.length > 800) stats.seen = stats.seen.slice(-800);
    }

    stats.byCategory[q.category] = stats.byCategory[q.category] || {a:0,c:0};
    stats.byCategory[q.category].a++;
    categoryScores[q.category] = categoryScores[q.category] || {a:0,c:0};
    categoryScores[q.category].a++;

    if (choice === q.answer) {
      points++;
      stats.correct++;
      streak++;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
      stats.byCategory[q.category].c++;
      categoryScores[q.category].c++;

      if (stats.wrong[q.id]) {
        stats.wrong[q.id]--;
        if (stats.wrong[q.id] <= 0) delete stats.wrong[q.id];
      }

      el.feedback.innerHTML = '<strong>Rätt!</strong> ' + q.explanation;
      if (navigator.vibrate) navigator.vibrate(25);
    } else {
      streak = 0;
      button.classList.add('wrong');
      stats.wrong[q.id] = (stats.wrong[q.id] || 0) + 1;
      el.feedback.innerHTML = '<strong>Inte riktigt.</strong> ' + q.explanation;
      if (navigator.vibrate) navigator.vibrate([20,40,20]);
    }

    save();
    el.feedback.classList.remove('hidden');

    advanceId = setTimeout(() => {
      index++;
      showQuestion();
    }, 1500);
  }

  function finish() {
    clearInterval(timerId);
    clearTimeout(advanceId);
    show(el.result);

    el.score.textContent = finishedCount ? Math.round(points / finishedCount * 100) + '%' : '0%';
    const percent = Math.round(points / Math.max(finishedCount,1) * 100);

    el.resultTitle.textContent =
      percent >= 90 ? 'Quizorakel i högform' :
      percent >= 70 ? 'Stark pubform' :
      percent >= 50 ? 'Stabil grund' :
      'Bra råmaterial';

    el.resultText.textContent =
      lastMode === 'daily'
        ? 'Dagens resultat är sparat. I morgon väntar en ny runda.'
        : percent >= 70
          ? 'Du hade varit en dyrbar lagkamrat i kväll.'
          : 'Felsvaren sparas och återkommer i repetitionsläget.';

    el.categoryBreakdown.innerHTML = '';
    Object.entries(categoryScores).forEach(([category, values]) => {
      const row = document.createElement('div');
      row.innerHTML = '<span>' + category + '</span><strong>' + values.c + '/' + values.a + '</strong>';
      el.categoryBreakdown.appendChild(row);
    });
  }

  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => start(button.dataset.mode));
  });

  el.quit.addEventListener('click', () => {
    clearInterval(timerId);
    clearTimeout(advanceId);
    show(el.home);
  });

  el.homeBtn.addEventListener('click', () => show(el.home));
  el.again.addEventListener('click', () => start(lastMode));

  renderStats();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
