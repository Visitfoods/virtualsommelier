const fs = require('fs');
const path = require('path');

function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, { encoding: 'utf8' });
}

function writeFileUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
}

function parseCues(vttRaw) {
  const normalized = vttRaw.replace(/\r/g, '');
  const blocks = normalized.split('\n\n');
  const cues = [];
  for (const block of blocks) {
    if (!block.includes('-->')) continue;
    const lines = block.split('\n');
    let timeLine = null;
    const textLines = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.includes('-->')) {
        timeLine = line.trim();
        for (let j = i + 1; j < lines.length; j += 1) {
          const l = lines[j];
          if (!l || /^\s*$/.test(l)) break;
          textLines.push(l);
        }
        break;
      }
    }
    if (timeLine) cues.push({ time: timeLine, text: textLines });
  }
  return cues;
}

function buildVtt(cues) {
  const nl = '\r\n';
  let out = 'WEBVTT' + nl + nl;
  for (const cue of cues) {
    out += cue.time + nl + (cue.text || []).join(nl) + nl + nl;
  }
  return out;
}

function main() {
  const [,, brunoPathArg, refPathArg] = process.argv;
  if (!brunoPathArg || !refPathArg) {
    console.error('Uso: node scripts/retimeVtt.js <caminho_bruno_vtt> <caminho_referencia_vtt>');
    process.exit(1);
  }
  const brunoPath = brunoPathArg;
  const refPath = refPathArg;
  if (!fs.existsSync(brunoPath)) {
    console.error(`Ficheiro Bruno não encontrado: ${brunoPath}`);
    process.exit(2);
  }
  if (!fs.existsSync(refPath)) {
    console.error(`Ficheiro referência não encontrado: ${refPath}`);
    process.exit(3);
  }
  const brunoRaw = readFileUtf8(brunoPath);
  const refRaw = readFileUtf8(refPath);
  const brunoCues = parseCues(brunoRaw);
  const refCues = parseCues(refRaw);
  const count = Math.min(brunoCues.length, refCues.length);
  if (count === 0) {
    console.error('Nenhum cue encontrado em pelo menos um ficheiro.');
    process.exit(4);
  }
  const merged = [];
  for (let i = 0; i < count; i += 1) {
    merged.push({ time: refCues[i].time, text: brunoCues[i].text });
  }
  const outVtt = buildVtt(merged);
  const outPath = path.join(path.dirname(brunoPath), path.basename(brunoPath, path.extname(brunoPath)) + '_retimed.vtt');
  writeFileUtf8(outPath, outVtt);
  console.log(outPath);
  console.log(count.toString());
}

if (require.main === module) {
  main();
}


