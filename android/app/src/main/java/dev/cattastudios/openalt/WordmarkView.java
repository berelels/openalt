package dev.cattastudios.openalt;

import android.content.Context;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.widget.TextView;

import com.limelight.R;

/**
 * A marca "Open" + "Alt" (itálico, vermelho de texto) num texto só, sempre numa linha.
 *
 * Eram dois TextViews lado a lado: num celular em pé, os botões do topo deixavam pouco espaço e o
 * "Alt" quebrava uma letra por linha. Aqui, se não couber, a fonte diminui (até 60%) em vez de quebrar.
 */
public class WordmarkView extends TextView {
    private static final float MIN_SCALE = 0.6f;
    private float baseSizePx;

    public WordmarkView(Context context, AttributeSet attrs) {
        super(context, attrs);
        baseSizePx = getTextSize();
        SpannableString s = new SpannableString("OpenAlt");
        s.setSpan(new StyleSpan(Typeface.ITALIC), 4, 7, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        s.setSpan(new ForegroundColorSpan(context.getResources().getColor(R.color.oa_accent_text)), 4, 7, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        setText(s);
        setSingleLine(true);
        setEllipsize(TextUtils.TruncateAt.END);
        setContentDescription(context.getString(R.string.openalt_app_name));
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        int available = MeasureSpec.getSize(widthMeasureSpec) - getPaddingLeft() - getPaddingRight();
        if (MeasureSpec.getMode(widthMeasureSpec) != MeasureSpec.UNSPECIFIED && available > 0) {
            setTextSize(TypedValue.COMPLEX_UNIT_PX, baseSizePx);
            // o itálico passa um pouco da largura medida: 4% de folga
            float needed = getPaint().measureText(getText().toString()) * 1.04f;
            if (needed > available) {
                setTextSize(TypedValue.COMPLEX_UNIT_PX, Math.max(baseSizePx * MIN_SCALE, baseSizePx * available / needed));
            }
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec);
    }
}
