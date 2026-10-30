// Developer-only diagnostics for failed Windows GitHub Actions bundle parity.
// Does not modify any file and never runs in browser gameplay.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const get=p=>readFileSync(resolve(root,p),'utf8');
const manifest=JSON.parse(get('tools/source-manifest.json'));
const expected='(function(){\n'+manifest.parts.map(p=>get(p).replace(/\r\n/g,'\n')).join('')+'})();\n';
const actual=get('assets/game.js').replace(/\r\n/g,'\n');
let index=0;while(index<expected.length&&index<actual.length&&expected[index]===actual[index])index++;
const count=(s,re)=>(s.match(re)||[]).length;
const info=(name,s)=>({name,bytesUtf16:s.length,crlf:count(s,/\r\n/g),loneCR:count(s,/\r(?!\n)/g),lf:count(s,/\n/g)});
console.log(JSON.stringify({equal:actual===expected,firstDifference:index,expected:info('expected',expected),actual:info('actual',actual),expectedCharCode:expected.charCodeAt(index),actualCharCode:actual.charCodeAt(index),expectedAround:JSON.stringify(expected.slice(Math.max(0,index-70),index+120)),actualAround:JSON.stringify(actual.slice(Math.max(0,index-70),index+120))},null,2));
