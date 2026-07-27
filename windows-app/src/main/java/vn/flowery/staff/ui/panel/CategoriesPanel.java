package vn.flowery.staff.ui.panel;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.RowFilter;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.TableCellRenderer;
import javax.swing.table.TableRowSorter;
import vn.flowery.staff.model.Category;
import vn.flowery.staff.model.CategoryDraft;
import vn.flowery.staff.service.CategoryService;
import vn.flowery.staff.ui.Async;
import vn.flowery.staff.ui.CategoryFormDialog;
import vn.flowery.staff.ui.Theme;

public final class CategoriesPanel extends JPanel {
    private final CategoryService service;
    private final boolean canManageCatalog;
    private final CategoryTableModel model = new CategoryTableModel();
    private final JTable table = new JTable(model) {
        @Override
        public Component prepareRenderer(TableCellRenderer renderer, int row, int column) {
            Component component = super.prepareRenderer(renderer, row, column);
            if (!isRowSelected(row)) {
                Category category = model.rowAt(convertRowIndexToModel(row));
                component.setBackground(row % 2 == 0 ? Theme.SURFACE : new Color(249, 251, 250));
                component.setForeground(category.active() ? Theme.TEXT : Theme.MUTED);
            }
            return component;
        }
    };
    private final TableRowSorter<CategoryTableModel> sorter = new TableRowSorter<>(model);
    private final JTextField searchField = new JTextField(18);
    private final JButton refreshButton = Theme.secondaryButton("Làm mới");
    private final JButton addButton = Theme.primaryButton("Thêm danh mục");
    private final JButton editButton = Theme.secondaryButton("Chỉnh sửa");
    private final JButton stateButton = Theme.secondaryButton("Ngừng sử dụng");
    private final JLabel statusLabel = new JLabel(" ");
    private boolean busy;

    public CategoriesPanel(CategoryService service, boolean canManageCatalog) {
        super(new BorderLayout(0, 16));
        this.service = service;
        this.canManageCatalog = canManageCatalog;
        setBorder(BorderFactory.createEmptyBorder(28, 28, 28, 28));
        setBackground(Theme.BACKGROUND);

        add(createHeader(), BorderLayout.NORTH);
        add(createTable(), BorderLayout.CENTER);
        statusLabel.setForeground(Theme.MUTED);
        add(statusLabel, BorderLayout.SOUTH);

        refreshButton.addActionListener(event -> refresh());
        addButton.addActionListener(event -> createCategory());
        editButton.addActionListener(event -> editSelectedCategory());
        stateButton.addActionListener(event -> toggleSelectedCategory());
        table.getSelectionModel().addListSelectionListener(event -> {
            if (!event.getValueIsAdjusting()) {
                updateActionState();
            }
        });
        table.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent event) {
                if (event.getClickCount() == 2 && canManageCatalog) {
                    editSelectedCategory();
                }
            }
        });
        addButton.setVisible(canManageCatalog);
        editButton.setVisible(canManageCatalog);
        stateButton.setVisible(canManageCatalog);
        installSearch();
        refresh();
    }

    private JPanel createHeader() {
        JPanel header = new JPanel(new BorderLayout(0, 12));
        header.setOpaque(false);

        JPanel description = new JPanel();
        description.setOpaque(false);
        description.setLayout(new javax.swing.BoxLayout(description, javax.swing.BoxLayout.Y_AXIS));
        JLabel heading = new JLabel("CRUD danh mục hoa");
        heading.setFont(new Font("Segoe UI", Font.BOLD, 18));
        JLabel help = new JLabel(
            canManageCatalog
                ? "Thêm, xem, sửa và ngừng sử dụng danh mục. Danh mục có sản phẩm đang bán được bảo vệ."
                : "Xem danh mục và số lượng sản phẩm liên quan."
        );
        help.setForeground(Theme.MUTED);
        description.add(heading);
        description.add(help);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        actions.setOpaque(false);
        searchField.setBorder(Theme.compoundBorder());
        searchField.setToolTipText("Tìm theo tên, slug hoặc trạng thái");
        actions.add(new JLabel("Tìm kiếm"));
        actions.add(searchField);
        actions.add(refreshButton);
        actions.add(addButton);
        actions.add(editButton);
        actions.add(stateButton);

        header.add(description, BorderLayout.NORTH);
        header.add(actions, BorderLayout.CENTER);
        return header;
    }

    private JScrollPane createTable() {
        table.setRowSorter(sorter);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setFillsViewportHeight(true);
        table.getTableHeader().setReorderingAllowed(false);
        table.getColumnModel().getColumn(0).setPreferredWidth(60);
        table.getColumnModel().getColumn(1).setPreferredWidth(210);
        table.getColumnModel().getColumn(2).setPreferredWidth(200);
        table.getColumnModel().getColumn(3).setPreferredWidth(110);
        table.getColumnModel().getColumn(4).setPreferredWidth(120);
        JScrollPane scroll = new JScrollPane(table);
        scroll.setBorder(BorderFactory.createLineBorder(Theme.BORDER));
        return scroll;
    }

    private void installSearch() {
        searchField.getDocument().addDocumentListener(new DocumentListener() {
            @Override
            public void insertUpdate(DocumentEvent event) {
                filter();
            }

            @Override
            public void removeUpdate(DocumentEvent event) {
                filter();
            }

            @Override
            public void changedUpdate(DocumentEvent event) {
                filter();
            }
        });
    }

    private void filter() {
        String query = searchField.getText().strip();
        sorter.setRowFilter(
            query.isEmpty()
                ? null
                : RowFilter.regexFilter("(?iu)" + Pattern.quote(query), 1, 2, 4)
        );
    }

    public void refresh() {
        setBusy(true);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang tải danh mục...");
        Async.run(
            service::listCategories,
            categories -> {
                model.setRows(categories);
                setBusy(false);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Đã tải " + categories.size() + " danh mục.");
            },
            this::showError
        );
    }

    private void createCategory() {
        Optional<CategoryDraft> draft = CategoryFormDialog.show(this, null);
        if (draft.isEmpty()) {
            return;
        }
        runMutation(
            "Đang tạo danh mục...",
            () -> service.createCategory(draft.get()),
            created -> {
                model.add(created);
                statusLabel.setText("Đã thêm danh mục \"" + created.name() + "\".");
            }
        );
    }

    private void editSelectedCategory() {
        SelectedCategory selected = selectedCategory("Vui lòng chọn danh mục cần chỉnh sửa.");
        if (selected == null) {
            return;
        }
        Optional<CategoryDraft> draft = CategoryFormDialog.show(this, selected.category());
        if (draft.isEmpty()) {
            return;
        }
        runMutation(
            "Đang cập nhật danh mục...",
            () -> service.updateCategory(selected.category().id(), draft.get()),
            updated -> {
                model.replace(selected.modelRow(), updated);
                statusLabel.setText("Đã cập nhật danh mục \"" + updated.name() + "\".");
            }
        );
    }

    private void toggleSelectedCategory() {
        SelectedCategory selected = selectedCategory("Vui lòng chọn danh mục cần thay đổi.");
        if (selected == null) {
            return;
        }
        Category category = selected.category();
        if (!category.active()) {
            runMutation(
                "Đang kích hoạt danh mục...",
                () -> service.reactivateCategory(category.id()),
                updated -> {
                    model.replace(selected.modelRow(), updated);
                    statusLabel.setText("Đã kích hoạt danh mục \"" + updated.name() + "\".");
                }
            );
            return;
        }

        int confirm = JOptionPane.showConfirmDialog(
            this,
            "Ngừng sử dụng danh mục \"" + category.name() + "\"?\n"
                + "Thao tác chỉ được phép khi không còn sản phẩm đang bán trong danh mục.",
            "Xác nhận ngừng sử dụng",
            JOptionPane.YES_NO_OPTION,
            JOptionPane.WARNING_MESSAGE
        );
        if (confirm != JOptionPane.YES_OPTION) {
            return;
        }
        runMutation(
            "Đang ngừng sử dụng danh mục...",
            () -> service.archiveCategory(category.id()),
            updated -> {
                model.replace(selected.modelRow(), updated);
                statusLabel.setText("Đã ngừng sử dụng danh mục \"" + updated.name() + "\".");
            }
        );
    }

    private <T> void runMutation(
        String pendingMessage,
        java.util.concurrent.Callable<T> operation,
        java.util.function.Consumer<T> onSuccess
    ) {
        setBusy(true);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText(pendingMessage);
        Async.run(
            operation,
            result -> {
                onSuccess.accept(result);
                setBusy(false);
                statusLabel.setForeground(Theme.SUCCESS);
            },
            this::showError
        );
    }

    private void showError(Throwable error) {
        setBusy(false);
        statusLabel.setForeground(Theme.DANGER);
        statusLabel.setText(Async.message(error));
    }

    private SelectedCategory selectedCategory(String message) {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) {
            JOptionPane.showMessageDialog(
                this,
                message,
                "Chưa chọn danh mục",
                JOptionPane.INFORMATION_MESSAGE
            );
            return null;
        }
        int modelRow = table.convertRowIndexToModel(viewRow);
        return new SelectedCategory(modelRow, model.rowAt(modelRow));
    }

    private void setBusy(boolean value) {
        busy = value;
        searchField.setEnabled(!busy);
        refreshButton.setEnabled(!busy);
        addButton.setEnabled(!busy && canManageCatalog);
        updateActionState();
    }

    private void updateActionState() {
        boolean selected = table.getSelectedRow() >= 0;
        editButton.setEnabled(!busy && canManageCatalog && selected);
        stateButton.setEnabled(!busy && canManageCatalog && selected);
        if (selected) {
            Category category = model.rowAt(table.convertRowIndexToModel(table.getSelectedRow()));
            stateButton.setText(category.active() ? "Ngừng sử dụng" : "Kích hoạt");
            stateButton.setForeground(category.active() ? Theme.DANGER : Theme.SUCCESS);
        } else {
            stateButton.setText("Ngừng sử dụng");
            stateButton.setForeground(Theme.DANGER);
        }
    }

    private record SelectedCategory(int modelRow, Category category) {
    }

    private static final class CategoryTableModel extends AbstractTableModel {
        private static final String[] COLUMNS = {
            "ID", "Tên danh mục", "Slug", "Số sản phẩm", "Trạng thái"
        };
        private List<Category> rows = new ArrayList<>();

        @Override
        public int getRowCount() {
            return rows.size();
        }

        @Override
        public int getColumnCount() {
            return COLUMNS.length;
        }

        @Override
        public String getColumnName(int column) {
            return COLUMNS[column];
        }

        @Override
        public Class<?> getColumnClass(int columnIndex) {
            return columnIndex == 0 || columnIndex == 3 ? Number.class : String.class;
        }

        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            Category category = rows.get(rowIndex);
            return switch (columnIndex) {
                case 0 -> category.id();
                case 1 -> category.name();
                case 2 -> category.slug();
                case 3 -> category.productCount();
                case 4 -> category.active() ? "Đang sử dụng" : "Ngừng sử dụng";
                default -> "";
            };
        }

        private Category rowAt(int index) {
            return rows.get(index);
        }

        private void setRows(List<Category> values) {
            rows = new ArrayList<>(values);
            fireTableDataChanged();
        }

        private void add(Category value) {
            rows.add(0, value);
            fireTableRowsInserted(0, 0);
        }

        private void replace(int index, Category value) {
            rows.set(index, value);
            fireTableRowsUpdated(index, index);
        }
    }
}
