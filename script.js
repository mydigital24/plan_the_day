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
    let inboxTodos = [];
    let inboxFilter = 'alle';
    let inboxModalLabel = 'arbeit';

    // ─── CONSTANTS ───────────────────────────────────────────────────────────────
    const MONATE      = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const WOCHENTAGE  = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    const WOCHENTAGE_LANG = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const ICONS = ['📋','✅','⚡','🎯','💪','🧠','💼','📚','🏃','🚴','🧘','🍎','☕','🍽️','🛒','🏋️','😴','🌅','⏰','📅','💻','📱','❤️','🎨','📎','🔒','✈️','🛏️','🎵','🎬','🧾','🧹','🛠️','🎁','💡','📈','🧪','🥗','🍹','🧳','☀️','🌙','🌈','🥇','🧩'];
    const MOTIVATIONS = ['Kurze Pause ☀️','Jetzt durchatmen. 🌿','Ein Moment für dich. 🧘','Aufladen für das Nächste. ⚡'];
    const DEFAULT_SETTINGS = { notifyBefore: true, notifyStart: true, notifyEnd: true };
    const NOTIFY_OFFSET = 5;
    const DEFAULT_LABELS = [
        { id:'arbeit', name:'Arbeit', color:'#007AFF' },
        { id:'privat', name:'Privat', color:'#AF52DE' },
        { id:'einkauf', name:'Einkauf', color:'#34C759' },
        { id:'idee', name:'Idee', color:'#FF9500' },
        { id:'sonstiges', name:'Sonstiges', color:'#8E8E93' },
    ];

    // ─── DOM REFS ────────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const escHtml = s => { const d=document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; };
    const trunc = (s,n=20) => s&&s.length>n ? s.slice(0,n)+'…' : s||'';
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

    // ─── INBOX STORAGE ────────────────────────────────────────────────────────────
    function loadInbox() {
        try { inboxTodos = JSON.parse(localStorage.getItem('planner_inbox')) || []; } catch(e) { inboxTodos = []; }
        inboxTodos.forEach(t=>{ if(t.notes===undefined) t.notes=''; if(t.deadline===undefined) t.deadline=''; });
    }
    function saveInbox() { localStorage.setItem('planner_inbox', JSON.stringify(inboxTodos)); }
    function addInboxTodo(text, label, notes, deadline) {
        inboxTodos.push({ id: Date.now().toString(), text, done: false, label, notes: notes||'', deadline: deadline||'', createdAt: new Date().toISOString() });
        saveInbox(); renderInboxTab();
    }
    function toggleInboxTodo(id) {
        const todo = inboxTodos.find(t => t.id === id);
        if (todo) { todo.done = !todo.done; saveInbox(); renderInboxTab(); }
    }
    function deleteInboxTodo(id) {
        inboxTodos = inboxTodos.filter(t => t.id !== id);
        saveInbox(); renderInboxTab();
    }
    function getFilteredInboxTodos(label) {
        return label === 'alle' ? inboxTodos : inboxTodos.filter(t => t.label === label);
    }

    // ─── LABELS ──────────────────────────────────────────────────────────────────
    function loadLabels() {
        try { return JSON.parse(localStorage.getItem('planner_labels')) || DEFAULT_LABELS; } catch(e) { return DEFAULT_LABELS; }
    }
    function saveLabels(labels) { localStorage.setItem('planner_labels', JSON.stringify(labels)); }
    function renderLabelsList() {
        const list = $('labels-list'); if(!list) return;
        const labels = loadLabels();
        list.innerHTML = labels.map((l,i) =>
            `<div class="e-row" style="padding:10px 0;">
                <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${l.color};flex-shrink:0;box-shadow:0 0 0 1px rgba(0,0,0,0.1);"></span>
                <span style="flex:1;margin-left:10px;font-size:16px;font-weight:500;color:var(--text);">${escHtml(l.name)}</span>
                <input type="color" value="${l.color}" data-label-idx="${i}" class="e-color-input" style="width:30px;height:30px;margin-right:6px;" title="Farbe ändern">
                <button class="e-action" data-label-idx="${i}" style="color:#FF3B30;font-size:15px;">Löschen</button>
            </div>`
        ).join('');
        // Delete buttons
        list.querySelectorAll('button[data-label-idx]').forEach(btn=>{
            btn.addEventListener('click',()=>{
                const labels=loadLabels(); const idx=parseInt(btn.dataset.labelIdx);
                labels.splice(idx,1); saveLabels(labels);
                renderLabelsList(); renderInboxTab(); renderInboxFilterPills();
            });
        });
        // Color pickers
        list.querySelectorAll('input[type="color"][data-label-idx]').forEach(inp=>{
            inp.addEventListener('input',()=>{
                const labels=loadLabels(); const idx=parseInt(inp.dataset.labelIdx);
                if(labels[idx]){ labels[idx].color=inp.value; saveLabels(labels); renderLabelsList(); renderInboxTab(); renderInboxFilterPills(); }
            });
        });
    }
    function renderInboxFilterPills() {
        const area=$('inbox-filter'); if(!area) return;
        const labels=loadLabels();
        area.innerHTML='<button class="inbox-filter-pill'+(inboxFilter==='alle'?' active':'')+'" data-label="alle">Alle</button>'+
            labels.map(l=>`<button class="inbox-filter-pill${inboxFilter===l.id?' active':''}" data-label="${l.id}">${escHtml(l.name)}</button>`).join('');
        area.querySelectorAll('.inbox-filter-pill').forEach(pill=>{
            pill.addEventListener('click',()=>{
                inboxFilter=pill.dataset.label;
                renderInboxFilterPills();
                renderInboxTab();
            });
        });
    }

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

        // Ideas with deadline today
        loadInbox();
        const todayDl = todayStr();
        inboxTodos.forEach(todo => {
            if(!todo.deadline || !todo.deadline.includes(todayDl) || todo.done) return;
            const dlTime = todo.deadline.split('T')[1];
            if(!dlTime) return;
            const [dh, dm] = dlTime.split(':').map(Number);
            const t = new Date();
            t.setHours(dh, dm, 0, 0);
            sendScheduled('Idee fällig: '+todo.text, `Deadline um ${dlTime}`, t);
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

    function applyAccent(color) {
        const r=document.documentElement;
        r.style.setProperty('--accent',color);
        // compute dim variant
        const hex=color.replace('#','');
        const dim='#'+[0,2,4].map(i=>Math.round(parseInt(hex.substr(i,2),16)*.55).toString(16).padStart(2,'0')).join('');
        r.style.setProperty('--accent-dim',dim);
    }

    // ─── ICAL ───────────────────────────────────────────────────────────────────
    function icalDate(d) {
        return d.getFullYear().toString()+
            String(d.getMonth()+1).padStart(2,'0')+
            String(d.getDate()).padStart(2,'0')+'T'+
            String(d.getHours()).padStart(2,'0')+
            String(d.getMinutes()).padStart(2,'0')+'00';
    }

    function exportIcal() {
        const data=loadData();
        const now=new Date();
        const lines=[
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Planer//DE',
            'CALSCALE:GREGORIAN',
        ];

        // Flache Termine
        Object.keys(data).forEach(ds=>{
            if(ds==='__routines__'||ds==='__inbox__') return;
            (data[ds]||[]).forEach(t=>{
                if(!t.time) return;
                const start=new Date(ds+'T'+t.time);
                const end=t.endTime?new Date(ds+'T'+t.endTime):new Date(start.getTime()+30*60000);
                lines.push('BEGIN:VEVENT');
                lines.push('UID:'+t.id+'-'+ds+'@planer');
                lines.push('DTSTART:'+icalDate(start));
                lines.push('DTEND:'+icalDate(end));
                lines.push('SUMMARY:'+t.title);
                if(t.notes) lines.push('DESCRIPTION:'+t.notes.replace(/\n/g,'\\n'));
                lines.push('END:VEVENT');
            });
        });

        // Routinen (wöchentlich wiederholend)
        (data.__routines__||[]).forEach(r=>{
            if(!r.time) return;
            const startMin=toMin(r.time);
            const endMin=r.endTime?toMin(r.endTime):startMin+30;
            const days=r.repeatDays||[];
            days.forEach(dow=>{
                const startDate=new Date(now);
                startDate.setDate(now.getDate()+(dow-now.getDay()+7)%7);
                startDate.setHours(Math.floor(startMin/60),startMin%60,0,0);
                const endDate=new Date(startDate.getTime()+(endMin-startMin)*60000);
                lines.push('BEGIN:VEVENT');
                lines.push('UID:'+r.id+'-'+dow+'@planer');
                lines.push('DTSTART:'+icalDate(startDate));
                lines.push('DTEND:'+icalDate(endDate));
                lines.push('RRULE:FREQ=WEEKLY;BYDAY='+['SU','MO','TU','WE','TH','FR','SA'][dow]);
                lines.push('SUMMARY:'+r.title);
                if(r.notes) lines.push('DESCRIPTION:'+r.notes.replace(/\n/g,'\\n'));
                lines.push('END:VEVENT');
            });
        });

        lines.push('END:VCALENDAR');
        const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`planer-${todayStr()}.ics`; a.click();
    }

    function importIcal(icsText) {
        const data=loadData();
        const veventRe=/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
        let match;
        while((match=veventRe.exec(icsText))!==null){
            const block=match[1];
            const get=(name)=>{ const r=new RegExp('^'+name+':(.+)$','m').exec(block); return r?r[1].trim():''; };
            const dtstart=get('DTSTART');
            const dtend=get('DTEND');
            const summary=get('SUMMARY');
            const description=get('DESCRIPTION');
            const rrule=get('RRULE');
            if(!dtstart||!summary) continue;
            // DTSTART: 20250101T120000
            const datePart=dtstart.substring(0,8);
            const timePart=dtstart.length>=15?dtstart.substring(9,15):'120000';
            const ds=datePart.substring(0,4)+'-'+datePart.substring(4,6)+'-'+datePart.substring(6,8);
            const time=timePart.substring(0,2)+':'+timePart.substring(2,4);
            const endTime=dtend&&dtend.length>=15?dtend.substring(9,11)+':'+dtend.substring(11,13):'';
            ensureDay(data,ds);
            if(rrule&&rrule.includes('WEEKLY')){
                const days=rrule.match(/BYDAY=([A-Z,]+)/);
                if(days){
                    const dowMap={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
                    const repeatDays=days[1].split(',').map(d=>dowMap[d]).filter(d=>d!==undefined);
                    if(repeatDays.length){
                        data.__routines__=data.__routines__||[];
                        data.__routines__.push({
                            id:'ical-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),
                            title:summary,
                            icon:'📅',
                            time,
                            endTime,
                            notes:description,
                            repeatDays,
                            status:'not-started',
                            createdAt:ds,
                        });
                        continue;
                    }
                }
            }
            data[ds].push({
                id:'ical-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),
                title:summary,
                icon:'📅',
                time,
                endTime,
                notes:description,
                status:'not-started',
                checkable:true,
                completed:false,
            });
        }
        saveData(data);
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
        ${task.notes?`<span class="ans-note" title="${escHtml(task.notes)}">${trunc(task.notes)}</span>`:''}
        <span class="ans-dur">${minToStr(durMin)}</span>
        </div>
        </div>
        ${isTaskCheckable(src)?makeStatusDots(status):''}
        </div>`;
        const card=row.querySelector('.ans-card');
        card.addEventListener('click',()=>openModal(task));
        const noteSpan=row.querySelector('.ans-note');
        if(noteSpan) noteSpan.addEventListener('click',e=>{ e.stopPropagation(); alert(task.notes); });
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
            // Linked idea
            const linkedSelect=$('task-linked-idea');
            if(linkedSelect){
                loadInbox();
                linkedSelect.innerHTML='<option value="">– keine –</option>'+
                    inboxTodos.filter(t=>!t.done).map(t=>`<option value="${t.id}"${t.id===task.ideaId?' selected':''}>💡 ${escHtml(t.text)}</option>`).join('');
            }
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
            const linkedSelect=$('task-linked-idea');
            if(linkedSelect){
                loadInbox();
                linkedSelect.innerHTML='<option value="">– keine –</option>'+
                    inboxTodos.filter(t=>!t.done).map(t=>`<option value="${t.id}">💡 ${escHtml(t.text)}</option>`).join('');
            }
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
        const linkedIdea = $('task-linked-idea');
        const ideaId = linkedIdea ? linkedIdea.value : '';
        const data=loadData(); if(!data[selectedDateStr]) data[selectedDateStr]=[];
        const base={title,icon:selectedIcon,time,endTime,notes:inputNotes?inputNotes.value.trim():'',additionalTimes:addTimes,checkable,notifyBefore,notifyStart,notifyEnd,ideaId};

        // If status is done, also mark linked idea done
        if(status==='done' && ideaId){
            loadInbox();
            const idea = inboxTodos.find(t=>t.id===ideaId);
            if(idea && !idea.done){ idea.done = true; saveInbox(); }
        }

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
                    data[selectedDateStr][idx].status = status;
                    data[selectedDateStr][idx].completed = status==='done';
                }
            }
        } else if(repeatDays.length>0){
            const r={id:Date.now().toString(),...base,repeatDays,createdAt:selectedDateStr,status:'not-started'};
            data.__routines__=data.__routines__||[]; data.__routines__.push(r);
        } else {
            data[selectedDateStr].push({id:Date.now().toString(),...base,status,completed:status==='done'});
        }
        saveData(data); closeModal(); renderAnstehend(); renderHeuteTab();
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

        // Random quote
        const qEl=$('hero-quote');
        if(qEl){
            const quotes=[
                'Der beste Zeitpunkt war gestern, der zweitbeste ist jetzt.',
                'Kleine Schritte führen auch ans Ziel.',
                'Du musst nicht perfekt sein, um anzufangen.',
                'Jeder Tag ist eine neue Chance.',
                'Konzentriere dich auf das Wesentliche.',
                'Erst die Arbeit, dann das Vergnügen.',
                'Ordnung ist das halbe Leben.',
                'Tu heute etwas, worauf du morgen stolz sein kannst.',
            ];
            const dayOfYear=Math.floor((now-new Date(now.getFullYear(),0,0))/864e5);
            qEl.textContent=quotes[dayOfYear%quotes.length];
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

        // Next idea deadline (today or future)
        const nextIdeaCard=$('heute-next-idea-card');
        if(nextIdeaCard){
            loadInbox();
            const today=todayStr();
            const nowMinNum=nowMin();
            const upcoming = inboxTodos
                .filter(t=>!t.done && t.deadline)
                .sort((a,b)=> (a.deadline||'').localeCompare(b.deadline||''))[0];
            if(upcoming){
                const ni=$('heute-next-idea-icon'); const nt=$('heute-next-idea-title'); const ntm=$('heute-next-idea-time');
                if(ni) ni.textContent='💡';
                if(nt) nt.textContent=upcoming.text;
                if(ntm){
                    const dlDate=upcoming.deadline.split('T')[0];
                    const dlTime=upcoming.deadline.split('T')[1]||'';
                    if(dlDate===today){
                        if(dlTime){
                            const dlMin=toMin(dlTime);
                            const diff=dlMin-nowMinNum;
                            ntm.textContent=diff>0 ? `in ${minToStr(diff)}` : `um ${dlTime}`;
                        } else ntm.textContent='Heute';
                    } else {
                        ntm.textContent=dlDate;
                    }
                }
                nextIdeaCard.style.display='block';
            } else nextIdeaCard.style.display='none';
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

    // ─── INBOX TAB ───────────────────────────────────────────────────────────────
    function renderInboxTab() {
        const list = $('inbox-list');
        if (!list) return;
        const filtered = getFilteredInboxTodos(inboxFilter);
        const labels=loadLabels();
        if (filtered.length === 0) {
            list.innerHTML = '<div class="inbox-empty"><div class="inbox-empty-icon">📥</div><div class="inbox-empty-title">Inbox leer</div><div class="inbox-empty-desc">Tippe auf +, um eine neue Idee zu notieren</div></div>';
            return;
        }
        list.innerHTML = '';
        filtered.forEach(todo => {
            const item = document.createElement('div'); item.className = 'inbox-item' + (todo.done ? ' done' : '');
            const cb = document.createElement('div');
            cb.className = 'inbox-checkbox' + (todo.done ? ' checked' : '');
            cb.addEventListener('click', e => { e.stopPropagation(); toggleInboxTodo(todo.id); });
            const text = document.createElement('span'); text.className = 'inbox-item-text'; text.textContent = todo.text;
            const chip = document.createElement('span');
            const lbl = labels.find(l=>l.id===todo.label);
            chip.textContent = lbl ? lbl.name : todo.label;
            chip.style.background = lbl ? lbl.color+'26' : 'var(--fill)';
            chip.style.color = lbl ? lbl.color : 'var(--text-secondary)';
            item.appendChild(cb); item.appendChild(text);
            // task link indicator
            const taskData = loadData();
            const isLinked = Object.keys(taskData).some(ds => {
                if(ds==='__routines__'||ds==='__routineHistory__'||ds==='__inbox__') return false;
                return (taskData[ds]||[]).some(t=>t.ideaId===todo.id);
            });
            if(isLinked){
                const linkIcon=document.createElement('span');
                linkIcon.textContent='🔗';
                linkIcon.style.fontSize='11px'; linkIcon.style.marginRight='4px'; linkIcon.style.flexShrink='0';
                linkIcon.title='Mit einer Aufgabe verknüpft';
                item.appendChild(linkIcon);
            }
            // deadline indicator
            if(todo.deadline){
                const dl = document.createElement('span');
                dl.style.fontSize='11px'; dl.style.color='var(--text-secondary)'; dl.style.marginRight='4px'; dl.style.flexShrink='0';
                const dlDate = todo.deadline.split('T')[0];
                const today = todayStr();
                if(dlDate === today) dl.textContent='📅 Heute';
                else if(dlDate < today) dl.textContent='📅 Überfällig';
                else dl.textContent='📅 '+dlDate;
                item.appendChild(dl);
            }
            item.appendChild(chip);
            // notes indicator (truncated inline)
            if(todo.notes){
                const noteText=document.createElement('span');
                noteText.textContent=trunc(todo.notes,20);
                noteText.style.fontSize='12px'; noteText.style.color='var(--text-tertiary)'; noteText.style.marginLeft='6px';
                noteText.style.whiteSpace='nowrap'; noteText.style.overflow='hidden'; noteText.style.textOverflow='ellipsis';
                noteText.style.maxWidth='120px'; noteText.style.cursor='pointer';
                noteText.title=todo.notes;
                noteText.addEventListener('click',e=>{ e.stopPropagation(); alert(todo.notes); });
                item.insertBefore(noteText, chip);
            }
            // click to edit
            item.addEventListener('click', ()=>openInboxModal(todo));
            let sx = 0, cx = 0, drag = false;
            item.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; drag = true; cx = 0; item.style.transition = 'none'; }, { passive: true });
            item.addEventListener('touchmove', e => { if (!drag) return; const t = e.touches[0]; const dx = t.clientX - sx; if (Math.abs(dx) < 10) return; e.preventDefault(); cx = dx; item.style.transform = `translateX(${Math.max(0, dx)}px)`; item.style.opacity = Math.max(0, 1 - dx / 200); }, { passive: false });
            item.addEventListener('touchend', () => {
                drag = false; item.style.transition = 'transform .2s, opacity .2s';
                if (cx > 120) { item.classList.add('swiped'); setTimeout(() => deleteInboxTodo(todo.id), 200); }
                else { item.style.transform = ''; item.style.opacity = ''; }
            });
            list.appendChild(item);
        });
    }

    // ─── INBOX MODAL ─────────────────────────────────────────────────────────────
    let inboxEditingId = null;
    function openInboxModal(todo) {
        const m = $('inbox-modal');
        if (!m) return;
        const input = $('inbox-modal-input');
        const notesInput = $('inbox-modal-notes');
        const deadlineDate = $('inbox-modal-deadline-date');
        const deadlineTime = $('inbox-modal-deadline-time');
        const deleteBtn = $('inbox-modal-delete');
        const titleEl = m.querySelector('.modal-header-row h3');
        if (input) input.value = todo ? todo.text : '';
        if (notesInput) notesInput.value = todo ? (todo.notes||'') : '';
        if (deadlineDate) deadlineDate.value = todo ? (todo.deadline ? todo.deadline.split('T')[0] : '') : '';
        if (deadlineTime) deadlineTime.value = todo ? (todo.deadline ? todo.deadline.split('T')[1]||'' : '') : '';
        inboxEditingId = todo ? todo.id : null;
        inboxModalLabel = todo ? todo.label : (loadLabels()[0]?.id||'arbeit');
        if (titleEl) titleEl.textContent = todo ? 'Idee bearbeiten' : 'Neue Idee';
        if (deleteBtn) deleteBtn.style.display = todo ? '' : 'none';
        const picker = $('inbox-label-picker');
        if (picker) {
            const labels=loadLabels();
            picker.innerHTML = labels.map(l=>
                `<button class="inbox-label-opt${inboxModalLabel===l.id?' active':''}" data-label="${l.id}" style="position:relative;padding-left:18px;">
                    <span style="position:absolute;left:6px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:${l.color};"></span>
                    ${escHtml(l.name)}
                </button>`
            ).join('') +
            '<button class="inbox-label-add-btn" id="inbox-label-add-btn">+</button>';
            picker.querySelectorAll('.inbox-label-opt').forEach(b=>{
                b.addEventListener('click',()=>{
                    picker.querySelectorAll('.inbox-label-opt').forEach(x=>x.classList.remove('active'));
                    b.classList.add('active');
                    inboxModalLabel = b.dataset.label;
                });
            });
            const addLbl=$('inbox-label-add-btn');
            if(addLbl) addLbl.addEventListener('click',e=>{
                e.stopPropagation();
                // Replace picker with inline add form
                picker.innerHTML = `
                    <div style="display:flex;gap:6px;padding:8px;width:100%;">
                        <input id="inline-label-name" placeholder="Label-Name" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--separator);background:var(--fill);color:var(--text);font-size:14px;font-family:inherit;outline:none;">
                        <input id="inline-label-color" type="color" value="#007AFF" style="width:36px;height:36px;border:none;padding:0;cursor:pointer;border-radius:6px;">
                        <button id="inline-label-save" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:14px;font-family:inherit;cursor:pointer;">+</button>
                    </div>`;
                const nameInp = picker.querySelector('#inline-label-name');
                const colorInp = picker.querySelector('#inline-label-color');
                const saveBtn = picker.querySelector('#inline-label-save');
                if(nameInp) nameInp.focus();
                if(saveBtn) saveBtn.addEventListener('click',()=>{
                    const name=nameInp?nameInp.value.trim():'';
                    if(!name) return;
                    const id=name.toLowerCase().replace(/\s+/g,'-');
                    const labels=loadLabels();
                    if(labels.find(l=>l.id===id)){ alert('Label existiert bereits.'); return; }
                    labels.push({id,name,color:colorInp?colorInp.value:'#007AFF'});
                    saveLabels(labels);
                    renderLabelsList();
                    renderInboxFilterPills();
                    inboxModalLabel=id;
                    openInboxModal();
                });
            });
        }
        m.classList.add('open');
        setTimeout(() => { if (input) input.focus(); }, 250);
    }
    function closeInboxModal() { const m = $('inbox-modal'); if (m) m.classList.remove('open'); inboxEditingId = null; }

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
        else if(tab==='inbox') { loadInbox(); renderInboxFilterPills(); renderInboxTab(); }
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
        const addBtn=$('add-task-floating');
        if(addBtn) addBtn.addEventListener('click',()=>{
            const m=$('type-picker-modal');
            if(m) m.classList.add('open');
        });
        const typePickAufgabe=$('type-pick-aufgabe');
        if(typePickAufgabe) typePickAufgabe.addEventListener('click',()=>{
            const m=$('type-picker-modal'); if(m) m.classList.remove('open');
            openModal();
        });
        const typePickIdee=$('type-pick-idee');
        if(typePickIdee) typePickIdee.addEventListener('click',()=>{
            const m=$('type-picker-modal'); if(m) m.classList.remove('open');
            switchTab('inbox');
            openInboxModal();
        });
        const typePickCancel=$('type-pick-cancel');
        if(typePickCancel) typePickCancel.addEventListener('click',()=>{
            const m=$('type-picker-modal'); if(m) m.classList.remove('open');
        });
        const typeBackdrop=document.querySelector('#type-picker-modal .modal-backdrop');
        if(typeBackdrop) typeBackdrop.addEventListener('click',()=>{
            const m=$('type-picker-modal'); if(m) m.classList.remove('open');
        });

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

        // Settings — accent color
        const accentInp=$('settings-accent');
        if(accentInp){
            accentInp.value=localStorage.getItem('planner_accent')||'#007AFF';
            accentInp.addEventListener('input',()=>{
                const c=accentInp.value;
                localStorage.setItem('planner_accent',c);
                applyAccent(c);
            });
        }

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
            const exportData=loadData();
            exportData.__inbox__=inboxTodos;
            exportData.__labels__=loadLabels();
            const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
            const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`planer-${todayStr()}.json`; a.click();
        };
        const impBtn=$('btn-import-data'); const impJson=$('import-json-input');
        if(impBtn&&impJson){ impBtn.onclick=()=>impJson.click(); impJson.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result); localStorage.setItem('planner_tasks',JSON.stringify(d)); if(d.__inbox__){ localStorage.setItem('planner_inbox',JSON.stringify(d.__inbox__)); } if(d.__labels__){ localStorage.setItem('planner_labels',JSON.stringify(d.__labels__)); } renderHeuteTab(); renderAnstehend(); loadInbox(); renderInboxFilterPills(); renderInboxTab(); alert('Import OK!'); }catch(e){ alert('Fehler: '+e.message); } }; r.readAsText(f); e.target.value=''; }; }

        // Settings — iCal export
        const expIcalBtn=$('btn-export-ical');
        if(expIcalBtn) expIcalBtn.onclick=exportIcal;

        // Settings — iCal import
        const impIcalBtn=$('btn-import-ical'); const impIcal=$('import-ical-input');
        if(impIcalBtn&&impIcal){ impIcalBtn.onclick=()=>impIcal.click(); impIcal.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ importIcal(r.result); renderHeuteTab(); renderAnstehend(); alert('iCal Import OK!'); }catch(e){ alert('Fehler: '+e.message); } }; r.readAsText(f); e.target.value=''; }; }

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

        // Settings — labels
        const addLabelBtn=$('btn-add-label');
        if(addLabelBtn) addLabelBtn.addEventListener('click',()=>{
            const nameInp=$('settings-new-label'); const colorInp=$('settings-new-label-color');
            if(!nameInp||!nameInp.value.trim()) return;
            const name=nameInp.value.trim(); const color=colorInp?colorInp.value:'#007AFF';
            const id=name.toLowerCase().replace(/\s+/g,'-');
            const labels=loadLabels();
            if(labels.find(l=>l.id===id)){ alert('Label existiert bereits.'); return; }
            labels.push({id,name,color});
            saveLabels(labels);
            renderLabelsList();
            renderInboxFilterPills();
            nameInp.value='';
        });

        // Inbox — add button
        const inboxAddBtn = $('inbox-add-btn');
        if (inboxAddBtn) inboxAddBtn.addEventListener('click', openInboxModal);

        // Inbox — filter pills
        const inboxFilterArea = $('inbox-filter');
        if (inboxFilterArea) {
            inboxFilterArea.querySelectorAll('.inbox-filter-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    inboxFilterArea.querySelectorAll('.inbox-filter-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    inboxFilter = pill.dataset.label;
                    renderInboxTab();
                });
            });
        }

        // Inbox — modal
        const inboxModalCancel = $('inbox-modal-cancel');
        if (inboxModalCancel) inboxModalCancel.onclick = closeInboxModal;
        const inboxModalSave = $('inbox-modal-save');
        if (inboxModalSave) inboxModalSave.onclick = () => {
            const input = $('inbox-modal-input');
            const notesInput = $('inbox-modal-notes');
            const dlDate = $('inbox-modal-deadline-date');
            const dlTime = $('inbox-modal-deadline-time');
            const text = input ? input.value.trim() : '';
            if (!text) return;
            const notes = notesInput ? notesInput.value.trim() : '';
            const deadline = (dlDate&&dlDate.value) ? dlDate.value+'T'+(dlTime&&dlTime.value ? dlTime.value : '00:00') : '';
            if(inboxEditingId){
                const todo = inboxTodos.find(t=>t.id===inboxEditingId);
                if(todo){ todo.text=text; todo.notes=notes; todo.label=inboxModalLabel; todo.deadline=deadline; saveInbox(); renderInboxTab(); }
            } else {
                addInboxTodo(text, inboxModalLabel, notes, deadline);
            }
            closeInboxModal();
        };
        const inboxModalInput = $('inbox-modal-input');
        if (inboxModalInput) inboxModalInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); const save = $('inbox-modal-save'); if (save) save.click(); }
        });
        const inboxBackdrop = document.querySelector('#inbox-modal .modal-backdrop');
        if (inboxBackdrop) inboxBackdrop.onclick = closeInboxModal;
        const inboxDeleteBtn = $('inbox-modal-delete');
        if(inboxDeleteBtn) inboxDeleteBtn.addEventListener('click', ()=>{
            if(inboxEditingId){ deleteInboxTodo(inboxEditingId); closeInboxModal(); }
        });

        // Service worker
        if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }

    // ─── INIT ────────────────────────────────────────────────────────────────────
    applyTheme(localStorage.getItem('planner_theme')||'auto');
    applyAccent(localStorage.getItem('planner_accent')||'#007AFF');
    buildIconPicker();
    renderWeekStrip();
    renderAnstehend();
    renderHeuteTab();
    loadInbox();
    renderInboxFilterPills();
    renderLabelsList();
    setupEvents();
    updateSettingsUI();
    if ('Notification' in window) Notification.requestPermission();
});
