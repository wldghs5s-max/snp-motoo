package psh.app.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import psh.app.dto.HoldingResponse;
import psh.app.dto.OrderRequest;
import psh.app.dto.OrderResponse;
import psh.app.dto.StockTickRequest;
import psh.app.dto.UserRankingResponse;
import psh.app.dto.CombinedHistoryResponse;
import psh.app.security.CustomUserDetails;
import psh.app.service.TradingService;

@RestController
@RequestMapping("/api/trading")
public class TradingController {

	private final TradingService tradingService;

	public TradingController(TradingService tradingService) {
		this.tradingService = tradingService;
	}

	@PostMapping("/tick/{stockCode}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void pushTick(
			@PathVariable String stockCode,
			@Valid @RequestBody StockTickRequest request) {
		tradingService.updatePriceAndMatch(stockCode, request.price());
	}

	@PostMapping("/order")
	public OrderResponse placeOrder(
			@AuthenticationPrincipal CustomUserDetails userDetails,
			@Valid @RequestBody OrderRequest request) {
		return tradingService.placeOrder(userDetails.getUsername(), request);
	}

	@DeleteMapping("/order/{orderId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void cancelOrder(
			@AuthenticationPrincipal CustomUserDetails userDetails,
			@PathVariable Long orderId) {
		tradingService.cancelOrder(userDetails.getUsername(), orderId);
	}

	@GetMapping("/orders/pending")
	public List<OrderResponse> getPendingOrders(
			@AuthenticationPrincipal CustomUserDetails userDetails) {
		return tradingService.getPendingOrders(userDetails.getUsername());
	}

	@GetMapping("/history")
	public List<CombinedHistoryResponse> getOrderHistory(
			@AuthenticationPrincipal CustomUserDetails userDetails) {
		return tradingService.getOrderHistory(userDetails.getUsername());
	}

	@GetMapping("/rankings")
	public List<UserRankingResponse> getRankings() {
		return tradingService.getRankings();
	}

	@GetMapping("/holdings")
	public List<HoldingResponse> getHoldings(
			@AuthenticationPrincipal CustomUserDetails userDetails) {
		return tradingService.getHoldings(userDetails.getUsername());
	}
}
