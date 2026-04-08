package com.subsense.dto;

/**
 * Peer comparison for one subscription category.
 * status: UNDER | AT | OVER | WELL_OVER
 */
public record BenchmarkResult(
        String category,
        int    userSubCount,
        double userMonthlySpend,
        double peerAvgSpend,
        double peerMedianSpend,
        int    userPercentile,   // 1–99 — where the user falls vs peers
        String status,
        String insight
) {}
