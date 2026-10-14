package dev.cattastudios.openalt;

import android.content.Context;
import android.content.res.Resources;
import android.content.res.XmlResourceParser;

import com.limelight.LimeLog;
import com.limelight.R;

import org.xmlpull.v1.XmlPullParser;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * As opções do Moonlight lidas do próprio res/xml/preferences.xml: assim a tela de Configurações
 * do OpenAlt mostra TODAS as opções, com os títulos e descrições já traduzidos do Moonlight, e uma
 * opção nova do Moonlight aparece sozinha (em "Mais", até ganhar categoria).
 */
final class SettingsModel {
    enum Kind { CHECK, LIST, SEEK }

    enum Category { VIDEO, AUDIO, CONTROLLER, TOUCH, MORE, ABOUT }

    static final class Item {
        Kind kind;
        String key;
        CharSequence title;
        CharSequence summary;
        CharSequence[] entries;
        CharSequence[] values;
        String defaultString;
        boolean defaultBool;
        int defaultInt;
        boolean hasDefaultInt;
        int min = 0;
        int max = 100;
        int step = 1;
        int divisor = 1;
        CharSequence suffix;
        Category category;
    }

    private static final String ANDROID = "http://schemas.android.com/apk/res/android";
    private static final String SEEKBAR = "http://schemas.moonlight-stream.com/apk/res/seekbar";

    /** Em que categoria cada opção aparece; o que não estiver aqui vai para "Mais". */
    private static final Map<String, Category> CATEGORY = new HashMap<>();

    static {
        for (String k : new String[]{"list_resolution", "list_fps", "seekbar_bitrate_kbps", "frame_pacing",
                "checkbox_stretch_video", "video_format", "checkbox_enable_hdr", "checkbox_full_range"}) {
            CATEGORY.put(k, Category.VIDEO);
        }
        for (String k : new String[]{"checkbox_host_audio", "openalt_ui_sounds", "list_audio_config", "checkbox_enable_audiofx"}) {
            CATEGORY.put(k, Category.AUDIO);
        }
        for (String k : new String[]{"openalt_controller_style", "seekbar_deadzone", "checkbox_flip_face_buttons",
                "checkbox_multi_controller", "checkbox_mouse_emulation", "analog_scrolling", "checkbox_vibrate_fallback",
                "seekbar_vibrate_fallback_strength", "checkbox_gamepad_touchpad_as_mouse", "checkbox_gamepad_motion_sensors",
                "checkbox_gamepad_motion_fallback", "checkbox_usb_driver", "checkbox_usb_bind_all"}) {
            CATEGORY.put(k, Category.CONTROLLER);
        }
        for (String k : new String[]{"checkbox_touchscreen_trackpad", "checkbox_mouse_nav_buttons", "checkbox_absolute_mouse_mode",
                "checkbox_show_onscreen_controls", "checkbox_vibrate_osc", "checkbox_only_show_L3R3",
                "checkbox_show_guide_button", "seekbar_osc_opacity", "checkbox_enable_pip"}) {
            CATEGORY.put(k, Category.TOUCH);
        }
    }

    private SettingsModel() {}

    static List<Item> load(Context context) {
        List<Item> items = new ArrayList<>();
        Resources res = context.getResources();
        // sem try-with-resources: o XmlResourceParser só é AutoCloseable a partir de versões novas do Android
        XmlResourceParser p = res.getXml(R.xml.preferences);
        try {
            for (int ev = p.getEventType(); ev != XmlPullParser.END_DOCUMENT; ev = p.next()) {
                if (ev != XmlPullParser.START_TAG) {
                    continue;
                }
                String tag = p.getName();
                Kind kind;
                if ("CheckBoxPreference".equals(tag)) {
                    kind = Kind.CHECK;
                }
                else if ("ListPreference".equals(tag)) {
                    kind = Kind.LIST;
                }
                else if (tag.endsWith(".SeekBarPreference")) {
                    kind = Kind.SEEK;
                }
                else {
                    // categorias, idioma, links e telas especiais ficam na lista original do Moonlight
                    continue;
                }
                Item it = new Item();
                it.kind = kind;
                it.key = p.getAttributeValue(ANDROID, "key");
                if (it.key == null) {
                    continue;
                }
                it.title = text(res, p, "title");
                it.summary = text(res, p, "summary");
                int entries = p.getAttributeResourceValue(ANDROID, "entries", 0);
                int values = p.getAttributeResourceValue(ANDROID, "entryValues", 0);
                if (entries != 0) {
                    it.entries = res.getTextArray(entries);
                }
                if (values != 0) {
                    it.values = res.getTextArray(values);
                }
                if (kind == Kind.CHECK) {
                    it.defaultBool = p.getAttributeBooleanValue(ANDROID, "defaultValue", false);
                }
                else if (kind == Kind.LIST) {
                    it.defaultString = p.getAttributeValue(ANDROID, "defaultValue");
                }
                else {
                    String d = p.getAttributeValue(ANDROID, "defaultValue");
                    it.hasDefaultInt = d != null;
                    it.defaultInt = p.getAttributeIntValue(ANDROID, "defaultValue", 0);
                    it.max = p.getAttributeIntValue(ANDROID, "max", 100);
                    it.min = p.getAttributeIntValue(SEEKBAR, "min", 1);
                    it.step = Math.max(1, p.getAttributeIntValue(SEEKBAR, "step", 1));
                    it.divisor = Math.max(1, p.getAttributeIntValue(SEEKBAR, "divisor", 1));
                    it.suffix = text(res, p, "text");
                }
                Category c = CATEGORY.get(it.key);
                it.category = c != null ? c : Category.MORE;
                items.add(it);
            }
        } catch (Exception e) {
            LimeLog.warning("OpenAlt: could not read preferences.xml: " + e);
            return Collections.emptyList();
        } finally {
            p.close();
        }
        return items;
    }

    private static CharSequence text(Resources res, XmlResourceParser p, String attr) {
        int id = p.getAttributeResourceValue(ANDROID, attr, 0);
        if (id != 0) {
            return res.getText(id);
        }
        return p.getAttributeValue(ANDROID, attr);
    }

    /** Valor de um número com o divisor e o sufixo do Moonlight (ex.: 20000 kbps → "20 Mbps"). */
    static String formatNumber(Item it, int value) {
        String n;
        if (it.divisor > 1) {
            double v = value / (double) it.divisor;
            n = v == Math.rint(v) ? String.valueOf((long) v) : String.format(java.util.Locale.getDefault(), "%.1f", v);
        }
        else {
            n = String.valueOf(value);
        }
        return it.suffix != null ? n + " " + it.suffix : n;
    }

    /** Próximo valor de um número ao apertar - ou +, dentro dos limites e do passo do Moonlight. */
    static int stepValue(Item it, int current, int direction) {
        int step = it.step;
        // números grandes (qualidade em kbps) andam em passos maiores
        if (it.max - it.min > 20000) {
            step = Math.max(step, 1000);
        }
        int next = current + direction * step;
        next = Math.round(next / (float) it.step) * it.step;
        return Math.max(it.min, Math.min(it.max, next));
    }
}
