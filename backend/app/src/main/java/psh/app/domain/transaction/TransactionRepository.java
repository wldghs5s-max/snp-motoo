package psh.app.domain.transaction;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import psh.app.domain.user.User;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
	List<Transaction> findByUser(User user);
	List<Transaction> findByUserOrderByCreatedAtDesc(User user);
}
