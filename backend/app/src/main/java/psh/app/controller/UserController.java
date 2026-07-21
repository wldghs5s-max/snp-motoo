package psh.app.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import psh.app.dto.TransactionRequest;
import psh.app.dto.UserResponse;
import psh.app.security.CustomUserDetails;
import psh.app.service.UserService;

@RestController
@RequestMapping("/api/user")
public class UserController {

	private final UserService userService;

	public UserController(UserService userService) {
		this.userService = userService;
	}

	@GetMapping("/me")
	public UserResponse getMe(@AuthenticationPrincipal CustomUserDetails userDetails) {
		return userService.getUserInfo(userDetails.getUsername());
	}

	@PostMapping("/deposit")
	public UserResponse deposit(
			@AuthenticationPrincipal CustomUserDetails userDetails,
			@Valid @RequestBody TransactionRequest request) {
		return userService.deposit(userDetails.getUsername(), request.amount());
	}

	@PostMapping("/withdraw")
	public UserResponse withdraw(
			@AuthenticationPrincipal CustomUserDetails userDetails,
			@Valid @RequestBody TransactionRequest request) {
		return userService.withdraw(userDetails.getUsername(), request.amount());
	}
}
