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
import javax.swing.JSpinner;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.RowFilter;
import javax.swing.SpinnerNumberModel;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.TableCellRenderer;
import javax.swing.table.TableRowSorter;
import vn.flowery.staff.model.Category;
import vn.flowery.staff.model.Product;
import vn.flowery.staff.model.ProductDraft;
import vn.flowery.staff.service.ProductService;
import vn.flowery.staff.ui.Async;
import vn.flowery.staff.ui.ProductFormDialog;
import vn.flowery.staff.ui.Theme;
import vn.flowery.staff.ui.UiText;

public final class ProductsPanel extends JPanel {
    private final ProductService service;
    private final boolean canUpdateStock;
    private final boolean canManageCatalog;
    private final ProductTableModel model = new ProductTableModel();
    private final JTable table = new JTable(model) {
        @Override
        public Component prepareRenderer(TableCellRenderer renderer, int row, int column) {
            Component component = super.prepareRenderer(renderer, row, column);
            if (!isRowSelected(row)) {
                Product product = model.rowAt(convertRowIndexToModel(row));
                component.setBackground(
                    product.stockQuantity() <= 10 && product.active()
                        ? new Color(255, 244, 238)
                        : Theme.SURFACE
                );
                if (!product.active()) {
                    component.setForeground(Theme.MUTED);
                } else {
                    component.setForeground(Theme.TEXT);
                }
            }
            return component;
        }
    };
    private final TableRowSorter<ProductTableModel> sorter = new TableRowSorter<>(model);
    private final JTextField searchField = new JTextField(14);
    private final JButton refreshButton = Theme.secondaryButton("Làm mới");
    private final JButton addButton = Theme.primaryButton("Thêm hoa");
    private final JButton editButton = Theme.secondaryButton("Chỉnh sửa");
    private final JButton archiveButton = Theme.secondaryButton("Ngừng bán");
    private final JButton stockButton = Theme.primaryButton("Cập nhật kho");
    private final JLabel statusLabel = new JLabel(" ");
    private List<Category> categories = List.of();
    private boolean busy;

    public ProductsPanel(
        ProductService service,
        boolean canUpdateStock,
        boolean canManageCatalog
    ) {
        super(new BorderLayout(0, 16));
        this.service = service;
        this.canUpdateStock = canUpdateStock;
        this.canManageCatalog = canManageCatalog;
        setBorder(BorderFactory.createEmptyBorder(28, 28, 28, 28));
        setBackground(Theme.BACKGROUND);

        archiveButton.setForeground(Theme.DANGER);
        addButton.setToolTipText("Tạo một sản phẩm hoa mới");
        editButton.setToolTipText("Chỉnh sửa đầy đủ thông tin sản phẩm đang chọn");
        archiveButton.setToolTipText("Ngừng bán nhưng vẫn giữ dữ liệu và lịch sử");
        stockButton.setToolTipText("Cập nhật nhanh số lượng tồn kho");
        add(createToolbar(), BorderLayout.NORTH);
        add(createTable(), BorderLayout.CENTER);
        statusLabel.setForeground(Theme.MUTED);
        add(statusLabel, BorderLayout.SOUTH);

        refreshButton.addActionListener(event -> refresh());
        addButton.addActionListener(event -> createProduct());
        editButton.addActionListener(event -> editSelectedProduct());
        archiveButton.addActionListener(event -> archiveSelectedProduct());
        stockButton.addActionListener(event -> updateSelectedStock());
        addButton.setVisible(canManageCatalog);
        editButton.setVisible(canManageCatalog);
        archiveButton.setVisible(canManageCatalog);
        stockButton.setVisible(canUpdateStock);
        table.getSelectionModel().addListSelectionListener(event -> {
            if (!event.getValueIsAdjusting()) {
                updateActionState();
            }
        });
        installSearch();
        installDoubleClick();
        updateActionState();
        refresh();
    }

    private JPanel createToolbar() {
        JPanel toolbar = new JPanel(new BorderLayout(0, 12));
        toolbar.setOpaque(false);

        JPanel description = new JPanel();
        description.setOpaque(false);
        description.setLayout(new javax.swing.BoxLayout(description, javax.swing.BoxLayout.Y_AXIS));
        JLabel heading = new JLabel("CRUD sản phẩm hoa");
        heading.setFont(new Font("Segoe UI", Font.BOLD, 18));
        JLabel help = new JLabel(permissionDescription());
        help.setForeground(Theme.MUTED);
        description.add(heading);
        description.add(help);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 7, 0));
        actions.setOpaque(false);
        searchField.setToolTipText("Tìm theo tên, danh mục hoặc trạng thái");
        searchField.setBorder(Theme.compoundBorder());
        actions.add(new JLabel("Tìm kiếm"));
        actions.add(searchField);
        actions.add(refreshButton);
        actions.add(addButton);
        actions.add(editButton);
        actions.add(archiveButton);
        actions.add(stockButton);

        toolbar.add(description, BorderLayout.NORTH);
        toolbar.add(actions, BorderLayout.CENTER);
        return toolbar;
    }

    private String permissionDescription() {
        if (canManageCatalog && canUpdateStock) {
            return "Toàn quyền thêm, xem, sửa, ngừng bán và cập nhật tồn kho.";
        }
        if (canManageCatalog) {
            return "Có quyền thêm, xem, sửa và ngừng bán sản phẩm.";
        }
        if (canUpdateStock) {
            return "Có quyền xem catalog và cập nhật tồn kho.";
        }
        return "Có quyền xem catalog.";
    }

    private JScrollPane createTable() {
        table.setRowSorter(sorter);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setFillsViewportHeight(true);
        table.getTableHeader().setReorderingAllowed(false);
        table.getColumnModel().getColumn(0).setPreferredWidth(55);
        table.getColumnModel().getColumn(1).setPreferredWidth(230);
        table.getColumnModel().getColumn(2).setPreferredWidth(130);
        table.getColumnModel().getColumn(3).setPreferredWidth(115);
        table.getColumnModel().getColumn(4).setPreferredWidth(80);
        table.getColumnModel().getColumn(5).setPreferredWidth(100);
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

    private void installDoubleClick() {
        table.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent event) {
                if (event.getClickCount() == 2 && canManageCatalog) {
                    editSelectedProduct();
                }
            }
        });
    }

    private void filter() {
        String query = searchField.getText().strip();
        if (query.isEmpty()) {
            sorter.setRowFilter(null);
            return;
        }
        sorter.setRowFilter(RowFilter.regexFilter("(?iu)" + Pattern.quote(query), 1, 2, 5));
    }

    public void refresh() {
        setActionsEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang tải sản phẩm và danh mục...");
        Async.run(
            () -> new CatalogData(service.listProducts(), service.listCategories()),
            data -> {
                model.setRows(data.products());
                categories = data.categories();
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Đã tải " + data.products().size() + " sản phẩm.");
            },
            error -> {
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.DANGER);
                statusLabel.setText(Async.message(error));
            }
        );
    }

    private void createProduct() {
        if (!canManageCatalog) {
            return;
        }
        Optional<ProductDraft> result = ProductFormDialog.show(
            this,
            categories,
            null,
            canUpdateStock
        );
        if (result.isEmpty()) {
            return;
        }

        runMutation(
            "Đang tạo sản phẩm mới...",
            () -> service.createProduct(result.get()),
            created -> {
                model.add(created);
                statusLabel.setText("Đã thêm sản phẩm \"" + created.name() + "\".");
            }
        );
    }

    private void editSelectedProduct() {
        if (!canManageCatalog) {
            return;
        }
        SelectedProduct selected = selectedProduct("Vui lòng chọn sản phẩm cần chỉnh sửa.");
        if (selected == null) {
            return;
        }
        Optional<ProductDraft> result = ProductFormDialog.show(
            this,
            categories,
            selected.product(),
            canUpdateStock
        );
        if (result.isEmpty()) {
            return;
        }

        runMutation(
            "Đang cập nhật \"" + selected.product().name() + "\"...",
            () -> service.updateProduct(
                selected.product().id(),
                result.get(),
                canUpdateStock
            ),
            updated -> {
                model.replace(selected.modelRow(), updated);
                statusLabel.setText("Đã cập nhật sản phẩm \"" + updated.name() + "\".");
            }
        );
    }

    private void archiveSelectedProduct() {
        if (!canManageCatalog) {
            return;
        }
        SelectedProduct selected = selectedProduct("Vui lòng chọn sản phẩm cần ngừng bán.");
        if (selected == null) {
            return;
        }
        if (!selected.product().active()) {
            statusLabel.setForeground(Theme.MUTED);
            statusLabel.setText("Sản phẩm này đã ngừng bán.");
            return;
        }

        int confirm = JOptionPane.showConfirmDialog(
            this,
            "Ngừng bán \"" + selected.product().name() + "\"?\n"
                + "Dữ liệu và lịch sử đơn hàng vẫn được giữ lại.",
            "Xác nhận ngừng bán",
            JOptionPane.YES_NO_OPTION,
            JOptionPane.WARNING_MESSAGE
        );
        if (confirm != JOptionPane.YES_OPTION) {
            return;
        }

        setActionsEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang ngừng bán \"" + selected.product().name() + "\"...");
        Async.run(
            () -> {
                service.archiveProduct(selected.product().id());
                return selected.product().withActive(false);
            },
            archived -> {
                model.replace(selected.modelRow(), archived);
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Đã ngừng bán \"" + archived.name() + "\".");
            },
            this::showMutationError
        );
    }

    private void updateSelectedStock() {
        if (!canUpdateStock) {
            return;
        }
        SelectedProduct selected = selectedProduct("Vui lòng chọn sản phẩm cần cập nhật kho.");
        if (selected == null) {
            return;
        }
        Product product = selected.product();
        JSpinner quantity = new JSpinner(
            new SpinnerNumberModel(product.stockQuantity(), 0, 1_000_000, 1)
        );
        quantity.setFont(new Font("Segoe UI", Font.PLAIN, 15));

        JPanel form = new JPanel(new BorderLayout(0, 10));
        form.add(new JLabel(
            "<html>Sản phẩm: <b>" + escapeHtml(product.name()) + "</b><br>"
                + "Tồn kho hiện tại: " + product.stockQuantity() + "</html>"
        ), BorderLayout.NORTH);
        form.add(quantity, BorderLayout.CENTER);

        int confirm = JOptionPane.showConfirmDialog(
            this,
            form,
            "Cập nhật tồn kho",
            JOptionPane.OK_CANCEL_OPTION,
            JOptionPane.PLAIN_MESSAGE
        );
        if (confirm != JOptionPane.OK_OPTION) {
            return;
        }
        int newQuantity = (Integer) quantity.getValue();
        if (newQuantity == product.stockQuantity()) {
            statusLabel.setForeground(Theme.MUTED);
            statusLabel.setText("Số lượng tồn kho không thay đổi.");
            return;
        }

        runMutation(
            "Đang cập nhật tồn kho \"" + product.name() + "\"...",
            () -> service.updateStock(product.id(), newQuantity),
            updated -> {
                model.replace(selected.modelRow(), updated);
                statusLabel.setText(
                    "Đã cập nhật \"" + updated.name() + "\" còn "
                        + updated.stockQuantity() + " sản phẩm."
                );
            }
        );
    }

    private <T> void runMutation(
        String pendingMessage,
        java.util.concurrent.Callable<T> operation,
        java.util.function.Consumer<T> onSuccess
    ) {
        setActionsEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText(pendingMessage);
        Async.run(
            operation,
            result -> {
                onSuccess.accept(result);
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
            },
            this::showMutationError
        );
    }

    private void showMutationError(Throwable error) {
        setActionsEnabled(true);
        statusLabel.setForeground(Theme.DANGER);
        statusLabel.setText(Async.message(error));
    }

    private SelectedProduct selectedProduct(String message) {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) {
            JOptionPane.showMessageDialog(
                this,
                message,
                "Chưa chọn sản phẩm",
                JOptionPane.INFORMATION_MESSAGE
            );
            return null;
        }
        int modelRow = table.convertRowIndexToModel(viewRow);
        return new SelectedProduct(modelRow, model.rowAt(modelRow));
    }

    private void setActionsEnabled(boolean enabled) {
        busy = !enabled;
        searchField.setEnabled(enabled);
        refreshButton.setEnabled(enabled);
        addButton.setEnabled(enabled && canManageCatalog);
        updateActionState();
    }

    private void updateActionState() {
        int viewRow = table.getSelectedRow();
        boolean selected = viewRow >= 0;
        Product product = selected
            ? model.rowAt(table.convertRowIndexToModel(viewRow))
            : null;
        editButton.setEnabled(!busy && canManageCatalog && selected);
        archiveButton.setEnabled(
            !busy && canManageCatalog && selected && product != null && product.active()
        );
        stockButton.setEnabled(!busy && canUpdateStock && selected);
        archiveButton.setText(
            product != null && !product.active() ? "Đã ngừng bán" : "Ngừng bán"
        );
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private record CatalogData(List<Product> products, List<Category> categories) {
    }

    private record SelectedProduct(int modelRow, Product product) {
    }

    private static final class ProductTableModel extends AbstractTableModel {
        private static final String[] COLUMNS = {
            "ID", "Sản phẩm", "Danh mục", "Giá bán", "Tồn kho", "Trạng thái"
        };
        private List<Product> rows = new ArrayList<>();

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
            return columnIndex == 0 || columnIndex == 4 ? Number.class : String.class;
        }

        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            Product product = rows.get(rowIndex);
            return switch (columnIndex) {
                case 0 -> product.id();
                case 1 -> product.name();
                case 2 -> product.categoryName();
                case 3 -> UiText.currency(product.price());
                case 4 -> product.stockQuantity();
                case 5 -> product.active() ? "Đang bán" : "Ngừng bán";
                default -> "";
            };
        }

        private Product rowAt(int index) {
            return rows.get(index);
        }

        private void setRows(List<Product> values) {
            rows = new ArrayList<>(values);
            fireTableDataChanged();
        }

        private void add(Product value) {
            rows.add(0, value);
            fireTableRowsInserted(0, 0);
        }

        private void replace(int index, Product value) {
            rows.set(index, value);
            fireTableRowsUpdated(index, index);
        }
    }
}
