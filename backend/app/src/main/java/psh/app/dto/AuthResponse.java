package psh.app.dto;

import psh.app.domain.user.User;

public record AuthResponse(
		String accessToken,
		String tokenType,
		String username,
		String nickname,
		String email,
		String bankCode,
		String bankName,
		String accountNumber,
		Long balance) {

	public static AuthResponse of(String accessToken, User user) {
		return new AuthResponse(
				accessToken,
				"Bearer",
				user.getUsername(),
				user.getNickname(),
				user.getEmail(),
				user.getBankCode().name(),
				user.getBankCode().getDisplayName(),
				user.getAccountNumber(),
				user.getBalance()
		);
	}
}

