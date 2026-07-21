package psh.app.dto;

import java.time.LocalDateTime;

import psh.app.domain.order.Order;
import psh.app.domain.order.OrderSide;
import psh.app.domain.order.OrderStatus;
import psh.app.domain.order.OrderType;

public record OrderResponse(
		Long id,
		String stockCode,
		OrderSide type,
		OrderType orderType,
		Long price,
		Long quantity,
		OrderStatus status,
		LocalDateTime createdAt,
		Long executedPrice
) {
	public static OrderResponse from(Order order) {
		return new OrderResponse(
				order.getId(),
				order.getStockCode(),
				order.getType(),
				order.getOrderType(),
				order.getPrice(),
				order.getQuantity(),
				order.getStatus(),
				order.getCreatedAt(),
				order.getExecutedPrice()
		);
	}
}
