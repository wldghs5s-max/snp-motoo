package psh.app.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import psh.app.domain.user.User;
import psh.app.domain.user.UserRepository;
import psh.app.domain.transaction.Transaction;
import psh.app.domain.transaction.TransactionType;
import psh.app.domain.transaction.TransactionRepository;
import psh.app.dto.UserResponse;

@Service
public class UserService {

	private final UserRepository userRepository;
	private final TransactionRepository transactionRepository;

	public UserService(UserRepository userRepository, TransactionRepository transactionRepository) {
		this.userRepository = userRepository;
		this.transactionRepository = transactionRepository;
	}

	@Transactional(readOnly = true)
	public UserResponse getUserInfo(String username) {
		User user = userRepository.findByUsername(username)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
		return UserResponse.from(user);
	}

	@Transactional
	public UserResponse deposit(String username, Long amount) {
		User user = userRepository.findByUsername(username)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
		try {
			user.deposit(amount);
			Transaction transaction = Transaction.builder()
					.user(user)
					.type(TransactionType.DEPOSIT)
					.amount(amount)
					.build();
			transactionRepository.save(transaction);
		}
		catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
		}
		return UserResponse.from(user);
	}

	@Transactional
	public UserResponse withdraw(String username, Long amount) {
		User user = userRepository.findByUsername(username)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));
		try {
			user.withdraw(amount);
			Transaction transaction = Transaction.builder()
					.user(user)
					.type(TransactionType.WITHDRAW)
					.amount(amount)
					.build();
			transactionRepository.save(transaction);
		}
		catch (IllegalArgumentException | IllegalStateException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
		}
		return UserResponse.from(user);
	}
}
