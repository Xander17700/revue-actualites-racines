const Parser = require('rss-parser');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0' },
  timeout: 15000
});

// Articles depuis le 22 janvier 2025
const DATE_MIN = new Date(Date.UTC(2025, 0, 22, 0, 0, 0));
const NOW = new Date();

const feeds = [
  { name: "Cercle Généalogique de Saintonge", url: "https://www.cgsaintonge.fr/feed/" },
  { name: "Fédération Française de Généalogie", url: "https://www.genefede.eu/feed" },
  { name: "Filae", url: "https://rss.app/feeds/J87qTR1QbbM24mYH.xml" },
  { name: "Geneanet", url: "https://www.geneanet.org/blog/feed" },
  { name: "Geneatech", url: "https://geneatech.fr/feed" },
  { name: "Geneatique", url: "https://www.geneatique.com/blog/feed" },
  { name: "Geneafinder", url: "https://rss.app/feeds/NIRZiy4ixhVAwXii.xml" },
  { name: "Généa79 – Cercle généalogique des Deux-Sèvres", url: "https://genea79.wordpress.com/feed/" },
  { name: "Généalogie Magazine", url: "https://genealogie-magazine.over-blog.com/rss" },
  { name: "Généalogie Pratique - Actualité généalogique", url: "https://www.genealogiepratique.fr/actualite-genealogique/feed/" },
  { name: "Généalogie Pratique - Archives & ressources", url: "https://www.genealogiepratique.fr/archives-ressources/feed/" },
  { name: "Généalogie Pratique - Méthodes & Pratiques", url: "https://www.genealogiepratique.fr/methodes-pratiques/feed/" },
  { name: "Généalogie Pratique - Outils & logiciels", url: "https://www.genealogiepratique.fr/outils-logiciels/feed/" },
  { name: "Généalogie Pratique - Plateformes de généalogie", url: "https://www.genealogiepratique.fr/plateformes-de-genealogie/feed/" },
  { name: "Généalogie Pratique - Tutoriels généalogiques", url: "https://www.genealogiepratique.fr/tutoriels-genealogiques-video/feed/" },
  { name: "Heredis", url: "https://home.heredis.com/feed" },
  { name: "Histoire & Généalogie", url: "https://www.histoire-genealogie.com/spip.php?page=backend" },
  { name: "La Revue Française de Généalogie", url: "https://www.rfgenealogie.com/rss.xml" },
  { name: "Le Quotidien de la Généalogie", url: "https://www.quotidien-genealogie.fr/feed" },
  { name: "MyHeritage", url: "https://blog.myheritage.fr/feed/" },
  { name: "Portail international archivistique francophone (PIAF)", url: "https://www.piaf-archives.org/taxonomy/term/6/feed" },
];

function cleanText(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : "";
}

function isValidDate(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date)) return false;
  return date >= DATE_MIN && date <= NOW;
}

// Scraping Filae (pas de RSS officiel)
async function scrapeFilae() {
  try {
    const response = await axios.get(
      "https://www.filae.com/ressources/blog/",
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }
    );

    const $ = cheerio.load(response.data);
    const items = [];

    $("article").each((i, el) => {
      const title = cleanText($(el).find("h2 a").text());
      const link = $(el).find("h2 a").attr("href");
      const dateText = $(el).find("time").attr("datetime");

      if (title && link && isValidDate(dateText)) {
        items.push({
          title,
          link,
          pubDate: new Date(dateText).toISOString(),
          source: "Filae",
          description: ""
        });
      }
    });

    console.log("Filae récupéré :", items.length);
    return items;

  } catch (err) {
    console.log("Erreur scraping Filae :", err.message);
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

  let newItems = [];

  for (const feed of feeds) {
    try {
      console.log("Lecture :", feed.url);

      const data = await Promise.race([
        parser.parseURL(feed.url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 20000)
        )
      ]);

      const items = data.items
        .map(item => {

          let rawDate = item.isoDate || item.pubDate;
          let parsedDate = new Date(rawDate);

          // Correction spécifique Geneafinder
          if (feed.name === "Geneafinder") {

            if (!rawDate || isNaN(parsedDate)) {
              parsedDate = new Date(); // fallback
            }

            if (parsedDate > NOW) {
              parsedDate = NOW;
            }
          }

          return {
            title: cleanText(item.title),
            link: item.link || "",
            pubDate: parsedDate.toISOString(),
            source: feed.name,
            description: cleanText(item.contentSnippet)
          };
        })
        .filter(item =>
          item.link &&
          item.title &&
          isValidDate(item.pubDate)
        );

      newItems = newItems.concat(items);

    } catch (err) {
      console.log("Erreur :", feed.url, err.message);
    }
  }

  const filaeItems = await scrapeFilae();
  newItems = newItems.concat(filaeItems);

  // Fusion avec anciens articles
  const combined = [...existingItems, ...newItems];

  // Déduplication par lien
  const unique = Array.from(
    new Map(combined.map(item => [item.link, item])).values()
  );

  // Tri décroissant par date
  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  fs.writeFileSync('feed.json', JSON.stringify(unique, null, 2));

  console.log("Total articles enregistrés :", unique.length);
}

main();
