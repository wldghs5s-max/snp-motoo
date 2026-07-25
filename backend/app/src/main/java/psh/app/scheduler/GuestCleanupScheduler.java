package psh.app.scheduler;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import psh.app.domain.user.User;
import psh.app.domain.user.UserRepository;
import psh.app.domain.transaction.TransactionRepository;
import psh.app.domain.order.OrderRepository;
import psh.app.domain.holding.HoldingRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class GuestCleanupScheduler {

	private final UserRepository userRepository;
	private final TransactionRepository transactionRepository;
	private final OrderRepository orderRepository;
	private final HoldingRepository holdingRepository;

	/**
	 * 매일 새벽 3시(KST 기준)에 생성된 지 7일이 지난 게스트 계정 및 연관 데이터를 영구 삭제합니다.
	 * cron: "0 0 3 * * *"
	 */
	@Scheduled(cron = "0 0 3 * * *", zone = "Asia/Seoul")
	@Transactional
	public void cleanupExpiredGuests() {
		log.info("Starting guest accounts cleanup job...");
		LocalDateTime limit = LocalDateTime.now().minusDays(7);

		List<User> users = userRepository.findAll();
		List<User> expiredGuests = users.stream()
				.filter(u -> u.isGuest() && u.getCreatedAt().isBefore(limit))
				.toList();

		if (expiredGuests.isEmpty()) {
			log.info("No expired guest accounts found to clean up.");
			return;
		}

		log.info("Found {} expired guest accounts. Commencing data deletion.", expiredGuests.size());

		for (User guest : expiredGuests) {
			try {
				// Delete associated holdings
				holdingRepository.deleteByUser(guest);
				// Delete associated orders
				orderRepository.deleteByUser(guest);
				// Delete associated transactions
				transactionRepository.deleteByUser(guest);
				// Delete user
				userRepository.delete(guest);
				log.info("Successfully deleted guest account: {}", guest.getUsername());
			} catch (Exception e) {
				log.error("Failed to delete guest account: {}", guest.getUsername(), e);
			}
		}

		log.info("Guest accounts cleanup job completed.");
	}
}
