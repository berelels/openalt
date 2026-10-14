package dev.cattastudios.openalt;

/**
 * Nomes dos botões do controle no launcher: Xbox, PlayStation ou Nintendo Switch.
 *
 * O Android numera os botões pela POSIÇÃO (BUTTON_A = o de baixo, BUTTON_X = o da esquerda), então
 * só o nome muda: no Switch o botão de baixo se chama "B" e o da esquerda "Y" (A e B trocados de lugar).
 */
public final class ControllerStyle {
    public enum Style { XBOX, PLAYSTATION, NINTENDO }

    /** O que cada dica de botão faz no launcher. */
    public enum Action { CONFIRM, OPTIONS, MENU }

    static final int VENDOR_SONY = 0x054C;
    static final int VENDOR_NINTENDO = 0x057E;

    private ControllerStyle() {}

    /** A escolha das configurações ("auto", "xbox", "playstation", "nintendo"); "auto" olha o fabricante. */
    public static Style resolve(String pref, int vendorId) {
        if ("xbox".equals(pref)) {
            return Style.XBOX;
        }
        if ("playstation".equals(pref)) {
            return Style.PLAYSTATION;
        }
        if ("nintendo".equals(pref)) {
            return Style.NINTENDO;
        }
        if (vendorId == VENDOR_SONY) {
            return Style.PLAYSTATION;
        }
        if (vendorId == VENDOR_NINTENDO) {
            return Style.NINTENDO;
        }
        return Style.XBOX;
    }

    public static String glyph(Style style, Action action) {
        switch (action) {
            case CONFIRM:
                return style == Style.PLAYSTATION ? "✕" : style == Style.NINTENDO ? "B" : "A";
            case OPTIONS:
                return style == Style.PLAYSTATION ? "□" : style == Style.NINTENDO ? "Y" : "X";
            case MENU:
            default:
                return style == Style.PLAYSTATION ? "Options" : style == Style.NINTENDO ? "+" : "Menu";
        }
    }
}
