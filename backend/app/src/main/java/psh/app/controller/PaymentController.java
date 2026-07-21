package psh.app.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.view.RedirectView;

import psh.app.security.CustomUserDetails;
import psh.app.service.KakaoPayService;
import psh.app.service.UserService;

@Controller
@RequestMapping("/api/payment")
public class PaymentController {

	private final KakaoPayService kakaoPayService;
	private final UserService userService;

	public PaymentController(KakaoPayService kakaoPayService, UserService userService) {
		this.kakaoPayService = kakaoPayService;
		this.userService = userService;
	}

	/**
	 * 결제 준비 요청 (Ready API)
	 * POST /api/payment/ready
	 */
	@PostMapping("/ready")
	@ResponseBody
	public Map<String, Object> ready(
			@AuthenticationPrincipal CustomUserDetails userDetails,
			@RequestBody Map<String, Object> request) {
		
		String username = userDetails.getUsername();
		long amount = ((Number) request.get("amount")).longValue();

		return kakaoPayService.ready(username, amount);
	}

	/**
	 * 결제 성공 콜백
	 * GET /api/payment/success
	 */
	@GetMapping("/success")
	public RedirectView success(
			@RequestParam("orderId") String orderId,
			@RequestParam("pg_token") String pgToken) {
		try {
			// Approve API call
			KakaoPayService.PendingPayment pending = kakaoPayService.approve(orderId, pgToken);
			
			// Deposit the amount into the user's account (this automatically logs DEPOSIT transaction in DB)
			userService.deposit(pending.username(), pending.amount());

			// Push WebSocket Notification
			try {
				String formattedPrice = String.format("%,d", pending.amount());
				String messageJson = String.format(
					"{\"type\":\"ORDER_FILLED\",\"id\":\"%s\",\"stockCode\":\"%s\",\"side\":\"%s\",\"quantity\":null,\"price\":null,\"message\":\"카카오페이 결제로 예수금 %s원이 성공적으로 충전 완료되었습니다!\"}",
					"tx-" + System.currentTimeMillis(),
					"예수금",
					"DEPOSIT",
					formattedPrice
				);
				psh.app.websocket.NotificationWebSocketHandler.sendNotification(pending.username(), messageJson);
			} catch (Exception wsEx) {
				// Fail-safe
			}

			return new RedirectView("http://localhost:5173/holdings?payment=success");
		} catch (Exception e) {
			return new RedirectView("http://localhost:5173/holdings?payment=fail");
		}
	}

	/**
	 * 결제 취소 콜백
	 * GET /api/payment/cancel
	 */
	@GetMapping("/cancel")
	public RedirectView cancel(@RequestParam("orderId") String orderId) {
		return new RedirectView("http://localhost:5173/holdings?payment=cancel");
	}

	/**
	 * 결제 실패 콜백
	 * GET /api/payment/fail
	 */
	@GetMapping("/fail")
	public RedirectView fail(@RequestParam("orderId") String orderId) {
		return new RedirectView("http://localhost:5173/holdings?payment=fail");
	}
}
