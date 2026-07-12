
document.addEventListener('DOMContentLoaded', async () => {
  const $=id=>document.getElementById(id);
  const el={
    answered:$('answered'),accuracy:$('accuracy'),bestStreak:$('bestStreak'),level:$('level'),
    category:$('category'),difficulty:$('difficulty'),home:$('home'),quiz:$('quiz'),result:$('result'),
    qCategory:$('qCategory'),counter:$('counter'),progressBar:$('progressBar'),timer:$('timer'),
    question:$('question'),options:$('options'),feedback:$('feedback'),quit:$('quit'),
    score:$('score'),resultTitle:$('resultTitle'),resultText:$('resultText'),
    categoryBreakdown:$('categoryBreakdown'),again:$('again'),homeBtn:$('homeBtn'),
    insight:$('insight'),coachTitle:$('coachTitle'),coachText:$('coachText'),
    roundBanner:$('roundBanner'),roundLabel:$('roundLabel'),roundTitle:$('roundTitle'),
    intelligenceReport:$('intelligenceReport'),subcategoryPill:$('subcategoryPill'),
    activeQuestions:$('activeQuestions'),subcategoryCount:$('subcategoryCount'),qualityScore:$('qualityScore')
  };

  let QUESTIONS=[],REPORT={};
  try{
    [QUESTIONS,REPORT]=await Promise.all([
      fetch('questions.json',{cache:'no-store'}).then(r=>r.json()),
      fetch('quality-report.json',{cache:'no-store'}).then(r=>r.json())
    ]);
  }catch(e){
    document.body.innerHTML='<main class="app-shell"><section class="section-block"><h1>Kunde inte läsa Question Engine</h1></section></main>';
    return;
  }

  QUESTIONS=QUESTIONS.filter(q=>q.status==='active');

  let stats;
  try{stats=JSON.parse(localStorage.getItem('pqa_v7_stats'))||JSON.parse(localStorage.getItem('pqa_v6_stats'))}catch(e){}
  stats=stats||{answered:0,correct:0,bestStreak:0,wrong:{},byCategory:{},bySubcategory:{},questionHistory:{},sessions:0};
  stats.bySubcategory=stats.bySubcategory||{};
  stats.questionHistory=stats.questionHistory||{};
  stats.wrong=stats.wrong||{};

  let round=[],index=0,points=0,streak=0,answeredCurrent=false,lastMode='engine';
  let categoryScores={},subScores={},advanceId=null,finishedCount=0;

  [...new Set(QUESTIONS.map(q=>q.category))].sort().forEach(c=>{
    const o=document.createElement('option');o.value=c;o.textContent=c;el.category.appendChild(o);
  });

  el.activeQuestions.textContent=REPORT.activeCount;
  el.subcategoryCount.textContent=Object.keys(REPORT.subcategories).length;
  el.qualityScore.textContent=REPORT.averageQualityScore+'/100';

  function save(){localStorage.setItem('pqa_v7_stats',JSON.stringify(stats));renderStats()}
  function level(){return stats.correct>=800?'Quizorakel':stats.correct>=500?'Allvetare':stats.correct>=250?'Quizräv':stats.correct>=80?'Pubtalang':'Pubnovis'}
  function profile(source){
    return Object.entries(source).filter(([,v])=>v.a>=4).map(([name,v])=>({name,percent:Math.round(v.c/v.a*100),a:v.a})).sort((a,b)=>a.percent-b.percent)
  }
  function renderStats(){
    el.answered.textContent=stats.answered;el.accuracy.textContent=stats.answered?Math.round(stats.correct/stats.answered*100)+'%':'0%';
    el.bestStreak.textContent=stats.bestStreak;el.level.textContent=level();
    const subs=profile(stats.bySubcategory),cats=profile(stats.byCategory);
    if(!subs.length){
      el.insight.innerHTML='<strong>Kunskapsprofilen byggs upp</strong>Efter några rundor ser motorn vilka delområden som behöver tätare repetition.';
      el.coachTitle.textContent='Börja med Question Engine';
      el.coachText.textContent='Ett första adaptivt pass ger motorn data på både kategori- och delkategorinivå.';
    }else{
      const weak=subs[0],strong=subs[subs.length-1];
      el.insight.innerHTML='<strong>Din detaljprofil</strong><span class="weak">Träna mer: '+weak.name+' ('+weak.percent+'%)</span><br>Starkast: '+strong.name+' ('+strong.percent+'%)';
      el.coachTitle.textContent='Fokusera på '+weak.name;
      el.coachText.textContent='Detta är din tydligaste delkategori-lucka. Motorn blandar in närliggande ämnen för bättre överföring.';
    }
  }

  function shuffle(a){
    const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x
  }
  function show(t){[el.home,el.quiz,el.result].forEach(x=>x.classList.add('hidden'));t.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})}
  function filtered(){return QUESTIONS.filter(q=>(el.category.value==='Alla'||q.category===el.category.value)&&(el.difficulty.value==='Alla'||String(q.difficulty)===el.difficulty.value))}
  function dueScore(q){
    const h=stats.questionHistory[q.id]||{seen:0,wrong:0,correct:0,lastSeen:0,interval:1};
    const now=Date.now(),days=(now-(h.lastSeen||0))/86400000;
    const overdue=Math.max(0,days-(h.interval||1));
    const sub=stats.bySubcategory[q.subcategory];
    const weakness=sub&&sub.a>=4?1-(sub.c/sub.a):.3;
    return (q.pubWeight||1)+(q.qualityScore/100)+weakness*2+(h.wrong||0)*.8+Math.min(3,overdue*.35)-Math.min(1.5,(h.correct||0)*.12);
  }
  function weighted(pool,count){
    const src=[...pool],out=[];
    while(src.length&&out.length<count){
      const weights=src.map(q=>Math.max(.1,dueScore(q))),total=weights.reduce((a,b)=>a+b,0);
      let t=Math.random()*total,idx=0;
      for(let i=0;i<weights.length;i++){t-=weights[i];if(t<=0){idx=i;break}}
      out.push(src.splice(idx,1)[0]);
    }
    return out;
  }
  function chooseSubcategory(pool){
    const groups={};pool.forEach(q=>(groups[q.subcategory]||(groups[q.subcategory]=[])).push(q));
    const ranked=Object.keys(groups).map(name=>{
      const d=stats.bySubcategory[name];
      const p=d&&d.a>=4?d.c/d.a:.65;
      return {name,score:(1-p)+Math.min(1,groups[name].length/20)};
    }).sort((a,b)=>b.score-a.score);
    return ranked[0]&&groups[ranked[0].name]||pool;
  }
  function build(mode){
    let p=filtered(),count=mode==='intelligence'?30:mode==='engine'?20:mode==='lastminute'?12:15;
    if(mode==='weak'){
      const w=p.filter(q=>stats.wrong[q.id]||(stats.questionHistory[q.id]||{}).wrong);
      return weighted(w.length>=3?w:p,10);
    }
    if(mode==='subcategory')return weighted(chooseSubcategory(p),15);
    if(mode==='classics')return weighted(p.filter(q=>q.quizType==='klassiker'||q.pubWeight>=2.5),15);
    if(mode==='lastminute')return weighted(p.filter(q=>q.pubWeight>=2.3&&q.difficulty<=2),12);
    if(mode==='smart'){
      const weakSubs=new Set(profile(stats.bySubcategory).slice(0,3).map(x=>x.name));
      const smart=p.filter(q=>weakSubs.has(q.subcategory)||stats.wrong[q.id]||q.pubWeight>=2.5);
      return weighted(smart.length>=15?smart:p,15);
    }
    if(mode==='intelligence'){
      const picked=[];for(const c of ['Geografi','Historia','Musik','Film & TV','Sport','Vetenskap','Mat & dryck','Litteratur & konst','Sverige','Blandat']){
        picked.push(...weighted(p.filter(q=>q.category===c),3))
      }
      return [...picked.filter(q=>q.difficulty===1),...picked.filter(q=>q.difficulty===2),...picked.filter(q=>q.difficulty===3)].slice(0,30);
    }
    return weighted(p,count);
  }

  function start(mode){
    clearTimeout(advanceId);lastMode=mode;round=build(mode);index=0;points=0;streak=0;finishedCount=0;
    categoryScores={};subScores={};stats.sessions=(stats.sessions||0)+1;show(el.quiz);showQuestion()
  }
  function showQuestion(){
    if(index>=round.length){finish();return}
    answeredCurrent=false;const q=round[index];
    el.qCategory.textContent=q.category+' · '+['','Lätt','Medel','Svår'][q.difficulty];
    el.counter.textContent=(index+1)+' av '+round.length;el.progressBar.style.width=(index/round.length*100)+'%';
    el.subcategoryPill.textContent=q.subcategory;el.question.textContent=q.question;el.options.innerHTML='';el.feedback.classList.add('hidden');
    q.options.forEach((text,i)=>{
      const b=document.createElement('button');b.className='option';b.innerHTML='<span class="answer-letter">'+['A','B','C','D'][i]+'</span><span>'+text+'</span>';
      b.onclick=()=>answer(i,b);el.options.appendChild(b)
    });
  }
  function answer(choice,button){
    if(answeredCurrent)return;answeredCurrent=true;finishedCount++;
    const q=round[index],h=stats.questionHistory[q.id]||{seen:0,wrong:0,correct:0,lastSeen:0,interval:1};
    h.seen++;h.lastSeen=Date.now();const buttons=[...el.options.querySelectorAll('.option')];
    buttons.forEach((b,i)=>{b.disabled=true;if(i===q.answer)b.classList.add('correct')});
    stats.answered++;stats.byCategory[q.category]=stats.byCategory[q.category]||{a:0,c:0};stats.bySubcategory[q.subcategory]=stats.bySubcategory[q.subcategory]||{a:0,c:0};
    stats.byCategory[q.category].a++;stats.bySubcategory[q.subcategory].a++;categoryScores[q.category]=categoryScores[q.category]||{a:0,c:0};subScores[q.subcategory]=subScores[q.subcategory]||{a:0,c:0};categoryScores[q.category].a++;subScores[q.subcategory].a++;
    if(choice===q.answer){
      points++;streak++;stats.correct++;h.correct++;h.interval=Math.min(30,Math.max(1,(h.interval||1)*2));stats.bestStreak=Math.max(stats.bestStreak,streak);
      stats.byCategory[q.category].c++;stats.bySubcategory[q.subcategory].c++;categoryScores[q.category].c++;subScores[q.subcategory].c++;
      if(stats.wrong[q.id]&&!--stats.wrong[q.id])delete stats.wrong[q.id];
      el.feedback.innerHTML='<strong>Rätt!</strong> '+q.explanation
    }else{
      streak=0;h.wrong++;h.interval=1;stats.wrong[q.id]=(stats.wrong[q.id]||0)+1;button.classList.add('wrong');
      el.feedback.innerHTML='<strong>Inte riktigt.</strong> '+q.explanation
    }
    stats.questionHistory[q.id]=h;save();el.feedback.classList.remove('hidden');
    advanceId=setTimeout(()=>{index++;showQuestion()},1650)
  }
  function finish(){
    clearTimeout(advanceId);show(el.result);const pct=Math.round(points/Math.max(finishedCount,1)*100);el.score.textContent=pct+'%';
    el.resultTitle.textContent=pct>=90?'Mycket stark motorträff':pct>=75?'Vass quizform':pct>=55?'Bra träningspass':'Motorn har hittat luckorna';
    el.resultText.textContent='Nästa pass viktas om efter resultatet och frågornas repetitionsintervall.';
    const subs=Object.entries(subScores).map(([name,v])=>({name,p:Math.round(v.c/v.a*100)})).sort((a,b)=>a.p-b.p);
    el.intelligenceReport.innerHTML='';
    [['Svagaste delkategori',subs[0]?subs[0].name+' · '+subs[0].p+'%':'För få svar'],['Starkaste delkategori',subs.length?subs[subs.length-1].name+' · '+subs[subs.length-1].p+'%':'För få svar'],['Frågor i passet',finishedCount]].forEach(([l,v])=>{
      const d=document.createElement('div');d.className='report-row';d.innerHTML='<span>'+l+'</span><strong>'+v+'</strong>';el.intelligenceReport.appendChild(d)
    });
    el.categoryBreakdown.innerHTML='';Object.entries(categoryScores).forEach(([c,v])=>{const d=document.createElement('div');d.innerHTML='<span>'+c+'</span><strong>'+v.c+'/'+v.a+'</strong>';el.categoryBreakdown.appendChild(d)});save()
  }

  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>start(b.dataset.mode));
  el.quit.onclick=()=>{clearTimeout(advanceId);show(el.home)};el.homeBtn.onclick=()=>show(el.home);el.again.onclick=()=>start(lastMode);
  renderStats();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})
});
