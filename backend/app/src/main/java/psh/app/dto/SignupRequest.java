package psh.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
		@NotBlank(message = "아이디를 입력해 주세요.")
		@Size(min = 4, max = 20, message = "아이디는 4자 이상 20자 이하로 입력해 주세요.")
		String username,

		@NotBlank(message = "비밀번호를 입력해 주세요.")
		@Size(min = 8, max = 100, message = "비밀번호는 최소 8자 이상이어야 합니다.")
		String password) {
}
