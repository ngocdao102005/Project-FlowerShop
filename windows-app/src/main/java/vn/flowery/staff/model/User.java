package vn.flowery.staff.model;

import java.util.Map;
import java.util.Set;

public record User(long id, String email, String fullName, String role) {
    private static final Set<String> STAFF_ROLES = Set.of("staff", "editor", "warehouse", "admin");
    private static final Set<String> OPERATIONS_ROLES = Set.of("staff", "warehouse", "admin");

    public static User from(Object value) {
        Map<String, Object> source = Values.object(value);
        return new User(
            Values.longNumber(source, "user_id"),
            Values.text(source, "email"),
            Values.text(source, "full_name"),
            Values.text(source, "role")
        );
    }

    public boolean canUseStaffApp() {
        return STAFF_ROLES.contains(role);
    }

    public boolean canManageOrdersAndStock() {
        return OPERATIONS_ROLES.contains(role);
    }

    public boolean canManageCatalog() {
        return "editor".equals(role) || "admin".equals(role);
    }

    public String displayRole() {
        return switch (role) {
            case "admin" -> "Quản trị viên";
            case "warehouse" -> "Nhân viên kho";
            case "editor" -> "Biên tập viên";
            case "staff" -> "Nhân viên vận hành";
            default -> role;
        };
    }
}
