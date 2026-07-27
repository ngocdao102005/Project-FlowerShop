package vn.flowery.staff;

import java.awt.EventQueue;
import javax.swing.JOptionPane;
import vn.flowery.staff.config.AppConfig;
import vn.flowery.staff.ui.LoginFrame;
import vn.flowery.staff.ui.Theme;

public final class App {
    private App() {
    }

    public static void main(String[] args) {
        EventQueue.invokeLater(() -> {
            try {
                Theme.install();
                AppConfig config = AppConfig.load();
                new LoginFrame(config).setVisible(true);
            } catch (RuntimeException error) {
                JOptionPane.showMessageDialog(
                    null,
                    "Không thể khởi động Flowery Staff:\n" + error.getMessage(),
                    "Lỗi khởi động",
                    JOptionPane.ERROR_MESSAGE
                );
            }
        });
    }
}
