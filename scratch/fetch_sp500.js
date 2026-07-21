const fs = require('fs');
const path = require('path');

async function fetchSP500() {
  console.log('Fetching S&P 500 list from Wikipedia...');
  const response = await fetch('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies');
  const html = await response.text();

  // Find constituents table
  let tableStartIndex = html.indexOf('id="constituents"');
  if (tableStartIndex === -1) {
    tableStartIndex = html.indexOf('class="wikitable sortable"');
  }
  if (tableStartIndex === -1) {
    console.error('Could not find wikitable in Wikipedia HTML.');
    return;
  }

  const tableEndIndex = html.indexOf('</table>', tableStartIndex);
  const tableHtml = html.substring(tableStartIndex, tableEndIndex);

  // Match table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  const stocks = [];

  let isFirst = true;

  while ((match = rowRegex.exec(tableHtml)) !== null) {
    if (isFirst) {
      isFirst = false;
      continue;
    }
    const rowContent = match[1];
    
    // Parse cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.push(cellMatch[1].trim());
    }

    if (cells.length >= 2) {
      const symbolText = cells[0].replace(/<[^>]*>/g, '').trim().replace(/\./g, '-');
      const nameText = cells[1].replace(/<[^>]*>/g, '').trim();

      if (symbolText && symbolText.length <= 6 && !symbolText.includes('\n')) {
        stocks.push({
          code: symbolText,
          name: nameText,
          currentPrice: 150000,
          prevClose: 150000,
          fluctuationRate: 0.0,
          volume: 50000, // Placeholder
        });
      }
    }
  }

  console.log(`Parsed ${stocks.length} stocks from Wikipedia.`);
  
  if (stocks.length === 0) {
    console.error('Could not parse any stocks.');
    return;
  }

  const topPrices = {
    MSFT: 393.82 * 1350,
    AAPL: 333.74 * 1350,
    NVDA: 202.81 * 1350,
    AMZN: 185.0 * 1350,
    META: 480.0 * 1350,
    GOOGL: 170.0 * 1350,
    BRK_B: 410.0 * 1350,
    LLY: 820.0 * 1350,
    AVGO: 1400.0 * 1350,
    JPM: 195.0 * 1350,
    TSLA: 380.84 * 1350,
  };

  const topVolumes = {
    NVDA: 85000000,
    TSLA: 72000000,
    AAPL: 58000000,
    AMZN: 45000000,
    MSFT: 32000000,
    META: 28000000,
    GOOGL: 25000000,
    AMD: 22000000,
    NFLX: 18000000,
    JPM: 15000000,
  };

  const updatedStocks = stocks.map(stock => {
    const key = stock.code.replace('-', '_');
    
    // Set prices
    let price = Math.round(Math.random() * 370 * 1350) + Math.round(30 * 1350);
    if (topPrices[key]) {
      price = Math.round(topPrices[key]);
    }

    // Set volumes
    let vol = Math.floor(Math.random() * 1200000) + 100000;
    if (topVolumes[key]) {
      vol = topVolumes[key];
    }

    return {
      code: stock.code,
      name: stock.name,
      currentPrice: price,
      prevClose: price,
      fluctuationRate: 0.0,
      volume: vol,
    };
  });

  const fileContent = `// S&P 500 Ticker List (Programmatically populated)
export const stockQuotes = ${JSON.stringify(updatedStocks, null, 2)};
`;

  const outputPath = path.join(__dirname, '../frontend/vibe-stock/src/data/stocks.js');
  fs.writeFileSync(outputPath, fileContent, 'utf-8');
  console.log(`Successfully wrote stocks to ${outputPath}`);
}

fetchSP500().catch(console.error);
