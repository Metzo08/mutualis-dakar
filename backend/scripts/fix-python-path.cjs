const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  "execFile('python', ['-m', 'edge_tts',",
  "execFile('C:/Python313/python.exe', ['-m', 'edge_tts',"
);

fs.writeFileSync(p, content, 'utf8');
console.log('Successfully set python executable to C:/Python313/python.exe in server.js');
