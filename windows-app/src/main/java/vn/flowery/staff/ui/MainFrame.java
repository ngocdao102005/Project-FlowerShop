package vn.flowery.staff.ui;

import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import vn.flowery.staff.api.ApiClient;
import vn.flowery.staff.config.AppConfig;
import vn.flowery.staff.model.User;
import vn.flowery.staff.service.AuthService;
import vn.flowery.staff.service.CategoryService;
import vn.flowery.staff.service.DashboardService;
import vn.flowery.staff.service.OrderService;
import vn.flowery.staff.service.ProductService;
import vn.flowery.staff.service.RefundService;
import vn.flowery.staff.ui.panel.CategoriesPanel;
import vn.flowery.staff.ui.panel.DashboardPanel;
import vn.flowery.staff.ui.panel.OrdersPanel;
import vn.flowery.staff.ui.panel.ProductsPanel;
import vn.flowery.staff.ui.panel.RefundsPanel;

public final class MainFrame extends JFrame {
    private static final String DASHBOARD = "dashboard";
    private static final String ORDERS = "orders";
    private static final String PRODUCTS = "products";
    private static final String CATEGORIES = "categories";
    private static final String REFUNDS = "refunds";

    private final AppConfig config;
    private final ApiClient apiClient;
    private final User user;
    private final CardLayout cards = new CardLayout();
    private final JPanel content = new JPanel(cards);
    private final JLabel pageTitle = new JLabel("Tổng quan");
    private final JLabel pageSubtitle = new JLabel("Theo dõi nhanh tình hình vận hành cửa hàng.");
    private final Map<String, JButton> navigationButtons = new LinkedHashMap<>();

    public MainFrame(AppConfig config, ApiClient apiClient, User user) {
        super("Flowery Staff");
        this.config = config;
        this.apiClient = apiClient;
        this.user = user;
        buildUi();
    }

    private void buildUi() {
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(1180, 700));
        setSize(1360, 820);
        setLocationRelativeTo(null);

        DashboardPanel dashboard = new DashboardPanel(new DashboardService(apiClient));
        ProductsPanel products = new ProductsPanel(
            new ProductService(apiClient),
            user.canManageOrdersAndStock(),
            user.canManageCatalog()
        );
        CategoriesPanel categories = new CategoriesPanel(
            new CategoryService(apiClient),
            user.canManageCatalog()
        );
        content.add(dashboard, DASHBOARD);
        content.add(products, PRODUCTS);
        content.add(categories, CATEGORIES);

        if (user.canViewOrders()) {
            content.add(
                new OrdersPanel(new OrderService(apiClient), user.canManageOrdersAndStock()),
                ORDERS
            );
        }
        if (user.canHandleRefunds()) {
            content.add(new RefundsPanel(new RefundService(apiClient)), REFUNDS);
        }

        JPanel root = new JPanel(new BorderLayout());
        root.add(createSidebar(), BorderLayout.WEST);
        root.add(createWorkspace(), BorderLayout.CENTER);
        setContentPane(root);

        showPage(
            DASHBOARD,
            "Tổng quan",
            "Theo dõi nhanh tình hình vận hành cửa hàng."
        );
        dashboard.refresh();
    }

    private JPanel createSidebar() {
        JPanel sidebar = new JPanel();
        sidebar.setPreferredSize(new Dimension(255, 0));
        sidebar.setBackground(Theme.PRIMARY_DARK);
        sidebar.setBorder(BorderFactory.createEmptyBorder(28, 18, 24, 18));
        sidebar.setLayout(new BoxLayout(sidebar, BoxLayout.Y_AXIS));

        JLabel logo = new JLabel("FLOWERY");
        logo.setForeground(Color.WHITE);
        logo.setFont(new Font("Segoe UI", Font.BOLD, 25));
        logo.setAlignmentX(LEFT_ALIGNMENT);

        JLabel appName = new JLabel("STAFF SYSTEM | 1.4.0");
        appName.setForeground(new Color(179, 212, 197));
        appName.setFont(new Font("Segoe UI", Font.BOLD, 11));
        appName.setAlignmentX(LEFT_ALIGNMENT);

        sidebar.add(logo);
        sidebar.add(Box.createVerticalStrut(2));
        sidebar.add(appName);
        sidebar.add(Box.createVerticalStrut(34));

        addNavigation(
            sidebar,
            "Tổng quan",
            NavigationIcon.Type.DASHBOARD,
            DASHBOARD,
            "Tổng quan",
            "Theo dõi nhanh tình hình vận hành cửa hàng."
        );
        if (user.canViewOrders()) {
            addNavigation(
                sidebar,
                "Đơn hàng",
                NavigationIcon.Type.ORDERS,
                ORDERS,
                "Quản lý đơn hàng",
                "Theo dõi và cập nhật tiến trình xử lý đơn."
            );
        }
        if (user.canHandleRefunds()) {
            addNavigation(
                sidebar,
                "Hoàn tiền",
                NavigationIcon.Type.REFUNDS,
                REFUNDS,
                "Yêu cầu hoàn tiền",
                "Duyệt hoặc từ chối yêu cầu; cổng thanh toán xác nhận hoàn tất."
            );
        }
        addNavigation(
            sidebar,
            "Sản phẩm hoa",
            NavigationIcon.Type.PRODUCTS,
            PRODUCTS,
            "Sản phẩm hoa",
            "CRUD catalog hoa, trạng thái bán và tồn kho."
        );
        addNavigation(
            sidebar,
            "Danh mục hoa",
            NavigationIcon.Type.CATEGORIES,
            CATEGORIES,
            "Danh mục hoa",
            "Tổ chức catalog và kiểm soát danh mục sử dụng."
        );
        sidebar.add(Box.createVerticalGlue());

        JPanel userCard = new JPanel();
        userCard.setLayout(new BoxLayout(userCard, BoxLayout.Y_AXIS));
        userCard.setBackground(new Color(32, 83, 65));
        userCard.setBorder(BorderFactory.createEmptyBorder(12, 13, 12, 13));
        userCard.setAlignmentX(LEFT_ALIGNMENT);
        userCard.setMaximumSize(new Dimension(Integer.MAX_VALUE, 72));

        JLabel currentUser = new JLabel(
            "<html><span style='color:white'><b>" + escapeHtml(user.fullName()) + "</b></span><br>"
                + "<span style='color:#b3d4c5'>" + escapeHtml(user.displayRole()) + "</span></html>"
        );
        currentUser.setAlignmentX(LEFT_ALIGNMENT);
        userCard.add(currentUser);
        sidebar.add(userCard);
        sidebar.add(Box.createVerticalStrut(12));

        JButton logout = Theme.navigationButton("Đăng xuất");
        logout.setIcon(new NavigationIcon(NavigationIcon.Type.LOGOUT));
        logout.setIconTextGap(12);
        logout.setAlignmentX(LEFT_ALIGNMENT);
        logout.setMaximumSize(new Dimension(Integer.MAX_VALUE, 44));
        logout.setBackground(new Color(94, 47, 47));
        logout.setToolTipText("Xóa phiên đăng nhập và quay về màn hình đăng nhập");
        logout.addActionListener(event -> logout());
        sidebar.add(logout);
        return sidebar;
    }

    private void addNavigation(
        JPanel sidebar,
        String text,
        NavigationIcon.Type iconType,
        String card,
        String title,
        String subtitle
    ) {
        JButton button = Theme.navigationButton(text);
        button.setIcon(new NavigationIcon(iconType));
        button.setIconTextGap(12);
        button.setAlignmentX(LEFT_ALIGNMENT);
        button.setMaximumSize(new Dimension(Integer.MAX_VALUE, 46));
        button.setToolTipText(title);
        button.addActionListener(event -> showPage(card, title, subtitle));
        navigationButtons.put(card, button);
        sidebar.add(button);
        sidebar.add(Box.createVerticalStrut(7));
    }

    private JPanel createWorkspace() {
        JPanel workspace = new JPanel(new BorderLayout());
        workspace.setBackground(Theme.BACKGROUND);

        JPanel header = new JPanel(new BorderLayout(16, 0));
        header.setBackground(Theme.SURFACE);
        header.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createMatteBorder(0, 0, 1, 0, Theme.BORDER),
            BorderFactory.createEmptyBorder(16, 28, 16, 28)
        ));

        JPanel titles = new JPanel();
        titles.setOpaque(false);
        titles.setLayout(new BoxLayout(titles, BoxLayout.Y_AXIS));
        pageTitle.setFont(new Font("Segoe UI", Font.BOLD, 23));
        pageSubtitle.setForeground(Theme.MUTED);
        pageSubtitle.setFont(new Font("Segoe UI", Font.PLAIN, 13));
        titles.add(pageTitle);
        titles.add(Box.createVerticalStrut(3));
        titles.add(pageSubtitle);
        header.add(titles, BorderLayout.WEST);

        JLabel connection = new JLabel(
            "<html><span style='color:#207a4d'>●</span> API&nbsp;&nbsp;"
                + escapeHtml(config.apiBaseUrl()) + "</html>"
        );
        connection.setForeground(Theme.MUTED);
        connection.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        connection.setToolTipText("Ứng dụng chỉ giao tiếp dữ liệu qua Backend API");
        header.add(connection, BorderLayout.EAST);

        workspace.add(header, BorderLayout.NORTH);
        workspace.add(content, BorderLayout.CENTER);
        return workspace;
    }

    private void showPage(String card, String title, String subtitle) {
        pageTitle.setText(title);
        pageSubtitle.setText(subtitle);
        cards.show(content, card);
        navigationButtons.forEach((key, button) -> {
            boolean selected = key.equals(card);
            button.putClientProperty("flowery.originalBackground", null);
            button.setBackground(selected ? Theme.PRIMARY : Theme.PRIMARY_DARK);
            button.setBorder(
                selected
                    ? BorderFactory.createCompoundBorder(
                        BorderFactory.createMatteBorder(0, 4, 0, 0, Theme.ACCENT),
                        BorderFactory.createEmptyBorder(12, 14, 12, 18)
                    )
                    : BorderFactory.createEmptyBorder(12, 18, 12, 18)
            );
        });
    }

    private void logout() {
        int choice = JOptionPane.showConfirmDialog(
            this,
            "Bạn có chắc chắn muốn đăng xuất?",
            "Đăng xuất",
            JOptionPane.YES_NO_OPTION,
            JOptionPane.QUESTION_MESSAGE
        );
        if (choice != JOptionPane.YES_OPTION) {
            return;
        }
        new AuthService(apiClient).logout();
        dispose();
        new LoginFrame(config).setVisible(true);
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
