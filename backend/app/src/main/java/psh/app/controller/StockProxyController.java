package psh.app.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import psh.app.service.StockProxyService;

@RestController
@RequestMapping("/api/stocks")
public class StockProxyController {

	private final StockProxyService stockProxyService;

	public StockProxyController(StockProxyService stockProxyService) {
		this.stockProxyService = stockProxyService;
	}

	/**
	 * Get Stock Candles (Proxy & Cached)
	 * GET /api/stocks/{symbol}/candles?resolution=5&from=171822&to=171899
	 */
	@GetMapping(value = "/{symbol}/candles", produces = MediaType.APPLICATION_JSON_VALUE)
	public String getCandles(
			@PathVariable("symbol") String symbol,
			@RequestParam("resolution") String resolution,
			@RequestParam("from") long from,
			@RequestParam("to") long to) {
		
		return stockProxyService.getCandles(symbol, resolution, from, to);
	}

	/**
	 * Get Stock Quote (Proxy & Cached)
	 * GET /api/stocks/{symbol}/quote
	 */
	@GetMapping(value = "/{symbol}/quote", produces = MediaType.APPLICATION_JSON_VALUE)
	public String getQuote(@PathVariable("symbol") String symbol) {
		return stockProxyService.getQuote(symbol);
	}
}
