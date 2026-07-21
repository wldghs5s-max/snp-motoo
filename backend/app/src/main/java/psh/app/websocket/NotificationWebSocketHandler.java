package psh.app.websocket;

import java.io.IOException;
import java.net.URI;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class NotificationWebSocketHandler extends TextWebSocketHandler {

	// Active sessions mapped by username
	private static final ConcurrentHashMap<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws Exception {
		String username = getUsernameFromSession(session);
		if (username != null) {
			userSessions.put(username, session);
			log.info("WebSocket connection established for user: {}", username);
		} else {
			log.warn("WebSocket connection attempt without username. Closing session.");
			session.close(CloseStatus.BAD_DATA);
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		String username = getUsernameFromSession(session);
		if (username != null) {
			userSessions.remove(username);
			log.info("WebSocket connection closed for user: {}", username);
		}
	}

	/**
	 * Send notification message to a specific user
	 */
	public static void sendNotification(String username, String jsonMessage) {
		WebSocketSession session = userSessions.get(username);
		if (session != null && session.isOpen()) {
			try {
				session.sendMessage(new TextMessage(jsonMessage));
				log.info("Successfully sent real-time notification to user: {}", username);
			} catch (IOException e) {
				log.error("Failed to send WebSocket notification to user: " + username, e);
			}
		} else {
			log.info("No active WebSocket session found for user: {}", username);
		}
	}

	private String getUsernameFromSession(WebSocketSession session) {
		URI uri = session.getUri();
		if (uri == null) return null;
		
		String query = uri.getQuery();
		if (query == null) return null;

		for (String param : query.split("&")) {
			String[] entry = param.split("=");
			if (entry.length > 1 && "username".equals(entry[0])) {
				return entry[1];
			}
		}
		return null;
	}
}
