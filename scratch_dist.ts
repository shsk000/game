import { GENRES } from './src/data/genres';
import { THEMES } from './src/data/themes';
import { getCompat } from './src/data/compatibility';
let n=0, exact1=0; const buckets={divine:0,good:0,normal:0,bomb:0};
for (const g of GENRES) for (const t of THEMES) {
  const c=getCompat(g.id,t.id); n++;
  if (c===1.0) exact1++;
  if (c>=1.5) buckets.divine++; else if (c>=1.2) buckets.good++; else if (c>=0.9) buckets.normal++; else buckets.bomb++;
}
console.log({n,exact1,pct:(exact1/n*100).toFixed(1),buckets});
console.log(THEMES.map(t=>`${t.id}(s${t.unlockStage}):${GENRES.filter(g=>getCompat(g.id,t.id)===1.0).length}`).join(' '));
const rows=new Set(GENRES.map(g=>THEMES.map(t=>getCompat(g.id,t.id)).join(',')));
const cols=new Set(THEMES.map(t=>GENRES.map(g=>getCompat(g.id,t.id)).join(',')));
console.log('distinct genre rows',rows.size,'distinct theme cols',cols.size);
const g1=GENRES.filter(g=>g.unlockStage===1), t1=THEMES.filter(t=>t.unlockStage===1);
console.log('EARLY9', g1.flatMap(g=>t1.map(t=>`${g.id}|${t.id}=${getCompat(g.id,t.id)}`)).join(' '));
for (const maxStage of [2,3,4]) {
  const gs=GENRES.filter(g=>g.unlockStage<=maxStage), ts=THEMES.filter(t=>t.unlockStage<=maxStage);
  let a=0,good=0,c1=0,bomb=0,div=0;
  for(const g of gs) for(const t of ts){const c=getCompat(g.id,t.id); a++; if(c>=1.5)div++; else if(c>=1.2)good++; if(c===1.0)c1++; if(c<0.9)bomb++;}
  console.log(`stage<=${maxStage}: combos=${a} divine=${div} good=${good} exact1=${c1}(${(c1/a*100).toFixed(0)}%) bomb=${bomb}`);
}
