package psh.app.dto;

public record UserRankingResponse(
		int rank,
		String username,
		String nickname,
		Long balance,
		Long totalAssets,
		Double returnRate
) {}
