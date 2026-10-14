package dev.cattastudios.openalt;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Todos os endereços do PC que vieram no QR (rede de casa e Tailscale 100.x), guardados por PC.
 *
 * O Moonlight guarda um endereço manual só, e os outros campos são reescritos a cada consulta
 * (o LocalIP do Sunshine é o endereço em que a pergunta chegou; o remoto vem do IP público). Assim,
 * pareando em casa, fora de casa o app não acharia o PC. O ComputerManagerService também consulta
 * estes endereços (mudança marcada "OpenAlt:"), na ordem do QR: rede de casa antes do Tailscale.
 */
public final class KnownAddresses {
    private static final String PREFS = "openalt_known_addresses";
    /** IPv4, IPv6 sem colchetes ou nome de máquina; nada de espaço, vírgula ou barra. */
    private static final Pattern HOST = Pattern.compile("^[A-Za-z0-9.:%_-]{1,253}$");
    static final int MAX_HOSTS = 6;

    private KnownAddresses() {}

    /** Um endereço do PC: host e porta HTTP do Sunshine. */
    public static final class Entry {
        public final String host;
        public final int port;

        Entry(String host, int port) {
            this.host = host;
            this.port = port;
        }
    }

    static String encode(int port, List<String> hosts) {
        StringBuilder sb = new StringBuilder().append(port).append('|');
        int n = 0;
        for (String h : hosts) {
            if (h == null || !HOST.matcher(h).matches() || n == MAX_HOSTS) {
                continue;
            }
            if (n++ > 0) {
                sb.append(',');
            }
            sb.append(h);
        }
        return n == 0 ? null : sb.toString();
    }

    static List<Entry> decode(String s) {
        if (s == null) {
            return Collections.emptyList();
        }
        int bar = s.indexOf('|');
        if (bar <= 0) {
            return Collections.emptyList();
        }
        int port;
        try {
            port = Integer.parseInt(s.substring(0, bar));
        } catch (NumberFormatException e) {
            return Collections.emptyList();
        }
        if (port <= 0 || port > 65535) {
            return Collections.emptyList();
        }
        List<Entry> out = new ArrayList<>();
        for (String h : s.substring(bar + 1).split(",")) {
            if (HOST.matcher(h).matches() && out.size() < MAX_HOSTS) {
                out.add(new Entry(h, port));
            }
        }
        return out;
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void save(Context c, String uuid, int port, List<String> hosts) {
        String value = uuid == null ? null : encode(port, hosts);
        if (value != null) {
            prefs(c).edit().putString(uuid, value).apply();
        }
    }

    public static List<Entry> get(Context c, String uuid) {
        return uuid == null ? Collections.<Entry>emptyList() : decode(prefs(c).getString(uuid, null));
    }
}
