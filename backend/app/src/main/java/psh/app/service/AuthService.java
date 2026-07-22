package psh.app.service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import psh.app.domain.user.User;
import psh.app.domain.user.UserRepository;
import psh.app.domain.user.UserStatus;
import psh.app.domain.transaction.Transaction;
import psh.app.domain.transaction.TransactionType;
import psh.app.domain.transaction.TransactionRepository;
import psh.app.dto.AuthResponse;
import psh.app.dto.LoginRequest;
import psh.app.dto.SignupRequest;
import psh.app.dto.FindIdRequest;
import psh.app.dto.ResetPasswordRequest;
import psh.app.dto.ResetPasswordConfirmRequest;
import psh.app.security.JwtTokenProvider;

@Service
public class AuthService {

	private static final long INITIAL_BALANCE = 10_000_000L;

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;
	private final JwtTokenProvider jwtTokenProvider;
	private final TransactionRepository transactionRepository;

	// In-memory cache for mock verification codes (Expires in 5 minutes)
	private final Map<String, ResetCodeInfo> resetCodes = new ConcurrentHashMap<>();

	private static class ResetCodeInfo {
		final String code;
		final LocalDateTime expiry;

		ResetCodeInfo(String code, LocalDateTime expiry) {
			this.code = code;
			this.expiry = expiry;
		}

		boolean isExpired() {
			return LocalDateTime.now().isAfter(expiry);
		}
	}

	public AuthService(
			UserRepository userRepository,
			PasswordEncoder passwordEncoder,
			AuthenticationManager authenticationManager,
			JwtTokenProvider jwtTokenProvider,
			TransactionRepository transactionRepository) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
		this.jwtTokenProvider = jwtTokenProvider;
		this.transactionRepository = transactionRepository;
	}

	@Transactional
	public AuthResponse signup(SignupRequest request) {
		if (userRepository.existsByUsername(request.username())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다.");
		}
		if (userRepository.existsByEmail(request.email())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록된 이메일입니다.");
		}
		if (userRepository.existsByNickname(request.nickname())) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다.");
		}

		User user = User.builder()
				.username(request.username())
				.password(passwordEncoder.encode(request.password()))
				.nickname(request.nickname())
				.email(request.email())
				.bankCode(request.bankCode())
				.accountNumber(request.accountNumber())
				.balance(INITIAL_BALANCE)
				.build();

		User savedUser = userRepository.save(user);

		// Record initial deposit of seed money
		Transaction initDeposit = Transaction.builder()
				.user(savedUser)
				.type(TransactionType.DEPOSIT)
				.amount(INITIAL_BALANCE)
				.build();
		transactionRepository.save(initDeposit);

		String accessToken = jwtTokenProvider.generateToken(savedUser.getUsername());
		return AuthResponse.of(accessToken, savedUser);
	}

	@Transactional(readOnly = true)
	public AuthResponse login(LoginRequest request) {
		// Authenticate first using Spring Security
		Authentication authentication = authenticationManager.authenticate(
				new UsernamePasswordAuthenticationToken(request.username(), request.password()));

		User user = userRepository.findByUsername(authentication.getName())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자를 찾을 수 없습니다."));

		// Check soft deletion status
		if (user.getStatus() == UserStatus.WITHDRAWN) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ACCOUNT_WITHDRAWN");
		}

		String accessToken = jwtTokenProvider.generateToken(authentication);
		return AuthResponse.of(accessToken, user);
	}

	@Transactional(readOnly = true)
	public Map<String, String> findIdByEmail(FindIdRequest request) {
		User user = userRepository.findByEmail(request.email())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 이메일로 가입된 회원이 없습니다."));

		if (user.getStatus() == UserStatus.WITHDRAWN) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "탈퇴된 회원 계정입니다.");
		}

		return Map.of("username", user.getUsername());
	}

	public Map<String, String> requestPasswordReset(ResetPasswordRequest request) {
		User user = userRepository.findByUsernameAndEmail(request.username(), request.email())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "아이디 또는 이메일 정보가 일치하지 않습니다."));

		if (user.getStatus() == UserStatus.WITHDRAWN) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "탈퇴된 회원 계정입니다.");
		}

		// Generate random 6 digit verification code
		String code = String.format("%06d", new Random().nextInt(1000000));
		String cacheKey = request.username() + "#" + request.email();
		resetCodes.put(cacheKey, new ResetCodeInfo(code, LocalDateTime.now().plusMinutes(5)));

		// Return verification code directly for mock testing and evaluation on frontend
		return Map.of(
			"message", "인증번호가 생성되었습니다.",
			"verificationCode", code
		);
	}

	@Transactional
	public Map<String, String> resetPassword(ResetPasswordConfirmRequest request) {
		String cacheKey = request.username() + "#" + request.email();
		ResetCodeInfo codeInfo = resetCodes.get(cacheKey);

		if (codeInfo == null || codeInfo.isExpired() || !codeInfo.code.equals(request.code())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "인증번호가 올바르지 않거나 만료되었습니다.");
		}

		User user = userRepository.findByUsernameAndEmail(request.username(), request.email())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));

		user.changePassword(passwordEncoder.encode(request.newPassword()));
		userRepository.save(user);

		resetCodes.remove(cacheKey);

		return Map.of("message", "비밀번호가 성공적으로 변경되었습니다.");
	}

	@Transactional
	public AuthResponse reactivateAccount(LoginRequest request) {
		// Verify credentials using AuthenticationManager
		Authentication authentication = authenticationManager.authenticate(
				new UsernamePasswordAuthenticationToken(request.username(), request.password()));

		User user = userRepository.findByUsername(authentication.getName())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자를 찾을 수 없습니다."));

		if (user.getStatus() != UserStatus.WITHDRAWN) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 활성화된 계정입니다.");
		}

		user.reactivate();
		userRepository.save(user);

		String accessToken = jwtTokenProvider.generateToken(authentication);
		return AuthResponse.of(accessToken, user);
	}
}

