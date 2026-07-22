package psh.app.dto;

import psh.app.domain.user.User;

public record UserResponse(
		String username,
		String nickname,
		String email,
		String bankCode,
		String bankName,
		String accountNumber,
		Long balance,
		String status
) {
	public static UserResponse from(User user) {
		return new UserResponse(
				user.getUsername(),
				user.getNickname(),
				user.getEmail(),
				user.getBankCode().name(),
				user.getBankCode().getDisplayName(),
				user.getAccountNumber(),
				user.getBalance(),
				user.getStatus().name()
		);
	}
}

