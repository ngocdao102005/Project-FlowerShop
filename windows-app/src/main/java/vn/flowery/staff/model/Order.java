package vn.flowery.staff.model;

import java.util.Map;

public record Order(
    long id,
    String number,
    String customerName,
    String phone,
    long totalAmount,
    String paymentMethod,
    String paymentStatus,
    String status,
    String createdAt
) {
    public static Order from(Object value) {
        Map<String, Object> source = Values.object(value);
        return new Order(
            Values.longNumber(source, "order_id"),
            Values.text(source, "order_number"),
            Values.text(source, "customer_name"),
            Values.text(source, "customer_phone"),
            Values.longNumber(source, "total_amount"),
            Values.text(source, "payment_method"),
            Values.text(source, "payment_status"),
            Values.text(source, "status"),
            Values.text(source, "created_at")
        );
    }

    public boolean isTerminal() {
        return "Delivered".equals(status) || "Cancelled".equals(status);
    }
}
