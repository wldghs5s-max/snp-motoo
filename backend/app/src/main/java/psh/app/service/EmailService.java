package psh.app.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

	private final JavaMailSender mailSender;

	public EmailService(JavaMailSender mailSender) {
		this.mailSender = mailSender;
	}

	@Async
	public void sendResetCodeEmail(String toEmail, String code) {
		try {
			SimpleMailMessage message = new SimpleMailMessage();
			message.setFrom("wldghs5s@gmail.com");
			message.setTo(toEmail);
			message.setSubject("[Vibe Stock] 비밀번호 재설정 인증번호 안내");
			message.setText("안녕하세요. 실시간 주식 모의투자 플랫폼 Vibe Stock입니다.\n\n"
					+ "비밀번호 재설정을 위한 인증번호는 다음과 같습니다.\n\n"
					+ "인증번호: " + code + "\n\n"
					+ "본 인증번호는 5분 동안 유효합니다.\n"
					+ "감사합니다.");
			mailSender.send(message);
			System.out.println("SMTP 이메일 발송 성공 (비동기): " + toEmail);
		} catch (Exception e) {
			System.err.println("SMTP 이메일 전송 실패 (비동기): " + e.getMessage());
		}
	}
}
