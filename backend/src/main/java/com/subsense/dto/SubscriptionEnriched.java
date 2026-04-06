package com.subsense.dto;

import com.subsense.model.UsageLog;
import java.util.List;

/**
 * Subscription + computed analytics metrics returned by the API.
 */
public record SubscriptionEnriched(
        // Raw fields
        String id,
        String name,
        String category,
        double monthlyCost,
        String accentColor,
        String bgGradient,
        String icon,
        String tier,
        String renewalDate,
        String usagePattern,
        List<UsageLog> usageLogs,
        int totalMinutes,

        // Computed metrics
        double valueScore,      // hours / monthlyCost — higher is better
        double costPerHour,     // monthlyCost / hours — -1 means Infinity (unused)
        int normScore,          // 0-100 normalized across portfolio
        boolean shouldSnooze,   // costPerHour > alertThresholdCPH
        boolean isDeadWeight,   // zero usage across all 30 days
        int daysUntilRenewal,
        int usageDropPercent,   // recent vs historical drop
        boolean sentinelAlert,  // renewal ≤ 2 days AND drop ≥ threshold
        String grade            // "Excellent" | "Good" | "Fair" | "Poor" | "Dead Weight"
) {}
