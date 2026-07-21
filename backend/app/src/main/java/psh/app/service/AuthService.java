package psh.app.service;

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
import psh.app.domain.transaction.Transaction;
import psh.app.domain.transaction.TransactionType;
import psh.app.domain.transaction.TransactionRepository;
import psh.app.dto.AuthResponse;
import psh.app.dto.LoginRequest;
import psh.app.dto.SignupRequest;
import psh.app.security.JwtTokenProvider;

@Service
public class AuthService {

	private static final long INITIAL_BALANCE = 10_000_000L;

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;
	private final JwtTokenProvider jwtTokenProvider;
	private final TransactionRepository transactionRepository;

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

		User user = User.builder()
				.username(request.username())
				.password(passwordEncoder.encode(request.password()))
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
		Authentication authentication = authenticationManager.authenticate(
				new UsernamePasswordAuthenticationToken(request.username(), request.password()));

		String accessToken = jwtTokenProvider.generateToken(authentication);
		User user = userRepository.findByUsername(authentication.getName())
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자를 찾을 수 없습니다."));

		return AuthResponse.of(accessToken, user);
	}
}
