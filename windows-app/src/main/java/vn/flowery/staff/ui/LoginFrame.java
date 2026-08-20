package vn.flowery.staff.ui;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.SwingConstants;
import vn.flowery.staff.api.ApiClient;
import vn.flowery.staff.config.AppConfig;
import vn.flowery.staff.model.User;
import vn.flowery.staff.service.AuthService;

public final class LoginFrame extends JFrame {
    private final AppConfig config;
    private final ApiClient apiClient;
    private final AuthService authService;
    private final JTextField emailField = new JTextField();
    private final JPasswordField passwordField = new JPasswordField();
    private final JButton loginButton = Theme.primaryButton("Đăng nhập");
    private final JLabel messageLabel = new JLabel(" ");

    public LoginFrame(AppConfig config) {
        super("Flowery Staff - Đăng nhập");
        this.config = config;
        this.apiClient = new ApiClient(config.apiBaseUrl());
        this.authService = new AuthService(apiClient);
        buildUi();
    }

    private void buildUi() {
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(900, 580));
        setSize(980, 640);
        setLocationRelativeTo(null);

        JPanel root = new JPanel(new BorderLayout());
        root.setBackground(Theme.SURFACE);
        root.add(createBrandPanel(), BorderLayout.WEST);
        root.add(createLoginPanel(), BorderLayout.CENTER);
        setContentPane(root);

        getRootPane().setDefaultButton(loginButton);
        loginButton.addActionListener(event -> login());
    }

    private JPanel createBrandPanel() {
        JPanel brand = new JPanel();
        brand.setPreferredSize(new Dimension(390, 0));
        brand.setBackground(Theme.PRIMARY_DARK);
        brand.setBorder(BorderFactory.createEmptyBorder(70, 48, 70, 48));
        brand.setLayout(new BoxLayout(brand, BoxLayout.Y_AXIS));

        JLabel mark = new JLabel("FLOWERY");
        mark.setForeground(Color.WHITE);
        mark.setFont(new Font("Segoe UI", Font.BOLD, 36));
        mark.setAlignmentX(LEFT_ALIGNMENT);

        JLabel subtitle = new JLabel(
            "<html><div style='width:260px'>Hệ thống vận hành cửa hàng hoa trên Windows</div></html>"
        );
        subtitle.setForeground(new Color(219, 235, 227));
        subtitle.setFont(new Font("Segoe UI", Font.PLAIN, 20));
        subtitle.setAlignmentX(LEFT_ALIGNMENT);

        JLabel features = new JLabel(
            "<html>• Theo dõi số liệu kinh doanh<br><br>"
                + "• Xử lý trạng thái đơn hàng<br><br>"
                + "• Quản lý sản phẩm và tồn kho</html>"
        );
        features.setForeground(Color.WHITE);
        features.setFont(new Font("Segoe UI", Font.PLAIN, 15));
        features.setAlignmentX(LEFT_ALIGNMENT);

        brand.add(mark);
        brand.add(Box.createVerticalStrut(18));
        brand.add(subtitle);
        brand.add(Box.createVerticalGlue());
        brand.add(features);
        return brand;
    }

    private JPanel createLoginPanel() {
        JPanel outer = new JPanel(new GridBagLayout());
        outer.setBackground(Theme.SURFACE);
        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        form.setPreferredSize(new Dimension(410, 420));

        GridBagConstraints constraints = new GridBagConstraints();
        constraints.gridx = 0;
        constraints.weightx = 1;
        constraints.fill = GridBagConstraints.HORIZONTAL;

        JLabel title = new JLabel("Đăng nhập nhân viên");
        title.setFont(new Font("Segoe UI", Font.BOLD, 27));
        title.setForeground(Theme.TEXT);
        addRow(form, title, constraints, 0, new Insets(0, 0, 8, 0));

        JLabel help = new JLabel("Sử dụng tài khoản staff, editor hoặc admin.");
        help.setForeground(Theme.MUTED);
        addRow(form, help, constraints, 1, new Insets(0, 0, 28, 0));

        addRow(form, fieldLabel("Email"), constraints, 2, new Insets(0, 0, 7, 0));
        emailField.setText("admin@flowery.vn");
        emailField.setBorder(Theme.compoundBorder());
        addRow(form, emailField, constraints, 3, new Insets(0, 0, 18, 0));

        addRow(form, fieldLabel("Mật khẩu"), constraints, 4, new Insets(0, 0, 7, 0));
        passwordField.setBorder(Theme.compoundBorder());
        addRow(form, passwordField, constraints, 5, new Insets(0, 0, 12, 0));

        messageLabel.setForeground(Theme.DANGER);
        messageLabel.setVerticalAlignment(SwingConstants.TOP);
        addRow(form, messageLabel, constraints, 6, new Insets(0, 0, 12, 0));

        addRow(form, loginButton, constraints, 7, new Insets(0, 0, 18, 0));

        JLabel endpoint = new JLabel(
            "<html><span style='color:#68756f'>Backend API:</span> " + config.apiBaseUrl() + "</html>"
        );
        endpoint.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        addRow(form, endpoint, constraints, 8, new Insets(0, 0, 0, 0));

        outer.add(form);
        return outer;
    }

    private static JLabel fieldLabel(String text) {
        JLabel label = new JLabel(text);
        label.setFont(new Font("Segoe UI", Font.BOLD, 14));
        return label;
    }

    private static void addRow(
        JPanel panel,
        java.awt.Component component,
        GridBagConstraints constraints,
        int row,
        Insets insets
    ) {
        constraints.gridy = row;
        constraints.insets = insets;
        panel.add(component, constraints);
    }

    private void login() {
        String email = emailField.getText();
        char[] password = passwordField.getPassword();
        if (email == null || email.isBlank() || password.length == 0) {
            messageLabel.setText("Vui lòng nhập đầy đủ email và mật khẩu.");
            java.util.Arrays.fill(password, '\0');
            return;
        }

        setFormEnabled(false);
        messageLabel.setForeground(Theme.MUTED);
        messageLabel.setText("Đang kết nối Backend API...");
        Async.run(
            () -> authService.login(email, password),
            this::openMainWindow,
            error -> {
                setFormEnabled(true);
                messageLabel.setForeground(Theme.DANGER);
                messageLabel.setText("<html>" + escapeHtml(Async.message(error)) + "</html>");
                passwordField.selectAll();
                passwordField.requestFocusInWindow();
            }
        );
    }

    private void openMainWindow(User user) {
        dispose();
        new MainFrame(config, apiClient, user).setVisible(true);
    }

    private void setFormEnabled(boolean enabled) {
        emailField.setEnabled(enabled);
        passwordField.setEnabled(enabled);
        loginButton.setEnabled(enabled);
        loginButton.setText(enabled ? "Đăng nhập" : "Đang đăng nhập...");
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\n", "<br>");
    }
}
