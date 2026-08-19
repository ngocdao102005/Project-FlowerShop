package vn.flowery.staff.model;

import java.util.Map;

public record RefundRequest(
    long id,
    String orderNumber,
    String customerName,
    String email,
    String reason,
    String evidenceUrl,
    long amount,
    String status,
    String rejectionReason,
    String createdAt
) {
    public static RefundRequest from(Object value) {
        Map<String, Object> source = Values.object(value);
        return new RefundRequest(
            Values.longNumber(source, "refund_id"),
            Values.text(source, "order_number"),
            Values.text(source, "full_name"),
            Values.text(source, "email"),
            Values.text(source, "reason"),
            Values.text(source, "evidence_url"),
            Values.longNumber(source, "amount"),
            Values.text(source, "status"),
            Values.text(source, "rejection_reason"),
            Values.text(source, "created_at")
        );
    }

    public boolean isPending() {
        return "Pending".equals(status);
    }
}
