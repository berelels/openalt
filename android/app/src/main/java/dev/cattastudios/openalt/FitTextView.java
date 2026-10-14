package dev.cattastudios.openalt;

import android.content.Context;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.widget.TextView;

/**
 * Texto de uma linha que diminui a fonte (até 55%) para caber, em vez de quebrar no meio da
 * palavra ou cortar: nomes de PC costumam ser uma palavra só ("berelels-zorin").
 */
public class FitTextView extends TextView {
    private static final float MIN_SCALE = 0.55f;
    private float baseSizePx;

    public FitTextView(Context context, AttributeSet attrs) {
        super(context, attrs);
        baseSizePx = getTextSize();
        setSingleLine(true);
    }

    @Override
    public void setTextSize(int unit, float size) {
        super.setTextSize(unit, size);
        baseSizePx = getTextSize();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        int available = MeasureSpec.getSize(widthMeasureSpec) - getPaddingLeft() - getPaddingRight();
        if (MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.UNSPECIFIED && available > 0) {
            getPaint().setTextSize(baseSizePx);
            float needed = getPaint().measureText(String.valueOf(getText())) * 1.02f;
            float size = needed > available ? Math.max(baseSizePx * MIN_SCALE, baseSizePx * available / needed) : baseSizePx;
            super.setTextSize(TypedValue.COMPLEX_UNIT_PX, size);
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
    }
}
