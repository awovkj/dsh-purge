/** Explicit isolated Desktop Loader acceptance; no LLM, target request, installation or host restart. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { extractAsar, overlayAsarUnpacked } from '../lib/extract-asar.js'
import { assertWithinRoots } from '../lib/path-boundary.js'
import { removeTreeNoFollowSync } from '../lib/remove-tree.js'

const hostRoot = process.argv[process.argv.indexOf('--host-root') + 1]
if (!process.argv.includes('--host-root') || !path.isAbsolute(hostRoot || '')) throw new Error('Pass --host-root with the explicit Desktop installation directory')
const repository = fileURLToPath(new URL('../', import.meta.url))
const archive = path.join(hostRoot, 'resources/app.asar')
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'purge-mode-loader-')))
assertWithinRoots(scratch, [fs.realpathSync(os.tmpdir())])
try {
  const application = path.join(scratch, 'resources/app')
  extractAsar(archive, application)
  overlayAsarUnpacked(archive, application)
  // ELECTRON_RUN_AS_NODE uses the dedicated copy. Never fall back to launching the installed executable.
  const binaryName = process.platform === 'win32' ? 'DeepSeek Harness.exe' : null
  if (!binaryName) throw new Error('This isolated runner currently requires Windows Desktop')
  for (const entry of fs.readdirSync(hostRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== 'Uninstall DeepSeek Harness.exe') fs.copyFileSync(path.join(hostRoot, entry.name), path.join(scratch, entry.name))
  }
  const script = path.join(scratch, 'mode-acceptance.mjs')
  fs.writeFileSync(script, String.raw`
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const app=path.resolve('resources/app/dsh'), home=path.resolve('fixture-home');
process.env.DSH_HOME=home; process.env.DSH_TELEMETRY_DISABLED='1';
const require=createRequire(path.join(app,'package.json'));
const load=async name=>import(pathToFileURL(require.resolve('@deepseek-ai/'+name)).href);
const {boot,initProfile,readProfilePatches}=await load('dsh-app-boot');
const repo=process.env.PURGE_MODE_REPOSITORY;
const {prepareListAgents,migratePresetDefinition,registerPresetDefinitions}=await import(pathToFileURL(path.join(repo,'lib/preset-compat.js')).href);
const {readPresetDefinition,preparePresetTools}=await import(pathToFileURL(path.join(repo,'lib/redteam/preset-composition.js')).href);
const {withPresetDefaults}=await import(pathToFileURL(path.join(repo,'lib/preset-defaults.js')).href);
const {withModePersona}=await import(pathToFileURL(path.join(repo,'lib/redteam/assessment-policy.js')).href);
fs.mkdirSync(home,{recursive:true}); const dir=path.join(home,'profiles/test');
initProfile(dir,['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']);
fs.mkdirSync(path.join(dir,'node_modules'),{recursive:true});
fs.symlinkSync(path.join(app,'node_modules/@deepseek-ai'),path.join(dir,'node_modules/@deepseek-ai'),'junction');
fs.writeFileSync(path.join(dir,'cordis.yml'),'[]\n'); fs.writeFileSync(path.join(home,'package.json'),'{}');
const profile={name:'test',startedBundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app'],dir,
 patchPath:path.join(dir,'cordis.patch.yml'),installAnchor:path.join(dir,'package.json'),cwd:home,home,overlays:[]};
let ctx; const releases=[]; const states=[];
try {
ctx=await boot('mode-acceptance',path.join(dir,'cordis.yml'),[...readProfilePatches('test',profile),
 {id:'hmr',disabled:true},{id:'plugin-manager',disabled:true},{id:'web-startup',disabled:true},
 {id:'web-runtime',config:{openBrowser:false,printUrl:false,surfaceContext:false}}],ctx=>{
 ctx.provide('webStartup',{openBrowser:false,host:'127.0.0.1',port:0,trustedHosts:[]});
 ctx.provide('profileContext',profile);ctx.provide('appReady',{onReady:fn=>{fn();return()=>{}}});
},pathToFileURL(path.join(app,'package.json')).href);
await ctx.loader.await();
const {RedteamStore}=await import(pathToFileURL(path.join(repo,'lib/redteam/store-core.js')).href);
const store=new RedteamStore(path.join(home,'redteam')); ctx.provide('redteam',store);
for(const id of ['src','pentest','redteam','unrestricted']) {
 let definition=readPresetDefinition(id,path.join(repo,'presets',id));
 definition=withModePersona(withPresetDefaults(definition));
 definition=await preparePresetTools(definition,ctx);
 definition=await prepareListAgents(definition,ctx);
 const migrated=migratePresetDefinition(definition,{stableChildIds:true});
 const release=await registerPresetDefinitions(ctx.agentPresets,migrated.definitions); releases.push(release);
 const state=await ctx.agentPresets.resolve(id); assert(!state.broken,id+': '+state.broken);
 const handle=await ctx.agents.create({sessionId:'mode-'+id,agentOptions:ctx.agentDefaultModel.currentSelection(),
   meta:{cwd:home,agentPreset:id},setup:async agentCtx=>{await ctx.agentPresets.mount(agentCtx,id);}});
 const agent=handle.agent;
 assert(ctx.tools.get('redteam_engagement_open',agent) || id==='unrestricted',id+'/engagement');
 if(id==='src') {assert(ctx.tools.get('redteam_src_report',agent));assert(!ctx.tools.get('redteam_pentest_report',agent));assert(!ctx.tools.get('bash',agent));}
 if(id==='pentest') {assert(ctx.tools.get('redteam_pentest_report',agent));assert(ctx.tools.get('redteam_credential_add',agent));assert(!ctx.tools.get('redteam_src_report',agent));}
 if(id==='redteam'||id==='unrestricted') assert(ctx.tools.get('list_agents',agent),id+'/list_agents');
 states.push({id,order:definition.order,healthy:true,idle_tool_catalog:true}); await handle.dispose();
}
store.close();
console.log('MODE_ACCEPTANCE '+JSON.stringify({electron:process.versions.electron,node:process.versions.node,
 host:JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')).version,states,llm_calls:0,target_requests:0}));
} finally {for(const release of releases.reverse())await release(); if(ctx)await ctx.fiber.dispose();}
`, 'utf8')
  const output = spawnSync(path.join(scratch, binaryName), [script], { cwd: scratch,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PURGE_MODE_REPOSITORY: repository, DSH_HOME: path.join(scratch, 'fixture-home'),
      DSH_TELEMETRY_DISABLED: '1' }, windowsHide: true, encoding: 'utf8', timeout: 50000, maxBuffer: 2 * 1024 * 1024 })
  const receipt = output.stdout?.split(/\r?\n/).find(line => line.startsWith('MODE_ACCEPTANCE '))
  if (output.status !== 0 || !receipt) throw new Error('Isolated mode Loader acceptance failed: ' + (output.stderr || output.error?.message || output.stdout).slice(-10000))
  console.log(receipt)
} finally {
  assertWithinRoots(scratch, [fs.realpathSync(os.tmpdir())])
  removeTreeNoFollowSync(scratch)
}
