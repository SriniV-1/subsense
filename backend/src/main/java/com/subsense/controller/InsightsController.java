package com.subsense.controller;

import com.subsense.dto.PortfolioAlert;
import com.subsense.dto.SubscriptionRecommendation;
import com.subsense.service.InsightsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Portfolio intelligence endpoints — computed entirely in Java.
 *
 * GET /api/insights        — portfolio-level alerts (budget, overlap, binge-abandon, etc.)
 * GET /api/recommendations — per-subscription prioritized action recommendations
 */
@RestController
@RequestMapping("/api")
public class InsightsController {

    private final InsightsService insightsService;

    public InsightsController(InsightsService insightsService) {
        this.insightsService = insightsService;
    }

    @GetMapping("/insights")
    public List<PortfolioAlert> getInsights() {
        return insightsService.computeAlerts();
    }

    @GetMapping("/recommendations")
    public List<SubscriptionRecommendation> getRecommendations() {
        return insightsService.computeRecommendations();
    }
}
