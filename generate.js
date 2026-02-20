const fs = require('fs');
const Parser = require('rss-parser');
const parser = new Parser();

const feeds = [
"https://www.filae.com/ressources/blog/feed",
"http://www.francegenweb.org/blog/index.php?feed=rss2",
"https://www.geneatique.com/blog/feed",
"https://home.heredis.com/feed",
"https://blog.myheritage.fr/feed/",
"https://www.genefede.eu/feed",
"https://geneafinder.com/rss/rss.xml",
"https://www.genealogiepratique.fr/feed",
"https://genealogie-magazine.over-blog.com/rss",
"https://www.geneanet.org/blog/feed",
"https://geneatech.fr/feed",
"https://www.histoire-genealogie.com/spip.php?page=backend",
"https://www.rfgenealogie.com/rss.xml",
"https://www.quotidien-genealogie.fr/feed",
"https://www.piaf-archives.org/taxonomy/term/6/feed"
];

(async () => {
  let allItems = [];

  for (let url of feeds) {
    try {
      let feed = await parser.parseURL(url);
      feed.items.forEach(item => {
        allItems.push({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate || item.isoDate,
          source: feed.title
        });
      });
    } catch (e) {
      console.log("Erreur :", url);
    }
  }

  allItems.sort((a,b)=> new Date(b.pubDate) - new Date(a.pubDate));

  fs.writeFileSync('feed.json', JSON.stringify(allItems.slice(0,200), null, 2));
})();
