package com.subsense.controller;

import com.subsense.dto.SubscriptionEnriched;
import com.subsense.dto.TradeConfirmation;
import com.subsense.model.UsageLog;
import com.subsense.service.MockDataService;
import com.subsense.service.SubscriptionService;
import com.subsense.service.SweepService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;
    private final MockDataService mockData;
    private final SweepService sweepService;

    public SubscriptionController(SubscriptionService subscriptionService,
                                  MockDataService mockData,
                                  SweepService sweepService) {
        this.subscriptionService = subscriptionService;
        this.mockData = mockData;
        this.sweepService = sweepService;
    }

    /** GET /api/subscriptions — all subscriptions with computed metrics */
    @GetMapping
    public List<SubscriptionEnriched> getAll() {
        return subscriptionService.getAllEnriched();
    }

    /** GET /api/subscriptions/{id} — single subscription */
    @GetMapping("/{id}")
    public ResponseEntity<SubscriptionEnriched> getOne(@PathVariable String id) {
        SubscriptionEnriched sub = subscriptionService.getEnriched(id);
        return sub != null ? ResponseEntity.ok(sub) : ResponseEntity.notFound().build();
    }

    /** GET /api/subscriptions/{id}/usage — raw usage logs only */
    @GetMapping("/{id}/usage")
    public ResponseEntity<List<UsageLog>> getUsage(@PathVariable String id) {
        var sub = mockData.getSubscription(id);
        return sub != null
                ? ResponseEntity.ok(sub.usageLogs())
                : ResponseEntity.notFound().build();
    }

    /**
     * POST /api/subscriptions/{id}/snooze
     * In production this would update the DB; here we return an acknowledgement.
     */
    @PostMapping("/{id}/snooze")
    public ResponseEntity<Map<String, Object>> snooze(@PathVariable String id) {
        var sub = mockData.getSubscription(id);
        if (sub == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
                "id", id,
                "action", "snoozed",
                "message", sub.name() + " has been snoozed."
        ));
    }

    /**
     * POST /api/subscriptions/{id}/cancel
     * In production this would initiate a cancellation flow.
     */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancel(@PathVariable String id) {
        var sub = mockData.getSubscription(id);
        if (sub == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
                "id", id,
                "action", "cancelled",
                "message", sub.name() + " cancellation initiated."
        ));
    }

    /**
     * POST /api/subscriptions/{id}/snooze-and-sweep?ticker=VOO
     *
     * Snoozes the subscription and immediately routes the saved monthly cost into
     * a fractional index position via the institutional logic gate (SweepService).
     *
     * Returns a unified envelope: snooze metadata + TradeConfirmation.
     */
    @PostMapping("/{id}/snooze-and-sweep")
    public ResponseEntity<Map<String, Object>> snoozeAndSweep(
            @PathVariable String id,
            @RequestParam(defaultValue = "VOO") String ticker) {

        var sub = mockData.getSubscription(id);
        if (sub == null) return ResponseEntity.notFound().build();

        TradeConfirmation trade = sweepService.executeMicroInvestment(sub.monthlyCost(), ticker);

        return ResponseEntity.ok(Map.of(
                "id",           id,
                "action",       "snoozed_and_swept",
                "subscriptionName", sub.name(),
                "savedAmount",  sub.monthlyCost(),
                "trade",        trade
        ));
    }
}
