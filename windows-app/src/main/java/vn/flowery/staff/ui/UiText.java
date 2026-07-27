package vn.flowery.staff.ui;

import java.text.NumberFormat;
import java.util.Locale;

public final class UiText {
    private static final NumberFormat CURRENCY =
        NumberFormat.getCurrencyInstance(Locale.forLanguageTag("vi-VN"));

    private UiText() {
    }

    public static String currency(long value) {
        return CURRENCY.format(value);
    }

    public static String orderStatus(String status) {
        return switch (status) {
            case "Confirmed" -> "Đã xác nhận";
            case "Preparing" -> "Đang chuẩn bị";
            case "Shipping" -> "Đang giao";
            case "Delivered" -> "Đã giao";
            case "Cancelled" -> "Đã hủy";
            default -> status;
        };
    }

    public static String paymentStatus(String status) {
        return switch (status) {
            case "Paid" -> "Đã thanh toán";
            case "Pending" -> "Chờ thanh toán";
            case "Refunded" -> "Đã hoàn tiền";
            case "Failed" -> "Thất bại";
            default -> status;
        };
    }
}
