package psh.app.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import psh.app.domain.holding.Holding;
import psh.app.domain.holding.HoldingRepository;
import psh.app.domain.order.Order;
import psh.app.domain.order.OrderRepository;
import psh.app.domain.order.OrderSide;
import psh.app.domain.order.OrderStatus;
import psh.app.domain.order.OrderType;
import psh.app.domain.user.User;
import psh.app.domain.user.UserRepository;
import psh.app.domain.transaction.Transaction;
import psh.app.domain.transaction.TransactionType;
import psh.app.domain.transaction.TransactionRepository;
import psh.app.dto.HoldingResponse;
import psh.app.dto.OrderRequest;
import psh.app.dto.OrderResponse;
import psh.app.dto.UserRankingResponse;
import psh.app.dto.CombinedHistoryResponse;

@lombok.extern.slf4j.Slf4j
@Service
public class TradingService {

	private final OrderRepository orderRepository;
	private final HoldingRepository holdingRepository;
	private final UserRepository userRepository;
	private final TransactionRepository transactionRepository;

	// In-memory cache for live stock prices pushed from front-end
	private final ConcurrentHashMap<String, Long> priceMap = new ConcurrentHashMap<>();

	public TradingService(
			OrderRepository orderRepository,
			HoldingRepository holdingRepository,
			UserRepository userRepository,
			TransactionRepository transactionRepository) {
		this.orderRepository = orderRepository;
		this.holdingRepository = holdingRepository;
		this.userRepository = userRepository;
		this.transactionRepository = transactionRepository;
	}

	@Transactional
	public void updatePriceAndMatch(String stockCode, Long price) {
		priceMap.put(stockCode, price);

		// Find pending orders for this stock
		List<Order> pendingOrders = orderRepository.findByStockCodeAndStatus(stockCode, OrderStatus.PENDING);

		for (Order order : pendingOrders) {
			boolean shouldExecute = false;

			if (order.getOrderType() == OrderType.LIMIT) {
				if (order.getType() == OrderSide.BUY && price <= order.getPrice()) {
					shouldExecute = true;
				} else if (order.getType() == OrderSide.SELL && price >= order.getPrice()) {
					shouldExecute = true;
				}
			} else if (order.getOrderType() == OrderType.MIT) {
				// MIT: Triggered when price touches the trigger price (stored in order.price)
				// For simplicity, BUY MIT triggers when price hits or exceeds target trigger
				// SELL MIT triggers when price falls to or below target trigger
				if (order.getType() == OrderSide.BUY && price >= order.getPrice()) {
					shouldExecute = true;
				} else if (order.getType() == OrderSide.SELL && price <= order.getPrice()) {
					shouldExecute = true;
				}
			}

			if (shouldExecute) {
				try {
					executeOrder(order, price);
				} catch (Exception e) {
					// Cancel order if execution failed (e.g. balance changed and is insufficient now)
					order.cancel();
					orderRepository.save(order);
				}
			}
		}
	}

	@Transactional
	public OrderResponse placeOrder(String username, OrderRequest request) {
		User user = userRepository.findByUsername(username)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));

		Order order = Order.builder()
				.user(user)
				.stockCode(request.stockCode())
				.type(request.type())
				.orderType(request.orderType())
				.price(request.price())
				.quantity(request.quantity())
				.status(OrderStatus.PENDING)
				.createdAt(LocalDateTime.now())
				.build();

		if (request.orderType() == OrderType.MARKET) {
			Long currentPrice = priceMap.get(request.stockCode());
			if (currentPrice == null) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "시세 정보가 아직 연동되지 않았습니다. 잠시 후 다시 시도해 주세요.");
			}
			executeOrder(order, currentPrice);
		} else {
			// Validation check for LIMIT/MIT orders at the time of entry
			if (request.type() == OrderSide.BUY) {
				long totalCost = request.price() * request.quantity();
				if (user.getBalance() < totalCost) {
					throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "예수금이 부족하여 주문할 수 없습니다.");
				}
			} else {
				Holding holding = holdingRepository.findByUserAndStockCode(user, request.stockCode())
						.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "해당 주식을 보유하고 있지 않습니다."));
				if (holding.getQuantity() < request.quantity()) {
					throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "보유 주식 수량이 주문 수량보다 적습니다.");
				}
			}
			orderRepository.save(order);
		}

		return OrderResponse.from(order);
	}

	@Transactional
	public void cancelOrder(String username, Long orderId) {
		Order order = orderRepository.findById(orderId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "주문을 찾을 수 없습니다."));

		if (!order.getUser().getUsername().equals(username)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인의 주문만 취소할 수 있습니다.");
		}

		if (order.getStatus() != OrderStatus.PENDING) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "대기 상태의 주문만 취소할 수 있습니다.");
		}

		order.cancel();
		orderRepository.save(order);
	}

	@Transactional(readOnly = true)
	public List<OrderResponse> getPendingOrders(String username) {
		User user = userRepository.findByUsername(username)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));

		return orderRepository.findByUserAndStatus(user, OrderStatus.PENDING).stream()
				.map(OrderResponse::from)
				.collect(Collectors.toList());
	}

	@Transactional(readOnly = true)
	public List<HoldingResponse> getHoldings(String username) {
		User user = userRepository.findByUsername(username)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));

		return holdingRepository.findByUser(user).stream()
				.map(HoldingResponse::from)
				.collect(Collectors.toList());
	}

	@Transactional
	public List<CombinedHistoryResponse> getOrderHistory(String username) {
		User user = userRepository.findByUsername(username)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));

		// Self-healing: ensure initial seed transaction of 10,000,000 KRW exists for this user
		List<Transaction> existingTxs = transactionRepository.findByUser(user);
		boolean hasSeed = existingTxs.stream()
				.anyMatch(t -> t.getType() == TransactionType.DEPOSIT && t.getAmount() == 10_000_000L);
		if (!hasSeed) {
			Transaction initDeposit = Transaction.builder()
					.user(user)
					.type(TransactionType.DEPOSIT)
					.amount(10_000_000L)
					.build();
			transactionRepository.save(initDeposit);
		}

		// 1. Get orders mapped to CombinedHistoryResponse
		List<CombinedHistoryResponse> orders = orderRepository.findByUserOrderByCreatedAtDesc(user).stream()
				.map(o -> new CombinedHistoryResponse(
						"order-" + o.getId(),
						o.getType().name(),
						o.getStockCode(),
						o.getOrderType().name(),
						o.getQuantity(),
						o.getPrice(),
						o.getExecutedPrice(),
						o.getStatus().name(),
						o.getCreatedAt()
				))
				.collect(Collectors.toList());

		// 2. Get transactions (deposits/withdrawals) mapped to CombinedHistoryResponse
		List<CombinedHistoryResponse> txs = transactionRepository.findByUserOrderByCreatedAtDesc(user).stream()
				.map(t -> new CombinedHistoryResponse(
						"tx-" + t.getId(),
						t.getType().name(), // "DEPOSIT" or "WITHDRAW"
						"예수금",
						"이체",
						null,
						null,
						t.getAmount(),
						"FILLED",
						t.getCreatedAt()
				))
				.collect(Collectors.toList());

		// 3. Merge and sort descending by createdAt
		List<CombinedHistoryResponse> combined = new java.util.ArrayList<>();
		combined.addAll(orders);
		combined.addAll(txs);
		combined.sort((a, b) -> b.createdAt().compareTo(a.createdAt()));

		return combined;
	}

	@Transactional
	public List<UserRankingResponse> getRankings() {
		List<User> users = userRepository.findAll();

		// Self-healing: ensure initial seed transaction exists for all users
		for (User user : users) {
			List<Transaction> existingTxs = transactionRepository.findByUser(user);
			boolean hasSeed = existingTxs.stream()
					.anyMatch(t -> t.getType() == TransactionType.DEPOSIT && t.getAmount() == 10_000_000L);
			if (!hasSeed) {
				Transaction initDeposit = Transaction.builder()
						.user(user)
						.type(TransactionType.DEPOSIT)
						.amount(10_000_000L)
						.build();
				transactionRepository.save(initDeposit);
			}
		}

		List<UserRankingResponse> list = users.stream()
				.map(user -> {
					long cash = user.getBalance();
					List<Holding> holdings = holdingRepository.findByUser(user);
					long holdingsValue = holdings.stream()
							.mapToLong(h -> h.getQuantity() * priceMap.getOrDefault(h.getStockCode(), h.getAveragePrice()))
							.sum();
					long totalAssets = cash + holdingsValue;

					// Compute true net invested capital
					List<Transaction> transactions = transactionRepository.findByUser(user);
					long totalDeposited = transactions.stream()
							.filter(t -> t.getType() == TransactionType.DEPOSIT)
							.mapToLong(Transaction::getAmount)
							.sum();
					long totalWithdrawn = transactions.stream()
							.filter(t -> t.getType() == TransactionType.WITHDRAW)
							.mapToLong(Transaction::getAmount)
							.sum();
					long netInvested = totalDeposited - totalWithdrawn;
					if (netInvested <= 0) {
						netInvested = 10_000_000L; // Fallback seed capital
					}

					double returnRate = ((double) (totalAssets - netInvested) / netInvested) * 100.0;

					return new UserRankingResponse(0, user.getUsername(), cash, totalAssets, returnRate);
				})
				.sorted((a, b) -> b.totalAssets().compareTo(a.totalAssets()))
				.collect(Collectors.toList());

		// Assign ranks
		for (int i = 0; i < list.size(); i++) {
			UserRankingResponse r = list.get(i);
			list.set(i, new UserRankingResponse(i + 1, r.username(), r.balance(), r.totalAssets(), r.returnRate()));
		}

		return list;
	}

	@Transactional
	private void executeOrder(Order order, Long executionPrice) {
		User proxyUser = order.getUser();
		User user = userRepository.findById(proxyUser.getId())
				.orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
		long totalCost = executionPrice * order.getQuantity();

		if (order.getType() == OrderSide.BUY) {
			if (user.getBalance() < totalCost) {
				throw new IllegalStateException("예수금이 부족합니다.");
			}
			user.withdraw(totalCost);
			userRepository.save(user);

			Optional<Holding> optionalHolding = holdingRepository.findByUserAndStockCode(user, order.getStockCode());
			if (optionalHolding.isPresent()) {
				Holding holding = optionalHolding.get();
				long newQuantity = holding.getQuantity() + order.getQuantity();
				long newAveragePrice = ((holding.getAveragePrice() * holding.getQuantity()) + totalCost) / newQuantity;
				holding.update(newQuantity, newAveragePrice);
				holdingRepository.save(holding);
			} else {
				Holding holding = Holding.builder()
						.user(user)
						.stockCode(order.getStockCode())
						.quantity(order.getQuantity())
						.averagePrice(executionPrice)
						.build();
				holdingRepository.save(holding);
			}
		} else {
			// SELL order
			Holding holding = holdingRepository.findByUserAndStockCode(user, order.getStockCode())
					.orElseThrow(() -> new IllegalStateException("보유 주식이 없습니다."));

			if (holding.getQuantity() < order.getQuantity()) {
				throw new IllegalStateException("보유 주식이 부족합니다.");
			}

			user.deposit(totalCost);
			userRepository.save(user);

			long newQuantity = holding.getQuantity() - order.getQuantity();
			if (newQuantity == 0) {
				holdingRepository.delete(holding);
			} else {
				holding.update(newQuantity, holding.getAveragePrice());
				holdingRepository.save(holding);
			}
		}

		order.fill(executionPrice);
		orderRepository.save(order);

		// Push real-time WebSocket notification
		try {
			String sideKo = order.getType() == OrderSide.BUY ? "매수" : "매도";
			String formattedPrice = String.format("%,d", executionPrice);
			String messageJson = String.format(
				"{\"type\":\"ORDER_FILLED\",\"id\":\"%s\",\"stockCode\":\"%s\",\"side\":\"%s\",\"quantity\":%d,\"price\":%d,\"message\":\"[%s] %d주가 %s원에 %s 체결 완료되었습니다!\"}",
				"order-" + order.getId(),
				order.getStockCode(),
				order.getType().name(),
				order.getQuantity(),
				executionPrice,
				order.getStockCode(),
				order.getQuantity(),
				formattedPrice,
				sideKo
			);
			psh.app.websocket.NotificationWebSocketHandler.sendNotification(user.getUsername(), messageJson);
		} catch (Exception e) {
			log.error("Failed to push websocket notification", e);
		}
	}
}
