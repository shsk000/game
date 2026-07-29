const counts={2:22,3:14,4:13} as Record<number,number>;
const base={2:300_000,3:3_000_000,4:30_000_000} as Record<number,number>;
const yen=(v:number)=>v>=1e8?`¥${(v/1e8).toFixed(2)}億`:v>=1e4?`¥${Math.round(v/1e4).toLocaleString()}万`:`¥${v}`;
for(const r of [1.15,1.2,1.25,1.35]){
  let total=0; const parts:string[]=[];
  for(const s of [2,3,4]){let sum=0;for(let i=0;i<counts[s];i++)sum+=base[s]*r**i;
    parts.push(`s${s}: 最後=${yen(base[s]*r**(counts[s]-1))} 累計=${yen(sum)}`); total+=sum;}
  console.log(`r=${r} | ${parts.join(' | ')} | 全49個=${yen(total)}`);
}
console.log('\n--- r=1.2 stage別 価格の刻み ---');
for(const s of [2,3,4]) console.log(`stage${s}:`, Array.from({length:counts[s]},(_,i)=>yen(Math.round(base[s]*1.2**i/1e4)*1e4)).join(' '));
console.log('\n--- 参考: 現行 r=1.8 通しカウント ---');
for(const n of [5,10,15,20]) console.log(`${n}個目(stage2基礎): ${yen(300_000*1.8**(n-1))}`);
