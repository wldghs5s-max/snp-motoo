package psh.app.domain.cache;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "stock_caches")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StockCache {

	@Id
	@Column(length = 255)
	private String cacheKey; // e.g. "candles-AAPL-5-171822-171899" or "quote-TSLA"

	@Lob
	@Column(columnDefinition = "TEXT", nullable = false)
	private String responseBody;

	@Column(nullable = false)
	private LocalDateTime expiredAt;

	@Builder
	public StockCache(String cacheKey, String responseBody, LocalDateTime expiredAt) {
		this.cacheKey = cacheKey;
		this.responseBody = responseBody;
		this.expiredAt = expiredAt;
	}

	public boolean isExpired() {
		return LocalDateTime.now().isAfter(this.expiredAt);
	}
}
