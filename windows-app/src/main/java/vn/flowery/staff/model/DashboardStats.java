package vn.flowery.staff.model;

import java.util.Map;

public record DashboardStats(
    long revenue,
    long orders,
    long pendingOrders,
    long customers,
    long lowStock,
    long pendingReviews
) {
    public static DashboardStats from(Object value) {
        Map<String, Object> source = Values.object(value);
        return new DashboardStats(
            Values.longNumber(source, "revenue"),
            Values.longNumber(source, "orders"),
            Values.longNumber(source, "pending_orders"),
            Values.longNumber(source, "customers"),
            Values.longNumber(source, "low_stock"),
            Values.longNumber(source, "pending_reviews")
        );
    }
}
