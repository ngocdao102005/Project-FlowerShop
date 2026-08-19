package vn.flowery.staff;

import java.awt.Color;
import java.awt.image.BufferedImage;
import javax.swing.JLabel;
import vn.flowery.staff.ui.NavigationIcon;

public final class NavigationIconTest {
    private NavigationIconTest() {
    }

    public static void run() {
        JLabel component = new JLabel();
        component.setForeground(Color.WHITE);

        for (NavigationIcon.Type type : NavigationIcon.Type.values()) {
            BufferedImage image = new BufferedImage(24, 24, BufferedImage.TYPE_INT_ARGB);
            NavigationIcon icon = new NavigationIcon(type);
            java.awt.Graphics2D graphics = image.createGraphics();
            try {
                icon.paintIcon(component, graphics, 2, 2);
            } finally {
                graphics.dispose();
            }

            int visiblePixels = 0;
            for (int y = 0; y < image.getHeight(); y++) {
                for (int x = 0; x < image.getWidth(); x++) {
                    if ((image.getRGB(x, y) >>> 24) != 0) {
                        visiblePixels++;
                    }
                }
            }
            if (visiblePixels < 20) {
                throw new AssertionError("Icon vector không được vẽ: " + type);
            }
        }
    }
}

