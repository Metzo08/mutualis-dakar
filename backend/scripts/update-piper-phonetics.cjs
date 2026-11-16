const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/piperServer.js';
let content = fs.readFileSync(p, 'utf8');

const oldBlock = `    if (lang === 'wo' || lang === 'wolof') {
      t = t
        .replace(/salamaalekum/gi, 'salam aleykoum')
        .replace(/asalaa maalekum/gi, 'asalam aleykoum')
        .replace(/jërejëf|jerejef/gi, 'diéré dieuf')
        .replace(/nanga def/gi, 'nanga déf')
        .replace(/naka nga defee/gi, 'naka nga défé')
        .replace(/jàmm/gi, 'djam')
        .replace(/ndakaaru/gi, 'dakar')
        .replace(/fajukaay/gi, 'fadiou kay')
        .replace(/garab/gi, 'garap')
        .replace(/wér-gi-yaram/gi, 'wer gui yaram')
        .replace(/kër/gi, 'keur')
        .replace(/mën nga/gi, 'meune nga')
        .replace(/mënuñu/gi, 'meunou gnou')
        .replace(/mënë/gi, 'meuné')
        .replace(/mën/gi, 'meune')
        .replace(/ñoo/gi, 'gnio')
        .replace(/ñaar/gi, 'gnar')
        .replace(/ñibási/gi, 'gnibassi')
        .replace(/ñépp|nepp/gi, 'gnèp')
        .replace(/ñu/gi, 'gnou')
        .replace(/ñi/gi, 'gni')
        .replace(/xaalis/gi, 'haliss')
        .replace(/bëggàm/gi, 'bègue am')
        .replace(/bëgg/gi, 'bègue')
        .replace(/mungi/gi, 'moungui')
        .replace(/demal/gi, 'démale')
        .replace(/xoolal/gi, 'hola l')
        .replace(/xool/gi, 'hol')
        .replace(/yónnee|yonnee/gi, 'yonné')
        .replace(/lépp|lepp/gi, 'lèp')
        .replace(/bokk/gi, 'bok')
        .replace(/wax/gi, 'ouax')
        .replace(/mooy/gi, 'mo-é')
        .replace(/jokkoo/gi, 'djoko')
        .replace(/baax/gi, 'bah')
        .replace(/bu neex/gi, 'bou né')
        .replace(/suba/gi, 'souba')
        .replace(/bindal/gi, 'bindale')
        .replace(/xam/gi, 'ham')
        .replace(/tey/gi, 'tè');
    }`;

const newBlock = `    if (lang === 'wo' || lang === 'wolof') {
      t = t
        .replace(/salamaalekum/gi, 'salam aleykoum')
        .replace(/asalaa maalekum/gi, 'asalam aleykoum')
        .replace(/jërejëf|jerejef/gi, 'diéré dieuf')
        .replace(/nanga def/gi, 'nanga déf')
        .replace(/naka nga defee/gi, 'naka nga défé')
        .replace(/jàmm/gi, 'djam')
        .replace(/ndakaaru/gi, 'dakar')
        .replace(/fajukaay/gi, 'fadiou kaye')
        .replace(/garab/gi, 'garape')
        .replace(/wér-gi-yaram/gi, 'wèr gui yaram')
        .replace(/kër/gi, 'keur')
        .replace(/mën nga/gi, 'meun nga')
        .replace(/mënuñu/gi, 'meunou gnou')
        .replace(/mën nañu/gi, 'meun nagnou')
        .replace(/mën na/gi, 'meun na')
        .replace(/mënë/gi, 'meuné')
        .replace(/mën/gi, 'meun')
        .replace(/ñoo/gi, 'gnio')
        .replace(/ñaar/gi, 'gnar')
        .replace(/ñaata/gi, 'niata')
        .replace(/ñibási/gi, 'gnibassi')
        .replace(/ñépp|nepp/gi, 'gnèp')
        .replace(/ñu/gi, 'gnou')
        .replace(/ñi/gi, 'gni')
        .replace(/xaalis/gi, 'khaaliss')
        .replace(/bëggàm/gi, 'beuge am')
        .replace(/bëgg/gi, 'beuge')
        .replace(/mungi/gi, 'moungui')
        .replace(/demal/gi, 'démale')
        .replace(/xoolal/gi, 'khoolale')
        .replace(/xool/gi, 'khool')
        .replace(/yónnee|yonnee/gi, 'yonné')
        .replace(/lépp|lepp/gi, 'lèp')
        .replace(/bokk/gi, 'bok')
        .replace(/wax/gi, 'wakh')
        .replace(/mooy/gi, 'moye')
        .replace(/jokkoo/gi, 'djoko')
        .replace(/baax/gi, 'baakh')
        .replace(/bu neex/gi, 'bou nekh')
        .replace(/suba/gi, 'souba')
        .replace(/bindal/gi, 'bindale')
        .replace(/xam/gi, 'kham')
        .replace(/tey/gi, 'tè');
    }`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully updated Wolof phonetics in piperServer.js!');
} else {
  console.error('Could not find oldBlock in piperServer.js');
}
