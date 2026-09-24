// Run: node law-desk-selftest.js  — generates phrasings from every topic alias x 30 templates and checks the Law Desk finds the right topic.
const core = require('./dlo-assistant.js');
const KB = core.KB, norm = core.norm;
const T = ["{}","what is {}","what is the {}","explain {}","{} meaning","meaning of {}","define {}","tell me about {}","{} procedure","procedure for {}","how to file {}","how does {} work","{} process","steps in {}","{} time limit","limitation for {}","{} kya hai","{} kaise hota hai","can you explain {} in simple words","please tell me about {} details","{} under cpc","law on {}","{} grounds","what are the grounds for {}","i want to know about {}","sir {} ke bare me batao","{} in jammu and kashmir","how many days for {}","{} ki muddat","{} sir"];
// alias -> topics
const owner = {}; KB.forEach(t => [t.title].concat(t.a||[]).forEach(a => { const k = norm(a); (owner[k] = owner[k] || new Set()).add(t.id); }));
let total = 0, ok = 0, fails = {}, byTopic = {};
const cases = [];
KB.forEach(t => { [t.title].concat(t.a||[]).forEach(a => { const k = norm(a); if (owner[k].size !== 1) return; T.forEach(tp => cases.push({ q: tp.replace("{}", a), id: t.id, tp })); }); });
for (const c of cases) {
  const r = core.kbRank(c.q); total++;
  const top = r[0];
  if (top && top.t.id === c.id && top.score >= 4) ok++;
  else { const key = c.id; (fails[key] = fails[key] || []).push(c.q + "  ->  " + (top ? top.t.id + " (" + top.score.toFixed(1) + ")" : "none")); }
}
console.log("phrasings:", total, "correct top-1:", ok, (100 * ok / total).toFixed(2) + "%");
const worst = Object.entries(fails).sort((a, b) => b[1].length - a[1].length).slice(0, 14);
worst.forEach(([id, l]) => { console.log("\n" + id + " — " + l.length + " misses"); l.slice(0, 3).forEach(x => console.log("   " + x)); });
console.log("\ntopics:", KB.length, " aliases:", KB.reduce((n, t) => n + (t.a||[]).length + 1, 0));
