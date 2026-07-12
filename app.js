
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const el = {
    answered:$('answered'),accuracy:$('accuracy'),bestStreak:$('bestStreak'),level:$('level'),
    category:$('category'),difficulty:$('difficulty'),home:$('home'),quiz:$('quiz'),result:$('result'),
    qCategory:$('qCategory'),counter:$('counter'),progressBar:$('progressBar'),timer:$('timer'),
    question:$('question'),options:$('options'),feedback:$('feedback'),next:$('next'),
    quit:$('quit'),score:$('score'),resultTitle:$('resultTitle'),resultText:$('resultText'),
    categoryBreakdown:$('categoryBreakdown'),again:$('again'),homeBtn:$('homeBtn')
  };

  let QUESTIONS = [];
  try {
    const res = await fetch('questions.json');
    QUESTIONS = await res.json();
  } catch (err) {
    document.body.innerHTML = '<main class="app"><section class="card"><h1>Kunde inte läsa frågebanken</h1><p>Öppna appen via GitHub Pages, inte som en ensam lokal fil.</p></section></main>';
    return;
  }

  let stats;
  try { stats = JSON.parse(localStorage.getItem('pqa_v2_stats')) || null; } catch(e) {}
  stats = stats || {answered:0,correct:0,bestStreak:0,wrong:{},byCategory:{}};

  let round=[], idx=0, points=0, currentStreak=0, answered=false, lastMode='normal';
  let categoryScores={}, timerId=null, secondsLeft=60;

  [...new Set(QUESTIONS.map(q=>q.category))].sort().forEach(c=>{
    const o=document.createElement('option');o.value=c;o.textContent=c;el.category.appendChild(o);
  });

  function save(){ localStorage.setItem('pqa_v2_stats',JSON.stringify(stats)); renderStats(); }
  function level(){
    const n=stats.correct;
    if(n>=400)return 'Quizorakel';
    if(n>=250)return 'Allvetare';
    if(n>=120)return 'Quizräv';
    if(n>=40)return 'Pubtalang';
    return 'Pubnovis';
  }
  function renderStats(){
    el.answered.textContent=stats.answered;
    el.accuracy.textContent=stats.answered?Math.round(stats.correct/stats.answered*100)+'%':'0%';
    el.bestStreak.textContent=stats.bestStreak;
    el.level.textContent=level();
  }
  function shuffle(a){
    const x=[...a];
    for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}
    return x;
  }
  function show(target){[el.home,el.quiz,el.result].forEach(x=>x.classList.add('hidden'));target.classList.remove('hidden')}
  function pool(){
    return QUESTIONS.filter(q=>(el.category.value==='Alla'||q.category===el.category.value) &&
      (el.difficulty.value==='Alla'||String(q.difficulty)===el.difficulty.value));
  }
  function start(mode){
    clearInterval(timerId);lastMode=mode;
    let p=pool();
    if(mode==='weak'){
      const weak=p.filter(q=>stats.wrong[q.id]);
      if(weak.length>=3)p=weak;
    }
    const count=mode==='bishops'?30:10;
    round=shuffle(p).slice(0,Math.min(count,p.length));
    idx=0;points=0;currentStreak=0;categoryScores={};secondsLeft=60;
    show(el.quiz);
    if(mode==='quick'){
      el.timer.classList.remove('hidden');
      el.timer.textContent='60 sek';
      timerId=setInterval(()=>{
        secondsLeft--;el.timer.textContent=secondsLeft+' sek';
        if(secondsLeft<=0){clearInterval(timerId);finish()}
      },1000);
    } else el.timer.classList.add('hidden');
    showQuestion();
  }
  function showQuestion(){
    if(idx>=round.length){finish();return}
    answered=false;
    const q=round[idx];
    el.qCategory.textContent=q.category+' · '+['','Lätt','Medel','Svår'][q.difficulty];
    el.counter.textContent=(idx+1)+' / '+round.length;
    el.progressBar.style.width=(idx/round.length*100)+'%';
    el.question.textContent=q.question;
    el.options.innerHTML='';el.feedback.classList.add('hidden');el.next.classList.add('hidden');
    q.options.forEach((txt,i)=>{
      const b=document.createElement('button');b.type='button';b.className='option';b.textContent=txt;
      b.addEventListener('click',()=>answer(i,b));el.options.appendChild(b);
    });
  }
  function answer(choice,button){
    if(answered)return;answered=true;
    const q=round[idx], buttons=[...el.options.querySelectorAll('.option')];
    buttons.forEach((b,i)=>{b.disabled=true;if(i===q.answer)b.classList.add('correct')});
    stats.answered++;stats.byCategory[q.category]=stats.byCategory[q.category]||{a:0,c:0};
    stats.byCategory[q.category].a++;
    categoryScores[q.category]=categoryScores[q.category]||{a:0,c:0};categoryScores[q.category].a++;
    if(choice===q.answer){
      points++;stats.correct++;currentStreak++;stats.bestStreak=Math.max(stats.bestStreak,currentStreak);
      stats.byCategory[q.category].c++;categoryScores[q.category].c++;
      if(stats.wrong[q.id]){stats.wrong[q.id]--;if(stats.wrong[q.id]<=0)delete stats.wrong[q.id]}
      el.feedback.innerHTML='<strong>Rätt.</strong> '+q.explanation;
    } else {
      currentStreak=0;button.classList.add('wrong');stats.wrong[q.id]=(stats.wrong[q.id]||0)+1;
      el.feedback.innerHTML='<strong>Inte den här gången.</strong> '+q.explanation;
    }
    save();el.feedback.classList.remove('hidden');el.next.classList.remove('hidden');
  }
  function next(){idx++;showQuestion()}
  function finish(){
    clearInterval(timerId);show(el.result);
    el.score.textContent=points+' / '+Math.max(idx+(answered?1:0),round.length&&Math.min(round.length,idx+(answered?1:0))||round.length);
    const total=round.length?Math.min(round.length,Math.max(idx+(answered?1:0),1)):1;
    const pct=Math.round(points/total*100);
    el.resultTitle.textContent=pct>=90?'Quizorakel i högform':pct>=70?'Stark pubform':pct>=50?'Stabil grund':'Nu har repetitionsmotorn fått arbetsmaterial';
    el.resultText.textContent=pct>=70?'Du hade varit en dyrbar lagkamrat i kväll.':'Felsvaren sparas och kommer tillbaka i repetitionsläget.';
    el.categoryBreakdown.innerHTML='';
    Object.entries(categoryScores).forEach(([cat,s])=>{
      const d=document.createElement('div');d.innerHTML='<span>'+cat+'</span><strong>'+s.c+'/'+s.a+'</strong>';el.categoryBreakdown.appendChild(d);
    });
  }
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.mode)));
  el.next.addEventListener('click',next);el.quit.addEventListener('click',()=>{clearInterval(timerId);show(el.home)});
  el.homeBtn.addEventListener('click',()=>show(el.home));el.again.addEventListener('click',()=>start(lastMode));
  renderStats();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
});
