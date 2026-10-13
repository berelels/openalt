package dev.cattastudios.openalt;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/** Tela cheia das telas do OpenAlt: sem a barra de notificações e os botões do Android. */
final class Immersive {
    private Immersive() {}

    /** Chamar no onCreate, antes do setContentView: desenha também atrás do recorte da câmera. */
    static void prepare(Activity a) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            a.getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    /** Chamar no onResume e quando a janela ganha o foco (deslizar da borda mostra as barras por um instante). */
    @SuppressWarnings("deprecation")
    static void apply(Activity a) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            a.getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = a.getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
        else {
            a.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }
}
