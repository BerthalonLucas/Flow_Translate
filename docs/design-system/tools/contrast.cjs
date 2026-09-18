const hex = h => { h = h.replace('#',''); if (h.length===3) h=[...h].map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
const parse = c => { if (c.startsWith('#')) return [...hex(c),1]; const m=c.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number); return [m[0],m[1],m[2],m[3]??1]; };
const over = (fg, bg) => { const [r,g,b,a]=parse(fg); const [R,G,B]=parse(bg); return [r*a+R*(1-a), g*a+G*(1-a), b*a+B*(1-a)]; };
const lum = ([r,g,b]) => [r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const ratio = (fg,bg,under='#ffffff') => { const B=over(bg,under); const F=over(fg, '#'+B.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('')); const a=lum(F), b=lum(B); return ((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2); };
module.exports = { ratio };
if (require.main === module) {
  const pairs = JSON.parse(process.argv[2]);
  for (const [fg,bg,under,min] of pairs) { const r = ratio(fg,bg,under||'#ffffff'); console.log((r>=min?'ok  ':'FAIL'), r.padStart(6), fg, 'on', bg, under?('(over '+under+')'):'', 'min', min); }
}
