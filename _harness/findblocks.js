/**
 * One-shot: find the exact line ranges of the contact grid's two children, so
 * B26's DOM reorder is a move of known bounds rather than a hand-matched
 * 90-line string.
 *
 * Counts <div ...> against </div> from a given start line, ignoring
 * self-closing tags and tags inside strings well enough for this file's JSX.
 */
const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8').split(/\r?\n/);

function matchDiv(startIdx) {
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    const opens = (l.match(/<div\b/g) || []).length;
    const selfClose = (l.match(/<div\b[^>]*\/>/g) || []).length;
    const closes = (l.match(/<\/div>/g) || []).length;
    depth += opens - selfClose - closes;
    if (i > startIdx || opens > 0) {
      if (depth === 0) return i + 1; // 1-based inclusive end line
    }
  }
  return null;
}

// 1-based line numbers from grep
const RAIL_START = 4572;   // <div className="space-y-4">
const FORM_START = 4645;   // <div className="lg:col-span-2">

const railEnd = matchDiv(RAIL_START - 1);
const formEnd = matchDiv(FORM_START - 1);
console.log('rail:', RAIL_START, '->', railEnd);
console.log('form:', FORM_START, '->', formEnd);
console.log('line after form end:', JSON.stringify(lines[formEnd]));
console.log('rail first line :', JSON.stringify(lines[RAIL_START - 1]));
console.log('rail last line  :', JSON.stringify(lines[railEnd - 1]));
console.log('form first line :', JSON.stringify(lines[FORM_START - 1]));
console.log('form last line  :', JSON.stringify(lines[formEnd - 1]));
