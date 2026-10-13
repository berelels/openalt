package dev.cattastudios.openalt;

import android.content.Context;
import android.content.SharedPreferences;
import android.view.InputDevice;

import java.util.HashMap;
import java.util.Map;

/**
 * Botões remapeados por controle ("aperte o botão que vai ser o A"), para controles diferentes.
 * Um perfil por controle (pelo descritor do Android, estável entre conexões); o ControllerHandler do
 * Moonlight traduz cada botão por aqui antes de mandar para o PC.
 */
public final class ButtonMap {
    private static final String PREFS = "openalt_button_map";
    private static final int MAX_ENTRIES = 32;

    /** perfis já lidos (o ControllerHandler chama a cada botão); some quando um perfil é salvo */
    private static final Map<String, Map<Integer, Integer>> cache = new HashMap<>();

    private ButtonMap() {}

    static String encode(Map<Integer, Integer> map) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<Integer, Integer> e : map.entrySet()) {
            if (sb.length() > 0) {
                sb.append(',');
            }
            sb.append(e.getKey()).append(':').append(e.getValue());
        }
        return sb.toString();
    }

    static Map<Integer, Integer> decode(String s) {
        Map<Integer, Integer> map = new HashMap<>();
        if (s == null || s.isEmpty()) {
            return map;
        }
        for (String pair : s.split(",")) {
            String[] kv = pair.split(":");
            if (kv.length != 2 || map.size() >= MAX_ENTRIES) {
                continue;
            }
            try {
                int from = Integer.parseInt(kv[0]);
                int to = Integer.parseInt(kv[1]);
                if (from > 0 && to > 0) {
                    map.put(from, to);
                }
            } catch (NumberFormatException ignored) {
                // par estragado: ignora só ele
            }
        }
        return map;
    }

    static String deviceKey(InputDevice device) {
        String d = device != null ? device.getDescriptor() : null;
        return d != null && !d.isEmpty() ? d : null;
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized Map<Integer, Integer> load(Context c, String key) {
        Map<Integer, Integer> m = cache.get(key);
        if (m == null) {
            m = decode(prefs(c).getString(key, null));
            cache.put(key, m);
        }
        return m;
    }

    static synchronized void save(Context c, String key, Map<Integer, Integer> map) {
        prefs(c).edit().putString(key, encode(map)).apply();
        cache.put(key, new HashMap<>(map));
    }

    static synchronized void clear(Context c, String key) {
        prefs(c).edit().remove(key).apply();
        cache.remove(key);
    }

    static synchronized boolean has(Context c, String key) {
        return key != null && !load(c, key).isEmpty();
    }

    /** O botão que o PC deve receber. Sem perfil para este controle, o mesmo botão. */
    public static int translate(Context c, InputDevice device, int keyCode) {
        String key = deviceKey(device);
        if (key == null || c == null) {
            return keyCode;
        }
        Integer to = load(c, key).get(keyCode);
        return to != null ? to : keyCode;
    }
}
