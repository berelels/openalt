package dev.cattastudios.openalt;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import dev.cattastudios.openalt.PairingUri.InvalidPairingUriException;
import dev.cattastudios.openalt.PairingUri.Problem;

public class PairingUriTest {

    /** Gerada por newPairing() de core/src/pairing.ts (nome com acento, vírgula e #; 100.x no meio). */
    private static final String FROM_CORE = "openalt://pair?v=1&n=Zorin+do+L%C3%A9o%2C+sala+%232"
            + "&h=192.168.0.10%2C100.101.102.103%2C10.0.0.5&p=47989"
            + "&fp=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
            + "&pin=1579&d=93f385d88e10&exp=1760000120";
    private static final long NOW = 1760000000L;

    /** SHA-256("abc") */
    private static final String ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    private static String uri(String... overrides) {
        String[][] fields = {
                {"v", "1"}, {"n", "PC"}, {"h", "192.168.1.2"}, {"p", "47989"},
                {"fp", ABC_SHA256}, {"pin", "0420"}, {"d", "a1b2c3"}, {"exp", String.valueOf(NOW + 120)},
        };
        StringBuilder sb = new StringBuilder("openalt://pair?");
        for (String[] f : fields) {
            String value = f[1];
            boolean skip = false;
            for (String o : overrides) {
                if (o.equals("-" + f[0])) {
                    skip = true;
                } else if (o.startsWith(f[0] + "=")) {
                    value = o.substring(f[0].length() + 1);
                }
            }
            if (!skip) {
                sb.append(f[0]).append('=').append(value).append('&');
            }
        }
        return sb.substring(0, sb.length() - 1);
    }

    private static void assertRejected(String text, Problem problem, String field) {
        try {
            PairingUri.parse(text, NOW);
            fail("deveria recusar: " + text);
        } catch (InvalidPairingUriException e) {
            assertEquals(problem, e.problem);
            if (field != null) {
                assertEquals(field, e.field);
            }
        }
    }

    @Test
    public void readsTheUriTheCoreGenerates() throws Exception {
        PairingUri p = PairingUri.parse(FROM_CORE, NOW);
        assertEquals("Zorin do Léo, sala #2", p.pcName);
        assertEquals(Arrays.asList("192.168.0.10", "10.0.0.5", "100.101.102.103"), p.hosts);
        assertEquals(47989, p.port);
        assertEquals("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", p.fingerprint);
        assertEquals("1579", p.pin);
        assertEquals("93f385d88e10", p.requestId);
        assertEquals(1760000120L, p.expiresAtSeconds);
        assertEquals(120, p.secondsLeft(NOW));
    }

    @Test
    public void acceptsSurroundingWhitespaceAndUppercaseScheme() throws Exception {
        assertEquals("a1b2c3", PairingUri.parse("  " + uri().replace("openalt://", "OpenAlt://") + "\n", NOW).requestId);
    }

    // ── validade ──

    @Test
    public void rejectsExpiredQr() {
        assertRejected(uri("exp=" + (NOW - 1)), Problem.EXPIRED, "exp");
    }

    @Test
    public void expiresExactlyAtExp() {
        // O PC trata now >= expiresAt como vencido (matchPending); o aparelho também
        assertRejected(uri("exp=" + NOW), Problem.EXPIRED, "exp");
    }

    @Test
    public void validOneSecondBeforeExp() throws Exception {
        assertEquals(1, PairingUri.parse(uri("exp=" + (NOW + 1)), NOW).secondsLeft(NOW));
    }

    @Test
    public void expiredWinsOverOtherProblems() {
        assertRejected(uri("exp=" + (NOW - 10), "pin=12"), Problem.EXPIRED, "exp");
    }

    @Test
    public void rejectsMissingOrBadExp() {
        assertRejected(uri("-exp"), Problem.MISSING_FIELD, "exp");
        assertRejected(uri("exp=-5"), Problem.INVALID_FIELD, "exp");
        assertRejected(uri("exp=12abc"), Problem.INVALID_FIELD, "exp");
        assertRejected(uri("exp=99999999999999999999"), Problem.INVALID_FIELD, "exp");
    }

    // ── formato ──

    @Test
    public void rejectsOtherQrCodes() {
        assertRejected(null, Problem.NOT_OPENALT, null);
        assertRejected("", Problem.NOT_OPENALT, null);
        assertRejected("https://example.com/?v=1", Problem.NOT_OPENALT, null);
        assertRejected("openalt://unpair?v=1", Problem.NOT_OPENALT, null);
        assertRejected("openalt:pair?v=1", Problem.NOT_OPENALT, null);
        assertRejected("xopenalt://pair?v=1", Problem.NOT_OPENALT, null);
    }

    @Test
    public void rejectsHugeInput() {
        StringBuilder sb = new StringBuilder(uri());
        while (sb.length() <= PairingUri.MAX_URI_LENGTH) {
            sb.append("&x=aaaaaaaaaa");
        }
        assertRejected(sb.toString(), Problem.NOT_OPENALT, null);
    }

    @Test
    public void rejectsOtherVersions() {
        assertRejected(uri("v=2"), Problem.UNSUPPORTED_VERSION, "v");
        assertRejected(uri("-v"), Problem.MISSING_FIELD, "v");
    }

    @Test
    public void rejectsRepeatedFields() {
        assertRejected(uri() + "&pin=9999", Problem.INVALID_FIELD, "pin");
    }

    @Test
    public void ignoresUnknownFieldsAndFragment() throws Exception {
        assertEquals("0420", PairingUri.parse(uri() + "&novo=1#x", NOW).pin);
    }

    @Test
    public void rejectsBadPercentEncoding() {
        assertRejected(uri("n=%zz"), Problem.INVALID_FIELD, "n");
    }

    // ── PIN, id, impressão digital, porta ──

    @Test
    public void pinMustBeFourDigits() {
        assertRejected(uri("-pin"), Problem.MISSING_FIELD, "pin");
        assertRejected(uri("pin=123"), Problem.INVALID_FIELD, "pin");
        assertRejected(uri("pin=12345"), Problem.INVALID_FIELD, "pin");
        assertRejected(uri("pin=12a4"), Problem.INVALID_FIELD, "pin");
        assertRejected(uri("pin=%EF%BC%91234"), Problem.INVALID_FIELD, "pin"); // dígito de largura total
    }

    @Test
    public void keepsLeadingZeroOfPin() throws Exception {
        assertEquals("0420", PairingUri.parse(uri(), NOW).pin);
    }

    @Test
    public void requestIdMustBeHex() throws Exception {
        assertRejected(uri("-d"), Problem.MISSING_FIELD, "d");
        assertRejected(uri("d=xyz"), Problem.INVALID_FIELD, "d");
        assertRejected(uri("d=a1+b2"), Problem.INVALID_FIELD, "d");
        assertRejected(uri("d=0123456789abcdef0123456789abcdef0"), Problem.INVALID_FIELD, "d");
        assertEquals("a1b2c3", PairingUri.parse(uri("d=A1B2C3"), NOW).requestId);
    }

    @Test
    public void fingerprintMustBeSha256() throws Exception {
        assertRejected(uri("-fp"), Problem.MISSING_FIELD, "fp");
        assertRejected(uri("fp=abcd"), Problem.INVALID_FIELD, "fp");
        assertRejected(uri("fp=" + ABC_SHA256 + "00"), Problem.INVALID_FIELD, "fp");
        assertRejected(uri("fp=" + ABC_SHA256.replace('b', 'g')), Problem.INVALID_FIELD, "fp");
        // Formato do Node (fingerprint256): maiúsculas com dois-pontos
        String colons = ABC_SHA256.toUpperCase().replaceAll("(..)(?!$)", "$1:");
        assertEquals(ABC_SHA256, PairingUri.parse(uri("fp=" + colons), NOW).fingerprint);
    }

    @Test
    public void portMustBeValid() throws Exception {
        assertRejected(uri("-p"), Problem.MISSING_FIELD, "p");
        assertRejected(uri("p=0"), Problem.INVALID_FIELD, "p");
        assertRejected(uri("p=65536"), Problem.INVALID_FIELD, "p");
        assertRejected(uri("p=999999999999"), Problem.INVALID_FIELD, "p");
        assertRejected(uri("p=http"), Problem.INVALID_FIELD, "p");
        assertEquals(1, PairingUri.parse(uri("p=1"), NOW).port);
        assertEquals(65535, PairingUri.parse(uri("p=65535"), NOW).port);
    }

    // ── endereços ──

    @Test
    public void tailscaleAddressesGoLastKeepingPcOrder() throws Exception {
        PairingUri p = PairingUri.parse(uri("h=100.64.0.1,192.168.1.2,100.100.1.1,10.0.0.2,172.16.5.5"), NOW);
        assertEquals(Arrays.asList("192.168.1.2", "10.0.0.2", "172.16.5.5", "100.64.0.1", "100.100.1.1"), p.hosts);
    }

    @Test
    public void onlyTailscaleAddresses() throws Exception {
        assertEquals(Arrays.asList("100.80.1.2"), PairingUri.parse(uri("h=100.80.1.2"), NOW).hosts);
    }

    @Test
    public void hostsDeduplicatedAndBlanksIgnored() throws Exception {
        PairingUri p = PairingUri.parse(uri("h=192.168.1.2,,192.168.1.2, 10.0.0.2 "), NOW);
        assertEquals(Arrays.asList("192.168.1.2", "10.0.0.2"), p.hosts);
    }

    @Test
    public void acceptsIpv6AndNames() throws Exception {
        PairingUri p = PairingUri.parse(uri("h=fe80::1,[fd7a:115c:a1e0::1],meu-pc.tail1234.ts.net"), NOW);
        assertEquals(Arrays.asList("fe80::1", "fd7a:115c:a1e0::1", "meu-pc.tail1234.ts.net"), p.hosts);
    }

    @Test
    public void rejectsBadHosts() {
        assertRejected(uri("-h"), Problem.MISSING_FIELD, "h");
        assertRejected(uri("h=,,"), Problem.MISSING_FIELD, "h");
        assertRejected(uri("h=999.1.1.1"), Problem.INVALID_FIELD, "h");
        assertRejected(uri("h=192.168.1.2:8080"), Problem.INVALID_FIELD, "h");
        assertRejected(uri("h=evil/path"), Problem.INVALID_FIELD, "h");
        assertRejected(uri("h=a%40b.com"), Problem.INVALID_FIELD, "h");
        assertRejected(uri("h=-bad.com"), Problem.INVALID_FIELD, "h");
        StringBuilder many = new StringBuilder("h=");
        for (int i = 1; i <= PairingUri.MAX_HOSTS + 1; i++) {
            many.append("10.0.0.").append(i).append(',');
        }
        assertRejected(uri(many.toString()), Problem.INVALID_FIELD, "h");
    }

    @Test
    public void ipv6Literals() {
        for (String ok : new String[] {"::1", "::", "fe80::1", "2001:db8::8a2e:370:7334",
                "2001:db8:0:0:0:0:2:1", "::ffff:192.168.1.2", "fd7a:115c:a1e0::"}) {
            assertTrue(ok, PairingUri.isIpv6(ok));
        }
        for (String bad : new String[] {"192.168.1.2:8080", "1::2::3", ":1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9",
                "1:2:3:4:5:6:7", "12345::1", "fe80::1%wlan0", "g::1", "1:2:3:4:5:6:7:8::"}) {
            assertFalse(bad, PairingUri.isIpv6(bad));
        }
    }

    @Test
    public void isTailscaleAddress() {
        assertTrue(PairingUri.isTailscaleAddress("100.64.0.1"));
        assertTrue(PairingUri.isTailscaleAddress("100.127.255.254"));
        assertFalse(PairingUri.isTailscaleAddress("10.0.0.100"));
        assertFalse(PairingUri.isTailscaleAddress("100.example.com"));
    }

    // ── nome do PC ──

    @Test
    public void pcNameIsOptionalAndCleaned() throws Exception {
        assertEquals("", PairingUri.parse(uri("-n"), NOW).pcName);
        assertEquals("PC da sala", PairingUri.parse(uri("n=PC%0A%09da%E2%80%AE++sala"), NOW).pcName);
        StringBuilder longName = new StringBuilder();
        for (int i = 0; i < 100; i++) {
            longName.append('x');
        }
        assertEquals(PairingUri.MAX_PC_NAME, PairingUri.parse(uri("n=" + longName), NOW).pcName.length());
    }

    // ── nome do cliente (o PC só confirma sozinho "OpenAlt-<d>" ou "OpenAlt-<d> <modelo>") ──

    @Test
    public void deviceNameMatchesWhatThePcAccepts() throws Exception {
        PairingUri p = PairingUri.parse(FROM_CORE, NOW);
        assertEquals("OpenAlt-93f385d88e10", p.deviceName(null));
        assertEquals("OpenAlt-93f385d88e10", p.deviceName("   "));
        assertEquals("OpenAlt-93f385d88e10 Galaxy Tab S9", p.deviceName("Galaxy Tab S9"));
        assertEquals("OpenAlt-93f385d88e10 moto g(84) 5G", p.deviceName("moto g(84)  5G\n"));
        assertEquals("OpenAlt-93f385d88e10 ab", p.deviceName("a&b=<>\"'"));
    }

    @Test
    public void deviceNameModelIsShortened() throws Exception {
        String model = "Tablet com um nome de modelo muito, muito comprido mesmo";
        String name = PairingUri.parse(uri(), NOW).deviceName(model);
        assertTrue(name.startsWith("OpenAlt-a1b2c3 Tablet com um nome"));
        assertTrue(name.length() <= "OpenAlt-a1b2c3 ".length() + PairingUri.MAX_MODEL);
    }

    // ── certificado ──

    @Test
    public void certificateMustMatchFingerprint() throws Exception {
        PairingUri p = PairingUri.parse(uri(), NOW);
        assertTrue(p.certificateMatches("abc".getBytes(StandardCharsets.US_ASCII)));
        assertFalse(p.certificateMatches("abd".getBytes(StandardCharsets.US_ASCII)));
        assertFalse(p.certificateMatches(new byte[0]));
        assertFalse(p.certificateMatches(null));
        assertEquals(32, p.fingerprintBytes().length);
        assertArrayEquals(p.fingerprintBytes(), PairingUri.parse(uri(), NOW).fingerprintBytes());
    }
}
