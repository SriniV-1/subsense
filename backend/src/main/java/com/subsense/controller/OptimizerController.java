package com.subsense.controller;

import com.subsense.dto.OptimizationPlan;
import com.subsense.service.MockDataService;
import com.subsense.service.OptimizerService;
import com.subsense.service.SubscriptionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/optimizer")
public class OptimizerController {

    private final OptimizerService optimizerService;
    private final SubscriptionService subscriptionService;
    private final MockDataService mockData;

    public OptimizerController(OptimizerService optimizerService,
                                SubscriptionService subscriptionService,
                                MockDataService mockData) {
        this.optimizerService = optimizerService;
        this.subscriptionService = subscriptionService;
        this.mockData = mockData;
    }

    /**
     * GET /api/optimizer/plan?budget=350
     * Returns the greedy knapsack optimization plan for the given monthly budget.
     * Defaults to the user's configured budget if not specified.
     */
    @GetMapping("/plan")
    public OptimizationPlan getPlan(
            @RequestParam(required = false) Double budget) {

        double monthlyBudget = budget != null
                ? budget
                : mockData.getUserProfile().monthlyBudget();

        return optimizerService.optimize(subscriptionService.getAllEnriched(), monthlyBudget);
    }
}
