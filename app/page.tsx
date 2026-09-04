'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Crosshair, Gauge, RotateCcw, ScanLine, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AimPad } from './aim-pad';

type TestState = 'idle' | 'running' | 'done';
type Point = { x: number; y: number };
type TrackingResult = { accuracy: number; smoothness: number };
type PositioningResult = { hits: number; reaction: number; corrections: number };

const IPADS = {
  mini: { label: 'iPad mini · 8.3英寸', short: '8.3″', widthCm: 19.54, factor: 1.08 },
  pro11: { label: 'iPad / Air / Pro · 10.9–11英寸', short: '11″', widthCm: 24.97, factor: 1 },
  pro13: { label: 'iPad Air / Pro · 12.9–13英寸', short: '13″', widthCm: 28.16, factor: 0.94 },
} as const;

const CAPTURED_PROFILE = {
  free: { third: 150, parachute: 152, first: 70 },
  camera: { third: 180, first: 88, red: 95, x2: 30, x3: 35, x4: 14, x6: 12, x8: 7 },
  firing: { third: 150, first: 88, red: 100, x2: 30, x3: 22, x4: 20, x6: 10, x8: 7 },
} as const;

const TEST_SECONDS = 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

function CrosshairCursor({ point, visible }: { point: Point; visible: boolean }) {
  if (!visible) return null;
  return <div className="crosshair" style={{ left: point.x, top: point.y }}><span /></div>;
}

function TrackingTest({ onComplete }: { onComplete: (result: TrackingResult) => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0); const lastTickRef = useRef(0); const hoverMsRef = useRef(0);
  const aimRef = useRef<Point>({ x: 180, y: 150 }); const vectorRef = useRef<Point>({ x: 0, y: 0 });
  const lastVectorRef = useRef<Point>({ x: 0, y: 0 }); const jitterRef = useRef(0); const samplesRef = useRef(0);
  const [state, setState] = useState<TestState>('idle'); const [remaining, setRemaining] = useState(TEST_SECONDS);
  const [target, setTarget] = useState<Point>({ x: 120, y: 110 }); const [aim, setAim] = useState<Point>({ x: 180, y: 150 });
  const [score, setScore] = useState(0); const [smoothness, setSmoothness] = useState(100);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
    const accuracy = clamp((hoverMsRef.current / (TEST_SECONDS * 1000)) * 100, 0, 100);
    const smooth = clamp(100 - (jitterRef.current / Math.max(1, samplesRef.current)) * 42, 0, 100);
    setScore(accuracy); setSmoothness(smooth); setRemaining(0); setState('done'); onComplete({ accuracy, smoothness: smooth });
  }, [onComplete]);

  const start = useCallback(() => {
    if (state !== 'idle') return;
    const area = areaRef.current; const center = { x: (area?.clientWidth ?? 360) * .42, y: (area?.clientHeight ?? 310) * .55 };
    aimRef.current = center; setAim(center); vectorRef.current={x:0,y:0}; lastVectorRef.current={x:0,y:0}; jitterRef.current=0;samplesRef.current=0;
    const now = performance.now(); startedRef.current = now; lastTickRef.current = now; hoverMsRef.current = 0;
    setState('running'); setRemaining(TEST_SECONDS); setScore(0); setSmoothness(100);
    timerRef.current = setInterval(() => {
      const t = performance.now(); const elapsed = t - startedRef.current; const dt = Math.min(80, t - lastTickRef.current); const areaNow = areaRef.current;
      if (areaNow) {
        const w = areaNow.clientWidth, h = areaNow.clientHeight; const v=vectorRef.current;
        aimRef.current={x:Math.max(18,Math.min(w-18,aimRef.current.x+v.x*dt*.23)),y:Math.max(54,Math.min(h-18,aimRef.current.y+v.y*dt*.23))}; setAim(aimRef.current);
        const px = w * (.44 + .30 * Math.sin(elapsed / 670)); const py = h * (.48 + .25 * Math.sin(elapsed / 430 + .7)); setTarget({ x: px, y: py });
        if (Math.hypot(aimRef.current.x-px,aimRef.current.y-py)<=34) hoverMsRef.current+=dt;
      }
      lastTickRef.current=t; setRemaining(Math.max(0,(TEST_SECONDS*1000-elapsed)/1000)); setScore(clamp((hoverMsRef.current/Math.max(1,elapsed))*100,0,100));
      if(elapsed>=TEST_SECONDS*1000)finish();
    },40);
  },[finish,state]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current);},[]);
  const vector=(v:Point)=>{vectorRef.current=v; jitterRef.current+=Math.hypot(v.x-lastVectorRef.current.x,v.y-lastVectorRef.current.y);lastVectorRef.current=v;samplesRef.current+=1;setSmoothness(clamp(100-(jitterRef.current/Math.max(1,samplesRef.current))*42,0,100));};
  const reset=()=>{if(timerRef.current)clearInterval(timerRef.current);timerRef.current=null;setState('idle');setRemaining(TEST_SECONDS);setScore(0);setSmoothness(100);vectorRef.current={x:0,y:0};};

  return <TestFrame icon={<Activity/>} title="追踪测试" metric={`${score}%`} hint={`操控准星跟随目标 · 平滑度 ${smoothness}%`} state={state} remaining={remaining} onReset={reset}>
    <div ref={areaRef} onPointerEnter={start} className={`test-surface lab-grid relative h-[310px] overflow-hidden rounded-xl border bg-[#090f10] ${state==='running'?'active border-primary/60':'border-border'}`}>
      <div className="absolute inset-x-0 top-0 flex justify-between p-4 text-sm text-muted-foreground"><span>用右下角操控区移动准星</span><span className="font-mono text-primary">{remaining.toFixed(1)}s</span></div>
      <div className="absolute size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#6ce8ff] bg-[#6ce8ff]/10 shadow-[0_0_28px_rgba(108,232,255,.35)]" style={{left:target.x,top:target.y}}><div className="absolute inset-[9px] rounded-full bg-[#6ce8ff]"/></div>
      <CrosshairCursor point={aim} visible/><AimPad onEngage={start} onVector={vector}/>
      {state==='done'&&<ResultOverlay big={`${score}%`} label={`跟踪精准度 · 平滑度 ${smoothness}%`} onAgain={reset}/>}
    </div>
  </TestFrame>;
}

function PositioningTest({ onComplete }: { onComplete: (result: PositioningResult) => void }) {
  const areaRef=useRef<HTMLDivElement>(null); const timerRef=useRef<ReturnType<typeof setInterval>|null>(null); const startedRef=useRef(0); const lastTickRef=useRef(0); const targetBornRef=useRef(0);
  const reactionsRef=useRef<number[]>([]); const hitsRef=useRef(0); const aimRef=useRef<Point>({x:180,y:150}); const targetRef=useRef<Point>({x:150,y:150}); const vectorRef=useRef<Point>({x:0,y:0}); const lastVectorRef=useRef<Point>({x:0,y:0}); const correctionsRef=useRef(0);
  const [state,setState]=useState<TestState>('idle'); const [remaining,setRemaining]=useState(TEST_SECONDS); const [target,setTarget]=useState<Point>({x:150,y:150}); const [aim,setAim]=useState<Point>({x:180,y:150}); const [hits,setHits]=useState(0); const [reaction,setReaction]=useState(0);
  const spawn=useCallback(()=>{const area=areaRef.current;if(!area)return;let x=42+Math.random()*Math.max(1,area.clientWidth-84);let y=64+Math.random()*Math.max(1,area.clientHeight-106);if(x>area.clientWidth-165&&y>area.clientHeight-165)x=Math.max(42,area.clientWidth-185);targetRef.current={x,y};setTarget({x,y});targetBornRef.current=performance.now();},[]);
  const finish=useCallback(()=>{if(timerRef.current)clearInterval(timerRef.current);timerRef.current=null;const arr=reactionsRef.current;const avg=arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0;const corrections=hitsRef.current?Number((correctionsRef.current/hitsRef.current).toFixed(1)):correctionsRef.current;setReaction(avg);setRemaining(0);setState('done');onComplete({hits:hitsRef.current,reaction:avg,corrections});},[onComplete]);
  const start=useCallback(()=>{if(state!=='idle')return;const area=areaRef.current;const center={x:(area?.clientWidth??360)*.42,y:(area?.clientHeight??310)*.55};aimRef.current=center;setAim(center);vectorRef.current={x:0,y:0};lastVectorRef.current={x:0,y:0};correctionsRef.current=0;const now=performance.now();startedRef.current=now;lastTickRef.current=now;targetBornRef.current=now;reactionsRef.current=[];hitsRef.current=0;setState('running');setRemaining(TEST_SECONDS);setHits(0);setReaction(0);spawn();timerRef.current=setInterval(()=>{const t=performance.now();const elapsed=t-startedRef.current;const dt=Math.min(80,t-lastTickRef.current);const areaNow=areaRef.current;if(areaNow){const v=vectorRef.current;aimRef.current={x:Math.max(18,Math.min(areaNow.clientWidth-18,aimRef.current.x+v.x*dt*.27)),y:Math.max(54,Math.min(areaNow.clientHeight-18,aimRef.current.y+v.y*dt*.27))};setAim(aimRef.current);if(Math.hypot(aimRef.current.x-targetRef.current.x,aimRef.current.y-targetRef.current.y)<=27){const rt=t-targetBornRef.current;reactionsRef.current.push(rt);hitsRef.current+=1;setHits(hitsRef.current);setReaction(Math.round(reactionsRef.current.reduce((a,b)=>a+b,0)/reactionsRef.current.length));spawn();}}lastTickRef.current=t;setRemaining(Math.max(0,(TEST_SECONDS*1000-elapsed)/1000));if(elapsed>=TEST_SECONDS*1000)finish();},40);},[finish,spawn,state]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current);},[]);
  const vector=(v:Point)=>{const prev=lastVectorRef.current;if((Math.sign(v.x)!==Math.sign(prev.x)&&Math.abs(v.x-prev.x)>.75)||(Math.sign(v.y)!==Math.sign(prev.y)&&Math.abs(v.y-prev.y)>.75))correctionsRef.current+=1;lastVectorRef.current=v;vectorRef.current=v;};
  const reset=()=>{if(timerRef.current)clearInterval(timerRef.current);timerRef.current=null;setState('idle');setRemaining(TEST_SECONDS);setHits(0);setReaction(0);vectorRef.current={x:0,y:0};};
  return <TestFrame icon={<Target/>} title="定位测试" metric={`${hits} 命中`} hint="右手操控准星锁定随机目标，无需射击" state={state} remaining={remaining} onReset={reset}>
    <div ref={areaRef} onPointerEnter={start} className={`test-surface lab-grid relative h-[310px] overflow-hidden rounded-xl border bg-[#090f10] ${state==='running'?'active border-primary/60':'border-border'}`}>
      <div className="absolute inset-x-0 top-0 flex justify-between p-4 text-sm text-muted-foreground"><span>平均反应 <b className="text-foreground">{reaction||'—'}{reaction?' ms':''}</b></span><span className="font-mono text-primary">{remaining.toFixed(1)}s</span></div>
      {state!=='done'&&<div className="absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary shadow-[0_0_24px_rgba(216,255,53,.28)]" style={{left:target.x,top:target.y}}><div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"/></div>}
      <CrosshairCursor point={aim} visible/><AimPad onEngage={start} onVector={vector}/>
      {state==='done'&&<ResultOverlay big={`${hits} 次`} label={`平均反应 ${reaction||'—'} ms · 修正 ${hits?Number((correctionsRef.current/hits).toFixed(1)):0} 次/目标`} onAgain={reset}/>}
    </div>
  </TestFrame>;
}

function TurnTest({ device, current, onComplete }: { device: keyof typeof IPADS; current: number; onComplete: (cm: number) => void }) {
  const areaRef=useRef<HTMLDivElement>(null); const travelled=useRef(0); const [state,setState]=useState<TestState>('idle'); const [progress,setProgress]=useState(0); const [cm,setCm]=useState(0);
  const start=()=>{if(state==='idle'){setState('running');travelled.current=0;setProgress(0);setCm(0);}};
  const travel=(dx:number,dy:number)=>{if(state!=='running'||!areaRef.current)return;travelled.current+=Math.abs(dx);const width=areaRef.current.clientWidth;const targetPx=width*1.35*(100/current);const next=Math.min(100,(travelled.current/targetPx)*100);const nextCm=travelled.current*(IPADS[device].widthCm/width);setProgress(next);setCm(nextCm);if(next>=100){const final=Number(nextCm.toFixed(1));setState('done');setCm(final);onComplete(final);}};
  const reset=()=>{travelled.current=0;setState('idle');setProgress(0);setCm(0);};
  return <TestFrame icon={<RotateCcw />} title="360°转身测试" metric={`${cm.toFixed(1)} cm`} hint="左右持续移动，完成一圈自动结算" state={state} onReset={reset}>
    <div ref={areaRef} onPointerEnter={start} className={`test-surface lab-grid relative h-[310px] overflow-hidden rounded-xl border bg-[#090f10] ${state==='running'?'active border-primary/60':'border-border'}`}>
      <div className="absolute inset-x-0 top-0 flex justify-between p-4 text-sm text-muted-foreground"><span>在右下操控区反复横向滑动</span><span className="font-mono text-primary">{Math.round(progress)}%</span></div>
      <div className="absolute left-1/2 top-[54%] size-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-[#0e1617]">
        <div className="absolute inset-3 rounded-full border border-dashed border-[#435051]" />
        <div className="absolute left-1/2 top-1/2 h-[42%] w-0.5 origin-bottom -translate-x-1/2 -translate-y-full bg-primary shadow-[0_0_14px_rgba(216,255,53,.7)]" style={{transform:`translateX(-50%) translateY(-100%) rotate(${progress*3.6}deg)`}} />
        <div className="absolute inset-0 grid place-items-center"><span className="mt-14 font-mono text-2xl font-bold">{cm.toFixed(1)}</span><span className="absolute mt-24 text-xs text-muted-foreground">厘米</span></div>
      </div>
      <div className="absolute bottom-5 left-5 right-40"><Progress value={progress}/></div><AimPad onEngage={start} onTravel={travel}/>
      {state==='done'&&<ResultOverlay big={`${cm.toFixed(1)} cm`} label="完成 360° 转身" onAgain={reset}/>} 
    </div>
  </TestFrame>;
}

function TestFrame({icon,title,metric,hint,state,remaining,onReset,children}:{icon:React.ReactNode;title:string;metric:string;hint:string;state:TestState;remaining?:number;onReset:()=>void;children:React.ReactNode}){
  return <section><div className="mb-3 flex items-end justify-between gap-4"><div><div className="mb-1 flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-primary">{icon}{title}<span className={`rounded-full px-2 py-0.5 text-xs ${state==='running'?'bg-primary/15 text-primary':state==='done'?'bg-[#6ce8ff]/15 text-[#6ce8ff]':'bg-secondary text-muted-foreground'}`}>{state==='running'?'测试中':state==='done'?'已完成':'待测试'}</span></div><p className="text-sm text-muted-foreground">{hint}</p></div><div className="flex items-center gap-2"><span className="font-mono text-lg font-bold">{metric}</span>{state!=='idle'&&<Button aria-label="重新测试" size="icon-sm" variant="ghost" onClick={onReset}><RotateCcw/></Button>}</div></div>{remaining!==undefined&&<Progress className="mb-3 h-1" value={(remaining/TEST_SECONDS)*100}/>} {children}</section>;
}
function ResultOverlay({big,label,onAgain}:{big:string;label:string;onAgain:()=>void}){return <div className="absolute inset-0 z-40 grid place-items-center bg-[#081011]/90 backdrop-blur-sm"><div className="text-center"><Sparkles className="mx-auto mb-3 size-6 text-primary"/><div className="font-mono text-5xl font-bold tracking-tight text-primary">{big}</div><p className="mt-2 text-muted-foreground">{label}</p><Button className="mt-5" variant="outline" onClick={onAgain}><RotateCcw/>再测一次</Button></div></div>}

export default function Home(){
  const [device,setDevice]=useState<keyof typeof IPADS>('pro11'); const [fingers,setFingers]=useState('4'); const [gyro,setGyro]=useState('scope'); const [recoil,setRecoil]=useState('stable'); const [current,setCurrent]=useState(180);
  const [tracking,setTracking]=useState<TrackingResult|null>(null); const [positioning,setPositioning]=useState<PositioningResult|null>(null); const [turn,setTurn]=useState<number|null>(null); const [generated,setGenerated]=useState(false);
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
    const d=IPADS[device]; const accuracy=tracking?.accuracy??60; const smooth=tracking?.smoothness??70; const reaction=positioning?.reaction||520; const corrections=positioning?.corrections??2; const recoilAdjust={up:12,'slight-up':5,stable:0,down:-7}[recoil]??0; const fingerAdjust=(Number(fingers)-4)*1.5;
    const reactionScore=positioning?clamp(100-(reaction-260)/7,0,100):65; const controlScore=accuracy*.45+smooth*.25+reactionScore*.30; const correctionPenalty=positioning?clamp((corrections-2)*1.4,-3,7):0;
    const turnTarget=device==='mini'?23:device==='pro13'?31:27; const turnAdjust=turn?clamp(((turn-turnTarget)/turnTarget)*13,-11,11):0; const cameraAdjust=tracking||positioning?clamp((64-controlScore)*.16+correctionPenalty,-7,9):0; const gyroRelief=allDone?(gyro==='always'?-4:gyro==='scope'?-2:0):0;
    const firingAdjust=tracking?clamp((62-accuracy)*.12+(68-smooth)*.08+recoilAdjust+gyroRelief,-10,14):0; const highScope=tracking?clamp((smooth-70)*.10+(accuracy-62)*.05,-9,6):0;
    const cameraScale=d.factor+(cameraAdjust+turnAdjust+fingerAdjust)/100; const firingScale=d.factor+(firingAdjust+fingerAdjust*.4)/100;
    const free={third:clamp(CAPTURED_PROFILE.free.third*cameraScale,1,400),parachute:clamp(CAPTURED_PROFILE.free.parachute*cameraScale,1,400),first:clamp(CAPTURED_PROFILE.free.first*cameraScale,1,400)};
    const makeGroup=(source:Record<keyof typeof CAPTURED_PROFILE.camera,number>,scale:number)=>Object.fromEntries(Object.entries(source).map(([k,v])=>[k,clamp(v*scale,1,400)])) as Record<keyof typeof CAPTURED_PROFILE.camera,number>;
    const camera=makeGroup(CAPTURED_PROFILE.camera,cameraScale); const firing=makeGroup(CAPTURED_PROFILE.firing,firingScale);
    camera.x3=clamp(camera.x3*(1+highScope/100),1,400);camera.x4=clamp(camera.x4*(1+highScope/100),1,400);camera.x6=clamp(camera.x6*(1+highScope/100),1,400);camera.x8=clamp(camera.x8*(1+highScope/100),1,400);firing.x3=clamp(firing.x3*(1+highScope/100),1,400);firing.x4=clamp(firing.x4*(1+highScope/100),1,400);firing.x6=clamp(firing.x6*(1+highScope/100),1,400);firing.x8=clamp(firing.x8*(1+highScope/100),1,400);
    const vertical=clamp(100+firingAdjust+correctionPenalty,50,200); const aim=clamp((camera.red+camera.third)/2,1,400); const ads=clamp((firing.red+firing.x2)/2,1,400); const confidence=allDone?clamp(72+Math.min(18,(positioning?.hits??0)*1.5)+smooth*.1,0,100):tracking||positioning||turn?48:25;
    return {general:camera.third,vertical,aim,ads,free,camera,firing,confidence};
  },[device,fingers,gyro,recoil,tracking,positioning,turn]);
  const insight=useMemo(()=>{if(!allDone)return '完成三项测试后，算法会分别分析追踪命中、操控平滑度、定位反应、反向修正次数和转身距离。';if((tracking?.smoothness??100)<55)return '操控方向变化较频繁：已单独降低 3–8 倍镜，先稳定小幅推动摇杆，再考虑提高近距离镜头。';if((tracking?.accuracy??100)<55)return '追踪命中偏低：已降低开火镜头并保留较快的不开镜转向，减少连续压枪时越过目标。';if((positioning?.corrections??0)>4)return '每个目标的反向修正偏多：算法已压低红点和高倍镜，建议保持当前方案至少两局再复测。';if((positioning?.reaction??0)>650)return '定位反应较慢：常规镜头略微提高，高倍镜不跟随上调，避免远距离瞄准变飘。';if((turn??0)>32)return '转身距离偏长：常规灵敏度已提高，目标是一次舒适滑动完成约 180°。';return '操控数据均衡：建议先原样使用 2–3 局；若弹道仍向上，只调整开火镜头或垂直补偿，不要同时改镜头灵敏度。';},[allDone,tracking,positioning,turn]);
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
          <div className="mt-6 rounded-xl border border-border bg-[#11191a] p-4"><div className="mb-4 flex items-center justify-between"><label className="text-sm text-muted-foreground">当前第三人称不开镜</label><b className="font-mono text-primary">{current}%</b></div><Slider min={1} max={400} step={1} value={[current]} onValueChange={(v)=>setCurrent(Array.isArray(v)?Number(v[0]):Number(v))}/><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>1</span><span>400</span></div></div>
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[.055] p-4 text-sm leading-6 text-muted-foreground"><b className="text-foreground">已录入截图方案：</b>自由镜头 3 项、镜头 6 项、开火镜头 6 项。6 倍与 8 倍未出现在照片中，暂以安全低敏值补全。</div>
        </aside>
        <section className="min-w-0 p-5 lg:p-7"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">02 / 游戏式操控校准</p><div className="mt-1 flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl font-semibold tracking-tight">用右下操控区移动准星</h2><p className="text-sm text-muted-foreground">鼠标移入即控 · iPad 按住拖动</p></div></div>
          <Tabs defaultValue="tracking"><TabsList className="mb-5 h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl bg-[#0b1112] p-1"><TabsTrigger value="tracking" className="min-w-[130px] px-4"><ScanLine/>追踪</TabsTrigger><TabsTrigger value="positioning" className="min-w-[130px] px-4"><Target/>定位</TabsTrigger><TabsTrigger value="turn" className="min-w-[150px] px-4"><RotateCcw/>360°转身</TabsTrigger></TabsList><TabsContent value="tracking"><TrackingTest onComplete={setTracking}/></TabsContent><TabsContent value="positioning"><PositioningTest onComplete={setPositioning}/></TabsContent><TabsContent value="turn"><TurnTest device={device} current={current} onComplete={setTurn}/></TabsContent></Tabs>
          <div className="mt-6 grid grid-cols-3 gap-2">{[{l:'精准 / 平滑',v:tracking===null?'待测试':`${tracking.accuracy}% / ${tracking.smoothness}%`},{l:'命中 / 反应',v:positioning===null?'待测试':`${positioning.hits} / ${positioning.reaction}ms`},{l:'转身距离',v:turn===null?'待测试':`${turn}cm`}].map(x=><div key={x.l} className="rounded-xl border border-border bg-[#0c1213] p-3"><p className="text-xs text-muted-foreground">{x.l}</p><p className="mt-1 truncate font-mono text-sm font-bold text-foreground">{x.v}</p></div>)}</div>
        </section>
      </div>
      <section className="border-t border-border bg-[#090e0f] p-5 lg:p-7"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">03 / 多因子专属方案</p><h2 className="mt-1 text-2xl font-semibold">可直接录入游戏的灵敏度</h2><p className="mt-1 text-sm text-muted-foreground">当前算法置信度 <b className="text-primary">{output.confidence}%</b></p></div><Button size="lg" className="h-11 px-5" onClick={()=>setGenerated(true)}><Sparkles/> {allDone?'生成测试方案':'生成基线方案'}</Button></div>
        <div className="grid gap-3 md:grid-cols-4"><Stat label="常规 / 三人称不开镜" value={output.general} suffix="%"/><Stat label="垂直压枪补偿" value={output.vertical} suffix="%"/><Stat label="瞄准灵敏度参考" value={output.aim} suffix="%"/><Stat label="开镜压枪参考" value={output.ads} suffix="%"/></div>
        <Tabs defaultValue="camera" className="mt-4"><TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl bg-card p-1"><TabsTrigger value="free" className="min-w-[130px] px-4">自由镜头</TabsTrigger><TabsTrigger value="camera" className="min-w-[150px] px-4">镜头灵敏度</TabsTrigger><TabsTrigger value="firing" className="min-w-[170px] px-4">开火镜头灵敏度</TabsTrigger></TabsList><TabsContent value="free"><SensitivityGrid items={[['第三人称人物 / 载具',output.free.third],['跳伞状态',output.free.parachute],['第一人称人物',output.free.first]]}/></TabsContent><TabsContent value="camera"><SensitivityGrid items={scopeItems(output.camera)}/></TabsContent><TabsContent value="firing"><SensitivityGrid items={scopeItems(output.firing)}/></TabsContent></Tabs>
        <div className={`mt-5 flex gap-3 rounded-xl border p-4 transition-colors ${generated?'border-primary/35 bg-primary/[.06]':'border-border bg-card'}`}><Sparkles className="mt-0.5 size-5 shrink-0 text-primary"/><div><p className="font-semibold">微调建议</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{insight}</p><p className="mt-1 text-xs text-muted-foreground">每次只调整一项，幅度控制在 3%–5%；最终以训练场连续压枪手感为准。</p></div></div>
      </section>
    </div>
    <footer className="flex flex-wrap justify-between gap-2 px-2 py-5 text-xs text-muted-foreground"><span>仅针对 iPad 8.3″ / 10.9–11″ / 12.9–13″ 适配</span><span>结果保留整数，可直接在游戏灵敏度设置中填写</span></footer>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <div><label className="mb-2 block text-sm font-medium text-muted-foreground">{label}</label>{children}</div>}
function Stat({label,value,suffix}:{label:string;value:number;suffix:string}){return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Crosshair className="size-4 text-primary/70"/></div><p className="mt-3 font-mono text-3xl font-bold tracking-tight text-primary">{value}<span className="ml-1 text-sm text-muted-foreground">{suffix}</span></p></div>}
function scopeItems(values:Record<keyof typeof CAPTURED_PROFILE.camera,number>):[string,number][]{return [['第三人称不开镜',values.third],['第一人称不开镜',values.first],['红点 / 全息 / 机瞄 / 侧瞄',values.red],['2倍镜 / Win94 / P90',values.x2],['3倍镜',values.x3],['4倍镜 / VSS',values.x4],['6倍镜（建议）',values.x6],['8倍镜（建议）',values.x8]]}
function SensitivityGrid({items}:{items:[string,number][]}){return <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{items.map(([name,value])=><div key={name} className="rounded-xl border border-border bg-card p-3"><p className="min-h-8 text-xs leading-4 text-muted-foreground">{name}</p><p className="mt-1 font-mono text-xl font-bold">{value}<span className="ml-0.5 text-xs text-muted-foreground">%</span></p></div>)}</div>}
