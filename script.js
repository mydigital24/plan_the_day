document.addEventListener('DOMContentLoaded', () => {

    // ─── STATE ───────────────────────────────────────────────────────────────────
    let currentDate       = new Date();
    let selectedDateStr   = dateStr(currentDate);
    let editingTaskId     = null;
    let editingRoutineId  = null;
    let modalSelectedStatus = 'not-started';
    let selectedIcon      = '📋';
    let iconPickerOpen    = false;
    let shouldScrollToNow = true;

    // ─── CONSTANTS ───────────────────────────────────────────────────────────────
    const MONATE      = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const WOCHENTAGE  = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    const WOCHENTAGE_LANG = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const ICONS = ['📋','✅','⚡','🎯','💪','🧠','💼','📚','🏃','🚴','🧘','🍎','☕','🍽️','🛒','🏋️','😴','🌅','⏰','📅','💻','📱','❤️','🎨','📎','🔒','✈️','🛏️','🎵','🎬','🧾','🧹','🛠️','🎁','💡','📈','🧪','🥗','🍹','🧳','☀️','🌙','🌈','🥇','🧩'];
    const MOTIVATIONS = ['Kurze Pause ☀️','Jetzt durchatmen. 🌿','Ein Moment für dich. 🧘','Aufladen für das Nächste. ⚡'];
    const DEFAULT_SETTINGS = { notifyBefore: true, notifyStart: true, notifyEnd: true };
    const NOTIFY_OFFSET = 5;

    // ─── DOM REFS ────────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const weekStrip    = $('week-strip');
    const ansTimeline  = $('ans-timeline');
    const ansMonthLbl  = $('ans-month-label');
    const ansProgress  = $('ans-progress-bar');
    const ansProgressT = $('ans-progress-text');
    const ansSuggestion= $('ans-suggestion');
    const ansSuggText  = $('ans-suggestion-text');
    const ansSuggBtn   = $('ans-suggestion-btn');

    const modal        = $('task-modal');
    const modalBackdrop= document.querySelector('#task-modal .modal-backdrop');
    const modalTitleEl = $('modal-title');
    const inputTitle   = $('task-title');
    const inputTime    = $('task-time');
    const inputEndTime = $('task-end-time');
    const inputNotes   = $('task-notes');
    const btnCancel    = $('modal-cancel');
    const btnDelete    = $('modal-delete');
    const btnSave      = $('modal-save');
    const iconDisplay  = $('icon-display');
    const iconPicker   = $('icon-picker');
    const statusToggleGroup   = $('task-status-toggle-group');
    const inputNotifyBefore   = $('task-notify-before');
    const inputNotifyStart    = $('task-notify-start');
    const inputNotifyEnd      = $('task-notify-end');
    const inputAdditionalTimes= $('task-additional-times');
    const inputCheckable      = $('task-checkable');
    const inputRepeatMon = $('repeat-mon');
    const inputRepeatTue = $('repeat-tue');
    const inputRepeatWed = $('repeat-wed');
    const inputRepeatThu = $('repeat-thu');
    const inputRepeatFri = $('repeat-fri');
    const inputRepeatSat = $('repeat-sat');
    const inputRepeatSun = $('repeat-sun');

    // ─── HELPERS ─────────────────────────────────────────────────────────────────
    function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function pad(n)     { return String(n).padStart(2,'0'); }
    function todayStr() { return dateStr(new Date()); }
    function nowMin()   { const n = new Date(); return n.getHours()*60+n.getMinutes(); }
    function toMin(t)   { if(!t||!t.includes(':')) return 0; const [h,m]=t.split(':').map(Number); return h*60+m; }
    function minToStr(tot) { tot=Math.round(tot); const h=Math.floor(tot/60),m=tot%60; return h===0?`${m}m`:m>0?`${h}h ${m}m`:`${h}h`; }
    function timeFromMin(m) { return `${pad(Math.floor(m/60))}:${pad(m%60)}`; }
    function randItem(a){ return a[Math.floor(Math.random()*a.length)]; }
    function getWakeTime()  { return localStorage.getItem('planner_wake_time')  || '07:00'; }
    function getSleepTime() { return localStorage.getItem('planner_sleep_time') || '22:00'; }
    function getAufTask()   { return {id:'__aufstehen__',title:'Aufstehen',icon:'🌅',time:getWakeTime(), endTime:'',notes:'',completed:false,checkable:false}; }
    function getSchlafTask(){ return {id:'__schlafen__', title:'Schlafen', icon:'🌙',time:getSleepTime(),endTime:'',notes:'',completed:false,checkable:false}; }

    function normalizeStatus(t) {
        if(t.status==='done'||t.completed) return 'done';
        if(t.status==='in-progress') return 'in-progress';
        return 'not-started';
    }
    function isTaskDone(t)      { return normalizeStatus(t)==='done'; }
    function isTaskCheckable(t) { return t.checkable!==false; }
    function getTaskSource(t)   { return t.originalTask||t; }
    function nextStatus(s) { if(s==='not-started') return 'in-progress'; if(s==='in-progress') return 'done'; return 'not-started'; }

    // ─── STORAGE ─────────────────────────────────────────────────────────────────
    function loadData() {
        try {
            const s = JSON.parse(localStorage.getItem('planner_tasks'))||{};
            if(!Array.isArray(s.__routines__)) s.__routines__=[];
            if(!s.__routineHistory__) s.__routineHistory__={};
            return s;
        } catch(e) { return {__routines__:[],__routineHistory__:{}}; }
    }
    function saveData(d) { localStorage.setItem('planner_tasks',JSON.stringify(d)); updateBadge(); }
    function ensureDay(d,ds) { if(!d[ds]) d[ds]=[]; }
    function loadSettings() { try { return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem('planner_settings')||'{}')}; } catch(e) { return {...DEFAULT_SETTINGS}; } }
    function saveSettings(s) { localStorage.setItem('planner_settings',JSON.stringify(s)); updateSettingsUI(); }

    // ─── ROUTINES ────────────────────────────────────────────────────────────────
    function getWeekdayIndex(dk) { return new Date(dk).getDay(); }
    function getRoutines()       { return loadData().__routines__||[]; }
    function getRoutineHistory() { return loadData().__routineHistory__||{}; }
    function markRoutineStatus(dk,rid,status) {
        const d=loadData(); if(!d.__routineHistory__) d.__routineHistory__={};
        if(!d.__routineHistory__[dk]) d.__routineHistory__[dk]={};
        d.__routineHistory__[dk][rid]=status; saveData(d);
    }
    function getRoutineStatus(dk,rid) {
        const h=getRoutineHistory(); const s=h[dk]&&h[dk][rid];
        if(s==='done'||s===true) return 'done';
        if(s==='in-progress') return 'in-progress';
        return 'not-started';
    }
    function buildRoutineInstance(r,dk) {
        const status=getRoutineStatus(dk,r.id);
        return {...r,routineId:r.id,isRoutine:true,dateKey:dk,status,completed:status==='done'};
    }
    function getRoutineInstancesForDate(dk) {
        const wday=getWeekdayIndex(dk);
        return getRoutines().filter(r=>Array.isArray(r.repeatDays)&&r.repeatDays.includes(wday)).map(r=>buildRoutineInstance(r,dk));
    }
    function expandTaskBlocks(tasks) {
        return tasks.flatMap(task=>{
            const blocks=[];
            if(task.time) blocks.push({time:task.time,endTime:task.endTime||''});
            if(task.additionalTimes){
                task.additionalTimes.split(',').map(p=>p.trim()).filter(Boolean).forEach(range=>{
                    const [s,e]=range.split('-').map(x=>x.trim());
                    if(s&&/^\d{1,2}:\d{2}$/.test(s)) blocks.push({time:s,endTime:e||''});
                });
            }
            if(blocks.length===0) return [task];
            return blocks.map((b,i)=>({...task,time:b.time,endTime:b.endTime,displayId:`${task.id}-${i}`,baseId:task.id,originalTask:task}));
        });
    }

    // Real user tasks only (no wake/sleep)
    function getDayTasksReal(dk) {
        const d=loadData(); ensureDay(d,dk);
        const dayTasks=(d[dk]||[]).filter(t=>t.id!=='__aufstehen__'&&t.id!=='__schlafen__');
        const routines=getRoutineInstancesForDate(dk);
        const routineIds=new Set(routines.map(r=>r.routineId));
        return expandTaskBlocks([...dayTasks.filter(t=>!(t.routineId&&routineIds.has(t.routineId))),...routines]);
    }
    // All tasks including wake/sleep virtual entries
    function getDayTasks(dk) { return [getAufTask(),...getDayTasksReal(dk),getSchlafTask()]; }
    function getIncompleteTasks(dk) { return getDayTasksReal(dk).filter(t=>isTaskCheckable(t)&&!isTaskDone(t)); }
    function getPrevDayKey(dk) { const d=new Date(dk); d.setDate(d.getDate()-1); return dateStr(d); }

    function updateBadge() {
        if(!('setAppBadge' in navigator)) return;
        const n=getIncompleteTasks(todayStr()).length;
        n>0?navigator.setAppBadge(n).catch(()=>{}):navigator.clearAppBadge().catch(()=>{});
    }

    // ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
    function scheduleNtfyForToday() {
        const topic = (localStorage.getItem('planner_ntfy_topic') || '').trim();
        if (!topic) { alert('Kein ntfy-Topic eingetragen.'); return; }

        const s = loadSettings();
        const dk = todayStr();
        const tasks = getDayTasksReal(dk);
        let scheduledCount = 0;
        const now = new Date();

        const sendScheduled = (title, body, dateObj) => {
            if (dateObj > now) {
                const delayStr = Math.floor(dateObj.getTime() / 1000).toString();
                fetch('https://ntfy.sh/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: topic,
                        title: title,
                        message: body,
                        priority: 4,
                        tags: ['calendar'],
                        delay: delayStr
                    })
                }).catch(() => {});
                scheduledCount++;
            }
        };

        tasks.forEach(task => {
            if (!task.time || !task.title || task.completed) return;

            const t = new Date();
            const [h, m] = task.time.split(':').map(Number);
            t.setHours(h, m, 0, 0);

            if (s.notifyBefore && task.notifyBefore !== false) {
                sendScheduled('Aufgabe startet bald', `In ${NOTIFY_OFFSET} Minuten: ${task.title}`, new Date(t.getTime() - NOTIFY_OFFSET * 60000));
            }
            if (s.notifyStart && task.notifyStart !== false) {
                sendScheduled('Aufgabe beginnt', `${task.title} startet um ${task.time}`, t);
            }
            if (s.notifyEnd && task.notifyEnd !== false && task.endTime) {
                const et = new Date();
                const [eh, em] = task.endTime.split(':').map(Number);
                et.setHours(eh, em, 0, 0);
                sendScheduled('Aufgabe endet', `${task.title} endet um ${task.endTime}`, et);
            }
        });

        alert(`${scheduledCount} Mitteilungen für heute auf dem ntfy-Server geplant!`);
    }

    // ─── THEME ───────────────────────────────────────────────────────────────────
    function applyTheme(theme) {
        if(theme==='dark') document.documentElement.setAttribute('data-theme','dark');
        else if(theme==='light') document.documentElement.setAttribute('data-theme','light');
        else document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('planner_theme',theme);
        ['theme-auto','theme-light','theme-dark'].forEach(id=>$(id)&&$(id).classList.remove('active'));
        const map={auto:'theme-auto',light:'theme-light',dark:'theme-dark'};
        if($(map[theme])) $(map[theme]).classList.add('active');
    }

    // ─── ICON PICKER ─────────────────────────────────────────────────────────────
    function buildIconPicker() {
        if(!iconPicker) return;
        iconPicker.innerHTML='';
        ICONS.forEach(em=>{
            const b=document.createElement('button');
            b.className='icon-option'; b.textContent=em; b.type='button';
            b.addEventListener('click',()=>{ selectedIcon=em; if(iconDisplay) iconDisplay.textContent=em; iconPicker.style.display='none'; iconPickerOpen=false; });
            iconPicker.appendChild(b);
        });
    }

    // ─── WEEK STRIP ──────────────────────────────────────────────────────────────
    function getWeekStart(date) {
        const d=new Date(date); const day=d.getDay();
        d.setDate(d.getDate()-day+(day===0?-6:1)); return d;
    }
    function renderWeekStrip() {
        if(!weekStrip) return;
        weekStrip.innerHTML='';
        const start=getWeekStart(currentDate); const today=todayStr();
        for(let i=0;i<7;i++){
            const d=new Date(start); d.setDate(start.getDate()+i);
            const ds=dateStr(d);
            const el=document.createElement('div');
            el.className='week-day'+(ds===today?' today':'')+(ds===selectedDateStr?' active':'');
            el.innerHTML=`<span class="week-day-name">${WOCHENTAGE[d.getDay()]}</span><span class="week-day-num">${d.getDate()}</span>`;
            el.addEventListener('click',()=>{ selectedDateStr=ds; renderWeekStrip(); renderAnstehend(); });
            weekStrip.appendChild(el);
        }
        if(ansMonthLbl) ansMonthLbl.textContent=`${MONATE[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }

    // ─── ANSTEHEND / TIMELINE ────────────────────────────────────────────────────
    function renderAnstehend() {
        if(!ansTimeline) return;
        ansTimeline.innerHTML='';
        const auf=getAufTask(), sch=getSchlafTask();
        const mid=getDayTasksReal(selectedDateStr).sort((a,b)=>toMin(a.time)-toMin(b.time));
        const isToday=selectedDateStr===todayStr(), isPast=selectedDateStr<todayStr(), cur=nowMin();
        const startMin=toMin(auf.time), endMin=toMin(sch.time), total=Math.max(1,endMin-startMin);

        if(ansProgress){
            if(isToday){ const pct=((cur-startMin)/total)*100; ansProgress.style.width=`${Math.min(100,Math.max(0,pct))}%`; }
            else { ansProgress.style.width=isPast?'100%':'0%'; }
        }
        if(ansProgressT){
            const rem=endMin-cur;
            ansProgressT.textContent=(isToday&&rem>0&&cur>=startMin)?`${minToStr(rem)} übrig`:'';
        }

        // Suggestion banner
        if(ansSuggestion){
            if(selectedDateStr===todayStr()){
                const inc=getIncompleteTasks(getPrevDayKey(todayStr()));
                if(inc.length>0){ ansSuggestion.style.display='flex'; if(ansSuggText) ansSuggText.textContent=`${inc.length} offene Aufgaben vom Vortag`; }
                else ansSuggestion.style.display='none';
            } else ansSuggestion.style.display='none';
        }

        ansTimeline.appendChild(makeFixed(auf, isPast||(isToday&&toMin(auf.time)<=cur), false));
        let lastMin=startMin;
        mid.forEach(task=>{
            const tMin=toMin(task.time);
            if(tMin>lastMin){ ansTimeline.appendChild(makeGap(timeFromMin(lastMin),task.time,tMin-lastMin,isToday,isPast,cur,task)); }
            let dur=60; if(task.endTime&&toMin(task.endTime)>tMin) dur=toMin(task.endTime)-tMin;
            ansTimeline.appendChild(makeTask(task,dur,isToday,isPast,cur,tMin,tMin+dur));
            lastMin=tMin+dur;
        });
        if(endMin>lastMin) ansTimeline.appendChild(makeGap(timeFromMin(lastMin),sch.time,endMin-lastMin,isToday,isPast,cur,sch));
        ansTimeline.appendChild(makeFixed(sch, isPast||(isToday&&toMin(sch.time)<=cur), true));

        updateBadge();
        if(isToday&&shouldScrollToNow){
            const active=ansTimeline.querySelector('.ans-card.active-now');
            if(active){ active.closest('.ans-row')?.scrollIntoView({behavior:'smooth',block:'center'}); shouldScrollToNow=false; }
        }
    }

    function makeFixed(task, past, isBottom) {
        const wrap=document.createElement('div'); wrap.className='ans-fixed-wrap';
        const row=document.createElement('div'); row.className='ans-row';
        row.innerHTML=`
        <div class="ans-time-col">
        <span class="ans-start-time">${task.time}</span>
        <div class="ans-dot fixed"></div>
        ${!isBottom?'<div class="ans-line" style="background:var(--separator-light)"></div>':''}
        </div>
        <div class="ans-card fixed-card">
        <div class="ans-card-left">
        <span class="ans-emoji">${task.icon}</span>
        <div class="ans-text"><span class="ans-title">${task.title}</span></div>
        </div>
        </div>`;
        row.querySelector('.ans-card').addEventListener('click',()=>switchTab('einstellungen'));
        wrap.appendChild(row); return wrap;
    }

    function makeGap(startTime,endTime,durMin,isToday,isPast,cur,nextTask) {
        const sM=toMin(startTime), eM=toMin(endTime);
        const isCur=isToday&&cur>=sM&&cur<eM;
        const linePast=isPast||(isToday&&sM<=cur);
        const row=document.createElement('div'); row.className='ans-row'; row.style.minHeight=Math.max(52,durMin*1.2)+'px';
        const remain=isCur?(eM-cur):durMin;
        const sub=isCur&&nextTask&&nextTask.id!=='__schlafen__'?`In ${minToStr(remain)}: ${nextTask.title}`:`${startTime} – ${endTime} (${minToStr(durMin)})`;
        const quote=isCur?randItem(MOTIVATIONS):'';
        const pct=isCur?Math.max(0,Math.min(100,((cur-sM)/Math.max(1,durMin))*100)):0;
        row.innerHTML=`
        ${isCur?`<div class="ans-live-line" style="top:${pct}%;"><span class="ans-live-label">${timeFromMin(cur)}</span></div>`:''}
        <div class="ans-time-col">
        <span class="ans-start-time" style="color:var(--text-tertiary)">${startTime}</span>
        <div class="ans-dot ${linePast?'past':''} ${isCur?'current':''}"></div>
        <div class="ans-line ${linePast?'past':''}"></div>
        </div>
        <div class="ans-card free ${isCur?'active-now':''}">
        <div style="flex:1">
        <span class="ans-free-text">${sub}</span>
        ${quote?`<div class="ans-free-sub">${quote}</div>`:''}
        </div>
        </div>`;
        row.querySelector('.ans-card').addEventListener('click',()=>openModal(null,startTime));
        return row;
    }

    function makeTask(task,durMin,isToday,isPast,cur,tMin,tEnd) {
        const isCur=isToday&&cur>=tMin&&cur<tEnd;
        const linePast=isPast||(isToday&&tMin<cur);
        const src=getTaskSource(task); const status=normalizeStatus(src); const done=isTaskDone(src);
        const pct=isCur?Math.max(0,Math.min(100,((cur-tMin)/Math.max(1,durMin))*100)):0;
        const row=document.createElement('div'); row.className='ans-row'; row.style.minHeight=Math.max(52,durMin*1.2)+'px';
        row.innerHTML=`
        ${isCur?`<div class="ans-live-line" style="top:${pct}%;"><span class="ans-live-label">${timeFromMin(cur)}</span></div>`:''}
        <div class="ans-time-col">
        <span class="ans-start-time">${task.time}</span>
        ${task.endTime?`<span class="ans-end-time">bis ${task.endTime}</span>`:''}
        <div class="ans-dot ${linePast?'past':''} ${isCur?'current':''}"></div>
        <div class="ans-line ${linePast?'past':''}"></div>
        </div>
        <div class="ans-card ${done?'completed':''} ${isCur?'active-now':''} ${linePast&&!isCur?'past':''}">
        <div class="ans-card-left">
        <span class="ans-emoji">${task.icon||'📋'}</span>
        <div class="ans-text">
        <span class="ans-title">${task.title}${isCur?'<span class="ans-live-dot"></span>':''}</span>
        ${task.notes?`<span class="ans-note">${task.notes}</span>`:''}
        <span class="ans-dur">${minToStr(durMin)}</span>
        </div>
        </div>
        ${isTaskCheckable(src)?makeStatusDots(status):''}
        </div>`;
        const card=row.querySelector('.ans-card');
        card.addEventListener('click',()=>openModal(task));
        // swipe right to cycle status
        let sx=0,sy=0,cx=0,drag=false;
        card.addEventListener('touchstart',e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; drag=true; cx=0; card.style.transition='none'; },{passive:true});
        card.addEventListener('touchmove',e=>{ if(!drag) return; const t=e.touches[0]; const dx=t.clientX-sx,dy=t.clientY-sy; if(Math.abs(dy)>Math.abs(dx)) return; e.preventDefault(); cx=dx; card.style.transform=`translateX(${Math.max(-80,Math.min(80,dx))}px)`; },{passive:false});
        card.addEventListener('touchend',()=>{
            drag=false; card.style.transition='transform .18s'; card.style.transform='';
            if(cx>55){
                const ns=nextStatus(status);
                if(task.isRoutine&&task.routineId){ markRoutineStatus(selectedDateStr,task.routineId,ns); }
                else {
                    const store=loadData(); ensureDay(store,selectedDateStr);
                    const tid=src.id||src.baseId;
                    const idx=(store[selectedDateStr]||[]).findIndex(x=>x.id===tid);
                    if(idx!==-1){ store[selectedDateStr][idx].status=ns; store[selectedDateStr][idx].completed=ns==='done'; saveData(store); }
                }
                renderAnstehend();
            }
        });
        return row;
    }

    function makeStatusDots(status) {
        let cls=status==='done'?'filled-green':status==='in-progress'?'filled-yellow':'filled-red';
        const idx=['not-started','in-progress','done'].indexOf(status);
        let html='<div class="ans-status">';
        ['not-started','in-progress','done'].forEach((_,i)=>{
            const fill=i<idx?' filled-green':i===idx?` ${cls}`:'';
            html+=`<span class="ans-stat-dot${fill}"></span>`;
        });
        return html+'</div>';
    }

    // ─── MODAL ───────────────────────────────────────────────────────────────────
    function openModal(task=null, presetTime=null) {
        if(!modal) return;
        iconPickerOpen=false; if(iconPicker) iconPicker.style.display='none';
        const s=loadSettings();

        if(task){
            task=getTaskSource(task);
            // Wake/sleep redirect to settings
            if(task.id==='__aufstehen__'||task.id==='__schlafen__'){ switchTab('einstellungen'); return; }
            editingTaskId=task.id; editingRoutineId=task.isRoutine?task.routineId:null;
            if(modalTitleEl) modalTitleEl.textContent='Aufgabe bearbeiten';
            if(inputTitle)   inputTitle.value=task.title;
            if(inputTime)    inputTime.value=task.time;
            if(inputEndTime) inputEndTime.value=task.endTime||'';
            if(inputNotes)   inputNotes.value=task.notes||'';
            if(inputAdditionalTimes) inputAdditionalTimes.value=task.additionalTimes||'';
            const checkBtn = $('task-checkable-btn');
            if(checkBtn) checkBtn.textContent = (task.checkable !== false) ? 'Ja' : 'Nein';
            selectedIcon=task.icon||'📋'; if(iconDisplay) iconDisplay.textContent=selectedIcon;
            if(inputNotifyBefore) inputNotifyBefore.checked=task.notifyBefore!==false;
            if(inputNotifyStart)  inputNotifyStart.checked=task.notifyStart!==false;
            if(inputNotifyEnd)    inputNotifyEnd.checked=task.notifyEnd!==false;
            modalSelectedStatus=task.status||(task.isRoutine?getRoutineStatus(selectedDateStr,task.routineId):'not-started');
            const rdays=task.repeatDays||[];
            if(inputRepeatMon) inputRepeatMon.checked=rdays.includes(1);
            if(inputRepeatTue) inputRepeatTue.checked=rdays.includes(2);
            if(inputRepeatWed) inputRepeatWed.checked=rdays.includes(3);
            if(inputRepeatThu) inputRepeatThu.checked=rdays.includes(4);
            if(inputRepeatFri) inputRepeatFri.checked=rdays.includes(5);
            if(inputRepeatSat) inputRepeatSat.checked=rdays.includes(6);
            if(inputRepeatSun) inputRepeatSun.checked=rdays.includes(0);
            if(btnDelete) btnDelete.style.display='block';
        } else {
            editingTaskId=null; editingRoutineId=null;
            if(modalTitleEl) modalTitleEl.textContent='Neue Aufgabe';
            if(inputTitle)   inputTitle.value='';
            if(inputTime)    inputTime.value=presetTime||currentTimeRounded();
            if(inputEndTime) inputEndTime.value='';
            if(inputNotes)   inputNotes.value='';
            if(inputAdditionalTimes) inputAdditionalTimes.value='';
            const checkBtn = $('task-checkable-btn');
            if(checkBtn) checkBtn.textContent = 'Ja';
            selectedIcon='📋'; if(iconDisplay) iconDisplay.textContent='📋';
            if(inputNotifyBefore) inputNotifyBefore.checked=s.notifyBefore;
            if(inputNotifyStart)  inputNotifyStart.checked=s.notifyStart;
            if(inputNotifyEnd)    inputNotifyEnd.checked=s.notifyEnd;
            [inputRepeatMon,inputRepeatTue,inputRepeatWed,inputRepeatThu,inputRepeatFri,inputRepeatSat,inputRepeatSun].forEach(el=>{ if(el) el.checked=false; });
            if(btnDelete) btnDelete.style.display='none';
            modalSelectedStatus='not-started';
        }
        modal.classList.add('open');
        updateModalUI();
        setTimeout(()=>{ if(inputTitle) inputTitle.focus(); },250);
    }

    function closeModal() { if(modal) modal.classList.remove('open'); }

    function currentTimeRounded() {
        const n=new Date(); return timeFromMin((Math.ceil((n.getHours()*60+n.getMinutes())/30)*30)%1440);
    }

    function updateModalUI() {
        // Repeat labels
        [[inputRepeatMon,1],[inputRepeatTue,2],[inputRepeatWed,3],[inputRepeatThu,4],[inputRepeatFri,5],[inputRepeatSat,6],[inputRepeatSun,0]].forEach(([el])=>{
            if(!el) return; const lbl=el.closest('label'); if(lbl) lbl.classList.toggle('active',el.checked);
        });
            // Notify buttons
            document.querySelectorAll('#task-notify-toggle-group .modal-notify-btn').forEach(btn=>{
                const t=$(btn.dataset.target); btn.classList.toggle('active',t&&t.checked);
            });
            // Status buttons
            if(statusToggleGroup) statusToggleGroup.querySelectorAll('.modal-status-btn').forEach(btn=>{
                btn.classList.toggle('active',btn.dataset.status===modalSelectedStatus);
            });
    }

    function saveModalData() {
        if(!inputTitle||!inputTime) return;
        const title=inputTitle.value.trim(), time=inputTime.value;
        if(!title||!time) return;
        let endTime=inputEndTime?inputEndTime.value:'';
        if(endTime&&toMin(endTime)<=toMin(time)) endTime='';
        const repeatDays=[];
        [[inputRepeatMon,1],[inputRepeatTue,2],[inputRepeatWed,3],[inputRepeatThu,4],[inputRepeatFri,5],[inputRepeatSat,6],[inputRepeatSun,0]].forEach(([el,d])=>{ if(el&&el.checked) repeatDays.push(d); });
        const addTimes=inputAdditionalTimes?inputAdditionalTimes.value.trim():'';
        const checkBtn = $('task-checkable-btn');
        const checkable = checkBtn ? (checkBtn.textContent === 'Ja') : true;
        const status=modalSelectedStatus||'not-started';
        const notifyBefore=inputNotifyBefore?inputNotifyBefore.checked:true;
        const notifyStart=inputNotifyStart?inputNotifyStart.checked:true;
        const notifyEnd=inputNotifyEnd?inputNotifyEnd.checked:false;
        const data=loadData(); if(!data[selectedDateStr]) data[selectedDateStr]=[];
        const base={title,icon:selectedIcon,time,endTime,notes:inputNotes?inputNotes.value.trim():'',additionalTimes:addTimes,checkable,notifyBefore,notifyStart,notifyEnd};

        if(editingRoutineId){
            if(repeatDays.length===0){
                data.__routines__=(data.__routines__||[]).filter(r=>r.id!==editingRoutineId);
                data[selectedDateStr].push({id:Date.now().toString(),...base,status,completed:status==='done'});
            } else {
                const r=data.__routines__.find(r=>r.id===editingRoutineId);
                if(r){ Object.assign(r,base); r.repeatDays=repeatDays; markRoutineStatus(selectedDateStr,r.id,status); }
            }
        } else if(editingTaskId&&editingTaskId!=='__aufstehen__'&&editingTaskId!=='__schlafen__'){
            const idx=(data[selectedDateStr]||[]).findIndex(t=>t.id===editingTaskId);
            if(idx!==-1){
                if(repeatDays.length>0){
                    const r={id:Date.now().toString(),...base,repeatDays,createdAt:selectedDateStr,status:'not-started'};
                    data.__routines__=data.__routines__||[]; data.__routines__.push(r);
                    data[selectedDateStr].splice(idx,1);
                } else {
                    Object.assign(data[selectedDateStr][idx],base);
                    if(!data[selectedDateStr][idx].status) data[selectedDateStr][idx].status='not-started';
                }
            }
        } else if(repeatDays.length>0){
            const r={id:Date.now().toString(),...base,repeatDays,createdAt:selectedDateStr,status:'not-started'};
            data.__routines__=data.__routines__||[]; data.__routines__.push(r);
        } else {
            data[selectedDateStr].push({id:Date.now().toString(),...base,status,completed:status==='done'});
        }
        saveData(data); closeModal(); renderAnstehend(); renderHeuteTab(); checkDueNotifications();
    }

    function deleteCurrentTask() {
        const data=loadData();
        if(editingRoutineId){ data.__routines__=(data.__routines__||[]).filter(r=>r.id!==editingRoutineId); }
        else if(editingTaskId&&editingTaskId!=='__aufstehen__'&&editingTaskId!=='__schlafen__'&&data[selectedDateStr]){
            data[selectedDateStr]=data[selectedDateStr].filter(t=>t.id!==editingTaskId);
        }
        saveData(data); closeModal(); renderAnstehend(); renderHeuteTab();
    }

    // ─── HEUTE TAB ───────────────────────────────────────────────────────────────
    function renderHeuteTab() {
        const now=new Date(); const hour=now.getHours();
        const greeting=hour<5?'Gute Nacht':hour<12?'Guten Morgen':hour<17?'Guten Tag':'Guten Abend';
        const nameEl=$('hero-greeting'); if(nameEl) nameEl.textContent=greeting;
        const nm=$('hero-name'); if(nm) nm.textContent=localStorage.getItem('planner_name')||'Marten';
        const de=$('hero-date'); if(de){
            const wd=WOCHENTAGE_LANG[now.getDay()];
            de.textContent=`${wd}, ${now.getDate()}. ${MONATE[now.getMonth()]}`;
        }

        // Sleep countdown
        const sleepBanner=$('heute-sleep-banner');
        const sleepVal=$('heute-sleep-val');
        const sleepTimeEl=$('heute-sleep-time');
        if(sleepBanner&&sleepVal&&sleepTimeEl){
            const st=getSleepTime(); const sm=toMin(st); const cur=nowMin();
            sleepTimeEl.textContent=st;
            if(cur<sm){ const rem=sm-cur; const h=Math.floor(rem/60),m=rem%60; sleepVal.textContent=h>0?`in ${h}h${m>0?' '+m+'min':''}`:`in ${m} min`; sleepBanner.style.display='flex'; }
            else sleepBanner.style.display='none';
        }

        // Next event
        const nextCard=$('heute-next-card');
        if(nextCard){
            const cur=nowMin();
            const next=getDayTasksReal(todayStr()).filter(t=>t.time&&toMin(t.time)>cur).sort((a,b)=>toMin(a.time)-toMin(b.time))[0];
            if(next){
                const diff=toMin(next.time)-cur;
                const ni=$('heute-next-icon'); const nt=$('heute-next-title'); const ntm=$('heute-next-time');
                if(ni) ni.textContent=next.icon||'📋';
                if(nt) nt.textContent=next.title;
                if(ntm) ntm.textContent=diff<=60?`in ${minToStr(diff)}`:`um ${next.time}`;
                nextCard.style.display='block';
            } else nextCard.style.display='none';
        }

        // Stats
        const all=getDayTasksReal(todayStr());
        const open=all.filter(t=>normalizeStatus(t)==='not-started').length;
        const prog=all.filter(t=>normalizeStatus(t)==='in-progress').length;
        const done=all.filter(t=>normalizeStatus(t)==='done').length;
        const so=$('heute-stat-open'); if(so) so.textContent=open;
        const sp=$('heute-stat-progress'); if(sp) sp.textContent=prog;
        const sd=$('heute-stat-done'); if(sd) sd.textContent=done;

        // Task list
        const taskList=$('heute-task-list');
        if(taskList){
            taskList.innerHTML='';
            const visible=all.filter(t=>normalizeStatus(t)!=='done').sort((a,b)=>toMin(a.time)-toMin(b.time));
            if(visible.length===0){
                taskList.innerHTML='<div class="heute-task-empty">Alle Aufgaben erledigt 🎉</div>';
            } else {
                visible.forEach(task=>{
                    const item=document.createElement('div'); item.className='heute-task-item';
                    const status=normalizeStatus(task);
                    item.innerHTML=`
                    <div class="hti-icon">${task.icon||'📋'}</div>
                    <div class="hti-info">
                    <div class="hti-title">${task.title}</div>
                    <div class="hti-meta">${task.time||''}${task.endTime?' – '+task.endTime:''}</div>
                    </div>
                    <span class="hti-status ${status}"></span>`;
                    item.addEventListener('click',()=>openModal(task));
                    taskList.appendChild(item);
                });
            }
        }
    }

    // ─── SETTINGS UI ─────────────────────────────────────────────────────────────
    function updateSettingsUI() {
        const s=loadSettings();
        const theme=localStorage.getItem('planner_theme')||'auto';
        ['auto','light','dark'].forEach(t=>{ const el=$(`theme-${t}`); if(el) el.classList.toggle('active',t===theme); });

        const nb=$('notify-before-toggle'); if(nb) nb.textContent=s.notifyBefore?'Ein':'Aus';
        const ns=$('notify-start-toggle');  if(ns) ns.textContent=s.notifyStart?'Ein':'Aus';
        const ne=$('notify-end-toggle');    if(ne) ne.textContent=s.notifyEnd?'Ein':'Aus';

        const ntfy=$('settings-ntfy-topic'); if(ntfy) ntfy.value=localStorage.getItem('planner_ntfy_topic')||'';
        const nameInp=$('settings-name'); if(nameInp) nameInp.value=localStorage.getItem('planner_name')||'Marten';
        const wake=$('settings-wake-time');  if(wake)  wake.value=getWakeTime();
        const sleep=$('settings-sleep-time');if(sleep) sleep.value=getSleepTime();
    }

    // ─── TAB SWITCHING ───────────────────────────────────────────────────────────
    function switchTab(tab) {
        closeModal();
        document.querySelectorAll('.tab-view').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
        const tabEl=$(`tab-${tab}`); if(tabEl) tabEl.classList.add('active');
        const btnEl=document.querySelector(`.nav-btn[data-tab="${tab}"]`); if(btnEl) btnEl.classList.add('active');
        if(tab==='anstehend'){ renderWeekStrip(); renderAnstehend(); }
        else if(tab==='einstellungen') updateSettingsUI();
        else if(tab==='heute') renderHeuteTab();
    }

    function changeWeek(dir) {
        currentDate=new Date(currentDate); currentDate.setDate(currentDate.getDate()+dir*7);
        selectedDateStr=dateStr(currentDate); renderWeekStrip(); renderAnstehend();
    }
    function goToday() { currentDate=new Date(); selectedDateStr=todayStr(); shouldScrollToNow=true; renderWeekStrip(); renderAnstehend(); }

    function copyOldTasks() {
        const tk=todayStr(), pk=getPrevDayKey(tk); const data=loadData();
        const missing=getIncompleteTasks(pk).filter(p=>!(data[tk]||[]).some(t=>t.title===p.title&&t.time===p.time));
        if(!data[tk]) data[tk]=[];
        missing.forEach(t=>{ const c={...t,id:Date.now().toString()+Math.random().toString(36).slice(2),completed:false,status:'not-started'}; delete c.routineId; data[tk].push(c); });
        saveData(data); renderAnstehend(); renderHeuteTab();
    }

    // ─── EVENTS ──────────────────────────────────────────────────────────────────
    function setupEvents() {
        // Nav buttons
        document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
        const addBtn=$('add-task-floating'); if(addBtn) addBtn.addEventListener('click',()=>openModal());

        // Week navigation
        const pw=$('prev-week'); if(pw) pw.onclick=()=>changeWeek(-1);
        const nw=$('next-week'); if(nw) nw.onclick=()=>changeWeek(1);
        const todayBtn=$('btn-ans-today'); if(todayBtn) todayBtn.onclick=goToday;
        const setBtn=$('btn-ans-settings'); if(setBtn) setBtn.onclick=()=>switchTab('einstellungen');

        // Modal
        if(btnCancel)  btnCancel.onclick=closeModal;
        if(btnSave)    btnSave.onclick=saveModalData;
        if(btnDelete)  btnDelete.onclick=deleteCurrentTask;
        if(modalBackdrop) modalBackdrop.onclick=closeModal;
        if(iconDisplay) iconDisplay.addEventListener('click',e=>{ e.stopPropagation(); iconPickerOpen=!iconPickerOpen; if(iconPicker) iconPicker.style.display=iconPickerOpen?'grid':'none'; });

        // Modal status buttons
        if(statusToggleGroup) statusToggleGroup.querySelectorAll('.modal-status-btn').forEach(btn=>btn.addEventListener('click',()=>{ modalSelectedStatus=btn.dataset.status||'not-started'; updateModalUI(); }));

        // Modal notify buttons
        document.querySelectorAll('#task-notify-toggle-group .modal-notify-btn').forEach(btn=>btn.addEventListener('click',()=>{ const t=$(btn.dataset.target); if(t){ t.checked=!t.checked; updateModalUI(); } }));

        // Repeat labels
        [[inputRepeatMon],[inputRepeatTue],[inputRepeatWed],[inputRepeatThu],[inputRepeatFri],[inputRepeatSat],[inputRepeatSun]].forEach(([el])=>{
            if(!el) return;
            const lbl=el.closest('label'); if(!lbl) return;
            lbl.addEventListener('click',e=>{ if(e.target===el) return; e.preventDefault(); el.checked=!el.checked; updateModalUI(); });
            el.addEventListener('change',updateModalUI);
        });

        // Keyboard
        document.addEventListener('keydown',e=>{ if(modal&&modal.classList.contains('open')&&e.key==='Enter'&&e.target.tagName!=='TEXTAREA') saveModalData(); if(e.key==='Escape') closeModal(); });

        // Settings — theme
        const ta=$('theme-auto');  if(ta) ta.onclick=()=>applyTheme('auto');
        const tl=$('theme-light'); if(tl) tl.onclick=()=>applyTheme('light');
        const td=$('theme-dark');  if(td) td.onclick=()=>applyTheme('dark');

        // Settings — notify toggles
        const nbt=$('notify-before-toggle'); if(nbt) nbt.onclick=()=>{ const s=loadSettings(); s.notifyBefore=!s.notifyBefore; saveSettings(s); };
        const nst=$('notify-start-toggle');  if(nst) nst.onclick=()=>{ const s=loadSettings(); s.notifyStart=!s.notifyStart; saveSettings(s); };
        const net=$('notify-end-toggle');    if(net) net.onclick=()=>{ const s=loadSettings(); s.notifyEnd=!s.notifyEnd; saveSettings(s); };

        // Settings — ntfy
        const ntfyInput=$('settings-ntfy-topic');
        if(ntfyInput) ntfyInput.addEventListener('input',()=>localStorage.setItem('planner_ntfy_topic',ntfyInput.value.trim()));
        const ntfyTest=$('btn-ntfy-test');
        if(ntfyTest) ntfyTest.onclick=()=>{
            const topic = (localStorage.getItem('planner_ntfy_topic') || '').trim();
            if(!topic){ alert('Kein ntfy-Topic eingetragen.'); return; }
            fetch('https://ntfy.sh/', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({topic,title:'Planer Test ✓',message:'ntfy funktioniert!',priority:4,tags:['calendar']})
            }).then(r=>{ if(!r.ok) alert('ntfy Fehler '+r.status+': '+r.statusText); else alert('Testnachricht gesendet!'); })
            .catch(e=>alert('ntfy Fehler: '+e.message));
        };
        const ntfyScheduleBtn=$('btn-ntfy-schedule');
        if(ntfyScheduleBtn) ntfyScheduleBtn.onclick=scheduleNtfyForToday;
        const ntfyTest30s=$('btn-ntfy-test30s');
        if(ntfyTest30s) ntfyTest30s.onclick=()=>{
            const topic = (localStorage.getItem('planner_ntfy_topic') || '').trim();
            if(!topic){ alert('Kein ntfy-Topic eingetragen.'); return; }
            fetch('https://ntfy.sh/', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({topic,title:'30s Test',message:'Diese Nachricht kam nach 30s an!',priority:4,tags:['calendar'],delay:'30s'})
            }).then(r=>{ if(!r.ok) alert('ntfy Fehler '+r.status+': '+r.statusText); else alert('Test in 30s geplant! PWA kann geschlossen werden.'); })
            .catch(e=>alert('ntfy Fehler: '+e.message));
        };

        // Modal: Abhakbar Toggle
        const checkBtn = $('task-checkable-btn');
        if(checkBtn) {
            checkBtn.addEventListener('click', () => {
                checkBtn.textContent = checkBtn.textContent === 'Ja' ? 'Nein' : 'Ja';
            });
        }

        // Settings — name
        const nameInp=$('settings-name');
        if(nameInp){ nameInp.addEventListener('input',()=>{ localStorage.setItem('planner_name',nameInp.value.trim()||'Marten'); renderHeuteTab(); }); }

        // Settings — wake/sleep
        const wakeInp=$('settings-wake-time');
        if(wakeInp){ wakeInp.addEventListener('change',()=>{ localStorage.setItem('planner_wake_time',wakeInp.value); renderAnstehend(); renderHeuteTab(); }); }
        const sleepInp=$('settings-sleep-time');
        if(sleepInp){ sleepInp.addEventListener('change',()=>{ localStorage.setItem('planner_sleep_time',sleepInp.value); renderAnstehend(); renderHeuteTab(); }); }

        // Settings — data
        const expBtn=$('btn-export-data');
        if(expBtn) expBtn.onclick=()=>{
            const blob=new Blob([JSON.stringify(loadData(),null,2)],{type:'application/json'});
            const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`planer-${todayStr()}.json`; a.click();
        };
        const impBtn=$('btn-import-data'); const impFile=$('import-file-input');
        if(impBtn&&impFile){ impBtn.onclick=()=>impFile.click(); impFile.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ localStorage.setItem('planner_tasks',JSON.stringify(JSON.parse(r.result))); renderHeuteTab(); renderAnstehend(); alert('Import OK!'); }catch(e){ alert('Fehler: '+e.message); } }; r.readAsText(f); e.target.value=''; }; }

        // Suggestion banner
        if(ansSuggBtn) ansSuggBtn.onclick=copyOldTasks;

        // Heute → Planer
        const goTL=$('heute-go-timeline');
        if(goTL) goTL.addEventListener('click',()=>{ goToday(); switchTab('anstehend'); });

        // Design task
        const btnDesign=$('btn-add-design-task');
        if(btnDesign) btnDesign.addEventListener('click',()=>{
            const store=loadData(); const today=todayStr(); ensureDay(store,today);
            if(!store[today].find(t=>t.title==='Design-Reflexion')){
                store[today].push({id:'design-'+Date.now(),title:'Design-Reflexion',icon:'🎨',time:'18:00',endTime:'18:15',notes:'Beobachte eine App: Klarheit, Deferenz oder Tiefe?',status:'not-started',checkable:true});
                saveData(store); renderHeuteTab();
            }
            btnDesign.textContent='✓ Hinzugefügt'; btnDesign.classList.add('added');
            setTimeout(()=>{ btnDesign.textContent='Hinzufügen'; btnDesign.classList.remove('added'); },2000);
        });

        // Service worker
        if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }

    // ─── INIT ────────────────────────────────────────────────────────────────────
    applyTheme(localStorage.getItem('planner_theme')||'auto');
    buildIconPicker();
    renderWeekStrip();
    renderAnstehend();
    renderHeuteTab();
    setupEvents();
    updateSettingsUI();
    if ('Notification' in window) Notification.requestPermission();
});
