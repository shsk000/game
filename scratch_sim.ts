type G='fast'|'wild'|'logic'|'chill'|'epic'|'story'|'scary'|'cute';
type T='gourmet'|'daily'|'chill'|'cute'|'classic'|'epic'|'tech'|'cool'|'scary';
const COLS:T[]=['gourmet','daily','chill','cute','classic','epic','tech','cool','scary'];
const M:Record<G,number[]>={
  fast : [ 0.05,-0.15,-0.25, 0.05,-0.05, 0.05, 0.15, 0.25,-0.05],
  wild : [-0.05,-0.15,-0.25,-0.15, 0.05, 0.25, 0.05, 0.25, 0.05],
  logic: [ 0.25, 0.15, 0.05,-0.05, 0.05,-0.15, 0.15,-0.25,-0.15],
  chill: [ 0.15, 0.25, 0.25, 0.15,-0.05,-0.25,-0.15,-0.15,-0.25],
  epic : [-0.25,-0.25,-0.15,-0.15, 0.25, 0.25, 0.15, 0.15, 0.05],
  story: [-0.05, 0.05, 0.05, 0.15, 0.25, 0.15,-0.25,-0.25,-0.05],
  scary: [-0.15,-0.05, 0.15,-0.25, 0.15,-0.05, 0.05,-0.05, 0.25],
  cute : [ 0.15, 0.15, 0.15, 0.25,-0.15,-0.25,-0.05, 0.05,-0.25],
};
const GT:Record<string,G[]>={
 action:['fast','wild'], puzzle:['logic','chill'], rpg:['epic','story'], shooter:['fast','epic'],
 adventure:['story','chill'], simulation:['logic','epic'], racing:['fast'], horror:['scary','story'],
 fighting:['wild','fast'], roguelike:['logic','wild'], rhythm:['fast','cute'], sandbox:['chill','epic'],
 strategy:['epic','logic'], sports:['fast','story'], survival:['wild','scary'], cardgame:['logic','story'],
 towerdefense:['wild','logic'], partygame:['cute','fast'], escapegame:['logic','scary'],
 romanceadventure:['cute','story'], boardgame:['logic','cute'], quiz:['fast','logic'],
 platformer:['fast','chill'], visualnovel:['story','cute'], raisingsim:['cute','chill'],
 fishing:['chill'], fps:['wild','epic'],
};
const TT:Record<string,T[]>={
 sushi:['gourmet','daily'], onsen:['chill','daily'], farming:['daily','chill'], animal:['cute','chill'],
 salaryman:['daily'], konbini:['daily','gourmet'], modern:['daily','tech'], medieval:['classic','epic'],
 war:['epic'], fantasy:['epic','classic'], sf:['tech','epic'], ninja:['cool','classic'], zombie:['scary'],
 pirate:['epic','cool'], alien:['tech','cute'], camping:['chill','gourmet'], library:['classic','daily'],
 school:['daily','cute'], amusementpark:['cute','gourmet'], resort:['gourmet','chill'], idol:['cute','cool'],
 detective:['classic','scary'], hauntedhouse:['scary','classic'], circus:['cute','scary'],
 urbanlegend:['scary','tech'], musicfestival:['cool','epic'], samurai:['classic','cool'], cyberpunk:['tech','cool'],
};
const W=[2,1];
const base=(g:string,t:string,amp:number)=>{
  let sw=0,swv=0;
  GT[g].forEach((gt,i)=>TT[t].forEach((tt,j)=>{const w=W[i]*W[j];sw+=w;swv+=w*M[gt][COLS.indexOf(tt)];}));
  return 1+(swv/sw)*amp;
};
for(const amp of [1.2,1.4,1.6]){
  let n=0,e1=0,good=0,norm=0,bomb=0,deep=0; const spread:number[]=[];
  for(const g of Object.keys(GT)){const row:number[]=[];
    for(const t of Object.keys(TT)){const c=+base(g,t,amp).toFixed(2);row.push(c);n++;
      if(c===1.0)e1++; if(c>=1.2)good++; else if(c>=0.9)norm++; else {bomb++; if(c<0.8)deep++;}}
    spread.push(Math.max(...row)-Math.min(...row));}
  console.log(`amp=${amp} n=${n} exact1=${e1} good+=${good}(${(good/n*100).toFixed(0)}%) normal=${norm}(${(norm/n*100).toFixed(0)}%) bomb=${bomb}(${(bomb/n*100).toFixed(0)}%) deep<0.8=${deep} rowSpread min=${Math.min(...spread).toFixed(2)} med=${spread.sort((a,b)=>a-b)[13].toFixed(2)}`);
}
const amp=1.4;
console.log('--- 初期9組 (amp1.4) ---');
for(const g of ['puzzle','adventure','simulation']) console.log(g, ['sushi','onsen','farming'].map(t=>`${t}=${base(g,t,amp).toFixed(2)}`).join(' '));
console.log('--- 代表 ---');
for(const [g,t] of [['horror','zombie'],['horror','hauntedhouse'],['horror','onsen'],['puzzle','zombie'],['racing','sushi'],['rpg','fantasy'],['cardgame','quizdummy']] as any){ if(TT[t]) console.log(`${g}|${t}=${base(g,t,amp).toFixed(2)}`);}
console.log('--- 行/列の重複 ---');
const rows=new Set(Object.keys(GT).map(g=>Object.keys(TT).map(t=>base(g,t,amp).toFixed(2)).join(',')));
const cols=new Set(Object.keys(TT).map(t=>Object.keys(GT).map(g=>base(g,t,amp).toFixed(2)).join(',')));
console.log('distinct rows',rows.size,'/27  distinct cols',cols.size,'/28');
console.log('--- テーマ別 ちょうど1.00 の数 (amp1.4) ---');
console.log(Object.keys(TT).map(t=>`${t}:${Object.keys(GT).filter(g=>+base(g,t,amp).toFixed(2)===1.0).length}`).join(' '));

console.log('\n=== 帯の検討（DIVINE/BOMB 前の素の分布） ===');
for(const amp of [1.3,1.4,1.5]) for(const gt of [1.20,1.15,1.12]){
  let n=0,good=0,norm=0,bomb=0;
  for(const g of Object.keys(GT)) for(const t of Object.keys(TT)){const c=+base(g,t,amp).toFixed(2);n++;
    if(c>=gt)good++; else if(c>=0.9)norm++; else bomb++;}
  console.log(`amp=${amp} good閾値=${gt}: good=${(good/n*100).toFixed(0)}% 普通=${(norm/n*100).toFixed(0)}% 地雷=${(bomb/n*100).toFixed(0)}%`);
}
console.log('\n=== 行の広がり（amp1.4・ジャンル別 max-min） ===');
const rs=Object.keys(GT).map(g=>{const r=Object.keys(TT).map(t=>base(g,t,1.4));return [g,(Math.max(...r)-Math.min(...r)).toFixed(2)] as [string,string];}).sort((a,b)=>+a[1]-+b[1]);
console.log(rs.slice(0,5).map(x=>x.join('=')).join(' '), '... max', rs[rs.length-1].join('='));
const cs=Object.keys(TT).map(t=>{const r=Object.keys(GT).map(g=>base(g,t,1.4));return [t,(Math.max(...r)-Math.min(...r)).toFixed(2)] as [string,string];}).sort((a,b)=>+a[1]-+b[1]);
console.log('列:',cs.slice(0,5).map(x=>x.join('=')).join(' '), '... max', cs[cs.length-1].join('='));

console.log('\n=== 最終案 amp=1.4 / 帯 神1.45 good1.15 普通0.85 の素の分布 ===');
{const amp=1.4;let n=0,div=0,good=0,norm=0,bomb=0;const modeShare:number[]=[];
 for(const t of Object.keys(TT)){const m=new Map<number,number>();
   for(const g of Object.keys(GT)){const c=+base(g,t,amp).toFixed(2);m.set(c,(m.get(c)??0)+1);}
   modeShare.push(Math.max(...m.values())/27);}
 for(const g of Object.keys(GT))for(const t of Object.keys(TT)){const c=+base(g,t,amp).toFixed(2);n++;
   if(c>=1.45)div++;else if(c>=1.15)good++;else if(c>=0.85)norm++;else bomb++;}
 console.log(`神=${div} good=${good}(${(good/n*100).toFixed(0)}%) 普通=${norm}(${(norm/n*100).toFixed(0)}%) 地雷=${bomb}(${(bomb/n*100).toFixed(0)}%)`);
 console.log(`テーマ列の最頻値シェア: 最悪=${(Math.max(...modeShare)*100).toFixed(0)}% 中央=${(modeShare.sort((a,b)=>a-b)[14]*100).toFixed(0)}%（現行 zombie は 89%）`);
}
