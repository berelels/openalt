package dev.cattastudios.openalt;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Service;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.hardware.input.InputManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.opengl.GLSurfaceView;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.preference.PreferenceManager;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.limelight.LimeLog;
import com.limelight.R;
import com.limelight.computers.ComputerManagerListener;
import com.limelight.computers.ComputerManagerService;
import com.limelight.nvstream.http.ComputerDetails;
import com.limelight.nvstream.http.PairingManager.PairState;
import com.limelight.preferences.GlPreferences;
import com.limelight.utils.UiHelper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * A tela de entrada do OpenAlt: o mesmo app, com cara e jeito de launcher (como o SteamOS).
 *
 * - Tela cheia: some a barra de notificações e os botões do Android (deslizar da borda mostra).
 * - Cartões grandes: cada PC (em casa / fora de casa / desligado) e "Parear um PC".
 * - Toque ou controle: o foco anda pelo direcional; as dicas de botões só aparecem com um
 *   controle conectado, no estilo escolhido (Xbox, PlayStation ou Nintendo).
 * - A mesma abertura do app do PC (assets/intro, copiada de desktop/src/renderer/intro.ts).
 *
 * As opções de cada PC (as do menu do Moonlight) abrem aqui mesmo: toque longo ou X (PcOptions).
 */
public class StartActivity extends Activity implements InputManager.InputDeviceListener, PcOptions.Host {
    private static final String INTRO_DONE = "openalt-intro:done";

    private final Map<String, ComputerDetails> computers = new LinkedHashMap<>();
    private ComputerManagerService.ComputerManagerBinder managerBinder;
    private boolean bound;
    private boolean polling;
    private boolean inForeground;

    private LinearLayout cards;
    private LinearLayout padHints;
    private TextView touchHint;
    private TextView network;
    private WebView intro;
    private TourOverlay tour;
    private InputManager inputManager;
    private String focusedKey;
    /** o que os cartões mostram agora: a consulta ao PC chega a cada poucos segundos, quase sempre igual */
    private String renderedCards;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            final ComputerManagerService.ComputerManagerBinder local = (ComputerManagerService.ComputerManagerBinder) binder;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    local.waitForReady();
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            managerBinder = local;
                            startPolling();
                        }
                    });
                }
            }, "OpenAlt start binder").start();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            managerBinder = null;
            polling = false;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        UiHelper.setLocale(this);
        Immersive.prepare(this);
        setContentView(R.layout.oa_home);
        GridPaperDrawable.apply(findViewById(R.id.oaHomeContent));
        UiSounds.attach(this);

        cards = findViewById(R.id.oaCards);
        padHints = findViewById(R.id.oaPadHints);
        touchHint = findViewById(R.id.oaTouchHint);
        network = findViewById(R.id.oaNetwork);
        intro = findViewById(R.id.oaIntro);
        ImageButton settings = findViewById(R.id.oaSettings);
        settings.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openSettings();
            }
        });

        inputManager = (InputManager) getSystemService(Context.INPUT_SERVICE);
        fetchGlRendererIfNeeded();
        bound = bindService(new Intent(this, ComputerManagerService.class), serviceConnection, Service.BIND_AUTO_CREATE);
        renderCards();

        // A abertura só ao abrir o app (não ao girar a tela) e só com animações ligadas
        if (savedInstanceState == null && animationsEnabled()) {
            playIntro();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        inForeground = true;
        enterFullscreen();
        inputManager.registerInputDeviceListener(this, null);
        updatePadHints();
        updateNetwork();
        startPolling();
        maybeStartTour();
    }

    @Override
    protected void onPause() {
        super.onPause();
        inForeground = false;
        inputManager.unregisterInputDeviceListener(this);
        stopPolling();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (intro != null) {
            intro.destroy();
        }
        if (bound) {
            unbindService(serviceConnection);
            bound = false;
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enterFullscreen();
        }
    }

    // ── tela cheia ─────────────────────────────────────────────────────────

    private void enterFullscreen() {
        Immersive.apply(this);
    }

    // ── abertura ───────────────────────────────────────────────────────────

    private boolean animationsEnabled() {
        float scale = Settings.Global.getFloat(getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f);
        return scale > 0f;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void playIntro() {
        WebSettings ws = intro.getSettings();
        // Só a página local da abertura: sem rede, sem ponte com o Java, sem arquivos fora dos assets
        ws.setJavaScriptEnabled(true);
        ws.setAllowContentAccess(false);
        ws.setAllowFileAccess(true);
        ws.setBlockNetworkLoads(true);
        ws.setMediaPlaybackRequiresUserGesture(false); // a música da abertura toca sem toque
        // vermelho até a página carregar (a tela não pisca), transparente depois: a cortina revela o app
        intro.setBackgroundColor(getResources().getColor(R.color.oa_accent));
        intro.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                view.setBackgroundColor(0);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleIntroUrl(request.getUrl().toString());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleIntroUrl(url);
            }
        });
        intro.setVisibility(View.VISIBLE);
        boolean music = PreferenceManager.getDefaultSharedPreferences(this).getBoolean(UiSounds.PREF, true);
        intro.loadUrl("file:///android_asset/intro/index.html?music=" + (music ? "1" : "0"));
    }

    private boolean handleIntroUrl(String url) {
        if (INTRO_DONE.equals(url) && intro.getVisibility() == View.VISIBLE) {
            intro.setVisibility(View.GONE);
            focusFirstCard();
            maybeStartTour();
            // escondida, a página ainda toca: o acorde final soa até o fim (~1 s depois da cortina)
            intro.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (!isDestroyed()) {
                        intro.loadUrl("about:blank");
                    }
                }
            }, 2000);
        }
        // nenhuma outra navegação sai da página da abertura
        return true;
    }

    /** O Moonlight escolhe o decodificador pelo nome da GPU; a lista dele guardava isso ao abrir. */
    private void fetchGlRendererIfNeeded() {
        final GlPreferences glPrefs = GlPreferences.readPreferences(this);
        if (glPrefs.savedFingerprint.equals(Build.FINGERPRINT) && !glPrefs.glRenderer.isEmpty()) {
            return;
        }
        final FrameLayout root = (FrameLayout) intro.getParent();
        final GLSurfaceView surface = new GLSurfaceView(this);
        surface.setRenderer(new GLSurfaceView.Renderer() {
            @Override
            public void onSurfaceCreated(GL10 gl, EGLConfig config) {
                glPrefs.glRenderer = gl.glGetString(GL10.GL_RENDERER);
                glPrefs.savedFingerprint = Build.FINGERPRINT;
                glPrefs.writePreferences();
                LimeLog.info("OpenAlt: GL renderer " + glPrefs.glRenderer);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        root.removeView(surface);
                    }
                });
            }

            @Override
            public void onSurfaceChanged(GL10 gl, int w, int h) {}

            @Override
            public void onDrawFrame(GL10 gl) {}
        });
        root.addView(surface, 0, new FrameLayout.LayoutParams(1, 1));
    }

    // ── PCs ────────────────────────────────────────────────────────────────

    private void startPolling() {
        if (managerBinder == null || polling || !inForeground) {
            return;
        }
        polling = true;
        managerBinder.startPolling(new ComputerManagerListener() {
            @Override
            public void notifyComputerUpdated(final ComputerDetails details) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (details.uuid != null) {
                            computers.put(details.uuid, details);
                            renderCards();
                        }
                    }
                });
            }
        });
    }

    private void stopPolling() {
        if (managerBinder != null && polling) {
            managerBinder.stopPolling();
        }
        polling = false;
    }

    private static boolean ready(ComputerDetails d) {
        return d.state == ComputerDetails.State.ONLINE && d.pairState == PairState.PAIRED;
    }

    private static boolean viaTailscale(ComputerDetails d) {
        String a = d.activeAddress != null ? d.activeAddress.address : null;
        if (a == null || !a.startsWith("100.")) {
            return false;
        }
        String[] p = a.split("\\.");
        try {
            int second = Integer.parseInt(p[1]);
            return p.length == 4 && second >= 64 && second <= 127;
        } catch (NumberFormatException | ArrayIndexOutOfBoundsException e) {
            return false;
        }
    }



    private void renderCards() {
        View focused = getCurrentFocus();
        if (focused != null && focused.getTag() instanceof String) {
            focusedKey = (String) focused.getTag();
        }

        List<ComputerDetails> list = new ArrayList<>(computers.values());
        Collections.sort(list, new Comparator<ComputerDetails>() {
            @Override
            public int compare(ComputerDetails a, ComputerDetails b) {
                if (ready(a) != ready(b)) {
                    return ready(a) ? -1 : 1;
                }
                return String.valueOf(a.name).compareToIgnoreCase(String.valueOf(b.name));
            }
        });

        // Nada mudou na tela: não refaz (refazer tira o foco do cartão, o que tocava o som de mover
        // sozinho, e trocaria os cartões que o tour está mostrando)
        StringBuilder sig = new StringBuilder();
        for (ComputerDetails d : list) {
            sig.append(d.uuid).append('|').append(d.name).append('|').append(d.state).append('|')
                    .append(d.pairState).append('|').append(viaTailscale(d)).append('\n');
        }
        if (sig.toString().equals(renderedCards) && cards.getChildCount() > 0) {
            return;
        }
        renderedCards = sig.toString();

        cards.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(this);
        boolean first = true;
        for (final ComputerDetails d : list) {
            View card = inflater.inflate(R.layout.oa_card, cards, false);
            bindPcCard(card, d, first && ready(d));
            addCard(card, first ? Size.BIG : Size.MEDIUM);
            first = false;
        }

        View pair = inflater.inflate(R.layout.oa_card, cards, false);
        bindPairCard(pair);
        addCard(pair, list.isEmpty() ? Size.BIG : Size.SMALL);

        restoreFocus();
    }

    private enum Size { BIG, MEDIUM, SMALL }

    private void addCard(View card, Size size) {
        LinearLayout.LayoutParams lp;
        if (Ui.portrait(StartActivity.this)) {
            lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            card.setMinimumHeight(Ui.dp(StartActivity.this, size == Size.BIG ? 280 : 132));
            lp.bottomMargin = Ui.dp(StartActivity.this, 8);
        }
        else {
            int width = size == Size.BIG ? 440 : size == Size.MEDIUM ? 330 : 280;
            lp = new LinearLayout.LayoutParams(Ui.dp(StartActivity.this, width), ViewGroup.LayoutParams.MATCH_PARENT);
            lp.rightMargin = Ui.dp(StartActivity.this, 16);
        }
        if (size != Size.BIG) {
            // cartões menores: o nome logo abaixo do ícone, sem empurrar para o fim
            card.findViewById(R.id.oaCardSpacer).setVisibility(Ui.portrait(StartActivity.this) ? View.GONE : View.VISIBLE);
            ((TextView) card.findViewById(R.id.oaCardTitle)).setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        }
        cards.addView(card, lp);
    }

    private void bindPcCard(View card, final ComputerDetails d, boolean accent) {
        View body = card.findViewById(R.id.oaCardBody);
        ImageView icon = card.findViewById(R.id.oaCardIcon);
        TextView status = card.findViewById(R.id.oaCardStatus);
        TextView title = card.findViewById(R.id.oaCardTitle);
        TextView detail = card.findViewById(R.id.oaCardDetail);
        TextView action = card.findViewById(R.id.oaCardAction);

        body.setBackgroundResource(accent ? R.drawable.oa_accent_card_bg : R.drawable.oa_card_bg);
        icon.setImageResource(R.drawable.oa_ic_pc);
        title.setText(d.name);

        int statusText;
        int detailText;
        if (d.state == ComputerDetails.State.ONLINE && d.pairState != PairState.PAIRED) {
            statusText = R.string.openalt_home_status_unpaired;
            detailText = R.string.openalt_home_detail_unpaired;
        }
        else if (d.state == ComputerDetails.State.ONLINE) {
            boolean away = viaTailscale(d);
            statusText = away ? R.string.openalt_home_status_away : R.string.openalt_home_status_home;
            detailText = away ? R.string.openalt_home_detail_away : R.string.openalt_home_detail_home;
        }
        else if (d.state == ComputerDetails.State.OFFLINE) {
            statusText = R.string.openalt_home_status_offline;
            detailText = R.string.openalt_home_detail_offline;
        }
        else {
            statusText = R.string.openalt_home_status_searching;
            detailText = R.string.openalt_home_detail_searching;
        }
        status.setText(statusText);
        detail.setText(detailText);
        if (accent) {
            action.setVisibility(View.VISIBLE);
            action.setText(R.string.openalt_home_connect);
        }

        card.setTag("pc:" + d.uuid);
        card.setContentDescription(d.name + ". " + getString(statusText) + ". " + getString(detailText));
        card.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openComputer(d);
            }
        });
        card.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                UiSounds.play(StartActivity.this, UiSoundSynth.Sound.SELECT);
                PcOptions.show(StartActivity.this, d, StartActivity.this);
                return true;
            }
        });
    }

    private void bindPairCard(View card) {
        card.findViewById(R.id.oaCardBody).setBackgroundResource(R.drawable.oa_dashed_card_bg);
        ImageView icon = card.findViewById(R.id.oaCardIcon);
        icon.setImageResource(R.drawable.ic_qr);
        icon.setColorFilter(getResources().getColor(R.color.oa_text));
        card.findViewById(R.id.oaCardStatus).setVisibility(View.GONE);
        ((TextView) card.findViewById(R.id.oaCardTitle)).setText(R.string.openalt_home_pair_title);
        ((TextView) card.findViewById(R.id.oaCardDetail)).setText(R.string.openalt_home_pair_detail);
        card.setTag("pair");
        card.setContentDescription(getString(R.string.openalt_home_pair_title));
        card.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                UiSounds.play(StartActivity.this, UiSoundSynth.Sound.SELECT);
                startActivity(new Intent(StartActivity.this, PairQrActivity.class));
            }
        });
    }

    private void restoreFocus() {
        if (intro.getVisibility() == View.VISIBLE) {
            return;
        }
        if (focusedKey != null) {
            View v = cards.findViewWithTag(focusedKey);
            if (v != null) {
                v.requestFocus();
                return;
            }
        }
        if (getCurrentFocus() == null) {
            focusFirstCard();
        }
    }

    private void focusFirstCard() {
        if (cards.getChildCount() > 0) {
            cards.getChildAt(0).requestFocus();
        }
    }

    private void openComputer(ComputerDetails d) {
        if (d.state == ComputerDetails.State.ONLINE && d.pairState != PairState.PAIRED) {
            UiSounds.play(this, UiSoundSynth.Sound.SELECT);
            startActivity(new Intent(this, PairQrActivity.class));
        }
        else if (!ready(d) || managerBinder == null) {
            UiSounds.play(this, UiSoundSynth.Sound.ERROR);
            Toast.makeText(this, getString(R.string.openalt_home_offline_toast, d.name), Toast.LENGTH_LONG).show();
        }
        else {
            UiSounds.play(this, UiSoundSynth.Sound.LAUNCH);
            OpenAltLauncher.connect(this, d, managerBinder, new Runnable() {
                @Override
                public void run() {
                    // sem o app "OpenAlt" no PC (ou outro app aberto nele): a lista de apps do PC
                    Intent i = new Intent(StartActivity.this, com.limelight.AppView.class);
                    i.putExtra(com.limelight.AppView.NAME_EXTRA, d.name);
                    i.putExtra(com.limelight.AppView.UUID_EXTRA, d.uuid);
                    startActivity(i);
                }
            });
        }
    }

    @Override
    public ComputerManagerService.ComputerManagerBinder binder() {
        return managerBinder;
    }

    @Override
    public void onComputerRemoved(ComputerDetails d) {
        computers.remove(d.uuid);
        renderCards();
    }

    private void openSettings() {
        UiSounds.play(this, UiSoundSynth.Sound.SELECT);
        startActivity(new Intent(this, SettingsActivity.class));
    }

    // ── rede ───────────────────────────────────────────────────────────────

    @SuppressWarnings("deprecation")
    private void updateNetwork() {
        if (network == null || network.getVisibility() != View.VISIBLE) {
            return;
        }
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        int text = R.string.openalt_home_net_none;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network n = cm.getActiveNetwork();
            NetworkCapabilities c = n != null ? cm.getNetworkCapabilities(n) : null;
            if (c != null && c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                text = R.string.openalt_home_net_wifi;
            }
            else if (c != null && c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                text = R.string.openalt_home_net_mobile;
            }
        }
        else {
            NetworkInfo info = cm.getActiveNetworkInfo();
            if (info != null && info.isConnected()) {
                text = info.getType() == ConnectivityManager.TYPE_WIFI ? R.string.openalt_home_net_wifi : R.string.openalt_home_net_mobile;
            }
        }
        network.setText(text);
    }

    // ── controle ───────────────────────────────────────────────────────────

    /** O primeiro controle de verdade conectado (não o teclado nem o toque), ou null. */
    private InputDevice gamepad() {
        for (int id : inputManager.getInputDeviceIds()) {
            InputDevice dev = inputManager.getInputDevice(id);
            if (dev == null || dev.isVirtual()) {
                continue;
            }
            int s = dev.getSources();
            if ((s & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
                    || (s & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK) {
                return dev;
            }
        }
        return null;
    }

    private ControllerStyle.Style style(InputDevice dev) {
        SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(this);
        int vendor = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT && dev != null ? dev.getVendorId() : 0;
        return ControllerStyle.resolve(prefs.getString("openalt_controller_style", "auto"), vendor);
    }

    private void updatePadHints() {
        InputDevice dev = gamepad();
        padHints.removeAllViews();
        if (dev == null) {
            padHints.setVisibility(View.GONE);
            touchHint.setVisibility(View.VISIBLE);
            return;
        }
        ControllerStyle.Style s = style(dev);
        addPadHint(ControllerStyle.glyph(s, ControllerStyle.Action.CONFIRM), R.string.openalt_pad_connect);
        addPadHint(ControllerStyle.glyph(s, ControllerStyle.Action.OPTIONS), R.string.openalt_pad_options);
        addPadHint(ControllerStyle.glyph(s, ControllerStyle.Action.MENU), R.string.openalt_pad_settings);
        padHints.setVisibility(View.VISIBLE);
        touchHint.setVisibility(View.GONE);
    }

    private void addPadHint(String glyph, int label) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.HORIZONTAL);
        item.setGravity(android.view.Gravity.CENTER_VERTICAL);
        TextView g = new TextView(this);
        g.setText(glyph);
        g.setTextColor(getResources().getColor(R.color.oa_bg));
        g.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        g.setTypeface(g.getTypeface(), android.graphics.Typeface.BOLD);
        g.setGravity(android.view.Gravity.CENTER);
        g.setBackgroundResource(R.drawable.oa_pad_glyph_bg);
        g.setMinWidth(Ui.dp(StartActivity.this, 28));
        g.setMinHeight(Ui.dp(StartActivity.this, 28));
        g.setPadding(Ui.dp(StartActivity.this, 8), 0, Ui.dp(StartActivity.this, 8), 0);
        TextView l = new TextView(this);
        l.setText(label);
        l.setTextColor(getResources().getColor(R.color.oa_text));
        l.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        l.setTypeface(l.getTypeface(), android.graphics.Typeface.BOLD);
        l.setPadding(Ui.dp(StartActivity.this, 8), 0, Ui.dp(StartActivity.this, 20), 0);
        item.addView(g);
        item.addView(l);
        padHints.addView(item);
    }

    @Override
    public void onInputDeviceAdded(int deviceId) {
        updatePadHints();
    }

    @Override
    public void onInputDeviceRemoved(int deviceId) {
        updatePadHints();
    }

    @Override
    public void onInputDeviceChanged(int deviceId) {
        updatePadHints();
    }

    // ── tour guiado ────────────────────────────────────────────────────────

    static final String TOUR_DONE = "openalt_tour_done";

    /** Na primeira vez (ou depois de "Fazer o tour de novo" em Configurações → Sobre), sem a abertura na frente. */
    private void maybeStartTour() {
        intro.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (tour != null || isFinishing() || intro.getVisibility() == View.VISIBLE || !inForeground
                        || PreferenceManager.getDefaultSharedPreferences(StartActivity.this).getBoolean(TOUR_DONE, false)) {
                    return;
                }
                startTour();
            }
        }, 400); // os cartões já desenhados
    }

    private void startTour() {
        List<TourOverlay.Step> steps = new ArrayList<>();
        // os cartões são procurados a cada passo: se mudarem (o PC ligou, por exemplo), o recorte acompanha
        TourOverlay.Locator pc = new TourOverlay.Locator() {
            @Override
            public View find() {
                for (int i = 0; i < cards.getChildCount(); i++) {
                    Object tag = cards.getChildAt(i).getTag();
                    if (tag instanceof String && ((String) tag).startsWith("pc:")) {
                        return cards.getChildAt(i);
                    }
                }
                return null;
            }
        };
        TourOverlay.Locator pair = new TourOverlay.Locator() {
            @Override
            public View find() {
                return cards.findViewWithTag("pair");
            }
        };
        if (pc.find() != null) {
            steps.add(new TourOverlay.Step(pc, getString(R.string.openalt_tour_pc_title), getString(R.string.openalt_tour_pc_text)));
            steps.add(new TourOverlay.Step(pc, getString(R.string.openalt_tour_options_title), getString(R.string.openalt_tour_options_text)));
        }
        if (pair.find() != null) {
            steps.add(new TourOverlay.Step(pair, getString(R.string.openalt_tour_pair_title), getString(R.string.openalt_tour_pair_text)));
        }
        if (network != null && network.getVisibility() == View.VISIBLE) {
            steps.add(new TourOverlay.Step(TourOverlay.fixed(network), getString(R.string.openalt_tour_network_title), getString(R.string.openalt_tour_network_text)));
        }
        steps.add(new TourOverlay.Step(TourOverlay.fixed(findViewById(R.id.oaSettings)), getString(R.string.openalt_tour_settings_title), getString(R.string.openalt_tour_settings_text)));
        if (padHints.getVisibility() == View.VISIBLE) {
            steps.add(new TourOverlay.Step(TourOverlay.fixed(padHints), getString(R.string.openalt_tour_pad_title), getString(R.string.openalt_tour_pad_text)));
        }
        tour = TourOverlay.start(this, (android.view.ViewGroup) findViewById(R.id.oaHomeContent), steps, new Runnable() {
            @Override
            public void run() {
                tour = null;
                PreferenceManager.getDefaultSharedPreferences(StartActivity.this).edit().putBoolean(TOUR_DONE, true).apply();
                restoreFocus();
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (tour != null) {
            tour.end();
            return;
        }
        super.onBackPressed();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (tour != null) {
            // no tour: A aperta o botão com foco, B sai; os atalhos da tela (X, Menu) esperam
            if (keyCode == KeyEvent.KEYCODE_BUTTON_B || keyCode == KeyEvent.KEYCODE_BACK) {
                tour.end();
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_BUTTON_A) {
                View f = getCurrentFocus();
                if (f != null) {
                    f.performClick();
                }
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_BUTTON_X || keyCode == KeyEvent.KEYCODE_BUTTON_START || keyCode == KeyEvent.KEYCODE_MENU) {
                return true;
            }
            return super.onKeyDown(keyCode, event);
        }
        // qualquer botão pula a abertura (o toque é tratado pela própria página)
        if (intro.getVisibility() == View.VISIBLE && keyCode != KeyEvent.KEYCODE_BACK) {
            // pula pela própria página, como no PC: a cortina sobe e a música toca só o final
            intro.evaluateJavascript("dispatchEvent(new KeyboardEvent('keydown'))", null);
            return true;
        }
        switch (keyCode) {
            case KeyEvent.KEYCODE_BUTTON_A: {
                View f = getCurrentFocus();
                if (f != null) {
                    f.performClick();
                    return true;
                }
                break;
            }
            case KeyEvent.KEYCODE_BUTTON_X: {
                View f = getCurrentFocus();
                if (f != null && f.getTag() instanceof String && ((String) f.getTag()).startsWith("pc:")) {
                    ComputerDetails d = computers.get(((String) f.getTag()).substring(3));
                    if (d != null) {
                        UiSounds.play(this, UiSoundSynth.Sound.SELECT);
                        PcOptions.show(this, d, this);
                        return true;
                    }
                }
                break;
            }
            case KeyEvent.KEYCODE_BUTTON_START:
            case KeyEvent.KEYCODE_MENU:
                openSettings();
                return true;
            default:
                break;
        }
        return super.onKeyDown(keyCode, event);
    }
}
