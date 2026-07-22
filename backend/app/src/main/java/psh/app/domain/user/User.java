package psh.app.domain.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

	@Column(nullable = true, length = 50)
	private String nickname;

	@Column(nullable = true, length = 100)
	private String email;

	@Column(nullable = true)
	@Enumerated(EnumType.STRING)
	private BankCode bankCode;

	@Column(nullable = true, length = 30)
	private String accountNumber;

	@Column(nullable = false)
	private Long balance;

	@Column(nullable = true)
	@Enumerated(EnumType.STRING)
	private UserStatus status = UserStatus.ACTIVE;

	@Builder
	public User(String username, String password, String nickname, String email, BankCode bankCode, String accountNumber, Long balance) {
		this.username = username;
		this.password = password;
		this.nickname = nickname;
		this.email = email;
		this.bankCode = bankCode;
		this.accountNumber = accountNumber;
		this.balance = balance;
		this.status = UserStatus.ACTIVE;
	}

	public String getNickname() {
		return (nickname != null && !nickname.trim().isEmpty()) ? nickname : username;
	}

	public String getEmail() {
		return email != null ? email : "";
	}

	public BankCode getBankCode() {
		return bankCode != null ? bankCode : BankCode.KB;
	}

	public String getAccountNumber() {
		return (accountNumber != null && !accountNumber.trim().isEmpty()) ? accountNumber : "등록된 계좌 없음";
	}

	public UserStatus getStatus() {
		return status != null ? status : UserStatus.ACTIVE;
	}

	public void updateProfile(String nickname, BankCode bankCode, String accountNumber) {
		if (nickname != null && !nickname.trim().isEmpty()) {
			this.nickname = nickname;
		}
		if (bankCode != null) {
			this.bankCode = bankCode;
		}
		if (accountNumber != null && !accountNumber.trim().isEmpty()) {
			this.accountNumber = accountNumber;
		}
	}


	public void changePassword(String newPassword) {
		if (newPassword != null && !newPassword.trim().isEmpty()) {
			this.password = newPassword;
		}
	}

	public void withdraw() {
		this.status = UserStatus.WITHDRAWN;
	}

	public void reactivate() {
		this.status = UserStatus.ACTIVE;
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

