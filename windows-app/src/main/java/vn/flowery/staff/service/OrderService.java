package vn.flowery.staff.service;

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
        Map<String, Object> payload = Values.object(
            api.patch("/admin/orders/" + orderId, Map.of("status", status))
        );
        return Order.from(payload.get("order"));
    }
}
