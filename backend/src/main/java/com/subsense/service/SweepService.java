package com.subsense.service;

import com.subsense.dto.TradeConfirmation;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.UUID;

/**
 * Institutional Logic Gate — routes snoozed subscription savings into a
 * fractional index position.  All prices and execution are mocked for the demo.
 */
@Service
public class SweepService {

    // Mock closing prices (USD) for supported index tickers
    private static final Map<String, Double> MOCK_PRICES = Map.of(
            "VOO",  498.72,   // Vanguard S&P 500
            "SPY",  527.14,   // SPDR S&P 500
            "QQQ",  446.38,   // Invesco Nasdaq-100
            "SCHB",  24.61    // Schwab Broad Market
    );

    private static final Map<String, String> POOL_NAMES = Map.of(
            "VOO",  "Wealthfront S&P 500 Pool",
            "SPY",  "SPDR S&P 500 Pool",
            "QQQ",  "Invesco Nasdaq-100 Pool",
            "SCHB", "Schwab Broad Market Pool"
    );

    private static final String DEFAULT_TICKER = "VOO";

    /**
     * Executes a mock micro-investment sweep.
     *
     * @param amount the monthly subscription cost being routed (USD)
     * @param ticker the target index ETF ticker (defaults to VOO if unrecognised)
     * @return a TradeConfirmation with execution details
     */
    public TradeConfirmation executeMicroInvestment(double amount, String ticker) {
        String resolvedTicker = MOCK_PRICES.containsKey(ticker) ? ticker : DEFAULT_TICKER;
        double price          = MOCK_PRICES.get(resolvedTicker);
        double shares         = Math.round((amount / price) * 1_000_000d) / 1_000_000d; // 6 decimal precision

        return new TradeConfirmation(
                "TRD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'")
                        .format(Instant.now().atOffset(ZoneOffset.UTC)),
                resolvedTicker,
                shares,
                Math.round(amount * 100.0) / 100.0,
                price,
                POOL_NAMES.get(resolvedTicker)
        );
    }
}
