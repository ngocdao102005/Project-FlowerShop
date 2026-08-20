package vn.flowery.staff.service;

import java.util.List;
import java.util.Map;
import vn.flowery.staff.api.ApiTransport;
import vn.flowery.staff.model.Article;
import vn.flowery.staff.model.ArticleDraft;
import vn.flowery.staff.model.Values;

public final class ArticleService {
    private final ApiTransport api;

    public ArticleService(ApiTransport api) {
        this.api = api;
    }

    public List<Article> listArticles() {
        Map<String, Object> payload = Values.object(api.get("/admin/articles"));
        return Values.array(payload.get("items")).stream().map(Article::from).toList();
    }

    public Article create(ArticleDraft draft) {
        Map<String, Object> payload = Values.object(api.post("/admin/articles", draft.toPayload()));
        return Article.from(payload.get("item"));
    }

    public Article update(long id, ArticleDraft draft) {
        Map<String, Object> payload = Values.object(api.put("/admin/articles/" + id, draft.toPayload()));
        return Article.from(payload.get("item"));
    }

    public Article publish(long id) {
        Map<String, Object> payload = Values.object(api.post("/admin/articles/" + id + "/publish", Map.of()));
        return Article.from(payload.get("item"));
    }

    public Article archive(long id) {
        Map<String, Object> payload = Values.object(api.delete("/admin/articles/" + id));
        return Article.from(payload.get("item"));
    }
}
