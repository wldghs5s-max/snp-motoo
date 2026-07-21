package psh.app.service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class KakaoPayService {

	@Value("${kakaopay.secret-key}")
	private String secretKey;

	@Value("${kakaopay.cid}")
	private String cid;

	private final RestTemplate restTemplate = new RestTemplate();

	// Store pending payment transactions (Stateless cache)
	public static record PendingPayment(String tid, String username, long amount) {}
	private final ConcurrentHashMap<String, PendingPayment> pendingPayments = new ConcurrentHashMap<>();

	/**
	 * Initiate KakaoPay Payment (Ready) - Legacy API using Form URL-encoded
	 */
	public Map<String, Object> ready(String username, long amount) {
		String orderId = UUID.randomUUID().toString();
		
		HttpHeaders headers = new HttpHeaders();
		// Legacy Kakao Developers Auth header format: KakaoAK [ADMIN_KEY]
		headers.set("Authorization", "KakaoAK " + secretKey);
		headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

		MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
		body.add("cid", cid);
		body.add("partner_order_id", orderId);
		body.add("partner_user_id", username);
		body.add("item_name", "예수금 충전");
		body.add("quantity", "1");
		body.add("total_amount", String.valueOf(amount));
		body.add("tax_free_amount", "0");
		body.add("approval_url", "http://localhost:8080/api/payment/success?orderId=" + orderId);
		body.add("cancel_url", "http://localhost:8080/api/payment/cancel?orderId=" + orderId);
		body.add("fail_url", "http://localhost:8080/api/payment/fail?orderId=" + orderId);

		HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(body, headers);
		
		try {
			ResponseEntity<Map> response = restTemplate.postForEntity(
				"https://kapi.kakao.com/v1/payment/ready",
				entity,
				Map.class
			);

			if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
				Map<String, Object> resBody = response.getBody();
				String tid = (String) resBody.get("tid");
				String nextRedirectPcUrl = (String) resBody.get("next_redirect_pc_url");

				// Cache transaction ID & details
				pendingPayments.put(orderId, new PendingPayment(tid, username, amount));
				log.info("KakaoPay Legacy Ready success for user: {}, tid: {}, orderId: {}", username, tid, orderId);

				return Map.of("next_redirect_pc_url", nextRedirectPcUrl);
			} else {
				throw new RuntimeException("KakaoPay API ready failed with response: " + response.getBody());
			}
		} catch (Exception e) {
			log.error("KakaoPay Ready exception", e);
			throw new RuntimeException("카카오페이 결제 준비 중 오류가 발생했습니다: " + e.getMessage());
		}
	}

	/**
	 * Approve KakaoPay Payment - Legacy API using Form URL-encoded
	 */
	public PendingPayment approve(String orderId, String pgToken) {
		PendingPayment pending = pendingPayments.remove(orderId);
		if (pending == null) {
			log.error("Pending payment transaction not found for orderId: {}", orderId);
			throw new IllegalArgumentException("결제 대기 내역을 찾을 수 없거나 만료되었습니다.");
		}

		HttpHeaders headers = new HttpHeaders();
		headers.set("Authorization", "KakaoAK " + secretKey);
		headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

		MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
		body.add("cid", cid);
		body.add("tid", pending.tid());
		body.add("partner_order_id", orderId);
		body.add("partner_user_id", pending.username());
		body.add("pg_token", pgToken);

		HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(body, headers);

		try {
			ResponseEntity<Map> response = restTemplate.postForEntity(
				"https://kapi.kakao.com/v1/payment/approve",
				entity,
				Map.class
			);

			if (response.getStatusCode().is2xxSuccessful()) {
				log.info("KakaoPay Legacy Approve success for orderId: {}, user: {}, amount: {}", orderId, pending.username(), pending.amount());
				return pending;
			} else {
				throw new RuntimeException("KakaoPay Approve API failed with response: " + response.getBody());
			}
		} catch (Exception e) {
			log.error("KakaoPay Approve exception for orderId: " + orderId, e);
			throw new RuntimeException("카카오페이 결제 승인 중 오류가 발생했습니다: " + e.getMessage());
		}
	}
}
