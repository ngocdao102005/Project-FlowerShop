package vn.flowery.staff.ui;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.function.Consumer;
import javax.swing.SwingWorker;
import vn.flowery.staff.api.ApiException;

public final class Async {
    private Async() {
    }

    public static <T> void run(
        Callable<T> operation,
        Consumer<T> onSuccess,
        Consumer<Throwable> onFailure
    ) {
        new SwingWorker<T, Void>() {
            @Override
            protected T doInBackground() throws Exception {
                return operation.call();
            }

            @Override
            protected void done() {
                try {
                    onSuccess.accept(get());
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                    onFailure.accept(error);
                } catch (ExecutionException error) {
                    onFailure.accept(error.getCause());
                }
            }
        }.execute();
    }

    public static String message(Throwable error) {
        if (error instanceof ApiException apiError) {
            String request = apiError.requestId().isBlank()
                ? ""
                : "\nMã yêu cầu: " + apiError.requestId();
            return apiError.getMessage() + request;
        }
        String message = error == null ? "" : error.getMessage();
        return message == null || message.isBlank()
            ? "Đã xảy ra lỗi không xác định."
            : message;
    }
}
