package psh.app.service;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;
import psh.app.domain.cache.StockCache;
import psh.app.domain.cache.StockCacheRepository;

@Slf4j
@Service
public class StockProxyService {

	@Value("${finnhub.api-key}")
	private String apiKey;

	@Value("${polygon.api-key:}")
	private String polygonApiKey;

	private final StockCacheRepository stockCacheRepository;
	private final RestTemplate restTemplate = new RestTemplate();
	private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

	public StockProxyService(StockCacheRepository stockCacheRepository) {
		this.stockCacheRepository = stockCacheRepository;
	}

	/**
	 * Get Stock Candles (Cached for 1 minute)
	 */
	@Transactional
	public String getCandles(String symbol, String resolution, long from, long to) {
		String cacheKey = String.format("candles-%s-%s-%d-%d", symbol, resolution, from, to);

		Optional<StockCache> optionalCache = stockCacheRepository.findById(cacheKey);
		if (optionalCache.isPresent()) {
			StockCache cache = optionalCache.get();
			if (!cache.isExpired()) {
				log.debug("Stock Candles Cache HIT for key: {}", cacheKey);
				return cache.getResponseBody();
			}
		}

		log.info("Stock Candles Cache MISS for key: {}. Requesting Finnhub API.", cacheKey);
		try {
			String url = String.format(
				"https://finnhub.io/api/v1/stock/candle?symbol=%s&resolution=%s&from=%d&to=%d&token=%s",
				symbol, resolution, from, to, apiKey
			);
			ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
			if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
				String responseBody = response.getBody();
				if (responseBody.contains("\"s\":\"ok\"")) {
					saveCache(cacheKey, responseBody, LocalDateTime.now().plusMinutes(1));
					return responseBody;
				}
			}
		} catch (Exception e) {
			log.warn("Failed to fetch stock candles from Finnhub for " + symbol + ", trying Polygon fallback", e);
		}

		// Polygon Fallback
		if (polygonApiKey != null && !polygonApiKey.trim().isEmpty()) {
			try {
				String timespan = "minute";
				int multiplier = 1;
				if ("5".equals(resolution)) multiplier = 5;
				else if ("15".equals(resolution)) multiplier = 15;
				else if ("30".equals(resolution)) multiplier = 30;
				else if ("60".equals(resolution)) { multiplier = 1; timespan = "hour"; }
				else if ("D".equals(resolution)) { multiplier = 1; timespan = "day"; }
				else if ("W".equals(resolution)) { multiplier = 1; timespan = "week"; }

				long polyFrom = from * 1000;
				long polyTo = to * 1000;

				String polygonUrl = String.format(
					"https://api.polygon.io/v2/aggs/ticker/%s/range/%d/%s/%d/%d?adjusted=true&sort=asc&apiKey=%s",
					symbol, multiplier, timespan, polyFrom, polyTo, polygonApiKey
				);

				ResponseEntity<String> response = restTemplate.getForEntity(polygonUrl, String.class);
				if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
					String mappedBody = mapPolygonCandlesToFinnhub(response.getBody());
					if (mappedBody != null) {
						saveCache(cacheKey, mappedBody, LocalDateTime.now().plusMinutes(1));
						return mappedBody;
					}
				}
			} catch (Exception ex) {
				log.error("Polygon fallback getCandles failed for " + symbol, ex);
			}
		}

		// Fallback to expired cache or empty data
		if (optionalCache.isPresent()) {
			log.warn("Finnhub and Polygon calls failed. Falling back to expired cache for candles: {}", symbol);
			return optionalCache.get().getResponseBody();
		}
		return "{\"s\":\"no_data\"}";
	}

	/**
	 * Get Stock Quote (Cached for 10 seconds)
	 */
	@Transactional
	public String getQuote(String symbol) {
		String cacheKey = String.format("quote-%s", symbol);

		Optional<StockCache> optionalCache = stockCacheRepository.findById(cacheKey);
		if (optionalCache.isPresent()) {
			StockCache cache = optionalCache.get();
			if (!cache.isExpired()) {
				log.debug("Stock Quote Cache HIT for key: {}", cacheKey);
				return cache.getResponseBody();
			}
		}

		log.info("Stock Quote Cache MISS for key: {}. Requesting Finnhub API.", cacheKey);
		try {
			String url = String.format(
				"https://finnhub.io/api/v1/quote?symbol=%s&token=%s",
				symbol, apiKey
			);
			ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
			if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
				String responseBody = response.getBody();
				saveCache(cacheKey, responseBody, LocalDateTime.now().plusSeconds(10));
				return responseBody;
			}
		} catch (Exception e) {
			log.warn("Failed to fetch stock quote from Finnhub for " + symbol + ", trying Polygon fallback", e);
		}

		// Polygon Fallback
		if (polygonApiKey != null && !polygonApiKey.trim().isEmpty()) {
			try {
				String polygonUrl = String.format(
					"https://api.polygon.io/v2/last/trade/%s?apiKey=%s",
					symbol, polygonApiKey
				);
				ResponseEntity<String> response = restTemplate.getForEntity(polygonUrl, String.class);
				if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
					String mappedBody = mapPolygonQuoteToFinnhub(response.getBody());
					if (mappedBody != null) {
						saveCache(cacheKey, mappedBody, LocalDateTime.now().plusSeconds(10));
						return mappedBody;
					}
				}
			} catch (Exception ex) {
				log.error("Polygon fallback getQuote failed for " + symbol, ex);
			}
		}

		// Fallback to expired cache or default zero quote
		if (optionalCache.isPresent()) {
			log.warn("Finnhub and Polygon calls failed. Falling back to expired cache for quote: {}", symbol);
			return optionalCache.get().getResponseBody();
		}
		return "{\"c\": 0, \"h\": 0, \"l\": 0, \"o\": 0, \"pc\": 0, \"t\": 0}";
	}

	private void saveCache(String cacheKey, String responseBody, LocalDateTime expiredAt) {
		try {
			StockCache newCache = StockCache.builder()
					.cacheKey(cacheKey)
					.responseBody(responseBody)
					.expiredAt(expiredAt)
					.build();
			stockCacheRepository.save(newCache);
		} catch (Exception ex) {
			log.error("Failed to save stock cache for key: " + cacheKey, ex);
		}
	}

	private String mapPolygonCandlesToFinnhub(String polygonJson) {
		try {
			com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(polygonJson);
			if (!root.has("results")) return null;
			com.fasterxml.jackson.databind.JsonNode results = root.get("results");

			java.util.List<Long> o = new java.util.ArrayList<>();
			java.util.List<Long> h = new java.util.ArrayList<>();
			java.util.List<Long> l = new java.util.ArrayList<>();
			java.util.List<Long> c = new java.util.ArrayList<>();
			java.util.List<Long> v = new java.util.ArrayList<>();
			java.util.List<Long> t = new java.util.ArrayList<>();

			for (com.fasterxml.jackson.databind.JsonNode node : results) {
				o.add(Math.round(node.get("o").asDouble()));
				h.add(Math.round(node.get("h").asDouble()));
				l.add(Math.round(node.get("l").asDouble()));
				c.add(Math.round(node.get("c").asDouble()));
				v.add(node.get("v").asLong());
				t.add(node.get("t").asLong() / 1000); // ms -> sec
			}

			java.util.Map<String, Object> finnhubFormat = new java.util.HashMap<>();
			finnhubFormat.put("s", "ok");
			finnhubFormat.put("o", o);
			finnhubFormat.put("h", h);
			finnhubFormat.put("l", l);
			finnhubFormat.put("c", c);
			finnhubFormat.put("v", v);
			finnhubFormat.put("t", t);

			return objectMapper.writeValueAsString(finnhubFormat);
		} catch (Exception ex) {
			log.error("Failed to parse/map Polygon response", ex);
			return null;
		}
	}

	private String mapPolygonQuoteToFinnhub(String polygonJson) {
		try {
			com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(polygonJson);
			if (!root.has("results")) return null;
			com.fasterxml.jackson.databind.JsonNode results = root.get("results");

			double p = results.get("p").asDouble();
			long t = results.get("t").asLong() / 1000;

			java.util.Map<String, Object> finnhubFormat = new java.util.HashMap<>();
			finnhubFormat.put("c", p);
			finnhubFormat.put("h", p);
			finnhubFormat.put("l", p);
			finnhubFormat.put("o", p);
			finnhubFormat.put("pc", p);
			finnhubFormat.put("t", t);

			return objectMapper.writeValueAsString(finnhubFormat);
		} catch (Exception ex) {
			log.error("Failed to parse/map Polygon quote response", ex);
			return null;
		}
	}
}
