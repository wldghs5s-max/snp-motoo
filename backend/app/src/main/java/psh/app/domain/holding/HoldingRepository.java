package psh.app.domain.holding;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import psh.app.domain.user.User;

public interface HoldingRepository extends JpaRepository<Holding, Long> {
	List<Holding> findByUser(User user);
	Optional<Holding> findByUserAndStockCode(User user, String stockCode);
}
