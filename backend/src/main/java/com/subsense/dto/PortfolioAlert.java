package com.subsense.dto;

import java.util.List;

/**
 * A portfolio-level insight or risk alert computed entirely on the backend.
 *
 * type values: "budget" | "overlap" | "binge_abandon" | "chronic_low" | "high_cph" | "duplicate_service"
 * severity values: "high" | "medium" | "low"
 */
public record PortfolioAlert(
        String id,
        String type,
        String severity,
        String title,
        String body,
        List<String> affectedSubIds
) {}
