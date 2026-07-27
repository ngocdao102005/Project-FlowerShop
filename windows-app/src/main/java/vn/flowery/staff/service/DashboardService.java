package vn.flowery.staff.service;

import java.util.Map;
import vn.flowery.staff.api.ApiTransport;
import vn.flowery.staff.model.DashboardStats;
import vn.flowery.staff.model.Values;

public final class DashboardService {
    private final ApiTransport api;

    public DashboardService(ApiTransport api) {
        this.api = api;
    }

    public DashboardStats loadStats() {
        Map<String, Object> payload = Values.object(api.get("/admin/stats"));
        return DashboardStats.from(payload.get("stats"));
    }
}
