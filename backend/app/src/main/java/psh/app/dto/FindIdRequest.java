package psh.app.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record FindIdRequest(
		@NotBlank(message = "이메일을 입력해 주세요.")
		@Email(message = "유효한 이메일 형식이 아닙니다.")
		String email
) {}
