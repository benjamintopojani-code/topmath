import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

for (const file of ['enseignant.html', 'eleve.html']) {
  const html = await readFile(file, 'utf8');
  const blocks = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script\s*>/gi)];
  if (!blocks.length) throw new Error('Aucun script inline trouvé dans ' + file);
  let checked = 0;
  for (let i = 0; i < blocks.length; i++) {
    const source = blocks[i][1];
    if (!source.trim()) continue;
    new Script(source, { filename: file + '#script-' + (i + 1) });
    checked++;
  }
  console.log(file + ' : ' + checked + ' script(s) vérifié(s).');
}
