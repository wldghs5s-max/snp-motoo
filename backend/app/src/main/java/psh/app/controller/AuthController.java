package psh.app.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import psh.app.dto.AuthResponse;
import psh.app.dto.LoginRequest;
import psh.app.dto.SignupRequest;
import psh.app.dto.FindIdRequest;
import psh.app.dto.ResetPasswordRequest;
import psh.app.dto.ResetPasswordConfirmRequest;
import psh.app.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/signup")
	@ResponseStatus(HttpStatus.CREATED)
	public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
		return authService.signup(request);
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody LoginRequest request) {
		return authService.login(request);
	}

	@PostMapping("/find-id")
	public Map<String, String> findId(@Valid @RequestBody FindIdRequest request) {
		return authService.findIdByEmail(request);
	}

	@PostMapping("/reset-password/request")
	public Map<String, String> requestReset(@Valid @RequestBody ResetPasswordRequest request) {
		return authService.requestPasswordReset(request);
	}

	@PostMapping("/reset-password/confirm")
	public Map<String, String> confirmReset(@Valid @RequestBody ResetPasswordConfirmRequest request) {
		return authService.resetPassword(request);
	}

	@PostMapping("/reactivate")
	public AuthResponse reactivate(@Valid @RequestBody LoginRequest request) {
		return authService.reactivateAccount(request);
	}
}

