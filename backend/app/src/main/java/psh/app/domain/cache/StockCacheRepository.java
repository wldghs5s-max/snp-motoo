package psh.app.domain.cache;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StockCacheRepository extends JpaRepository<StockCache, String> {
}
