package com.subsense.dto;

/**
 * Returned by SweepService after a mock fractional-share trade is executed.
 */
public record TradeConfirmation(
        String tradeId,
        String timestamp,
        String ticker,
        double fractionalShares,
        double amountInvested,
        double mockPricePerShare,
        String poolName
) {}
