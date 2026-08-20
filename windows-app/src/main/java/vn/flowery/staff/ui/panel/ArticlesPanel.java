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
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.table.AbstractTableModel;
import vn.flowery.staff.model.Article;
import vn.flowery.staff.model.ArticleDraft;
import vn.flowery.staff.service.ArticleService;
import vn.flowery.staff.ui.Async;
import vn.flowery.staff.ui.Theme;

public final class ArticlesPanel extends JPanel {
    private final ArticleService service;
    private final ArticleTableModel model = new ArticleTableModel();
    private final JTable table = new JTable(model);
    private final JButton refreshButton = Theme.secondaryButton("Làm mới");
    private final JButton addButton = Theme.primaryButton("Tạo bài viết");
    private final JButton editButton = Theme.secondaryButton("Chỉnh sửa");
    private final JButton publishButton = Theme.secondaryButton("Xuất bản");
    private final JButton archiveButton = Theme.secondaryButton("Lưu trữ");
    private final JLabel statusLabel = new JLabel(" ");
    private boolean busy;

    public ArticlesPanel(ArticleService service) {
        super(new BorderLayout(0, 16));
        this.service = service;
        setBorder(BorderFactory.createEmptyBorder(28, 28, 28, 28));
        setBackground(Theme.BACKGROUND);
        add(createHeader(), BorderLayout.NORTH);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.setRowHeight(34);
        table.setFillsViewportHeight(true);
        table.getSelectionModel().addListSelectionListener(event -> updateActions());
        JScrollPane scroll = new JScrollPane(table);
        scroll.setBorder(BorderFactory.createLineBorder(Theme.BORDER));
        add(scroll, BorderLayout.CENTER);
        statusLabel.setForeground(Theme.MUTED);
        add(statusLabel, BorderLayout.SOUTH);
        refreshButton.addActionListener(event -> refresh());
        addButton.addActionListener(event -> editArticle(null));
        editButton.addActionListener(event -> editArticle(selected()));
        publishButton.addActionListener(event -> publishSelected());
        archiveButton.addActionListener(event -> archiveSelected());
        refresh();
    }

    private JPanel createHeader() {
        JPanel header = new JPanel(new BorderLayout(0, 12));
        header.setOpaque(false);
        JPanel description = new JPanel();
        description.setOpaque(false);
        description.setLayout(new javax.swing.BoxLayout(description, javax.swing.BoxLayout.Y_AXIS));
        JLabel title = new JLabel("Quản lý cẩm nang hoa");
        title.setFont(new Font("Segoe UI", Font.BOLD, 18));
        JLabel help = new JLabel("Tạo bản nháp, gửi duyệt, xuất bản và lưu trữ nội dung.");
        help.setForeground(Theme.MUTED);
        description.add(title);
        description.add(help);
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        actions.setOpaque(false);
        actions.add(refreshButton);
        actions.add(addButton);
        actions.add(editButton);
        actions.add(publishButton);
        actions.add(archiveButton);
        header.add(description, BorderLayout.NORTH);
        header.add(actions, BorderLayout.CENTER);
        return header;
    }

    public void refresh() {
        setBusy(true);
        statusLabel.setText("Đang tải bài viết...");
        Async.run(service::listArticles, items -> {
            model.setRows(items);
            statusLabel.setText("Đã tải " + items.size() + " bài viết.");
            setBusy(false);
        }, error -> showError(error, "Không thể tải bài viết."));
    }

    private void editArticle(Article article) {
        JTextField title = new JTextField(article == null ? "" : article.title());
        JTextField slug = new JTextField(article == null ? "" : article.slug());
        JTextArea summary = new JTextArea(article == null ? "" : article.summary(), 3, 45);
        JTextArea content = new JTextArea(article == null ? "" : article.content(), 10, 45);
        summary.setLineWrap(true);
        summary.setWrapStyleWord(true);
        content.setLineWrap(true);
        content.setWrapStyleWord(true);
        JComboBox<String> status = new JComboBox<>(new String[] {"Draft", "InReview"});
        if (article != null && "InReview".equals(article.status())) status.setSelectedItem("InReview");
        JPanel form = new JPanel(new GridLayout(0, 1, 4, 4));
        form.add(new JLabel("Tiêu đề")); form.add(title);
        form.add(new JLabel("Slug (có thể để trống)")); form.add(slug);
        form.add(new JLabel("Tóm tắt")); form.add(new JScrollPane(summary));
        form.add(new JLabel("Nội dung")); form.add(new JScrollPane(content));
        form.add(new JLabel("Trạng thái")); form.add(status);
        int result = JOptionPane.showConfirmDialog(this, form,
            article == null ? "Tạo bài viết" : "Chỉnh sửa bài viết",
            JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (result != JOptionPane.OK_OPTION) return;
        if (title.getText().strip().length() < 4 || summary.getText().strip().length() < 10
            || content.getText().strip().length() < 20) {
            JOptionPane.showMessageDialog(this,
                "Tiêu đề cần 4 ký tự, tóm tắt 10 ký tự và nội dung 20 ký tự trở lên.",
                "Dữ liệu chưa hợp lệ", JOptionPane.WARNING_MESSAGE);
            return;
        }
        ArticleDraft draft = new ArticleDraft(title.getText(), slug.getText(), summary.getText(),
            content.getText(), String.valueOf(status.getSelectedItem()));
        setBusy(true);
        Async.run(
            () -> article == null ? service.create(draft) : service.update(article.id(), draft),
            saved -> { statusLabel.setText("Đã lưu “" + saved.title() + "”."); refresh(); },
            error -> showError(error, "Không thể lưu bài viết.")
        );
    }

    private void publishSelected() {
        Article article = selected();
        if (article == null || "Published".equals(article.status()) || "Archived".equals(article.status())) return;
        if (JOptionPane.showConfirmDialog(this, "Xuất bản “" + article.title() + "”?",
            "Xác nhận xuất bản", JOptionPane.YES_NO_OPTION) != JOptionPane.YES_OPTION) return;
        setBusy(true);
        Async.run(() -> service.publish(article.id()), saved -> refresh(),
            error -> showError(error, "Không thể xuất bản bài viết."));
    }

    private void archiveSelected() {
        Article article = selected();
        if (article == null || "Archived".equals(article.status())) return;
        if (JOptionPane.showConfirmDialog(this, "Lưu trữ “" + article.title() + "”?",
            "Xác nhận lưu trữ", JOptionPane.YES_NO_OPTION) != JOptionPane.YES_OPTION) return;
        setBusy(true);
        Async.run(() -> service.archive(article.id()), saved -> refresh(),
            error -> showError(error, "Không thể lưu trữ bài viết."));
    }

    private Article selected() {
        int viewRow = table.getSelectedRow();
        return viewRow < 0 ? null : model.rowAt(table.convertRowIndexToModel(viewRow));
    }

    private void setBusy(boolean value) {
        busy = value;
        refreshButton.setEnabled(!busy);
        addButton.setEnabled(!busy);
        updateActions();
    }

    private void updateActions() {
        Article article = selected();
        editButton.setEnabled(!busy && article != null && !"Archived".equals(article.status()));
        publishButton.setEnabled(!busy && article != null
            && !"Published".equals(article.status()) && !"Archived".equals(article.status()));
        archiveButton.setEnabled(!busy && article != null && !"Archived".equals(article.status()));
    }

    private void showError(Throwable error, String fallback) {
        setBusy(false);
        statusLabel.setText(fallback);
        JOptionPane.showMessageDialog(this, Async.message(error), "Flowery", JOptionPane.ERROR_MESSAGE);
    }

    private static final class ArticleTableModel extends AbstractTableModel {
        private final String[] columns = {"ID", "Tiêu đề", "Tác giả", "Phiên bản", "Trạng thái", "Cập nhật"};
        private List<Article> rows = new ArrayList<>();
        void setRows(List<Article> value) { rows = new ArrayList<>(value); fireTableDataChanged(); }
        Article rowAt(int row) { return rows.get(row); }
        @Override public int getRowCount() { return rows.size(); }
        @Override public int getColumnCount() { return columns.length; }
        @Override public String getColumnName(int column) { return columns[column]; }
        @Override public Object getValueAt(int row, int column) {
            Article item = rows.get(row);
            return switch (column) {
                case 0 -> item.id(); case 1 -> item.title(); case 2 -> item.authorName();
                case 3 -> "v" + item.version(); case 4 -> item.status(); default -> item.updatedAt();
            };
        }
    }
}
