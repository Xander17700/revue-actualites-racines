const Parser = require('rss-parser');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GitHubActionsBot/1.0)' },
  timeout: 15000
});

const DATE_MIN = new Date(Date.UTC(2025, 0, 22));
const MAX_ITEMS = 1000; // évite un fichier trop lourd

const feeds = [
  { name: "Fédération Française de Généalogie", url: "https://www.genefede.eu/feed" },
  { name: "Filae", url: "https://rss.app/feeds/J87qTR1QbbM24mYH.xml" },
  { name: "Geneanet", url: "https://rss.app/feeds/YL9FURTjiMYoJjDI.xml" },
  { name: "Geneatech", url: "https://geneatech.fr/feed" },
  { name: "Geneatique", url: "https://www.geneatique.com/blog/feed" },
  { name: "Geneafinder", url: "https://rss.app/feeds/NIRZiy4ixhVAwXii.xml" },
  { name: "Généalogie Magazine", url: "https://genealogie-magazine.over-blog.com/rss" },
  { name: "Généalogie Pratique - Actualité généalogique", url: "https://www.genealogiepratique.fr/actualite-genealogique/feed/" },
  { name: "Généalogie Pratique - Archives & ressources", url: "https://www.genealogiepratique.fr/archives-ressources/feed/" },
  { name: "Généalogie Pratique - Méthodes & pratiques", url: "https://www.genealogiepratique.fr/methodes-pratiques/feed/" },
  { name: "Généalogie Pratique - Outils & logiciels", url: "https://www.genealogiepratique.fr/outils-logiciels/feed/" },
  { name: "Généalogie Pratique - Plateformes", url: "https://www.genealogiepratique.fr/plateformes-de-genealogie/feed/" },
  { name: "Généalogie Pratique - Tutoriels vidéo", url: "https://www.genealogiepratique.fr/tutoriels-genealogiques-video/feed/" },
  { name: "Heredis", url: "https://home.heredis.com/feed" },
  { name: "Histoire & Généalogie", url: "https://www.histoire-genealogie.com/spip.php?page=backend" },
  { name: "La Revue Française de Généalogie", url: "https://www.rfgenealogie.com/rss.xml" },
  { name: "Le Quotidien de la Généalogie", url: "https://www.quotidien-genealogie.fr/feed" },
  { name: "MyHeritage", url: "https://blog.myheritage.fr/feed/" },
  { name: "PIAF", url: "https://www.piaf-archives.org/taxonomy/term/6/feed" },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : "";
}

function parseDate(item) {
  const d = new Date(item.isoDate || item.pubDate || Date.now());
  return isNaN(d) ? new Date() : d;
}

async function fetchFeed(feed, lastDate) {
  try {
    const data = await parser.parseURL(feed.url);

    return (data.items || [])
      .map(item => {
        const pubDate = parseDate(item);
        return {
          title: cleanText(item.title),
          link: item.link || "",
          pubDate: pubDate.toISOString(),
          source: feed.name,
          description: cleanText(item.contentSnippet)
        };
      })
      .filter(i =>
        i.title &&
        i.link &&
        new Date(i.pubDate) > lastDate &&
        new Date(i.pubDate) >= DATE_MIN
      );

  } catch (err) {

    const code = err.response?.status?.toString();

    if (["402", "403", "404"].includes(code)) {
      console.log(`Flux bloqué (${code}) : ${feed.name}`);
      return [];
    }

    console.log(`Erreur ${feed.name} :`, err.message);
    return [];
  }
}

async function main() {

  let existingItems = [];
  if (fs.existsSync('feed.json')) {
    try {
      existingItems = JSON.parse(fs.readFileSync('feed.json'));
    } catch {
      existingItems = [];
    }
  }

  const lastDate = existingItems.length
    ? new Date(existingItems[0].pubDate)
    : DATE_MIN;

  let newItems = [];

  // 🔒 TRAITEMENT SÉQUENTIEL STABLE
  for (const feed of feeds) {
    console.log(`Traitement : ${feed.name}`);
    const items = await fetchFeed(feed, lastDate);
    newItems.push(...items);

    await sleep(800); // délai anti-blocage
  }

  // 🔁 Déduplication
  const existingLinks = new Set(existingItems.map(i => i.link));
  const combined = [
    ...existingItems,
    ...newItems.filter(i => !existingLinks.has(i.link))
  ];

  const unique = Array.from(new Map(combined.map(i => [i.link, i])).values())
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, MAX_ITEMS);

  const newContent = JSON.stringify(unique, null, 2);
  const oldContent = fs.existsSync('feed.json')
    ? fs.readFileSync('feed.json', 'utf8')
    : "";

  if (newContent === oldContent) {
    console.log("Aucune modification — pas de commit.");
    return;
  }

  fs.writeFileSync('feed.json', newContent);
  console.log("Articles enregistrés :", unique.length);

  try {
    execSync('git config user.name "github-actions"');
    execSync('git config user.email "actions@github.com"');
    execSync('git add feed.json');
    execSync('git commit -m "Mise à jour automatique du flux"');
    execSync('git push origin main --force');
    console.log("Push OK");
  } catch (err) {
    console.log("Aucun changement à pousser.");
  }
}

main().catch(err => {
  console.error("Erreur fatale :", err);
  process.exit(0); // ne fait PAS échouer le workflow
});
