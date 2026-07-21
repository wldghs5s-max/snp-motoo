package psh.app.domain.order;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import psh.app.domain.user.User;

public interface OrderRepository extends JpaRepository<Order, Long> {
	List<Order> findByUserAndStatus(User user, OrderStatus status);
	List<Order> findByStockCodeAndStatus(String stockCode, OrderStatus status);
	List<Order> findByUserOrderByCreatedAtDesc(User user);
}
