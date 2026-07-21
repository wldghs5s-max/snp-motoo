package psh.app.dto;

import psh.app.domain.user.User;

public record UserResponse(
		String username,
		Long balance
) {
	public static UserResponse from(User user) {
		return new UserResponse(user.getUsername(), user.getBalance());
	}
}
