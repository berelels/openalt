package dev.cattastudios.openalt;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * O QR de pareamento que o app do PC mostra (core/src/pairing.ts, newPairing):
 * <pre>
 * openalt://pair?v=1&amp;n=&lt;nome do PC&gt;&amp;h=&lt;IPs separados por vírgula&gt;&amp;p=47989
 *   &amp;fp=&lt;SHA-256 do certificado do Sunshine&gt;&amp;pin=&lt;4 dígitos&gt;&amp;d=&lt;id hex&gt;&amp;exp=&lt;unix segundos&gt;
 * </pre>
 * Java puro (sem classes do Android) para ser testado na JVM. A consulta vem de
 * URLSearchParams, então segue application/x-www-form-urlencoded ("+" é espaço).
 */
public final class PairingUri {

    public static final String SCHEME = "openalt";
    public static final String HOST = "pair";
    public static final int VERSION = 1;

    /** Prefixo do nome do cliente: o PC só aceita sozinho "OpenAlt-&lt;d&gt;" ou "OpenAlt-&lt;d&gt; &lt;modelo&gt;". */
    public static final String DEVICE_NAME_PREFIX = "OpenAlt-";

    static final int MAX_URI_LENGTH = 2048;
    static final int MAX_HOSTS = 16;
    static final int MAX_PC_NAME = 64;
    static final int MAX_MODEL = 40;

    private static final Pattern HEX_ID = Pattern.compile("[0-9a-f]{1,32}");
    private static final Pattern PIN = Pattern.compile("[0-9]{4}");
    private static final Pattern FINGERPRINT = Pattern.compile("[0-9a-f]{64}");
    private static final Pattern DIGITS = Pattern.compile("[0-9]{1,12}");
    private static final Pattern IPV4 = Pattern.compile(
            "((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])");
    private static final Pattern HEXTET = Pattern.compile("[0-9a-f]{1,4}");
    private static final Pattern HOSTNAME = Pattern.compile(
            "(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*");

    /** Por que o QR foi recusado; a interface traduz cada caso numa mensagem. */
    public enum Problem {
        NOT_OPENALT,
        UNSUPPORTED_VERSION,
        MISSING_FIELD,
        INVALID_FIELD,
        EXPIRED,
    }

    public static final class InvalidPairingUriException extends Exception {
        private static final long serialVersionUID = 1L;
        public final Problem problem;
        public final String field;

        InvalidPairingUriException(Problem problem, String field) {
            super(field == null ? problem.name() : problem.name() + ": " + field);
            this.problem = problem;
            this.field = field;
        }
    }

    public final String pcName;
    /** Endereços na ordem de tentativa: rede local primeiro, 100.x (Tailscale) por último. */
    public final List<String> hosts;
    public final int port;
    /** SHA-256 do certificado do Sunshine, 64 caracteres hex minúsculos. */
    public final String fingerprint;
    public final String pin;
    public final String requestId;
    public final long expiresAtSeconds;

    private PairingUri(String pcName, List<String> hosts, int port, String fingerprint,
                       String pin, String requestId, long expiresAtSeconds) {
        this.pcName = pcName;
        this.hosts = hosts;
        this.port = port;
        this.fingerprint = fingerprint;
        this.pin = pin;
        this.requestId = requestId;
        this.expiresAtSeconds = expiresAtSeconds;
    }

    /** Lê e valida o texto do QR. {@code nowSeconds}: relógio do aparelho, em segundos unix. */
    public static PairingUri parse(String text, long nowSeconds) throws InvalidPairingUriException {
        if (text == null) {
            throw new InvalidPairingUriException(Problem.NOT_OPENALT, null);
        }
        text = text.trim();
        String prefix = SCHEME + "://" + HOST + "?";
        if (text.length() > MAX_URI_LENGTH || !text.regionMatches(true, 0, prefix, 0, prefix.length())) {
            throw new InvalidPairingUriException(Problem.NOT_OPENALT, null);
        }

        String query = text.substring(prefix.length());
        int fragment = query.indexOf('#');
        if (fragment >= 0) {
            query = query.substring(0, fragment);
        }
        Map<String, String> q = parseQuery(query);

        String v = q.get("v");
        if (v == null) {
            throw new InvalidPairingUriException(Problem.MISSING_FIELD, "v");
        }
        if (!v.equals(String.valueOf(VERSION))) {
            throw new InvalidPairingUriException(Problem.UNSUPPORTED_VERSION, "v");
        }

        // A validade vem antes dos outros campos: um QR vencido é sempre "vencido", mesmo que o resto falhe.
        String exp = require(q, "exp");
        if (!DIGITS.matcher(exp).matches()) {
            throw new InvalidPairingUriException(Problem.INVALID_FIELD, "exp");
        }
        long expiresAt = Long.parseLong(exp);
        if (nowSeconds >= expiresAt) {
            throw new InvalidPairingUriException(Problem.EXPIRED, "exp");
        }

        String pin = require(q, "pin");
        if (!PIN.matcher(pin).matches()) {
            throw new InvalidPairingUriException(Problem.INVALID_FIELD, "pin");
        }

        String id = require(q, "d").toLowerCase(Locale.ROOT);
        if (!HEX_ID.matcher(id).matches()) {
            throw new InvalidPairingUriException(Problem.INVALID_FIELD, "d");
        }

        String fp = normalizeFingerprint(require(q, "fp"));
        if (!FINGERPRINT.matcher(fp).matches()) {
            throw new InvalidPairingUriException(Problem.INVALID_FIELD, "fp");
        }

        String p = require(q, "p");
        int port = DIGITS.matcher(p).matches() && p.length() <= 5 ? Integer.parseInt(p) : -1;
        if (port < 1 || port > 65535) {
            throw new InvalidPairingUriException(Problem.INVALID_FIELD, "p");
        }

        List<String> hosts = parseHosts(require(q, "h"));

        String name = q.get("n");
        name = name == null ? "" : cleanText(name, MAX_PC_NAME);

        return new PairingUri(name, hosts, port, fp, pin, id, expiresAt);
    }

    /** Nome que vai no pedido de pareamento: "OpenAlt-&lt;d&gt;" ou "OpenAlt-&lt;d&gt; &lt;modelo&gt;". */
    public String deviceName(String model) {
        String base = DEVICE_NAME_PREFIX + requestId;
        // Só caracteres que o PC preserva (friendlyName em core/src/pairing.ts), sem espaço duplo
        String m = model == null ? "" : model.replaceAll("[^\\p{L}\\p{N} ._()+\\-]", "")
                .replaceAll("\\s+", " ").trim();
        if (m.length() > MAX_MODEL) {
            m = m.substring(0, MAX_MODEL).trim();
        }
        return m.isEmpty() ? base : base + " " + m;
    }

    /** O certificado (DER) que o PC apresentou é o do QR? Comparação em tempo constante. */
    public boolean certificateMatches(byte[] encodedCertificate) {
        if (encodedCertificate == null) {
            return false;
        }
        try {
            byte[] actual = MessageDigest.getInstance("SHA-256").digest(encodedCertificate);
            return MessageDigest.isEqual(actual, hexToBytes(fingerprint));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public byte[] fingerprintBytes() {
        return hexToBytes(fingerprint);
    }

    /** Segundos de validade que restam (0 se vencido). */
    public long secondsLeft(long nowSeconds) {
        return Math.max(0, expiresAtSeconds - nowSeconds);
    }

    /** Tailscale usa 100.64.0.0/10; o PC manda qualquer 100.x por último, e o aparelho segue a mesma regra. */
    public static boolean isTailscaleAddress(String host) {
        return host.startsWith("100.") && IPV4.matcher(host).matches();
    }

    static String normalizeFingerprint(String fp) {
        return fp.replace(":", "").trim().toLowerCase(Locale.ROOT);
    }

    private static List<String> parseHosts(String raw) throws InvalidPairingUriException {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String part : raw.split(",", -1)) {
            String h = part.trim().toLowerCase(Locale.ROOT);
            if (h.startsWith("[") && h.endsWith("]")) {
                h = h.substring(1, h.length() - 1);
            }
            if (h.isEmpty()) {
                continue;
            }
            if (!isValidHost(h)) {
                throw new InvalidPairingUriException(Problem.INVALID_FIELD, "h");
            }
            unique.add(h);
        }
        if (unique.isEmpty()) {
            throw new InvalidPairingUriException(Problem.MISSING_FIELD, "h");
        }
        if (unique.size() > MAX_HOSTS) {
            throw new InvalidPairingUriException(Problem.INVALID_FIELD, "h");
        }

        // Ordem do PC mantida; os 100.x (Tailscale) vão para o fim
        List<String> local = new ArrayList<>();
        List<String> tailscale = new ArrayList<>();
        for (String h : unique) {
            (isTailscaleAddress(h) ? tailscale : local).add(h);
        }
        local.addAll(tailscale);
        return Collections.unmodifiableList(local);
    }

    static boolean isValidHost(String h) {
        if (IPV4.matcher(h).matches()) {
            return true;
        }
        if (h.indexOf(':') >= 0) {
            return isIpv6(h);
        }
        // Nome (ex.: MagicDNS do Tailscale, M3). Um nome só de números e pontos seria um IPv4 inválido.
        return HOSTNAME.matcher(h).matches() && !h.matches("[0-9.]+");
    }

    /** IPv6 literal (com "::" e IPv4 no fim), sem zona; sem consultar DNS. */
    static boolean isIpv6(String h) {
        if (h.length() > 45) {
            return false;
        }
        int compress = h.indexOf("::");
        if (compress >= 0 && h.indexOf("::", compress + 1) >= 0) {
            return false;
        }
        String[] parts = h.split(":", -1);
        int groups = 0;
        for (int i = 0; i < parts.length; i++) {
            String part = parts[i];
            if (part.isEmpty()) {
                continue; // só aparece junto do "::" (ou nas pontas dele)
            }
            if (i == parts.length - 1 && IPV4.matcher(part).matches()) {
                groups += 2;
            } else if (HEXTET.matcher(part).matches()) {
                groups++;
            } else {
                return false;
            }
        }
        if (compress < 0) {
            // Sem "::": exatamente 8 grupos e nenhum vazio
            return groups == 8 && !h.startsWith(":") && !h.endsWith(":");
        }
        // Com "::": dois-pontos solto só nas pontas do "::"
        if ((h.startsWith(":") && !h.startsWith("::")) || (h.endsWith(":") && !h.endsWith("::"))) {
            return false;
        }
        return groups <= 7;
    }

    private static Map<String, String> parseQuery(String query) throws InvalidPairingUriException {
        Map<String, String> out = new HashMap<>();
        if (query.isEmpty()) {
            return out;
        }
        for (String pair : query.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }
            int eq = pair.indexOf('=');
            String key = decode(eq < 0 ? pair : pair.substring(0, eq), null);
            String value = decode(eq < 0 ? "" : pair.substring(eq + 1), key);
            // Campo repetido é ambíguo (qual valeria?): recusa em vez de escolher
            if (out.put(key, value) != null) {
                throw new InvalidPairingUriException(Problem.INVALID_FIELD, key);
            }
        }
        return out;
    }

    private static String decode(String s, String field) throws InvalidPairingUriException {
        try {
            return URLDecoder.decode(s, "UTF-8");
        } catch (IllegalArgumentException | UnsupportedEncodingException e) {
            throw new InvalidPairingUriException(Problem.INVALID_FIELD, field);
        }
    }

    private static String require(Map<String, String> q, String key) throws InvalidPairingUriException {
        String v = q.get(key);
        if (v == null || v.isEmpty()) {
            throw new InvalidPairingUriException(Problem.MISSING_FIELD, key);
        }
        return v;
    }

    /** Tira caracteres de controle e corta no tamanho máximo (o nome do PC aparece na tela). */
    static String cleanText(String s, int max) {
        String t = s.replaceAll("\\p{Cc}", " ").replaceAll("\\p{Cf}", "").replaceAll("\\s+", " ").trim();
        return t.length() > max ? t.substring(0, max).trim() : t;
    }

    private static byte[] hexToBytes(String hex) {
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(hex.substring(2 * i, 2 * i + 2), 16);
        }
        return out;
    }
}
