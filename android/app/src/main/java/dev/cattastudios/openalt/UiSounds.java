package dev.cattastudios.openalt;

import android.app.Activity;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.os.SystemClock;
import android.preference.PreferenceManager;
import android.view.View;
import android.view.ViewTreeObserver;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Os sons da interface (como nos consoles): mover o foco, escolher, voltar, ligar/desligar,
 * conectar e erro. Baixinhos, no volume de mídia (como os jogos: o silencioso e o Não perturbe não
 * os calam) e desligáveis em Configurações → Som ("Sons da interface").
 */
public final class UiSounds {
    static final String PREF = "openalt_ui_sounds";
    private static final float VOLUME = 0.35f;
    /** O "mover" não toca colado em outro som (escolher já move o foco) */
    private static final long MOVE_QUIET_MS = 120;
    /** Muda quando os sons mudam, para não usar os arquivos antigos do cache */
    private static final String VERSION = "v1";

    private static UiSounds instance;

    private final Context app;
    private final SoundPool pool;
    private final int[] ids = new int[UiSoundSynth.Sound.values().length];
    private long lastPlay;

    private UiSounds(Context c) {
        app = c.getApplicationContext();
        pool = new SoundPool.Builder()
                .setMaxStreams(4)
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                .build();
        new Thread(new Runnable() {
            @Override
            public void run() {
                load();
            }
        }, "OpenAlt sounds").start();
    }

    private static synchronized UiSounds get(Context c) {
        if (instance == null) {
            instance = new UiSounds(c);
        }
        return instance;
    }

    /** Gera os arquivos no cache (uma vez por versão) e os carrega no SoundPool. */
    private void load() {
        File dir = new File(app.getCacheDir(), "oa-sounds");
        if (!dir.isDirectory() && !dir.mkdirs()) {
            return;
        }
        for (UiSoundSynth.Sound s : UiSoundSynth.Sound.values()) {
            File f = new File(dir, VERSION + "-" + s.name().toLowerCase() + ".wav");
            if (!f.isFile()) {
                File tmp = new File(dir, f.getName() + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    out.write(UiSoundSynth.wav(UiSoundSynth.render(s)));
                } catch (IOException e) {
                    continue;
                }
                if (!tmp.renameTo(f)) {
                    continue;
                }
            }
            int id = pool.load(f.getPath(), 1);
            synchronized (this) {
                ids[s.ordinal()] = id;
            }
        }
    }

    /** Prepara os sons ao abrir a tela, para o primeiro já sair na hora. */
    public static void warmUp(Context c) {
        if (enabled(c)) {
            get(c);
        }
    }

    public static void play(Context c, UiSoundSynth.Sound s) {
        if (!enabled(c)) {
            return;
        }
        get(c).playLoaded(s);
    }

    private synchronized void playLoaded(UiSoundSynth.Sound s) {
        long now = SystemClock.uptimeMillis();
        if (s == UiSoundSynth.Sound.MOVE && now - lastPlay < MOVE_QUIET_MS) {
            return;
        }
        lastPlay = now;
        int id = ids[s.ordinal()];
        if (id != 0) {
            pool.play(id, VOLUME, VOLUME, 1, 0, 1f); // se ainda não carregou, o SoundPool só ignora
        }
    }

    private static boolean enabled(Context c) {
        return PreferenceManager.getDefaultSharedPreferences(c).getBoolean(PREF, true);
    }

    /** Toca o "mover" sempre que o foco passa de um item para outro (controle, setas, Tab). */
    public static void attach(final Activity a) {
        warmUp(a);
        a.getWindow().getDecorView().getViewTreeObserver().addOnGlobalFocusChangeListener(new ViewTreeObserver.OnGlobalFocusChangeListener() {
            @Override
            public void onGlobalFocusChanged(View oldFocus, View newFocus) {
                if (oldFocus != null && newFocus != null && oldFocus != newFocus && !newFocus.isInTouchMode()) {
                    play(a, UiSoundSynth.Sound.MOVE);
                }
            }
        });
    }
}
