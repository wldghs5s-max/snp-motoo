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

	private final StockCacheRepository stockCacheRepository;
	private final RestTemplate restTemplate = new RestTemplate();

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
		String url = String.format(
			"https://finnhub.io/api/v1/stock/candle?symbol=%s&resolution=%s&from=%d&to=%d&token=%s",
			symbol, resolution, from, to, apiKey
		);

		try {
			ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
			if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
				String responseBody = response.getBody();
				
				// Save/Update cache with 1-minute expiration
				StockCache newCache = StockCache.builder()
						.cacheKey(cacheKey)
						.responseBody(responseBody)
						.expiredAt(LocalDateTime.now().plusMinutes(1))
						.build();
				stockCacheRepository.save(newCache);

				return responseBody;
			} else {
				throw new RuntimeException("Finnhub API returned status: " + response.getStatusCode());
			}
		} catch (Exception e) {
			log.error("Failed to fetch stock candles from Finnhub for " + symbol, e);
			// If call fails but we have expired cache, fallback to expired cache to prevent app crash
			if (optionalCache.isPresent()) {
				log.warn("Finnhub call failed. Falling back to expired cache for candles: {}", symbol);
				return optionalCache.get().getResponseBody();
			}
			throw new RuntimeException("주식 캔들 데이터를 불러오는 중 오류가 발생했습니다: " + e.getMessage());
		}
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
		String url = String.format(
			"https://finnhub.io/api/v1/quote?symbol=%s&token=%s",
			symbol, apiKey
		);

		try {
			ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
			if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
				String responseBody = response.getBody();

				// Save/Update cache with 10-second expiration
				StockCache newCache = StockCache.builder()
						.cacheKey(cacheKey)
						.responseBody(responseBody)
						.expiredAt(LocalDateTime.now().plusSeconds(10))
						.build();
				stockCacheRepository.save(newCache);

				return responseBody;
			} else {
				throw new RuntimeException("Finnhub API returned status: " + response.getStatusCode());
			}
		} catch (Exception e) {
			log.error("Failed to fetch stock quote from Finnhub for " + symbol, e);
			// Fallback to expired cache if available
			if (optionalCache.isPresent()) {
				log.warn("Finnhub call failed. Falling back to expired cache for quote: {}", symbol);
				return optionalCache.get().getResponseBody();
			}
			throw new RuntimeException("주식 현재가 정보를 불러오는 중 오류가 발생했습니다: " + e.getMessage());
		}
	}
}
