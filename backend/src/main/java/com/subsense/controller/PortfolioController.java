package com.subsense.controller;

import com.subsense.dto.FlaggedSubscription;
import com.subsense.dto.PortfolioSummary;
import com.subsense.dto.RenewalEvent;
import com.subsense.service.SubscriptionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Portfolio-level analytics endpoints — all logic runs in Java.
 *
 * GET /api/portfolio/summary  — health score, category breakdown, KPIs
 * GET /api/portfolio/flagged  — all flagged subscriptions with issue tags
 * GET /api/portfolio/renewals — upcoming renewals in the next 30 days
 */
@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

    private final SubscriptionService subscriptionService;

    public PortfolioController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping("/summary")
    public PortfolioSummary getSummary() {
        return subscriptionService.getPortfolioSummary();
    }

    @GetMapping("/flagged")
    public List<FlaggedSubscription> getFlagged() {
        return subscriptionService.getFlaggedSubscriptions();
    }

    @GetMapping("/renewals")
    public List<RenewalEvent> getUpcomingRenewals() {
        return subscriptionService.getUpcomingRenewals();
    }
}
