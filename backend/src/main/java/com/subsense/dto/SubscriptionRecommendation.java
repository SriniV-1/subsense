package com.subsense.dto;

import java.util.List;

/**
 * Per-subscription action recommendations computed by InsightsService.
 * priority: "urgent" | "high" | "medium" | "low"
 */
public record SubscriptionRecommendation(
        String subId,
        String subName,
        String subIcon,
        double monthlyCost,
        String priority,
        List<String> actions,
        String primaryReason
) {}
