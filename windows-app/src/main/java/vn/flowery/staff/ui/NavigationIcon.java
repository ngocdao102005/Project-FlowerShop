package vn.flowery.staff.ui;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Path2D;
import javax.swing.Icon;

public final class NavigationIcon implements Icon {
    public enum Type {
        DASHBOARD,
        ORDERS,
        REFUNDS,
        PRODUCTS,
        CATEGORIES,
        LOGOUT
    }

    private static final int SIZE = 19;
    private final Type type;

    public NavigationIcon(Type type) {
        this.type = type;
    }

    @Override
    public int getIconWidth() {
        return SIZE;
    }

    @Override
    public int getIconHeight() {
        return SIZE;
    }

    @Override
    public void paintIcon(Component component, Graphics graphics, int x, int y) {
        Graphics2D drawing = (Graphics2D) graphics.create();
        try {
            drawing.setRenderingHint(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON
            );
            Color foreground = component.isEnabled()
                ? component.getForeground()
                : Theme.MUTED;
            drawing.setColor(foreground);
            drawing.setStroke(new BasicStroke(
                1.7f,
                BasicStroke.CAP_ROUND,
                BasicStroke.JOIN_ROUND
            ));

            switch (type) {
                case DASHBOARD -> paintDashboard(drawing, x, y);
                case ORDERS -> paintOrders(drawing, x, y);
                case REFUNDS -> paintRefunds(drawing, x, y);
                case PRODUCTS -> paintFlower(drawing, x, y);
                case CATEGORIES -> paintCategories(drawing, x, y);
                case LOGOUT -> paintLogout(drawing, x, y);
            }
        } finally {
            drawing.dispose();
        }
    }

    private static void paintDashboard(Graphics2D drawing, int x, int y) {
        drawing.drawRoundRect(x + 1, y + 1, 7, 7, 2, 2);
        drawing.drawRoundRect(x + 11, y + 1, 7, 7, 2, 2);
        drawing.drawRoundRect(x + 1, y + 11, 7, 7, 2, 2);
        drawing.drawRoundRect(x + 11, y + 11, 7, 7, 2, 2);
    }

    private static void paintOrders(Graphics2D drawing, int x, int y) {
        drawing.drawRoundRect(x + 3, y + 2, 13, 16, 3, 3);
        drawing.drawLine(x + 7, y + 1, x + 12, y + 1);
        drawing.drawLine(x + 7, y + 6, x + 13, y + 6);
        drawing.drawLine(x + 7, y + 10, x + 13, y + 10);
        drawing.drawLine(x + 7, y + 14, x + 11, y + 14);
        drawing.fillOval(x + 5, y + 5, 1, 1);
        drawing.fillOval(x + 5, y + 9, 1, 1);
        drawing.fillOval(x + 5, y + 13, 1, 1);
    }

    private static void paintRefunds(Graphics2D drawing, int x, int y) {
        drawing.drawArc(x + 3, y + 3, 13, 13, 35, 285);
        drawing.drawLine(x + 3, y + 6, x + 3, y + 2);
        drawing.drawLine(x + 3, y + 2, x + 7, y + 2);
        drawing.drawString("₫", x + 6, y + 14);
    }

    private static void paintFlower(Graphics2D drawing, int x, int y) {
        drawing.drawOval(x + 7, y + 1, 5, 7);
        drawing.drawOval(x + 11, y + 5, 7, 5);
        drawing.drawOval(x + 7, y + 11, 5, 7);
        drawing.drawOval(x + 1, y + 5, 7, 5);
        drawing.drawOval(x + 3, y + 3, 6, 6);
        drawing.drawOval(x + 10, y + 10, 6, 6);
        drawing.fillOval(x + 8, y + 8, 3, 3);
    }

    private static void paintCategories(Graphics2D drawing, int x, int y) {
        Path2D folder = new Path2D.Double();
        folder.moveTo(x + 1, y + 5);
        folder.lineTo(x + 7, y + 5);
        folder.lineTo(x + 9, y + 8);
        folder.lineTo(x + 18, y + 8);
        folder.lineTo(x + 18, y + 17);
        folder.lineTo(x + 1, y + 17);
        folder.closePath();
        drawing.draw(folder);
        drawing.drawLine(x + 1, y + 5, x + 1, y + 3);
        drawing.drawLine(x + 1, y + 3, x + 7, y + 3);
        drawing.drawLine(x + 7, y + 3, x + 9, y + 6);
        drawing.drawLine(x + 9, y + 6, x + 16, y + 6);
    }

    private static void paintLogout(Graphics2D drawing, int x, int y) {
        drawing.drawRoundRect(x + 1, y + 2, 10, 15, 2, 2);
        drawing.drawLine(x + 8, y + 9, x + 18, y + 9);
        drawing.drawLine(x + 14, y + 5, x + 18, y + 9);
        drawing.drawLine(x + 14, y + 13, x + 18, y + 9);
    }
}
