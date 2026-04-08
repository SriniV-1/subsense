package com.subsense.controller;

import com.subsense.dto.ForecastResult;
import com.subsense.service.ForecastingService;
import com.subsense.service.MockDataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/forecasts")
public class ForecastController {

    private final ForecastingService forecastingService;
    private final MockDataService mockData;

    public ForecastController(ForecastingService forecastingService, MockDataService mockData) {
        this.forecastingService = forecastingService;
        this.mockData = mockData;
    }

    /** GET /api/forecasts — usage trend forecast for all subscriptions */
    @GetMapping
    public List<ForecastResult> getForecasts() {
        return forecastingService.forecast(mockData.getSubscriptions());
    }
}
