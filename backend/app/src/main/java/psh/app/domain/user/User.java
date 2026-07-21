package psh.app.domain.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 20)
	private String username;

	@Column(nullable = false)
	private String password;

	@Column(nullable = false)
	private Long balance;

	@Builder
	public User(String username, String password, Long balance) {
		this.username = username;
		this.password = password;
		this.balance = balance;
	}

	public void deposit(Long amount) {
		if (amount == null || amount <= 0) {
			throw new IllegalArgumentException("입금 금액은 0원보다 커야 합니다.");
		}
		this.balance += amount;
	}

	public void withdraw(Long amount) {
		if (amount == null || amount <= 0) {
			throw new IllegalArgumentException("출금 금액은 0원보다 커야 합니다.");
		}
		if (this.balance < amount) {
			throw new IllegalStateException("잔액이 부족합니다.");
		}
		this.balance -= amount;
	}
}
