package com.subsense.dto;

import com.subsense.model.UsageLog;
import java.util.List;

/**
 * Enriched subscription + pre-computed issue tags.
 * Returned by GET /api/portfolio/flagged so the frontend
 * doesn't need to classify issues locally.
 */
public record FlaggedSubscription(
        // Identity
        String id,
        String name,
        String category,
        double monthlyCost,
        String accentColor,
        String icon,
        String tier,
        String renewalDate,
        String usagePattern,
        List<UsageLog> usageLogs,
        int totalMinutes,

        // Computed metrics
        double valueScore,
        double costPerHour,
        int normScore,
        boolean isDeadWeight,
        boolean shouldSnooze,
        boolean sentinelAlert,
        boolean bingeAndAbandon,
        String grade,
        int daysUntilRenewal,
        int usageDropPercent,
        double annualWaste,

        // Classification — one or more tags drive the Flagged UI
        List<String> issues       // ["sentinel","dead","snooze","binge_abandon","low_value"]
) {}
