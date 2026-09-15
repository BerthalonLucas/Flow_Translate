// Real Win32 SendInput -> Edge -> UIA readback. No JS replacement, no mocked OS APIs.
// Synthetic documents only; use a dedicated desktop (GitHub Windows runner).
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
const scratch = await mkdtemp(join(tmpdir(), 'flowtranslate-replacement-'));
const portFile = join(scratch, 'port');
const driver = spawn('cargo', ['test', '--locked', '--manifest-path', 'src-tauri/Cargo.toml', 'replacement_desktop_driver', '--', '--ignored', '--nocapture', '--test-threads=1'], {
  env: { ...process.env, FLOWTRANSLATE_REPLACEMENT_PORT_FILE: portFile }, stdio: 'inherit',
});
let browser;
let port;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const command = payload => new Promise((resolve, reject) => {
  const socket = net.connect(port, '127.0.0.1');
  socket.setTimeout(15000, () => socket.destroy(Error('native driver timeout')));
  let data = '';
  socket.on('connect', () => socket.write(JSON.stringify(payload) + '\n'));
  socket.on('error', reject);
  socket.on('data', chunk => { data += chunk; if (data.includes('\n')) { socket.end(); resolve(JSON.parse(data)); } });
});
const keys = text => execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('scripts/capture-matrix-helper.ps1'), '-Action', 'keys', '-Text', text], { stdio: 'pipe' });
let passed = 0;
try {
  for (let attempt = 0; attempt < 180; attempt++) {
    if (driver.exitCode !== null) throw Error('native driver exited before ready');
    try { port = Number(await readFile(portFile, 'utf8')); break; } catch { await sleep(1000); }
  }
  assert.ok(port, 'native driver ready');
  browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--force-renderer-accessibility', '--no-first-run'] });
  const page = await browser.newPage();
  await page.setContent('<title>FlowTranslate Replacement Tests</title><input id="input"><textarea id="textarea"></textarea><div id="rich" contenteditable="true" role="textbox"></div><input id="other"><input id="readonly" readonly value="café 😀"><input id="password" type="password" value="secret"><iframe srcdoc="<textarea id=frame></textarea>"></iframe><div id="shadow"></div>');
  await page.evaluate(() => { document.querySelector('#shadow').attachShadow({ mode: 'open' }).innerHTML = '<textarea id="shadow-input"></textarea>'; });
  const original = 'Début café 😀 fin';
  const selected = 'café 😀';
  const replacement = 'équipe 🚀';
  await page.evaluate(() => { document.addEventListener('input', event => { event.target.dataset.nativeInput = event.inputType ?? 'input'; }); });
  const prepare = async (locator, { rich = false, multiline = false } = {}) => {
    await page.bringToFront();
    await locator.evaluate((el, { original, selected, rich, multiline }) => {
      const text = multiline ? original + '\nSeconde ligne' : original;
      if (rich) el.innerHTML = '<b>Début </b><span>café 😀</span><i> fin</i>';
      else el.value = text;
      el.focus();
      if (rich) {
        const range = document.createRange(); range.selectNodeContents(el.querySelector('span'));
        const selection = el.ownerDocument.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      } else el.setSelectionRange(6, 6 + selected.length);
    }, { original, selected, rich, multiline });
    await sleep(300);
  };
  const content = locator => locator.evaluate(el => 'value' in el ? el.value : el.textContent);
  const capture = async () => {
    const result = await command({ op: 'capture' });
    assert.equal(result.replaceable, true, `selection available: ${JSON.stringify(result)}`);
    return result;
  };
  for (const [name, locator, options] of [
    ['input', page.locator('#input'), {}],
    ['textarea multiline', page.locator('#textarea'), { multiline: true }],
    ['contenteditable formatted', page.locator('#rich'), { rich: true }],
    ['iframe', page.frameLocator('iframe').locator('#frame'), {}],
    ['shadow DOM', page.locator('#shadow-input'), {}],
  ]) {
    await command({ op: 'clipboard-seed' });
    await prepare(locator, options);
    const before = await content(locator);
    const captured = await capture();
    const value = options.multiline ? replacement + '\nmerci' : replacement;
    const result = await command({ op: 'replace', value });
    assert.equal(result.ok, true, `${name}: ${JSON.stringify(result)}`);
    assert.equal(await content(locator), before.replace(selected, value), name);
    if (!['iframe', 'shadow DOM'].includes(name)) assert.equal(await locator.getAttribute('data-native-input'), 'insertFromPaste', `${name}: editor input event`);
    assert.equal((await command({ op: 'clipboard-check' })).ok, true, `${name}: rich clipboard restored`);
    if (options.rich) { assert.equal(await locator.locator('b').textContent(), 'Début '); assert.equal(await locator.locator('i').textContent(), ' fin'); }
    keys('^z');
    assert.equal(await content(locator), before, `${name}: native undo`);
    console.log(`PASS ${name}: ${captured.route}, Unicode, surrounding text, clipboard, undo`); passed++;
  }
  const input = page.locator('#input');
  for (const reason of ['selection', 'document', 'focus']) {
    await prepare(input); await capture();
    if (reason === 'selection') await input.evaluate(el => el.setSelectionRange(0, 5));
    if (reason === 'document') await input.evaluate(el => { el.value += '!'; el.setSelectionRange(6, 13); });
    if (reason === 'focus') await page.locator('#other').focus();
    const before = await content(input);
    assert.equal((await command({ op: 'replace', value: replacement })).ok, false, `${reason}: refused`);
    assert.equal(await content(input), before, `${reason}: unchanged`);
    console.log(`PASS changed ${reason}: replacement refused`); passed++;
  }
  for (const id of ['readonly', 'password']) {
    await page.locator(`#${id}`).evaluate(el => { el.focus(); el.select(); });
    const result = await command({ op: 'capture' });
    assert.notEqual(result.replaceable, true, `${id}: refused`);
    console.log(`PASS ${id}: no replacement`); passed++;
  }
  await prepare(input); await capture();
  await command({ op: 'clipboard-seed' }); // a new user copy after capture must survive
  assert.equal((await command({ op: 'replace', value: replacement })).ok, true);
  assert.equal((await command({ op: 'clipboard-check' })).ok, true);
  assert.equal((await command({ op: 'replace', value: replacement })).ok, false, 'no double delivery');
  console.log('PASS newer clipboard and duplicate delivery'); passed++;
  await prepare(input); await capture();
  await input.evaluate(el => el.addEventListener('paste', event => event.preventDefault(), { once: true }));
  assert.equal((await command({ op: 'replace', value: replacement })).ok, false, 'editor blocked paste: not reported as applied');
  assert.equal(await content(input), original, 'blocked paste: unchanged');
  assert.equal((await command({ op: 'replace', value: replacement })).ok, false, 'ambiguous attempt cannot paste twice');
  console.log('PASS editor blocks paste: no false success and no duplicate'); passed++;
  console.log(`Native replacement matrix: ${passed} cases passed (Edge desktop; Office/Teams not installed/tested).`);
} finally {
  if (port) await command({ op: 'quit' }).catch(() => {});
  if (browser) await browser.close();
  if (driver.exitCode === null) {
    await sleep(250);
    if (driver.exitCode === null) execFileSync('taskkill', ['/PID', String(driver.pid), '/T', '/F'], { stdio: 'ignore' });
  }
  await rm(scratch, { recursive: true, force: true });
}
