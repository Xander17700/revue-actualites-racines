const Parser = require('rss-parser');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

const parser = new Parser({ headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });

const DATE_MIN = new Date(Date.UTC(2025, 0, 22, 0, 0, 0));
const NOW = new Date();

// Flux RSS / Blogs
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

function cleanText(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : "";
}
function isValidDate(dateStr) {
  return dateStr && !isNaN(new Date(dateStr)) && new Date(dateStr) >= DATE_MIN && new Date(dateStr) <= NOW;
}

// Scraping Filae (article récent seulement)
async function scrapeFilae(lastDate) {
  try {
    const { data } = await axios.get("https://www.filae.com/ressources/blog/", { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const $ = cheerio.load(data);
    const items = [];
    $("article").each((_, el) => {
      const title = cleanText($(el).find("h2 a").text());
      const link = $(el).find("h2 a").attr("href");
      const dateText = $(el).find("time").attr("datetime");
      const pubDate = new Date(dateText);
      if (title && link && pubDate > lastDate && isValidDate(pubDate)) {
        items.push({ title, link, pubDate: pubDate.toISOString(), source: "Filae", description: "" });
      }
    });
    console.log("Filae récupéré :", items.length);
    return items;
  } catch (err) {
    console.log("Filae erreur:", err.message);
    return [];
  }
}

// Fetch RSS avec retry
async function fetchFeed(feed, lastDate, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await Promise.race([
        parser.parseURL(feed.url),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
      ]);
      return (data.items || []).map(item => {
        let pubDate = new Date(item.isoDate || item.pubDate || NOW);
        if (feed.name === "Geneafinder" && (isNaN(pubDate) || pubDate > NOW)) pubDate = NOW;
        return { title: cleanText(item.title), link: item.link || "", pubDate: pubDate.toISOString(), source: feed.name, description: cleanText(item.contentSnippet) };
      }).filter(i => i.link && i.title && new Date(i.pubDate) > lastDate);
    } catch (err) {
      const code = err.response?.status?.toString();
      if (["403", "404"].includes(code)) break;
      if (attempt < retries) { console.log(`Retry ${attempt + 1} pour ${feed.name}...`); await new Promise(r => setTimeout(r, 500)); }
      else { console.log(`Échec définitif de ${feed.name}:`, err.message); return []; }
    }
  }
  return [];
}

async function main() {
  let existingItems = [];
  if (fs.existsSync('feed.json')) {
    try { existingItems = JSON.parse(fs.readFileSync('feed.json')); } catch { existingItems = []; }
  }

  const lastDate = existingItems.length ? new Date(existingItems[0].pubDate) : DATE_MIN;

  // ⚡ Parallel fetch
  const allPromises = feeds.map(f => fetchFeed(f, lastDate)).concat([scrapeFilae(lastDate)]);
  const results = await Promise.allSettled(allPromises);

  let newItems = [];
  results.forEach(r => { if (r.status === 'fulfilled') newItems.push(...r.value); });

  // Déduplication
  const existingLinks = new Set(existingItems.map(i => i.link));
  const combined = [...existingItems, ...newItems.filter(i => !existingLinks.has(i.link))];

  const unique = Array.from(new Map(combined.map(i => [i.link, i])).values());
  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  fs.writeFileSync('feed.json', JSON.stringify(unique, null, 2));
  console.log("Total articles enregistrés :", unique.length);

  // Git push fiable
  try {
    execSync('git config user.name "github-actions"');
    execSync('git config user.email "actions@github.com"');
    execSync('git add feed.json');
    execSync('git commit -m "Mise à jour automatique du flux" || echo "Aucun changement"');
    execSync('git push origin main --force');
    console.log("Push effectué !");
  } catch (err) {
    console.error("Erreur git push :", err.message);
  }
}

main().catch(err => { console.error("Erreur fatale :", err); process.exit(1); });
