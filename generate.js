const Parser = require('rss-parser');
const fs = require('fs');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
});

const feeds = [
  { name: "Geneatique", url: "https://www.geneatique.com/blog/feed" },
  { name: "Heredis", url: "https://home.heredis.com/feed" },
  { name: "MyHeritage", url: "https://blog.myheritage.fr/feed/" },
  { name: "Genefede", url: "https://www.genefede.eu/feed" },
  { name: "Genealogie Pratique", url: "https://www.genealogiepratique.fr/feed" },
  { name: "Genealogie Magazine", url: "https://genealogie-magazine.over-blog.com/rss" },
  { name: "Geneanet Blog", url: "https://www.geneanet.org/blog/feed" },
  { name: "Geneatech", url: "https://geneatech.fr/feed" },
  { name: "Histoire & Généalogie", url: "https://www.histoire-genealogie.com/spip.php?page=backend" },
  { name: "RF Généalogie", url: "https://www.rfgenealogie.com/rss.xml" },
  { name: "Quotidien Généalogie", url: "https://www.quotidien-genealogie.fr/feed" },
  { name: "PIAF Archives", url: "https://www.piaf-archives.org/taxonomy/term/6/feed" }
];

(async () => {
  let allItems = [];

  for (let feed of feeds) {
    try {
      const data = await parser.parseURL(feed.url);

      const items = data.items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate || item.isoDate || "",
        source: feed.name,
        image:
  item.enclosure?.url ||
  item["media:content"]?.url ||
  item["media:thumbnail"]?.url ||
  item["media:group"]?.["media:content"]?.[0]?.url ||
  (item.content && item.content.match(/<img.*?src="(.*?)"/)?.[1]) ||
  null,
        description: item.contentSnippet || ""
      }));

      allItems = allItems.concat(items);

    } catch (err) {
      console.log("Erreur :", feed.url);
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  allItems = allItems.slice(0, 80);

  fs.writeFileSync('feed.json', JSON.stringify(allItems, null, 2));
})();
