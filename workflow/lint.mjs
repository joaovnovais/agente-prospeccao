// Checagens estáticas do workflow gerado: refs $('Nó') existentes, sintaxe dos Code nodes, nós órfãos.
import { readFileSync } from 'node:fs';
const w = JSON.parse(readFileSync(new URL(process.argv[2] || './dist/novax-agente-prospeccao.json', import.meta.url)));
const names = new Set(w.nodes.map((n) => n.name));
const miss = new Set(); let erros = 0;
for (const n of w.nodes) {
  const src = n.type.endsWith('.code') ? n.parameters.jsCode : JSON.stringify(n.parameters).replace(/\\"/g, '"').replace(/\'/g, "'");
  for (const m of src.matchAll(/\$\((['"])([^'"]+)\1\)/g)) if (!names.has(m[2])) miss.add(`${n.name} -> ${m[2]}`);
  if (n.type.endsWith('.code')) { try { new Function('$input', '$', '$json', n.parameters.jsCode); } catch (e) { erros++; console.log('ERRO SINTAXE', n.name, e.message); } }
}
const hasIn = new Set(Object.values(w.connections).flatMap((c) => c.main.flat().map((x) => x.node)));
console.log('refs inexistentes:', [...miss]);
console.log('sem entrada:', w.nodes.filter((n) => !hasIn.has(n.name)).map((n) => n.name));
console.log('sem saída:', w.nodes.filter((n) => !w.connections[n.name]).map((n) => n.name));
console.log('segredos no JSON?', /sk-or-v1|AIza[0-9A-Za-z_-]{20}|"[a-z]{4} [a-z]{4} [a-z]{4} [a-z]{4}"/.test(JSON.stringify(w)) ? 'SIM — PARAR' : 'não');
process.exit(miss.size || erros ? 1 : 0);
