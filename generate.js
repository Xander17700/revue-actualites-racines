const Parser = require('rss-parser');
const fs = require('fs');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
});

// 📅 Date minimale : 22 janvier 2025 inclus (UTC sécurisé)
const DATE_MIN = new Date(Date.UTC(2025, 0, 22, 0, 0, 0));

const feeds = [
  { name: "Geneatique", url: "https://www.geneatique.com/blog/feed" },
  { name: "Heredis", url: "https://home.heredis.com/feed" },
  { name: "Geneafinder", url: "https://geneafinder.com/rss/fr_rss.xml" },
  { name: "MyHeritage", url: "https://blog.myheritage.fr/feed/" },
  { name: "Fédération Française de Généalogie", url: "https://www.genefede.eu/feed" },
  { name: "Cercle Généalogique de Saintonge", url: "https://www.cgsaintonge.fr/feed/" },
  { name: "Généa79 – Cercle généalogique des Deux-Sèvres", url: "https://genea79.wordpress.com/feed/" },
  { name: "Généalogie Pratique - Articles récents", url: "https://www.genealogiepratique.fr/feed" },
  { name: "Généalogie Pratique - Catégorie Actualité généalogique", url: "https://www.genealogiepratique.fr/actualite-genealogique/feed/" },
  { name: "Généalogie Pratique - Catégorie Tutoriels généalogiques", url: "https://www.genealogiepratique.fr/tutoriels-genealogiques-video/feed/" },
  { name: "Généalogie Pratique - Catégorie Outils & logiciels", url: "https://www.genealogiepratique.fr/outils-logiciels/feed/" },
  { name: "Généalogie Pratique - Catégorie Méthodes & Pratiques", url: "https://www.genealogiepratique.fr/methodes-pratiques/feed/" },
  { name: "Généalogie Pratique - Catégorie Archives & ressources", url: "https://www.genealogiepratique.fr/archives-ressources/feed/" },
  { name: "Généalogie Pratique - Catégorie Plateformes de généalogie", url: "https://www.genealogiepratique.fr/plateformes-de-genealogie/feed/" },
  { name: "Généalogie Magazine", url: "https://genealogie-magazine.over-blog.com/rss" },
  { name: "Geneanet - Le Blog", url: "https://www.geneanet.org/blog/feed" },
  { name: "Geneatech", url: "https://geneatech.fr/feed" },
  { name: "Histoire & Généalogie", url: "https://www.histoire-genealogie.com/spip.php?page=backend" },
  { name: "La Revue Française Généalogie", url: "https://www.rfgenealogie.com/rss.xml" },
  { name: "Le Quotidien de la Généalogie", url: "https://www.quotidien-genealogie.fr/feed" },
  { name: "Portail international archivistique francophone (PIAF)", url: "https://www.piaf-archives.org/taxonomy/term/6/feed" }
];

(async () => {
  let allItems = [];

  for (let feed of feeds) {
    try {
      console.log("Lecture :", feed.url);

      const data = await parser.parseURL(feed.url);

      const items = data.items
        .map(item => ({
          title: item.title || "",
          link: item.link || "",
          pubDate: item.pubDate || item.isoDate || "",
          source: feed.name,
          description: item.contentSnippet || ""
        }))
        .filter(item => {
          if (!item.pubDate) return false;

          const date = new Date(item.pubDate);
          if (isNaN(date)) return false;

          return date >= DATE_MIN;
        });

      allItems = allItems.concat(items);

    } catch (err) {
      console.log("Erreur :", feed.url);
    }
  }

  // 🔽 Tri du plus récent au plus ancien
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // 🔢 Limite à 80 articles
  allItems = allItems.slice(0, 80);

  fs.writeFileSync('feed.json', JSON.stringify(allItems, null, 2));

  console.log("Total articles retenus :", allItems.length);
})();
