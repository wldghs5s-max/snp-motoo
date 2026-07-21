package psh.app.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record TransactionRequest(
		@NotNull(message = "금액은 필수 입력값입니다.")
		@Positive(message = "금액은 0원보다 커야 합니다.")
		Long amount
) {}
