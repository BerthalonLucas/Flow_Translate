const fs = require('fs');
const icons = JSON.parse(fs.readFileSync(__dirname + '/icons.json', 'utf8'));
const src = fs.readFileSync(__dirname + '/components.src.js', 'utf8');
const components = ['Mark','Icon','Overlay','Glass','ActionPill','WaitPill','OverlayMenu','Notice','SettingsWindow','SettingRow','Button','Segmented','Switch','TextField','TextArea','Keycaps','StatusBadge','Callout','SaveStatus','ActionRow','EngineCard','HistoryList'];
const header = `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace: 'FlowTranslate', components: components.map(name => ({ name })) })} */`;
const body = `${header}\n/* FlowTranslate 1.0 design system — hand-written components over window.React. Icons: lucide 1.43.0 (ISC), node data copied verbatim. */\n(function () {\n  'use strict';\n  var ICONS = ${JSON.stringify(icons)};\n${src}})();\n`;
if (/<\/script|<!--/i.test(body)) throw new Error('forbidden sequence in bundle');
fs.writeFileSync(__dirname + '/../project/components/bundle.js', body);
console.log('bundle.js', body.length, 'bytes');
