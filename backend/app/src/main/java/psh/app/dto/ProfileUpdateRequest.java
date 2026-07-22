package psh.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import psh.app.domain.user.BankCode;

public record ProfileUpdateRequest(
		@NotBlank(message = "닉네임을 입력해 주세요.")
		@Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하로 입력해 주세요.")
		String nickname,

		@NotNull(message = "은행을 선택해 주세요.")
		BankCode bankCode,

		@NotBlank(message = "계좌번호를 입력해 주세요.")
		@Size(min = 8, max = 30, message = "계좌번호를 올바르게 입력해 주세요.")
		String accountNumber
) {}
