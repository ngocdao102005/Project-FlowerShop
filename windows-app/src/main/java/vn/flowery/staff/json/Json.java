package vn.flowery.staff.json;

import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Json {
    private Json() {
    }

    public static Object parse(String source) {
        if (source == null) {
            throw new IllegalArgumentException("JSON không được là null.");
        }
        Parser parser = new Parser(source);
        Object value = parser.parseValue();
        parser.skipWhitespace();
        if (!parser.isAtEnd()) {
            throw parser.error("Còn dữ liệu sau giá trị JSON.");
        }
        return value;
    }

    public static String stringify(Object value) {
        StringBuilder output = new StringBuilder();
        writeValue(output, value);
        return output.toString();
    }

    private static void writeValue(StringBuilder output, Object value) {
        if (value == null) {
            output.append("null");
        } else if (value instanceof String text) {
            writeString(output, text);
        } else if (value instanceof Boolean || value instanceof Byte || value instanceof Short
            || value instanceof Integer || value instanceof Long) {
            output.append(value);
        } else if (value instanceof Float number) {
            if (!Float.isFinite(number)) {
                throw new IllegalArgumentException("JSON không hỗ trợ số vô hạn hoặc NaN.");
            }
            output.append(number);
        } else if (value instanceof Double number) {
            if (!Double.isFinite(number)) {
                throw new IllegalArgumentException("JSON không hỗ trợ số vô hạn hoặc NaN.");
            }
            output.append(number);
        } else if (value instanceof Map<?, ?> map) {
            output.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!(entry.getKey() instanceof String key)) {
                    throw new IllegalArgumentException("Khóa của JSON object phải là chuỗi.");
                }
                if (!first) {
                    output.append(',');
                }
                first = false;
                writeString(output, key);
                output.append(':');
                writeValue(output, entry.getValue());
            }
            output.append('}');
        } else if (value instanceof Iterable<?> values) {
            output.append('[');
            boolean first = true;
            for (Object item : values) {
                if (!first) {
                    output.append(',');
                }
                first = false;
                writeValue(output, item);
            }
            output.append(']');
        } else if (value.getClass().isArray()) {
            output.append('[');
            int length = Array.getLength(value);
            for (int index = 0; index < length; index++) {
                if (index > 0) {
                    output.append(',');
                }
                writeValue(output, Array.get(value, index));
            }
            output.append(']');
        } else {
            throw new IllegalArgumentException("Không thể chuyển kiểu " + value.getClass() + " thành JSON.");
        }
    }

    private static void writeString(StringBuilder output, String value) {
        output.append('"');
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> output.append("\\\"");
                case '\\' -> output.append("\\\\");
                case '\b' -> output.append("\\b");
                case '\f' -> output.append("\\f");
                case '\n' -> output.append("\\n");
                case '\r' -> output.append("\\r");
                case '\t' -> output.append("\\t");
                default -> {
                    if (character < 0x20) {
                        output.append(String.format("\\u%04x", (int) character));
                    } else {
                        output.append(character);
                    }
                }
            }
        }
        output.append('"');
    }

    private static final class Parser {
        private final String source;
        private int position;

        private Parser(String source) {
            this.source = source;
        }

        private Object parseValue() {
            skipWhitespace();
            if (isAtEnd()) {
                throw error("Thiếu giá trị JSON.");
            }
            return switch (source.charAt(position)) {
                case '{' -> parseObject();
                case '[' -> parseArray();
                case '"' -> parseString();
                case 't' -> parseLiteral("true", Boolean.TRUE);
                case 'f' -> parseLiteral("false", Boolean.FALSE);
                case 'n' -> parseLiteral("null", null);
                default -> parseNumber();
            };
        }

        private Map<String, Object> parseObject() {
            expect('{');
            LinkedHashMap<String, Object> result = new LinkedHashMap<>();
            skipWhitespace();
            if (consume('}')) {
                return result;
            }
            do {
                skipWhitespace();
                if (isAtEnd() || source.charAt(position) != '"') {
                    throw error("Khóa JSON object phải là chuỗi.");
                }
                String key = parseString();
                skipWhitespace();
                expect(':');
                result.put(key, parseValue());
                skipWhitespace();
            } while (consume(','));
            expect('}');
            return result;
        }

        private List<Object> parseArray() {
            expect('[');
            ArrayList<Object> result = new ArrayList<>();
            skipWhitespace();
            if (consume(']')) {
                return result;
            }
            do {
                result.add(parseValue());
                skipWhitespace();
            } while (consume(','));
            expect(']');
            return result;
        }

        private String parseString() {
            expect('"');
            StringBuilder value = new StringBuilder();
            while (!isAtEnd()) {
                char character = source.charAt(position++);
                if (character == '"') {
                    return value.toString();
                }
                if (character != '\\') {
                    if (character < 0x20) {
                        throw error("Chuỗi JSON chứa ký tự điều khiển.");
                    }
                    value.append(character);
                    continue;
                }
                if (isAtEnd()) {
                    throw error("Escape JSON chưa hoàn tất.");
                }
                char escaped = source.charAt(position++);
                switch (escaped) {
                    case '"' -> value.append('"');
                    case '\\' -> value.append('\\');
                    case '/' -> value.append('/');
                    case 'b' -> value.append('\b');
                    case 'f' -> value.append('\f');
                    case 'n' -> value.append('\n');
                    case 'r' -> value.append('\r');
                    case 't' -> value.append('\t');
                    case 'u' -> value.append(parseUnicode());
                    default -> throw error("Escape JSON không hợp lệ.");
                }
            }
            throw error("Chuỗi JSON chưa đóng.");
        }

        private char parseUnicode() {
            if (position + 4 > source.length()) {
                throw error("Unicode escape chưa hoàn tất.");
            }
            int value = 0;
            for (int index = 0; index < 4; index++) {
                int digit = Character.digit(source.charAt(position++), 16);
                if (digit < 0) {
                    throw error("Unicode escape không hợp lệ.");
                }
                value = value * 16 + digit;
            }
            return (char) value;
        }

        private Object parseLiteral(String literal, Object value) {
            if (!source.startsWith(literal, position)) {
                throw error("Giá trị JSON không hợp lệ.");
            }
            position += literal.length();
            return value;
        }

        private Number parseNumber() {
            int start = position;
            consume('-');
            if (consume('0')) {
                // Số 0 đứng riêng ở phần nguyên.
            } else {
                readDigits();
            }
            boolean decimal = false;
            if (consume('.')) {
                decimal = true;
                readDigits();
            }
            if (consume('e') || consume('E')) {
                decimal = true;
                consume('+');
                consume('-');
                readDigits();
            }
            if (start == position) {
                throw error("Số JSON không hợp lệ.");
            }
            String number = source.substring(start, position);
            try {
                return decimal ? Double.valueOf(number) : Long.valueOf(number);
            } catch (NumberFormatException error) {
                throw error("Số JSON nằm ngoài phạm vi hỗ trợ.");
            }
        }

        private void readDigits() {
            int start = position;
            while (!isAtEnd() && Character.isDigit(source.charAt(position))) {
                position++;
            }
            if (start == position) {
                throw error("Số JSON thiếu chữ số.");
            }
        }

        private void expect(char expected) {
            if (!consume(expected)) {
                throw error("Cần ký tự '" + expected + "'.");
            }
        }

        private boolean consume(char expected) {
            if (!isAtEnd() && source.charAt(position) == expected) {
                position++;
                return true;
            }
            return false;
        }

        private void skipWhitespace() {
            while (!isAtEnd() && Character.isWhitespace(source.charAt(position))) {
                position++;
            }
        }

        private boolean isAtEnd() {
            return position >= source.length();
        }

        private IllegalArgumentException error(String message) {
            return new IllegalArgumentException(message + " Vị trí " + position + ".");
        }
    }
}
