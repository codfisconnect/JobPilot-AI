const fs = require('fs');
const path = require('path');

const srcManifest = path.join(__dirname, 'manifest.json');
const destManifest = path.join(__dirname, 'dist/manifest.json');
const srcHtml = path.join(__dirname, 'dist/src/popup/popup.html');
const destHtml = path.join(__dirname, 'dist/popup.html');

if (fs.existsSync(srcManifest)) {
  fs.copyFileSync(srcManifest, destManifest);
  console.log('Copied manifest.json to dist/');
}

if (fs.existsSync(srcHtml)) {
  fs.copyFileSync(srcHtml, destHtml);
  console.log('Copied popup.html to dist root');
}
