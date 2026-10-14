package dev.cattastudios.openalt;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.util.TypedValue;
import android.view.View;

import com.limelight.R;

/**
 * O papel quadriculado do site (planta baixa): quadrados de 24dp e uma linha mais forte a cada 5
 * (120dp), sobre a cor do papel. No tema escuro as cores vêm de values-night (fundo tinta, linhas claras).
 */
public class GridPaperDrawable extends Drawable {
    private final Paint paper = new Paint();
    private final Paint fine = new Paint();
    private final Paint strong = new Paint();
    private final float cell;

    public GridPaperDrawable(Context c) {
        paper.setColor(c.getResources().getColor(R.color.oa_bg));
        fine.setColor(c.getResources().getColor(R.color.oa_grid_2));
        strong.setColor(c.getResources().getColor(R.color.oa_grid_1));
        float px = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1, c.getResources().getDisplayMetrics());
        fine.setStrokeWidth(Math.max(1f, px * 0.75f));
        strong.setStrokeWidth(Math.max(1f, px));
        cell = 24 * px;
    }

    /** Põe o papel quadriculado como fundo da tela. */
    public static void apply(View root) {
        root.setBackground(new GridPaperDrawable(root.getContext()));
    }

    @Override
    public void draw(Canvas canvas) {
        Rect b = getBounds();
        canvas.drawRect(b, paper);
        int i = 0;
        for (float x = b.left; x <= b.right; x += cell, i++) {
            canvas.drawLine(x, b.top, x, b.bottom, i % 5 == 0 ? strong : fine);
        }
        i = 0;
        for (float y = b.top; y <= b.bottom; y += cell, i++) {
            canvas.drawLine(b.left, y, b.right, y, i % 5 == 0 ? strong : fine);
        }
    }

    @Override
    public void setAlpha(int alpha) {
        paper.setAlpha(alpha);
    }

    @Override
    public void setColorFilter(ColorFilter colorFilter) {
        paper.setColorFilter(colorFilter);
    }

    @Override
    public int getOpacity() {
        return PixelFormat.OPAQUE;
    }
}
