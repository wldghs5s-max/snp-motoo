package psh.app.domain.user;

import lombok.Getter;

@Getter
public enum BankCode {
	KB("KB국민은행"),
	SHINHAN("신한은행"),
	WOORI("우리은행"),
	HANA("하나은행"),
	NH("NH농협은행"),
	IBK("IBK기업은행"),
	KAKAO("카카오뱅크"),
	TOSS("토스뱅크"),
	K_BANK("케이뱅크"),
	POST_OFFICE("우체국");

	private final String displayName;

	BankCode(String displayName) {
		this.displayName = displayName;
	}
}
