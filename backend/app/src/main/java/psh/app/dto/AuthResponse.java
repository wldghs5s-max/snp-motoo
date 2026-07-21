package psh.app.dto;

import psh.app.domain.user.User;

public record AuthResponse(
		String accessToken,
		String tokenType,
		String username,
		Long balance) {

	public static AuthResponse of(String accessToken, User user) {
		return new AuthResponse(accessToken, "Bearer", user.getUsername(), user.getBalance());
	}
}
