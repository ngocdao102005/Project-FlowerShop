package vn.flowery.staff.ui;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.List;
import java.util.Optional;
import javax.swing.BorderFactory;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import vn.flowery.staff.model.Category;
import vn.flowery.staff.model.Product;
import vn.flowery.staff.model.ProductDraft;

public final class ProductFormDialog {
    private final JComboBox<Category> categoryBox;
    private final JTextField nameField = new JTextField();
    private final JTextField slugField = new JTextField();
    private final JSpinner priceField = new JSpinner(
        new SpinnerNumberModel(100_000L, 1_000L, 1_000_000_000L, 10_000L)
    );
    private final JSpinner stockField = new JSpinner(
        new SpinnerNumberModel(0, 0, 1_000_000, 1)
    );
    private final JTextField occasionField = new JTextField();
    private final JTextField flowerTypeField = new JTextField();
    private final JTextField colorField = new JTextField();
    private final JTextField imageUrlField = new JTextField();
    private final JTextArea descriptionField = textArea(4);
    private final JTextArea editorialReviewField = textArea(3);
    private final JCheckBox activeField = new JCheckBox("Đang bán", true);
    private final JPanel form;
    private final boolean canEditStock;

    private ProductFormDialog(
        List<Category> categories,
        Product product,
        boolean canEditStock
    ) {
        List<Category> selectableCategories = categories.stream()
            .filter(category -> category.active() || (
                product != null && category.id() == product.categoryId()
            ))
            .toList();
        this.categoryBox = new JComboBox<>(selectableCategories.toArray(Category[]::new));
        this.canEditStock = canEditStock;
        this.form = buildForm();
        stockField.setEnabled(canEditStock);
        if (!canEditStock) {
            stockField.setToolTipText("Vai trò hiện tại không có quyền quản lý kho.");
        }
        if (product != null) {
            populate(product);
        }
    }

    public static Optional<ProductDraft> show(
        Component parent,
        List<Category> categories,
        Product product,
        boolean canEditStock
    ) {
        boolean hasSelectableCategory = categories.stream().anyMatch(category ->
            category.active() || (product != null && category.id() == product.categoryId())
        );
        if (!hasSelectableCategory) {
            JOptionPane.showMessageDialog(
                parent,
                "Hệ thống chưa có danh mục sản phẩm. Hãy tạo danh mục trên cổng quản trị trước.",
                "Thiếu danh mục",
                JOptionPane.WARNING_MESSAGE
            );
            return Optional.empty();
        }

        ProductFormDialog dialog = new ProductFormDialog(categories, product, canEditStock);
        String title = product == null ? "Thêm sản phẩm hoa" : "Chỉnh sửa sản phẩm hoa";
        JScrollPane scroll = new JScrollPane(dialog.form);
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.setPreferredSize(new Dimension(640, 590));
        scroll.getVerticalScrollBar().setUnitIncrement(16);

        while (true) {
            int choice = JOptionPane.showConfirmDialog(
                parent,
                scroll,
                title,
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE
            );
            if (choice != JOptionPane.OK_OPTION) {
                return Optional.empty();
            }
            try {
                return Optional.of(dialog.readDraft());
            } catch (IllegalArgumentException error) {
                JOptionPane.showMessageDialog(
                    parent,
                    error.getMessage(),
                    "Dữ liệu chưa hợp lệ",
                    JOptionPane.WARNING_MESSAGE
                );
            }
        }
    }

    private JPanel buildForm() {
        JPanel panel = new JPanel(new GridBagLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 16));
        panel.setBackground(Theme.SURFACE);
        GridBagConstraints constraints = new GridBagConstraints();
        constraints.fill = GridBagConstraints.HORIZONTAL;
        constraints.weightx = 1;
        constraints.gridx = 0;

        int row = 0;
        row = addField(panel, constraints, row, "Tên sản phẩm *", nameField);
        row = addField(panel, constraints, row, "Slug (để trống để tự tạo)", slugField);
        row = addField(panel, constraints, row, "Danh mục *", categoryBox);
        row = addField(panel, constraints, row, "Giá bán (VNĐ) *", priceField);
        row = addField(panel, constraints, row, "Tồn kho", stockField);
        row = addField(panel, constraints, row, "Dịp tặng", occasionField);
        row = addField(panel, constraints, row, "Loại hoa", flowerTypeField);
        row = addField(panel, constraints, row, "Màu sắc", colorField);
        row = addField(panel, constraints, row, "URL hình ảnh", imageUrlField);
        row = addField(panel, constraints, row, "Mô tả", new JScrollPane(descriptionField));
        row = addField(
            panel,
            constraints,
            row,
            "Nội dung biên tập",
            new JScrollPane(editorialReviewField)
        );

        constraints.gridy = row;
        constraints.insets = new Insets(6, 0, 8, 0);
        panel.add(activeField, constraints);
        return panel;
    }

    private static int addField(
        JPanel panel,
        GridBagConstraints constraints,
        int row,
        String label,
        Component field
    ) {
        constraints.gridy = row++;
        constraints.insets = new Insets(7, 0, 4, 0);
        JLabel fieldLabel = new JLabel(label);
        fieldLabel.setFont(fieldLabel.getFont().deriveFont(java.awt.Font.BOLD));
        panel.add(fieldLabel, constraints);

        constraints.gridy = row++;
        constraints.insets = new Insets(0, 0, 6, 0);
        if (field instanceof JTextField textField) {
            textField.setBorder(Theme.compoundBorder());
        }
        panel.add(field, constraints);
        return row;
    }

    private void populate(Product product) {
        nameField.setText(product.name());
        slugField.setText(product.slug());
        priceField.setValue(product.price());
        stockField.setValue(product.stockQuantity());
        occasionField.setText(product.occasion());
        flowerTypeField.setText(product.flowerType());
        colorField.setText(product.color());
        imageUrlField.setText(product.imageUrl());
        descriptionField.setText(product.description());
        editorialReviewField.setText(product.editorialReview());
        activeField.setSelected(product.active());

        for (int index = 0; index < categoryBox.getItemCount(); index++) {
            if (categoryBox.getItemAt(index).id() == product.categoryId()) {
                categoryBox.setSelectedIndex(index);
                break;
            }
        }
    }

    private ProductDraft readDraft() {
        String name = nameField.getText().strip();
        if (name.length() < 2) {
            throw new IllegalArgumentException("Tên sản phẩm phải có ít nhất 2 ký tự.");
        }
        Category category = (Category) categoryBox.getSelectedItem();
        if (category == null) {
            throw new IllegalArgumentException("Vui lòng chọn danh mục.");
        }
        long price = ((Number) priceField.getValue()).longValue();
        if (price < 1_000) {
            throw new IllegalArgumentException("Giá sản phẩm phải từ 1.000 VNĐ.");
        }
        int stock = ((Number) stockField.getValue()).intValue();
        return new ProductDraft(
            category.id(),
            name,
            slugField.getText().strip(),
            price,
            descriptionField.getText().strip(),
            imageUrlField.getText().strip(),
            occasionField.getText().strip(),
            flowerTypeField.getText().strip(),
            colorField.getText().strip(),
            canEditStock ? stock : 0,
            activeField.isSelected(),
            editorialReviewField.getText().strip()
        );
    }

    private static JTextArea textArea(int rows) {
        JTextArea area = new JTextArea(rows, 30);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        return area;
    }
}
