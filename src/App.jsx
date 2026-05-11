import { useState, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const HOURS_PER_DAY = 7.5;
const MONTH_NAMES = ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"];
const DAY_NAMES = ["ma","di","wo","do","vr","za","zo"];

const ENERGY_OPTIONS = [
  { value: "absent",  label: "Afwezig",  color: "#e74c3c" },
  { value: "low",     label: "Laag",     color: "#e74c3c" },
  { value: "normal",  label: "Gewoon",   color: "#27ae60" },
  { value: "high",    label: "Hoog",     color: "#2980b9" },
];

const INSPIRATION_OPTIONS = [
  { value: "distracted", label: "Afgeleid",    color: "#e74c3c" },
  { value: "none",       label: "Geen",        color: "#e74c3c" },
  { value: "motivated",  label: "Gemotiveerd", color: "#27ae60" },
  { value: "genius",     label: "Genie",       color: "#2980b9" },
];

function getDayLogColors(energy, inspiration) {
  const eOpt = ENERGY_OPTIONS.find(o => o.value === energy);
  const iOpt = INSPIRATION_OPTIONS.find(o => o.value === inspiration);
  return {
    energyColor: eOpt?.color || null,
    inspirationColor: iOpt?.color || null,
  };
}

const WEEKDAY_PRESETS = [
  { label: "Dag vrij",             delta: -7.5,  fullDay: true,  vacation: false, sick: false },
  { label: "Halve dag vrij",       delta: -3.75, fullDay: false, vacation: false, sick: false },
  { label: "Eerder weg (2u)",      delta: -2,    fullDay: false, vacation: false, sick: false },
  { label: "Vakantie (dag)",       delta: 0,     fullDay: true,  vacation: true,  sick: false },
  { label: "Vakantie (halve dag)", delta: 0,     fullDay: false, vacation: true,  sick: false },
  { label: "Ziek (dag)",           delta: -7.5,  fullDay: true,  vacation: false, sick: true  },
  { label: "Ziek (halve dag)",     delta: -3.75, fullDay: false, vacation: false, sick: true  },
  { label: "Overwerk (2u)",        delta: 2,     fullDay: false, vacation: false, sick: false },
  { label: "Overwerk (4u)",        delta: 4,     fullDay: false, vacation: false, sick: false },
];

const WEEKEND_PRESETS = [
  { label: "Overwerk (2u)", delta: 2, fullDay: false, vacation: false, sick: false },
  { label: "Overwerk (4u)", delta: 4, fullDay: false, vacation: false, sick: false },
  { label: "Overwerk (8u)", delta: 8, fullDay: false, vacation: false, sick: false },
];

function easterSunday(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100;
  const d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const mo=Math.floor((h+l-7*m+114)/31);
  const day=((h+l-7*m+114)%31)+1;
  return new Date(year,mo-1,day);
}

function dutchHolidays(year) {
  const e=easterSunday(year);
  const add=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return {
    [fmt(new Date(year,0,1))]:   "Nieuwjaarsdag",
    [fmt(add(e,-2))]:            "Goede Vrijdag",
    [fmt(e)]:                    "1e Paasdag",
    [fmt(add(e,1))]:             "2e Paasdag",
    [fmt(new Date(year,3,27))]:  "Koningsdag",
    [fmt(new Date(year,4,5))]:   "Bevrijdingsdag",
    [fmt(add(e,39))]:            "Hemelvaartsdag",
    [fmt(add(e,49))]:            "1e Pinksterdag",
    [fmt(add(e,50))]:            "2e Pinksterdag",
    [fmt(new Date(year,11,25))]: "1e Kerstdag",
    [fmt(new Date(year,11,26))]: "2e Kerstdag",
  };
}

function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function firstDayOffset(y,m){const d=new Date(y,m,1).getDay();return d===0?6:d-1;}
function isWeekend(y,m,day){const d=new Date(y,m,day).getDay();return d===0||d===6;}
function getWorkdays(y,m,holidays){
  const days=[];
  for(let d=1;d<=daysInMonth(y,m);d++){
    if(!isWeekend(y,m,d)&&!holidays[dateKey(y,m,d)])days.push(d);
  }
  return days;
}
function dateKey(y,m,day){return `${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;}
function isToday(y,m,day){const t=new Date();return t.getFullYear()===y&&t.getMonth()===m&&t.getDate()===day;}
function formatDelta(d){const abs=Math.abs(d);const s=abs%1===0?abs.toString():abs.toFixed(1).replace(".",",");return(d>=0?"+":"−")+s+"u";}
function formatHours(h){const abs=Math.abs(h);return(abs%1===0?abs.toString():abs.toFixed(1).replace(".",","))+"u";}

function vacationDaysForPeriod(emp, year, month) {
  if (!emp.contractStart || !emp.vacationDaysPerYear) return null;
  const start = new Date(emp.contractStart);
  const viewDate = new Date(year, month + 1, 0);
  let anniversaryYear = start.getFullYear();
  while (new Date(anniversaryYear + 1, start.getMonth(), start.getDate()) <= viewDate) {
    anniversaryYear++;
  }
  const periodStart = new Date(anniversaryYear, start.getMonth(), start.getDate());
  const periodEnd = new Date(anniversaryYear + 1, start.getMonth(), start.getDate() - 1);
  return { days: emp.vacationDaysPerYear, periodStart, periodEnd };
}

function mapEmployee(row){
  return {
    id:row.id, name:row.name, role:row.role||"",
    contractStart:row.contract_start||"", contractMonths:row.contract_months||12,
    birthday:row.birthday||"", vacationDaysPerYear:row.vacation_days_per_year||20,
  };
}
function mapMutation(row){
  return {
    id:row.id, label:row.label, delta:Number(row.delta),
    fullDay:row.full_day, vacation:row.vacation, sick:row.sick,
    vacationDays:Number(row.vacation_days), status:row.status||"approved",
  };
}

const inputStyle={width:"100%",padding:"8px 10px",borderRadius:7,border:"1px solid #e8e6e1",fontSize:13,color:"#111",background:"#fafaf8",outline:"none"};

function Field({label,children}){
  return(
    <div>
      <div style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:500,marginBottom:5}}>{label}</div>
      {children}
    </div>
  );
}

function EmployeeModal({emp,onSave,onDelete,onClose,isNew}){
  const[form,setForm]=useState({...emp});
  const[confirmDelete,setConfirmDelete]=useState(false);
  const[saving,setSaving]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  async function handleSave(){if(!form.name.trim())return;setSaving(true);await onSave(form);setSaving(false);onClose();}
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:440,padding:24,boxShadow:"0 8px 40px rgba(0,0,0,0.12)",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:600,color:"#111"}}>{isNew?"Medewerker toevoegen":"Medewerker bewerken"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:"#bbb",cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Field label="Naam"><input style={inputStyle} value={form.name} onChange={e=>set("name",e.target.value)}/></Field>
          <Field label="Functie"><input style={inputStyle} value={form.role} placeholder="bijv. Verkoopmedewerker" onChange={e=>set("role",e.target.value)}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Contractstart"><input type="date" style={inputStyle} value={form.contractStart} onChange={e=>set("contractStart",e.target.value)}/></Field>
            <Field label="Looptijd (maanden)"><input type="number" style={inputStyle} value={form.contractMonths} min={1} onChange={e=>set("contractMonths",parseInt(e.target.value)||0)}/></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Verjaardag"><input type="date" style={inputStyle} value={form.birthday} onChange={e=>set("birthday",e.target.value)}/></Field>
            <Field label="Vakantiedagen / jaar"><input type="number" style={inputStyle} value={form.vacationDaysPerYear} min={0} onChange={e=>set("vacationDaysPerYear",parseInt(e.target.value)||0)}/></Field>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:22,gap:8}}>
          {!isNew&&!confirmDelete&&(<button onClick={()=>setConfirmDelete(true)} style={{padding:"8px 14px",border:"1px solid #f0cece",borderRadius:8,background:"#fdf4f4",fontSize:13,color:"#c0392b",cursor:"pointer"}}>Verwijderen</button>)}
          {!isNew&&confirmDelete&&(
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:12,color:"#c0392b"}}>Zeker weten?</span>
              <button onClick={()=>{onDelete(emp.id);onClose();}} style={{padding:"6px 12px",border:"none",borderRadius:7,background:"#c0392b",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:500}}>Ja, verwijder</button>
              <button onClick={()=>setConfirmDelete(false)} style={{padding:"6px 10px",border:"1px solid #e2e0da",borderRadius:7,background:"none",fontSize:12,color:"#aaa",cursor:"pointer"}}>Nee</button>
            </div>
          )}
          {isNew&&<div/>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={{padding:"8px 16px",border:"1px solid #e8e6e1",borderRadius:8,background:"none",fontSize:13,color:"#888",cursor:"pointer"}}>Annuleer</button>
            <button onClick={handleSave} disabled={saving} style={{padding:"8px 18px",border:"none",borderRadius:8,background:"#111",color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",opacity:saving?0.6:1}}>{saving?"Opslaan...":"Opslaan"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ADVICE=[
  {icon:"📊",title:"Verzuimpercentage & trending",desc:"Bereken het verzuimpercentage per medewerker én per team. Toon een trendlijn over 12 maanden zodat je vroeg ziet of verzuim toeneemt.",tag:"Inzicht"},
  {icon:"📅",title:"Verzuimpatronen detecteren",desc:"Signaleer automatisch: structureel ziek op maandag/vrijdag, of altijd na een vakantie. Handig als aanleiding voor een gesprek.",tag:"Signalering"},
  {icon:"🏢",title:"Teamdashboard & benchmarking",desc:"Overzichtsscherm met alle medewerkers tegelijk. Vergelijk afdelingen en benchmark tegen sector-gemiddelden.",tag:"Schaalbaar"},
  {icon:"🔔",title:"Automatische meldingen",desc:"Notificatie bij drempelwaarden (bijv. 3× ziek in 6 maanden). Koppelbaar aan e-mail of Slack.",tag:"Automatisering"},
  {icon:"📄",title:"Export & salarisintegratie",desc:"Maandoverzicht als PDF of Excel. Koppeling met Nmbrs, AFAS of Loket.nl voor directe loonaanlevering.",tag:"Integratie"},
  {icon:"⚖️",title:"Wet Poortwachter tijdlijn",desc:"Bij ziekte langer dan 2 weken: automatische tijdlijn met wettelijke deadlines (6w probleemanalyse, 8w plan van aanpak).",tag:"Compliance"},
  {icon:"📱",title:"Zelfregistratie medewerkers",desc:"Medewerkers melden zelf verlof of ziekte via mobiel. Leidinggevende keurt goed — minder administratie.",tag:"UX"},
  {icon:"🗓️",title:"Rooster & bezettingsplanning",desc:"Combineer uurregistratie met een rooster: zie wie er morgen is en waar gaten vallen door ziekte of verlof.",tag:"Planning"},
  {icon:"😊",title:"Energie & welzijn rapportage",desc:"Analyseer energie- en inspiratietrends per medewerker over tijd. Correleer met verzuim en productiviteit voor een compleet welzijnsbeeld.",tag:"Welzijn"},
  {icon:"🔐",title:"Admin & medewerker rollen",desc:"Scheiding tussen admin (alles zien/goedkeuren) en medewerker (eigen registratie). Inclusief vakantieaanvragen workflow met notificaties.",tag:"Rollen"},
];

function AdvicePanel(){
  const[open,setOpen]=useState(false);
  const tagColors={"Inzicht":"#2980b9","Signalering":"#8e44ad","Schaalbaar":"#16a085","Automatisering":"#d35400","Integratie":"#27ae60","Compliance":"#c0392b","UX":"#2471a3","Planning":"#7d3c98","Welzijn":"#1abc9c","Rollen":"#7f8c8d"};
  return(
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #eae8e3",overflow:"hidden",marginTop:12}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:15}}>💡</span>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#111"}}>Doorgroeimogelijkheden</div>
            <div style={{fontSize:11,color:"#bbb",marginTop:1}}>Ideeën om verder uit te werken</div>
          </div>
        </div>
        <span style={{fontSize:13,color:"#bbb",display:"inline-block",transform:open?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</span>
      </button>
      {open&&(
        <div style={{borderTop:"1px solid #f0eee9"}}>
          <div style={{padding:"12px 16px 4px",fontSize:11,color:"#aaa",lineHeight:1.7}}>
            De tool werkt goed voor kleine teams. Hieronder ideeën om op te schalen — interessant voor grotere bedrijven of integratie met HR-software zoals Nmbrs of Declaré.
          </div>
          {ADVICE.map((a,i)=>(
            <div key={i} style={{padding:"12px 16px",borderTop:"1px solid #f5f4f1",display:"flex",gap:11,alignItems:"flex-start"}}>
              <span style={{fontSize:17,flexShrink:0,marginTop:1}}>{a.icon}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#111"}}>{a.title}</span>
                  <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",padding:"2px 6px",borderRadius:4,background:tagColors[a.tag]+"18",color:tagColors[a.tag]}}>{a.tag}</span>
                </div>
                <div style={{fontSize:12,color:"#777",lineHeight:1.6}}>{a.desc}</div>
              </div>
            </div>
          ))}
          <div style={{padding:"10px 16px 12px",borderTop:"1px solid #f0eee9",fontSize:11,color:"#bbb",lineHeight:1.7}}>
            Voor 1–5 medewerkers is de huidige opzet prima. Bij 10+ loont een koppeling met een HR-pakket.
          </div>
        </div>
      )}
    </div>
  );
}

export default function App(){
  const now=new Date();
  const[year,setYear]=useState(now.getFullYear());
  const[month,setMonth]=useState(now.getMonth());
  const[employees,setEmployees]=useState([]);
  const[selectedEmployeeId,setSelectedEmployeeId]=useState(null);
  const[mutations,setMutations]=useState({});
  const[dayLogs,setDayLogs]=useState({});
  const[selectedDay,setSelectedDay]=useState(now.getDate());
  const[showCustom,setShowCustom]=useState(false);
  const[customLabel,setCustomLabel]=useState("");
  const[customDelta,setCustomDelta]=useState("");
  const[customVacation,setCustomVacation]=useState(false);
  const[customSick,setCustomSick]=useState(false);
  const[editingEmployee,setEditingEmployee]=useState(null);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[noteText,setNoteText]=useState("");
  const[editingNote,setEditingNote]=useState(false);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      const[{data:emps},{data:muts},{data:logs}]=await Promise.all([
        supabase.from("employees").select("*").order("created_at"),
        supabase.from("mutations").select("*"),
        supabase.from("day_logs").select("*"),
      ]);
      const mapped=(emps||[]).map(mapEmployee);
      setEmployees(mapped);
      if(mapped.length>0)setSelectedEmployeeId(mapped[0].id);
      const mutMap={};
      for(const m of(muts||[])){
        if(!mutMap[m.employee_id])mutMap[m.employee_id]={};
        if(!mutMap[m.employee_id][m.date])mutMap[m.employee_id][m.date]=[];
        mutMap[m.employee_id][m.date].push(mapMutation(m));
      }
      setMutations(mutMap);
      const logMap={};
      for(const l of(logs||[])){
        if(!logMap[l.employee_id])logMap[l.employee_id]={};
        logMap[l.employee_id][l.date]={id:l.id,energy:l.energy,inspiration:l.inspiration,note:l.note||""};
      }
      setDayLogs(logMap);
      setLoading(false);
    }
    load();
  },[]);

  const emp=employees.find(e=>e.id===selectedEmployeeId)||employees[0]||null;
  const empMutations=emp?mutations[emp.id]||{}:{};
  const empDayLogs=emp?dayLogs[emp.id]||{}:{};
  const holidays=useMemo(()=>dutchHolidays(year),[year]);
  const workdayNumbers=useMemo(()=>getWorkdays(year,month,holidays),[year,month,holidays]);
  const totalDaysInMonth=daysInMonth(year,month);
  const offset=firstDayOffset(year,month);

  function getDayMuts(day){return empMutations[dateKey(year,month,day)]||[];}
  function getDayDelta(day){return getDayMuts(day).reduce((s,m)=>s+m.delta,0);}
  function getDayVacDays(day){return getDayMuts(day).filter(m=>m.vacation&&m.status==="approved").reduce((s,m)=>s+(m.vacationDays||0),0);}
  function getDayPendingVac(day){return getDayMuts(day).some(m=>m.vacation&&m.status==="pending");}
  function isDayFullSick(day){return getDayMuts(day).some(m=>m.sick&&m.fullDay);}
  function isDayAbsent(day){
    if(isWeekend(year,month,day))return false;
    const muts=getDayMuts(day);
    const nonVacDelta=muts.filter(m=>!m.vacation).reduce((s,m)=>s+m.delta,0);
    const vacDays=muts.filter(m=>m.vacation&&m.status==="approved").reduce((s,m)=>s+(m.vacationDays||0),0);
    return nonVacDelta<=-7.5||vacDays>=1;
  }

  const presentWorkdays=useMemo(()=>workdayNumbers.filter(d=>!isDayAbsent(d)),[workdayNumbers,empMutations,year,month]);

  const totalHourDelta=useMemo(()=>{
    const prefix=`${year}-${String(month+1).padStart(2,"0")}`;
    return Object.entries(empMutations).filter(([k])=>k.startsWith(prefix)).flatMap(([,muts])=>muts).reduce((s,m)=>s+m.delta,0);
  },[empMutations,year,month]);

  const totalHours=workdayNumbers.length*HOURS_PER_DAY+totalHourDelta;

  const vacationInfo=useMemo(()=>{
    if(!emp||!emp.contractStart)return{total:emp?.vacationDaysPerYear||0,used:0,remaining:0};
    const info=vacationDaysForPeriod(emp,year,month);
    if(!info)return{total:0,used:0,remaining:0};
    let used=0;
    for(const[dateStr,muts] of Object.entries(empMutations)){
      const d=new Date(dateStr);
      if(d>=info.periodStart&&d<=info.periodEnd){
        used+=muts.filter(m=>m.vacation&&m.status==="approved").reduce((s,m)=>s+(m.vacationDays||0),0);
      }
    }
    return{total:info.days,used,remaining:info.days-used};
  },[emp,empMutations,year,month]);

  const sickStats=useMemo(()=>{
    if(!emp)return{days:0,hours:0};
    let days=0,hours=0;
    for(let m=0;m<12;m++){
      const hols=dutchHolidays(year);
      for(let d=1;d<=daysInMonth(year,m);d++){
        if(isWeekend(year,m,d)||hols[dateKey(year,m,d)])continue;
        const muts=((mutations[emp.id]||{})[dateKey(year,m,d)]||[]).filter(mut=>mut.sick);
        if(muts.length>0){const h=Math.abs(muts.reduce((s,mut)=>s+mut.delta,0));hours+=h;days+=h>=7.5?1:0.5;}
      }
    }
    return{days,hours};
  },[mutations,emp,year]);

  const birthdayDay=useMemo(()=>{
    if(!emp||!emp.birthday)return null;
    const[,bm,bd]=emp.birthday.split("-").map(Number);
    return bm-1===month?bd:null;
  },[emp,month]);

  const selKey=dateKey(year,month,selectedDay);
  const selLog=empDayLogs[selKey]||{energy:null,inspiration:null,note:""};
  const selMuts=emp?(empMutations[selKey]||[]):[];
  const selIsWeekend=emp?isWeekend(year,month,selectedDay):false;
  const selHoliday=holidays[selKey];
  const presets=selIsWeekend?WEEKEND_PRESETS:WEEKDAY_PRESETS;

  async function updateDayLog(field,value){
    if(!emp)return;
    const existing=empDayLogs[selKey];
    const newLog={...selLog,[field]:value};
    if(existing?.id){
      await supabase.from("day_logs").update({[field]:value}).eq("id",existing.id);
      setDayLogs(prev=>({...prev,[emp.id]:{...prev[emp.id],[selKey]:{...existing,[field]:value}}}));
    } else {
      const{data}=await supabase.from("day_logs").insert({
        employee_id:emp.id,date:selKey,
        energy:newLog.energy,inspiration:newLog.inspiration,note:newLog.note||"",
      }).select().single();
      if(data){setDayLogs(prev=>({...prev,[emp.id]:{...(prev[emp.id]||{}),[selKey]:{id:data.id,...newLog}}}));}
    }
  }

  async function saveNote(){await updateDayLog("note",noteText);setEditingNote(false);}
  async function deleteNote(){await updateDayLog("note","");setNoteText("");setEditingNote(false);}

  useEffect(()=>{setNoteText(selLog.note||"");setEditingNote(false);},[selKey,selectedEmployeeId]);

  async function addMutation(label,delta,fullDay,vacation,sick,vacationDays,status="approved"){
    if(!emp||saving)return;
    setSaving(true);
    const{data,error}=await supabase.from("mutations").insert({
      employee_id:emp.id,date:selKey,label,delta,
      full_day:fullDay||false,vacation:vacation||false,sick:sick||false,
      vacation_days:vacationDays||0,status,
    }).select().single();
    setSaving(false);
    if(error){console.error(error);return;}
    setMutations(prev=>{const em=prev[emp.id]||{};return{...prev,[emp.id]:{...em,[selKey]:[...(em[selKey]||[]),mapMutation(data)]}};});
  }

  async function removeMutation(key,id){
    await supabase.from("mutations").delete().eq("id",id);
    setMutations(prev=>{const em=prev[emp.id]||{};return{...prev,[emp.id]:{...em,[key]:(em[key]||[]).filter(m=>m.id!==id)}};});
  }

  async function approveMutation(key,id){
    await supabase.from("mutations").update({status:"approved"}).eq("id",id);
    setMutations(prev=>{const em=prev[emp.id]||{};return{...prev,[emp.id]:{...em,[key]:(em[key]||[]).map(m=>m.id===id?{...m,status:"approved"}:m)}};});
  }

  function handlePreset(p){
    addMutation(p.label,p.delta,p.fullDay,p.vacation,p.sick||false,p.vacation?(p.fullDay?1:0.5):0,p.vacation?"pending":"approved");
  }

  function handleCustomAdd(){
    const d=parseFloat(customDelta.replace(",","."));
    if(!customLabel.trim()||isNaN(d))return;
    const isVac=customVacation||customLabel.toLowerCase().includes("vakantie");
    const isSick=customSick||customLabel.toLowerCase().includes("ziek");
    addMutation(customLabel.trim(),d,false,isVac,isSick,isVac?1:0,isVac?"pending":"approved");
    setCustomLabel("");setCustomDelta("");setCustomVacation(false);setCustomSick(false);setShowCustom(false);
  }

  async function handleSaveEmployee(form){
    if(editingEmployee==="new"){
      const{data,error}=await supabase.from("employees").insert({
        name:form.name,role:form.role||"",contract_start:form.contractStart||null,
        contract_months:form.contractMonths||12,birthday:form.birthday||null,
        vacation_days_per_year:form.vacationDaysPerYear||20,
      }).select().single();
      if(error){console.error(error);return;}
      const newEmp=mapEmployee(data);
      setEmployees(prev=>[...prev,newEmp]);
      setSelectedEmployeeId(newEmp.id);
    } else {
      await supabase.from("employees").update({
        name:form.name,role:form.role||"",contract_start:form.contractStart||null,
        contract_months:form.contractMonths||12,birthday:form.birthday||null,
        vacation_days_per_year:form.vacationDaysPerYear||20,
      }).eq("id",form.id);
      setEmployees(prev=>prev.map(e=>e.id===form.id?{...e,...form}:e));
    }
  }

  async function handleDeleteEmployee(id){
    await supabase.from("employees").delete().eq("id",id);
    setEmployees(prev=>prev.filter(e=>e.id!==id));
    setMutations(prev=>{const n={...prev};delete n[id];return n;});
    const remaining=employees.filter(e=>e.id!==id);
    setSelectedEmployeeId(remaining.length>0?remaining[0].id:null);
  }

  function prevMonth(){if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);setSelectedDay(1);}
  function nextMonth(){if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);setSelectedDay(1);}

  const cells=[];
  for(let i=0;i<offset;i++)cells.push(null);
  for(let d=1;d<=totalDaysInMonth;d++)cells.push(d);

  function getDayColors(day){
    const weekend=isWeekend(year,month,day);
    const absent=isDayAbsent(day);
    const sick=isDayFullSick(day);
    const isSel=day===selectedDay;
    const holiday=holidays[dateKey(year,month,day)];
    const log=empDayLogs[dateKey(year,month,day)];
    const{energyColor,inspirationColor}=log?getDayLogColors(log.energy,log.inspiration):{energyColor:null,inspirationColor:null};
    let bg,numColor,labelColor;
    if(sick){bg=isSel?"#6c3483":"#f5eef8";numColor=isSel?"#fff":"#6c3483";labelColor=isSel?"rgba(255,255,255,0.75)":"#8e44ad";}
    else if(absent){bg=isSel?"#c0392b":"#fdf2f2";numColor=isSel?"#fff":"#c0392b";labelColor=isSel?"rgba(255,255,255,0.75)":"#e74c3c";}
    else if(holiday){bg=isSel?"#1a5276":"#eaf4fb";numColor=isSel?"#fff":"#1a5276";labelColor=isSel?"rgba(255,255,255,0.7)":"#2471a3";}
    else{bg=isSel?"#111":"transparent";numColor=!isSel?(weekend?"#b0aca3":"#111"):"#fff";labelColor=null;}
    return{bg,numColor,labelColor,energyColor,inspirationColor};
  }

  const newEmpTemplate={id:null,name:"",role:"",contractStart:"",contractMonths:12,birthday:"",vacationDaysPerYear:20};

  if(loading){
    return(
      <div style={{minHeight:"100vh",background:"#f7f6f3",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Outfit','Segoe UI',sans-serif"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,color:"#bbb",marginBottom:8}}>Laden...</div>
          <div style={{width:32,height:32,border:"2px solid #e8e6e1",borderTop:"2px solid #111",borderRadius:"50%",margin:"0 auto",animation:"spin 0.8s linear infinite"}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:"#f7f6f3",fontFamily:"'Outfit','Segoe UI',sans-serif",paddingBottom:60}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        button,input,select,textarea{font-family:inherit;}
        button{cursor:pointer;}
        textarea{resize:vertical;}
      `}</style>

      <div style={{background:"#fff",borderBottom:"1px solid #eae8e3",padding:"12px 16px",position:"sticky",top:0,zIndex:20}}>
        <div style={{fontSize:10,letterSpacing:"0.12em",color:"#bbb",textTransform:"uppercase",fontWeight:500,marginBottom:6}}>Uurregistratie</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {employees.length>0?(
            <select value={selectedEmployeeId||""} onChange={e=>setSelectedEmployeeId(e.target.value)} style={{flex:1,padding:"9px 32px 9px 12px",border:"1px solid #e2e0da",borderRadius:9,background:"#fff",fontSize:14,color:"#111",fontWeight:600,appearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23aaa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center"}}>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          ):(
            <div style={{flex:1,padding:"9px 12px",border:"1px solid #e2e0da",borderRadius:9,fontSize:13,color:"#bbb"}}>Geen medewerkers — voeg er een toe</div>
          )}
          {emp&&(<button onClick={()=>setEditingEmployee(emp)} style={{padding:"9px 14px",border:"1px solid #e2e0da",borderRadius:9,background:"#fff",fontSize:13,color:"#555",fontWeight:500,whiteSpace:"nowrap"}}>✏️ Bewerk</button>)}
        </div>
      </div>

      {editingEmployee&&(<EmployeeModal emp={editingEmployee==="new"?newEmpTemplate:editingEmployee} onSave={handleSaveEmployee} onDelete={handleDeleteEmployee} onClose={()=>setEditingEmployee(null)} isNew={editingEmployee==="new"}/>)}

      {!emp?(
        <div style={{maxWidth:600,margin:"40px auto",padding:"0 16px",textAlign:"center"}}>
          <div style={{fontSize:14,color:"#bbb",marginBottom:16}}>Voeg je eerste medewerker toe om te beginnen.</div>
          <button onClick={()=>setEditingEmployee("new")} style={{padding:"10px 22px",background:"#111",color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:500}}>+ Medewerker toevoegen</button>
        </div>
      ):(
        <div style={{maxWidth:600,margin:"0 auto",padding:"14px 14px 0"}}>

          <div style={{background:"#fff",borderRadius:12,border:"1px solid #eae8e3",padding:"11px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:600,fontSize:14,color:"#111"}}>{emp.name}</div>
              {emp.role&&<div style={{fontSize:12,color:"#aaa",marginTop:1}}>{emp.role}</div>}
            </div>
            {emp.contractStart&&(
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>0-uren contract</div>
                <div style={{fontSize:12,color:"#555",fontFamily:"'DM Mono',monospace",marginTop:2}}>
                  {emp.contractStart.split("-").reverse().join("-")}{emp.contractMonths?` · ${emp.contractMonths}m`:""}
                </div>
              </div>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",background:"#fff",borderRadius:12,border:"1px solid #eae8e3",marginBottom:12,overflow:"hidden"}}>
            {[
              {label:"Werkdagen",value:workdayNumbers.length,sub:presentWorkdays.length<workdayNumbers.length?`${presentWorkdays.length} aanwezig`:null,mono:false},
              {label:"Basisuren",value:formatHours(workdayNumbers.length*HOURS_PER_DAY),mono:true},
              {label:"Totaal",value:formatHours(totalHours),sub:totalHourDelta!==0?formatDelta(totalHourDelta):null,mono:true,accent:true},
              {label:"Vakantie",value:vacationInfo.remaining%1===0?vacationInfo.remaining:vacationInfo.remaining.toFixed(1),sub:`van ${vacationInfo.total}d`,mono:true,vacColor:vacationInfo.remaining<0?"#c0392b":vacationInfo.remaining<=2?"#e67e22":"#2980b9"},
            ].map((s,i)=>(
              <div key={i} style={{padding:"12px 0",textAlign:"center",borderRight:i<3?"1px solid #f0eee9":"none"}}>
                <div style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:500,marginBottom:3}}>{s.label}</div>
                <div style={{fontSize:s.accent?18:15,fontWeight:s.accent?600:400,color:s.vacColor||"#111",fontFamily:s.mono?"'DM Mono',monospace":"inherit"}}>{s.value}</div>
                {s.sub&&<div style={{fontSize:10,marginTop:1,fontFamily:"'DM Mono',monospace",color:s.accent?(totalHourDelta<0?"#c0392b":"#27ae60"):"#bbb"}}>{s.sub}</div>}
              </div>
            ))}
          </div>

          <div style={{background:"#fff",borderRadius:12,border:"1px solid #eae8e3",marginBottom:12,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px 9px",borderBottom:"1px solid #f0eee9"}}>
              <button onClick={prevMonth} style={{width:28,height:28,border:"1px solid #e8e6e1",borderRadius:6,background:"none",fontSize:14,color:"#666",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <span style={{fontWeight:600,fontSize:13,color:"#111"}}>{MONTH_NAMES[month]} {year}</span>
              <button onClick={nextMonth} style={{width:28,height:28,border:"1px solid #e8e6e1",borderRadius:6,background:"none",fontSize:14,color:"#666",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"7px 8px 2px"}}>
              {DAY_NAMES.map(d=>(<div key={d} style={{textAlign:"center",fontSize:10,fontWeight:500,color:d==="za"||d==="zo"?"#c8c4bc":"#ccc",letterSpacing:"0.06em",textTransform:"uppercase",paddingBottom:3}}>{d}</div>))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px 10px",gap:2}}>
              {cells.map((day,i)=>{
                if(!day)return<div key={`e-${i}`}/>;
                const isSel=day===selectedDay;
                const today=isToday(year,month,day);
                const{bg,numColor,labelColor,energyColor,inspirationColor}=getDayColors(day);
                const delta=getDayDelta(day);
                const vacD=getDayVacDays(day);
                const pending=getDayPendingVac(day);
                const hasMuts=delta!==0||vacD>0||pending;
                const absent=isDayAbsent(day);
                const sick=isDayFullSick(day);
                const isBirthday=birthdayDay===day;
                const holiday=holidays[dateKey(year,month,day)];
                const baseBorder=isSel?`2px solid ${bg}`:today?"2px solid #ccc":"2px solid transparent";
                return(
                  <button key={day} onClick={()=>setSelectedDay(day)} style={{padding:"5px 1px 3px",borderRadius:7,border:baseBorder,background:bg,textAlign:"center",transition:"background 0.1s",position:"relative",overflow:"hidden"}}>
                    {/* Energy bar — left edge */}
                    {energyColor&&!isSel&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:energyColor,borderRadius:"3px 0 0 3px"}}/>}
                    {/* Inspiration bar — right edge */}
                    {inspirationColor&&!isSel&&<div style={{position:"absolute",right:0,top:0,bottom:0,width:3,background:inspirationColor,borderRadius:"0 3px 3px 0"}}/>}
                    <div style={{fontSize:12,fontWeight:isSel?600:400,color:numColor,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{day}</div>
                    <div style={{height:15,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",marginTop:1}}>
                      {isBirthday&&<div style={{fontSize:9}}>🎂</div>}
                      {!isBirthday&&sick&&<div style={{fontSize:8,color:labelColor,fontWeight:600}}>ZIEK</div>}
                      {!isBirthday&&!sick&&pending&&<div style={{fontSize:8,color:isSel?"#aed6f1":"#2980b9",fontWeight:600}}>AANVR</div>}
                      {!isBirthday&&!sick&&!pending&&absent&&<div style={{fontSize:8,color:labelColor,fontWeight:500}}>{vacD>0?"VAK":"VRIJ"}</div>}
                      {!isBirthday&&!absent&&!pending&&holiday&&<div style={{fontSize:7,color:labelColor,fontWeight:500}}>FD</div>}
                      {!isBirthday&&!absent&&!pending&&!holiday&&hasMuts&&(
                        <div style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:isSel?(delta<0?"#f9a8a8":"#a8e6bc"):(delta<0?"#c0392b":"#27ae60")}}>
                          {vacD>0?`${vacD}vd`:formatDelta(delta)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,padding:"6px 12px 10px",borderTop:"1px solid #f5f4f1"}}>
              {[
                {color:"#8e44ad",label:"Ziek"},{color:"#e74c3c",label:"Vrij"},
                {color:"#2471a3",label:"Feestdag"},{color:"#27ae60",label:"Overwerk"},
                {color:"#2980b9",label:"Vakantie/aanvraag"},{icon:"🎂",label:"Verjaardag"},
                {color:"#e74c3c",label:"Energie rood",outline:true},{color:"#27ae60",label:"groen",outline:true},{color:"#2980b9",label:"blauw",outline:true},
              ].map((l,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#aaa"}}>
                  {l.icon?<span>{l.icon}</span>:<div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:l.outline?"transparent":l.color,border:l.outline?`2px solid ${l.color}`:"none"}}/>}
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{background:"#fff",borderRadius:12,border:"1px solid #eae8e3",overflow:"hidden",marginBottom:12}}>
            <div style={{padding:"11px 14px",borderBottom:"1px solid #f0eee9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#111",display:"flex",alignItems:"center",flexWrap:"wrap",gap:5}}>
                  {selectedDay} {MONTH_NAMES[month]} {year}
                  {selIsWeekend&&<span style={{fontSize:10,color:"#bbb",fontWeight:400,background:"#f5f4f1",padding:"2px 6px",borderRadius:4}}>Weekend</span>}
                  {selHoliday&&<span style={{fontSize:10,color:"#2471a3",fontWeight:400,background:"#eaf4fb",padding:"2px 7px",borderRadius:4}}>{selHoliday}</span>}
                  {birthdayDay===selectedDay&&<span style={{fontSize:11}}>🎂</span>}
                </div>
                <div style={{fontSize:11,color:"#bbb",marginTop:2}}>{emp.name}</div>
              </div>
              <div style={{fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:500,color:isDayFullSick(selectedDay)?"#8e44ad":isDayAbsent(selectedDay)?"#c0392b":getDayDelta(selectedDay)>0?"#27ae60":getDayDelta(selectedDay)<0?"#c0392b":"#bbb"}}>
                {isDayFullSick(selectedDay)?"ziek":isDayAbsent(selectedDay)?(getDayVacDays(selectedDay)>0?"vakantie":"afwezig"):getDayDelta(selectedDay)!==0?formatDelta(getDayDelta(selectedDay)):selIsWeekend||selHoliday?"—":"7,5u"}
              </div>
            </div>

            <div style={{padding:"11px 14px",borderBottom:"1px solid #f5f4f1"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,marginBottom:6}}>Energie</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {ENERGY_OPTIONS.map(o=>(
                      <button key={o.value} onClick={()=>updateDayLog("energy",selLog.energy===o.value?null:o.value)} style={{padding:"4px 9px",borderRadius:6,fontSize:11,fontWeight:500,border:`1.5px solid ${selLog.energy===o.value?o.color:"#e8e6e1"}`,background:selLog.energy===o.value?o.color+"18":"transparent",color:selLog.energy===o.value?o.color:"#aaa"}}>{o.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500,marginBottom:6}}>Inspiratie</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {INSPIRATION_OPTIONS.map(o=>(
                      <button key={o.value} onClick={()=>updateDayLog("inspiration",selLog.inspiration===o.value?null:o.value)} style={{padding:"4px 9px",borderRadius:6,fontSize:11,fontWeight:500,border:`1.5px solid ${selLog.inspiration===o.value?o.color:"#e8e6e1"}`,background:selLog.inspiration===o.value?o.color+"18":"transparent",color:selLog.inspiration===o.value?o.color:"#aaa"}}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{padding:"11px 14px",borderBottom:"1px solid #f5f4f1"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:500}}>Notitie</div>
                {!editingNote&&(<button onClick={()=>{setNoteText(selLog.note||"");setEditingNote(true);}} style={{fontSize:11,color:"#aaa",background:"none",border:"none",padding:0}}>{selLog.note?"✏️ Bewerk":"+ Toevoegen"}</button>)}
              </div>
              {!editingNote&&selLog.note&&(<div style={{fontSize:13,color:"#444",lineHeight:1.6,background:"#fafaf8",borderRadius:7,padding:"8px 10px",border:"1px solid #f0eee9"}}>{selLog.note}</div>)}
              {!editingNote&&!selLog.note&&(<div style={{fontSize:12,color:"#ddd"}}>Geen notitie</div>)}
              {editingNote&&(
                <div>
                  <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={3} style={{...inputStyle,marginBottom:8}} placeholder="Voeg een notitie toe..."/>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={saveNote} style={{padding:"6px 14px",background:"#111",color:"#fff",border:"none",borderRadius:7,fontSize:12,fontWeight:500}}>Opslaan</button>
                    {selLog.note&&<button onClick={deleteNote} style={{padding:"6px 12px",background:"none",border:"1px solid #f0cece",borderRadius:7,fontSize:12,color:"#c0392b"}}>Verwijder</button>}
                    <button onClick={()=>setEditingNote(false)} style={{padding:"6px 10px",background:"none",border:"1px solid #e2e0da",borderRadius:7,fontSize:12,color:"#aaa"}}>Annuleer</button>
                  </div>
                </div>
              )}
            </div>

            {selMuts.length>0&&(
              <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:5,borderBottom:"1px solid #f5f4f1"}}>
                {selMuts.map(m=>{
                  const isPending=m.vacation&&m.status==="pending";
                  const bg=isPending?"#eaf4fb":m.sick?"#f5eef8":m.vacation?"#eaf4fb":m.delta<0?"#fdf4f4":"#f4fdf6";
                  const border=isPending?"#aed6f1":m.sick?"#d7bde2":m.vacation?"#b8d4f0":m.delta<0?"#f0cece":"#c4e6cc";
                  const tc=isPending?"#2471a3":m.sick?"#8e44ad":m.vacation?"#2471a3":m.delta<0?"#c0392b":"#27ae60";
                  return(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:bg,borderRadius:7,border:`1px solid ${border}`,fontSize:13}}>
                      <span style={{flex:1,color:"#444"}}>{m.label}{isPending&&<span style={{marginLeft:6,fontSize:10,color:"#2471a3",fontWeight:600}}>AANVRAAG</span>}</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:11,color:tc}}>
                        {m.vacation?`−${m.vacationDays}vd`:m.sick?formatHours(Math.abs(m.delta)):formatDelta(m.delta)}
                      </span>
                      {isPending&&(<button onClick={()=>approveMutation(selKey,m.id)} style={{padding:"3px 8px",background:"#2471a3",color:"#fff",border:"none",borderRadius:5,fontSize:10,fontWeight:600}}>✓ Akkoord</button>)}
                      <button onClick={()=>removeMutation(selKey,m.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{padding:"12px 14px"}}>
              <div style={{fontSize:10,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:500,marginBottom:8}}>
                Mutatie toevoegen{saving&&<span style={{marginLeft:6,fontSize:9,fontWeight:400}}>opslaan...</span>}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                {presets.map(p=>{
                  const bg=p.sick?"#f5eef8":p.vacation?"#eaf4fb":p.delta<0?"#fdf6f6":"#f5fbf6";
                  const border=p.sick?"#d7bde2":p.vacation?"#b8d4f0":p.delta<0?"#f0cece":"#c4e6cc";
                  const color=p.sick?"#8e44ad":p.vacation?"#2471a3":p.delta<0?"#b94040":"#2e7d4f";
                  return(
                    <button key={p.label} onClick={()=>handlePreset(p)} disabled={saving} style={{padding:"6px 10px",borderRadius:7,fontSize:12,fontWeight:500,border:`1px solid ${border}`,background:bg,color,opacity:saving?0.6:1}}>
                      {p.label}
                      <span style={{marginLeft:4,fontFamily:"'DM Mono',monospace",fontSize:10,opacity:0.65}}>
                        {p.vacation?"aanvraag":formatDelta(p.delta)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!showCustom?(
                <button onClick={()=>setShowCustom(true)} style={{background:"none",border:"1px dashed #ddd",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#bbb"}}>+ Aangepast</button>
              ):(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <input placeholder="Omschrijving" value={customLabel} onChange={e=>setCustomLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleCustomAdd()} style={{flex:"1 1 120px",padding:"7px 10px",borderRadius:7,border:"1px solid #e2e0da",fontSize:12}}/>
                  <input placeholder="uren (−2)" value={customDelta} onChange={e=>setCustomDelta(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleCustomAdd()} style={{flex:"0 1 80px",padding:"7px 10px",borderRadius:7,border:"1px solid #e2e0da",fontSize:12,fontFamily:"'DM Mono',monospace"}}/>
                  <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#666",cursor:"pointer"}}><input type="checkbox" checked={customVacation} onChange={e=>setCustomVacation(e.target.checked)}/> vakantie</label>
                  <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#8e44ad",cursor:"pointer"}}><input type="checkbox" checked={customSick} onChange={e=>setCustomSick(e.target.checked)}/> ziek</label>
                  <button onClick={handleCustomAdd} disabled={saving} style={{padding:"7px 13px",background:"#111",color:"#fff",border:"none",borderRadius:7,fontSize:12,fontWeight:500,opacity:saving?0.6:1}}>Voeg toe</button>
                  <button onClick={()=>setShowCustom(false)} style={{padding:"7px 10px",background:"none",border:"1px solid #e2e0da",borderRadius:7,fontSize:12,color:"#aaa"}}>×</button>
                </div>
              )}
            </div>
          </div>

          <div style={{background:"#f5eef8",borderRadius:12,border:"1px solid #e8d5f0",marginBottom:12,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#8e44ad",flexShrink:0}}/>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#6c3483"}}>Verzuim {year}</div>
                <div style={{fontSize:11,color:"#a569bd",marginTop:1}}>1 jan – 31 dec</div>
              </div>
            </div>
            <div style={{display:"flex",gap:18}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#a569bd",textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:500}}>Dagen</div>
                <div style={{fontSize:16,fontWeight:600,color:"#6c3483",fontFamily:"'DM Mono',monospace"}}>{sickStats.days%1===0?sickStats.days:sickStats.days.toFixed(1)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#a569bd",textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:500}}>Uren</div>
                <div style={{fontSize:16,fontWeight:600,color:"#6c3483",fontFamily:"'DM Mono',monospace"}}>{formatHours(sickStats.hours)}</div>
              </div>
            </div>
          </div>

          <AdvicePanel/>

          <div style={{marginTop:12,display:"flex",justifyContent:"center"}}>
            <button onClick={()=>setEditingEmployee("new")} style={{padding:"9px 20px",background:"none",border:"1px solid #ddd",borderRadius:9,fontSize:12,color:"#aaa",fontWeight:500}}>+ Medewerker toevoegen</button>
          </div>

          <div style={{marginTop:10,marginBottom:8,padding:"9px 13px",background:"#f0eee9",borderRadius:8,fontSize:11,color:"#aaa",lineHeight:1.7}}>
            Standaard <strong style={{color:"#888"}}>7,5u per werkdag</strong>. Feestdagen automatisch uitgesloten. Verzuim telt van 1 jan t/m 31 dec. Vakantiedagen resetten per contractjaar.
          </div>
        </div>
      )}
    </div>
  );
}