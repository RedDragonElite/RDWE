import fs from 'fs'; import vm from 'vm';
const ctx = { console, Math, globalThis: null }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['js/core/util.js','js/core/data.js','js/world/citygen.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
const t0=Date.now(); const w = ctx.K.generateCity(4242); console.log('gen ms', Date.now()-t0);
console.log('W',w.W,'H',w.H,'buildings',w.buildings.length,'props',w.props.filter(Boolean).length,'lights',w.lights.length,'zones',w.zones.length,'walk',w.walk.length);
const c={}; for(const b of w.buildings) c[b.type]=(c[b.type]||0)+1; console.log(c);
console.log('props', Object.entries(w.props.filter(Boolean).reduce((a,p)=>(a[p.k]=(a[p.k]||0)+1,a),{})).map(e=>e.join(':')).join(' '));
console.log('props owned', w.buildings.filter(b=>b.property).map(b=>b.property+'@'+b.type+'/'+b.district));
console.log('shops', w.buildings.filter(b=>b.shop).map(b=>b.shop+(b.counter?'+c':'-')+(b.keeperPos?'+k':'-')));
// ascii dump of a region
const ch={0:'~',1:' ',2:'.',3:',',4:':',5:'w',6:'t',7:'c',8:'n',9:'m',10:'#',11:'=',12:'D',13:'+',14:'_',15:'p',16:'q',17:'P',18:'H',19:'s',20:'o',21:'G'};
const [x0,y0,x1,y1]=process.argv.slice(2).map(Number);
if (x1) for(let y=y0;y<y1;y++){let s='';for(let x=x0;x<x1;x++){const i=y*w.W+x;s+= w.solid[i]&1?'@':ch[w.tiles[i]];}console.log(s);}
// every shop must have a reachable customer tile next to its counter
let bad = 0;
for (const b of w.buildings.filter(b => b.shop)) {
  const c = b.counter, k = b.keeperPos; if (!c || !k) { bad++; console.log('no counter', b.type); continue; }
  let ok = false;
  for (let j = c.y - 1; j <= c.y + c.h; j++) for (let i = c.x - 1; i <= c.x + c.w; i++) { const t = j*w.W+i; if (w.solid[t] & 1 || w.bmap[t] !== b.id || !(ctx.K.TF[w.tiles[t]] & 8) || w.tiles[t] === ctx.K.T.DOOR) continue; if (Math.hypot(i-k.x, j-k.y) > 1.5) ok = true; }
  if (!ok) { bad++; console.log('counter unreachable', b.type); }
}
console.log('shop counters bad:', bad);
