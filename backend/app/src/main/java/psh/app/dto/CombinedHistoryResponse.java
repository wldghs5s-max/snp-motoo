package psh.app.dto;

import java.time.LocalDateTime;

public record CombinedHistoryResponse(
		String id,
		String type,           // "BUY", "SELL", "DEPOSIT", "WITHDRAW"
		String stockCode,      // e.g. "AAPL", "TSLA", or "예수금"
		String orderType,      // "LIMIT", "MIT", "MARKET", or "이체"
		Long quantity,         // e.g. quantity or null
		Long price,            // e.g. ordered price or null
		Long executedPrice,    // e.g. execution price or transaction amount
		String status,         // "FILLED", "PENDING", "CANCELLED"
		LocalDateTime createdAt
) {}
