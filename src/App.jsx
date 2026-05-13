import { useState, useEffect, useCallback, useRef } from "react";
import * as d3 from "d3";
import {
  PlusCircle, Trash2, BarChart2, PieChart, GitFork, Table,
  Settings, X, DollarSign, TrendingUp, TrendingDown, AlertCircle,
  Smartphone, Monitor, Upload, Download,
} from "lucide-react";

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
  "Midnight": {
    bg:"#0d0f14", card:"#161b27", border:"#252d3d", accent:"#5b8af5",
    accentSoft:"#1e2d4a", text:"#e8ecf4", textMuted:"#6b7a99",
    credit:"#34d399", debit:"#f87171", node:"#5b8af5", surface:"#1a2035",
    chartColors:["#5b8af5","#34d399","#f87171","#fb923c","#a78bfa","#38bdf8","#fbbf24","#e879f9"],
    font:"'Space Mono', monospace",
  },
  "Solar": {
    bg:"#fdf6e3", card:"#fffbf0", border:"#e8d5a3", accent:"#c0692a",
    accentSoft:"#fdebd0", text:"#2c1d0e", textMuted:"#8b6840",
    credit:"#2e7d32", debit:"#c62828", node:"#c0692a", surface:"#fff8e1",
    chartColors:["#c0692a","#2e7d32","#c62828","#1565c0","#6a1499","#00838f","#f57f17","#ad1457"],
    font:"'Playfair Display', serif",
  },
  "Nord": {
    bg:"#2e3440", card:"#3b4252", border:"#434c5e", accent:"#88c0d0",
    accentSoft:"#3d4f5c", text:"#eceff4", textMuted:"#7b88a1",
    credit:"#a3be8c", debit:"#bf616a", node:"#88c0d0", surface:"#434c5e",
    chartColors:["#88c0d0","#a3be8c","#bf616a","#d08770","#b48ead","#81a1c1","#ebcb8b","#5e81ac"],
    font:"'IBM Plex Mono', monospace",
  },
  "Blossom": {
    bg:"#fff0f6", card:"#fff5f9", border:"#f4c2d8", accent:"#e05c8a",
    accentSoft:"#fde8f0", text:"#3d1a2e", textMuted:"#b07090",
    credit:"#2e9e6e", debit:"#d44060", node:"#e05c8a", surface:"#fceef4",
    chartColors:["#e05c8a","#2e9e6e","#d44060","#7c55c8","#e07820","#1a8fba","#c8a020","#3a9e8e"],
    font:"'Lora', serif",
  },
  "Matrix": {
    bg:"#020c02", card:"#061006", border:"#0f2a0f", accent:"#00ff41",
    accentSoft:"#031a03", text:"#00ff41", textMuted:"#006622",
    credit:"#00ff41", debit:"#ff3300", node:"#00ff41", surface:"#040e04",
    chartColors:["#00ff41","#00cc33","#009926","#ff3300","#ff6600","#ffcc00","#0099ff","#9900ff"],
    font:"'Share Tech Mono', monospace",
  },
};

// ── Currencies ────────────────────────────────────────────────────────────────
const CURRENCIES = {
  ZAR:{ symbol:"R",   name:"South African Rand", locale:"en-ZA" },
  USD:{ symbol:"$",   name:"US Dollar",          locale:"en-US" },
  EUR:{ symbol:"€",   name:"Euro",               locale:"de-DE" },
  GBP:{ symbol:"£",   name:"British Pound",      locale:"en-GB" },
  AUD:{ symbol:"A$",  name:"Australian Dollar",  locale:"en-AU" },
};
const fmt  = (val,code)=>{ const c=CURRENCIES[code]||CURRENCIES.USD; return `${c.symbol}${Number(val).toLocaleString(c.locale,{minimumFractionDigits:2,maximumFractionDigits:2})}`; };
const fmtS = (val,code)=>{ const c=CURRENCIES[code]||CURRENCIES.USD; return `${c.symbol}${Number(val).toLocaleString(c.locale,{maximumFractionDigits:0})}`; };

// ── Storage ───────────────────────────────────────────────────────────────────
const LOAD = (k,fb)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; }};
const SAVE = (k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} };

let _id=100;
const uid=()=>++_id;

const DEFAULT_CREDITS=[
  {id:1,label:"Internship Salary",amount:2800},
  {id:2,label:"Freelance",amount:300},
];
const DEFAULT_DEBITS=[
  {id:1,label:"Rent",amount:900},
  {id:2,label:"Groceries",amount:250},
  {id:3,label:"Car Payment",amount:320},
  {id:4,label:"Entertainment",amount:120},
  {id:5,label:"Utilities",amount:90},
  {id:6,label:"Savings",amount:400},
];

// ── Import / Export helpers ───────────────────────────────────────────────────
function exportData(credits, debits, currency, themeName) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    currency,
    theme: themeName,
    credits,
    debits,
  };
  const text    = JSON.stringify(payload, null, 2);
  const encoded = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  const a       = document.createElement("a");
  a.href        = encoded;
  a.download    = `budgetflow-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function importData(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const payload = JSON.parse(e.target.result);
      if (!payload.credits || !payload.debits) throw new Error("Invalid file format");
      onSuccess(payload);
    } catch (err) {
      onError("Could not read file — make sure it's a valid BudgetFlow export.");
    }
  };
  reader.readAsText(file);
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, theme }) {
  return (
    <div onClick={()=>onChange(!on)} style={{width:42,height:24,borderRadius:12,background:on?theme.accent:theme.border,cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:on?21:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
    </div>
  );
}

// ── Settings Drawer ───────────────────────────────────────────────────────────
function SettingsPanel({ themeName, setThemeName, currency, setCurrency, mobileMode, setMobileMode,
                         theme, onClose, credits, debits, onImport }) {
  const fileRef = useRef(null);
  const [importMsg, setImportMsg] = useState("");

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importData(file,
      (payload) => {
        onImport(payload);
        setImportMsg("✓ Data imported successfully!");
        setTimeout(()=>setImportMsg(""),3000);
      },
      (err) => { setImportMsg(`✗ ${err}`); setTimeout(()=>setImportMsg(""),4000); }
    );
    e.target.value = "";
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}}/>
      <div style={{
        position:"relative",zIndex:1,background:theme.card,
        borderRadius:"22px 22px 0 0",border:`1px solid ${theme.border}`,borderBottom:"none",
        width:"100%",maxWidth:520,padding:"0 0 36px",fontFamily:theme.font,
        boxShadow:"0 -16px 48px rgba(0,0,0,0.5)",
        animation:"slideUp 0.22s ease",
        maxHeight:"90vh",overflowY:"auto",
      }}>
        <style>{`@keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Settings size={16} color={theme.accent}/>
            <span style={{fontWeight:700,fontSize:16,color:theme.text}}>Settings</span>
          </div>
          <button onClick={onClose} style={{background:theme.accentSoft,border:"none",borderRadius:8,padding:"6px 8px",cursor:"pointer",color:theme.textMuted,display:"flex"}}>
            <X size={15}/>
          </button>
        </div>
        <div style={{height:1,background:theme.border,margin:"0 20px 20px"}}/>

        {/* ── Appearance ── */}
        <div style={{padding:"0 20px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:theme.textMuted,letterSpacing:"0.09em",marginBottom:12}}>APPEARANCE</div>
          <div style={{fontSize:13,color:theme.text,marginBottom:10}}>Theme</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(THEMES).map(([name,t])=>(
              <button key={name} onClick={()=>setThemeName(name)} style={{
                padding:"7px 14px",borderRadius:9,
                border:`2px solid ${name===themeName?t.accent:theme.border}`,
                background:name===themeName?t.accentSoft:"transparent",
                color:name===themeName?t.accent:theme.textMuted,
                fontFamily:theme.font,fontSize:12,cursor:"pointer",fontWeight:name===themeName?700:400,
                display:"flex",alignItems:"center",gap:6,
              }}>
                <span style={{width:10,height:10,borderRadius:"50%",background:t.accent,display:"inline-block",flexShrink:0}}/>
                {name}
              </button>
            ))}
          </div>
        </div>
        <div style={{height:1,background:theme.border,margin:"0 20px 20px"}}/>

        {/* ── Currency ── */}
        <div style={{padding:"0 20px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:theme.textMuted,letterSpacing:"0.09em",marginBottom:12}}>CURRENCY</div>
          <div style={{fontSize:13,color:theme.text,marginBottom:10}}>Display Currency</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(CURRENCIES).map(([code,c])=>(
              <button key={code} onClick={()=>setCurrency(code)} style={{
                padding:"7px 14px",borderRadius:9,
                border:`2px solid ${code===currency?theme.accent:theme.border}`,
                background:code===currency?theme.accentSoft:"transparent",
                color:code===currency?theme.accent:theme.textMuted,
                fontFamily:theme.font,fontSize:12,cursor:"pointer",fontWeight:code===currency?700:400,
              }}>
                {c.symbol} {code}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:theme.textMuted,marginTop:8,lineHeight:1.5}}>
            {CURRENCIES[currency]?.name} · enter amounts in this currency
          </div>
        </div>
        <div style={{height:1,background:theme.border,margin:"0 20px 20px"}}/>

        {/* ── Layout ── */}
        <div style={{padding:"0 20px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:theme.textMuted,letterSpacing:"0.09em",marginBottom:12}}>LAYOUT</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}>
            <div>
              <div style={{fontSize:13,color:theme.text,display:"flex",alignItems:"center",gap:7}}>
                {mobileMode?<Smartphone size={14} color={theme.accent}/>:<Monitor size={14} color={theme.textMuted}/>}
                Mobile-Friendly Mode
              </div>
              <div style={{fontSize:11,color:theme.textMuted,marginTop:3}}>
                Larger tap targets, stacked layout, icon-only tabs
              </div>
            </div>
            <Toggle on={mobileMode} onChange={setMobileMode} theme={theme}/>
          </div>
        </div>
        <div style={{height:1,background:theme.border,margin:"0 20px 20px"}}/>

        {/* ── Data ── */}
        <div style={{padding:"0 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:theme.textMuted,letterSpacing:"0.09em",marginBottom:12}}>DATA BACKUP</div>
          <div style={{fontSize:11,color:theme.textMuted,marginBottom:14,lineHeight:1.6}}>
            Export your budget to a .txt file as a backup, or import a previously exported file to restore your data.
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button
              onClick={()=>exportData(credits,debits,currency,themeName)}
              style={{flex:1,minWidth:130,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"10px 16px",borderRadius:10,border:`1px solid ${theme.border}`,
                background:theme.accentSoft,color:theme.accent,
                fontFamily:theme.font,fontSize:13,fontWeight:600,cursor:"pointer"}}>
              <Download size={15}/> Export .txt
            </button>
            <button
              onClick={()=>fileRef.current.click()}
              style={{flex:1,minWidth:130,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"10px 16px",borderRadius:10,border:`1px solid ${theme.border}`,
                background:theme.surface||theme.card,color:theme.textMuted,
                fontFamily:theme.font,fontSize:13,fontWeight:600,cursor:"pointer"}}>
              <Upload size={15}/> Import .txt
            </button>
            <input ref={fileRef} type="file" accept=".txt,text/plain" style={{display:"none"}} onChange={handleFile}/>
          </div>
          {importMsg && (
            <div style={{marginTop:12,padding:"9px 14px",borderRadius:8,
              background: importMsg.startsWith("✓") ? "#0d2e1a" : "#2e0d0d",
              color: importMsg.startsWith("✓") ? "#34d399" : "#f87171",
              fontSize:12,fontFamily:theme.font}}>
              {importMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sankey Diagram ────────────────────────────────────────────────────────────
function SankeyDiagram({ credits, debits, theme, currency, mobile }) {
  const ref = useRef(null);
  const [hScale, setHScale] = useState(()=>LOAD("sk_h",1.0));
  // wVal: -3..0..+3  |  0 = default, magnitude = spread, sign = orientation
  const [wVal, setWVal]     = useState(()=>LOAD("sk_w3",0.0));

  useEffect(()=>{ SAVE("sk_h",hScale); },[hScale]);
  useEffect(()=>{ SAVE("sk_w3",wVal);  },[wVal]);

  const surplus = credits.reduce((s,c)=>s+(parseFloat(c.amount)||0),0)
                - debits.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);

  const draw = useCallback(()=>{
    if(!ref.current) return;
    const el=ref.current;
    el.innerHTML="";

    const flipped = wVal < 0;               // left of centre → flip income/expense sides
    const spread  = Math.abs(wVal);          // 0–3 magnitude drives label padding

    const BASE_H = mobile?340:420;
    const W = el.clientWidth||700;
    const H = Math.max(BASE_H, Math.round(BASE_H*hScale));
    const basePad = mobile?108:145;
    const labelPad = Math.round(basePad + spread*70);
    const PAD = {t:22,b:22,l:labelPad,r:labelPad};
    const innerH = H-PAD.t-PAD.b;
    const FLOW_W = W-PAD.l-PAD.r;
    const NODE_W = mobile?10:13;
    const GAP    = mobile?5:7;
    const FS     = mobile?10:11;

    const svg = d3.select(el).append("svg").attr("width",W).attr("height",H).style("font-family",theme.font);
    const defs = svg.append("defs");

    const vc = credits.filter(c=>parseFloat(c.amount)>0);
    const vd = debits.filter(d=>parseFloat(d.amount)>0);
    if(!vc.length||!vd.length){
      svg.append("text").attr("x",W/2).attr("y",H/2).attr("text-anchor","middle")
        .attr("fill",theme.textMuted).attr("font-size",13)
        .text("Add income & expenses to see the Sankey");
      return;
    }

    const incT = vc.reduce((s,c)=>s+parseFloat(c.amount),0);
    const expT = vd.reduce((s,d)=>s+parseFloat(d.amount),0);
    const maxT = Math.max(incT,expT);

    const effH = Math.min(innerH*hScale, innerH*2.2);

    const placeNodes=(nodes,x,color)=>{
      const totalGaps=(nodes.length-1)*GAP;
      const usable=effH-totalGaps;
      let y=PAD.t+(innerH-Math.min(effH,innerH))/2;
      return nodes.map(n=>{
        const h=Math.max(5,(n.value/maxT)*usable);
        const p={...n,x,y,h,color};
        y+=h+GAP;
        return p;
      });
    };

    // ── Left / right assignment based on flip ──
    const leftItems  = flipped
      ? vd.map(d=>({id:d.id,label:d.label,value:parseFloat(d.amount)}))
      : vc.map(c=>({id:c.id,label:c.label,value:parseFloat(c.amount)}));
    const rightItems = flipped
      ? vc.map(c=>({id:c.id,label:c.label,value:parseFloat(c.amount)}))
      : vd.map(d=>({id:d.id,label:d.label,value:parseFloat(d.amount)}));
    const leftColor  = flipped ? theme.debit  : theme.credit;
    const rightColor = flipped ? theme.credit : theme.debit;
    // total flowing into the centre node (always the income side)
    const intoCenter = flipped ? expT : incT;

    const srcNodes = placeNodes(leftItems,  PAD.l,                 leftColor);
    const dstNodes = placeNodes(rightItems, PAD.l+FLOW_W-NODE_W,   rightColor);

    const midX = PAD.l+FLOW_W/2-NODE_W/2;
    const midH = Math.max(5,(Math.min(incT,expT)/maxT)*(effH-(Math.max(vc.length,vd.length)-1)*GAP));
    const midY = PAD.t+(innerH-midH)/2;
    const midNode={x:midX,y:midY,h:midH,color:theme.node};

    // ── src → mid links ──
    let mLY=midNode.y;
    srcNodes.forEach((src,i)=>{
      const lH=src.h, x0=src.x+NODE_W, x1=midNode.x;
      const gid=`gs${i}`;
      const g=defs.append("linearGradient").attr("id",gid).attr("x1","0%").attr("x2","100%");
      g.append("stop").attr("offset","0%").attr("stop-color",leftColor).attr("stop-opacity",0.44);
      g.append("stop").attr("offset","100%").attr("stop-color",theme.node).attr("stop-opacity",0.44);
      svg.append("path")
        .attr("d",`M${x0},${src.y} C${(x0+x1)/2},${src.y} ${(x0+x1)/2},${mLY} ${x1},${mLY} L${x1},${mLY+lH} C${(x0+x1)/2},${mLY+lH} ${(x0+x1)/2},${src.y+lH} ${x0},${src.y+lH} Z`)
        .attr("fill",`url(#${gid})`).attr("stroke","none");
      mLY+=lH;
    });

    // ── mid → dst links ──
    let mRY=midNode.y;
    dstNodes.forEach((dst,i)=>{
      const aH=(dst.value/Math.max(intoCenter,1))*midH;
      const x0=midNode.x+NODE_W, x1=dst.x;
      const gid=`gd${i}`;
      const g=defs.append("linearGradient").attr("id",gid).attr("x1","0%").attr("x2","100%");
      g.append("stop").attr("offset","0%").attr("stop-color",theme.node).attr("stop-opacity",0.44);
      g.append("stop").attr("offset","100%").attr("stop-color",rightColor).attr("stop-opacity",0.44);
      svg.append("path")
        .attr("d",`M${x0},${mRY} C${(x0+x1)/2},${mRY} ${(x0+x1)/2},${dst.y} ${x1},${dst.y} L${x1},${dst.y+dst.h} C${(x0+x1)/2},${dst.y+dst.h} ${(x0+x1)/2},${mRY+aH} ${x0},${mRY+aH} Z`)
        .attr("fill",`url(#${gid})`).attr("stroke","none");
      mRY+=aH;
    });

    // ── Surplus ribbon with arrow-head ──
    if(surplus>0&&incT>0){
      const sH  = Math.max(6,(surplus/maxT)*(effH-(vc.length-1)*GAP));
      const mid = mRY + sH/2;           // vertical centre of the ribbon
      const tipW = Math.min(22, sH*0.7); // arrow-head protrusion width
      const aw   = Math.min(sH*0.55, 18);// arrow-head half-height overhang each side

      // Surplus always trails the right column (normal: trailing income out-flow; flipped: trailing expense out-flow)
      // In normal mode it continues right from mRY off the dst column.
      // We draw a ribbon that tapers into an arrowhead pointing right.
      const rx0 = midNode.x+NODE_W;
      const rx1 = PAD.l+FLOW_W+4;       // end of ribbon body

      const gid="gsu";
      const g=defs.append("linearGradient").attr("id",gid).attr("x1","0%").attr("x2","100%");
      g.append("stop").attr("offset","0%").attr("stop-color",theme.node).attr("stop-opacity",0.3);
      g.append("stop").attr("offset","100%").attr("stop-color",theme.credit).attr("stop-opacity",0.3);

      // Ribbon body (bezier, same as other links)
      svg.append("path")
        .attr("d",`M${rx0},${mRY} C${(rx0+rx1)/2},${mRY} ${(rx0+rx1)/2},${mRY} ${rx1},${mRY} L${rx1},${mRY+sH} C${(rx0+rx1)/2},${mRY+sH} ${(rx0+rx1)/2},${mRY+sH} ${rx0},${mRY+sH} Z`)
        .attr("fill",`url(#${gid})`).attr("stroke","none");

      // Arrow-head triangle (solid, points right)
      svg.append("polygon")
        .attr("points",[
          `${rx1},${mid-aw}`,         // top-left of head
          `${rx1+tipW},${mid}`,        // tip
          `${rx1},${mid+aw}`,          // bottom-left of head
        ].join(" "))
        .attr("fill",theme.credit).attr("opacity",0.75);

      // Label
      svg.append("text")
        .attr("x",rx1+tipW+7).attr("y",mid+4)
        .attr("fill",theme.credit).attr("font-size",FS).attr("font-weight","700")
        .text(`+${fmtS(surplus,currency)} surplus`);
    }

    // ── Nodes ──
    [...srcNodes,midNode,...dstNodes].forEach(n=>{
      svg.append("rect").attr("x",n.x).attr("y",n.y).attr("width",NODE_W).attr("height",n.h)
        .attr("fill",n.color).attr("rx",3);
    });

    // ── Labels ──
    srcNodes.forEach(n=>{
      svg.append("text")
        .attr("x",n.x-7).attr("y",n.y+n.h/2+4).attr("text-anchor","end")
        .attr("fill",theme.text).attr("font-size",FS)
        .text(`${n.label}  ${fmtS(n.value,currency)}`);
    });
    dstNodes.forEach(n=>{
      svg.append("text")
        .attr("x",n.x+NODE_W+7).attr("y",n.y+n.h/2+4)
        .attr("fill",theme.text).attr("font-size",FS)
        .text(`${n.label}  ${fmtS(n.value,currency)}`);
    });
    svg.append("text")
      .attr("x",midNode.x+NODE_W/2).attr("y",midNode.y-8)
      .attr("text-anchor","middle").attr("fill",theme.node).attr("font-size",FS+1).attr("font-weight","700")
      .text("Budget");

  },[credits,debits,theme,currency,hScale,wVal,mobile,surplus]);

  useEffect(()=>{ draw(); },[draw]);

  // Height slider: one-sided 0.5→3, fill grows left→right
  const hTrack = {
    width:"100%",cursor:"pointer",appearance:"none",height:4,borderRadius:2,outline:"none",
    background:`linear-gradient(to right,${theme.accent} ${((hScale-0.5)/2.5)*100}%,${theme.border} 0)`,
    accentColor:theme.accent,
  };

  // Width slider: centred -3→+3, fill shows deviation from centre
  // We colour the filled portion relative to the midpoint
  const wPct  = ((wVal+3)/6)*100;          // 0–100, 50 = centre
  const wTrack = {
    width:"100%",cursor:"pointer",appearance:"none",height:4,borderRadius:2,outline:"none",
    background: wVal===0
      ? theme.border
      : wVal>0
        ? `linear-gradient(to right,${theme.border} 50%,${theme.accent} 50%,${theme.accent} ${wPct}%,${theme.border} ${wPct}%)`
        : `linear-gradient(to right,${theme.border} ${wPct}%,${theme.accent} ${wPct}%,${theme.accent} 50%,${theme.border} 50%)`,
    accentColor:theme.accent,
  };

  const dirLabel = wVal===0 ? "Default" : wVal>0 ? `→ ${wVal.toFixed(1)}× spread` : `← ${Math.abs(wVal).toFixed(1)}× flipped`;

  return (
    <div>
      {/* ── Axis controls ── */}
      <div style={{
        display:"flex",gap:mobile?10:20,flexWrap:"wrap",alignItems:"center",
        background:theme.surface||theme.card,border:`1px solid ${theme.border}`,
        borderRadius:10,padding:"12px 16px",marginBottom:14,
      }}>
        {/* Height */}
        <div style={{flex:1,minWidth:150}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,color:theme.textMuted,fontFamily:theme.font}}>↕ Height</span>
            <span style={{fontSize:11,color:theme.accent,fontFamily:theme.font,fontWeight:700}}>{hScale.toFixed(1)}×</span>
          </div>
          <input type="range" min={0.5} max={3.0} step={0.05} value={hScale}
            onChange={e=>setHScale(parseFloat(e.target.value))} style={hTrack}/>
        </div>

        {/* Width — centred slider */}
        <div style={{flex:1,minWidth:150}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,color:theme.textMuted,fontFamily:theme.font}}>↔ Width / Flip</span>
            <span style={{fontSize:11,color:theme.accent,fontFamily:theme.font,fontWeight:700}}>{dirLabel}</span>
          </div>
          <input type="range" min={-3} max={3} step={0.05} value={wVal}
            onChange={e=>setWVal(parseFloat(e.target.value))} style={wTrack}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
            <span style={{fontSize:9,color:theme.textMuted,fontFamily:theme.font}}>← flip</span>
            <span style={{fontSize:9,color:theme.textMuted,fontFamily:theme.font}}>spread →</span>
          </div>
        </div>

        <button onClick={()=>{setHScale(1.0);setWVal(0.0);}}
          style={{padding:"6px 12px",background:theme.accentSoft,border:`1px solid ${theme.border}`,borderRadius:7,
            cursor:"pointer",color:theme.textMuted,fontSize:11,fontFamily:theme.font,whiteSpace:"nowrap"}}>
          Reset
        </button>
      </div>

      <div style={{width:"100%",overflowX:"auto"}}>
        <div ref={ref} style={{minHeight:mobile?340:420}}/>
      </div>
    </div>
  );
}

// ── Pie Charts ────────────────────────────────────────────────────────────────
function PieChartView({ credits, debits, theme, currency, mobile }) {
  const incRef=useRef(null), expRef=useRef(null);

  const draw=useCallback((el,data,colors,title)=>{
    if(!el) return;
    el.innerHTML="";
    const W=el.clientWidth||300, H=mobile?230:270;
    const R=Math.min(W,H)/2-38;
    const svg=d3.select(el).append("svg").attr("width",W).attr("height",H);
    const valid=data.filter(d=>parseFloat(d.amount)>0);
    if(!valid.length){
      svg.append("text").attr("x",W/2).attr("y",H/2).attr("text-anchor","middle").attr("fill",theme.textMuted).attr("font-size",12).text("No data");
      return;
    }
    const pie=d3.pie().value(d=>parseFloat(d.amount)).sort(null);
    const arc=d3.arc().innerRadius(R*0.38).outerRadius(R);
    const g=svg.append("g").attr("transform",`translate(${W/2},${H/2-6})`);
    pie(valid).forEach((d,i)=>{
      g.append("path").attr("d",arc(d)).attr("fill",colors[i%colors.length]).attr("stroke",theme.bg).attr("stroke-width",2);
    });
    const lg=svg.append("g").attr("transform",`translate(7,${H-valid.length*14-6})`);
    valid.forEach((d,i)=>{
      lg.append("rect").attr("x",0).attr("y",i*14).attr("width",8).attr("height",8).attr("fill",colors[i%colors.length]).attr("rx",2);
      lg.append("text").attr("x",12).attr("y",i*14+8).attr("fill",theme.text).attr("font-size",9).attr("font-family",theme.font)
        .text(`${d.label}: ${fmtS(parseFloat(d.amount),currency)}`);
    });
    svg.append("text").attr("x",W/2).attr("y",15).attr("text-anchor","middle").attr("fill",theme.text)
      .attr("font-size",12).attr("font-weight","700").attr("font-family",theme.font).text(title);
  },[theme,currency,mobile]);

  useEffect(()=>{ draw(incRef.current,credits,[theme.chartColors[0],theme.chartColors[5],theme.chartColors[6],theme.chartColors[3]],"Income Sources"); },[credits,theme,draw]);
  useEffect(()=>{ draw(expRef.current,debits,theme.chartColors.slice(1),"Expense Breakdown"); },[debits,theme,draw]);

  return (
    <div style={{display:"flex",gap:12,flexDirection:mobile?"column":"row"}}>
      {[incRef,expRef].map((r,i)=>(
        <div key={i} ref={r} style={{flex:1,background:theme.card,borderRadius:12,border:`1px solid ${theme.border}`,padding:8,overflow:"hidden"}}/>
      ))}
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChartView({ credits, debits, theme, currency, mobile }) {
  const ref=useRef(null);
  useEffect(()=>{
    if(!ref.current) return;
    const el=ref.current; el.innerHTML="";
    const W=el.clientWidth||700, H=mobile?290:350;
    const PAD={t:28,b:mobile?100:90,l:60,r:14};
    const all=[
      ...credits.map(c=>({label:c.label,value:parseFloat(c.amount)||0,type:"credit"})),
      ...debits.map(d=>({label:d.label,value:parseFloat(d.amount)||0,type:"debit"})),
    ].filter(d=>d.value>0);
    if(!all.length) return;
    const svg=d3.select(el).append("svg").attr("width",W).attr("height",H);
    const x=d3.scaleBand().domain(all.map(d=>d.label)).range([PAD.l,W-PAD.r]).padding(0.28);
    const y=d3.scaleLinear().domain([0,d3.max(all,d=>d.value)*1.14]).range([H-PAD.b,PAD.t]);
    y.ticks(5).forEach(t=>{
      svg.append("line").attr("x1",PAD.l).attr("x2",W-PAD.r).attr("y1",y(t)).attr("y2",y(t)).attr("stroke",theme.border).attr("stroke-dasharray","3,3");
    });
    all.forEach(d=>{
      const c=d.type==="credit"?theme.credit:theme.debit;
      svg.append("rect").attr("x",x(d.label)).attr("y",y(d.value)).attr("width",x.bandwidth()).attr("height",H-PAD.b-y(d.value)).attr("fill",c).attr("rx",4).attr("opacity",0.88);
      svg.append("text").attr("x",x(d.label)+x.bandwidth()/2).attr("y",y(d.value)-4).attr("text-anchor","middle").attr("fill",c).attr("font-size",mobile?9:10).attr("font-weight","600").text(fmtS(d.value,currency));
    });
    const xG=svg.append("g").attr("transform",`translate(0,${H-PAD.b})`).call(d3.axisBottom(x));
    xG.select(".domain").attr("stroke",theme.border);
    xG.selectAll("text").attr("fill",theme.textMuted).attr("font-size",mobile?9:10).attr("transform","rotate(-36)").attr("text-anchor","end").attr("font-family",theme.font);
    xG.selectAll("line").attr("stroke",theme.border);
    const yG=svg.append("g").attr("transform",`translate(${PAD.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d=>fmtS(d,currency)));
    yG.select(".domain").attr("stroke",theme.border);
    yG.selectAll("text").attr("fill",theme.textMuted).attr("font-size",mobile?9:10).attr("font-family",theme.font);
    yG.selectAll("line").attr("stroke",theme.border);
    const lg=svg.append("g").attr("transform",`translate(${PAD.l+6},${PAD.t})`);
    [[theme.credit,"Income"],[theme.debit,"Expense"]].forEach(([c,l],i)=>{
      lg.append("rect").attr("x",i*76).attr("y",0).attr("width",10).attr("height",10).attr("fill",c).attr("rx",2);
      lg.append("text").attr("x",i*76+14).attr("y",9).attr("fill",theme.text).attr("font-size",10).attr("font-family",theme.font).text(l);
    });
  },[credits,debits,theme,currency,mobile]);
  return <div ref={ref} style={{width:"100%",overflowX:"auto"}}/>;
}

// ── Editable Row ──────────────────────────────────────────────────────────────
function EditableRow({ row, onUpdate, onDelete, theme, type, mobile, currency }) {
  const sym=CURRENCIES[currency]?.symbol||"$";
  const p=mobile?"10px 6px":"7px 6px";
  return (
    <tr style={{borderBottom:`1px solid ${theme.border}`}}>
      <td style={{padding:p}}>
        <input value={row.label} onChange={e=>onUpdate({...row,label:e.target.value})}
          style={{background:"transparent",border:`1px solid ${theme.border}`,borderRadius:6,padding:mobile?"9px 10px":"5px 8px",color:theme.text,fontFamily:theme.font,fontSize:mobile?14:13,width:"100%",outline:"none"}}
          placeholder="Label…"/>
      </td>
      <td style={{padding:p}}>
        <div style={{display:"flex",alignItems:"center",border:`1px solid ${theme.border}`,borderRadius:6,overflow:"hidden"}}>
          <span style={{padding:mobile?"9px 8px":"5px 6px",background:theme.accentSoft,color:type==="credit"?theme.credit:theme.debit,fontSize:mobile?13:12,fontFamily:theme.font,flexShrink:0}}>{sym}</span>
          <input type="number" value={row.amount} onChange={e=>onUpdate({...row,amount:e.target.value})}
            style={{background:"transparent",border:"none",padding:mobile?"9px 8px":"5px 6px",color:type==="credit"?theme.credit:theme.debit,fontFamily:theme.font,fontSize:mobile?14:13,width:"100%",textAlign:"right",outline:"none"}}
            placeholder="0.00"/>
        </div>
      </td>
      <td style={{padding:"7px 4px",textAlign:"center"}}>
        <button onClick={onDelete} style={{background:"none",border:"none",cursor:"pointer",color:theme.textMuted,padding:4}}>
          <Trash2 size={mobile?17:14}/>
        </button>
      </td>
    </tr>
  );
}

// ── Table View ────────────────────────────────────────────────────────────────
function TableView({ credits, debits, setCredits, setDebits, theme, currency, mobile }) {
  const ti=credits.reduce((s,c)=>s+(parseFloat(c.amount)||0),0);
  const te=debits.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  const surplus=ti-te;
  return (
    <div style={{display:"flex",gap:12,flexDirection:mobile?"column":"row",flexWrap:mobile?"nowrap":"wrap"}}>
      {[
        {title:"Income / Credits",rows:credits,setRows:setCredits,type:"credit"},
        {title:"Expenses / Debits",rows:debits,setRows:setDebits,type:"debit"},
      ].map(({title,rows,setRows,type})=>(
        <div key={type} style={{flex:1,background:theme.card,borderRadius:12,border:`1px solid ${theme.border}`,overflow:"hidden"}}>
          <div style={{padding:mobile?"14px 16px 12px":"11px 14px 9px",borderBottom:`1px solid ${theme.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,fontSize:mobile?15:13,color:type==="credit"?theme.credit:theme.debit,fontFamily:theme.font}}>{title}</span>
            <button onClick={()=>setRows(r=>[...r,{id:uid(),label:"",amount:""}])}
              style={{background:theme.accentSoft,border:"none",borderRadius:8,padding:mobile?"7px 15px":"4px 11px",cursor:"pointer",color:theme.accent,fontSize:mobile?13:12,display:"flex",alignItems:"center",gap:5}}>
              <PlusCircle size={mobile?15:13}/> Add
            </button>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:theme.font}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${theme.border}`}}>
                <th style={{padding:mobile?"10px 6px":"7px 6px",textAlign:"left",color:theme.textMuted,fontWeight:600,fontSize:mobile?12:11}}>Label</th>
                <th style={{padding:mobile?"10px 6px":"7px 6px",textAlign:"right",color:theme.textMuted,fontWeight:600,fontSize:mobile?12:11}}>Amount</th>
                <th style={{width:32}}/>
              </tr>
            </thead>
            <tbody>
              {rows.map(row=>(
                <EditableRow key={row.id} row={row} theme={theme} type={type} mobile={mobile} currency={currency}
                  onUpdate={u=>setRows(r=>r.map(x=>x.id===row.id?u:x))}
                  onDelete={()=>setRows(r=>r.filter(x=>x.id!==row.id))}/>
              ))}
            </tbody>
            <tfoot>
              <tr style={{borderTop:`2px solid ${theme.border}`}}>
                <td style={{padding:mobile?"12px 6px":"9px 6px",fontWeight:700,color:theme.textMuted,fontSize:mobile?12:11}}>TOTAL</td>
                <td style={{padding:mobile?"12px 6px":"9px 6px",textAlign:"right",fontWeight:700,color:type==="credit"?theme.credit:theme.debit,fontSize:mobile?15:13}}>
                  {fmt(type==="credit"?ti:te,currency)}
                </td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
      {/* Summary row */}
      <div style={{width:"100%",background:theme.card,borderRadius:12,border:`1px solid ${theme.border}`,padding:mobile?20:14}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"space-around"}}>
          {[
            {label:"Total Income",val:ti,color:theme.credit,Icon:TrendingUp},
            {label:"Total Expenses",val:te,color:theme.debit,Icon:TrendingDown},
            {label:surplus>=0?"Surplus":"Deficit",val:Math.abs(surplus),color:surplus>=0?theme.credit:theme.debit,Icon:surplus>=0?DollarSign:AlertCircle},
          ].map(({label,val,color,Icon})=>(
            <div key={label} style={{textAlign:"center",minWidth:mobile?110:100,padding:mobile?"10px 0":"4px 0"}}>
              <Icon size={mobile?22:18} color={color} style={{marginBottom:4}}/>
              <div style={{fontSize:mobile?12:10,color:theme.textMuted,fontFamily:theme.font}}>{label}</div>
              <div style={{fontSize:mobile?19:17,fontWeight:700,color,fontFamily:theme.font}}>{fmt(val,currency)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function BudgetApp() {
  const [themeName, setThemeName] = useState(()=>LOAD("bf_theme","Midnight"));
  const [currency,  setCurrency]  = useState(()=>LOAD("bf_curr","USD"));
  const [mobile,    setMobile]    = useState(()=>LOAD("bf_mobile",false));
  const [tab,       setTab]       = useState(()=>LOAD("bf_tab","sankey"));
  const [credits,   setCredits]   = useState(()=>LOAD("bf_credits",DEFAULT_CREDITS));
  const [debits,    setDebits]    = useState(()=>LOAD("bf_debits",DEFAULT_DEBITS));
  const [settings,  setSettings]  = useState(false);

  const theme = THEMES[themeName]||THEMES["Midnight"];

  useEffect(()=>{ SAVE("bf_theme",themeName); },[themeName]);
  useEffect(()=>{ SAVE("bf_curr",currency);   },[currency]);
  useEffect(()=>{ SAVE("bf_mobile",mobile);   },[mobile]);
  useEffect(()=>{ SAVE("bf_tab",tab);         },[tab]);
  useEffect(()=>{ SAVE("bf_credits",credits); },[credits]);
  useEffect(()=>{ SAVE("bf_debits",debits);   },[debits]);

  const handleImport = (payload) => {
    setCredits(payload.credits.map(c=>({...c,id:uid()})));
    setDebits(payload.debits.map(d=>({...d,id:uid()})));
    if(payload.currency && CURRENCIES[payload.currency]) setCurrency(payload.currency);
    if(payload.theme    && THEMES[payload.theme])        setThemeName(payload.theme);
    setSettings(false);
  };

  const totalIn  = credits.reduce((s,c)=>s+(parseFloat(c.amount)||0),0);
  const totalOut = debits.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);

  const TABS=[
    {id:"table",  label:"Table",  Icon:Table   },
    {id:"sankey", label:"Sankey", Icon:GitFork },
    {id:"pie",    label:"Pie",    Icon:PieChart},
    {id:"bar",    label:"Bar",    Icon:BarChart2},
  ];

  return (
    <div style={{minHeight:"100vh",background:theme.bg,fontFamily:theme.font,color:theme.text,transition:"background 0.3s,color 0.3s"}}>

      {/* ── Header ── */}
      <div style={{background:theme.card,borderBottom:`1px solid ${theme.border}`,padding:"0 12px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:mobile?"100%":930,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:mobile?58:50}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <DollarSign size={mobile?20:17} color={theme.accent}/>
            <span style={{fontWeight:700,fontSize:mobile?17:15,letterSpacing:"-0.5px",color:theme.text}}>BudgetFlow</span>
            {!mobile&&<span style={{fontSize:9,color:theme.textMuted,background:theme.accentSoft,borderRadius:4,padding:"2px 5px"}}>intern edition</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            <span style={{fontSize:mobile?12:11,color:theme.credit,background:theme.accentSoft,borderRadius:20,padding:mobile?"4px 11px":"3px 9px"}}>+{fmtS(totalIn,currency)}</span>
            <span style={{fontSize:mobile?12:11,color:theme.debit,background:theme.accentSoft,borderRadius:20,padding:mobile?"4px 11px":"3px 9px"}}>−{fmtS(totalOut,currency)}</span>
          </div>
          <button onClick={()=>setSettings(true)}
            style={{background:theme.accentSoft,border:`1px solid ${theme.border}`,borderRadius:9,
              padding:mobile?"10px 15px":"7px 13px",cursor:"pointer",color:theme.text,
              display:"flex",alignItems:"center",gap:6,fontSize:mobile?13:12}}>
            <Settings size={mobile?17:14}/>
            {!mobile&&"Settings"}
          </button>
        </div>
        {/* Tabs */}
        <div style={{maxWidth:mobile?"100%":930,margin:"0 auto",display:"flex"}}>
          {TABS.map(({id,label,Icon})=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:mobile?1:"none",background:"none",border:"none",cursor:"pointer",
              padding:mobile?"11px 0":"8px 18px",
              fontSize:mobile?10:12,fontFamily:theme.font,fontWeight:600,
              color:tab===id?theme.accent:theme.textMuted,
              borderBottom:tab===id?`2px solid ${theme.accent}`:"2px solid transparent",
              display:"flex",alignItems:"center",justifyContent:"center",gap:mobile?0:5,
              transition:"color 0.18s",
            }}>
              <Icon size={mobile?19:14}/>
              {!mobile&&" "}{!mobile&&label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{maxWidth:mobile?"100%":930,margin:"0 auto",padding:mobile?10:16}}>
        {tab==="table"  && <TableView credits={credits} debits={debits} setCredits={setCredits} setDebits={setDebits} theme={theme} currency={currency} mobile={mobile}/>}
        {tab==="sankey" && (
          <div style={{background:theme.card,borderRadius:12,border:`1px solid ${theme.border}`,padding:mobile?12:16}}>
            <div style={{fontSize:mobile?13:12,fontWeight:700,marginBottom:12,color:theme.textMuted}}>Cash Flow · Sankey Diagram</div>
            <SankeyDiagram credits={credits} debits={debits} theme={theme} currency={currency} mobile={mobile}/>
          </div>
        )}
        {tab==="pie" && (
          <div>
            <div style={{fontSize:mobile?13:12,fontWeight:700,marginBottom:12,color:theme.textMuted}}>Budget Breakdown · Pie Charts</div>
            <PieChartView credits={credits} debits={debits} theme={theme} currency={currency} mobile={mobile}/>
          </div>
        )}
        {tab==="bar" && (
          <div style={{background:theme.card,borderRadius:12,border:`1px solid ${theme.border}`,padding:mobile?12:16}}>
            <div style={{fontSize:mobile?13:12,fontWeight:700,marginBottom:12,color:theme.textMuted}}>All Items · Bar Chart</div>
            <BarChartView credits={credits} debits={debits} theme={theme} currency={currency} mobile={mobile}/>
          </div>
        )}
      </div>

      {/* ── Settings ── */}
      {settings&&(
        <SettingsPanel
          themeName={themeName} setThemeName={setThemeName}
          currency={currency}   setCurrency={setCurrency}
          mobileMode={mobile}   setMobileMode={setMobile}
          theme={theme}         onClose={()=>setSettings(false)}
          credits={credits}     debits={debits}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
