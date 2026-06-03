const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  let allDraws = [];
  let pageNum = 1;
  const maxPages = 40;

  while (pageNum <= maxPages) {
    const url = `https://en.lottolyzer.com/history/hong-kong/mark-six/page/${pageNum}/per-page/50/summary-view`;
    console.log(`Scraping page ${pageNum}...`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('table', { timeout: 10000 });
      
      const draws = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        return rows.map(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 4) return null;
          
          const drawNo = cells[0]?.innerText.trim();
          const date = cells[1]?.innerText.trim();
          const numbersText = cells[2]?.innerText.trim();
          const extraText = cells[3]?.innerText.trim();
          
          if (!drawNo || !drawNo.includes('/')) return null;
          
          const numbers = numbersText.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          const extra = parseInt(extraText);
          
          if (numbers.length !== 6) return null;
          
          return { id: drawNo, date, numbers, extra };
        }).filter(Boolean);
      });

      if (draws.length === 0) {
        console.log('No more data found.');
        break;
      }

      allDraws = allDraws.concat(draws);
      console.log(`  → ${draws.length} draws`);
      pageNum++;
      
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.log('Stopping:', e.message);
      break;
    }
  }

  await browser.close();

  allDraws.sort((a, b) => b.id.localeCompare(a.id));

  fs.writeFileSync(
    '/home/steve/mark-six-tracker/src/data/scraped_draws.json',
    JSON.stringify(allDraws, null, 2)
  );

  console.log(`\n✅ Saved ${allDraws.length} draws.`);
})();
