package psh.app.dto;

import psh.app.domain.holding.Holding;

public record HoldingResponse(
		Long id,
		String stockCode,
		Long quantity,
		Long averagePrice
) {
	public static HoldingResponse from(Holding holding) {
		return new HoldingResponse(
				holding.getId(),
				holding.getStockCode(),
				holding.getQuantity(),
				holding.getAveragePrice()
		);
	}
}
