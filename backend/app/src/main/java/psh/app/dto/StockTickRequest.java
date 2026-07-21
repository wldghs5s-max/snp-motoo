package psh.app.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record StockTickRequest(
		@NotNull(message = "시세는 필수입니다.")
		@Positive(message = "시세는 0보다 커야 합니다.")
		Long price
) {}
