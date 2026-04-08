package com.subsense.dto;

/**
 * Usage trend forecast for a single subscription.
 * trendLabel: GROWING | STABLE | DECLINING | DYING
 */
public record ForecastResult(
        String id,
        String name,
        String icon,
        double currentAvgMinutes,    // 7-day trailing average
        double trendSlopePerDay,     // minutes/day change (negative = declining)
        int    projectedMinutes30d,  // predicted daily avg 30 days from now
        int    daysUntilDead,        // days until projected usage hits 0; -1 = won't reach 0
        double confidenceScore,      // R² of the regression fit (0.0–1.0)
        String trendLabel,
        double percentChange30d      // % change from current avg to 30-day projection
) {}
