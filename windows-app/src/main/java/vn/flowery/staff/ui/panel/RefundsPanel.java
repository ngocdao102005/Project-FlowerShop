package vn.flowery.staff.ui.panel;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;
import java.util.ArrayList;
import java.util.List;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.ListSelectionModel;
import javax.swing.table.AbstractTableModel;
import vn.flowery.staff.model.RefundRequest;
import vn.flowery.staff.service.RefundService;
import vn.flowery.staff.ui.Async;
import vn.flowery.staff.ui.Theme;
import vn.flowery.staff.ui.UiText;

public final class RefundsPanel extends JPanel {
    private final RefundService service;
    private final RefundTableModel model = new RefundTableModel();
    private final JTable table = new JTable(model);
    private final JButton refreshButton = Theme.secondaryButton("Làm mới");
    private final JButton copyEvidenceButton = Theme.secondaryButton("Sao chép bằng chứng");
    private final JButton approveButton = Theme.primaryButton("Phê duyệt");
    private final JButton rejectButton = Theme.secondaryButton("Từ chối");
    private final JLabel statusLabel = new JLabel(" ");
    private boolean busy;

    public RefundsPanel(RefundService service) {
        super(new BorderLayout(0, 16));
        this.service = service;
        setBorder(BorderFactory.createEmptyBorder(28, 28, 28, 28));
        setBackground(Theme.BACKGROUND);
        add(createToolbar(), BorderLayout.NORTH);
        add(createTable(), BorderLayout.CENTER);
        statusLabel.setForeground(Theme.MUTED);
        add(statusLabel, BorderLayout.SOUTH);

        refreshButton.addActionListener(event -> refresh());
        approveButton.addActionListener(event -> decide("Approved"));
        rejectButton.addActionListener(event -> decide("Rejected"));
        copyEvidenceButton.addActionListener(event -> copyEvidence());
        table.getSelectionModel().addListSelectionListener(event -> updateActionState());
        updateActionState();
        refresh();
    }

    private JPanel createToolbar() {
        JPanel toolbar = new JPanel(new BorderLayout(0, 12));
        toolbar.setOpaque(false);
        JPanel description = new JPanel();
        description.setOpaque(false);
        description.setLayout(new javax.swing.BoxLayout(description, javax.swing.BoxLayout.Y_AXIS));
        JLabel heading = new JLabel("Yêu cầu hoàn tiền");
        heading.setFont(new Font("Segoe UI", Font.BOLD, 18));
        JLabel help = new JLabel("CSKH kiểm tra lý do và bằng chứng; cổng thanh toán hoàn tất yêu cầu đã duyệt.");
        help.setForeground(Theme.MUTED);
        description.add(heading);
        description.add(help);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 9, 0));
        actions.setOpaque(false);
        actions.add(refreshButton);
        actions.add(copyEvidenceButton);
        actions.add(approveButton);
        actions.add(rejectButton);
        toolbar.add(description, BorderLayout.NORTH);
        toolbar.add(actions, BorderLayout.CENTER);
        return toolbar;
    }

    private JScrollPane createTable() {
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setFillsViewportHeight(true);
        table.setAutoCreateRowSorter(true);
        table.getTableHeader().setReorderingAllowed(false);
        int[] widths = {105, 150, 190, 260, 125, 110, 150};
        for (int index = 0; index < widths.length; index++) {
            table.getColumnModel().getColumn(index).setPreferredWidth(widths[index]);
        }
        JScrollPane scroll = new JScrollPane(table);
        scroll.setBorder(BorderFactory.createLineBorder(Theme.BORDER));
        return scroll;
    }

    private void refresh() {
        setActionsEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang tải yêu cầu hoàn tiền...");
        Async.run(
            service::listRefunds,
            rows -> {
                model.setRows(rows);
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Đã tải " + rows.size() + " yêu cầu.");
            },
            error -> {
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.DANGER);
                statusLabel.setText(Async.message(error));
            }
        );
    }

    private void decide(String decision) {
        RefundRequest refund = selectedRefund();
        if (refund == null || !refund.isPending()) {
            return;
        }
        String rejectionReason = "";
        if ("Rejected".equals(decision)) {
            Object value = JOptionPane.showInputDialog(
                this,
                "Nhập lý do từ chối (tối thiểu 5 ký tự):",
                "Từ chối hoàn tiền",
                JOptionPane.WARNING_MESSAGE,
                null,
                null,
                ""
            );
            if (value == null) return;
            rejectionReason = String.valueOf(value).trim();
            if (rejectionReason.length() < 5) {
                JOptionPane.showMessageDialog(this, "Lý do từ chối chưa đủ rõ ràng.", "Thiếu thông tin", JOptionPane.WARNING_MESSAGE);
                return;
            }
        } else {
            int confirm = JOptionPane.showConfirmDialog(
                this,
                "Phê duyệt yêu cầu của đơn " + refund.orderNumber() + "?",
                "Xác nhận phê duyệt",
                JOptionPane.YES_NO_OPTION,
                JOptionPane.QUESTION_MESSAGE
            );
            if (confirm != JOptionPane.YES_OPTION) return;
        }

        String finalReason = rejectionReason;
        setActionsEnabled(false);
        statusLabel.setForeground(Theme.MUTED);
        statusLabel.setText("Đang cập nhật yêu cầu " + refund.orderNumber() + "...");
        Async.run(
            () -> {
                service.decide(refund.id(), decision, finalReason);
                return service.listRefunds();
            },
            rows -> {
                model.setRows(rows);
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.SUCCESS);
                statusLabel.setText("Đã cập nhật yêu cầu " + refund.orderNumber() + ".");
            },
            error -> {
                setActionsEnabled(true);
                statusLabel.setForeground(Theme.DANGER);
                statusLabel.setText(Async.message(error));
            }
        );
    }

    private void copyEvidence() {
        RefundRequest refund = selectedRefund();
        if (refund == null || refund.evidenceUrl().isBlank()) return;
        Toolkit.getDefaultToolkit().getSystemClipboard().setContents(
            new StringSelection(refund.evidenceUrl()),
            null
        );
        statusLabel.setForeground(Theme.SUCCESS);
        statusLabel.setText("Đã sao chép liên kết bằng chứng.");
    }

    private RefundRequest selectedRefund() {
        int viewRow = table.getSelectedRow();
        return viewRow < 0 ? null : model.rowAt(table.convertRowIndexToModel(viewRow));
    }

    private void setActionsEnabled(boolean enabled) {
        busy = !enabled;
        refreshButton.setEnabled(enabled);
        updateActionState();
    }

    private void updateActionState() {
        RefundRequest refund = selectedRefund();
        boolean pending = !busy && refund != null && refund.isPending();
        approveButton.setEnabled(pending);
        rejectButton.setEnabled(pending);
        copyEvidenceButton.setEnabled(!busy && refund != null && !refund.evidenceUrl().isBlank());
    }

    private static final class RefundTableModel extends AbstractTableModel {
        private static final String[] COLUMNS = {
            "Mã đơn", "Khách hàng", "Email", "Lý do", "Số tiền", "Trạng thái", "Ngày tạo"
        };
        private List<RefundRequest> rows = new ArrayList<>();

        @Override public int getRowCount() { return rows.size(); }
        @Override public int getColumnCount() { return COLUMNS.length; }
        @Override public String getColumnName(int column) { return COLUMNS[column]; }

        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            RefundRequest refund = rows.get(rowIndex);
            return switch (columnIndex) {
                case 0 -> refund.orderNumber();
                case 1 -> refund.customerName();
                case 2 -> refund.email();
                case 3 -> refund.reason();
                case 4 -> UiText.currency(refund.amount());
                case 5 -> refund.status();
                case 6 -> refund.createdAt();
                default -> "";
            };
        }

        private RefundRequest rowAt(int index) { return rows.get(index); }
        private void setRows(List<RefundRequest> values) {
            rows = new ArrayList<>(values);
            fireTableDataChanged();
        }
    }
}
