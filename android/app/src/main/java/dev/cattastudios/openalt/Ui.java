package dev.cattastudios.openalt;

import android.content.Context;
import android.content.res.Configuration;
import android.util.TypedValue;

/** Contas de tela usadas pelas telas do OpenAlt. */
final class Ui {
    private Ui() {}

    /** dp → pixels, arredondado. */
    static int dp(Context c, float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()));
    }

    /** O aparelho está em pé agora? */
    static boolean portrait(Context c) {
        return c.getResources().getConfiguration().orientation == Configuration.ORIENTATION_PORTRAIT;
    }
}
