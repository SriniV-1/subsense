package com.subsense.dto;

/**
 * Per-category spending breakdown for portfolio summary.
 */
public record CategoryBreakdown(
        String category,
        int count,
        double totalCost,
        double pctOfTotal,
        double avgCostPerHour,   // -1 means category average is infinite (all unused)
        int deadWeightCount
) {}
