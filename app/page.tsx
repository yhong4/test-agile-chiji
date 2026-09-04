'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Crosshair, Gauge, RotateCcw, ScanLine, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TestState = 'idle' | 'running' | 'done';
type Point = { x: number; y: number };

const IPADS = {
  mini: { label: 'iPad mini · 8.3英寸', short: '8.3″', widthCm: 19.54, factor: 1.08 },
  pro11: { label: 'iPad / Air / Pro · 10.9–11英寸', short: '11″', widthCm: 24.97, factor: 1 },
  pro13: { label: 'iPad Air / Pro · 12.9–13英寸', short: '13″', widthCm: 28.16, factor: 0.94 },
} as const;

const TEST_SECONDS = 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

function CrosshairCursor({ point, visible }: { point: Point; visible: boolean }) {
  if (!visible) return null;
  return <div className="crosshair" style={{ left: point.x, top: point.y }}><span /></div>;
}

function TrackingTest({ onComplete }: { onComplete: (score: number) => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);
  const lastTickRef = useRef(0);
  const hoverMsRef = useRef(0);
  const pointerRef = useRef<Point>({ x: -100, y: -100 });
  const [state, setState] = useState<TestState>('idle');
  const [remaining, setRemaining] = useState(TEST_SECONDS);
  const [target, setTarget] = useState<Point>({ x: 120, y: 110 });
  const [pointer, setPointer] = useState<Point>({ x: -100, y: -100 });
  const [score, setScore] = useState(0);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const final = clamp((hoverMsRef.current / (TEST_SECONDS * 1000)) * 100, 0, 100);
    setScore(final); setRemaining(0); setState('done'); onComplete(final);
  }, [onComplete]);

  const start = useCallback(() => {
    if (state !== 'idle') return;
    const now = performance.now();
    startedRef.current = now; lastTickRef.current = now; hoverMsRef.current = 0;
    setState('running'); setRemaining(TEST_SECONDS); setScore(0);
    timerRef.current = setInterval(() => {
      const t = performance.now();
      const elapsed = t - startedRef.current;
      const area = areaRef.current;
      if (area) {
        const w = area.clientWidth, h = area.clientHeight;
        const px = w * (.5 + .36 * Math.sin(elapsed / 670));
        const py = h * (.5 + .28 * Math.sin(elapsed / 430 + .7));
        setTarget({ x: px, y: py });
        const p = pointerRef.current;
        if (Math.hypot(p.x - px, p.y - py) <= 32) hoverMsRef.current += t - lastTickRef.current;
      }
      lastTickRef.current = t;
      setRemaining(Math.max(0, (TEST_SECONDS * 1000 - elapsed) / 1000));
      setScore(clamp((hoverMsRef.current / Math.max(1, elapsed)) * 100, 0, 100));
      if (elapsed >= TEST_SECONDS * 1000) finish();
    }, 40);
  }, [finish, state]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    pointerRef.current = p; setPointer(p);
  };
  const reset = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setState('idle'); setRemaining(TEST_SECONDS); setScore(0); setPointer({x:-100,y:-100}); };

  return <TestFrame icon={<Activity />} title="追踪测试" metric={`${score}%`} hint="跟住移动目标，悬停越久越精准" state={state} remaining={remaining} onReset={reset}>
    <div ref={areaRef} onPointerEnter={start} onPointerMove={move} className={`test-surface lab-grid relative h-[310px] overflow-hidden rounded-xl border bg-[#090f10] ${state==='running'?'active border-primary/60':'border-border'}`}>
      <div className="absolute inset-x-0 top-0 flex justify-between p-4 text-sm text-muted-foreground"><span>移入区域自动开始</span><span className="font-mono text-primary">{remaining.toFixed(1)}s</span></div>
      <div className="absolute size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#6ce8ff] bg-[#6ce8ff]/10 shadow-[0_0_28px_rgba(108,232,255,.35)]" style={{left:target.x,top:target.y}}><div className="absolute inset-[9px] rounded-full bg-[#6ce8ff]" /></div>
      <CrosshairCursor point={pointer} visible={pointer.x >= 0} />
      {state==='done' && <ResultOverlay big={`${score}%`} label="跟踪精准度" onAgain={reset} />}
    </div>
  </TestFrame>;
}

function PositioningTest({ onComplete }: { onComplete: (result: { hits: number; reaction: number }) => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);
  const targetBornRef = useRef(0);
  const reactionsRef = useRef<number[]>([]);
  const hitsRef = useRef(0);
  const [state, setState] = useState<TestState>('idle');
  const [remaining, setRemaining] = useState(TEST_SECONDS);
  const [target, setTarget] = useState<Point>({ x: 150, y: 150 });
  const [pointer, setPointer] = useState<Point>({ x: -100, y: -100 });
  const [hits, setHits] = useState(0);
  const [reaction, setReaction] = useState(0);

  const spawn = useCallback(() => {
    const area = areaRef.current; if (!area) return;
    setTarget({ x: 42 + Math.random() * Math.max(1, area.clientWidth - 84), y: 64 + Math.random() * Math.max(1, area.clientHeight - 106) });
    targetBornRef.current = performance.now();
  }, []);
  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
    const arr = reactionsRef.current;
    const avg = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    setReaction(avg); setRemaining(0); setState('done'); onComplete({ hits: hitsRef.current, reaction: avg });
  }, [onComplete]);
  const start = useCallback(() => {
    if (state !== 'idle') return;
    const now = performance.now(); startedRef.current = now; targetBornRef.current = now; reactionsRef.current=[]; hitsRef.current=0;
    setState('running'); setRemaining(TEST_SECONDS); setHits(0); setReaction(0); spawn();
    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - startedRef.current;
      setRemaining(Math.max(0, (TEST_SECONDS * 1000 - elapsed) / 1000));
      if (elapsed >= TEST_SECONDS * 1000) finish();
    }, 40);
  }, [finish, spawn, state]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r=e.currentTarget.getBoundingClientRect(); const p={x:e.clientX-r.left,y:e.clientY-r.top}; setPointer(p);
    if (state==='running' && Math.hypot(p.x-target.x,p.y-target.y) <= 24) {
      const rt = performance.now() - targetBornRef.current;
      reactionsRef.current.push(rt); hitsRef.current += 1; setHits(hitsRef.current);
      setReaction(Math.round(reactionsRef.current.reduce((a,b)=>a+b,0)/reactionsRef.current.length)); spawn();
    }
  };
  const reset=()=>{if(timerRef.current)clearInterval(timerRef.current);timerRef.current=null;setState('idle');setRemaining(TEST_SECONDS);setHits(0);setReaction(0);setPointer({x:-100,y:-100});};

  return <TestFrame icon={<Target />} title="定位测试" metric={`${hits} 命中`} hint="快速扫向随机目标，无需点击" state={state} remaining={remaining} onReset={reset}>
    <div ref={areaRef} onPointerEnter={start} onPointerMove={move} className={`test-surface lab-grid relative h-[310px] overflow-hidden rounded-xl border bg-[#090f10] ${state==='running'?'active border-primary/60':'border-border'}`}>
      <div className="absolute inset-x-0 top-0 flex justify-between p-4 text-sm text-muted-foreground"><span>平均反应 <b className="text-foreground">{reaction || '—'}{reaction ? ' ms':''}</b></span><span className="font-mono text-primary">{remaining.toFixed(1)}s</span></div>
      {state!=='done' && <div className="absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary shadow-[0_0_24px_rgba(216,255,53,.28)]" style={{left:target.x,top:target.y}}><div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" /></div>}
      <CrosshairCursor point={pointer} visible={pointer.x>=0}/>
      {state==='done'&&<ResultOverlay big={`${hits} 次`} label={`平均反应 ${reaction || '—'} ms`} onAgain={reset}/>} 
    </div>
  </TestFrame>;
}

function TurnTest({ device, current, onComplete }: { device: keyof typeof IPADS; current: number; onComplete: (cm: number) => void }) {
  const lastX=useRef<number|null>(null); const travelled=useRef(0); const [state,setState]=useState<TestState>('idle'); const [progress,setProgress]=useState(0); const [cm,setCm]=useState(0); const [pointer,setPointer]=useState<Point>({x:-100,y:-100});
  const start=()=>{if(state==='idle'){setState('running');travelled.current=0;lastX.current=null;setProgress(0);setCm(0);}};
  const move=(e:React.PointerEvent<HTMLDivElement>)=>{
    const r=e.currentTarget.getBoundingClientRect(); const p={x:e.clientX-r.left,y:e.clientY-r.top}; setPointer(p); if(state!=='running'){lastX.current=e.clientX;return;}
    if(lastX.current!==null) travelled.current+=Math.abs(e.clientX-lastX.current); lastX.current=e.clientX;
    const targetPx=r.width*1.35*(100/current); const next=Math.min(100,(travelled.current/targetPx)*100); setProgress(next);
    const nextCm=travelled.current*(IPADS[device].widthCm/r.width); setCm(nextCm);
    if(next>=100){const final=Number(nextCm.toFixed(1));setState('done');setCm(final);onComplete(final);}
  };
  const reset=()=>{lastX.current=null;travelled.current=0;setState('idle');setProgress(0);setCm(0);setPointer({x:-100,y:-100});};
  return <TestFrame icon={<RotateCcw />} title="360°转身测试" metric={`${cm.toFixed(1)} cm`} hint="左右持续移动，完成一圈自动结算" state={state} onReset={reset}>
    <div onPointerEnter={start} onPointerLeave={()=>{lastX.current=null;}} onPointerMove={move} className={`test-surface lab-grid relative h-[310px] overflow-hidden rounded-xl border bg-[#090f10] ${state==='running'?'active border-primary/60':'border-border'}`}>
      <div className="absolute inset-x-0 top-0 flex justify-between p-4 text-sm text-muted-foreground"><span>对标 Aim Lab 的 cm/360 表达</span><span className="font-mono text-primary">{Math.round(progress)}%</span></div>
      <div className="absolute left-1/2 top-[54%] size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-[#0e1617]">
        <div className="absolute inset-3 rounded-full border border-dashed border-[#435051]" />
        <div className="absolute left-1/2 top-1/2 h-[42%] w-0.5 origin-bottom -translate-x-1/2 -translate-y-full bg-primary shadow-[0_0_14px_rgba(216,255,53,.7)]" style={{transform:`translateX(-50%) translateY(-100%) rotate(${progress*3.6}deg)`}} />
        <div className="absolute inset-0 grid place-items-center"><span className="mt-14 font-mono text-2xl font-bold">{cm.toFixed(1)}</span><span className="absolute mt-24 text-xs text-muted-foreground">厘米</span></div>
      </div>
      <div className="absolute inset-x-5 bottom-5"><Progress value={progress}/></div>
      <CrosshairCursor point={pointer} visible={pointer.x>=0}/>
      {state==='done'&&<ResultOverlay big={`${cm.toFixed(1)} cm`} label="完成 360° 转身" onAgain={reset}/>} 
    </div>
  </TestFrame>;
}

function TestFrame({icon,title,metric,hint,state,remaining,onReset,children}:{icon:React.ReactNode;title:string;metric:string;hint:string;state:TestState;remaining?:number;onReset:()=>void;children:React.ReactNode}){
  return <section><div className="mb-3 flex items-end justify-between gap-4"><div><div className="mb-1 flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-primary">{icon}{title}<span className={`rounded-full px-2 py-0.5 text-xs ${state==='running'?'bg-primary/15 text-primary':state==='done'?'bg-[#6ce8ff]/15 text-[#6ce8ff]':'bg-secondary text-muted-foreground'}`}>{state==='running'?'测试中':state==='done'?'已完成':'待测试'}</span></div><p className="text-sm text-muted-foreground">{hint}</p></div><div className="flex items-center gap-2"><span className="font-mono text-lg font-bold">{metric}</span>{state!=='idle'&&<Button aria-label="重新测试" size="icon-sm" variant="ghost" onClick={onReset}><RotateCcw/></Button>}</div></div>{remaining!==undefined&&<Progress className="mb-3 h-1" value={(remaining/TEST_SECONDS)*100}/>} {children}</section>;
}
function ResultOverlay({big,label,onAgain}:{big:string;label:string;onAgain:()=>void}){return <div className="absolute inset-0 z-10 grid place-items-center bg-[#081011]/90 backdrop-blur-sm"><div className="text-center"><Sparkles className="mx-auto mb-3 size-6 text-primary"/><div className="font-mono text-5xl font-bold tracking-tight text-primary">{big}</div><p className="mt-2 text-muted-foreground">{label}</p><Button className="mt-5" variant="outline" onClick={onAgain}><RotateCcw/>再测一次</Button></div></div>}

export default function Home(){
  const [device,setDevice]=useState<keyof typeof IPADS>('pro11'); const [fingers,setFingers]=useState('4'); const [gyro,setGyro]=useState('scope'); const [recoil,setRecoil]=useState('slight-up'); const [current,setCurrent]=useState(100);
  const [tracking,setTracking]=useState<number|null>(null); const [positioning,setPositioning]=useState<{hits:number;reaction:number}|null>(null); const [turn,setTurn]=useState<number|null>(null); const [generated,setGenerated]=useState(false);
  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options?:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tool={name:'configure_ipad_sensitivity_profile',title:'配置 iPad 灵敏度画像',description:'设置可见界面中的 iPad 尺寸、操作指位、陀螺仪、当前压枪表现和常规灵敏度，并生成一组游戏可录入的基线方案。',inputSchema:{type:'object',properties:{device:{type:'string',enum:['mini','pro11','pro13']},fingers:{type:'integer',minimum:2,maximum:6},gyro:{type:'string',enum:['off','scope','always']},recoil:{type:'string',enum:['up','slight-up','stable','down']},current:{type:'integer',minimum:1,maximum:400}},required:['device','fingers','gyro','recoil','current'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input:unknown){const v=input as {device?:string;fingers?:number;gyro?:string;recoil?:string;current?:number};if(!v||!(v.device&&v.device in IPADS)||![2,3,4,5,6].includes(Number(v.fingers))||!['off','scope','always'].includes(String(v.gyro))||!['up','slight-up','stable','down'].includes(String(v.recoil))||!Number.isInteger(v.current)||Number(v.current)<1||Number(v.current)>400)throw new Error('画像参数无效');setDevice(v.device as keyof typeof IPADS);setFingers(String(v.fingers));setGyro(String(v.gyro));setRecoil(String(v.recoil));setCurrent(Number(v.current));setGenerated(true);return {status:'configured',device:v.device,fingers:v.fingers,current:v.current};}};
    try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[]);
  const allDone=tracking!==null&&positioning!==null&&turn!==null;
  const output=useMemo(()=>{
    const d=IPADS[device]; const track=tracking??58; const hits=positioning?.hits??10; const reaction=positioning?.reaction||620; const recoilAdjust={up:14,'slight-up':7,stable:0,down:-8}[recoil]??0; const fingerAdjust=(Number(fingers)-4)*2;
    const trackAdjust=(60-track)*.16; const speedAdjust=clamp((reaction-520)/35,-5,8); const turnTarget=device==='mini'?23:device==='pro13'?31:27; const turnAdjust=turn?clamp(((turn-turnTarget)/turnTarget)*18,-14,14):0;
    const general=clamp(96*d.factor+fingerAdjust+speedAdjust+turnAdjust,1,400); const vertical=clamp(100+recoilAdjust+trackAdjust,50,200); const aim=clamp(58*d.factor+speedAdjust+(hits<8?4:0),1,400); const ads=clamp(54*d.factor+recoilAdjust*.45+trackAdjust,1,400);
    const scopes=[['红点 / 全息',1],['2倍镜',.72],['3倍镜',.54],['4倍镜 / VSS',.42],['6倍镜',.24],['8倍镜',.15]].map(([name,m])=>({name:name as string,value:clamp(ads*(m as number),1,400)}));
    return {general,vertical,aim,ads,scopes};
  },[device,fingers,recoil,tracking,positioning,turn]);
  const insight=useMemo(()=>{if(!allDone)return '完成三项测试后，将结合跟踪、反应与转身距离校准这组基线。'; if((tracking??0)<55)return '跟踪精度偏低：先将红点与 2 倍镜各下调 3%，练两局后再测，避免追枪时反复越过目标。'; if((positioning?.reaction??999)>650)return '定位反应较慢：常规与瞄准灵敏度可各提高 3%，优先改善近距离转向，再微调倍镜。'; if((turn??0)>32)return '转身距离偏长：常规灵敏度建议先上调 4%，目标是一次舒适滑动完成约 180°。'; return '数据较均衡：先原样使用 2–3 局；若压枪仍向上飘，只提高垂直增强 3%，不要同时改多个参数。';},[allDone,tracking,positioning,turn]);
  return <main className="mx-auto min-h-screen max-w-[1360px] px-4 py-5 sm:px-6 lg:px-8">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Crosshair className="size-6"/></div><div><h1 className="text-xl font-bold tracking-tight">iPad 压枪灵敏度实验室</h1><p className="text-sm text-muted-foreground">和平精英 · 指针 / 触控调试助手</p></div></div><div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground"><span className="size-2 rounded-full bg-primary shadow-[0_0_10px_#d8ff35]"/>数值范围已限制为游戏可录入区间</div></header>
    <div className="tablet-shell overflow-hidden rounded-[26px] border border-border bg-card/70 shadow-[0_30px_100px_rgba(0,0,0,.35)] backdrop-blur-sm">
      <div className="grid lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-[#0c1213] p-5 lg:border-b-0 lg:border-r lg:p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">01 / 设备画像</p><h2 className="mt-1 text-lg font-semibold">先还原你的操作环境</h2></div><Gauge className="size-5 text-muted-foreground"/></div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="iPad 尺寸"><Select value={device} onValueChange={(v)=>setDevice(v as keyof typeof IPADS)}><SelectTrigger className="h-11 w-full bg-[#11191a]"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(IPADS).map(([k,v])=><SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="操作指位"><Select value={fingers} onValueChange={(v)=>setFingers(v as string)}><SelectTrigger className="h-11 w-full bg-[#11191a]"><SelectValue/></SelectTrigger><SelectContent>{['2','3','4','5','6'].map(v=><SelectItem key={v} value={v}>{v} 指操作</SelectItem>)}</SelectContent></Select></Field>
            <Field label="陀螺仪"><Select value={gyro} onValueChange={(v)=>setGyro(v as string)}><SelectTrigger className="h-11 w-full bg-[#11191a]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="off">关闭</SelectItem><SelectItem value="scope">开镜开启</SelectItem><SelectItem value="always">全程开启</SelectItem></SelectContent></Select></Field>
            <Field label="当前压枪表现"><Select value={recoil} onValueChange={(v)=>setRecoil(v as string)}><SelectTrigger className="h-11 w-full bg-[#11191a]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="up">枪口明显上飘</SelectItem><SelectItem value="slight-up">枪口略微上飘</SelectItem><SelectItem value="stable">基本稳定</SelectItem><SelectItem value="down">经常向下过压</SelectItem></SelectContent></Select></Field>
          </div>
          <div className="mt-6 rounded-xl border border-border bg-[#11191a] p-4"><div className="mb-4 flex items-center justify-between"><label className="text-sm text-muted-foreground">当前常规灵敏度</label><b className="font-mono text-primary">{current}%</b></div><Slider min={1} max={400} step={1} value={[current]} onValueChange={(v)=>setCurrent(Array.isArray(v)?Number(v[0]):Number(v))}/><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>1</span><span>400</span></div></div>
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[.055] p-4 text-sm leading-6 text-muted-foreground"><b className="text-foreground">当前适配：</b>{IPADS[device].short} 横竖屏布局；测试区域会按真实屏幕宽度换算转身距离。</div>
        </aside>
        <section className="min-w-0 p-5 lg:p-7"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">02 / 10 秒校准</p><div className="mt-1 flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl font-semibold tracking-tight">移入测试区，立即开始</h2><p className="text-sm text-muted-foreground">不需点击 · 鼠标、触控笔与触控均可</p></div></div>
          <Tabs defaultValue="tracking"><TabsList className="mb-5 h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl bg-[#0b1112] p-1"><TabsTrigger value="tracking" className="min-w-[130px] px-4"><ScanLine/>追踪</TabsTrigger><TabsTrigger value="positioning" className="min-w-[130px] px-4"><Target/>定位</TabsTrigger><TabsTrigger value="turn" className="min-w-[150px] px-4"><RotateCcw/>360°转身</TabsTrigger></TabsList><TabsContent value="tracking"><TrackingTest onComplete={setTracking}/></TabsContent><TabsContent value="positioning"><PositioningTest onComplete={setPositioning}/></TabsContent><TabsContent value="turn"><TurnTest device={device} current={current} onComplete={setTurn}/></TabsContent></Tabs>
          <div className="mt-6 grid grid-cols-3 gap-2">{[{l:'跟踪精准度',v:tracking===null?'待测试':`${tracking}%`},{l:'定位 / 反应',v:positioning===null?'待测试':`${positioning.hits} / ${positioning.reaction}ms`},{l:'转身距离',v:turn===null?'待测试':`${turn}cm`}].map(x=><div key={x.l} className="rounded-xl border border-border bg-[#0c1213] p-3"><p className="text-xs text-muted-foreground">{x.l}</p><p className="mt-1 truncate font-mono text-sm font-bold text-foreground">{x.v}</p></div>)}</div>
        </section>
      </div>
      <section className="border-t border-border bg-[#090e0f] p-5 lg:p-7"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">03 / 专属方案</p><h2 className="mt-1 text-2xl font-semibold">可直接录入游戏的灵敏度</h2></div><Button size="lg" className="h-11 px-5" onClick={()=>setGenerated(true)}><Sparkles/> {allDone?'生成测试方案':'生成基线方案'}</Button></div>
        <div className="grid gap-3 md:grid-cols-4"><Stat label="常规灵敏度" value={output.general} suffix="%"/><Stat label="垂直灵敏度增强" value={output.vertical} suffix="%"/><Stat label="瞄准灵敏度" value={output.aim} suffix="%"/><Stat label="开镜模式灵敏度" value={output.ads} suffix="%"/></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{output.scopes.map(s=><div key={s.name} className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{s.name}</p><p className="mt-1 font-mono text-xl font-bold">{s.value}<span className="ml-0.5 text-xs text-muted-foreground">%</span></p></div>)}</div>
        <div className={`mt-5 flex gap-3 rounded-xl border p-4 transition-colors ${generated?'border-primary/35 bg-primary/[.06]':'border-border bg-card'}`}><Sparkles className="mt-0.5 size-5 shrink-0 text-primary"/><div><p className="font-semibold">微调建议</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{insight}</p><p className="mt-1 text-xs text-muted-foreground">每次只调整一项，幅度控制在 3%–5%；最终以训练场连续压枪手感为准。</p></div></div>
      </section>
    </div>
    <footer className="flex flex-wrap justify-between gap-2 px-2 py-5 text-xs text-muted-foreground"><span>仅针对 iPad 8.3″ / 10.9–11″ / 12.9–13″ 适配</span><span>结果保留整数，可直接在游戏灵敏度设置中填写</span></footer>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <div><label className="mb-2 block text-sm font-medium text-muted-foreground">{label}</label>{children}</div>}
function Stat({label,value,suffix}:{label:string;value:number;suffix:string}){return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Crosshair className="size-4 text-primary/70"/></div><p className="mt-3 font-mono text-3xl font-bold tracking-tight text-primary">{value}<span className="ml-1 text-sm text-muted-foreground">{suffix}</span></p></div>}
