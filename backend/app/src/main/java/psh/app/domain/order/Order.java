package psh.app.domain.order;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import psh.app.domain.user.User;

@Entity
@Table(name = "orders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false, length = 10)
	private String stockCode;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private OrderSide type;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private OrderType orderType;

	@Column(nullable = false)
	private Long price;

	@Column(nullable = false)
	private Long quantity;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 15)
	private OrderStatus status;

	@Column(nullable = false)
	private LocalDateTime createdAt;

	@Column
	private Long executedPrice;

	@Builder
	public Order(User user, String stockCode, OrderSide type, OrderType orderType, Long price, Long quantity, OrderStatus status, LocalDateTime createdAt) {
		this.user = user;
		this.stockCode = stockCode;
		this.type = type;
		this.orderType = orderType;
		this.price = price;
		this.quantity = quantity;
		this.status = status;
		this.createdAt = createdAt;
	}

	public void fill(Long executedPrice) {
		this.status = OrderStatus.FILLED;
		this.executedPrice = executedPrice;
	}

	public void cancel() {
		this.status = OrderStatus.CANCELLED;
	}
}
