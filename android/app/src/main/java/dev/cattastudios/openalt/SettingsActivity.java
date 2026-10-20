package dev.cattastudios.openalt;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.util.TypedValue;
import android.view.Display;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.GridLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.limelight.R;
import com.limelight.preferences.PreferenceConfiguration;
import com.limelight.preferences.StreamSettings;
import com.limelight.utils.UiHelper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * As Configurações do OpenAlt, com jeito de console: categorias com ícones (Vídeo, Som, Controle,
 * Tela e toque, Mais, Sobre) e cada opção num cartão grande, por toque ou controle.
 *
 * As opções e os valores salvos são os do Moonlight (SettingsModel lê o preferences.xml dele); só a
 * tela muda. O que não é liga/desliga, lista ou número (idioma, ajuda, posição dos controles na tela)
 * fica na lista original, aberta por "Todas as configurações do Moonlight" em Mais.
 */
public class SettingsActivity extends Activity {
    private static final String STATE_CATEGORY = "category";

    private static final SettingsModel.Category[] ORDER = SettingsModel.Category.values();
    private static final int[] TITLES = {R.string.openalt_cat_video, R.string.openalt_cat_audio, R.string.openalt_cat_controller,
            R.string.openalt_cat_touch, R.string.openalt_cat_more, R.string.openalt_cat_about};
    private static final int[] SUBS = {R.string.openalt_cat_video_sub, R.string.openalt_cat_audio_sub, R.string.openalt_cat_controller_sub,
            R.string.openalt_cat_touch_sub, R.string.openalt_cat_more_sub, R.string.openalt_cat_about_sub};
    private static final int[] ICONS = {R.drawable.oa_ic_video, R.drawable.oa_ic_audio, R.drawable.oa_ic_gamepad,
            R.drawable.oa_ic_touch, R.drawable.oa_ic_more, R.drawable.oa_ic_info};

    private List<SettingsModel.Item> items;
    private SharedPreferences prefs;
    private ViewGroup rail;
    private LinearLayout rows;
    private TextView categoryTitle;
    private View contentScroll;
    private View railScroll;
    /** -1 = em pé, mostrando a grade de categorias */
    private int current = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UiHelper.setLocale(this);
        Immersive.prepare(this);
        setContentView(R.layout.oa_settings);
        GridPaperDrawable.apply(((android.view.ViewGroup) findViewById(android.R.id.content)).getChildAt(0));

        prefs = PreferenceManager.getDefaultSharedPreferences(this);
        UiSounds.attach(this);
        items = SettingsModel.load(this);
        rail = findViewById(R.id.oaRail);
        rows = findViewById(R.id.oaRows);
        categoryTitle = findViewById(R.id.oaCategoryTitle);
        contentScroll = findViewById(R.id.oaContentScroll);
        railScroll = findViewById(R.id.oaRailScroll);
        ImageButton back = findViewById(R.id.oaBack);
        back.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onBackPressed();
            }
        });

        current = savedInstanceState != null ? savedInstanceState.getInt(STATE_CATEGORY, 0) : (Ui.portrait(SettingsActivity.this) ? -1 : 0);
        if (!Ui.portrait(SettingsActivity.this) && current < 0) {
            current = 0;
        }
        buildRail();
        showCategory(current, false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        Immersive.apply(this);
        if (current >= 0) {
            showCategory(current, false); // volta da lista original: os valores podem ter mudado
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            Immersive.apply(this);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putInt(STATE_CATEGORY, current);
    }



    private int color(int id) {
        return getResources().getColor(id);
    }

    // ── categorias ─────────────────────────────────────────────────────────

    private void buildRail() {
        rail.removeAllViews();
        for (int i = 0; i < ORDER.length; i++) {
            final int index = i;
            LinearLayout b = new LinearLayout(this);
            b.setFocusable(true);
            b.setClickable(true);
            b.setBackgroundResource(Ui.portrait(SettingsActivity.this) ? R.drawable.oa_row_bg : R.drawable.oa_rail_item_bg);
            b.setGravity(Ui.portrait(SettingsActivity.this) ? Gravity.START : Gravity.CENTER_VERTICAL);
            b.setOrientation(Ui.portrait(SettingsActivity.this) ? LinearLayout.VERTICAL : LinearLayout.HORIZONTAL);
            b.setPadding(Ui.dp(SettingsActivity.this, 16), Ui.dp(SettingsActivity.this, Ui.portrait(SettingsActivity.this) ? 18 : 0), Ui.dp(SettingsActivity.this, 16), Ui.dp(SettingsActivity.this, Ui.portrait(SettingsActivity.this) ? 18 : 0));
            b.setMinimumHeight(Ui.dp(SettingsActivity.this, Ui.portrait(SettingsActivity.this) ? 132 : 56));
            b.setContentDescription(getString(TITLES[i]));

            ImageView icon = new ImageView(this);
            icon.setImageResource(ICONS[i]);
            icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            int size = Ui.dp(SettingsActivity.this, Ui.portrait(SettingsActivity.this) ? 30 : 24);
            b.addView(icon, new LinearLayout.LayoutParams(size, size));

            TextView label = new TextView(this);
            label.setText(TITLES[i]);
            label.setTextColor(color(R.color.oa_text));
            label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            label.setTypeface(label.getTypeface(), android.graphics.Typeface.BOLD);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            if (Ui.portrait(SettingsActivity.this)) {
                lp.topMargin = Ui.dp(SettingsActivity.this, 18);
            }
            else {
                lp.leftMargin = Ui.dp(SettingsActivity.this, 14);
            }
            b.addView(label, lp);
            if (Ui.portrait(SettingsActivity.this)) {
                TextView sub = new TextView(this);
                sub.setText(SUBS[i]);
                sub.setTextColor(color(R.color.oa_text));
                sub.setAlpha(0.8f);
                sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                b.addView(sub);
            }

            b.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    UiSounds.play(SettingsActivity.this, UiSoundSynth.Sound.SELECT);
                    showCategory(index, true);
                }
            });
            // deitado, o foco no trilho já mostra a categoria (como nos consoles)
            if (!Ui.portrait(SettingsActivity.this)) {
                b.setOnFocusChangeListener(new View.OnFocusChangeListener() {
                    @Override
                    public void onFocusChange(View v, boolean hasFocus) {
                        if (hasFocus && current != index) {
                            showCategory(index, false);
                        }
                    }
                });
            }

            if (Ui.portrait(SettingsActivity.this)) {
                GridLayout.LayoutParams g = new GridLayout.LayoutParams(GridLayout.spec(i / 2, 1f), GridLayout.spec(i % 2, 1f));
                g.width = 0;
                g.setMargins(Ui.dp(SettingsActivity.this, 6), Ui.dp(SettingsActivity.this, 6), Ui.dp(SettingsActivity.this, 6), Ui.dp(SettingsActivity.this, 6));
                rail.addView(b, g);
            }
            else {
                LinearLayout.LayoutParams r = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                r.bottomMargin = Ui.dp(SettingsActivity.this, 6);
                rail.addView(b, r);
            }
        }
    }

    private void showCategory(int index, boolean focusContent) {
        current = index;
        boolean grid = Ui.portrait(SettingsActivity.this) && index < 0;
        if (railScroll != null) {
            railScroll.setVisibility(grid ? View.VISIBLE : View.GONE);
        }
        contentScroll.setVisibility(grid ? View.GONE : View.VISIBLE);
        for (int i = 0; i < rail.getChildCount(); i++) {
            rail.getChildAt(i).setSelected(i == index);
        }
        if (grid) {
            return;
        }
        categoryTitle.setText(TITLES[index]);
        buildRows(ORDER[index]);
        if (focusContent && rows.getChildCount() > 0) {
            rows.getChildAt(0).requestFocus();
        }
    }

    @Override
    public void onBackPressed() {
        UiSounds.play(this, UiSoundSynth.Sound.BACK);
        if (Ui.portrait(SettingsActivity.this) && current >= 0) {
            showCategory(-1, false);
            if (rail.getChildCount() > 0) {
                rail.getChildAt(0).requestFocus();
            }
            return;
        }
        super.onBackPressed();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // LB / RB trocam de categoria
        if ((keyCode == KeyEvent.KEYCODE_BUTTON_L1 || keyCode == KeyEvent.KEYCODE_BUTTON_R1) && current >= 0) {
            int next = (current + (keyCode == KeyEvent.KEYCODE_BUTTON_R1 ? 1 : ORDER.length - 1)) % ORDER.length;
            UiSounds.play(this, UiSoundSynth.Sound.SELECT);
            showCategory(next, true);
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_BUTTON_A) {
            View f = getCurrentFocus();
            if (f != null) {
                f.performClick();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    // ── opções ─────────────────────────────────────────────────────────────

    private void buildRows(SettingsModel.Category category) {
        rows.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(this);
        if (category == SettingsModel.Category.CONTROLLER) {
            addMappingRows(inflater);
        }
        if (category == SettingsModel.Category.AUDIO) {
            addLinkRow(inflater, R.drawable.oa_ic_info, getString(R.string.openalt_audio_tip_title),
                    getString(R.string.openalt_audio_tip), null);
        }
        if (category == SettingsModel.Category.ABOUT) {
            addLinkRow(inflater, R.drawable.oa_ic_info, getString(R.string.openalt_app_name) + " " + versionName(),
                    getString(R.string.openalt_about_text), null);
            addTourRow(inflater);
        }
        for (SettingsModel.Item it : items) {
            if (it.category == category) {
                addRow(inflater, it, ICONS[category.ordinal()]);
            }
        }
        if (category == SettingsModel.Category.MORE || category == SettingsModel.Category.ABOUT) {
            addLinkRow(inflater, R.drawable.oa_ic_more, getString(R.string.openalt_settings_all),
                    getString(R.string.openalt_settings_all_summary), new Intent(this, StreamSettings.class));
        }
    }

    /** "Mapear botões" e "Voltar ao padrão", para o controle conectado agora. */
    private void addMappingRows(LayoutInflater inflater) {
        android.view.InputDevice pad = ButtonMapActivity.firstGamepad(this);
        final String key = ButtonMap.deviceKey(pad);
        addLinkRow(inflater, R.drawable.oa_ic_gamepad, getString(R.string.openalt_map_title),
                getString(R.string.openalt_map_summary), new Intent(this, ButtonMapActivity.class));
        if (key != null && ButtonMap.has(this, key)) {
            addActionRow(inflater, R.drawable.oa_ic_gamepad, getString(R.string.openalt_map_reset),
                    getString(R.string.openalt_map_reset_summary), getString(R.string.openalt_map_custom), new Runnable() {
                        @Override
                        public void run() {
                            ButtonMap.clear(SettingsActivity.this, key);
                            UiSounds.play(SettingsActivity.this, UiSoundSynth.Sound.TOGGLE_OFF);
                            android.widget.Toast.makeText(SettingsActivity.this, R.string.openalt_map_reset_done, android.widget.Toast.LENGTH_SHORT).show();
                            showCategory(current, false);
                        }
                    });
        }
    }

    /** "Fazer o tour de novo": volta para a tela de entrada, que mostra o tour. */
    private void addTourRow(LayoutInflater inflater) {
        addActionRow(inflater, R.drawable.oa_ic_info, getString(R.string.openalt_tour_again),
                getString(R.string.openalt_tour_again_summary), getString(R.string.openalt_settings_open), new Runnable() {
                    @Override
                    public void run() {
                        UiSounds.play(SettingsActivity.this, UiSoundSynth.Sound.SELECT);
                        prefs.edit().putBoolean(StartActivity.TOUR_DONE, false).apply();
                        finish();
                    }
                });
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    /** Linha que abre outra tela; sem `intent`, só texto (ex.: a versão em Sobre). */
    private void addLinkRow(LayoutInflater inflater, int icon, String title, String hint, final Intent intent) {
        addActionRow(inflater, icon, title, hint, intent == null ? null : getString(R.string.openalt_settings_open),
                intent == null ? null : new Runnable() {
                    @Override
                    public void run() {
                        UiSounds.play(SettingsActivity.this, UiSoundSynth.Sound.SELECT);
                        startActivity(intent);
                    }
                });
    }

    /** Uma linha com ícone, nome, explicação e o valor à direita; `action` null = só texto. */
    private void addActionRow(LayoutInflater inflater, int icon, String title, String hint, String value, final Runnable action) {
        View row = inflater.inflate(R.layout.oa_setting_row, rows, false);
        stackValueBelow(row);
        ((ImageView) row.findViewById(R.id.oaRowIcon)).setImageResource(icon);
        ((TextView) row.findViewById(R.id.oaRowTitle)).setText(title);
        ((TextView) row.findViewById(R.id.oaRowHint)).setText(hint);
        TextView v = row.findViewById(R.id.oaRowValue);
        if (value == null) {
            v.setVisibility(View.GONE);
        }
        else {
            v.setText(value);
        }
        if (action == null) {
            row.setFocusable(false);
            row.setClickable(false);
        }
        else {
            row.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    action.run();
                }
            });
        }
        rows.addView(row);
    }

    /** Em pé não cabe tudo numa linha: o valor (e o - e +) desce para baixo do nome. */
    private void stackValueBelow(View row) {
        if (!Ui.portrait(SettingsActivity.this)) {
            return;
        }
        LinearLayout root = (LinearLayout) row;
        LinearLayout texts = (LinearLayout) row.findViewById(R.id.oaRowTitle).getParent();
        LinearLayout line = new LinearLayout(this);
        line.setOrientation(LinearLayout.HORIZONTAL);
        line.setGravity(Gravity.CENTER_VERTICAL);
        for (int id : new int[]{R.id.oaRowMinus, R.id.oaRowValue, R.id.oaRowPlus}) {
            View v = row.findViewById(id);
            root.removeView(v);
            line.addView(v);
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = Ui.dp(SettingsActivity.this, 10);
        texts.addView(line, lp);
        // no começo da linha, sem a margem da esquerda
        ((LinearLayout.LayoutParams) row.findViewById(R.id.oaRowValue).getLayoutParams()).leftMargin = 0;
    }

    private void addRow(LayoutInflater inflater, final SettingsModel.Item it, int icon) {
        final View row = inflater.inflate(R.layout.oa_setting_row, rows, false);
        stackValueBelow(row);
        ((ImageView) row.findViewById(R.id.oaRowIcon)).setImageResource(icon);
        ((TextView) row.findViewById(R.id.oaRowTitle)).setText(it.title);
        TextView hint = row.findViewById(R.id.oaRowHint);
        if (it.summary != null) {
            // resumos de lista do Android usam %s para o valor; aqui o valor já aparece ao lado
            hint.setText(it.summary.toString().replace(": %s", "").replace("%s", "").trim());
        }
        else {
            hint.setVisibility(View.GONE);
        }
        bindValue(row, it);

        if (it.kind == SettingsModel.Kind.CHECK) {
            row.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    boolean on = !prefs.getBoolean(it.key, it.defaultBool);
                    prefs.edit().putBoolean(it.key, on).apply();
                    bindValue(row, it);
                    // depois de gravar: ao ligar os sons da interface, o próprio clique já toca
                    UiSounds.play(SettingsActivity.this, on ? UiSoundSynth.Sound.TOGGLE_ON : UiSoundSynth.Sound.TOGGLE_OFF);
                }
            });
        }
        else if (it.kind == SettingsModel.Kind.LIST) {
            row.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    UiSounds.play(SettingsActivity.this, UiSoundSynth.Sound.SELECT);
                    chooseFromList(row, it);
                }
            });
        }
        else {
            View.OnClickListener minus = new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    stepNumber(row, it, -1);
                }
            };
            View.OnClickListener plus = new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    stepNumber(row, it, 1);
                }
            };
            View m = row.findViewById(R.id.oaRowMinus);
            View p = row.findViewById(R.id.oaRowPlus);
            m.setVisibility(View.VISIBLE);
            p.setVisibility(View.VISIBLE);
            m.setOnClickListener(minus);
            p.setOnClickListener(plus);
            m.setContentDescription(it.title + " −");
            p.setContentDescription(it.title + " +");
            // com o controle: esquerda/direita no cartão mudam o número
            row.setOnKeyListener(new View.OnKeyListener() {
                @Override
                public boolean onKey(View v, int keyCode, KeyEvent event) {
                    if (event.getAction() != KeyEvent.ACTION_DOWN) {
                        return false;
                    }
                    if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT) {
                        stepNumber(row, it, -1);
                        return true;
                    }
                    if (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) {
                        stepNumber(row, it, 1);
                        return true;
                    }
                    return false;
                }
            });
            m.setFocusable(false);
            p.setFocusable(false);
        }
        rows.addView(row);
    }

    private int intValue(SettingsModel.Item it) {
        int def = it.hasDefaultInt ? it.defaultInt : PreferenceConfiguration.getDefaultBitrate(this);
        try {
            return prefs.getInt(it.key, def);
        } catch (ClassCastException e) {
            return def;
        }
    }

    private void stepNumber(View row, SettingsModel.Item it, int direction) {
        int before = intValue(it);
        int after = SettingsModel.stepValue(it, before, direction);
        UiSounds.play(this, after == before ? UiSoundSynth.Sound.MOVE : direction > 0 ? UiSoundSynth.Sound.TOGGLE_ON : UiSoundSynth.Sound.TOGGLE_OFF);
        prefs.edit().putInt(it.key, after).apply();
        bindValue(row, it);
    }

    private void bindValue(View row, SettingsModel.Item it) {
        TextView value = row.findViewById(R.id.oaRowValue);
        switch (it.kind) {
            case CHECK: {
                boolean on = prefs.getBoolean(it.key, it.defaultBool);
                value.setText(on ? R.string.openalt_settings_on : R.string.openalt_settings_off);
                value.setBackgroundResource(on ? R.drawable.oa_status_pill_bg : R.drawable.oa_value_pill_bg);
                value.setTextColor(color(on ? R.color.oa_pill_ink : R.color.oa_text));
                break;
            }
            case LIST: {
                ListChoice c = listChoices(it);
                String v = prefs.getString(it.key, it.defaultString);
                int i = v != null ? Arrays.asList(c.values).indexOf(v) : -1;
                value.setText(i >= 0 ? c.names[i] : (v != null ? v : "—"));
                break;
            }
            case SEEK:
            default:
                value.setText(SettingsModel.formatNumber(it, intValue(it)));
                break;
        }
    }

    private static final class ListChoice {
        String[] names;
        String[] values;
    }

    /** As escolhas de uma lista; a resolução ganha a "Nativa" do aparelho, como no Moonlight. */
    private ListChoice listChoices(SettingsModel.Item it) {
        List<String> names = new ArrayList<>();
        List<String> values = new ArrayList<>();
        if (it.entries != null && it.values != null) {
            for (int i = 0; i < Math.min(it.entries.length, it.values.length); i++) {
                names.add(it.entries[i].toString());
                values.add(it.values[i].toString());
            }
        }
        if ("list_resolution".equals(it.key)) {
            String nativeRes = nativeResolution();
            if (nativeRes != null && !values.contains(nativeRes)) {
                names.add(0, getString(R.string.resolution_prefix_native) + " (" + nativeRes + ")");
                values.add(0, nativeRes);
            }
        }
        ListChoice c = new ListChoice();
        c.names = names.toArray(new String[0]);
        c.values = values.toArray(new String[0]);
        return c;
    }

    private String nativeResolution() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return null;
        }
        DisplayManager dm = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
        Display d = dm != null ? dm.getDisplay(Display.DEFAULT_DISPLAY) : null;
        if (d == null) {
            return null;
        }
        Display.Mode m = d.getMode();
        int w = Math.max(m.getPhysicalWidth(), m.getPhysicalHeight());
        int h = Math.min(m.getPhysicalWidth(), m.getPhysicalHeight());
        return w > 0 && h > 0 ? w + "x" + h : null;
    }

    private void chooseFromList(final View row, final SettingsModel.Item it) {
        final ListChoice c = listChoices(it);
        String v = prefs.getString(it.key, it.defaultString);
        int checked = v != null ? Arrays.asList(c.values).indexOf(v) : -1;
        new AlertDialog.Builder(this)
                .setTitle(it.title)
                .setSingleChoiceItems(c.names, checked, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        SharedPreferences.Editor e = prefs.edit().putString(it.key, c.values[which]);
                        // como no Moonlight: trocar a resolução ou os quadros reajusta a qualidade
                        if ("list_resolution".equals(it.key) || "list_fps".equals(it.key)) {
                            String res = "list_resolution".equals(it.key) ? c.values[which] : prefs.getString("list_resolution", "1280x720");
                            String fps = "list_fps".equals(it.key) ? c.values[which] : prefs.getString("list_fps", "60");
                            e.putInt("seekbar_bitrate_kbps", PreferenceConfiguration.getDefaultBitrate(res, fps));
                        }
                        e.apply();
                        UiSounds.play(SettingsActivity.this, UiSoundSynth.Sound.TOGGLE_ON);
                        dialog.dismiss();
                        // a qualidade mudou junto: redesenha a categoria inteira e devolve o foco à mesma opção
                        int index = rows.indexOfChild(row);
                        showCategory(current, false);
                        if (index >= 0 && index < rows.getChildCount()) {
                            rows.getChildAt(index).requestFocus();
                        }
                    }
                })
                .show();
    }
}
