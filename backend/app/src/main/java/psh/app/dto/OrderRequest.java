package psh.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import psh.app.domain.order.OrderSide;
import psh.app.domain.order.OrderType;

public record OrderRequest(
		@NotBlank(message = "종목코드는 필수입니다.")
		String stockCode,

		@NotNull(message = "매수/매도 구분은 필수입니다.")
		OrderSide type,

		@NotNull(message = "주문 타입은 필수입니다.")
		OrderType orderType,

		@NotNull(message = "가격은 필수입니다.")
		@Positive(message = "가격은 0원보다 커야 합니다.")
		Long price,

		@NotNull(message = "수량은 필수입니다.")
		@Positive(message = "수량은 0보다 커야 합니다.")
		Long quantity
) {}
