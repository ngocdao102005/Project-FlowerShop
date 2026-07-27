package vn.flowery.staff.ui;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.Optional;
import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import vn.flowery.staff.model.Category;
import vn.flowery.staff.model.CategoryDraft;

public final class CategoryFormDialog {
    private final JTextField nameField = new JTextField();
    private final JTextField slugField = new JTextField();
    private final JTextArea descriptionField = new JTextArea(5, 36);
    private final JPanel form;

    private CategoryFormDialog(Category category) {
        descriptionField.setLineWrap(true);
        descriptionField.setWrapStyleWord(true);
        form = buildForm();
        if (category != null) {
            nameField.setText(category.name());
            slugField.setText(category.slug());
            descriptionField.setText(category.description());
        }
    }

    public static Optional<CategoryDraft> show(Component parent, Category category) {
        CategoryFormDialog dialog = new CategoryFormDialog(category);
        String title = category == null ? "Thêm danh mục hoa" : "Chỉnh sửa danh mục hoa";

        while (true) {
            int choice = JOptionPane.showConfirmDialog(
                parent,
                dialog.form,
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
        panel.setPreferredSize(new Dimension(520, 300));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        panel.setBackground(Theme.SURFACE);

        GridBagConstraints constraints = new GridBagConstraints();
        constraints.gridx = 0;
        constraints.fill = GridBagConstraints.HORIZONTAL;
        constraints.weightx = 1;
        int row = 0;
        row = addField(panel, constraints, row, "Tên danh mục *", nameField);
        row = addField(panel, constraints, row, "Slug (để trống để tự tạo)", slugField);
        addField(
            panel,
            constraints,
            row,
            "Mô tả",
            new JScrollPane(descriptionField)
        );
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
        constraints.insets = new Insets(8, 0, 4, 0);
        JLabel fieldLabel = new JLabel(label);
        fieldLabel.setFont(fieldLabel.getFont().deriveFont(java.awt.Font.BOLD));
        panel.add(fieldLabel, constraints);

        constraints.gridy = row++;
        constraints.insets = new Insets(0, 0, 8, 0);
        if (field instanceof JTextField textField) {
            textField.setBorder(Theme.compoundBorder());
        }
        panel.add(field, constraints);
        return row;
    }

    private CategoryDraft readDraft() {
        String name = nameField.getText().strip();
        if (name.length() < 2) {
            throw new IllegalArgumentException("Tên danh mục phải có ít nhất 2 ký tự.");
        }
        return new CategoryDraft(
            name,
            slugField.getText().strip(),
            descriptionField.getText().strip()
        );
    }
}
