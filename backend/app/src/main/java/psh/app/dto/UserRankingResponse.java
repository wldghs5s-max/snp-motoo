package psh.app.dto;

public record UserRankingResponse(
		int rank,
		String username,
		Long balance,
		Long totalAssets,
		Double returnRate
) {}
