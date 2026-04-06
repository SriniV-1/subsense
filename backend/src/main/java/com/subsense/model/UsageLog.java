package com.subsense.model;

/**
 * One entry per calendar day for a subscription.
 */
public record UsageLog(
        String date,    // "yyyy-MM-dd"
        int minutes     // session duration that day (0 = no use)
) {}
