
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const el = {
    answered:$('answered'),accuracy:$('accuracy'),bestStreak:$('bestStreak'),level:$('level'),
    category:$('category'),difficulty:$('difficulty'),home:$('home'),quiz:$('quiz'),result:$('result'),
    qCategory:$('qCategory'),counter:$('counter'),progressBar:$('progressBar'),timer:$('timer'),
    question:$('question'),options:$('options'),feedback:$('feedback'),quit:$('quit'),
    score:$('score'),resultTitle:$('resultTitle'),resultText:$('resultText'),
    categoryBreakdown:$('categoryBreakdown'),again:$('again'),homeBtn:$('homeBtn'),
    insight:$('insight'),coachTitle:$('coachTitle'),coachText:$('coachText'),
    coachStart:$('coachStart'),roundBanner:$('roundBanner'),roundLabel:$('roundLabel'),
    roundTitle:$('roundTitle'),intelligenceReport:$('intelligenceReport')
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
  try {
    stats = JSON.parse(localStorage.getItem('pqa_v6_stats'));
    if (!stats) stats = JSON.parse(localStorage.getItem('pqa_v5_stats'));
  } catch (e) {}
  stats = stats || {
    answered:0,correct:0,bestStreak:0,wrong:{},byCategory:{},seen:[],
    questionHistory:{},sessions:0
  };
  stats.questionHistory = stats.questionHistory || {};
  stats.sessions = stats.sessions || 0;

  let round=[],index=0,points=0,streak=0,answeredCurrent=false,lastMode='intelligence';
  let categoryScores={},timerId=null,secondsLeft=60,finishedCount=0,advanceId=null;
  let sessionWrong=[],sessionRight=[],sessionStart=0;

  const categoryOrder = [
    'Geografi','Historia','Sverige','Musik','Film & TV','Sport',
    'Vetenskap','Mat & dryck','Litteratur & konst','Blandat','Språk'
  ];

  [...new Set(QUESTIONS.map(q=>q.category))].sort().forEach(category=>{
    const option=document.createElement('option');
    option.value=category;
    option.textContent=category;
    el.category.appendChild(option);
  });

  function save(){
    localStorage.setItem('pqa_v6_stats',JSON.stringify(stats));
    renderStats();
  }

  function level(){
    if(stats.correct>=800)return'Quizorakel';
    if(stats.correct>=500)return'Allvetare';
    if(stats.correct>=250)return'Quizräv';
    if(stats.correct>=80)return'Pubtalang';
    return'Pubnovis';
  }

  function categoryProfile(){
    return Object.entries(stats.byCategory)
      .filter(([,v])=>v.a>=5)
      .map(([name,v])=>({name,answered:v.a,correct:v.c,percent:Math.round(v.c/v.a*100)}))
      .sort((a,b)=>a.percent-b.percent);
  }

  function renderStats(){
    el.answered.textContent=stats.answered;
    el.accuracy.textContent=stats.answered?Math.round(stats.correct/stats.answered*100)+'%':'0%';
    el.bestStreak.textContent=stats.bestStreak;
    el.level.textContent=level();

    const profile=categoryProfile();
    if(!profile.length){
      el.insight.innerHTML='<strong>Din quizprofil byggs upp</strong>Efter några rundor ser du ditt starkaste och svagaste område här.';
      el.coachTitle.textContent='Börja med en intelligent basrunda';
      el.coachText.textContent='Appen behöver lite data innan den kan rikta träningen riktigt vasst.';
    }else{
      const weak=profile[0];
      const strong=profile[profile.length-1];
      el.insight.innerHTML='<strong>Din quizprofil</strong><span class="weak">Träna mer: '+weak.name+' ('+weak.percent+'%)</span><br>Starkast just nu: '+strong.name+' ('+strong.percent+'%)';
      el.coachTitle.textContent='Fokusera på '+weak.name;
      el.coachText.textContent='Det är just nu din tydligaste kunskapslucka. Smart träning blandar den med pubklassiker och tidigare felsvar.';
    }
  }

  function shuffle(array,seed=null){
    const copy=[...array];
    let random=Math.random;
    if(seed!==null){
      let state=seed>>>0;
      random=()=>{
        state=(state*1664525+1013904223)>>>0;
        return state/4294967296;
      };
    }
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }

  function weightedPick(pool,count,seed=null){
    const source=[...pool];
    const selected=[];
    let random=Math.random;
    if(seed!==null){
      let state=seed>>>0;
      random=()=>{
        state=(state*1664525+1013904223)>>>0;
        return state/4294967296;
      };
    }

    while(source.length && selected.length<count){
      const weights=source.map(q=>{
        const history=stats.questionHistory[q.id]||{seen:0,wrong:0};
        const categoryData=stats.byCategory[q.category];
        const weakness=categoryData&&categoryData.a>=5
          ? Math.max(0,1-(categoryData.c/categoryData.a))
          : .25;
        const recencyPenalty=history.seen?Math.min(.75,history.seen*.12):0;
        const wrongBoost=Math.min(3,(history.wrong||0)*.8);
        return Math.max(.1,(q.pubWeight||1)+weakness*2+wrongBoost-recencyPenalty);
      });
      const total=weights.reduce((a,b)=>a+b,0);
      let target=random()*total;
      let chosen=0;
      for(let i=0;i<weights.length;i++){
        target-=weights[i];
        if(target<=0){chosen=i;break}
      }
      selected.push(source.splice(chosen,1)[0]);
    }
    return selected;
  }

  function daySeed(){
    const d=new Date();
    return Number(String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'));
  }

  function show(target){
    [el.home,el.quiz,el.result].forEach(section=>section.classList.add('hidden'));
    target.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function filteredPool(){
    return QUESTIONS.filter(q=>
      (el.category.value==='Alla'||q.category===el.category.value)&&
      (el.difficulty.value==='Alla'||String(q.difficulty)===el.difficulty.value)
    );
  }

  function balancedIntelligence(pool,count){
    if(el.category.value!=='Alla') return weightedPick(pool,count);

    const targetCategories=[
      'Geografi','Historia','Musik','Film & TV','Sport',
      'Vetenskap','Mat & dryck','Litteratur & konst','Sverige','Blandat'
    ];
    const selected=[];
    let remaining=[...pool];

    targetCategories.forEach(category=>{
      if(selected.length>=count)return;
      const categoryPool=remaining.filter(q=>q.category===category);
      const picks=weightedPick(categoryPool,Math.min(3,categoryPool.length));
      selected.push(...picks);
      const ids=new Set(picks.map(q=>q.id));
      remaining=remaining.filter(q=>!ids.has(q.id));
    });

    if(selected.length<count){
      selected.push(...weightedPick(remaining,count-selected.length));
    }

    const easy=shuffle(selected.filter(q=>q.difficulty===1));
    const medium=shuffle(selected.filter(q=>q.difficulty===2));
    const hard=shuffle(selected.filter(q=>q.difficulty===3));
    return [...easy,...medium,...hard].slice(0,count);
  }

  function buildRound(mode){
    let pool=filteredPool();
    const count=mode==='intelligence'?30:mode==='daily'?15:mode==='lastminute'?12:mode==='classics'?15:10;

    if(mode==='weak'){
      const weak=pool.filter(q=>stats.wrong[q.id]||(stats.questionHistory[q.id]||{}).wrong);
      return weightedPick(weak.length>=3?weak:pool,count);
    }

    if(mode==='classics'){
      const classics=pool.filter(q=>q.quizType==='klassiker'||q.pubWeight>=2.5);
      return weightedPick(classics.length>=count?classics:pool,count);
    }

    if(mode==='lastminute'){
      const highValue=pool.filter(q=>q.pubWeight>=2.3&&q.difficulty<=2);
      return weightedPick(highValue.length>=count?highValue:pool,count);
    }

    if(mode==='daily'){
      return weightedPick(pool,count,daySeed());
    }

    if(mode==='smart'){
      const profile=categoryProfile();
      const weakCategories=new Set(profile.slice(0,2).map(x=>x.name));
      const smartPool=pool.filter(q=>
        weakCategories.has(q.category)||
        stats.wrong[q.id]||
        q.pubWeight>=2.4
      );
      return weightedPick(smartPool.length>=count?smartPool:pool,count);
    }

    if(mode==='intelligence'){
      return balancedIntelligence(pool,count);
    }

    return weightedPick(pool,count);
  }

  function start(mode){
    clearInterval(timerId);
    clearTimeout(advanceId);
    lastMode=mode;
    round=buildRound(mode);
    index=0;
    points=0;
    streak=0;
    categoryScores={};
    secondsLeft=60;
    finishedCount=0;
    answeredCurrent=false;
    sessionWrong=[];
    sessionRight=[];
    sessionStart=Date.now();
    stats.sessions++;

    show(el.quiz);

    if(mode==='quick'){
      el.timer.classList.remove('hidden');
      el.timer.textContent='60 sek';
      timerId=setInterval(()=>{
        secondsLeft--;
        el.timer.textContent=secondsLeft+' sek';
        if(secondsLeft<=0){
          clearInterval(timerId);
          finish();
        }
      },1000);
    }else{
      el.timer.classList.add('hidden');
    }

    showQuestion();
  }

  function roundInfo(){
    if(lastMode!=='intelligence')return null;
    if(index<10)return{label:'RUNDA 1 AV 3',title:'Bred allmänbildning'};
    if(index<20)return{label:'RUNDA 2 AV 3',title:'Pubklassiker och kultur'};
    return{label:'RUNDA 3 AV 3',title:'Svårare avslutning'};
  }

  function showQuestion(){
    clearTimeout(advanceId);
    if(index>=round.length){
      finish();
      return;
    }

    const info=roundInfo();
    if(info){
      el.roundBanner.classList.remove('hidden');
      el.roundLabel.textContent=info.label;
      el.roundTitle.textContent=info.title;
    }else{
      el.roundBanner.classList.add('hidden');
    }

    answeredCurrent=false;
    const q=round[index];
    el.qCategory.textContent=q.category+' · '+['','Lätt','Medel','Svår'][q.difficulty];
    el.counter.textContent=(index+1)+' av '+round.length;
    el.progressBar.style.width=(index/round.length*100)+'%';
    el.question.textContent=q.question;
    el.options.innerHTML='';
    el.feedback.classList.add('hidden');

    q.options.forEach((text,optionIndex)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='option';
      button.innerHTML='<span class="answer-letter">'+['A','B','C','D'][optionIndex]+'</span><span>'+text+'</span>';
      button.addEventListener('click',()=>answer(optionIndex,button));
      el.options.appendChild(button);
    });
  }

  function answer(choice,button){
    if(answeredCurrent)return;
    answeredCurrent=true;
    finishedCount++;

    const q=round[index];
    const history=stats.questionHistory[q.id]||{seen:0,wrong:0,correct:0};
    history.seen++;
    stats.questionHistory[q.id]=history;

    const buttons=[...el.options.querySelectorAll('.option')];
    buttons.forEach((item,itemIndex)=>{
      item.disabled=true;
      if(itemIndex===q.answer)item.classList.add('correct');
    });

    stats.answered++;
    if(!stats.seen.includes(q.id)){
      stats.seen.push(q.id);
      if(stats.seen.length>800)stats.seen=stats.seen.slice(-800);
    }

    stats.byCategory[q.category]=stats.byCategory[q.category]||{a:0,c:0};
    stats.byCategory[q.category].a++;
    categoryScores[q.category]=categoryScores[q.category]||{a:0,c:0};
    categoryScores[q.category].a++;

    if(choice===q.answer){
      points++;
      stats.correct++;
      streak++;
      history.correct++;
      stats.bestStreak=Math.max(stats.bestStreak,streak);
      stats.byCategory[q.category].c++;
      categoryScores[q.category].c++;
      sessionRight.push(q);

      if(stats.wrong[q.id]){
        stats.wrong[q.id]--;
        if(stats.wrong[q.id]<=0)delete stats.wrong[q.id];
      }

      el.feedback.innerHTML='<strong>Rätt!</strong> '+q.explanation;
      if(navigator.vibrate)navigator.vibrate(25);
    }else{
      streak=0;
      history.wrong++;
      button.classList.add('wrong');
      stats.wrong[q.id]=(stats.wrong[q.id]||0)+1;
      sessionWrong.push(q);
      el.feedback.innerHTML='<strong>Inte riktigt.</strong> '+q.explanation;
      if(navigator.vibrate)navigator.vibrate([20,40,20]);
    }

    save();
    el.feedback.classList.remove('hidden');

    advanceId=setTimeout(()=>{
      index++;
      showQuestion();
    },1650);
  }

  function intelligenceSummary(){
    const profile=Object.entries(categoryScores)
      .map(([name,v])=>({name,percent:Math.round(v.c/v.a*100),answered:v.a}))
      .sort((a,b)=>a.percent-b.percent);

    const weakest=profile[0];
    const strongest=profile[profile.length-1];
    const classicAnswered=round.filter(q=>q.quizType==='klassiker').length;
    const classicCorrect=sessionRight.filter(q=>q.quizType==='klassiker').length;
    const classicPercent=classicAnswered?Math.round(classicCorrect/classicAnswered*100):0;

    return {weakest,strongest,classicPercent};
  }

  function finish(){
    clearInterval(timerId);
    clearTimeout(advanceId);
    show(el.result);

    const percent=Math.round(points/Math.max(finishedCount,1)*100);
    el.score.textContent=percent+'%';

    el.resultTitle.textContent=
      percent>=90?'Quizorakel i högform':
      percent>=75?'Redo för ett vasst pubbord':
      percent>=55?'Stabil quizform':
      'Nu vet coachen vad som ska tränas';

    el.resultText.textContent=
      lastMode==='lastminute'
        ? 'Uppvärmningen är klar. De viktigaste luckorna är nu färska i minnet.'
        : percent>=75
          ? 'Din blandning av bredd och pubklassiker ser stark ut.'
          : 'Felsvaren har lagts in i nästa smarta träningspass.';

    const report=intelligenceSummary();
    el.intelligenceReport.innerHTML='';

    const rows=[
      ['Pubklassiker',report.classicPercent+'% rätt'],
      ['Starkast i rundan',report.strongest?report.strongest.name+' · '+report.strongest.percent+'%':'För få svar'],
      ['Nästa fokus',report.weakest?report.weakest.name+' · '+report.weakest.percent+'%':'Fortsätt samla data']
    ];

    rows.forEach(([label,value])=>{
      const row=document.createElement('div');
      row.className='report-row';
      row.innerHTML='<span>'+label+'</span><strong>'+value+'</strong>';
      el.intelligenceReport.appendChild(row);
    });

    el.categoryBreakdown.innerHTML='';
    Object.entries(categoryScores).forEach(([category,values])=>{
      const row=document.createElement('div');
      row.innerHTML='<span>'+category+'</span><strong>'+values.c+'/'+values.a+'</strong>';
      el.categoryBreakdown.appendChild(row);
    });

    save();
  }

  document.querySelectorAll('[data-mode]').forEach(button=>{
    button.addEventListener('click',()=>start(button.dataset.mode));
  });

  el.quit.addEventListener('click',()=>{
    clearInterval(timerId);
    clearTimeout(advanceId);
    show(el.home);
  });

  el.homeBtn.addEventListener('click',()=>show(el.home));
  el.again.addEventListener('click',()=>start(lastMode));

  renderStats();

  if('serviceWorker'in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
