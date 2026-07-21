package psh.app.domain.holding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "holdings")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Holding {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false, length = 10)
	private String stockCode;

	@Column(nullable = false)
	private Long quantity;

	@Column(nullable = false)
	private Long averagePrice;

	@Builder
	public Holding(User user, String stockCode, Long quantity, Long averagePrice) {
		this.user = user;
		this.stockCode = stockCode;
		this.quantity = quantity;
		this.averagePrice = averagePrice;
	}

	public void update(Long quantity, Long averagePrice) {
		this.quantity = quantity;
		this.averagePrice = averagePrice;
	}
}
