import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.pilio.idv.tw/ltohk/list.asp';
const TOTAL_PAGES = 145;
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'data', 'scraped_draws.json');

async function scrapePage(pageNum) {
  const url = `${BASE_URL}?indexpage=${pageNum}&orderby=new`;
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const draws = [];
    $('table tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 3) {
        const dateText = $(cells[0]).text().trim();
        const numbersText = $(cells[1]).text().trim();
        const extraText = $(cells[2]).text().trim();

        // Match date like "05/26 26(二)"
        const dateMatch = dateText.match(/(\d{2}\/\d{2})\s+(\d{2})/);
        if (!dateMatch) return;

        const [month, day] = dateMatch[1].split('/');
        const year = 2000 + parseInt(dateMatch[2]);
        const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        const numbers = numbersText
          .split(',')
          .map(n => parseInt(n.trim()))
          .filter(n => !isNaN(n));

        if (numbers.length !== 6) return;

        const extraNumber = parseInt(extraText);
        if (isNaN(extraNumber)) return;

        draws.push({
          id: `${year.toString().slice(2)}/${month}${day}`,
          date,
          numbers,
          extraNumber,
          jackpot: "",
          nextDrawDate: "",
          nextJackpot: "",
          nextDeadline: "",
          prizes: []
        });
      }
    });

    return draws;
  } catch (err) {
    console.error(`Error on page ${pageNum}:`, err.message);
    return [];
  }
}

async function main() {
  console.log("Starting fresh scrape of Mark Six historical data...");
  let allDraws = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    process.stdout.write(`\rScraping page ${page}/${TOTAL_PAGES}...`);
    const draws = await scrapePage(page);
    allDraws = allDraws.concat(draws);
    await new Promise(r => setTimeout(r, 300)); // polite delay
  }

  console.log(`\nDone! Saved ${allDraws.length} draws.`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allDraws, null, 2));
}

main();
