package vn.flowery.staff.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import vn.flowery.staff.api.ApiTransport;
import vn.flowery.staff.model.RefundRequest;
import vn.flowery.staff.model.Values;

public final class RefundService {
    private final ApiTransport api;

    public RefundService(ApiTransport api) {
        this.api = api;
    }

    public List<RefundRequest> listRefunds() {
        Map<String, Object> payload = Values.object(api.get("/admin/refunds"));
        return Values.array(payload.get("items")).stream().map(RefundRequest::from).toList();
    }

    public void decide(long refundId, String status, String rejectionReason) {
        Map<String, Object> request = new HashMap<>();
        request.put("status", status);
        if (rejectionReason != null && !rejectionReason.isBlank()) {
            request.put("rejection_reason", rejectionReason.trim());
        }
        api.patch("/admin/refunds/" + refundId, request);
    }
}
