package vn.flowery.staff.ui;

import java.awt.Color;
import java.awt.Cursor;
import java.awt.Font;
import java.awt.Insets;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.UIManager;
import javax.swing.border.Border;

public final class Theme {
    public static final Color PRIMARY = new Color(36, 104, 79);
    public static final Color PRIMARY_DARK = new Color(25, 73, 56);
    public static final Color ACCENT = new Color(212, 112, 102);
    public static final Color BACKGROUND = new Color(246, 248, 246);
    public static final Color SURFACE = Color.WHITE;
    public static final Color TEXT = new Color(33, 48, 42);
    public static final Color MUTED = new Color(104, 117, 111);
    public static final Color BORDER = new Color(221, 228, 224);
    public static final Color DANGER = new Color(176, 53, 53);
    public static final Color SUCCESS = new Color(32, 122, 77);

    private Theme() {
    }

    public static void install() {
        Font regular = new Font("Segoe UI", Font.PLAIN, 14);
        Font bold = regular.deriveFont(Font.BOLD);

        UIManager.put("Label.font", regular);
        UIManager.put("Button.font", bold);
        UIManager.put("TextField.font", regular);
        UIManager.put("PasswordField.font", regular);
        UIManager.put("ComboBox.font", regular);
        UIManager.put("Spinner.font", regular);
        UIManager.put("Table.font", regular);
        UIManager.put("TableHeader.font", bold);
        UIManager.put("OptionPane.messageFont", regular);
        UIManager.put("OptionPane.buttonFont", bold);
        UIManager.put("Table.rowHeight", 36);
        UIManager.put("Table.gridColor", BORDER);
        UIManager.put("Table.showHorizontalLines", false);
        UIManager.put("Table.showVerticalLines", false);
        UIManager.put("Table.selectionBackground", new Color(220, 238, 229));
        UIManager.put("Table.selectionForeground", TEXT);
        UIManager.put("TableHeader.background", new Color(236, 242, 239));
        UIManager.put("TableHeader.foreground", PRIMARY_DARK);
        UIManager.put("Panel.background", BACKGROUND);
        UIManager.put("Label.foreground", TEXT);
        UIManager.put("TextField.caretForeground", TEXT);
        UIManager.put("ScrollBar.width", 13);
    }

    public static JButton primaryButton(String text) {
        JButton button = baseButton(text);
        button.setBackground(PRIMARY);
        button.setForeground(Color.WHITE);
        return button;
    }

    public static JButton secondaryButton(String text) {
        JButton button = baseButton(text);
        button.setBackground(SURFACE);
        button.setForeground(PRIMARY_DARK);
        button.setBorder(compoundBorder());
        return button;
    }

    public static JButton navigationButton(String text) {
        JButton button = baseButton(text);
        button.setHorizontalAlignment(JButton.LEFT);
        button.setBackground(PRIMARY_DARK);
        button.setForeground(Color.WHITE);
        button.setBorder(BorderFactory.createEmptyBorder(12, 18, 12, 18));
        return button;
    }

    public static Border compoundBorder() {
        return BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(BORDER),
            BorderFactory.createEmptyBorder(9, 14, 9, 14)
        );
    }

    private static JButton baseButton(String text) {
        JButton button = new JButton(text);
        button.setFocusPainted(false);
        button.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        button.setMargin(new Insets(10, 16, 10, 16));
        button.setBorder(BorderFactory.createEmptyBorder(10, 16, 10, 16));
        button.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseEntered(MouseEvent event) {
                if (!button.isEnabled()) {
                    return;
                }
                button.putClientProperty("flowery.originalBackground", button.getBackground());
                button.setBackground(button.getBackground().brighter());
            }

            @Override
            public void mouseExited(MouseEvent event) {
                Object original = button.getClientProperty("flowery.originalBackground");
                if (original instanceof Color color) {
                    button.setBackground(color);
                    button.putClientProperty("flowery.originalBackground", null);
                }
            }
        });
        return button;
    }
}
