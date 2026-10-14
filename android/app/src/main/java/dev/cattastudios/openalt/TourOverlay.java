package dev.cattastudios.openalt;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.limelight.R;

import java.util.List;

/**
 * Tour guiado (o mesmo jeito do app do PC, desktop/src/renderer/tour.ts): escurece a tela, recorta
 * o item da vez com um contorno vermelho e mostra um cartão ao lado, com Voltar / Próximo / Pular.
 * Só olhar e avançar: a camada pega os toques e a tela de trás não recebe o foco do controle.
 */
final class TourOverlay extends FrameLayout {
    /** Acha o alvo na hora (a tela pode ter refeito a view desde o começo do tour). */
    interface Locator {
        View find();
    }

    static Locator fixed(final View v) {
        return new Locator() {
            @Override
            public View find() {
                return v;
            }
        };
    }

    static final class Step {
        /** acha null = cartão no meio, sem recorte */
        final Locator target;
        final String title;
        final String text;

        Step(Locator target, String title, String text) {
            this.target = target;
            this.title = title;
            this.text = text;
        }
    }

    private final List<Step> steps;
    private final Runnable onEnd;
    /** a tela de trás: sem foco nem leitor de tela enquanto o tour está aberto */
    private final ViewGroup behind;
    private final int behindFocus;
    private final View card;
    private final TextView count;
    private final TextView title;
    private final TextView text;
    private final TextView back;
    private final TextView next;
    private final Paint shade = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint outline = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF hole = new RectF();
    private boolean hasHole;
    private int index;
    private boolean ended;

    private final ViewTreeObserver.OnGlobalLayoutListener relayout = new ViewTreeObserver.OnGlobalLayoutListener() {
        @Override
        public void onGlobalLayout() {
            position();
        }
    };

    private TourOverlay(Activity a, ViewGroup behind, List<Step> steps, Runnable onEnd) {
        super(a);
        this.steps = steps;
        this.onEnd = onEnd;
        this.behind = behind;
        this.behindFocus = behind.getDescendantFocusability();
        setWillNotDraw(false);
        setClickable(true); // os toques fora do cartão não chegam na tela de trás
        shade.setColor(0x9E14110D);
        outline.setStyle(Paint.Style.STROKE);
        outline.setStrokeWidth(Ui.dp(getContext(), 2.5f));
        outline.setColor(a.getResources().getColor(R.color.oa_accent));

        card = LayoutInflater.from(a).inflate(R.layout.oa_tour_card, this, false);
        count = card.findViewById(R.id.oaTourCount);
        title = card.findViewById(R.id.oaTourTitle);
        text = card.findViewById(R.id.oaTourText);
        back = card.findViewById(R.id.oaTourBack);
        next = card.findViewById(R.id.oaTourNext);
        addView(card, new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT));

        card.findViewById(R.id.oaTourSkip).setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                UiSounds.play(getContext(), UiSoundSynth.Sound.TOGGLE_OFF);
                end();
            }
        });
        back.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (index > 0) {
                    UiSounds.play(getContext(), UiSoundSynth.Sound.BACK);
                    show(index - 1);
                }
            }
        });
        next.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (index < TourOverlay.this.steps.size() - 1) {
                    UiSounds.play(getContext(), UiSoundSynth.Sound.SELECT);
                    show(index + 1);
                }
                else {
                    UiSounds.play(getContext(), UiSoundSynth.Sound.LAUNCH);
                    end();
                }
            }
        });
    }

    /** Abre o tour por cima de `behind` (o conteúdo da tela). */
    static TourOverlay start(Activity a, ViewGroup behind, List<Step> steps, Runnable onEnd) {
        TourOverlay t = new TourOverlay(a, behind, steps, onEnd);
        ViewGroup root = a.findViewById(android.R.id.content);
        root.addView(t, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        behind.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        behind.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        t.getViewTreeObserver().addOnGlobalLayoutListener(t.relayout);
        t.show(0);
        return t;
    }

    void end() {
        if (ended) {
            return;
        }
        ended = true;
        getViewTreeObserver().removeOnGlobalLayoutListener(relayout);
        behind.setDescendantFocusability(behindFocus);
        behind.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
        ((ViewGroup) getParent()).removeView(this);
        onEnd.run();
    }

    private void show(int i) {
        index = i;
        Step s = steps.get(i);
        Context c = getContext();
        count.setText(c.getString(R.string.openalt_tour_count, i + 1, steps.size()));
        title.setText(s.title);
        text.setText(s.text);
        back.setVisibility(i == 0 ? View.GONE : View.VISIBLE);
        next.setText(i == steps.size() - 1 ? R.string.openalt_tour_done : R.string.openalt_tour_next);
        card.setContentDescription(count.getText() + ". " + s.title + ". " + s.text);
        View target = s.target.find();
        if (target != null) {
            // traz o alvo para a vista (os cartões rolam para o lado)
            target.requestRectangleOnScreen(new Rect(0, 0, target.getWidth(), target.getHeight()), true);
        }
        next.requestFocus();
        card.sendAccessibilityEvent(android.view.accessibility.AccessibilityEvent.TYPE_VIEW_FOCUSED);
        post(new Runnable() {
            @Override
            public void run() {
                position();
            }
        });
    }

    /** Recorta o alvo e põe o cartão embaixo, em cima, à direita ou à esquerda dele. */
    private void position() {
        if (ended || getWidth() == 0) {
            return;
        }
        int w = getWidth();
        int h = getHeight();
        int m = Ui.dp(getContext(), 16);
        int cw = Math.min(Ui.dp(getContext(), 400), w - 2 * m);
        if (card.getLayoutParams().width != cw) {
            card.getLayoutParams().width = cw;
            card.requestLayout();
        }
        card.measure(MeasureSpec.makeMeasureSpec(cw, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(h, MeasureSpec.AT_MOST));
        int ch = card.getMeasuredHeight();

        View target = steps.get(index).target.find();
        hasHole = target != null && target.isShown() && target.getWidth() > 0;
        float x;
        float y;
        if (!hasHole) {
            x = (w - cw) / 2f;
            y = (h - ch) / 2f;
        }
        else {
            int[] at = new int[2];
            int[] me = new int[2];
            target.getLocationInWindow(at);
            getLocationInWindow(me);
            int pad = Ui.dp(getContext(), 8);
            hole.set(Math.max(Ui.dp(getContext(), 4), at[0] - me[0] - pad), Math.max(Ui.dp(getContext(), 4), at[1] - me[1] - pad),
                    Math.min(w - Ui.dp(getContext(), 4), at[0] - me[0] + target.getWidth() + pad), Math.min(h - Ui.dp(getContext(), 4), at[1] - me[1] + target.getHeight() + pad));
            int gap = Ui.dp(getContext(), 16);
            if (h - hole.bottom - gap >= ch + m) {
                x = clamp(hole.left, m, w - cw - m);
                y = hole.bottom + gap;
            }
            else if (hole.top - gap >= ch + m) {
                x = clamp(hole.left, m, w - cw - m);
                y = hole.top - gap - ch;
            }
            else if (w - hole.right - gap >= cw + m) {
                x = hole.right + gap;
                y = clamp(hole.top, m, h - ch - m);
            }
            else if (hole.left - gap >= cw + m) {
                x = hole.left - gap - cw;
                y = clamp(hole.top, m, h - ch - m);
            }
            else {
                x = w - cw - m;
                y = h - ch - m;
            }
        }
        card.setTranslationX(x);
        card.setTranslationY(y);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        path.reset();
        path.setFillType(Path.FillType.EVEN_ODD);
        path.addRect(0, 0, getWidth(), getHeight(), Path.Direction.CW);
        if (hasHole) {
            path.addRect(hole, Path.Direction.CW);
        }
        canvas.drawPath(path, shade);
        if (hasHole) {
            canvas.drawRect(hole, outline);
        }
    }

    private static float clamp(float v, float min, float max) {
        return Math.max(min, Math.min(v, max));
    }

}
