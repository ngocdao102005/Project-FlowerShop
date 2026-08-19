package vn.flowery.staff.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import vn.flowery.staff.api.ApiTransport;
import vn.flowery.staff.model.Order;
import vn.flowery.staff.model.Values;

public final class OrderService {
    private final ApiTransport api;

    public OrderService(ApiTransport api) {
        this.api = api;
    }

    public List<Order> listOrders() {
        Map<String, Object> payload = Values.object(api.get("/admin/orders"));
        return Values.array(payload.get("items")).stream().map(Order::from).toList();
    }

    public Order updateStatus(long orderId, String status) {
        return updateStatus(orderId, status, "", "");
    }

    public Order updateStatus(long orderId, String status, String carrier, String trackingCode) {
        Map<String, Object> request = new HashMap<>();
        request.put("status", status);
        if (carrier != null && !carrier.isBlank()) {
            request.put("carrier", carrier.trim());
        }
        if (trackingCode != null && !trackingCode.isBlank()) {
            request.put("tracking_code", trackingCode.trim());
        }
        Map<String, Object> payload = Values.object(
            api.patch("/admin/orders/" + orderId, request)
        );
        return Order.from(payload.get("order"));
    }
}
