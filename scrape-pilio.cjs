const https = require('https');
const fs = require('fs');

function fetchPage(page = 1) {
  return new Promise((resolve) => {
    const url = page === 1 
      ? 'https://pilio.idv.tw/ltohk-hist'
      : `https://pilio.idv.tw/ltohk-hist?page=${page}`;
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function parseDraws(html) {
  const draws = [];
  // Common patterns for pilio.idv.tw
  const patterns = [
    /<tr[^>]*>\s*<td[^>]*>(\d+\/\d+)<\/td>\s*<td[^>]*>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d\s,]+)<\/td>/gi,
    /<td[^>]*>(\d+\/\d+)<\/td>\s*<td[^>]*>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d,]+)<\/td>/gi
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const id = match[1];
      const date = match[2];
      const numbersStr = match[3];
      const numbers = numbersStr.split(/[\s,]+/).map(n => parseInt(n)).filter(n => n >= 1 && n <= 49);
      
      if (numbers.length === 6 && !draws.find(d => d.id === id)) {
        draws.push({ id, date, numbers, extra: 0 });
      }
    }
  }
  return draws;
}

(async () => {
  console.log('Scraping from pilio.idv.tw...');
  let allDraws = [];
  let page = 1;

  while (page <= 50) {
    process.stdout.write(`Page ${page}... `);
    const html = await fetchPage(page);
    
    if (!html || html.length < 1000) {
      console.log('empty');
      break;
    }
    
    const draws = parseDraws(html);
    if (draws.length === 0) {
      console.log('no matches');
      break;
    }
    
    allDraws = allDraws.concat(draws);
    console.log(draws.length);
    page++;
    await new Promise(r => setTimeout(r, 200));
  }

  // Remove duplicates and sort
  const unique = {};
  allDraws.forEach(d => unique[d.id] = d);
  const final = Object.values(unique).sort((a, b) => b.id.localeCompare(a.id));

  fs.writeFileSync(
    '/home/steve/mark-six-tracker/src/data/scraped_draws.json',
    JSON.stringify(final, null, 2)
  );

  console.log(`\n✅ Saved ${final.length} draws from pilio.idv.tw`);
})();
