package vn.flowery.staff.ui.panel;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridLayout;
import java.util.ArrayList;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.table.AbstractTableModel;
import vn.flowery.staff.model.Order;
import vn.flowery.staff.service.OrderService;
import vn.flowery.staff.ui.Async;
import vn.flowery.staff.ui.Theme;
import vn.flowery.staff.ui.UiText;

public final class OrdersPanel extends JPanel {
    private final OrderService service;
    private final boolean canManage;
    private final OrderTableModel model = new OrderTableModel();
    private final JTable table = new JTable(model);
    private final JButton refreshButton = Theme.secondaryButton("Làm mới");
    private final JButton updateButton = Theme.primaryButton("Cập nhật trạng thái");
    private final JComboBox<StatusOption> statusBox = new JComboBox<>();
    private final JLabel statusLabel = new JLabel(" ");
    private boolean busy;

    public OrdersPanel(OrderService service) {
        this(service, true);
    }

    public OrdersPanel(OrderService service, boolean canManage) {
        super(new BorderLayout(0, 16));
        this.service = service;
        this.canManage = canManage;
        setBorder(BorderFactory.createEmptyBorder(28, 28, 28, 28));
        setBackground(Theme.BACKGROUND);

        add(createToolbar(), BorderLayout.NORTH);
        add(createTable(), BorderLayout.CENTER);
        statusLabel.setForeground(Theme.MUTED);
        add(statusLabel, BorderLayout.SOUTH);

        refreshButton.addActionListener(event -> refresh());
        updateButton.addActionListener(event -> updateSelectedOrder());
        updateButton.setToolTipText(
            canManage
                ? "Cập nhật theo đúng trình tự Confirmed → Preparing → Shipping"
                : "Tài khoản chỉ có quyền xem đơn hàng"
        );
        table.getSelectionModel().addListSelectionListener(event -> {
            if (!event.getValueIsAdjusting()) {
                selectCurrentStatus();
                updateActionState();
            }
        });
        updateActionState();
        refresh();
    }

    private JPanel createToolbar() {
        JPanel toolbar = new JPanel(new BorderLayout(0, 12));
        toolbar.setOpaque(false);

        JPanel description = new JPanel();
        description.setOpaque(false);
        description.setLayout(new javax.swing.BoxLayout(description, javax.swing.BoxLayout.Y_AXIS));
        JLabel heading = new JLabel("Danh sách đơn hàng");
        heading.setFont(new Font("Segoe UI", Font.BOLD, 18));
        JLabel help = new JLabel(
            canManage
                ? "Kho xử lý tuần tự: xác nhận chuẩn bị, sau đó bàn giao vận chuyển."
                : "Chế độ chỉ xem dành cho nhân viên hỗ trợ khách hàng."
        );
        help.setForeground(Theme.MUTED);
        description.add(heading);
        description.add(help);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 9, 0));
        actions.setOpaque(false);
        statusBox.setPreferredSize(new java.awt.Dimension(155, 39));
        actions.add(refreshButton);
        if (canManage) {
            actions.add(statusBox);
            actions.add(updateButton);
        }

        toolbar.add(description, BorderLayout.NORTH);
        toolbar.add(actions, BorderLayout.CENTER);
        return toolbar;
    }

    private JScrollPane createTable() {
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setFillsViewportHeight(true);
        table.setAutoCreateRowSorter(true);
        table.getTableHeader().setReorderingAllowed(false);
        table.getColumnModel().getColumn(0).setPreferredWidth(110);
        table.getColumnModel().getColumn(1).setPreferredWidth(150);
        table.getColumnModel().getColumn(2).setPreferredWidth(105);
        table.getColumnModel().getColumn(3).setPreferredWidth(105);
        table.getColumnModel().getColumn(4).setPreferredWidth(115);
        table.getColumnModel().getColumn(5).setPreferredWidth(110);
        table.getColumnModel().getColumn(6).setPreferredWidth(135);
        JScrollPane scroll = new JScrollPane(table);
        scroll.setBorder(BorderFactory.createLineBorder(Theme.BORDER));
        return scroll;
    }

    private void refresh() {
        setActionsEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang tải đơn hàng...");
        Async.run(
            service::listOrders,
            orders -> {
                model.setRows(orders);
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Đã tải " + orders.size() + " đơn hàng.");
            },
            error -> {
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.DANGER);
                statusLabel.setText(Async.message(error));
            }
        );
    }

    private void updateSelectedOrder() {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) {
            JOptionPane.showMessageDialog(
                this,
                "Vui lòng chọn một đơn hàng.",
                "Chưa chọn đơn",
                JOptionPane.INFORMATION_MESSAGE
            );
            return;
        }
        int modelRow = table.convertRowIndexToModel(viewRow);
        Order order = model.rowAt(modelRow);
        if (order.isTerminal()) {
            JOptionPane.showMessageDialog(
                this,
                "Đơn hàng đã ở trạng thái kết thúc và không thể cập nhật.",
                "Không thể cập nhật",
                JOptionPane.WARNING_MESSAGE
            );
            return;
        }
        StatusOption selected = (StatusOption) statusBox.getSelectedItem();
        if (selected == null || selected.value().equals(order.status())) {
            statusLabel.setForeground(Theme.MUTED);
            statusLabel.setText("Trạng thái đơn hàng không thay đổi.");
            return;
        }

        String carrier = "";
        String trackingCode = "";
        if ("Shipping".equals(selected.value())) {
            JTextField carrierField = new JTextField();
            JTextField trackingField = new JTextField();
            JPanel handover = new JPanel(new GridLayout(0, 1, 0, 7));
            handover.add(new JLabel("Đơn vị vận chuyển *"));
            handover.add(carrierField);
            handover.add(new JLabel("Mã vận đơn *"));
            handover.add(trackingField);
            int result = JOptionPane.showConfirmDialog(
                this,
                handover,
                "Bàn giao đơn " + order.number(),
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE
            );
            if (result != JOptionPane.OK_OPTION) return;
            carrier = carrierField.getText().trim();
            trackingCode = trackingField.getText().trim();
            if (carrier.length() < 2 || trackingCode.length() < 3) {
                JOptionPane.showMessageDialog(
                    this,
                    "Vui lòng nhập đầy đủ đơn vị vận chuyển và mã vận đơn.",
                    "Thiếu thông tin bàn giao",
                    JOptionPane.WARNING_MESSAGE
                );
                return;
            }
        }

        int confirm = JOptionPane.showConfirmDialog(
            this,
            "Cập nhật đơn " + order.number() + " thành \"" + selected.label() + "\"?",
            "Xác nhận cập nhật",
            JOptionPane.YES_NO_OPTION,
            JOptionPane.QUESTION_MESSAGE
        );
        if (confirm != JOptionPane.YES_OPTION) {
            return;
        }

        setActionsEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang cập nhật " + order.number() + "...");
        String finalCarrier = carrier;
        String finalTrackingCode = trackingCode;
        Async.run(
            () -> service.updateStatus(order.id(), selected.value(), finalCarrier, finalTrackingCode),
            updated -> {
                model.replace(modelRow, updated);
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Đã cập nhật " + updated.number() + ".");
            },
            error -> {
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.DANGER);
                statusLabel.setText(Async.message(error));
            }
        );
    }

    private void selectCurrentStatus() {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) {
            updateActionState();
            return;
        }
        Order order = model.rowAt(table.convertRowIndexToModel(viewRow));
        statusBox.removeAllItems();
        addStatusOption(order.status());
        if ("Confirmed".equals(order.status())) {
            addStatusOption("Preparing");
            addStatusOption("Cancelled");
        } else if ("Preparing".equals(order.status())) {
            addStatusOption("Shipping");
            addStatusOption("Cancelled");
        }
        statusBox.setSelectedIndex(0);
    }

    private void addStatusOption(String value) {
        statusBox.addItem(new StatusOption(value, UiText.orderStatus(value)));
    }

    private void setActionsEnabled(boolean enabled) {
        busy = !enabled;
        refreshButton.setEnabled(enabled);
        updateActionState();
    }

    private void updateActionState() {
        int viewRow = table.getSelectedRow();
        boolean selected = viewRow >= 0;
        Order order = selected
            ? model.rowAt(table.convertRowIndexToModel(viewRow))
            : null;
        boolean canUpdate = canManage && !busy && order != null && !order.isTerminal()
            && !"Shipping".equals(order.status());
        statusBox.setEnabled(canUpdate);
        updateButton.setEnabled(canUpdate);
        updateButton.setText(
            order != null && order.isTerminal() ? "Đơn đã kết thúc" : "Cập nhật trạng thái"
        );
    }

    private record StatusOption(String value, String label) {
        @Override
        public String toString() {
            return label;
        }
    }

    private static final class OrderTableModel extends AbstractTableModel {
        private static final String[] COLUMNS = {
            "Mã đơn", "Khách hàng", "Điện thoại", "Tổng tiền",
            "Thanh toán", "Trạng thái", "Ngày tạo"
        };
        private List<Order> rows = new ArrayList<>();

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
        public Object getValueAt(int rowIndex, int columnIndex) {
            Order order = rows.get(rowIndex);
            return switch (columnIndex) {
                case 0 -> order.number();
                case 1 -> order.customerName();
                case 2 -> order.phone();
                case 3 -> UiText.currency(order.totalAmount());
                case 4 -> UiText.paymentStatus(order.paymentStatus());
                case 5 -> UiText.orderStatus(order.status());
                case 6 -> order.createdAt();
                default -> "";
            };
        }

        private Order rowAt(int index) {
            return rows.get(index);
        }

        private void setRows(List<Order> values) {
            rows = new ArrayList<>(values);
            fireTableDataChanged();
        }

        private void replace(int index, Order value) {
            rows.set(index, value);
            fireTableRowsUpdated(index, index);
        }
    }
}
