import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// Single-file page: title, fonts, inline CSS, React from cdnjs, inline app bundle.
const css = ['src/app.css', 'src/loaders.css'].map(f => readFileSync(f, 'utf8')).join('\n');
const js = readFileSync('dist/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>Labo FlowTranslate</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/labo-flowtranslate.html', html);
console.log('dist/labo-flowtranslate.html', (html.length / 1024).toFixed(1), 'KB');
