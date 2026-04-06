package com.subsense.controller;

import com.subsense.dto.DashboardStats;
import com.subsense.model.SwapOption;
import com.subsense.model.UserProfile;
import com.subsense.service.MockDataService;
import com.subsense.service.SubscriptionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class DashboardController {

    private final SubscriptionService subscriptionService;
    private final MockDataService mockData;

    public DashboardController(SubscriptionService subscriptionService, MockDataService mockData) {
        this.subscriptionService = subscriptionService;
        this.mockData = mockData;
    }

    /** GET /api/dashboard — aggregated KPI stats */
    @GetMapping("/dashboard")
    public DashboardStats getDashboard() {
        return subscriptionService.getDashboardStats();
    }

    /** GET /api/profile — user profile + thresholds */
    @GetMapping("/profile")
    public UserProfile getProfile() {
        return mockData.getUserProfile();
    }

    /** GET /api/swap-options — marketplace swap items */
    @GetMapping("/swap-options")
    public List<SwapOption> getSwapOptions() {
        return mockData.getSwapOptions();
    }
}
