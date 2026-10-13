package dev.cattastudios.openalt;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class KnownAddressesTest {

    @Test
    public void guardaNaOrdemDoQr() {
        String s = KnownAddresses.encode(47989, Arrays.asList("192.168.0.10", "100.101.102.103"));
        assertEquals("47989|192.168.0.10,100.101.102.103", s);
        List<KnownAddresses.Entry> e = KnownAddresses.decode(s);
        assertEquals(2, e.size());
        assertEquals("192.168.0.10", e.get(0).host);
        assertEquals("100.101.102.103", e.get(1).host);
        assertEquals(47989, e.get(1).port);
    }

    @Test
    public void descartaEnderecosEstranhos() {
        String s = KnownAddresses.encode(47989, Arrays.asList("10.0.0.5", "a b", "x,y", "evil/path", null, "fd7a:115c::1"));
        assertEquals("47989|10.0.0.5,fd7a:115c::1", s);
        assertNull(KnownAddresses.encode(47989, Collections.singletonList("a b")));
    }

    @Test
    public void limiteDeEnderecos() {
        String s = KnownAddresses.encode(1, Arrays.asList("a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"));
        assertEquals(KnownAddresses.MAX_HOSTS, KnownAddresses.decode(s).size());
    }

    @Test
    public void valorCorrompidoViraListaVazia() {
        assertTrue(KnownAddresses.decode(null).isEmpty());
        assertTrue(KnownAddresses.decode("").isEmpty());
        assertTrue(KnownAddresses.decode("abc|10.0.0.1").isEmpty());
        assertTrue(KnownAddresses.decode("0|10.0.0.1").isEmpty());
        assertTrue(KnownAddresses.decode("70000|10.0.0.1").isEmpty());
        assertEquals(1, KnownAddresses.decode("47989|10.0.0.1,a b").size());
    }
}
