package vn.flowery.staff.ui.panel;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.GridLayout;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import vn.flowery.staff.model.DashboardStats;
import vn.flowery.staff.service.DashboardService;
import vn.flowery.staff.ui.Async;
import vn.flowery.staff.ui.Theme;
import vn.flowery.staff.ui.UiText;

public final class DashboardPanel extends JPanel {
    private final DashboardService service;
    private final JButton refreshButton = Theme.secondaryButton("Làm mới");
    private final JLabel statusLabel = new JLabel(" ");
    private final StatCard revenue = new StatCard("Doanh thu", "0 ₫", Theme.PRIMARY);
    private final StatCard orders = new StatCard("Tổng đơn hàng", "0", new Color(53, 101, 166));
    private final StatCard pendingOrders = new StatCard("Đơn chờ xử lý", "0", new Color(207, 124, 49));
    private final StatCard customers = new StatCard("Khách hàng", "0", new Color(119, 86, 159));
    private final StatCard lowStock = new StatCard("Sắp hết hàng", "0", Theme.DANGER);
    private final StatCard pendingReviews =
        new StatCard("Đánh giá chờ duyệt", "0", new Color(79, 127, 121));

    public DashboardPanel(DashboardService service) {
        super(new BorderLayout(0, 22));
        this.service = service;
        setBorder(BorderFactory.createEmptyBorder(28, 28, 28, 28));
        setBackground(Theme.BACKGROUND);

        JPanel header = new JPanel(new BorderLayout());
        header.setOpaque(false);
        JLabel description = new JLabel("Số liệu vận hành được tổng hợp trực tiếp từ Backend API.");
        description.setForeground(Theme.MUTED);
        header.add(description, BorderLayout.WEST);
        refreshButton.addActionListener(event -> refresh());
        header.add(refreshButton, BorderLayout.EAST);

        JPanel grid = new JPanel(new GridLayout(2, 3, 18, 18));
        grid.setOpaque(false);
        grid.add(revenue);
        grid.add(orders);
        grid.add(pendingOrders);
        grid.add(customers);
        grid.add(lowStock);
        grid.add(pendingReviews);

        statusLabel.setForeground(Theme.MUTED);
        add(header, BorderLayout.NORTH);
        add(grid, BorderLayout.CENTER);
        add(statusLabel, BorderLayout.SOUTH);
    }

    public void refresh() {
        refreshButton.setEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang cập nhật số liệu...");
        Async.run(
            service::loadStats,
            stats -> {
                apply(stats);
                refreshButton.setEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Dữ liệu đã được cập nhật.");
            },
            error -> {
                refreshButton.setEnabled(true);
                statusLabel.setForeground(Theme.DANGER);
                statusLabel.setText(Async.message(error));
            }
        );
    }

    private void apply(DashboardStats stats) {
        revenue.setValue(UiText.currency(stats.revenue()));
        orders.setValue(Long.toString(stats.orders()));
        pendingOrders.setValue(Long.toString(stats.pendingOrders()));
        customers.setValue(Long.toString(stats.customers()));
        lowStock.setValue(Long.toString(stats.lowStock()));
        pendingReviews.setValue(Long.toString(stats.pendingReviews()));
    }

    private static final class StatCard extends JPanel {
        private final JLabel valueLabel = new JLabel();

        private StatCard(String title, String value, Color accent) {
            super(new BorderLayout());
            setBackground(Theme.SURFACE);
            setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 5, 0, 0, accent),
                BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(Theme.BORDER),
                    BorderFactory.createEmptyBorder(25, 24, 25, 24)
                )
            ));

            JLabel titleLabel = new JLabel(title);
            titleLabel.setForeground(Theme.MUTED);
            titleLabel.setFont(new Font("Segoe UI", Font.BOLD, 14));
            valueLabel.setText(value);
            valueLabel.setForeground(Theme.TEXT);
            valueLabel.setFont(new Font("Segoe UI", Font.BOLD, 28));

            add(titleLabel, BorderLayout.NORTH);
            add(valueLabel, BorderLayout.CENTER);
        }

        private void setValue(String value) {
            valueLabel.setText(value);
        }
    }
}
