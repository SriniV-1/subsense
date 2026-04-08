package com.subsense.controller;

import com.subsense.dto.BenchmarkResult;
import com.subsense.service.BenchmarkService;
import com.subsense.service.SubscriptionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/benchmarks")
public class BenchmarkController {

    private final BenchmarkService benchmarkService;
    private final SubscriptionService subscriptionService;

    public BenchmarkController(BenchmarkService benchmarkService,
                                SubscriptionService subscriptionService) {
        this.benchmarkService = benchmarkService;
        this.subscriptionService = subscriptionService;
    }

    /** GET /api/benchmarks — peer spending comparison by category */
    @GetMapping
    public List<BenchmarkResult> getBenchmarks() {
        return benchmarkService.benchmark(subscriptionService.getAllEnriched());
    }
}
