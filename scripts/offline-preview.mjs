/** Builds an honest, local-only practice preview. No remote requests or pretend partner. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
const files=['public/core/travel.js','public/core/game.js','public/scenes.js','public/transport.js','public/travellers.js','public/adventure-controls.js','public/journey-guide.js','public/app.js'];
let bundle='';
for(const file of files){let source=await readFile(file,'utf8');source=source.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');bundle+=source+'\n';}
const favicon='data:image/svg+xml;base64,'+Buffer.from(await readFile('public/favicon.svg','utf8')).toString('base64');
bundle=bundle.replaceAll('/favicon.svg',favicon);
// Embed every environment so the generated file still works without a server.
const art = {};
for (const name of await readdir('public/assets')) {
  if (/\.(webp|png)$/.test(name)) art[name] = `data:image/${name.split('.').at(-1)};base64,` + Buffer.from(await readFile(`public/assets/${name}`)).toString('base64');
}
bundle = `const offlineArt = ${JSON.stringify(art)};\n` + bundle;
bundle = bundle.replace('src="/assets/${plateFile}"', 'src="${offlineArt[plateFile]}"');
for (const [name, data] of Object.entries(art)) bundle = bundle.replaceAll('/assets/' + name, data);
let html=await readFile('public/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="/styles.css">',`<style>${await readFile('public/styles.css','utf8')}</style>`);
html=html.replace('<link rel="stylesheet" href="/cinematic.css">',`<style>${await readFile('public/cinematic.css','utf8')}</style>`);
html=html.replace('<link rel="stylesheet" href="/adventure.css">',`<style>${await readFile('public/adventure.css','utf8')}</style>`);
html=html.replace('/favicon.svg',favicon).replace('<script type="module" src="/app.js"></script>',`<script type="module">${bundle.replaceAll('</script','<\\/script')}</script>`);
html=html.replace('<title>ECHO RELAY · Find each other in time</title>','<title>ECHO RELAY · Offline practice preview</title>');
html=html.replace('<body>','<body><aside style="padding:10px 20px;text-align:center;background:#34382b;color:#eadcba;font:12px system-ui">OFFLINE PREVIEW · Choose “Explore both eras in solo practice”. Online multiplayer needs the server.</aside>');
await writeFile('offline-practice.html',html);
console.log('Built offline-practice.html (local practice only).');
